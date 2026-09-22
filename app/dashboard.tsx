"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { jobKey, readState, writeState, type Tracked } from "@/lib/local-state";
import { STATUSES, type Job, type Status } from "@/lib/types";

type Payload = {
  jobs: Job[];
  facets: { sources: { source: string; n: number }[]; total: number };
};

const SCOPE_LABEL: Record<string, string> = {
  worldwide: "Worldwide",
  eu: "Europe",
  pl: "Poland",
  us: "US only",
  other: "On-site",
  unknown: "Unclear",
};

const SCOPE_CLASS: Record<string, string> = {
  worldwide: "bg-good/15 text-good",
  eu: "bg-good/15 text-good",
  pl: "bg-accent/15 text-accent",
  us: "bg-bad/15 text-bad",
  other: "bg-ink-700 text-ink-300",
  unknown: "bg-ink-700 text-ink-300",
};

const STATUS_CLASS: Record<string, string> = {
  new: "bg-ink-700 text-ink-300",
  shortlist: "bg-accent/20 text-accent",
  drafted: "bg-warn/20 text-warn",
  applied: "bg-good/20 text-good",
  replied: "bg-good/25 text-good",
  interviewing: "bg-good/30 text-good",
  offer: "bg-good/40 text-good",
  rejected: "bg-bad/20 text-bad",
  archived: "bg-ink-800 text-ink-500",
};

function money(j: Job) {
  if (!j.salary_max) return null;
  const sym = j.currency === "EUR" ? "€" : j.currency === "GBP" ? "£" : j.currency === "PLN" ? "" : "$";
  const suffix = j.currency === "PLN" ? " PLN" : "";
  const per = j.salary_period === "month" ? "/mo" : j.salary_period === "hour" ? "/h" : "";
  const k = (n: number) => (n >= 10_000 && j.salary_period !== "month" ? `${Math.round(n / 1000)}K` : n.toLocaleString());
  const lo = j.salary_min && j.salary_min !== j.salary_max ? `${k(j.salary_min)}–` : "";
  return `${sym}${lo}${k(j.salary_max)}${suffix}${per}`;
}

export default function Dashboard() {
  const [data, setData] = useState<Payload | null>(null);
  const [local, setLocal] = useState<Record<string, Tracked>>({});
  const [selected, setSelected] = useState<Job | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [refreshLog, setRefreshLog] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [scope, setScope] = useState("reachable");
  const [source, setSource] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [minScore, setMinScore] = useState(0);
  const [sort, setSort] = useState<"score" | "newest" | "company">("score");

  useEffect(() => setLocal(readState()), []);

  const load = useCallback(async () => {
    const params = new URLSearchParams({ scope, source, sort, minScore: String(minScore) });
    if (q) params.set("q", q);
    const res = await fetch(`/api/jobs?${params}`, { cache: "no-store" });
    setData((await res.json()) as Payload);
  }, [q, scope, source, sort, minScore]);

  useEffect(() => {
    const t = setTimeout(load, q ? 250 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  /** Writes to localStorage first, then mirrors to the server if one is writable. */
  const track = useCallback((job: Job, patch: Tracked) => {
    setLocal((prev) => {
      const key = jobKey(job);
      const next = { ...prev, [key]: { ...prev[key], ...patch } };
      if (patch.status === "applied" && !prev[key]?.applied_at) {
        next[key].applied_at = new Date().toISOString();
      }
      writeState(next);
      return next;
    });
    fetch(`/api/jobs/${job.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    }).catch(() => {});
  }, []);

  const refresh = useCallback(async () => {
    setBusy("refresh");
    setRefreshLog(null);
    try {
      const res = await fetch("/api/refresh", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const out = (await res.json()) as { results: { source: string; found: number; inserted: number; error?: string }[] };
      setRefreshLog(
        out.results
          .map((r) => (r.error ? `${r.source}: failed` : `${r.source}: +${r.inserted} of ${r.found}`))
          .join("  ·  "),
      );
      await load();
    } finally {
      setBusy(null);
    }
  }, [load]);

  /** Server row + this viewer's own tracking state. */
  const merged = useMemo(() => {
    const rows = (data?.jobs ?? []).map((j) => {
      const t = local[jobKey(j)] ?? {};
      return {
        ...j,
        status: (t.status ?? j.status) as Status,
        starred: (t.starred ?? Boolean(j.starred)) ? 1 : 0,
        notes: t.notes ?? j.notes,
        draft: t.draft ?? j.draft,
        applied_at: t.applied_at ?? j.applied_at,
      } as Job;
    });
    const filtered =
      statusFilter === "all"
        ? rows
        : statusFilter === "open"
          ? rows.filter((r) => !["rejected", "archived"].includes(r.status))
          : rows.filter((r) => r.status === statusFilter);
    return filtered.sort((a, b) => (b.starred - a.starred) || (sort === "score" ? b.fit_score - a.fit_score : 0));
  }, [data, local, statusFilter, sort]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const j of data?.jobs ?? []) {
      const s = local[jobKey(j)]?.status ?? j.status;
      c[s] = (c[s] ?? 0) + 1;
    }
    return c;
  }, [data, local]);

  const current = selected
    ? (merged.find((m) => m.id === selected.id) ?? selected)
    : null;

  return (
    <div className="flex h-screen flex-col">
      <header className="flex flex-wrap items-center gap-3 border-b border-ink-800 bg-ink-900 px-5 py-3">
        <h1 className="text-lg font-semibold tracking-tight">
          Job Tracker
          <span className="ml-2 text-sm font-normal text-ink-500">
            {data?.facets.total ?? 0} roles
          </span>
        </h1>

        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {(["shortlist", "drafted", "applied", "replied", "interviewing"] as const).map((s) =>
            counts[s] ? (
              <span key={s} className={`rounded px-2 py-1 ${STATUS_CLASS[s]}`}>
                {s} {counts[s]}
              </span>
            ) : null,
          )}
        </div>

        <div className="ml-auto flex items-center gap-2">
          {refreshLog && (
            <span className="max-w-lg truncate text-xs text-ink-500" title={refreshLog}>
              {refreshLog}
            </span>
          )}
          <button
            onClick={refresh}
            disabled={busy === "refresh"}
            className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-ink-950 transition hover:brightness-110 disabled:opacity-50"
          >
            {busy === "refresh" ? "Fetching…" : "Refresh boards"}
          </button>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-2 border-b border-ink-800 bg-ink-900/60 px-5 py-2 text-sm">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search company, title, stack…"
          className="w-64 rounded-md border border-ink-700 bg-ink-850 px-3 py-1.5 outline-none placeholder:text-ink-500 focus:border-accent"
        />
        <Select value={scope} onChange={setScope} options={[
          ["reachable", "Reachable from PL"], ["all", "Any location"], ["worldwide", "Worldwide"],
          ["eu", "Europe"], ["pl", "Poland"], ["us", "US only"],
        ]} />
        <Select value={statusFilter} onChange={setStatusFilter} options={[
          ["all", "All statuses"], ["open", "Open (not closed)"], ...STATUSES.map((s) => [s, s] as [string, string]),
        ]} />
        <Select value={source} onChange={setSource} options={[
          ["all", "All sources"],
          ...(data?.facets.sources ?? []).map((s) => [s.source, `${s.source} (${s.n})`] as [string, string]),
        ]} />
        <Select value={sort} onChange={(v) => setSort(v as typeof sort)} options={[
          ["score", "Best fit"], ["newest", "Newest"], ["company", "Company"],
        ]} />
        <label className="flex items-center gap-2 text-ink-300">
          min fit
          <input
            type="range" min={0} max={90} step={5} value={minScore}
            onChange={(e) => setMinScore(Number(e.target.value))}
            className="accent-accent"
          />
          <span className="w-6 tabular-nums text-ink-500">{minScore}</span>
        </label>
        <span className="ml-auto text-xs text-ink-500">{merged.length} shown</span>
      </div>

      <div className="flex min-h-0 flex-1">
        <ul className="scroll-thin w-full min-w-0 flex-1 overflow-y-auto">
          {merged.map((j) => (
            <li key={j.id}>
              <button
                onClick={() => setSelected(j)}
                className={`flex w-full items-center gap-3 border-b border-ink-850 px-5 py-2.5 text-left transition hover:bg-ink-900 ${
                  current?.id === j.id ? "bg-ink-900" : ""
                }`}
              >
                <ScoreBadge score={j.fit_score} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline gap-2">
                    <span className="truncate font-medium">{j.title}</span>
                    <span className="truncate text-sm text-ink-500">{j.company}</span>
                  </span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-ink-500">
                    <span className={`rounded px-1.5 py-0.5 ${SCOPE_CLASS[j.remote_scope]}`}>
                      {SCOPE_LABEL[j.remote_scope]}
                    </span>
                    {money(j) && <span className="text-ink-300">{money(j)}</span>}
                    <span className="truncate">{j.location}</span>
                    <span className="text-ink-700">·</span>
                    <span>{j.source}</span>
                  </span>
                </span>
                {j.starred ? <span className="text-accent">★</span> : null}
                <span className={`rounded px-2 py-0.5 text-xs ${STATUS_CLASS[j.status]}`}>{j.status}</span>
              </button>
            </li>
          ))}
          {!merged.length && (
            <li className="p-10 text-center text-sm text-ink-500">
              Nothing here yet — hit <strong className="text-ink-300">Refresh boards</strong>.
            </li>
          )}
        </ul>

        {current && <Detail job={current} onClose={() => setSelected(null)} onTrack={track} />}
      </div>
    </div>
  );
}

function Select({ value, onChange, options }: {
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-md border border-ink-700 bg-ink-850 px-2 py-1.5 outline-none focus:border-accent"
    >
      {options.map(([v, label]) => (
        <option key={v} value={v}>{label}</option>
      ))}
    </select>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const tone = score >= 75 ? "bg-good/15 text-good" : score >= 55 ? "bg-warn/15 text-warn" : "bg-ink-800 text-ink-500";
  return (
    <span className={`w-9 shrink-0 rounded py-1 text-center text-sm font-semibold tabular-nums ${tone}`}>
      {score}
    </span>
  );
}

function Detail({ job, onClose, onTrack }: {
  job: Job;
  onClose: () => void;
  onTrack: (job: Job, patch: Tracked) => void;
}) {
  const [draft, setDraft] = useState(job.draft ?? "");
  const [notes, setNotes] = useState(job.notes ?? "");

  useEffect(() => {
    setDraft(job.draft ?? "");
    setNotes(job.notes ?? "");
  }, [job.id, job.draft, job.notes]);

  return (
    <aside className="scroll-thin flex w-[440px] shrink-0 flex-col overflow-y-auto border-l border-ink-800 bg-ink-900">
      <div className="flex items-start gap-3 border-b border-ink-800 p-5">
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold leading-snug">{job.title}</h2>
          <p className="text-sm text-ink-300">{job.company}</p>
          <p className="mt-1 text-xs text-ink-500">
            {job.location} · {job.source}
            {money(job) ? ` · ${money(job)}` : ""}
          </p>
        </div>
        <button onClick={onClose} className="rounded px-2 py-1 text-ink-500 hover:bg-ink-800">✕</button>
      </div>

      <div className="flex flex-wrap gap-1.5 border-b border-ink-800 p-4">
        {STATUSES.filter((s) => s !== "archived").map((s) => (
          <button
            key={s}
            onClick={() => onTrack(job, { status: s })}
            className={`rounded px-2 py-1 text-xs transition ${
              job.status === s ? STATUS_CLASS[s] : "bg-ink-850 text-ink-500 hover:bg-ink-800"
            }`}
          >
            {s}
          </button>
        ))}
        <button
          onClick={() => onTrack(job, { starred: !job.starred })}
          className={`ml-auto rounded px-2 py-1 text-xs ${job.starred ? "bg-accent/20 text-accent" : "bg-ink-850 text-ink-500"}`}
        >
          ★ star
        </button>
      </div>

      <div className="space-y-4 p-5">
        <a
          href={job.url}
          target="_blank"
          rel="noreferrer"
          className="block rounded-md bg-accent px-3 py-2 text-center text-sm font-medium text-ink-950 hover:brightness-110"
        >
          Open posting ↗
        </a>

        {job.fit_reasons.length > 0 && (
          <section>
            <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">
              Why {job.fit_score}
            </h3>
            <ul className="space-y-1 text-sm text-ink-300">
              {job.fit_reasons.map((r) => <li key={r}>· {r}</li>)}
            </ul>
          </section>
        )}

        {job.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {job.tags.slice(0, 18).map((t) => (
              <span key={t} className="rounded bg-ink-850 px-1.5 py-0.5 text-xs text-ink-300">{t}</span>
            ))}
          </div>
        )}

        <section>
          <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">
            Application draft
          </h3>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => onTrack(job, { draft })}
            rows={10}
            placeholder="Write the message you will send…"
            className="w-full resize-y rounded-md border border-ink-700 bg-ink-850 p-3 text-sm outline-none placeholder:text-ink-500 focus:border-accent"
          />
          <div className="mt-1.5 flex gap-2">
            <button
              onClick={() => { navigator.clipboard.writeText(draft); }}
              className="rounded bg-ink-800 px-2 py-1 text-xs text-ink-300 hover:bg-ink-700"
            >
              Copy
            </button>
            <button
              onClick={() => { onTrack(job, { draft, status: "drafted" }); }}
              className="rounded bg-ink-800 px-2 py-1 text-xs text-ink-300 hover:bg-ink-700"
            >
              Save &amp; mark drafted
            </button>
          </div>
        </section>

        <section>
          <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">Notes</h3>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={() => onTrack(job, { notes })}
            rows={3}
            className="w-full resize-y rounded-md border border-ink-700 bg-ink-850 p-3 text-sm outline-none focus:border-accent"
          />
        </section>

        {job.description && (
          <section>
            <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">Posting</h3>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink-300">
              {job.description.slice(0, 2500)}
            </p>
          </section>
        )}
      </div>
    </aside>
  );
}
