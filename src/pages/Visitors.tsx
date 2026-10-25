import type { Journey, Session, Site, VisitorRow } from "../lib/api";
import { ago, count, countryName, duration, fmt } from "../lib/format";
import { rangeQuery } from "../lib/range";
import { linkTo, navigate, useParams } from "../lib/router";
import { useFetch } from "../lib/useFetch";
import { Favicon, OpenPage, Place } from "../components/Labels";
import { Link } from "../components/Shell";
import { Avatar, VisitorTag, visitorName } from "../components/Avatar";
import { Empty, Failed, Skeleton } from "../components/States";

export function Visitors({ site }: { site: Site }) {
  const { params } = useParams();
  const { data, error, reload } = useFetch<VisitorRow[]>(`/api/visitors?${rangeQuery(site.id, params)}`);

  return (
    <section className="page-section">
      <header className="section-head">
        <h1>Visitors</h1>
        <p className="muted">The 200 most recent people in this period. Open one to see every visit they made.</p>
      </header>
      {error && !data ? (
        <Failed message={error} retry={reload} />
      ) : !data ? (
        <Skeleton rows={10} />
      ) : !data.length ? (
        <Empty>No visitors in this period.</Empty>
      ) : (
        <div className="table-wrap">
          <table className="table table--rows">
            <thead>
              <tr>
                <th scope="col">Visitor</th>
                <th scope="col">Came from</th>
                <th scope="col">Device</th>
                <th scope="col" className="num">Visits</th>
                <th scope="col" className="num">Pages</th>
                <th scope="col" className="num">First seen</th>
                <th scope="col" className="num">Last seen</th>
              </tr>
            </thead>
            <tbody>
              {data.map((v) => {
                const to = linkTo(`/visitors/${v.visitor_id}`, params);
                return (
                  <tr key={v.visitor_id} onClick={() => navigate(to)}>
                    <th scope="row">
                      <Link to={to} className="cell-link">
                        <VisitorTag id={v.visitor_id}>
                          <Place country={v.country} city={v.city} />
                        </VisitorTag>
                      </Link>
                    </th>
                    <td>
                      <span className="source">
                        <Favicon host={v.source} />
                        {v.source ?? v.channel}
                      </span>
                    </td>
                    <td className="muted">
                      {v.browser} on {v.os}
                    </td>
                    <td className="num fig">{count(v.sessions)}</td>
                    <td className="num fig">{count(v.pageviews)}</td>
                    <td className="num muted">{fmt.day(v.first)}</td>
                    <td className="num muted">{ago(v.last)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export function Visitor({ site, id }: { site: Site; id: string }) {
  const { params } = useParams();
  const { data, error, reload } = useFetch<Journey>(`/api/visitors/${encodeURIComponent(id)}?site=${site.id}`);

  if (error && !data) return <Failed message={error} retry={reload} />;
  if (!data) return <Skeleton rows={12} />;
  if (!data.sessions.length) return <Empty action={<Link to={linkTo("/visitors", params)} className="btn btn--quiet">All visitors</Link>}>This visitor has no visits on {site.name}.</Empty>;

  const latest = data.sessions[0];
  const first = data.sessions[data.sessions.length - 1];
  const totalPages = data.sessions.reduce((n, s) => n + s.pageviews, 0);
  const totalTime = data.sessions.reduce((n, s) => n + (s.last_seen - s.started_at), 0);

  return (
    <div className="journey">
      <p className="crumbs">
        <Link to={linkTo("/visitors", params)}>Visitors</Link>
      </p>
      <header className="journey-head">
        <div className="journey-who">
          <Avatar seed={id} size={64} />
          <div>
            <h1>{visitorName(id)}</h1>
            <p className="muted">
              <Place country={latest.country} city={latest.city} region={latest.region} />
            </p>
          </div>
        </div>
        <dl className="facts">
          <div>
            <dt>First came from</dt>
            <dd>
              <span className="source">
                <Favicon host={first.source} />
                {first.source ?? first.channel}
              </span>
            </dd>
          </div>
          <div>
            <dt>First seen</dt>
            <dd>{fmt.full(first.started_at)}</dd>
          </div>
          <div>
            <dt>Visits</dt>
            <dd className="fig">{data.sessions.length}</dd>
          </div>
          <div>
            <dt>Pages</dt>
            <dd className="fig">{totalPages}</dd>
          </div>
          <div>
            <dt>Time on site</dt>
            <dd className="fig">{duration(totalTime)}</dd>
          </div>
          <div>
            <dt>Device</dt>
            <dd>
              {latest.browser} on {latest.os}, {latest.device?.toLowerCase()}
            </dd>
          </div>
        </dl>
      </header>

      <ol className="visits">
        {data.sessions.map((s) => {
          const views = data.pageviews.filter((p) => p.session_id === s.id);
          const events = data.events.filter((e) => e.session_id === s.id);
          const steps = [
            ...views.map((p) => ({ kind: "page" as const, ts: p.ts, label: p.path, sub: p.title, d: p.duration })),
            ...events.map((e) => ({ kind: "goal" as const, ts: e.ts, label: e.name, sub: propsText(e.props), d: 0 })),
          ].sort((a, b) => a.ts - b.ts);
          return (
            <li key={s.id} className="visit stock">
              <header className="visit-head">
                <h2>{fmt.full(s.started_at)}</h2>
                <p className="muted">
                  From <span className="source"><Favicon host={s.source} />{s.source ?? s.channel}</span>
                  {s.utm_campaign ? `, campaign ${s.utm_campaign}` : ""}. {countryName(s.country)}, {duration(s.last_seen - s.started_at)}.
                </p>
              </header>
              <ol className="steps">
                {steps.map((st, i) => (
                  <li key={i} className={st.kind === "goal" ? "step step--goal" : "step"}>
                    <time className="fig muted" dateTime={new Date(st.ts).toISOString()}>
                      {fmt.time(st.ts)}
                    </time>
                    <span className="step-what">
                      {st.kind === "goal" ? (
                        <>Completed the goal <strong>{st.label}</strong>{st.sub && <span className="cell-sub">{st.sub}</span>}</>
                      ) : (
                        <OpenPage domain={site.domain} path={st.label}>
                          <span className="path">{st.label}</span>
                        </OpenPage>
                      )}
                      {st.sub && st.kind === "page" && <span className="cell-sub">{st.sub}</span>}
                    </span>
                    <span className="fig muted">{st.d ? duration(st.d) : ""}</span>
                  </li>
                ))}
              </ol>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

// Goal details, as sent with window.dozokit("signup", { plan: "pro" }): "plan: pro".
function propsText(props: string | null) {
  if (!props) return null;
  try {
    const value: unknown = JSON.parse(props);
    if (!value || typeof value !== "object") return null;
    const pairs = Object.entries(value).map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`);
    return pairs.length ? pairs.join(", ") : null;
  } catch {
    return null;
  }
}
