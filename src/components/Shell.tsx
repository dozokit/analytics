import type { ReactNode } from "react";
import { ALL_SITES, type Site } from "../lib/api";
import { countryName, DIRECT_LABEL } from "../lib/format";
import { RANGES } from "../lib/range";
import { linkTo, navigate, useParams, type FilterKey } from "../lib/router";
import { useFetch } from "../lib/useFetch";

const NAV = [
  { path: "/", label: "Overview" },
  { path: "/pages", label: "Pages" },
  { path: "/realtime", label: "Realtime" },
  { path: "/visitors", label: "Visitors" },
  { path: "/goals", label: "Goals" },
];

export const FILTER_LABEL: Record<FilterKey, string> = {
  channel: "Channel",
  source: "Source",
  campaign: "Campaign",
  page: "Page",
  entry: "Entry page",
  exit: "Exit page",
  country: "Country",
  region: "Region",
  city: "City",
  browser: "Browser",
  os: "OS",
  device: "Device",
  direct: "Direct",
  goal: "Goal",
};

function filterValue(key: FilterKey, value: string) {
  if (key === "country") return countryName(value);
  if (key === "direct") return DIRECT_LABEL[value] ?? value;
  return value;
}

function Link({ to, children, className, current }: { to: string; children: ReactNode; className?: string; current?: boolean }) {
  return (
    <a
      href={to}
      className={className}
      aria-current={current ? "page" : undefined}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        navigate(to);
      }}
    >
      {children}
    </a>
  );
}
export { Link };

export function Shell({ sites, site, children, online, showRange = true }: { sites: Site[]; site: Site | null; children: ReactNode; online?: number | null; showRange?: boolean }) {
  const { path, params, set, filters } = useParams();
  const { data: release } = useFetch<{ version: string; latest: string | null }>("/api/version");
  const section = NAV.find((n) => (n.path === "/" ? path === "/" : path.startsWith(n.path)))?.path;

  return (
    <div className="shell">
      <header className="topbar">
        <div className="topbar-inner container">
          <Link to={linkTo("/", params)} className="wordmark">
            <span aria-hidden="true" className="wordmark-mark">
              <svg viewBox="0 0 20 20" width="20" height="20">
                <path d="M3 17V9M8 17V4M13 17v-6M18 17V7" />
              </svg>
            </span>
            <span className="wordmark-name">Dozokit Analytics</span>
          </Link>

          {site && (
            <label className="site-picker">
              <span className="visually-hidden">Website</span>
              <select
                value={site.id}
                onChange={(e) => {
                  if (e.target.value === "__new") navigate("/settings?new=1");
                  else navigate(linkTo(path, new URLSearchParams({ range: params.get("range") ?? "" }), { site: e.target.value }));
                }}
              >
                {sites.length > 1 && <option value={ALL_SITES}>All sites</option>}
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
                <option value="__new">Add a website</option>
              </select>
            </label>
          )}

          <nav className="nav" aria-label="Sections">
            {NAV.map((n) => (
              <Link key={n.path} to={linkTo(n.path, params)} className="nav-link" current={section === n.path}>
                {n.label}
              </Link>
            ))}
          </nav>

          <div className="topbar-end">
            {online != null && (
              <Link to={linkTo("/realtime", params)} className="online">
                <span className="fig">{online}</span> online now
              </Link>
            )}
            <Link to={linkTo("/settings", params)} className="nav-link" current={path === "/settings"}>
              Settings
            </Link>
          </div>
        </div>
      </header>

      {release?.latest && (
        <p className="update container">
          Version {release.latest} is available.{" "}
          <a href="https://dozokit.com/analytics/guide#updating" target="_blank" rel="noopener">
            What’s new and how to update →
          </a>
        </p>
      )}

      {showRange && site && (
        <div className="toolbar container">
          <label className="range">
            <span className="visually-hidden">Period</span>
            <select value={params.get("range") ?? "30d"} onChange={(e) => set({ range: e.target.value === "30d" ? null : e.target.value })}>
              {RANGES.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
          {filters.length > 0 && (
            <ul className="filters" aria-label="Filters">
              {filters.map(([k, v]) => (
                <li key={k}>
                  <button type="button" className="chip" onClick={() => set({ [k]: null })} aria-label={`Remove filter ${FILTER_LABEL[k]} is ${filterValue(k, v)}`}>
                    <span className="chip-key">{FILTER_LABEL[k]}</span> {filterValue(k, v)}
                    <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">
                      <path d="M3 3l6 6M9 3l-6 6" />
                    </svg>
                  </button>
                </li>
              ))}
              {filters.length > 1 && (
                <li>
                  <button type="button" className="btn btn--quiet" onClick={() => set(Object.fromEntries(filters.map(([k]) => [k, null])))}>
                    Clear filters
                  </button>
                </li>
              )}
            </ul>
          )}
        </div>
      )}

      <main className="container main">{children}</main>
    </div>
  );
}
