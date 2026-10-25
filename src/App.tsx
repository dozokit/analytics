import { useCallback, useEffect, useState } from "react";
import { api, type Site } from "./lib/api";
import { navigate, useParams } from "./lib/router";
import { Shell } from "./components/Shell";
import { Failed, Skeleton } from "./components/States";
import { Overview } from "./pages/Overview";
import { Pages } from "./pages/Pages";
import { Realtime } from "./pages/Realtime";
import { Visitor, Visitors } from "./pages/Visitors";
import { Goals } from "./pages/Goals";
import { Settings } from "./pages/Settings";
import { Login, Setup } from "./pages/Login";

// setupNeeded: deployed without a usable PASSWORD, so the dashboard stays shut until one is set.
type Auth = { signedIn: boolean; passwordRequired: boolean; setupNeeded: string | null };

export function App() {
  const [auth, setAuth] = useState<Auth | null>(null);
  const [sites, setSites] = useState<Site[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [online, setOnline] = useState<number | null>(null);
  const { path, params, set } = useParams();

  const load = useCallback(async () => {
    try {
      const me = await api<Auth>("/api/me");
      setAuth(me);
      if (me.signedIn && !me.setupNeeded) setSites(await api<Site[]>("/api/sites"));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    load();
    const out = () => setAuth((a) => (a ? { ...a, signedIn: false } : a));
    window.addEventListener("dozokit:signed-out", out);
    return () => window.removeEventListener("dozokit:signed-out", out);
  }, [load]);

  const siteId = params.get("site");
  const site = sites?.find((s) => s.id === siteId) ?? sites?.[0] ?? null;

  // Keep the chosen site in the address so every link carries it.
  useEffect(() => {
    if (site && siteId !== site.id) set({ site: site.id }, true);
  }, [site, siteId, set]);

  useEffect(() => {
    document.title = site ? `${site.name} – Dozokit Analytics` : "Dozokit Analytics";
  }, [site]);

  useEffect(() => setOnline(null), [site?.id]);

  // With no website yet, every address leads to Settings to add one.
  useEffect(() => {
    if (sites && !sites.length && path !== "/settings") navigate("/settings", true);
  }, [sites, path]);

  if (error && !auth) return <main className="container main"><Failed message={error} retry={load} /></main>;
  if (!auth) return <main className="container main"><Skeleton /></main>;
  if (auth.setupNeeded) return <Setup message={auth.setupNeeded} />;
  if (!auth.signedIn) return <Login onDone={load} />;
  if (!sites) return <main className="container main"><Skeleton /></main>;

  const settings = <Settings sites={sites} onSites={setSites} passwordRequired={auth.passwordRequired} />;
  if (!site || path === "/settings") {
    return (
      <Shell sites={sites} site={site} showRange={false}>
        {settings}
      </Shell>
    );
  }

  let page;
  if (path === "/") page = <Overview key={site.id} site={site} onOnline={setOnline} />;
  else if (path === "/pages") page = <Pages site={site} />;
  else if (path === "/realtime") page = <Realtime key={site.id} site={site} onOnline={setOnline} />;
  else if (path === "/visitors") page = <Visitors site={site} />;
  else if (path.startsWith("/visitors/")) page = <Visitor site={site} id={safeDecode(path.slice("/visitors/".length))} />;
  else if (path === "/goals") page = <Goals site={site} />;
  else page = <Failed message="There is no page at this address." />;

  return (
    <Shell sites={sites} site={site} online={online} showRange={path !== "/realtime" && !path.startsWith("/visitors/")}>
      {page}
    </Shell>
  );
}

function safeDecode(s: string) {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}
