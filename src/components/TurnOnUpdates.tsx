import { useState } from "react";
import workflow from "../../.github/workflows/update.yml?raw";

// Cloudflare's Deploy button copies the repository without its .github folder, so a new copy
// has no update workflow. This opens GitHub's "new file" page with the workflow filled in.
export function TurnOnUpdates() {
  const [repo, setRepo] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const m = repo.trim().match(/^(?:https?:\/\/)?(?:www\.)?github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/i);
        if (!m) return setError("Paste your copy's address as it shows in GitHub, like github.com/your-name/dozokit-analytics.");
        setError(null);
        const q = new URLSearchParams({ filename: ".github/workflows/update.yml", value: workflow });
        window.open(`https://github.com/${m[1]}/${m[2]}/new/main?${q}`, "_blank", "noopener");
      }}
    >
      <p className="muted">
        Updates run from your copy on GitHub. Cloudflare's Deploy button leaves the update button out, so add it once: paste your copy's address, press the button,
        then Commit changes on GitHub. From then on, Actions → Update → Run workflow brings the latest version. Done it already? Nothing to do here.
      </p>
      <div className="field-row">
        <label className="field">
          <span>Your copy on GitHub</span>
          <input type="text" inputMode="url" spellCheck={false} placeholder="github.com/your-name/dozokit-analytics" value={repo} onChange={(e) => setRepo(e.target.value)} aria-invalid={Boolean(error)} aria-describedby="updates-help" />
        </label>
        <button type="submit" className="btn btn--ink">Add the update button</button>
      </div>
      <p id="updates-help" className={error ? "help help--error" : "help"} role="status">
        {error ?? <>How updates work: <a href="https://dozokit.com/analytics/guide#updating" target="_blank" rel="noopener">https://dozokit.com/analytics/guide#updating</a>.</>}
      </p>
    </form>
  );
}
