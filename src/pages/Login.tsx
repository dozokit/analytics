import { useState } from "react";
import { api } from "../lib/api";

export function Login({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <main className="login">
      <form
        className="login-card stock"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError(null);
          try {
            await api("/api/login", { method: "POST", body: JSON.stringify({ password }) });
            onDone();
          } catch (err) {
            setError((err as Error).message);
            setBusy(false);
          }
        }}
      >
        <h1>Sign in to Dozokit Analytics</h1>
        <label className="field">
          <span>Password</span>
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
            autoFocus
            value={password}
            aria-invalid={Boolean(error)}
            aria-describedby="login-help"
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <p id="login-help" className={error ? "help help--error" : "help"}>
          {error ?? "The one you typed when you deployed, or set later in Settings."}
        </p>
        <button type="submit" className="btn btn--ink" disabled={busy}>
          {busy ? "Signing in" : "Sign in"}
        </button>
      </form>
    </main>
  );
}

export function Setup({ message }: { message: string }) {
  return (
    <main className="login">
      <div className="login-card stock">
        <h1>Set a password first</h1>
        <p className="help">{message}</p>
        <p className="help">
          In Cloudflare, open Workers &amp; Pages, then this Worker, then Settings → Variables and Secrets. Add a secret named <code>PASSWORD</code>{" "}
          with 12 characters or more (or edit it if it is there), then reload this page.
        </p>
        <button type="button" className="btn btn--ink" onClick={() => location.reload()}>
          Reload
        </button>
      </div>
    </main>
  );
}
