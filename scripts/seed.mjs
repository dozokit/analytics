// Fills the local database with 60 days of made-up traffic for a "demo" site,
// so the dashboard can be looked at before any real site sends visits.
// Writes .wrangler/seed.sql; `npm run seed` runs it against local D1.
import { mkdirSync, writeFileSync } from "node:fs";

const DAY = 86_400_000;
const now = Date.now();
let seed = 42;
const rand = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
const pick = (items) => {
  const total = items.reduce((n, [, w]) => n + w, 0);
  let r = rand() * total;
  for (const [v, w] of items) if ((r -= w) <= 0) return v;
  return items[0][0];
};
const id = () => Math.floor(rand() * 2 ** 52).toString(36).padStart(10, "0") + Math.floor(rand() * 2 ** 30).toString(36);
const q = (v) => (v == null ? "NULL" : typeof v === "number" ? String(v) : `'${String(v).replace(/'/g, "''")}'`);

const SOURCES = [
  [{ channel: "Search", source: "google.com" }, 30],
  [{ channel: "Direct", source: "Typed or bookmarked", direct: "typed" }, 14],
  [{ channel: "Direct", source: "Shared link", direct: "shared" }, 9],
  [{ channel: "Social", source: "x.com" }, 12],
  [{ channel: "Social", source: "news.ycombinator.com" }, 6],
  [{ channel: "Social", source: "reddit.com" }, 6],
  [{ channel: "Social", source: "instagram.com", direct: "inapp" }, 3],
  [{ channel: "Social", source: "linkedin.com" }, 3],
  [{ channel: "AI", source: "chatgpt.com" }, 6],
  [{ channel: "AI", source: "perplexity.ai" }, 2],
  [{ channel: "AI", source: "claude.ai" }, 2],
  [{ channel: "Search", source: "duckduckgo.com" }, 3],
  [{ channel: "Search", source: "bing.com" }, 2],
  [{ channel: "Referral", source: "github.com" }, 4],
  [{ channel: "Referral", source: "producthunt.com" }, 2],
  [{ channel: "Email", source: "newsletter", campaign: "october-update" }, 3],
  [{ channel: "Direct", source: "Checkout return", direct: "checkout" }, 1],
];

const CITIES = [
  [["US", "California", "San Francisco", 37.77, -122.42], 9],
  [["US", "New York", "New York", 40.71, -74.0], 9],
  [["US", "Texas", "Austin", 30.27, -97.74], 4],
  [["US", "Washington", "Seattle", 47.61, -122.33], 4],
  [["GB", "England", "London", 51.51, -0.13], 9],
  [["FR", "Île-de-France", "Paris", 48.86, 2.35], 7],
  [["FR", "Auvergne-Rhône-Alpes", "Lyon", 45.76, 4.84], 2],
  [["DE", "Berlin", "Berlin", 52.52, 13.4], 6],
  [["DE", "Bavaria", "Munich", 48.14, 11.58], 3],
  [["NL", "North Holland", "Amsterdam", 52.37, 4.9], 4],
  [["ES", "Madrid", "Madrid", 40.42, -3.7], 3],
  [["IN", "Karnataka", "Bengaluru", 12.97, 77.59], 6],
  [["CA", "Ontario", "Toronto", 43.65, -79.38], 4],
  [["BR", "São Paulo", "São Paulo", -23.55, -46.63], 3],
  [["AU", "New South Wales", "Sydney", -33.87, 151.21], 3],
  [["JP", "Tokyo", "Tokyo", 35.68, 139.69], 3],
  [["SG", "Singapore", "Singapore", 1.35, 103.82], 2],
  [["SE", "Stockholm", "Stockholm", 59.33, 18.07], 2],
  [["PL", "Mazovia", "Warsaw", 52.23, 21.01], 2],
  [["NG", "Lagos", "Lagos", 6.52, 3.38], 1],
];

const PAGES = [
  [["/", "Home"], 34],
  [["/pricing", "Pricing"], 14],
  [["/blog/self-hosting-on-workers", "Self-hosting on Workers"], 9],
  [["/blog/what-direct-traffic-means", "What direct traffic means"], 7],
  [["/docs", "Docs"], 8],
  [["/docs/install", "Install"], 6],
  [["/changelog", "Changelog"], 5],
  [["/about", "About"], 3],
  [["/signup", "Create an account"], 6],
  [["/compare/plausible", "Compared with Plausible"], 4],
];
const LANDINGS = [
  [["/", "Home"], 40],
  [["/blog/self-hosting-on-workers", "Self-hosting on Workers"], 18],
  [["/blog/what-direct-traffic-means", "What direct traffic means"], 10],
  [["/pricing", "Pricing"], 12],
  [["/docs/install", "Install"], 8],
  [["/compare/plausible", "Compared with Plausible"], 7],
  [["/changelog", "Changelog"], 5],
];

const DEVICES = [
  [{ device: "Desktop", browser: "Chrome", os: "macOS" }, 22],
  [{ device: "Desktop", browser: "Safari", os: "macOS" }, 9],
  [{ device: "Desktop", browser: "Chrome", os: "Windows" }, 16],
  [{ device: "Desktop", browser: "Edge", os: "Windows" }, 5],
  [{ device: "Desktop", browser: "Firefox", os: "Linux" }, 4],
  [{ device: "Desktop", browser: "Firefox", os: "Windows" }, 3],
  [{ device: "Mobile", browser: "Safari", os: "iOS" }, 20],
  [{ device: "Mobile", browser: "Chrome", os: "Android" }, 13],
  [{ device: "Mobile", browser: "Samsung Internet", os: "Android" }, 2],
  [{ device: "Tablet", browser: "Safari", os: "iPadOS" }, 3],
];

const sessions = [];
const pageviews = [];
const events = [];
const visitors = [];

function visit(start, returning) {
  const who = returning && visitors.length > 50 && rand() < 0.35 ? visitors[Math.floor(rand() * visitors.length)] : null;
  const v = who ?? { id: id(), place: pick(CITIES), dev: pick(DEVICES) };
  if (!who) visitors.push(v);
  let src = pick(SOURCES);
  if (src.direct === "inapp" && v.dev.device === "Desktop") src = SOURCES[0][0];
  const [land, landTitle] = src.direct === "typed" ? ["/", "Home"] : src.direct === "checkout" ? ["/thanks", "Thanks"] : pick(LANDINGS);
  const count = rand() < 0.42 ? 1 : 1 + Math.floor(rand() * rand() * 7) + 1;
  const sid = id();
  let t = start;
  const views = [[land, landTitle]];
  for (let i = 1; i < count; i++) views.push(pick(PAGES));
  views.forEach(([path, title], i) => {
    const dur = i === views.length - 1 ? (count === 1 ? Math.floor(4000 + rand() * 50000) : Math.floor(5000 + rand() * 90000)) : Math.floor(8000 + rand() * 140000);
    pageviews.push([sid, v.id, t, path, title, dur]);
    if (path === "/signup" && rand() < 0.45) events.push([sid, v.id, t + Math.floor(dur * 0.8), "signup", path]);
    if (path === "/pricing" && rand() < 0.12) events.push([sid, v.id, t + Math.floor(dur * 0.6), "checkout", path]);
    if (path.startsWith("/docs") && rand() < 0.2) events.push([sid, v.id, t + Math.floor(dur * 0.5), "copy-snippet", path]);
    t += dur;
  });
  const [country, region, city, lat, lon] = v.place;
  const jitter = () => (rand() - 0.5) * 0.6;
  sessions.push({
    id: sid, visitor: v.id, start, last: t, isNew: who ? 0 : 1, entry: land, exit: views[views.length - 1][0], count,
    referrer: src.channel === "Direct" || src.source === "newsletter" ? null : src.source,
    channel: src.channel, source: src.source, direct: src.direct ?? null,
    utm_source: src.campaign ? src.source : null, utm_medium: src.campaign ? "email" : null, utm_campaign: src.campaign ?? null,
    country, region, city, lat: lat + jitter(), lon: lon + jitter(), ...v.dev,
  });
}

const start = new Date(now - 60 * DAY);
start.setHours(0, 0, 0, 0);
for (let day = 0; day <= 60; day++) {
  const base = new Date(start.getTime() + day * DAY);
  const weekend = base.getDay() === 0 || base.getDay() === 6;
  const growth = 0.7 + (day / 60) * 0.6;
  let n = Math.round((weekend ? 120 : 190) * growth * (0.85 + rand() * 0.3));
  if (day === 41) n *= 4; // the day a post did well
  for (let i = 0; i < n; i++) {
    // Afternoon-heavy, in local time.
    const hour = Math.min(23.99, Math.max(0, 14 + (rand() + rand() + rand() - 1.5) * 9));
    const t = base.getTime() + hour * 3600_000;
    if (t > now - 6 * 60_000) continue;
    visit(t, true);
  }
}
// A few people on the site right now.
for (let i = 0; i < 9; i++) visit(now - Math.floor(rand() * 4 * 60_000), false);
for (const s of sessions.slice(-9)) s.last = Math.max(s.last, now - Math.floor(rand() * 90_000));

const out = [
  "delete from events where site_id = 'demo';",
  "delete from pageviews where site_id = 'demo';",
  "delete from sessions where site_id = 'demo';",
  "delete from sites where id = 'demo';",
  `insert into sites (id, domain, name, created_at) values ('demo', 'demo.dozokit.test', 'Demo site', ${start.getTime()});`,
];
const chunk = (rows, head, fn) => {
  for (let i = 0; i < rows.length; i += 300) out.push(`${head} values ${rows.slice(i, i + 300).map(fn).join(",")};`);
};
chunk(sessions, "insert into sessions (id, site_id, visitor_id, started_at, last_seen, is_new, entry_path, exit_path, pageviews, referrer, channel, source, direct_kind, utm_source, utm_medium, utm_campaign, country, region, city, lat, lon, browser, os, device, language)", (s) =>
  `(${[s.id, "demo", s.visitor, s.start, s.last, s.isNew, s.entry, s.exit, s.count, s.referrer, s.channel, s.source, s.direct, s.utm_source, s.utm_medium, s.utm_campaign, s.country, s.region, s.city, +s.lat.toFixed(3), +s.lon.toFixed(3), s.browser, s.os, s.device, "en-US"].map(q).join(",")})`,
);
chunk(pageviews, "insert into pageviews (site_id, session_id, visitor_id, ts, path, title, duration)", (p) => `(${["demo", ...p].map(q).join(",")})`);
chunk(events, "insert into events (site_id, session_id, visitor_id, ts, name, path)", (e) => `(${["demo", ...e].map(q).join(",")})`);

mkdirSync(".wrangler", { recursive: true });
writeFileSync(".wrangler/seed.sql", out.join("\n"));
console.log(`${sessions.length} visits, ${pageviews.length} pageviews, ${events.length} goal completions written to .wrangler/seed.sql`);
