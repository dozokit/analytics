import { collect } from "./collect";
import { api } from "./api";
import { changePassword, login, logout, passwordRequired, setupNeeded, signedIn } from "./auth";

export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  PASSWORD?: string;
  LOGIN_LIMIT?: RateLimit;
  COLLECT_LIMIT?: RateLimit;
}

const RETENTION = 760 * 24 * 3600 * 1000; // 25 months

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname;

    if (path === "/api/collect") {
      try {
        return await collect(req, env);
      } catch (err) {
        console.error(err);
        return new Response(null, { status: 500, headers: { "access-control-allow-origin": "*" } });
      }
    }

    // Writes only from the dashboard's own pages, on top of the SameSite cookie.
    const origin = req.headers.get("origin");
    if (path.startsWith("/api/") && req.method !== "GET" && origin && origin !== url.origin) {
      return Response.json({ error: "Not allowed from another site." }, { status: 403 });
    }

    if (path === "/api/login" && req.method === "POST") return login(req, env);
    if (path === "/api/logout" && req.method === "POST") return logout(req);
    if (path === "/api/me") {
      return Response.json({ signedIn: await signedIn(req, env), passwordRequired: passwordRequired(env), setupNeeded: setupNeeded(req, env) });
    }

    if (path.startsWith("/api/")) {
      const setup = setupNeeded(req, env);
      if (setup) return Response.json({ error: setup }, { status: 503 });
      if (!(await signedIn(req, env))) return Response.json({ error: "Sign in to see this." }, { status: 401 });
      if (path === "/api/password" && req.method === "POST") return changePassword(req, env);
      try {
        return await api(req, env, url);
      } catch (err) {
        console.error(err);
        return Response.json({ error: "The query failed. The details are in the Worker logs." }, { status: 500 });
      }
    }
    return env.ASSETS.fetch(req);
  },

  // Daily: visits older than 25 months go, a few thousand rows at a time so a large
  // backlog stays within D1's limits.
  async scheduled(_event: ScheduledController, env: Env): Promise<void> {
    const cutoff = Date.now() - RETENTION;
    const steps = [
      "delete from events where id in (select id from events where ts < ? limit 5000)",
      "delete from pageviews where id in (select id from pageviews where ts < ? limit 5000)",
      "delete from sessions where rowid in (select rowid from sessions where last_seen < ? limit 5000)",
    ];
    for (const sql of steps) {
      for (let round = 0; round < 50; round++) {
        const r = await env.DB.prepare(sql).bind(cutoff).run();
        if (r.meta.changes < 5000) break;
      }
    }
  },
} satisfies ExportedHandler<Env>;
