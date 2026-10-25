export const BOT = /bot|crawl|spider|slurp|headless|lighthouse|pagespeed|preview|facebookexternalhit|embedly|quora link|vercel|pingdom|uptime|monitor|curl|wget|python-requests|go-http|axios|node-fetch/i;

export function parseUA(ua: string, width?: number) {
  const browser =
    /Edg\//.test(ua) ? "Edge" :
    /OPR\/|Opera/.test(ua) ? "Opera" :
    /SamsungBrowser/.test(ua) ? "Samsung Internet" :
    /Instagram/.test(ua) ? "Instagram" :
    /FBAN|FBAV/.test(ua) ? "Facebook" :
    /Firefox|FxiOS/.test(ua) ? "Firefox" :
    /CriOS|Chrome\//.test(ua) ? "Chrome" :
    /Safari\//.test(ua) ? "Safari" : "Other";

  const os =
    /iPad/.test(ua) ? "iPadOS" :
    /iPhone|iPod/.test(ua) ? "iOS" :
    /Android/.test(ua) ? "Android" :
    /CrOS/.test(ua) ? "ChromeOS" :
    /Windows/.test(ua) ? "Windows" :
    /Mac OS X|Macintosh/.test(ua) ? "macOS" :
    /Linux/.test(ua) ? "Linux" : "Other";

  let device: string;
  if (width && width > 0) device = width < 600 ? "Mobile" : width < 1024 ? "Tablet" : "Desktop";
  else device = /iPad|Tablet/.test(ua) ? "Tablet" : /Mobi|iPhone|Android/.test(ua) ? "Mobile" : "Desktop";

  return { browser, os, device };
}
