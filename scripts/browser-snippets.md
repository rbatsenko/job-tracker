# Pulling from boards that block servers

`justjoin.it` sits behind Cloudflare and Work at a Startup needs your login, so
neither can be fetched from the server. Both are read in the browser instead and
pushed through `/import-bridge`, which works because `window.name` survives a
cross-origin navigation.

Make sure the tracker is running (`npm run dev`) before you start.

## justjoin.it

Open a search — for example `https://justjoin.it/job-offers/remote?keyword=typescript` —
then paste this in the DevTools console. Re-run it on each page and each keyword
you care about; it accumulates.

```js
window.name = window.name.includes("\tjustjoin") ? window.name : "source\tjustjoin";
const seen = new Set(window.name.split("\n").map((l) => l.split("\t")[0]));
const add = [];
for (const a of document.querySelectorAll('a[href*="/job-offer/"]')) {
  const h = a.getAttribute("href");
  if (!h || seen.has(h)) continue;
  seen.add(h);
  let el = a, n = 0;
  while (el && n < 8 && (el.innerText || "").length < 90) { el = el.parentElement; n++; }
  if (el) add.push(`${h}\t\t\t${el.innerText.replace(/\n+/g, " | ").replace(/\t/g, " ").trim()}\t`);
}
if (add.length) window.name += "\n" + add.join("\n");
console.log(`added ${add.length}, total ${window.name.split("\n").length - 1}`);
```

When you have enough, send it:

```js
location.href = "http://localhost:4321/import-bridge";
```

## Work at a Startup (YC)

Filter the directory the way you want it (Remote OK + "US visa not required" +
Role: Engineering is a good start), scroll until every company has loaded, then:

```js
const heads = [...document.querySelectorAll("a")].filter(
  (x) => /workatastartup\.com\/companies\/[^/]+$/.test(x.href) && /\([A-Z]{0,2}\d{2}\)\s*$/.test(x.innerText.trim()),
);
const rows = [];
for (const h of heads) {
  let card = h, n = 0;
  while (card && n < 10 && !card.querySelector('a[href*="/jobs/"]')) { card = card.parentElement; n++; }
  if (!card) continue;
  const name = h.innerText.trim();
  const txt = card.innerText.split("\n").map((s) => s.trim()).filter(Boolean);
  const i = txt.findIndex((s) => s.replace(/\s+/g, "") === name.replace(/\s+/g, ""));
  for (const r of card.querySelectorAll("div.mb-2")) {
    const link = r.querySelector('a[href*="/jobs/"]');
    if (!link) continue;
    const id = (link.getAttribute("href") || "").match(/\/jobs\/(\d+)/);
    const L = r.innerText.split("\n").map((s) => s.trim()).filter(Boolean).filter((x) => x !== "View job");
    if (id) rows.push([id[1], L[0], name, L.slice(1).join(" · "), txt[i + 1] || ""].join("\t"));
  }
}
window.name = "source\tycombinator\n" + rows.join("\n");
location.href = "http://localhost:4321/import-bridge";
```

Scrolling note: both boards only load more on a *real* scroll gesture, so
`window.scrollTo` in the console will stall. Scroll with the mouse.
