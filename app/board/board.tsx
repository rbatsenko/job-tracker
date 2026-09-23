"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import ProfileForm from "@/components/profile-form";
import Select from "@/components/select";
import { ScopeTag, money } from "@/components/bits";
import { COUNTRY_OPTIONS } from "@/lib/countries";
import { addFromBoard, trackedOrigins } from "@/lib/my-jobs";
import { SOURCE_INFO, sourceName } from "@/lib/sources/info";
import {
  BLANK_PROFILE,
  clearProfile,
  readProfile,
  saveProfile,
  toScoringProfile,
  type ViewerProfile,
} from "@/lib/viewer-profile";
import type { Job } from "@/lib/types";

const searchInput =
  "h-11 rounded-field border border-line bg-raised px-3.5 text-base outline-none focus:border-brand";

type Payload = {
  jobs: Job[];
  facets: { sources: { source: string; n: number }[]; total: number };
  query: { scored: boolean; matched: number };
};

const PAGE = 50;

export default function Board() {
  const [data, setData] = useState<Payload | null>(null);
  const [tracked, setTracked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [scope, setScope] = useState("reachable");
  const [source, setSource] = useState("all");
  const [sort, setSort] = useState("newest");
  // "Show more" only applies to the filters it was pressed under; any change starts from the first page.
  const [more, setMore] = useState({ key: "", limit: PAGE });

  // No profile, no scores. Wait for localStorage before the first fetch so a ranked view never flashes.
  const [profile, setProfile] = useState<ViewerProfile | null>(null);
  const [ready, setReady] = useState(false);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    const p = readProfile();
    setProfile(p);
    if (p) setSort("score");
    setTracked(trackedOrigins());
    setReady(true);
  }, []);

  const filterKey = JSON.stringify([q, scope, source, sort, profile]);
  const limit = more.key === filterKey ? more.limit : PAGE;

  const load = useCallback(async () => {
    const params = new URLSearchParams({ scope, source, sort, limit: String(limit) });
    if (q) params.set("q", q);

    const res = profile
      ? await fetch(`/api/jobs?${params}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ profile: toScoringProfile(profile) }),
        })
      : await fetch(`/api/jobs?${params}`, { cache: "no-store" });

    setData((await res.json()) as Payload);
  }, [q, scope, source, sort, profile, limit]);

  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(load, q ? 250 : 0);
    return () => clearTimeout(t);
  }, [load, q, ready]);

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
      fit_score: scored ? j.fit_score : null,
      fit_reasons: scored ? j.fit_reasons : [],
    });
    setTracked(trackedOrigins());
  };

  const scored = Boolean(profile) && Boolean(data?.query?.scored);
  const rows = useMemo(() => data?.jobs ?? [], [data]);
  const matched = data?.query.matched ?? 0;

  return (
    <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-5 sm:py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Find jobs</h1>
          <p className="mt-1.5 text-base text-soft">
            {data ? `${data.facets.total} remote listings from ${Object.keys(SOURCE_INFO).length} job boards` : " "}
          </p>
        </div>
        <div className="flex w-full items-center gap-3 sm:w-auto">
          {note && <span className="text-sm text-soft">{note}</span>}
          <button
            onClick={refresh}
            disabled={busy}
            className="h-11 w-full whitespace-nowrap rounded-field bg-brand px-5 text-base font-semibold text-brand-text transition hover:brightness-110 disabled:opacity-50 sm:w-auto"
          >
            {busy ? "Fetching…" : "Fetch new jobs"}
          </button>
        </div>
      </div>

      {editing && (
        <ProfileForm
          initial={profile}
          onCancel={() => setEditing(false)}
          onSave={(p) => {
            saveProfile(p);
            setProfile(p);
            setSort("score");
            setEditing(false);
          }}
          onClear={() => {
            clearProfile();
            setProfile(null);
            setSort("newest");
            setEditing(false);
          }}
        />
      )}

      {ready && !editing && (
        <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="text-sm text-faint">Rank for</span>

          <div role="radiogroup" aria-label="Rank jobs for" className="flex gap-0.5 rounded-field border border-line bg-sunken p-1">
            <button
              role="radio"
              aria-checked={!profile}
              onClick={() => {
                clearProfile();
                setProfile(null);
                setSort("newest");
              }}
              className={`h-9 rounded-md px-3.5 text-[0.9375rem] font-medium transition ${
                !profile ? "bg-raised text-text shadow-sm" : "text-faint hover:text-soft"
              }`}
            >
              Nothing
            </button>
            {(["engineering", "design"] as const).map((k) => (
              <button
                key={k}
                role="radio"
                aria-checked={profile?.basedOn === k}
                onClick={() => {
                  const next: ViewerProfile = {
                    ...(profile ?? BLANK_PROFILE),
                    basedOn: k,
                    label: k === "design" ? "Design" : "Engineering",
                    coreStack: profile?.basedOn === k ? (profile?.coreStack ?? []) : [],
                  };
                  saveProfile(next);
                  setProfile(next);
                  setSort("score");
                }}
                className={`h-9 rounded-md px-3.5 text-[0.9375rem] font-medium transition ${
                  profile?.basedOn === k ? "bg-raised text-text shadow-sm" : "text-faint hover:text-soft"
                }`}
              >
                {k === "design" ? "Design" : "Engineering"}
              </button>
            ))}
          </div>

          <button
            onClick={() => setEditing(true)}
            className="h-9 rounded-md px-2 text-sm font-medium text-brand underline-offset-4 hover:underline"
          >
            {profile ? "Fine-tune" : "Set where you can work"}
          </button>

          {profile && (
            <span className="text-sm text-faint">
              {profile.reach.regions.includes("worldwide")
                ? "anywhere remote"
                : profile.reach.regions.map((r) => r.toUpperCase()).join(", ")}
              {profile.money.floor > 0 ? `, from ${profile.money.floor.toLocaleString()} ${profile.money.currency}` : ""}
            </span>
          )}
        </div>
      )}

      <div className="mb-6 grid grid-cols-2 gap-2.5 sm:flex sm:flex-wrap sm:items-center sm:gap-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search company, role, stack"
          className={`${searchInput} col-span-2 sm:w-72`}
          aria-label="Search"
        />
        <Select
          label="Location"
          className="w-full sm:w-52"
          value={scope}
          onChange={setScope}
          options={[
            { value: "reachable", label: "Not US-only" },
            { value: "all", label: "Anywhere" },
            { value: "worldwide", label: "Remote worldwide" },
            { value: "eu", label: "Remote in Europe" },
            { value: "unknown", label: "Location not stated" },
            ...COUNTRY_OPTIONS.map((c) => ({ value: c.code, label: c.name, group: "Country" })),
          ]}
        />
        <Select
          label="Board"
          className="w-full sm:w-48"
          value={source}
          onChange={setSource}
          options={[
            { value: "all", label: "All boards" },
            ...(data?.facets.sources ?? []).map((s) => ({
              value: s.source,
              label: sourceName(s.source),
              hint: String(s.n),
            })),
          ]}
        />
        <Select
          label="Sort"
          className="w-full sm:w-40"
          value={sort}
          onChange={setSort}
          options={[
            { value: "newest", label: "Newest" },
            { value: "company", label: "Company" },
            ...(scored ? [{ value: "score", label: "Best fit" }] : []),
          ]}
        />
        <span className="col-span-2 text-sm text-faint sm:ml-auto">
          {rows.length < matched ? `${rows.length} of ${matched}` : `${matched} ${matched === 1 ? "job" : "jobs"}`}
        </span>
      </div>

      <ul className="overflow-hidden rounded-card border border-line bg-raised shadow-[var(--shadow)]">
        {rows.map((j, i) => {
          const key = `${j.source}:${j.external_id}`;
          const have = tracked.has(key);
          return (
            <li
              key={j.id}
              className={`flex flex-wrap items-start gap-x-4 gap-y-3 px-4 py-4 sm:flex-nowrap sm:items-center sm:gap-5 sm:px-5 ${i > 0 ? "border-t border-line" : ""}`}
            >
              {scored && (
                <span
                  className={`mt-0.5 w-11 shrink-0 rounded-md py-1.5 text-center text-base font-semibold tabular-nums sm:mt-0 ${
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
              )}

              <a
                href={j.url}
                target="_blank"
                rel="noopener"
                className={`group min-w-0 flex-1 ${scored ? "basis-[calc(100%-4rem)]" : "basis-full"} sm:basis-auto`}
              >
                <span className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
                  <span className="text-lg font-semibold leading-snug group-hover:underline">{j.title}</span>
                  <span className="truncate text-base text-soft">{j.company}</span>
                </span>
                <span className="mt-1.5 flex flex-wrap items-center gap-2.5 text-sm text-faint">
                  <ScopeTag scope={j.remote_scope} />
                  {money(j) && <span className="text-soft">{money(j)}</span>}
                  <span className="truncate">{j.location}</span>
                  <span>via {sourceName(j.source)}</span>
                </span>
              </a>

              <button
                onClick={() => add(j)}
                disabled={have}
                className={`h-11 w-full shrink-0 whitespace-nowrap rounded-field px-4 text-base font-medium transition sm:w-auto ${
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

      {rows.length < matched && (
        <div className="mt-5 flex flex-col items-center gap-2">
          <button
            onClick={() => setMore({ key: filterKey, limit: limit + PAGE })}
            className="h-11 rounded-field border border-line px-5 text-base font-medium text-soft transition hover:bg-sunken hover:text-text"
          >
            Show {Math.min(PAGE, matched - rows.length)} more
          </button>
          <span className="text-sm text-faint">
            {rows.length} of {matched} shown
          </span>
        </div>
      )}
    </main>
  );
}
