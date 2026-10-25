/* Dozokit Analytics: page views, time on page and goals. No cookies; ids live in localStorage. */
(function () {
  var script = document.currentScript;
  if (!script || window.__dozokit) return;
  window.__dozokit = true;
  var site = script.getAttribute("data-site");
  var endpoint = new URL(script.src).origin + "/api/collect";
  var store;
  try { store = window.localStorage; } catch (e) {}

  function get(k) { try { return store ? store.getItem(k) : null; } catch (e) { return null; } }
  function put(k, v) { try { if (store) store.setItem(k, v); } catch (e) {} }

  // ?dozokit_ignore=1 on any page stops counting this browser; =0 resumes.
  var ignore = /[?&]dozokit_ignore=([01])/.exec(location.search);
  if (ignore) ignore[1] === "1" ? put("dozokit_ignore", "1") : store && store.removeItem("dozokit_ignore");
  // Nobody's real visit: an automated browser (Playwright, Puppeteer, Selenium all set
  // navigator.webdriver) or a page on a development machine. data-local counts the latter.
  var local = /^(localhost|127\.0\.0\.1|\[::1\]|.+\.localhost|.+\.test)$/.test(location.hostname) && !script.hasAttribute("data-local");
  // A browser sending Global Privacy Control has asked not to be tracked.
  if (get("dozokit_ignore") || navigator.webdriver || navigator.globalPrivacyControl || local || !site) { window.dozokit = function () {}; return; }

  function id() {
    var c = window.crypto;
    var raw = c && c.randomUUID ? c.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36) + Math.random().toString(36).slice(2);
    return raw.replace(/-/g, "").slice(0, 20);
  }
  function hostOf(u) { try { return new URL(u).hostname.replace(/^www\./, ""); } catch (e) { return ""; } }

  // The visitor id lives 13 months at most, then the browser gets a new one.
  var MAX_AGE = 395 * 24 * 3600 * 1000;
  var visitor = get("dozokit_v");
  var born = Number(get("dozokit_vt")) || 0;
  if (visitor && !born) { born = Date.now(); put("dozokit_vt", String(born)); }
  if (visitor && Date.now() - born > MAX_AGE) visitor = null;
  var isNew = !visitor;
  if (!visitor) { visitor = id(); put("dozokit_v", visitor); put("dozokit_vt", String(Date.now())); }

  var IDLE = 30 * 60 * 1000;
  var current = null;

  // A visit ends after 30 idle minutes, or when the visitor comes back from
  // somewhere else (a new referrer or a new campaign).
  function session(referrer) {
    var now = Date.now();
    var saved = null;
    try { saved = JSON.parse(get("dozokit_s") || "null"); } catch (e) {}
    var from = referrer ? hostOf(referrer) : "";
    var external = from && from !== location.hostname.replace(/^www\./, "") ? from : "";
    var campaign = /[?&]utm_/.test(location.search) ? location.search : "";
    if (!saved || now - saved.t > IDLE || (external && external !== saved.r) || (campaign && campaign !== saved.q)) {
      saved = { id: id(), r: external, q: campaign };
    }
    saved.t = now;
    put("dozokit_s", JSON.stringify(saved));
    return saved;
  }

  function send(body) {
    body.site = site;
    body.v = visitor;
    var data = JSON.stringify(body);
    if (navigator.sendBeacon && navigator.sendBeacon(endpoint, data)) return;
    fetch(endpoint, { method: "POST", body: data, keepalive: true, headers: { "content-type": "text/plain" } }).catch(function () {});
  }

  var lastPath = null;
  function pageview() {
    var here = location.pathname + location.search;
    if (here === lastPath) return;
    var referrer = lastPath === null ? document.referrer : "";
    lastPath = here;
    current = session(referrer);
    send({ t: "pageview", s: current.id, n: isNew, u: location.href, r: referrer, ti: document.title, w: screen.width, l: navigator.language });
    isNew = false;
  }

  function ping() {
    if (!current) return;
    current.t = Date.now();
    put("dozokit_s", JSON.stringify(current));
    send({ t: "ping", s: current.id });
  }

  window.dozokit = function (name, props) {
    if (!current) current = session("");
    send({ t: "event", s: current.id, name: String(name), u: location.href, p: props });
  };

  // Single-page apps change the address without loading a page.
  ["pushState", "replaceState"].forEach(function (method) {
    var original = history[method];
    history[method] = function () {
      var result = original.apply(this, arguments);
      setTimeout(pageview, 0);
      return result;
    };
  });
  window.addEventListener("popstate", function () { setTimeout(pageview, 0); });

  document.addEventListener("click", function (e) {
    var el = e.target && e.target.closest ? e.target.closest("[data-dozokit-goal]") : null;
    if (el) window.dozokit(el.getAttribute("data-dozokit-goal"));
  }, true);

  // Time on page: a ping each minute while the page is in view, and one when it leaves view.
  setInterval(function () { if (document.visibilityState === "visible") ping(); }, 60000);
  document.addEventListener("visibilitychange", function () { if (document.visibilityState === "hidden") ping(); });

  pageview();
})();
