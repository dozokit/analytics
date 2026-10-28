import { useState } from "react";
import { api, type Site } from "../lib/api";
import { ago, count } from "../lib/format";
import { navigate, useParams } from "../lib/router";
import { Snippet } from "../components/Snippet";
import { TurnOnUpdates } from "../components/TurnOnUpdates";
import { useFetch } from "../lib/useFetch";

function AddSite({ onAdded, first }: { onAdded: (s: Site) => void; first: boolean }) {
  const [domain, setDomain] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="add-site"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
          onAdded(await api<Site>("/api/sites", { method: "POST", body: JSON.stringify({ domain }) }));
          setDomain("");
        } catch (err) {
          setError((err as Error).message);
          (e.currentTarget.elements.namedItem("domain") as HTMLInputElement | null)?.focus();
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2>{first ? "Add your first website" : "Add a website"}</h2>
      <div className="field-row">
        <label className="field">
          <span>Domain</span>
          <input
            name="domain"
            type="text"
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            placeholder="example.com"
            required
            value={domain}
            aria-invalid={Boolean(error)}
            aria-describedby="domain-help"
            onChange={(e) => setDomain(e.target.value)}
          />
        </label>
        <button type="submit" className="btn btn--ink" disabled={busy}>
          {busy ? "Adding" : "Add website"}
        </button>
      </div>
      <p id="domain-help" className={error ? "help help--error" : "help"}>
        {error ?? "Subdomains count too: example.com also covers app.example.com."}
      </p>
    </form>
  );
}

function SiteRow({ site, onChange, onDelete }: { site: Site; onChange: (s: Site) => void; onDelete: () => void }) {
  const [name, setName] = useState(site.name);
  const [domain, setDomain] = useState(site.domain);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "confirm" | "deleting">("idle");
  const [error, setError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const dirty = name !== site.name || domain !== site.domain;

  return (
    <li className="site-card">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setState("saving");
          setError(null);
          try {
            onChange(await api<Site>(`/api/sites/${site.id}`, { method: "PATCH", body: JSON.stringify({ name, domain }) }));
            setState("saved");
          } catch (err) {
            setError((err as Error).message);
            setState("idle");
          }
        }}
      >
        <div className="site-card-head">
          <h3>{site.name}</h3>
          <p className="muted">
            {site.last_seen ? `Last visit ${ago(site.last_seen)}, ${count(site.visits_24h ?? 0)} visits in 24 hours` : "No visits yet"}
          </p>
        </div>
        <div className="field-row">
          <label className="field">
            <span>Name</span>
            <input name="name" type="text" autoComplete="off" value={name} onChange={(e) => { setName(e.target.value); setState("idle"); }} />
          </label>
          <label className="field">
            <span>Domain</span>
            <input name="domain" type="text" inputMode="url" autoComplete="off" spellCheck={false} value={domain} onChange={(e) => { setDomain(e.target.value); setState("idle"); }} />
          </label>
          <button type="submit" className="btn btn--card" disabled={!dirty || state === "saving"}>
            {state === "saving" ? "Saving" : state === "saved" ? "Saved" : "Save changes"}
          </button>
        </div>
        {error && <p className="help help--error">{error}</p>}
      </form>
      <h4>Tracking tag</h4>
      <Snippet site={site} />
      <div className="danger">
        {state === "confirm" || state === "deleting" ? (
          <>
            <p>Delete {site.name} and every visit recorded for it? This cannot be undone.</p>
            <button
              type="button"
              className="btn btn--danger"
              disabled={state === "deleting"}
              onClick={async () => {
                setState("deleting");
                setDeleteError(null);
                try {
                  await api(`/api/sites/${site.id}`, { method: "DELETE" });
                  onDelete();
                } catch (err) {
                  setDeleteError((err as Error).message);
                  setState("confirm");
                }
              }}
            >
              {state === "deleting" ? "Deleting" : "Delete website and data"}
            </button>
            <button type="button" className="btn btn--quiet" onClick={() => setState("idle")}>
              Keep it
            </button>
          </>
        ) : (
          <button type="button" className="btn btn--quiet" onClick={() => setState("confirm")}>
            Delete website
          </button>
        )}
        {deleteError && <p className="help help--error">{deleteError}</p>}
      </div>
    </li>
  );
}

function ChangePassword() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (next !== again) return setError("The two new passwords are not the same.");
        setState("saving");
        setError(null);
        try {
          await api("/api/password", { method: "POST", body: JSON.stringify({ current, next }) });
          setCurrent("");
          setNext("");
          setAgain("");
          setState("saved");
        } catch (err) {
          setError((err as Error).message);
          setState("idle");
        }
      }}
    >
      <h2>Change password</h2>
      <div className="field-row">
        <label className="field">
          <span>Current password</span>
          <input name="current" type="password" autoComplete="current-password" required value={current} onChange={(e) => setCurrent(e.target.value)} />
        </label>
        <label className="field">
          <span>New password</span>
          <input name="next" type="password" autoComplete="new-password" required minLength={12} value={next} onChange={(e) => { setNext(e.target.value); setState("idle"); }} />
        </label>
        <label className="field">
          <span>New password again</span>
          <input name="again" type="password" autoComplete="new-password" required minLength={12} value={again} onChange={(e) => { setAgain(e.target.value); setState("idle"); }} />
        </label>
        <button type="submit" className="btn btn--card" disabled={state === "saving"}>
          {state === "saving" ? "Saving" : "Change password"}
        </button>
      </div>
      <p className={error ? "help help--error" : "help"} role={error || state === "saved" ? "status" : undefined}>
        {error ??
          (state === "saved"
            ? "Password changed. Your other devices are signed out."
            : "12 characters or more. Forgot it? In Cloudflare, open this Worker, then Settings → Variables and Secrets, and edit PASSWORD: that password works again.")}
      </p>
    </form>
  );
}

// On by default: once a day the dashboard asks dozokit.com whether a newer version is out.
function ShareCount() {
  const { data } = useFetch<{ share: boolean }>("/api/version");
  const [share, setShare] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const on = share ?? data?.share ?? true;
  return (
    <div className="share-count">
      <label>
        <input
          type="checkbox"
          checked={on}
          disabled={!data}
          onChange={async (e) => {
            const next = e.target.checked;
            setShare(next);
            setError(null);
            try {
              await api("/api/version", { method: "PUT", body: JSON.stringify({ share: next }) });
            } catch (err) {
              setShare(!next);
              setError((err as Error).message);
            }
          }}
        />{" "}
        Check for new versions
      </label>
      <p className={error ? "help help--error" : "help"} role="status">
        {error ??
          "Once a day, this dashboard asks Dozokit whether a new version is out. It sends only its version number and a random number made for this copy, nothing about your websites or your visitors. Turned off, nothing is sent and you won't hear about new versions."}
      </p>
    </div>
  );
}

export function Settings({ sites, onSites, passwordRequired }: { sites: Site[]; onSites: (s: Site[]) => void; passwordRequired: boolean }) {
  const { params } = useParams();
  const [added, setAdded] = useState<Site | null>(null);
  return (
    <div className="settings">
      <header className="section-head">
        <h1>Settings</h1>
      </header>

      {added ? (
        <section className="page-section first-visit">
          <h2>Add this tag to {added.domain}</h2>
          <p className="lead">Inside the head of every page. Then open the site once to check it works.</p>
          <Snippet site={added} watch />
          <button type="button" className="btn btn--card" onClick={() => navigate(`/?site=${added.id}`)}>
            Go to its dashboard
          </button>
        </section>
      ) : (
        <section className="page-section">
          <AddSite
            first={!sites.length || params.has("new")}
            onAdded={(s) => {
              onSites([...sites, s]);
              setAdded(s);
            }}
          />
        </section>
      )}

      {sites.length > 0 && (
        <section className="page-section">
          <h2>Websites</h2>
          <ul className="site-list">
            {sites.map((s) => (
              <SiteRow
                key={s.id}
                site={s}
                onChange={(next) => onSites(sites.map((x) => (x.id === next.id ? { ...x, ...next } : x)))}
                onDelete={() => onSites(sites.filter((x) => x.id !== s.id))}
              />
            ))}
          </ul>
        </section>
      )}

      <section className="page-section how">
        <h2>Leave your own visits out</h2>
        <p className="muted">
          Open any page of your site once with <code>?dozokit_ignore=1</code> at the end of the address. That browser stops being counted on that site. Use{" "}
          <code>?dozokit_ignore=0</code> to undo it.
        </p>
      </section>

      {passwordRequired && (
        <section className="page-section">
          <ChangePassword />
        </section>
      )}

      <section className="page-section how">
        <h2>Updates</h2>
        <TurnOnUpdates />
        <ShareCount />
      </section>

      {passwordRequired && (
        <section className="page-section">
          <h2>Session</h2>
          <button
            type="button"
            className="btn btn--card"
            onClick={async () => {
              await api("/api/logout", { method: "POST" });
              location.assign("/");
            }}
          >
            Sign out
          </button>
        </section>
      )}
    </div>
  );
}
