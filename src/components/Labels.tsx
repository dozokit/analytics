import { useEffect, useState } from "react";
import { countryName, liveUrl } from "../lib/format";

// Flags ship with the dashboard, one small file each, loaded when first shown:
// no third party learns which countries the visitors come from.
const FLAGS = import.meta.glob<string>("/node_modules/flag-icons/flags/4x3/*.svg", { query: "?url", import: "default" });

export function Flag({ code }: { code: string | null | undefined }) {
  const [src, setSrc] = useState<string | null>(null);
  const load = code && code.length === 2 ? FLAGS[`/node_modules/flag-icons/flags/4x3/${code.toLowerCase()}.svg`] : undefined;
  useEffect(() => {
    setSrc(null);
    let alive = true;
    load?.().then((url) => alive && setSrc(url));
    return () => {
      alive = false;
    };
  }, [load]);
  if (!src) return <span className="flag flag-blank" aria-hidden="true" />;
  return (
    <img
      className="flag"
      src={src}
      width={18}
      height={13}
      alt=""
    />
  );
}

const looksLikeHost = (s: string) => /^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(s);

export function Favicon({ host }: { host: string | null | undefined }) {
  const [broken, setBroken] = useState(false);
  if (!host || !looksLikeHost(host) || broken) return <span className="favicon favicon-blank" aria-hidden="true" />;
  return (
    <img
      className="favicon"
      // Fetched and cached by the Worker, so the referrers never reach a third party from this browser.
      src={`/api/icon?host=${encodeURIComponent(host)}`}
      width={16}
      height={16}
      alt=""
      loading="lazy"
      onError={() => setBroken(true)}
    />
  );
}

export function Place({ country, city, region }: { country?: string | null; city?: string | null; region?: string | null }) {
  const where = city ? `${city}${region && region !== city ? `, ${region}` : ""}` : countryName(country);
  return (
    <span className="place">
      <Flag code={country} />
      <span>{where}</span>
    </span>
  );
}

// Opens the page on the live site in a new tab, without counting the visit.
export function OpenPage({ domain, path, children }: { domain: string; path: string; children?: React.ReactNode }) {
  return (
    <a
      className={children ? "page-link" : "open-page"}
      href={liveUrl(domain, path)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={children ? undefined : `Open ${path} on ${domain}`}
      title={children ? `Open on ${domain}` : undefined}
    >
      {children ?? (
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
          <path d="M9 3h4v4M13 3L7.5 8.5M11 9.5V13H3V5h3.5" />
        </svg>
      )}
    </a>
  );
}
