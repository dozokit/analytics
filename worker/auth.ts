import type { Env } from "./index";

// One password: the PASSWORD secret set when deploying, or the one changed later in
// Settings (kept hashed in D1). Without a secret the dashboard is open on this machine
// (local development) and closed everywhere else.

const COOKIE = "dozokit_session";
const MONTH = 30 * 24 * 3600 * 1000;

export const SETUP_NEEDED = "This dashboard needs a password of 12 characters or more before it opens.";

const b64 = (buf: ArrayBuffer) =>
  btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/[+/=]/g, (c) => (c === "+" ? "-" : c === "/" ? "_" : ""));

async function sign(value: string, secret: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value)));
}

async function pbkdf2(password: string, salt: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  return b64(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: new TextEncoder().encode(salt), iterations: 100_000 }, key, 256));
}

// Compares the two values' MACs, so neither their content nor their length leaks through timing.
async function same(a: string, b: string, secret: string) {
  const [x, y] = await Promise.all([sign(a, secret), sign(b, secret)]);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return diff === 0;
}

// The password in force: the one set in Settings while the PASSWORD secret is still the one it
// replaced, else the secret. Editing the secret in Cloudflare is how a forgotten password is reset.
// `key` signs the session cookie, so changing the password signs every other device out.
async function current(env: Env & { PASSWORD: string }) {
  const row = await env.DB.prepare("select hash, salt, secret_mac from password where id = 1").first<{ hash: string; salt: string; secret_mac: string }>();
  if (row && row.secret_mac === (await sign("replaced", env.PASSWORD))) {
    return { key: row.hash, check: async (pw: string) => same(await pbkdf2(pw, row.salt), row.hash, row.hash) };
  }
  return { key: env.PASSWORD, check: (pw: string) => same(pw, env.PASSWORD, env.PASSWORD) };
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
  const { key } = await current(env as Env & { PASSWORD: string });
  return same(mac, await sign(exp, key), key);
}

async function limited(req: Request, env: Env) {
  const ip = req.headers.get("cf-connecting-ip") ?? "local";
  return env.LOGIN_LIMIT && !(await env.LOGIN_LIMIT.limit({ key: ip })).success
    ? Response.json({ error: "Too many attempts. Wait a minute, then try again." }, { status: 429 })
    : null;
}

async function session(req: Request, key: string) {
  const exp = String(Date.now() + MONTH);
  return cookie(req, `${exp}.${await sign(exp, key)}`, MONTH / 1000);
}

export async function login(req: Request, env: Env) {
  const setup = setupNeeded(req, env);
  if (setup) return Response.json({ error: setup }, { status: 503 });
  if (!env.PASSWORD) return Response.json({ ok: true });
  const tooMany = await limited(req, env);
  if (tooMany) return tooMany;
  const body = (await req.json().catch(() => ({}))) as { password?: string };
  const { key, check } = await current(env as Env & { PASSWORD: string });
  if (typeof body.password !== "string" || !(await check(body.password))) {
    return Response.json({ error: "That password is not the one set for this dashboard." }, { status: 401 });
  }
  return Response.json({ ok: true }, { headers: { "set-cookie": await session(req, key) } });
}

// Called signed in. A wrong current password answers 403, not 401, so the page doesn't sign out.
export async function changePassword(req: Request, env: Env) {
  if (!env.PASSWORD) return Response.json({ error: "This dashboard has no password to change." }, { status: 400 });
  const tooMany = await limited(req, env);
  if (tooMany) return tooMany;
  const body = (await req.json().catch(() => ({}))) as { current?: string; next?: string };
  if (typeof body.next !== "string" || body.next.length < 12) {
    return Response.json({ error: "The new password needs 12 characters or more." }, { status: 400 });
  }
  const { check } = await current(env as Env & { PASSWORD: string });
  if (typeof body.current !== "string" || !(await check(body.current))) {
    return Response.json({ error: "Your current password is not that one." }, { status: 403 });
  }
  const salt = b64(crypto.getRandomValues(new Uint8Array(16)).buffer);
  const hash = await pbkdf2(body.next, salt);
  await env.DB.prepare("insert or replace into password (id, hash, salt, secret_mac, changed_at) values (1, ?, ?, ?, ?)")
    .bind(hash, salt, await sign("replaced", env.PASSWORD), Date.now())
    .run();
  return Response.json({ ok: true }, { headers: { "set-cookie": await session(req, hash) } });
}

export function logout(req: Request) {
  return Response.json({ ok: true }, { headers: { "set-cookie": cookie(req, "", 0) } });
}

function cookie(req: Request, value: string, maxAge: number) {
  const secure = new URL(req.url).protocol === "https:" ? "; Secure" : "";
  return `${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}
