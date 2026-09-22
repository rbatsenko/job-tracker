"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ScopeTag, money } from "@/components/bits";
import { addFromBoard, trackedOrigins } from "@/lib/my-jobs";
import type { Job } from "@/lib/types";

type Payload = { jobs: Job[]; facets: { sources: { source: string; n: number }[]; total: number } };

const control =
  "h-11 rounded-field border border-line bg-raised px-3.5 text-base outline-none focus:border-brand";

export default function Board() {
  const [data, setData] = useState<Payload | null>(null);
  const [tracked, setTracked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [scope, setScope] = useState("reachable");
  const [source, setSource] = useState("all");
  const [sort, setSort] = useState("score");

  useEffect(() => setTracked(trackedOrigins()), []);

  const load = useCallback(async () => {
    const p = new URLSearchParams({ scope, source, sort, limit: "300" });
    if (q) p.set("q", q);
    const res = await fetch(`/api/jobs?${p}`, { cache: "no-store" });
    setData((await res.json()) as Payload);
  }, [q, scope, source, sort]);

  useEffect(() => {
    const t = setTimeout(load, q ? 250 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  const refresh = async () => {
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch("/api/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const out = (await res.json()) as { results: { source: string; inserted: number; error?: string }[] };
      const added = out.results.reduce((n, r) => n + (r.inserted ?? 0), 0);
      const failed = out.results.filter((r) => r.error).map((r) => r.source);
      setNote(
        `${added} new ${added === 1 ? "job" : "jobs"}${failed.length ? `. ${failed.join(", ")} did not answer.` : "."}`,
      );
      await load();
    } finally {
      setBusy(false);
    }
  };

  const add = (j: Job) => {
    addFromBoard({
      source: j.source,
      external_id: j.external_id,
      url: j.url,
      company: j.company,
      title: j.title,
      location: j.location,
      remote_scope: j.remote_scope,
      salary_min: j.salary_min,
      salary_max: j.salary_max,
      currency: j.currency,
      salary_period: j.salary_period,
      tags: j.tags,
      description: j.description,
      fit_score: j.fit_score,
      fit_reasons: j.fit_reasons,
    });
    setTracked(trackedOrigins());
  };

  const rows = useMemo(() => data?.jobs ?? [], [data]);

  return (
    <main className="mx-auto max-w-[1400px] px-5 py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Find jobs</h1>
          <p className="mt-1.5 text-base text-soft">
            {data ? `${data.facets.total} listings pulled from 11 boards` : " "}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {note && <span className="text-sm text-soft">{note}</span>}
          <button
            onClick={refresh}
            disabled={busy}
            className="h-11 rounded-field bg-brand px-5 text-base font-semibold text-brand-text transition hover:brightness-110 disabled:opacity-50"
          >
            {busy ? "Fetching…" : "Fetch new jobs"}
          </button>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search company, role, stack"
          className={`${control} w-72`}
          aria-label="Search"
        />
        <select value={scope} onChange={(e) => setScope(e.target.value)} className={control} aria-label="Location">
          <option value="reachable">Open to me</option>
          <option value="all">Anywhere</option>
          <option value="worldwide">Remote worldwide</option>
          <option value="eu">Remote in Europe</option>
          <option value="pl">Poland</option>
          <option value="us">US only</option>
        </select>
        <select value={source} onChange={(e) => setSource(e.target.value)} className={control} aria-label="Board">
          <option value="all">All boards</option>
          {(data?.facets.sources ?? []).map((s) => (
            <option key={s.source} value={s.source}>{`${s.source} (${s.n})`}</option>
          ))}
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value)} className={control} aria-label="Sort">
          <option value="score">Best fit</option>
          <option value="newest">Newest</option>
          <option value="company">Company</option>
        </select>
        <span className="ml-auto text-sm text-faint">{rows.length} shown</span>
      </div>

      <ul className="overflow-hidden rounded-card border border-line bg-raised shadow-[var(--shadow)]">
        {rows.map((j, i) => {
          const key = `${j.source}:${j.external_id}`;
          const have = tracked.has(key);
          return (
            <li
              key={j.id}
              className={`flex items-center gap-5 px-5 py-4 ${i > 0 ? "border-t border-line" : ""}`}
            >
              <span
                className={`w-11 shrink-0 rounded-md py-1.5 text-center text-base font-semibold tabular-nums ${
                  j.fit_score >= 75
                    ? "bg-brand-soft text-brand"
                    : j.fit_score >= 55
                      ? "bg-sunken text-soft"
                      : "bg-sunken text-faint"
                }`}
                title={j.fit_reasons.join(" · ")}
              >
                {j.fit_score}
              </span>

              <a
                href={j.url}
                target="_blank"
                rel="noreferrer"
                className="min-w-0 flex-1 group"
              >
                <span className="flex items-baseline gap-2.5">
                  <span className="truncate text-lg font-semibold group-hover:underline">{j.title}</span>
                  <span className="truncate text-base text-soft">{j.company}</span>
                </span>
                <span className="mt-1.5 flex flex-wrap items-center gap-2.5 text-sm text-faint">
                  <ScopeTag scope={j.remote_scope} />
                  {money(j) && <span className="text-soft">{money(j)}</span>}
                  <span className="truncate">{j.location}</span>
                  <span>{j.source}</span>
                </span>
              </a>

              <button
                onClick={() => add(j)}
                disabled={have}
                className={`h-11 shrink-0 rounded-field px-4 text-base font-medium transition ${
                  have
                    ? "bg-brand-soft text-brand"
                    : "border border-line text-soft hover:border-brand hover:text-brand"
                }`}
              >
                {have ? "In my jobs" : "Add to my jobs"}
              </button>
            </li>
          );
        })}
        {!rows.length && (
          <li className="p-12 text-center text-base text-soft">
            Nothing matches. Widen the filters, or fetch new jobs.
          </li>
        )}
      </ul>
    </main>
  );
}
