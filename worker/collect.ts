import type { Env } from "./index";
import { classify, referrerHost } from "./classify";
import { BOT, parseUA } from "./ua";

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type",
};

const done = (status = 202) => new Response(null, { status, headers: CORS });

interface Hit {
  site: string;
  t: "pageview" | "event" | "ping";
  v: string;
  s: string;
  n?: boolean;
  u?: string;
  r?: string;
  ti?: string;
  w?: number;
  l?: string;
  name?: string;
  p?: unknown;
}

const ID = /^[A-Za-z0-9_-]{4,64}$/;

// One leading slash, no trailing one, and never a "//host" that a link could follow.
function cleanPath(pathname: string) {
  let path = pathname;
  try {
    path = decodeURIComponent(pathname);
  } catch {}
  path = "/" + path.slice(0, 300).replace(/^[\\/]+/, "").replace(/\/+$/, "");
  return path;
}

const LOCAL = /^(localhost|127\.0\.0\.1|\[::1\])$/;

// Pages on a development machine count only when this Worker runs on one too.
function allowedHost(host: string, domain: string, req: Request) {
  const h = host.replace(/^www\./, "");
  const d = domain.replace(/^www\./, "");
  return h === d || h.endsWith("." + d) || (LOCAL.test(h) && LOCAL.test(new URL(req.url).hostname));
}

// The time on the visit's latest page, measured up to now.
const touchLastPage = (db: D1Database, now: number, site: string, session: string) =>
  db.prepare(
    "update pageviews set duration = max(duration, min(? - ts, 3600000)) where id = (select max(id) from pageviews where site_id = ? and session_id = ?)",
  ).bind(now, site, session);

export async function collect(req: Request, env: Env): Promise<Response> {
  if (req.method === "OPTIONS") return done(204);
  if (req.method !== "POST") return done(405);

  const ua = req.headers.get("user-agent") ?? "";
  if (BOT.test(ua)) return done();

  if (Number(req.headers.get("content-length") ?? 0) > 4096) return done(413);
  let hit: Hit;
  try {
    const text = await req.text();
    if (text.length > 4096) return done(413);
    hit = JSON.parse(text);
  } catch {
    return done(400);
  }
  if (!hit || typeof hit.site !== "string" || !ID.test(hit.v ?? "") || !ID.test(hit.s ?? "")) return done(400);

  const ip = req.headers.get("cf-connecting-ip") ?? "local";
  if (env.COLLECT_LIMIT && !(await env.COLLECT_LIMIT.limit({ key: `${ip}:${hit.site}` })).success) return done(429);

  const site = await env.DB.prepare("select id, domain from sites where id = ?").bind(hit.site).first<{ id: string; domain: string }>();
  if (!site) return done(404);

  // Browsers say which page sent the hit; one from another site is not a visit here.
  const origin = req.headers.get("origin");
  if (origin) {
    try {
      if (!allowedHost(new URL(origin).hostname, site.domain, req)) return done(403);
    } catch {
      return done(403);
    }
  }

  const now = Date.now();
  const db = env.DB;

  if (hit.t === "ping") {
    await db.batch([
      db.prepare("update sessions set last_seen = ? where site_id = ? and id = ?").bind(now, site.id, hit.s),
      touchLastPage(db, now, site.id, hit.s),
    ]);
    return done();
  }

  let page: URL;
  try {
    page = new URL(hit.u ?? "");
  } catch {
    return done(400);
  }
  if (!allowedHost(page.hostname, site.domain, req)) return done(403);
  const path = cleanPath(page.pathname);

  if (hit.t === "event") {
    const name = String(hit.name ?? "").trim().slice(0, 64);
    if (!name) return done(400);
    const props = hit.p && typeof hit.p === "object" ? JSON.stringify(hit.p) : null;
    if (props && props.length > 1000) return done(413);
    // A goal sent as the page loads may land before its visit; it joins up once the visit does.
    await db.batch([
      db.prepare("insert into events (site_id, session_id, visitor_id, ts, name, path, props) values (?, ?, ?, ?, ?, ?, ?)").bind(site.id, hit.s, hit.v, now, name, path, props),
      db.prepare("update sessions set last_seen = ? where site_id = ? and id = ?").bind(now, site.id, hit.s),
    ]);
    return done();
  }

  if (hit.t !== "pageview") return done(400);

  const title = typeof hit.ti === "string" ? hit.ti.slice(0, 200) : null;
  const cf = (req.cf ?? {}) as Record<string, unknown>;
  const { browser, os, device } = parseUA(ua, Number(hit.w) || undefined);
  const refHost = referrerHost(hit.r);
  const params = page.searchParams;
  const isNew = Boolean(hit.n);
  const a = classify({ refHost, pageHost: page.hostname, path, params, ua, device, isNew });
  const num = (v: unknown) => (v == null || v === "" || Number.isNaN(Number(v)) ? null : Number(v));
  const str = (v: unknown) => (typeof v === "string" && v ? v.slice(0, 120) : null);
  const utm = (k: string) => str(params.get(k));

  // The visit's first page creates it and decides its attribution; later pages, even two
  // landing at once, only move it on.
  await db.batch([
    touchLastPage(db, now, site.id, hit.s),
    db.prepare(
      `insert into sessions (id, site_id, visitor_id, started_at, last_seen, is_new, entry_path, exit_path, pageviews,
        referrer, channel, source, direct_kind, utm_source, utm_medium, utm_campaign, utm_content, utm_term,
        country, region, city, lat, lon, browser, os, device, language)
       values (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       on conflict (site_id, id) do update set last_seen = excluded.last_seen, exit_path = excluded.exit_path, pageviews = pageviews + 1`,
    ).bind(
      hit.s, site.id, hit.v, now, now, isNew ? 1 : 0, path, path,
      refHost, a.channel, a.source, a.directKind,
      utm("utm_source"), utm("utm_medium"), utm("utm_campaign"), utm("utm_content"), utm("utm_term"),
      str(cf.country), str(cf.region), str(cf.city), num(cf.latitude), num(cf.longitude),
      browser, os, device, str(hit.l)?.slice(0, 16) ?? null,
    ),
    db.prepare("insert into pageviews (site_id, session_id, visitor_id, ts, path, title) values (?, ?, ?, ?, ?, ?)").bind(site.id, hit.s, hit.v, now, path, title),
  ]);
  return done();
}
