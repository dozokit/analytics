import { useMemo, useState } from "react";
import type { PageRow, PagesData, Site } from "../lib/api";
import { count, duration, percent } from "../lib/format";
import { rangeQuery } from "../lib/range";
import { linkTo, useParams } from "../lib/router";
import { Link } from "../components/Shell";
import { useFetch } from "../lib/useFetch";
import { OpenPage } from "../components/Labels";
import { Sparkline } from "../components/Sparkline";
import { Empty, Failed, Skeleton } from "../components/States";

type SortKey = "views" | "visitors" | "entries" | "bounce" | "duration";

export function Pages({ site }: { site: Site }) {
  const { params, set } = useParams();
  const { data, error, reload } = useFetch<PagesData>(`/api/pages?${rangeQuery(site.id, params)}`);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortKey>("views");

  const rows = useMemo(() => {
    if (!data) return [];
    const n = Math.max(1, Math.ceil((data.to - data.from) / data.bucket));
    const entries = new Map(data.entries.map((e) => [e.path, e]));
    const trend = new Map<string, number[]>();
    for (const t of data.trend) {
      if (!trend.has(t.path)) trend.set(t.path, new Array(n).fill(0));
      const arr = trend.get(t.path)!;
      if (t.b >= 0 && t.b < n) arr[t.b] = t.n;
    }
    const needle = q.trim().toLowerCase();
    return data.pages
      .filter((p) => !needle || p.path.toLowerCase().includes(needle) || (p.title ?? "").toLowerCase().includes(needle))
      .map((p) => {
        const e = entries.get(p.path);
        return { ...p, entries: e?.entries ?? 0, bounce: e?.entries ? e.bounces / e.entries : null, trend: trend.get(p.path) };
      })
      .sort((a, b) => ((b[sort] ?? -1) as number) - ((a[sort] ?? -1) as number));
  }, [data, q, sort]);

  const head = (key: SortKey, label: string) => (
    <th scope="col" className="num" aria-sort={sort === key ? "descending" : undefined}>
      <button type="button" className="th-sort" onClick={() => setSort(key)}>
        {label}
      </button>
    </th>
  );

  return (
    <section className="page-section">
      <header className="section-head">
        <h1>Pages</h1>
        <label className="search">
          <span className="visually-hidden">Search pages</span>
          <input type="search" name="q" autoComplete="off" placeholder="Search by address or title" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
      </header>
      {error && !data ? (
        <Failed message={error} retry={reload} />
      ) : !data ? (
        <Skeleton rows={10} />
      ) : !rows.length ? (
        <Empty>{q ? `No page matches “${q}”.` : "No pages viewed in this period."}</Empty>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Page</th>
                <th scope="col">Trend</th>
                {head("views", "Views")}
                {head("visitors", "Visitors")}
                {head("entries", "Entries")}
                {head("bounce", "Bounce")}
                {head("duration", "Time on page")}
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.path}>
                  <th scope="row">
                    <button type="button" className="cell-link" onClick={() => set({ page: p.path })} title="Show only visits that saw this page">
                      <span className="cell-title">{p.title || p.path}</span>
                    </button>
                    <OpenPage domain={site.domain} path={p.path}>
                      <span className="cell-sub path">{p.path}</span>
                    </OpenPage>
                  </th>
                  <td>{p.trend ? <Sparkline values={p.trend} /> : null}</td>
                  <td className="num fig">{count(p.views)}</td>
                  <td className="num fig">
                    <Link to={linkTo("/visitors", params, { page: p.path })} className="num-link">
                      {count(p.visitors)}
                      <span className="visually-hidden"> visitors who saw {p.path}: open their journeys</span>
                    </Link>
                  </td>
                  <td className="num fig">{count(p.entries)}</td>
                  <td className="num fig">{p.bounce == null ? "–" : percent(p.bounce)}</td>
                  <td className="num fig">{p.duration ? duration(p.duration) : "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
