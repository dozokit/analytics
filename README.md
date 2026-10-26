# Dozokit Analytics

Web analytics that runs in your own Cloudflare account: one Worker serves the dashboard, the API and the tracking script, and a D1 database keeps the visits. The free Workers plan is enough for about 9,000 pageviews a day.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/dozokit/analytics)

## Set it up in five minutes

You need a free Cloudflare account and a GitHub (or GitLab) account.

1. **Click Deploy to Cloudflare** above and sign in to Cloudflare.
2. **Connect GitHub** when asked. Cloudflare copies this repository into your account; that copy is what it builds and deploys.
3. **Fill in the form.** Keep the names it suggests (`dozokit-analytics`) unless they clash with something you already have, and type a **password of 12 characters or more**: it is the one you will sign in to your dashboard with.
4. **Click Create and deploy** and wait a minute or two while it builds. Cloudflare creates the Worker, its database, and the database's tables.
5. **Open your dashboard** at the address Cloudflare shows when it is done, something like `https://dozokit-analytics.your-name.workers.dev`, and sign in with your password.
6. **Add your website** in Settings: type its domain, then copy the one-line tag it gives you.
7. **Paste the tag** inside the `<head>` of every page of your site (most site builders have a "custom code" or "head" setting), publish, and open your site once. Settings shows when the first visit arrives.

That's it: visits show up within seconds. A few things you may want later:

- **Your own address for the dashboard and the tag**, such as `stats.example.com`: in Cloudflare, open the Worker, then Settings → Domains & Routes → Add → Custom domain. Then use that address in the tag instead of `workers.dev`. The domain has to be on Cloudflare.
- **Change the password**: in the dashboard, Settings → Change password. Forgot it? In Cloudflare, open the Worker, then Settings → Variables and Secrets, and edit `PASSWORD`: that password works again.
- **Get updates**: the dashboard tells you when a newer version is out. Open your copy on GitHub, then **Actions** → **Update Dozokit Analytics** → **Run workflow**. It installs the latest release, once it checks the release is signed with Dozokit's release key (a wrong or missing signature stops it and changes nothing), and keeps your `wrangler.jsonc` (it holds your database's id), and Cloudflare rebuilds and deploys within a couple of minutes, database changes included. [CHANGELOG.md](CHANGELOG.md) says what changed. **The first time**, add that button: Cloudflare's Deploy button copies everything except `.github`, so open Settings → Updates on your stats site, paste your copy's address and click **Add the update button**, then **Commit changes** on GitHub. Added it before 1.2.2? Press **Replace it** there instead: GitHub opens the file with the new version on your clipboard, so select everything, paste and **Commit changes**. Details: [the guide](https://dozokit.com/analytics/guide#updating). From a terminal, in a clone of your copy:
  ```bash
  tag=$(curl -s https://api.github.com/repos/dozokit/analytics/releases/latest | grep -o '"tag_name": *"[^"]*"' | cut -d'"' -f4)
  git fetch https://github.com/dozokit/analytics tag "$tag"
  git checkout "$tag" -- . ':!wrangler.jsonc' ':!.github'
  git commit -m "Update Dozokit Analytics to $tag" && git push
  ```
- **Leave your own visits out**: open your site once with `?dozokit_ignore=1` at the end of the address.

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

Your visitors' browsers only talk to your Worker. The dashboard itself loads its General Sans font from Fontshare and its map tiles from OpenFreeMap, so those two see your IP address and which map area you look at. Referrer icons are fetched by the Worker from DuckDuckGo, not by your browser. Once a day the Worker asks GitHub for the latest release, to tell you on the dashboard when a newer version exists.

## License

[AGPL-3.0](LICENSE). You can run, change and share it; if you offer a changed version to others as a service, share your changes too.
