import { useEffect, useMemo, useState } from "react";
import type { BreakdownRow, Dashboard, Kpis, Site } from "../lib/api";
import { change, count, countryName, DIRECT_LABEL, duration, percent } from "../lib/format";
import { rangeQuery } from "../lib/range";
import { linkTo, useParams } from "../lib/router";
import { useFetch } from "../lib/useFetch";
import { Breakdown } from "../components/Breakdown";
import { Favicon, Flag, OpenPage } from "../components/Labels";
import { Link } from "../components/Shell";
import { Empty, Failed, Skeleton } from "../components/States";
import { TrafficChart, type Metric } from "../components/TrafficChart";
import { WorldMap } from "../components/WorldMap";
import { Snippet } from "../components/Snippet";

const METRICS: (Metric & { kpi: (k: Kpis) => number; lowerIsBetter?: boolean })[] = [
  { id: "visitors", label: "Visitors", pick: (p) => p.visitors, kpi: (k) => k.visitors, format: count },
  { id: "pageviews", label: "Pageviews", pick: (p) => p.pageviews, kpi: (k) => k.pageviews, format: count },
  { id: "sessions", label: "Visits", pick: (p) => p.sessions, kpi: (k) => k.sessions, format: count },
  { id: "bounce", label: "Bounce rate", pick: (p) => p.bounce ?? 0, kpi: (k) => k.bounce ?? 0, format: percent, lowerIsBetter: true },
  { id: "duration", label: "Visit duration", pick: (p) => p.duration ?? 0, kpi: (k) => k.duration ?? 0, format: duration },
];

// Breakdowns shown before any click: each panel's first tab, plus what the map and
// the Direct panel need. The other tabs load when opened.
const UP_FRONT = "channel,page,city,browser,direct,goal";

const CHANNEL_ORDER = ["Direct", "Search", "AI", "Social", "Referral", "Email", "Paid"];

export function Overview({ site, onOnline }: { site: Site; onOnline: (n: number) => void }) {
  const { params, set } = useParams();
  const query = rangeQuery(site.id, params);
  const { data, error, loading, reload } = useFetch<Dashboard>(`/api/dashboard?${query}&dims=${UP_FRONT}`, { every: 60_000 });
  const [metricId, setMetricId] = useState("visitors");
  const metric = METRICS.find((m) => m.id === metricId)!;

  useEffect(() => {
    if (data) onOnline(data.online);
  }, [data, onOnline]);

  const filter = (key: string, value: string) => set({ [key]: value });
  const b = data?.breakdowns;
  const total = data?.kpis.visitors ?? 0;
  const all = (dim: string) => `${query}&dim=${dim}`;
  const top = (dim: string) => `${query}&dim=${dim}&limit=10`;

  const cityDots = useMemo(
    () =>
      (b?.city ?? [])
        .filter((r) => r.lat != null && r.lon != null)
        .map((r) => ({ id: r.key, lat: r.lat!, lon: r.lon!, weight: r.visitors, label: `${r.key}, ${countryName(r.country)}: ${r.visitors} visitors` })),
    [b?.city],
  );

  if (error && !data) return <Failed message={error} retry={reload} />;
  if (data && data.kpis.sessions === 0 && !site.last_seen) return <FirstVisit site={site} />;

  return (
    <div className="overview" aria-busy={loading}>
      <section className="ledger stock" aria-label="Traffic">
        <div className="kpis" role="tablist" aria-label="Chart metric">
          {METRICS.map((m) => {
            const now = data ? m.kpi(data.kpis) : null;
            const delta = data ? change(m.kpi(data.kpis), m.kpi(data.prev)) : null;
            const good = delta == null ? null : m.lowerIsBetter ? delta < 0 : delta > 0;
            return (
              <button key={m.id} type="button" role="tab" aria-selected={m.id === metricId} className="kpi" onClick={() => setMetricId(m.id)}>
                <span className="kpi-label">{m.label}</span>
                <span className="kpi-value">{now == null ? <span className="kpi-wait" /> : m.format(now)}</span>
                <span className={`kpi-delta ${good == null ? "" : good ? "is-good" : "is-bad"}`}>
                  {delta == null ? "No earlier data" : `${delta > 0 ? "+" : ""}${Math.round(delta * 100)}% vs before`}
                </span>
              </button>
            );
          })}
        </div>
        {data ? (
          <TrafficChart series={data.series} prevSeries={data.prevSeries} from={data.from} to={data.to} bucket={data.bucket} metric={metric} />
        ) : (
          <div className="chart chart--wait" />
        )}
      </section>

      <div className="grid">
        <Breakdown
          title="Sources"
          loading={loading}
          error={error}
          total={total}
          onFilter={filter}
          tabs={[
            { id: "channel", label: "Channel", rows: sortChannels(b?.channel), filter: "channel", allQuery: null },
            { id: "source", label: "Referrer", rows: undefined, lazyQuery: top("source"), filter: "source", allQuery: all("source"), render: (r) => <Source row={r} /> },
            { id: "campaign", label: "Campaign", rows: undefined, lazyQuery: top("campaign"), filter: "campaign", allQuery: all("campaign") },
          ]}
        />
        <Breakdown
          title="Pages"
          loading={loading}
          error={error}
          total={total}
          onFilter={filter}
          tabs={[
            { id: "page", label: "Page", rows: b?.page, filter: "page", allQuery: all("page"), render: (r) => <span className="path">{r.key}</span>, link: (r) => <OpenPage domain={site.domain} path={r.key} /> },
            { id: "entry", label: "Entry", rows: undefined, lazyQuery: top("entry"), filter: "entry", allQuery: all("entry"), render: (r) => <span className="path">{r.key}</span>, link: (r) => <OpenPage domain={site.domain} path={r.key} /> },
            { id: "exit", label: "Exit", rows: undefined, lazyQuery: top("exit"), filter: "exit", allQuery: all("exit"), render: (r) => <span className="path">{r.key}</span>, link: (r) => <OpenPage domain={site.domain} path={r.key} /> },
          ]}
        />
        <Breakdown
          title="Locations"
          loading={loading}
          error={error}
          total={total}
          onFilter={filter}
          tabs={[
            { id: "map", label: "Map", rows: b?.city, filter: null, custom: b ? <WorldMap dots={cityDots} onSelect={(id) => filter("city", id)} /> : <Skeleton /> },
            { id: "country", label: "Country", rows: undefined, lazyQuery: top("country"), filter: "country", allQuery: all("country"), render: (r) => <span className="place"><Flag code={r.key} />{countryName(r.key)}</span> },
            { id: "region", label: "Region", rows: undefined, lazyQuery: top("region"), filter: "region", allQuery: all("region"), render: (r) => <span className="place"><Flag code={r.country} />{r.key}</span> },
            { id: "city", label: "City", rows: b?.city?.slice(0, 10), filter: "city", allQuery: all("city"), render: (r) => <span className="place"><Flag code={r.country} />{r.key}</span> },
          ]}
        />
        <Breakdown
          title="Devices"
          loading={loading}
          error={error}
          total={total}
          onFilter={filter}
          tabs={[
            { id: "browser", label: "Browser", rows: b?.browser, filter: "browser", allQuery: all("browser") },
            { id: "os", label: "OS", rows: undefined, lazyQuery: top("os"), filter: "os", allQuery: all("os") },
            { id: "device", label: "Device", rows: undefined, lazyQuery: top("device"), filter: "device", allQuery: null },
          ]}
        />
        <DirectPanel rows={b?.direct} onFilter={filter} />
        <Breakdown
          title="Goals"
          loading={loading}
          error={error}
          total={total}
          onFilter={filter}
          tabs={[
            {
              id: "goal",
              label: "Goal",
              rows: b?.goal,
              filter: "goal",
              allQuery: null,
              custom:
                b && !b.goal?.length ? (
                  <Empty action={<Link to={linkTo("/goals", params)} className="btn btn--quiet">Set up goals</Link>}>
                    No goals completed in this period. A goal is a click or a call you name, like a sign-up.
                  </Empty>
                ) : undefined,
            },
          ]}
        />
      </div>
    </div>
  );
}

function sortChannels(rows: BreakdownRow[] | undefined) {
  return rows ? [...rows].sort((a, b) => b.visitors - a.visitors || CHANNEL_ORDER.indexOf(a.key) - CHANNEL_ORDER.indexOf(b.key)) : rows;
}

function Source({ row }: { row: BreakdownRow }) {
  return (
    <span className="source">
      <Favicon host={row.key} />
      {row.key}
    </span>
  );
}

const DIRECT_NOTE: Record<string, string> = {
  typed: "Came to the home page with nothing before it: the address typed, or a bookmark.",
  shared: "New visitors landing on a deep page or a phone with no referrer: a link from a chat, a mail app or notes.",
  checkout: "Sent back to your site by a payment page.",
  inapp: "Opened inside the Instagram, Facebook, LinkedIn or TikTok app, which hide the referrer. Counted under Social.",
};

function DirectPanel({ rows, onFilter }: { rows: BreakdownRow[] | undefined; onFilter: (k: string, v: string) => void }) {
  const [focus, setFocus] = useState<string | null>(null);
  // Every kind here arrived with no referrer, in-app browsers (counted under Social) included.
  const direct = (rows ?? []).reduce((n, r) => n + r.visitors, 0);
  const max = Math.max(1, ...(rows ?? []).map((r) => r.visitors));
  const shown = focus ?? rows?.[0]?.key ?? null;
  return (
    <section className="panel" aria-labelledby="direct-title">
      <header className="panel-head">
        <h2 id="direct-title">Direct, explained</h2>
      </header>
      {!rows ? (
        <Skeleton rows={4} />
      ) : !rows.length ? (
        <Empty>No direct visits in this period.</Empty>
      ) : (
        <>
          <p className="panel-note">
            Of <span className="fig">{count(direct)}</span> visitors with no referrer, here is what most likely happened.
          </p>
          <ol className="rows">
            {rows.map((r) => (
              <li key={r.key}>
                <button
                  type="button"
                  className="row"
                  onMouseEnter={() => setFocus(r.key)}
                  onFocus={() => setFocus(r.key)}
                  onClick={() => onFilter("direct", r.key)}
                >
                  <span className="row-bar" style={{ transform: `scaleX(${r.visitors / max})` }} aria-hidden="true" />
                  <span className="row-key">{DIRECT_LABEL[r.key] ?? r.key}</span>
                  <span className="row-value fig">{count(r.visitors)}</span>
                </button>
              </li>
            ))}
          </ol>
          {shown && <p className="direct-note">{DIRECT_NOTE[shown]}</p>}
        </>
      )}
    </section>
  );
}

function FirstVisit({ site }: { site: Site }) {
  return (
    <section className="first-visit">
      <h1>Waiting for the first visit to {site.domain}</h1>
      <p className="lead">Add this tag to every page, inside the head, then open the site once. This page updates by itself.</p>
      <Snippet site={site} watch />
    </section>
  );
}
