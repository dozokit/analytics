import type { GoalsData, Site } from "../lib/api";
import { ago, count, percent } from "../lib/format";
import { rangeQuery } from "../lib/range";
import { useParams } from "../lib/router";
import { useFetch } from "../lib/useFetch";
import { CopyBlock } from "../components/Snippet";
import { Empty, Failed, Skeleton } from "../components/States";

export function Goals({ site }: { site: Site }) {
  const { params, set } = useParams();
  const { data, error, reload } = useFetch<GoalsData>(`/api/goals?${rangeQuery(site.id, params)}`);

  return (
    <div className="goals">
      <section className="page-section">
        <header className="section-head">
          <h1>Goals</h1>
          <p className="muted">How many visitors did the things you care about.</p>
        </header>
        {error && !data ? (
          <Failed message={error} retry={reload} />
        ) : !data ? (
          <Skeleton rows={5} />
        ) : !data.goals.length ? (
          <Empty>No goal was completed in this period. Add one with the snippets below.</Empty>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Goal</th>
                  <th scope="col" className="num">Visitors</th>
                  <th scope="col" className="num">Completions</th>
                  <th scope="col" className="num">Conversion</th>
                  <th scope="col" className="num">Last one</th>
                </tr>
              </thead>
              <tbody>
                {data.goals.map((g) => (
                  <tr key={g.name}>
                    <th scope="row">
                      <button type="button" className="cell-link" onClick={() => set({ goal: g.name })} title="Show only visits that completed this goal">
                        <span className="cell-title">{g.name}</span>
                      </button>
                    </th>
                    <td className="num fig">{count(g.visitors)}</td>
                    <td className="num fig">{count(g.completions)}</td>
                    <td className="num fig">{data.visitors ? percent(g.visitors / data.visitors) : "–"}</td>
                    <td className="num muted">{ago(g.last)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="page-section how">
        <h2>Add a goal</h2>
        <div className="how-grid">
          <div>
            <h3>On a click</h3>
            <p className="muted">Name the goal on the button or link. Every click counts once.</p>
            <CopyBlock code={`<button data-dozokit-goal="signup">Create account</button>`} />
          </div>
          <div>
            <h3>From your code</h3>
            <p className="muted">Call it after something succeeds, with details if you want them.</p>
            <CopyBlock code={`window.dozokit?.("purchase", { plan: "pro" })`} />
          </div>
        </div>
        <p className="muted">Goals show up here, on the overview and on each visitor’s journey on {site.domain}.</p>
      </section>
    </div>
  );
}
