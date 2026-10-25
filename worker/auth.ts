import type { Env } from "./index";

// One password, set with `wrangler secret put PASSWORD`. Without one the dashboard
// is open on this machine (local development) and closed everywhere else.

const COOKIE = "dozokit_session";
const MONTH = 30 * 24 * 3600 * 1000;

export const SETUP_NEEDED = "Set a PASSWORD secret on the Worker (12 characters or more), then reload this page.";

async function sign(value: string, secret: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return btoa(String.fromCharCode(...new Uint8Array(mac))).replace(/[+/=]/g, (c) => (c === "+" ? "-" : c === "/" ? "_" : ""));
}

// Compares the two values' MACs, so neither their content nor their length leaks through timing.
async function same(a: string, b: string, secret: string) {
  const [x, y] = await Promise.all([sign(a, secret), sign(b, secret)]);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return diff === 0;
}

const isLocal = (req: Request) => /^(localhost|127\.0\.0\.1|\[::1\])$/.test(new URL(req.url).hostname);

export const passwordRequired = (env: Env) => Boolean(env.PASSWORD);

// Deployed without a password, or with one too short to resist guessing: nothing behind
// the sign-in answers.
export const setupNeeded = (req: Request, env: Env) =>
  (env.PASSWORD ? env.PASSWORD.length < 12 : !isLocal(req)) ? SETUP_NEEDED : null;

export async function signedIn(req: Request, env: Env) {
  if (setupNeeded(req, env)) return false;
  if (!env.PASSWORD) return true;
  const cookie = req.headers.get("cookie") ?? "";
  const raw = cookie.split(/;\s*/).find((c) => c.startsWith(COOKIE + "="))?.slice(COOKIE.length + 1);
  if (!raw) return false;
  const [exp, mac] = raw.split(".");
  if (!exp || !mac || Number(exp) < Date.now()) return false;
  return same(mac, await sign(exp, env.PASSWORD), env.PASSWORD);
}

export async function login(req: Request, env: Env) {
  const setup = setupNeeded(req, env);
  if (setup) return Response.json({ error: setup }, { status: 503 });
  if (!env.PASSWORD) return Response.json({ ok: true });
  const ip = req.headers.get("cf-connecting-ip") ?? "local";
  if (env.LOGIN_LIMIT && !(await env.LOGIN_LIMIT.limit({ key: ip })).success) {
    return Response.json({ error: "Too many attempts. Wait a minute, then try again." }, { status: 429 });
  }
  const body = (await req.json().catch(() => ({}))) as { password?: string };
  if (typeof body.password !== "string" || !(await same(body.password, env.PASSWORD, env.PASSWORD))) {
    return Response.json({ error: "That password is not the one set for this dashboard." }, { status: 401 });
  }
  const exp = String(Date.now() + MONTH);
  const value = `${exp}.${await sign(exp, env.PASSWORD)}`;
  return Response.json({ ok: true }, { headers: { "set-cookie": cookie(req, value, MONTH / 1000) } });
}

export function logout(req: Request) {
  return Response.json({ ok: true }, { headers: { "set-cookie": cookie(req, "", 0) } });
}

function cookie(req: Request, value: string, maxAge: number) {
  const secure = new URL(req.url).protocol === "https:" ? "; Secure" : "";
  return `${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}
