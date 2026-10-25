import { useId, useState, type ReactNode } from "react";
import type { BreakdownRow } from "../lib/api";
import { count } from "../lib/format";
import { useFetch } from "../lib/useFetch";
import { Empty, Failed, Skeleton } from "./States";

export interface Tab {
  id: string;
  label: string;
  rows: BreakdownRow[] | undefined;
  // The filter a row sets when clicked; null when the tab is not filterable.
  filter: string | null;
  // The query string that fetches every row; null when there is no more to show.
  allQuery?: string | null;
  render?: (row: BreakdownRow) => ReactNode;
  column?: string;
  value?: (row: BreakdownRow) => number;
  custom?: ReactNode;
  // A link beside each row, to the page itself.
  link?: (row: BreakdownRow) => ReactNode;
  // The query string that fetches the top rows when the tab is opened, for tabs the
  // dashboard does not load up front.
  lazyQuery?: string;
}

interface Props {
  title: string;
  tabs: Tab[];
  loading: boolean;
  error?: string | null;
  total?: number;
  onFilter: (key: string, value: string) => void;
}

export function Breakdown({ title, tabs, loading, error, total, onFilter }: Props) {
  const [active, setActive] = useState(tabs[0].id);
  const [expanded, setExpanded] = useState(false);
  const tab = tabs.find((t) => t.id === active) ?? tabs[0];
  const id = useId();

  return (
    <section className="panel" aria-labelledby={`${id}-title`}>
      <header className="panel-head">
        <h2 id={`${id}-title`}>{title}</h2>
        {tabs.length > 1 && (
          <div className="tabs" role="tablist" aria-label={`${title} by`}>
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={t.id === tab.id}
                className="tab"
                onClick={() => {
                  setActive(t.id);
                  setExpanded(false);
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}
      </header>
      <div role="tabpanel">
        {tab.custom ??
          (expanded && tab.allQuery ? (
            <AllRows tab={tab} total={total} onFilter={onFilter} onClose={() => setExpanded(false)} />
          ) : tab.lazyQuery ? (
            <LazyRows tab={tab} total={total} onFilter={onFilter} onMore={tab.allQuery ? () => setExpanded(true) : undefined} />
          ) : (
            <Rows tab={tab} loading={loading} error={error} total={total} onFilter={onFilter} onMore={tab.allQuery && (tab.rows?.length ?? 0) >= 10 ? () => setExpanded(true) : undefined} />
          ))}
      </div>
    </section>
  );
}

function Rows({ tab, loading, error, total, onFilter, onMore }: { tab: Tab; loading: boolean; error?: string | null; total?: number; onFilter: Props["onFilter"]; onMore?: () => void }) {
  if (error && !tab.rows) return <Failed message={error} />;
  if (!tab.rows) return <Skeleton />;
  if (!tab.rows.length) return <Empty>{loading ? "Loading" : "Nothing recorded for this period yet."}</Empty>;
  return (
    <>
      <RowList tab={tab} rows={tab.rows} total={total} onFilter={onFilter} />
      {onMore && (
        <button type="button" className="panel-more" onClick={onMore}>
          Show all
        </button>
      )}
    </>
  );
}

function LazyRows({ tab, total, onFilter, onMore }: { tab: Tab; total?: number; onFilter: Props["onFilter"]; onMore?: () => void }) {
  const { data, error, loading } = useFetch<BreakdownRow[]>(`/api/breakdown?${tab.lazyQuery}`, { every: 60_000 });
  const rows = data ?? undefined;
  return <Rows tab={{ ...tab, rows }} loading={loading} error={error} total={total} onFilter={onFilter} onMore={onMore && (rows?.length ?? 0) >= 10 ? onMore : undefined} />;
}

function AllRows({ tab, total, onFilter, onClose }: { tab: Tab; total?: number; onFilter: Props["onFilter"]; onClose: () => void }) {
  const { data, error } = useFetch<BreakdownRow[]>(`/api/breakdown?${tab.allQuery}`);
  return (
    <>
      {error ? <Failed message={error} /> : !data ? <Skeleton rows={8} /> : <RowList tab={tab} rows={data} total={total} onFilter={onFilter} scroll />}
      <button type="button" className="panel-more" onClick={onClose}>
        Show the top ten
      </button>
    </>
  );
}

function RowList({ tab, rows, total, onFilter, scroll }: { tab: Tab; rows: BreakdownRow[]; total?: number; onFilter: Props["onFilter"]; scroll?: boolean }) {
  const value = tab.value ?? ((r: BreakdownRow) => r.visitors);
  const max = Math.max(1, ...rows.map(value));
  return (
    <div className={scroll ? "rows rows--scroll" : "rows"}>
      <div className="rows-head">
        <span>{tab.label}</span>
        <span>{tab.column ?? "Visitors"}</span>
      </div>
      <ol>
        {rows.map((row) => {
          const v = value(row);
          const share = total ? v / total : null;
          const content = (
            <>
              <span className="row-bar" style={{ transform: `scaleX(${v / max})` }} aria-hidden="true" />
              <span className="row-key">{tab.render ? tab.render(row) : row.key}</span>
              <span className="row-value fig">{count(v)}</span>
              {share != null && <span className="row-share fig">{Math.round(share * 100)}%</span>}
            </>
          );
          return (
            <li key={row.key} className={tab.link ? "row-with-link" : undefined}>
              {tab.filter ? (
                <button type="button" className="row" onClick={() => onFilter(tab.filter!, row.key)} title={`Show only ${row.key}`}>
                  {content}
                </button>
              ) : (
                <div className="row">{content}</div>
              )}
              {tab.link?.(row)}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
