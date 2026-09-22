"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Boards behind Cloudflare (justjoin.it) or a login (Work at a Startup) can't
 * be fetched server-side, and an HTTPS page can't POST to http://localhost.
 * So the snippet stashes rows in window.name and navigates here: window.name
 * survives a cross-origin navigation, and this page is same-origin with the API.
 *
 * Payload: first line "source<TAB>name", then one TSV row per job.
 */
export default function ImportBridge() {
  const [log, setLog] = useState("Reading window.name…");
  const ran = useRef(false);

  useEffect(() => {
    // React runs effects twice in dev; the import is idempotent but noisy.
    if (ran.current) return;
    ran.current = true;

    const raw = window.name;
    if (!raw || !raw.includes("\t")) {
      setLog("Nothing to import — window.name is empty.");
      return;
    }

    const lines = raw.split("\n").filter(Boolean);
    const header = lines[0].split("\t");
    const source = header[0] === "source" ? header[1] : "ycombinator";
    const body = header[0] === "source" ? lines.slice(1) : lines;

    const rows = body.map((line) => {
      const [id, title, company, meta, tagline] = line.split("\t");
      return {
        id,
        title,
        company,
        meta,
        tagline,
        // justjoin rows reuse the same columns: id is the URL, meta the card text.
        href: id,
        card: meta,
      };
    });

    setLog(`Importing ${rows.length} rows from ${source}…`);

    fetch("/api/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source, rows }),
    })
      .then((r) => r.json())
      .then((r) => {
        window.name = ""; // don't re-import on refresh
        setLog(JSON.stringify(r, null, 2));
      })
      .catch((e) => setLog(`Failed: ${String(e)}`));
  }, []);

  return (
    <main className="p-10 font-mono text-sm">
      <h1 className="mb-4 text-lg font-semibold">Import bridge</h1>
      <pre className="whitespace-pre-wrap text-ink-300">{log}</pre>
      <a href="/" className="mt-6 inline-block text-accent underline">← back to tracker</a>
    </main>
  );
}
