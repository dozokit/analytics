import { useCallback, useSyncExternalStore } from "react";
import { FILTERS } from "../../shared/dims";

// The address is the state: page, site, range and every filter live in it,
// so a view can be bookmarked and the back button undoes a filter.

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());
window.addEventListener("popstate", notify);

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function navigate(to: string, replace = false) {
  if (to === location.pathname + location.search) return;
  history[replace ? "replaceState" : "pushState"]({}, "", to);
  notify();
}

export function useLocation() {
  const href = useSyncExternalStore(subscribe, () => location.pathname + location.search);
  const url = new URL(href, location.origin);
  return { path: url.pathname, params: url.searchParams, href };
}

export { FILTERS, type FilterKey } from "../../shared/dims";

export function useParams() {
  const { path, params } = useLocation();
  const set = useCallback((changes: Record<string, string | null>, replace = false) => {
    const next = new URLSearchParams(location.search);
    for (const [k, v] of Object.entries(changes)) {
      if (v == null || v === "") next.delete(k);
      else next.set(k, v);
    }
    const qs = next.toString();
    navigate(location.pathname + (qs ? `?${qs}` : ""), replace);
  }, []);
  const filters = FILTERS.flatMap((k) => (params.get(k) != null ? [[k, params.get(k)!] as const] : []));
  return { path, params, set, filters };
}

// Carry the site, range and filters to another page.
export function linkTo(path: string, keep: URLSearchParams, extra: Record<string, string> = {}) {
  const next = new URLSearchParams();
  for (const k of ["site", "range", ...FILTERS]) {
    const v = keep.get(k);
    if (v != null) next.set(k, v);
  }
  for (const [k, v] of Object.entries(extra)) next.set(k, v);
  const qs = next.toString();
  return path + (qs ? `?${qs}` : "");
}
