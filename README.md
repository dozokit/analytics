# Dozokit Analytics

Web analytics that runs in your own Cloudflare account: one Worker serves the dashboard, the API and the tracking script, and a D1 database keeps the visits. The free Workers plan is enough for about 9,000 pageviews a day.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/dozokit/analytics)

The button copies this repository to your GitHub account, creates the Worker and its database, and asks for the dashboard's password. Then open the Worker's address and add your first website.

## Run it locally

```bash
npm install
npm run db:migrate   # create the local D1 tables
npm run seed         # optional: 60 days of made-up traffic on a "demo" site
npm run dev          # http://localhost:5190
```

`/demo.html` is a test page that counts itself on the demo site.

## Put it on Cloudflare by hand

```bash
npx wrangler d1 create dozokit-analytics --binding DB --update-config   # adds the database id to wrangler.jsonc
npx wrangler secret put PASSWORD                                      # 12 characters or more
npm run deploy                                                        # build, migrate the database, deploy
```

Without a `PASSWORD` secret, or with one under 12 characters, the deployed dashboard shows nothing but a page asking for one; it is open only on your own machine. Sign-in allows 5 attempts a minute per address. To serve it on your own domain, add it under the Worker's Domains & Routes in the Cloudflare dashboard.

## Track a site

Add a website under Settings, then put its tag in the `<head>` of every page:

```html
<script defer data-site="SITE_ID" src="https://your-worker.workers.dev/t.js"></script>
```

- Client-side route changes are counted.
- Goals: `data-dozokit-goal="signup"` on any element, or `window.dozokit?.("signup", { plan: "pro" })`.
- Leave your own visits out: open your site once with `?dozokit_ignore=1` (`=0` undoes it).
- Never counted: browsers sending Global Privacy Control, automated browsers (`navigator.webdriver`: Playwright, Puppeteer, Selenium), known bots by user agent, and pages on `localhost`, `127.0.0.1`, `*.localhost` or `*.test` (add `data-local` to the tag to count those, as `public/demo.html` does).

## What it records

- Per visit: the first and last page, the referring site, the utm tags, country, region, city and the city's coordinates (from Cloudflare), browser, OS, device and browser language.
- Per page: the address without its query, the page title and the time on page (measured by a ping each minute while the page is in view).
- Per goal: its name, the page and any properties you send with it.
- No cookies and no IP address. A random visitor id (renewed after 13 months) and a session id live in the site's localStorage, and a visit ends after 30 idle minutes.
- Because of that visitor id, the Visitors page shows each browser's visits over time. Visits are deleted after 25 months.

This is personal data under the GDPR. Describe it in your site's privacy policy, and give visitors a way out: a link to any page with `?dozokit_ignore=1` stops their browser being counted. Whether you also need consent depends on your country's rules; Dozokit Analytics does not decide that for you.

The tracking endpoint takes at most 600 hits a minute per address and site (raise `COLLECT_LIMIT` in `wrangler.jsonc` if many of your visitors share one address, as in a large office), refuses hits sent from other sites, and refuses bodies over 4 KB.

Visits are sorted into Direct, Search, AI, Social, Referral, Email and Paid (`worker/classify.ts`). Visits with no referrer are split into four kinds: typed or bookmarked, shared link and back from checkout (all three counted as Direct), and in-app browser (counted as Social).

## Later

Revenue attribution (Stripe, Polar, Dodo) is not built. It would add a `payments` table fed by webhooks and joined to the buyer's first visit.

## Third parties

Your visitors' browsers only talk to your Worker. The dashboard itself loads its General Sans font from Fontshare and its map tiles from OpenFreeMap, so those two see your IP address and which map area you look at. Referrer icons are fetched by the Worker from DuckDuckGo, not by your browser.

## License

[AGPL-3.0](LICENSE). You can run, change and share it; if you offer a changed version to others as a service, share your changes too.
