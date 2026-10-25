import { useState } from "react";
import type { Site } from "../lib/api";
import { ago } from "../lib/format";
import { useFetch } from "../lib/useFetch";

export function CopyBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="code">
      <pre>
        <code>{code}</code>
      </pre>
      <button
        type="button"
        className="btn btn--quiet code-copy"
        onClick={() => {
          navigator.clipboard.writeText(code).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1600);
          });
        }}
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

export function Snippet({ site, watch }: { site: Site; watch?: boolean }) {
  const tag = `<script defer data-site="${site.id}" src="${location.origin}/t.js"></script>`;
  const check = useFetch<{ last: number | null; n: number }>(watch ? `/api/sites/${site.id}/check` : null, { every: 3000 });
  const seen = check.data?.last;
  return (
    <div className="snippet">
      <CopyBlock code={tag} />
      {watch && (
        <p className={seen ? "check is-done" : "check"} role="status">
          {seen ? (
            <>
              First visit recorded {ago(seen)}.{" "}
              <button type="button" className="link-btn" onClick={() => location.reload()}>
                Open the dashboard
              </button>
            </>
          ) : (
            "Waiting for the first visit. Open your site in another tab."
          )}
        </p>
      )}
    </div>
  );
}
