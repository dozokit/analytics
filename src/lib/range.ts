import { FILTERS } from "../../shared/dims";

const DAY = 24 * 3600_000;

export const RANGES = [
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "7d", label: "Last 7 days" },
  { id: "30d", label: "Last 30 days" },
  { id: "90d", label: "Last 90 days" },
  { id: "12m", label: "Last 12 months" },
  { id: "all", label: "All time" },
] as const;

export type RangeId = (typeof RANGES)[number]["id"];

function midnight(t: number) {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

// Days end at local midnight, so a range never splits today in two.
export function resolveRange(id: string | null): { id: RangeId; from: number; to: number } {
  const now = Date.now();
  const today = midnight(now);
  const tomorrow = midnight(today + DAY + 3600_000);
  switch (id) {
    case "today":
      return { id, from: today, to: tomorrow };
    case "yesterday":
      return { id, from: midnight(today - DAY + 3600_000), to: today };
    case "7d":
      return { id, from: midnight(tomorrow - 7 * DAY), to: tomorrow };
    case "90d":
      return { id, from: midnight(tomorrow - 90 * DAY), to: tomorrow };
    case "12m":
      return { id, from: midnight(tomorrow - 365 * DAY), to: tomorrow };
    case "all":
      return { id, from: 0, to: tomorrow };
    default:
      return { id: "30d", from: midnight(tomorrow - 30 * DAY), to: tomorrow };
  }
}

export function rangeQuery(site: string, params: URLSearchParams) {
  const r = resolveRange(params.get("range"));
  const q = new URLSearchParams({ site, from: String(r.from), to: String(r.to), tz: String(new Date().getTimezoneOffset() * -60_000) });
  for (const k of FILTERS) {
    const v = params.get(k);
    if (v != null) q.set(k, v);
  }
  return q.toString();
}
