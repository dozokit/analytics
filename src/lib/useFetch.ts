import { useEffect, useRef, useState } from "react";
import { api } from "./api";

// Keeps showing the last answer while the next one loads, so changing a
// filter does not flash the page empty.
export function useFetch<T>(url: string | null, opts: { every?: number } = {}) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(url));
  const [tick, setTick] = useState(0);
  const current = useRef(url);
  current.current = url;

  useEffect(() => {
    if (!url) return;
    let alive = true;
    setLoading(true);
    api<T>(url)
      .then((d) => {
        if (!alive) return;
        setData(d);
        setError(null);
      })
      .catch((e: Error) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [url, tick]);

  useEffect(() => {
    if (!opts.every || !url) return;
    const t = setInterval(() => document.visibilityState === "visible" && setTick((n) => n + 1), opts.every);
    return () => clearInterval(t);
  }, [opts.every, url]);

  return { data, error, loading, reload: () => setTick((n) => n + 1) };
}
