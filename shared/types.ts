// What each API answer holds, shared by the Worker and the dashboard.

export interface Site {
  id: string;
  domain: string;
  name: string;
  created_at: number;
  visits_24h?: number;
  last_seen?: number | null;
}

export interface Kpis {
  visitors: number;
  sessions: number;
  pageviews: number;
  bounce: number | null;
  duration: number | null;
}

export interface SeriesPoint extends Kpis {
  b: number;
}

export interface BreakdownRow {
  key: string;
  visitors: number;
  sessions?: number;
  views?: number;
  completions?: number;
  country?: string | null;
  channel?: string | null;
  lat?: number | null;
  lon?: number | null;
}

export interface Dashboard {
  from: number;
  to: number;
  bucket: number;
  kpis: Kpis;
  prev: Kpis;
  series: SeriesPoint[];
  prevSeries: SeriesPoint[];
  online: number;
  breakdowns: Record<string, BreakdownRow[]>;
  /** One row per site, on All sites only. */
  sites?: { site: string; visitors: number; sessions: number; pageviews: number; prevVisitors: number }[];
}

export interface Session {
  id: string;
  visitor_id: string;
  started_at: number;
  last_seen: number;
  is_new: number;
  entry_path: string;
  exit_path: string;
  pageviews: number;
  referrer: string | null;
  channel: string;
  source: string | null;
  direct_kind: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  lat: number | null;
  lon: number | null;
  browser: string | null;
  os: string | null;
  device: string | null;
  language: string | null;
  /** On All sites, which site a row belongs to. */
  site_id?: string;
  domain?: string;
}

export interface GoalsData {
  visitors: number;
  goals: { name: string; completions: number; visitors: number; last: number }[];
}

export interface PageRow {
  path: string;
  title: string | null;
  views: number;
  visitors: number;
  sessions: number;
  duration: number | null;
}

export interface PagesData {
  from: number;
  to: number;
  bucket: number;
  pages: PageRow[];
  entries: { path: string; entries: number; bounces: number }[];
  trend: { path: string; b: number; n: number }[];
}

export interface RealtimeData {
  now: number;
  visitors: Session[];
  minutes: { m: number; views: number; visitors: number }[];
  feed: { ts: number; path: string; domain?: string; visitor_id: string; country: string | null; city: string | null; source: string | null; channel: string; device: string | null }[];
}

// The latest visit of each person, with their totals over the period.
export interface VisitorRow extends Session {
  sessions: number;
  first: number;
  last: number;
}

export interface Journey {
  sessions: Session[];
  pageviews: { session_id: string; ts: number; path: string; title: string | null; duration: number }[];
  events: { session_id: string; ts: number; name: string; path: string | null; props: string | null }[];
}
