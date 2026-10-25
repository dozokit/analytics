import type { Env } from "./index";
import { DIMS, FILTERS, type Dim } from "../shared/dims";
import type { BreakdownRow, Dashboard, GoalsData, Journey, Kpis, PagesData, RealtimeData, SeriesPoint, Site, VisitorRow } from "../shared/types";

type Row = Record<string, unknown>;
const json = <T>(data: T, status = 200) => Response.json(data, { status });

const HOUR = 3600_000;
const DAY = 24 * HOUR;

const isDim = (k: string): k is Dim => Object.hasOwn(DIMS, k);

interface Scope {
  site: string;
  from: number;
  to: number;
  where: string;
  args: unknown[];
  // The same visits over another period, filters included.
  over(from: number, to: number): unknown[];
}

function filterSql(url: URL, site: string) {
  const parts: string[] = [];
  const args: unknown[] = [];
  for (const key of FILTERS) {
    const value = url.searchParams.get(key);
    if (value == null) continue;
    if (key === "page") {
      parts.push("s.id in (select session_id from pageviews where site_id = ? and path = ?)");
      args.push(site, value);
    } else if (key === "goal") {
      parts.push("s.id in (select session_id from events where site_id = ? and name = ?)");
      args.push(site, value);
    } else {
      parts.push(`${DIMS[key]} = ?`);
      args.push(value);
    }
  }
  return { sql: parts.length ? " and " + parts.join(" and ") : "", args };
}

async function scope(url: URL, env: Env): Promise<Scope> {
  const site = url.searchParams.get("site") ?? "";
  let from = Number(url.searchParams.get("from")) || 0;
  const to = Number(url.searchParams.get("to")) || Date.now();
  if (!from) {
    // "All time": start on the local day of the first visit.
    const first = await env.DB.prepare("select min(started_at) as t from sessions where site_id = ?").bind(site).first<{ t: number | null }>();
    const tz = Math.max(-14 * HOUR, Math.min(14 * HOUR, Number(url.searchParams.get("tz")) || 0));
    const t = first?.t ?? to - 30 * DAY;
    from = Math.floor((t - tz) / DAY) * DAY + tz;
  }
  const f = filterSql(url, site);
  const over = (a: number, b: number) => [site, a, b, ...f.args];
  return { site, from, to, where: `s.site_id = ? and s.started_at >= ? and s.started_at < ?${f.sql}`, args: over(from, to), over };
}

function bucketFor(span: number) {
  if (span <= 2 * DAY) return HOUR;
  if (span <= 190 * DAY) return DAY;
  return 7 * DAY;
}

const KPI_SQL = `count(distinct s.visitor_id) as visitors, count(*) as sessions, coalesce(sum(s.pageviews), 0) as pageviews,
  avg(case when s.pageviews = 1 then 1.0 else 0 end) as bounce, avg(s.last_seen - s.started_at) as duration`;

const BREAKDOWNS = [...Object.keys(DIMS), "page", "goal"];

// One ranked list: a session dimension, the pages viewed or the goals completed.
function breakdownQuery(db: D1Database, sc: Scope, dim: string, limit: number) {
  if (dim === "page") {
    return db.prepare(
      `select p.path as key, count(distinct p.visitor_id) as visitors, count(*) as views
       from pageviews p join sessions s on s.site_id = p.site_id and s.id = p.session_id
       where ${sc.where} group by p.path order by visitors desc limit ${limit}`,
    ).bind(...sc.args);
  }
  if (dim === "goal") {
    return db.prepare(
      `select e.name as key, count(distinct e.visitor_id) as visitors, count(*) as completions
       from events e join sessions s on s.site_id = e.site_id and s.id = e.session_id
       where ${sc.where} group by e.name order by visitors desc limit ${limit}`,
    ).bind(...sc.args);
  }
  const col = DIMS[dim as Dim];
  const extra = { city: ", max(s.country) as country, avg(s.lat) as lat, avg(s.lon) as lon", source: ", max(s.channel) as channel", region: ", max(s.country) as country" }[dim] ?? "";
  return db.prepare(
    `select ${col} as key, count(distinct s.visitor_id) as visitors, count(*) as sessions${extra}
     from sessions s where ${sc.where} and ${col} is not null group by key order by visitors desc limit ${limit}`,
  ).bind(...sc.args);
}

async function dashboard(url: URL, env: Env) {
  const sc = await scope(url, env);
  const span = sc.to - sc.from;
  const bucket = bucketFor(span);
  const prevArgs = sc.over(sc.from - span, sc.from);
  const db = env.DB;
  // Only the lists on screen; the others load when their tab opens.
  const asked = url.searchParams.get("dims")?.split(",").filter((d) => BREAKDOWNS.includes(d));
  const dims = asked ?? BREAKDOWNS;

  const results = await db.batch<Row>([
    db.prepare(`select ${KPI_SQL} from sessions s where ${sc.where}`).bind(...sc.args),
    db.prepare(`select ${KPI_SQL} from sessions s where ${sc.where}`).bind(...prevArgs),
    db.prepare(
      `select cast((s.started_at - ?) / ? as integer) as b, ${KPI_SQL} from sessions s where ${sc.where} group by b`,
    ).bind(sc.from, bucket, ...sc.args),
    db.prepare(
      `select cast((s.started_at - ?) / ? as integer) as b, ${KPI_SQL} from sessions s where ${sc.where} group by b`,
    ).bind(sc.from - span, bucket, ...prevArgs),
    db.prepare("select count(distinct visitor_id) as n from sessions where site_id = ? and last_seen > ?").bind(sc.site, Date.now() - 5 * 60_000),
    ...dims.map((d) => breakdownQuery(db, sc, d, d === "city" ? 300 : d === "goal" ? 20 : 10)),
  ]);

  const [kpis, prev, series, prevSeries, online, ...rest] = results.map((r) => r.results ?? []);
  const breakdowns: Record<string, BreakdownRow[]> = {};
  dims.forEach((d, i) => (breakdowns[d] = rest[i] as unknown as BreakdownRow[]));
  return json<Dashboard>({
    from: sc.from,
    to: sc.to,
    bucket,
    kpis: kpis[0] as unknown as Kpis,
    prev: prev[0] as unknown as Kpis,
    series: series as unknown as SeriesPoint[],
    prevSeries: prevSeries as unknown as SeriesPoint[],
    online: (online[0]?.n as number) ?? 0,
    breakdowns,
  });
}

async function breakdownAll(url: URL, env: Env) {
  const dim = url.searchParams.get("dim") ?? "";
  if (!BREAKDOWNS.includes(dim)) return json({ error: "Unknown breakdown." }, 400);
  const limit = Math.max(1, Math.min(500, Number(url.searchParams.get("limit")) || 500));
  const sc = await scope(url, env);
  return json((await breakdownQuery(env.DB, sc, dim, limit).all<BreakdownRow>()).results);
}

async function pages(url: URL, env: Env) {
  const sc = await scope(url, env);
  const bucket = bucketFor(sc.to - sc.from);
  const db = env.DB;
  const [rows, entries] = await db.batch<Row>([
    db.prepare(
      `select p.path as path, max(p.title) as title, count(*) as views, count(distinct p.visitor_id) as visitors,
        count(distinct p.session_id) as sessions, avg(nullif(p.duration, 0)) as duration
       from pageviews p join sessions s on s.site_id = p.site_id and s.id = p.session_id
       where ${sc.where} group by p.path order by views desc limit 200`,
    ).bind(...sc.args),
    db.prepare(
      `select s.entry_path as path, count(*) as entries, sum(case when s.pageviews = 1 then 1 else 0 end) as bounces
       from sessions s where ${sc.where} group by s.entry_path`,
    ).bind(...sc.args),
  ]);
  const list = rows.results ?? [];
  const top = list.slice(0, 60).map((r) => r.path as string);
  let trend: Row[] = [];
  if (top.length) {
    const marks = top.map(() => "?").join(",");
    trend = (
      await db.prepare(
        `select p.path as path, cast((p.ts - ?) / ? as integer) as b, count(*) as n
         from pageviews p join sessions s on s.site_id = p.site_id and s.id = p.session_id
         where ${sc.where} and p.path in (${marks}) group by p.path, b`,
      ).bind(sc.from, bucket, ...sc.args, ...top).all()
    ).results;
  }
  return json({ from: sc.from, to: sc.to, bucket, pages: list, entries: entries.results, trend } as unknown as PagesData);
}

async function realtime(url: URL, env: Env) {
  const site = url.searchParams.get("site") ?? "";
  const now = Date.now();
  const db = env.DB;
  const [visitors, minutes, feed] = await db.batch<Row>([
    db.prepare(
      `select id, visitor_id, started_at, last_seen, is_new, entry_path, exit_path, pageviews, channel, source,
        country, region, city, lat, lon, browser, os, device
       from sessions where site_id = ? and last_seen > ? order by last_seen desc limit 300`,
    ).bind(site, now - 5 * 60_000),
    db.prepare(
      `select cast((? - ts) / 60000 as integer) as m, count(*) as views, count(distinct visitor_id) as visitors
       from pageviews where site_id = ? and ts > ? group by m`,
    ).bind(now, site, now - 30 * 60_000),
    db.prepare(
      `select p.ts, p.path, p.visitor_id, s.country, s.city, s.source, s.channel, s.device
       from pageviews p join sessions s on s.site_id = p.site_id and s.id = p.session_id
       where p.site_id = ? and p.ts > ? order by p.ts desc limit 40`,
    ).bind(site, now - 30 * 60_000),
  ]);
  return json({ now, visitors: visitors.results, minutes: minutes.results, feed: feed.results } as unknown as RealtimeData);
}

// The 200 people seen most recently in the period, counted over all their visits in it,
// with the details of their latest one.
async function visitors(url: URL, env: Env) {
  const sc = await scope(url, env);
  const r = await env.DB.prepare(
    `with v as (
       select s.*, row_number() over (partition by s.visitor_id order by s.last_seen desc) as n,
         count(*) over (partition by s.visitor_id) as visits, sum(s.pageviews) over (partition by s.visitor_id) as pages,
         min(s.started_at) over (partition by s.visitor_id) as first_seen
       from sessions s where ${sc.where}
     )
     select visitor_id, started_at, last_seen, channel, source, country, city, browser, os, device, entry_path,
       visits as sessions, pages as pageviews, first_seen as first, last_seen as last
     from v where n = 1 order by last_seen desc limit 200`,
  ).bind(...sc.args).all<VisitorRow>();
  return json(r.results);
}

async function visitor(url: URL, env: Env, id: string) {
  const site = url.searchParams.get("site") ?? "";
  const db = env.DB;
  const [sessions, views, events] = await db.batch<Row>([
    db.prepare("select * from sessions where site_id = ? and visitor_id = ? order by started_at desc limit 200").bind(site, id),
        // The latest steps, put back in order below.
    db.prepare("select session_id, ts, path, title, duration from pageviews where site_id = ? and visitor_id = ? order by ts desc limit 3000").bind(site, id),
    db.prepare("select session_id, ts, name, path, props from events where site_id = ? and visitor_id = ? order by ts desc limit 1000").bind(site, id),
  ]);
  return json({ sessions: sessions.results, pageviews: views.results.reverse(), events: events.results.reverse() } as unknown as Journey);
}

async function goals(url: URL, env: Env) {
  const sc = await scope(url, env);
  const db = env.DB;
  const [rows, total] = await db.batch<Row>([
    db.prepare(
      `select e.name as name, count(*) as completions, count(distinct e.visitor_id) as visitors, max(e.ts) as last
       from events e join sessions s on s.site_id = e.site_id and s.id = e.session_id
       where ${sc.where} group by e.name order by visitors desc`,
    ).bind(...sc.args),
    db.prepare(`select count(distinct s.visitor_id) as visitors from sessions s where ${sc.where}`).bind(...sc.args),
  ]);
  return json({ goals: rows.results, visitors: total.results[0]?.visitors ?? 0 } as unknown as GoalsData);
}

function newId() {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, (b) => "abcdefghijkmnpqrstuvwxyz23456789"[b % 32]).join("");
}

function cleanDomain(input: unknown) {
  if (typeof input !== "string") return null;
  let d = input.trim().toLowerCase();
  d = d.replace(/^[a-z]+:\/\//, "").replace(/\/.*$/, "").replace(/^www\./, "");
  d = d.replace(/:\d+$/, ""); // pages are matched on the host name alone
  return /^[a-z0-9.-]+$/.test(d) && d.length <= 253 ? d : null;
}

const BAD_DOMAIN = "Enter a domain like example.com, without the path.";

async function listSites(env: Env) {
  const r = await env.DB.prepare(
    `select st.*, (select count(*) from sessions s where s.site_id = st.id and s.started_at > ?) as visits_24h,
      (select max(last_seen) from sessions s where s.site_id = st.id) as last_seen
     from sites st order by st.created_at`,
  ).bind(Date.now() - DAY).all<Site>();
  return json(r.results);
}

async function addSite(req: Request, env: Env) {
  const body = (await req.json().catch(() => ({}))) as { domain?: string; name?: string };
  const domain = cleanDomain(body.domain);
  if (!domain) return json({ error: BAD_DOMAIN }, 400);
  const name = (typeof body.name === "string" && body.name.trim()) || domain;
  const site: Site = { id: newId(), domain, name: name.slice(0, 80), created_at: Date.now() };
  await env.DB.prepare("insert into sites (id, domain, name, created_at) values (?, ?, ?, ?)").bind(site.id, site.domain, site.name, site.created_at).run();
  return json(site, 201);
}

async function checkSite(env: Env, id: string) {
  return json(await env.DB.prepare("select max(ts) as last, count(*) as n from pageviews where site_id = ?").bind(id).first());
}

async function editSite(req: Request, env: Env, id: string) {
  const body = (await req.json().catch(() => ({}))) as { domain?: string; name?: string };
  const domain = body.domain === undefined ? undefined : cleanDomain(body.domain);
  if (domain === null) return json({ error: BAD_DOMAIN }, 400);
  await env.DB.prepare("update sites set name = coalesce(?, name), domain = coalesce(?, domain) where id = ?")
    .bind(typeof body.name === "string" && body.name.trim() ? body.name.trim().slice(0, 80) : null, domain ?? null, id)
    .run();
  return json(await env.DB.prepare("select * from sites where id = ?").bind(id).first<Site>());
}

async function deleteSite(env: Env, id: string) {
  const db = env.DB;
  await db.batch([
    db.prepare("delete from events where site_id = ?").bind(id),
    db.prepare("delete from pageviews where site_id = ?").bind(id),
    db.prepare("delete from sessions where site_id = ?").bind(id),
    db.prepare("delete from sites where id = ?").bind(id),
  ]);
  return json({ ok: true });
}

// A referrer's icon, fetched by the Worker so the dashboard never tells a third party
// which sites send you visitors. Cached a week at the edge.
async function icon(url: URL) {
  const host = url.searchParams.get("host") ?? "";
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(host)) return json({ error: "Not found." }, 404);
  const res = await fetch(`https://icons.duckduckgo.com/ip3/${host}.ico`, { cf: { cacheTtl: 7 * 24 * 3600, cacheEverything: true } });
  // Raster images only, never run as a page: an SVG or HTML answer could carry a script.
  const type = res.headers.get("content-type")?.split(";")[0].trim() ?? "";
  if (!res.ok || !/^image\/(x-icon|vnd\.microsoft\.icon|png|gif|jpeg|webp)$/.test(type)) return new Response(null, { status: 404 });
  return new Response(res.body, {
    headers: {
      "content-type": type,
      "cache-control": "private, max-age=604800",
      "x-content-type-options": "nosniff",
      "content-security-policy": "default-src 'none'; sandbox",
    },
  });
}

type Handler = (req: Request, env: Env, url: URL, id: string) => Promise<Response>;

// "METHOD /path": ":id" stands for one path segment.
const ROUTES: Record<string, Handler> = {
  "GET /dashboard": (_r, env, url) => dashboard(url, env),
  "GET /breakdown": (_r, env, url) => breakdownAll(url, env),
  "GET /pages": (_r, env, url) => pages(url, env),
  "GET /realtime": (_r, env, url) => realtime(url, env),
  "GET /visitors": (_r, env, url) => visitors(url, env),
  "GET /visitors/:id": (_r, env, url, id) => visitor(url, env, id),
  "GET /goals": (_r, env, url) => goals(url, env),
  "GET /icon": (_r, _env, url) => icon(url),
  "GET /sites": (_r, env) => listSites(env),
  "POST /sites": (req, env) => addSite(req, env),
  "GET /sites/:id/check": (_r, env, _u, id) => checkSite(env, id),
  "PATCH /sites/:id": (req, env, _u, id) => editSite(req, env, id),
  "DELETE /sites/:id": (_r, env, _u, id) => deleteSite(env, id),
};

// Routes that work on no particular website.
const SITELESS = new Set(["GET /icon", "GET /sites", "POST /sites"]);

export async function api(req: Request, env: Env, url: URL): Promise<Response> {
  const parts = url.pathname.split("/").filter(Boolean).slice(1); // drop "api"
  let id = "";
  try {
    id = parts[1] ? decodeURIComponent(parts[1]) : "";
  } catch {
    return json({ error: "Not found." }, 404);
  }
  const route = `${req.method} /${parts.map((p, i) => (i === 1 ? ":id" : p)).join("/")}`;
  const handler = ROUTES[route];
  if (!handler) return json({ error: "Not found." }, 404);
  // Every other route reads one website, named in the path or by ?site=: it has to exist.
  if (!SITELESS.has(route)) {
    const site = parts[0] === "sites" ? id : url.searchParams.get("site");
    if (!site || !(await env.DB.prepare("select 1 from sites where id = ?").bind(site).first())) {
      return json({ error: "There is no such website." }, 404);
    }
  }
  return handler(req, env, url, id);
}
