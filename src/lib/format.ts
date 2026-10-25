const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });
const whole = new Intl.NumberFormat("en");
const regions = new Intl.DisplayNames(["en"], { type: "region" });

export function count(n: number | null | undefined) {
  const v = n ?? 0;
  return v >= 10_000 ? compact.format(v) : whole.format(Math.round(v));
}

export function percent(n: number | null | undefined) {
  return `${Math.round((n ?? 0) * 100)}%`;
}

export function duration(ms: number | null | undefined) {
  const s = Math.round((ms ?? 0) / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${String(s % 60).padStart(2, "0")}s`;
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`;
}

export function change(current: number | null | undefined, previous: number | null | undefined) {
  const c = current ?? 0;
  const p = previous ?? 0;
  if (!p) return null;
  return (c - p) / p;
}

export function countryName(code: string | null | undefined) {
  if (!code) return "Unknown";
  if (code === "T1") return "Tor";
  if (code === "XX") return "Unknown";
  try {
    return regions.of(code) ?? code;
  } catch {
    return code;
  }
}

export function ago(ts: number, now = Date.now()) {
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return d === 1 ? "yesterday" : `${d} days ago`;
}

const dayFmt = new Intl.DateTimeFormat("en", { day: "numeric", month: "short" });
const dayYearFmt = new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric" });
const hourFmt = new Intl.DateTimeFormat("en", { hour: "numeric" });
const timeFmt = new Intl.DateTimeFormat("en", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const fullFmt = new Intl.DateTimeFormat("en", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export const fmt = {
  day: (t: number) => dayFmt.format(t),
  dayYear: (t: number) => dayYearFmt.format(t),
  hour: (t: number) => hourFmt.format(t),
  time: (t: number) => timeFmt.format(t),
  full: (t: number) => fullFmt.format(t),
};

export const DIRECT_LABEL: Record<string, string> = {
  typed: "Typed or bookmarked",
  shared: "Shared link",
  checkout: "Back from checkout",
  inapp: "In-app browser",
};

// The live page, opened so that this visit is not counted: dozokit_ignore=1 also
// stops the browser being counted on that site afterwards.
export function liveUrl(domain: string, path: string) {
  // On "All sites" a path arrives with its domain in front: "example.com/pricing".
  if (!domain) {
    const cut = path.indexOf("/");
    return liveUrl(cut === -1 ? path : path.slice(0, cut), cut === -1 ? "/" : path.slice(cut));
  }
  const local = /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(domain);
  // The path only ever sets the pathname: a stored "///evil.com" cannot change the host.
  const url = new URL(`${local ? "http" : "https"}://${domain}`);
  url.pathname = path;
  url.searchParams.set("dozokit_ignore", "1");
  return url.toString();
}
