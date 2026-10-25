CREATE TABLE sites (
  id TEXT PRIMARY KEY,
  domain TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

-- One row per visit. Attribution is decided once, on the visit's first page.
CREATE TABLE sessions (
  id TEXT NOT NULL,
  site_id TEXT NOT NULL,
  visitor_id TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  last_seen INTEGER NOT NULL,
  is_new INTEGER NOT NULL DEFAULT 0,
  entry_path TEXT NOT NULL,
  exit_path TEXT NOT NULL,
  pageviews INTEGER NOT NULL DEFAULT 1,
  referrer TEXT,
  channel TEXT NOT NULL,
  source TEXT,
  direct_kind TEXT,
  utm_source TEXT, utm_medium TEXT, utm_campaign TEXT, utm_content TEXT, utm_term TEXT,
  country TEXT, region TEXT, city TEXT, lat REAL, lon REAL,
  browser TEXT, os TEXT, device TEXT, language TEXT,
  PRIMARY KEY (site_id, id)
);
CREATE INDEX sessions_time ON sessions (site_id, started_at);
CREATE INDEX sessions_seen ON sessions (site_id, last_seen);
CREATE INDEX sessions_visitor ON sessions (site_id, visitor_id);

CREATE TABLE pageviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  visitor_id TEXT NOT NULL,
  ts INTEGER NOT NULL,
  path TEXT NOT NULL,
  title TEXT,
  duration INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX pageviews_time ON pageviews (site_id, ts);
CREATE INDEX pageviews_session ON pageviews (site_id, session_id);

CREATE TABLE events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  visitor_id TEXT NOT NULL,
  ts INTEGER NOT NULL,
  name TEXT NOT NULL,
  path TEXT,
  props TEXT
);
CREATE INDEX events_time ON events (site_id, ts);
CREATE INDEX events_session ON events (site_id, session_id);
