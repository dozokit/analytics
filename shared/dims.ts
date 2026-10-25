// The dimensions a breakdown can rank and a filter can narrow by, shared by the
// Worker (which turns them into SQL) and the dashboard (which keeps them in the address).
export const FILTERS = ["channel", "source", "campaign", "page", "entry", "exit", "country", "region", "city", "browser", "os", "device", "direct", "goal"] as const;
export type FilterKey = (typeof FILTERS)[number];

// The session column behind each dimension; page and goal are matched through their own tables.
export const DIMS = {
  channel: "s.channel",
  source: "s.source",
  campaign: "s.utm_campaign",
  entry: "s.entry_path",
  exit: "s.exit_path",
  country: "s.country",
  region: "s.region",
  city: "s.city",
  browser: "s.browser",
  os: "s.os",
  device: "s.device",
  direct: "s.direct_kind",
} as const satisfies Partial<Record<FilterKey, string>>;
export type Dim = keyof typeof DIMS;
