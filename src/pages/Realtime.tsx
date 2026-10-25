import { useEffect, useMemo, useState } from "react";
import type { RealtimeData, Session, Site } from "../lib/api";
import { ago, countryName, fmt } from "../lib/format";
import { linkTo, useParams } from "../lib/router";
import { useFetch } from "../lib/useFetch";
import { Favicon, OpenPage, Place } from "../components/Labels";
import { Link } from "../components/Shell";
import { Empty, Failed, Skeleton } from "../components/States";
import { WorldMap } from "../components/WorldMap";
import { VisitorTag, visitorName } from "../components/Avatar";

export function Realtime({ site, onOnline }: { site: Site; onOnline: (n: number) => void }) {
  const { params } = useParams();
  const { data, error, reload } = useFetch<RealtimeData>(`/api/realtime?site=${site.id}`, { every: 5000 });
  const [selected, setSelected] = useState<string | null>(null);

  const visitors = useMemo(() => {
    // One row per person even when they have two tabs open.
    const seen = new Set<string>();
    return (data?.visitors ?? []).filter((v) => (seen.has(v.visitor_id) ? false : (seen.add(v.visitor_id), true)));
  }, [data]);

  useEffect(() => {
    if (data) onOnline(visitors.length);
  }, [data, visitors.length, onOnline]);

  const dots = visitors
    .filter((v) => v.lat != null && v.lon != null)
    .map((v) => ({ id: v.visitor_id, lat: v.lat!, lon: v.lon!, weight: 1, live: true, avatar: true, label: `${visitorName(v.visitor_id)} in ${v.city ?? countryName(v.country)}, on ${v.exit_path}` }));

  // Oldest minute first: index 0 is 30 minutes ago, index 29 the current minute.
  const minutes = new Array<number>(30).fill(0);
  for (const m of data?.minutes ?? []) if (m.m >= 0 && m.m < 30) minutes[29 - m.m] = m.views;
  const maxMin = Math.max(1, ...minutes);
  const totalViews = minutes.reduce((n, v) => n + v, 0);
  const recent = new Set((data?.feed ?? []).map((f) => f.visitor_id)).size;

  if (error && !data) return <Failed message={error} retry={reload} />;

  return (
    <div className="realtime">
      <section className="realtime-map stock" aria-labelledby="rt-title">
        <header className="realtime-head">
          <h1 id="rt-title">
            <span className="fig">{data ? visitors.length : "–"}</span> {visitors.length === 1 ? "visitor" : "visitors"} in the last five minutes
          </h1>
          <p className="muted">Updates every five seconds.</p>
        </header>
        {data ? <WorldMap dots={dots} selected={selected} onSelect={setSelected} ratio={0.46} /> : <div className="map map--wait" />}
      </section>

      <div className="realtime-side">
        <section className="panel" aria-labelledby="rt-people">
          <header className="panel-head">
            <h2 id="rt-people">On the site now</h2>
          </header>
          {!data ? (
            <Skeleton rows={6} />
          ) : !visitors.length ? (
            <Empty>Nobody is on {site.domain} right now. Visitors show up here within seconds of arriving.</Empty>
          ) : (
            <ul className="people">
              {visitors.map((v) => (
                <li key={v.visitor_id} className={selected === v.visitor_id ? "is-selected" : undefined}>
                  <button type="button" className="person" onClick={() => setSelected(v.visitor_id)}>
                    <VisitorTag id={v.visitor_id}>
                      <Place country={v.country} city={v.city} />
                    </VisitorTag>
                    <span className="person-page path">{v.exit_path}</span>
                    <span className="person-meta">
                      <Favicon host={v.source} />
                      {v.source ?? v.channel}
                      <span className="muted">
                        {" "}
                        on {v.device?.toLowerCase()}, {v.pageviews} {v.pageviews === 1 ? "page" : "pages"}
                      </span>
                    </span>
                  </button>
                  <OpenPage domain={site.domain} path={v.exit_path} />
                  <Link to={linkTo(`/visitors/${v.visitor_id}`, params)} className="person-open">
                    Journey
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="panel realtime-minutes" aria-labelledby="rt-minutes">
        <header className="panel-head">
          <h2 id="rt-minutes">Pageviews per minute</h2>
          <p className="muted minutes-total">
            <span className="fig">{totalViews}</span> {totalViews === 1 ? "pageview" : "pageviews"} in the last 30 minutes
            {recent > 0 && (
              <>
                , by <span className="fig">{recent}</span> {recent === 1 ? "visitor" : "visitors"}
              </>
            )}
          </p>
        </header>
        <ol className="minutes" aria-label="Pageviews per minute, oldest first">
          {minutes.map((v, i) => {
            const ago = 29 - i;
            return (
              <li key={i} className={ago === 0 ? "minute is-now" : "minute"} title={`${v} ${v === 1 ? "pageview" : "pageviews"}, ${ago === 0 ? "this minute" : `${ago} min ago`}`}>
                <span className="minute-value fig">{v > 0 ? v : ""}</span>
                <span className="minute-bar" style={{ transform: `scaleY(${v / maxMin})` }} />
              </li>
            );
          })}
        </ol>
        <div className="minutes-axis" aria-hidden="true">
          <span>30 min ago</span>
          <span>20 min</span>
          <span>10 min</span>
          <span>now</span>
        </div>
      </section>

      <section className="panel realtime-feed" aria-labelledby="rt-feed">
        <header className="panel-head">
          <h2 id="rt-feed">Latest pageviews</h2>
        </header>
        {!data ? (
          <Skeleton rows={6} />
        ) : !data.feed.length ? (
          <Empty>No pageviews in the last 30 minutes.</Empty>
        ) : (
          <ol className="feed">
            {data.feed.map((f, i) => (
              <li key={`${f.ts}-${i}`}>
                <time className="fig muted" dateTime={new Date(f.ts).toISOString()} title={fmt.full(f.ts)}>
                  {fmt.time(f.ts)}
                </time>
                <OpenPage domain={site.domain} path={f.path}>
                  <span className="path">{f.path}</span>
                </OpenPage>
                <Place country={f.country} city={f.city} />
                <span className="muted">{f.source ?? f.channel}</span>
                <span className="muted feed-ago">{ago(f.ts, data.now)}</span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
