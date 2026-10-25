// Where a visit came from, decided once from its first page: the referrer,
// the utm tags and, when the referrer is empty, the browser and the page.

export type Channel = "Direct" | "Search" | "AI" | "Social" | "Email" | "Paid" | "Referral";
export type DirectKind = "typed" | "shared" | "checkout" | "inapp";

const ALIASES: Record<string, string> = {
  "t.co": "x.com",
  "twitter.com": "x.com",
  "lnkd.in": "linkedin.com",
  "out.reddit.com": "reddit.com",
  "old.reddit.com": "reddit.com",
  "youtu.be": "youtube.com",
  "chat.openai.com": "chatgpt.com",
  "threads.com": "threads.net",
  "l.instagram.com": "instagram.com",
  "lm.facebook.com": "facebook.com",
  "l.facebook.com": "facebook.com",
  "m.facebook.com": "facebook.com",
};

// Referrers an Android app sends as android-app://<package>/
const ANDROID_APPS: Record<string, string> = {
  "com.google.android.gm": "mail.google.com",
  "com.google.android.googlequicksearchbox": "google.com",
  "com.linkedin.android": "linkedin.com",
  "com.reddit.frontpage": "reddit.com",
  "com.slack": "slack.com",
  "org.telegram.messenger": "telegram.org",
  "com.twitter.android": "x.com",
  "com.instagram.android": "instagram.com",
  "com.facebook.katana": "facebook.com",
  "com.discord": "discord.com",
};

const AI = ["chatgpt.com", "claude.ai", "perplexity.ai", "gemini.google.com", "copilot.microsoft.com", "chat.deepseek.com", "grok.com", "you.com", "phind.com", "chat.mistral.ai", "meta.ai"];
const SEARCH = [/(^|\.)google\.[a-z.]+$/, /(^|\.)bing\.com$/, /(^|\.)duckduckgo\.com$/, /(^|\.)yahoo\.com$/, /(^|\.)ecosia\.org$/, /(^|\.)baidu\.com$/, /(^|\.)yandex\.[a-z]+$/, /^search\.brave\.com$/, /(^|\.)qwant\.com$/, /(^|\.)startpage\.com$/, /(^|\.)kagi\.com$/, /(^|\.)naver\.com$/, /(^|\.)seznam\.cz$/];
const SOCIAL = ["x.com", "facebook.com", "instagram.com", "linkedin.com", "reddit.com", "news.ycombinator.com", "youtube.com", "tiktok.com", "threads.net", "bsky.app", "mastodon.social", "pinterest.com", "producthunt.com", "indiehackers.com", "discord.com", "slack.com", "telegram.org", "t.me", "whatsapp.com", "snapchat.com", "line.me", "medium.com", "substack.com", "dev.to", "lobste.rs"];
const EMAIL = ["mail.google.com", "outlook.live.com", "outlook.office.com", "outlook.office365.com", "mail.yahoo.com", "app.fastmail.com", "mail.proton.me", "app.hey.com"];
const CHECKOUT = ["checkout.stripe.com", "buy.stripe.com", "billing.stripe.com", "polar.sh", "checkout.dodopayments.com", "lemonsqueezy.com", "paddle.com", "paypal.com", "checkout.paddle.com"];

// In-app browsers drop the referrer but name themselves in the user agent.
const IN_APP: [RegExp, string][] = [
  [/Instagram/i, "instagram.com"],
  [/FBAN|FBAV|FB_IAB|FBIOS/i, "facebook.com"],
  [/LinkedInApp/i, "linkedin.com"],
  [/Twitter/i, "x.com"],
  [/musical_ly|BytedanceWebview|TikTok/i, "tiktok.com"],
  [/Snapchat/i, "snapchat.com"],
  [/Pinterest/i, "pinterest.com"],
  [/Barcelona/i, "threads.net"],
  [/ Line\//i, "line.me"],
  [/Discord/i, "discord.com"],
];

function matches(host: string, list: string[]) {
  return list.some((d) => host === d || host.endsWith("." + d));
}

export function cleanHost(raw: string): string {
  let host = raw.toLowerCase().replace(/^www\./, "");
  if (ALIASES[host]) host = ALIASES[host];
  return host;
}

export function referrerHost(ref: string | undefined | null): string | null {
  if (!ref) return null;
  try {
    const url = new URL(ref);
    if (url.protocol === "android-app:") return ANDROID_APPS[url.hostname] ?? url.hostname;
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return cleanHost(url.hostname);
  } catch {
    return null;
  }
}

function sameSite(a: string, b: string) {
  const strip = (h: string) => h.replace(/^www\./, "");
  return strip(a) === strip(b);
}

function channelOfHost(host: string): Channel {
  if (matches(host, AI)) return "AI";
  if (SEARCH.some((re) => re.test(host))) return "Search";
  if (matches(host, EMAIL)) return "Email";
  if (matches(host, SOCIAL)) return "Social";
  return "Referral";
}

// utm_source is free text ("twitter", "newsletter"), so it is read loosely.
function channelOfTag(source: string): { channel: Channel; source: string } {
  const s = source.toLowerCase().trim();
  const named: Record<string, string> = { twitter: "x.com", x: "x.com", facebook: "facebook.com", fb: "facebook.com", instagram: "instagram.com", ig: "instagram.com", linkedin: "linkedin.com", reddit: "reddit.com", hn: "news.ycombinator.com", hackernews: "news.ycombinator.com", youtube: "youtube.com", tiktok: "tiktok.com", google: "google.com", bing: "bing.com", chatgpt: "chatgpt.com", producthunt: "producthunt.com", bluesky: "bsky.app", threads: "threads.net" };
  if (named[s]) return { channel: channelOfHost(named[s]), source: named[s] };
  if (/mail|newsletter/.test(s)) return { channel: "Email", source: s };
  if (s.includes(".")) return { channel: channelOfHost(cleanHost(s)), source: cleanHost(s) };
  return { channel: "Referral", source: s };
}

export interface Attribution {
  channel: Channel;
  source: string | null;
  directKind: DirectKind | null;
}

export function classify(input: {
  refHost: string | null;
  pageHost: string;
  path: string;
  params: URLSearchParams;
  ua: string;
  device: string;
  isNew: boolean;
}): Attribution {
  const { params, ua } = input;
  const medium = (params.get("utm_medium") ?? "").toLowerCase();
  const tag = params.get("utm_source") ?? params.get("ref") ?? params.get("source");
  const refHost = input.refHost && !sameSite(input.refHost, input.pageHost) ? input.refHost : null;

  if (/^(cpc|ppc|paid|paidsearch|paid_social|paidsocial|display|ads?|cpm)$/.test(medium) || params.has("gclid") || params.has("msclkid")) {
    return { channel: "Paid", source: refHost ?? (tag ? channelOfTag(tag).source : null), directKind: null };
  }
  if (/^(e-?mail|newsletter)$/.test(medium)) {
    return { channel: "Email", source: tag ? tag.toLowerCase() : refHost, directKind: null };
  }
  if (refHost && matches(refHost, CHECKOUT)) {
    return { channel: "Direct", source: "Checkout return", directKind: "checkout" };
  }
  if (refHost) return { channel: channelOfHost(refHost), source: refHost, directKind: null };
  if (tag) {
    const t = channelOfTag(tag);
    return { channel: t.channel, source: t.source, directKind: null };
  }
  for (const [re, host] of IN_APP) {
    if (re.test(ua)) return { channel: "Social", source: host, directKind: "inapp" };
  }
  // No referrer at all. A new visitor landing deep in the site, or on a
  // phone, almost always followed a link pasted somewhere that hides it.
  const shared = input.path !== "/" && input.isNew;
  const mobileNew = input.device !== "Desktop" && input.isNew;
  if (shared || mobileNew) return { channel: "Direct", source: "Shared link", directKind: "shared" };
  return { channel: "Direct", source: "Typed or bookmarked", directKind: "typed" };
}
