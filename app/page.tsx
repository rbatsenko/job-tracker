"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StageBar, StagePicker, ScopeTag, money, sinceLabel } from "@/components/bits";
import {
  addMyJob,
  exportMyJobs,
  importMyJobs,
  listMyJobs,
  removeMyJob,
  updateMyJob,
  type MyJob,
} from "@/lib/my-jobs";
import type { Status } from "@/lib/types";

export default function MyJobsPage() {
  const [jobs, setJobs] = useState<MyJob[]>([]);
  const [ready, setReady] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  /** Mirror to SQLite when the app runs somewhere with a real filesystem. */
  const mirror = useCallback((next: MyJob[]) => {
    fetch("/api/my-jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobs: next }),
    }).catch(() => {});
  }, []);

  const refresh = useCallback(() => {
    const next = listMyJobs();
    setJobs(next);
    mirror(next);
  }, [mirror]);

  useEffect(() => {
    setJobs(listMyJobs());
    setReady(true);
  }, []);

  const guard = (fn: () => void) => {
    try {
      fn();
      setError(null);
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const open = openId ? jobs.find((j) => j.id === openId) : null;

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const j of jobs) c[j.status] = (c[j.status] ?? 0) + 1;
    return c;
  }, [jobs]);

  const onImport = async (file: File) => {
    guard(() => {
      const text = (file as unknown as { text: () => Promise<string> }).text;
      void text;
    });
    const raw = await file.text();
    guard(() => {
      const n = importMyJobs(raw, "merge");
      setError(n === 0 ? "Nothing new in that file — everything was already here." : null);
    });
  };

  return (
    <main className="mx-auto max-w-[1400px] px-5 py-8">
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My jobs</h1>
          <p className="mt-1.5 text-base text-soft">
            {!ready
              ? " "
              : jobs.length === 0
                ? "Nothing here yet."
                : `${jobs.length} ${jobs.length === 1 ? "job" : "jobs"}${
                    counts.applied ? ` · ${counts.applied} applied` : ""
                  }${counts.interviewing ? ` · ${counts.interviewing} interviewing` : ""}`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => guard(() => void navigator.clipboard.writeText(exportMyJobs()))}
            className="h-11 rounded-field border border-line px-4 text-base font-medium text-soft transition hover:bg-sunken hover:text-text"
          >
            Copy for Claude
          </button>
          <button
            onClick={() => {
              const blob = new Blob([exportMyJobs()], { type: "application/json" });
              const a = document.createElement("a");
              a.href = URL.createObjectURL(blob);
              a.download = "my-jobs.json";
              a.click();
              URL.revokeObjectURL(a.href);
            }}
            className="h-11 rounded-field border border-line px-4 text-base font-medium text-soft transition hover:bg-sunken hover:text-text"
          >
            Export
          </button>
          <button
            onClick={() => fileRef.current?.click()}
            className="h-11 rounded-field border border-line px-4 text-base font-medium text-soft transition hover:bg-sunken hover:text-text"
          >
            Import
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onImport(f);
              e.target.value = "";
            }}
          />
          <button
            onClick={() => setAdding(true)}
            className="h-11 rounded-field bg-brand px-5 text-base font-semibold text-brand-text transition hover:brightness-110"
          >
            Add a job
          </button>
        </div>
      </div>

      {error && (
        <p className="mb-5 rounded-field border border-closed/40 bg-closed/10 px-4 py-3 text-base text-closed">
          {error}
        </p>
      )}

      {ready && jobs.length === 0 && !adding && (
        <div className="rounded-card border border-line bg-raised p-12 text-center shadow-[var(--shadow)]">
          <h2 className="text-xl font-semibold">Add the first job you are chasing</h2>
          <p className="mx-auto mt-2 max-w-md text-base text-soft">
            Paste one you found anywhere, or browse the board and add from there. Everything
            stays in this browser.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <button
              onClick={() => setAdding(true)}
              className="h-11 rounded-field bg-brand px-5 text-base font-semibold text-brand-text"
            >
              Add a job
            </button>
            <a
              href="/board"
              className="flex h-11 items-center rounded-field border border-line px-5 text-base font-medium text-soft hover:bg-sunken"
            >
              Browse the board
            </a>
          </div>
        </div>
      )}

      {adding && (
        <AddForm
          onCancel={() => setAdding(false)}
          onSave={(draft) => {
            guard(() => {
              addMyJob(draft);
              setAdding(false);
            });
          }}
        />
      )}

      {jobs.length > 0 && (
        <ul className="overflow-hidden rounded-card border border-line bg-raised shadow-[var(--shadow)]">
          {jobs.map((j, i) => (
            <li key={j.id} className={i > 0 ? "border-t border-line" : ""}>
              <button
                onClick={() => setOpenId(openId === j.id ? null : j.id)}
                className="flex w-full items-center gap-5 px-5 py-4 text-left transition hover:bg-sunken"
              >
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline gap-2.5">
                    {j.starred && <span className="text-brand">★</span>}
                    <span className="truncate text-lg font-semibold">{j.title}</span>
                    <span className="truncate text-base text-soft">{j.company}</span>
                  </span>
                  <span className="mt-1.5 flex flex-wrap items-center gap-2.5 text-sm text-faint">
                    {j.remote_scope && <ScopeTag scope={j.remote_scope} />}
                    {money(j) && <span className="text-soft">{money(j)}</span>}
                    {j.applied_at && <span>applied {sinceLabel(j.applied_at)}</span>}
                    {j.next_action && <span className="text-brand">next: {j.next_action}</span>}
                  </span>
                </span>
                <StageBar status={j.status} />
              </button>

              {openId === j.id && (
                <Editor
                  job={j}
                  onChange={(patch) => guard(() => void updateMyJob(j.id, patch))}
                  onDelete={() => guard(() => void removeMyJob(j.id))}
                  onClose={() => setOpenId(null)}
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

const field =
  "h-11 w-full rounded-field border border-line bg-bg px-3.5 text-base outline-none focus:border-brand";
const label = "mb-1.5 block text-sm font-medium text-soft";

function AddForm({
  onSave,
  onCancel,
}: {
  onSave: (j: { company: string; title: string; url?: string | null; location?: string | null; status?: Status }) => void;
  onCancel: () => void;
}) {
  const [company, setCompany] = useState("");
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [location, setLocation] = useState("");
  const [status, setStatus] = useState<Status>("shortlist");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!company.trim() || !title.trim()) return;
        onSave({ company, title, url: url || null, location: location || null, status });
      }}
      className="mb-6 rounded-card border border-line bg-raised p-6 shadow-[var(--shadow)]"
    >
      <h2 className="mb-5 text-xl font-semibold">Add a job</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={label} htmlFor="c">Company</label>
          <input id="c" className={field} value={company} onChange={(e) => setCompany(e.target.value)} autoFocus required />
        </div>
        <div>
          <label className={label} htmlFor="t">Role</label>
          <input id="t" className={field} value={title} onChange={(e) => setTitle(e.target.value)} required />
        </div>
        <div>
          <label className={label} htmlFor="u">Link</label>
          <input id="u" className={field} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" />
        </div>
        <div>
          <label className={label} htmlFor="l">Location</label>
          <input id="l" className={field} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Remote, Kraków…" />
        </div>
        <div>
          <label className={label} htmlFor="s">Stage</label>
          <StagePicker value={status} onChange={setStatus} />
        </div>
      </div>
      <div className="mt-6 flex gap-3">
        <button type="submit" className="h-11 rounded-field bg-brand px-5 text-base font-semibold text-brand-text">
          Save job
        </button>
        <button type="button" onClick={onCancel} className="h-11 rounded-field border border-line px-5 text-base font-medium text-soft hover:bg-sunken">
          Cancel
        </button>
      </div>
    </form>
  );
}

function Editor({
  job,
  onChange,
  onDelete,
  onClose,
}: {
  job: MyJob;
  onChange: (patch: Partial<MyJob>) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [local, setLocal] = useState(job);
  const [confirming, setConfirming] = useState(false);
  useEffect(() => setLocal(job), [job]);

  const set = <K extends keyof MyJob>(k: K, v: MyJob[K]) => setLocal((p) => ({ ...p, [k]: v }));
  const commit = (k: keyof MyJob) => onChange({ [k]: local[k] } as Partial<MyJob>);

  return (
    <div className="border-t border-line bg-sunken px-5 py-6">
      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={label}>Company</label>
              <input className={field} value={local.company} onChange={(e) => set("company", e.target.value)} onBlur={() => commit("company")} />
            </div>
            <div>
              <label className={label}>Role</label>
              <input className={field} value={local.title} onChange={(e) => set("title", e.target.value)} onBlur={() => commit("title")} />
            </div>
            <div>
              <label className={label}>Link</label>
              <input className={field} value={local.url ?? ""} onChange={(e) => set("url", e.target.value)} onBlur={() => commit("url")} />
            </div>
            <div>
              <label className={label}>Location</label>
              <input className={field} value={local.location ?? ""} onChange={(e) => set("location", e.target.value)} onBlur={() => commit("location")} />
            </div>
            <div>
              <label className={label}>Stage</label>
              <StagePicker value={local.status} onChange={(s) => onChange({ status: s })} />
            </div>
            <div>
              <label className={label}>What is next</label>
              <input className={field} value={local.next_action ?? ""} onChange={(e) => set("next_action", e.target.value)} onBlur={() => commit("next_action")} placeholder="Follow up on Friday" />
            </div>
          </div>

          <div>
            <label className={label}>Your message to them</label>
            <textarea
              rows={9}
              className="w-full resize-y rounded-field border border-line bg-bg p-3.5 text-base leading-relaxed outline-none focus:border-brand"
              value={local.draft ?? ""}
              onChange={(e) => set("draft", e.target.value)}
              onBlur={() => commit("draft")}
              placeholder="Write what you will send."
            />
            {local.draft && (
              <button
                onClick={() => navigator.clipboard.writeText(local.draft ?? "")}
                className="mt-2 h-9 rounded-md border border-line px-3 text-sm text-soft hover:bg-raised"
              >
                Copy message
              </button>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className={label}>Notes</label>
            <textarea
              rows={5}
              className="w-full resize-y rounded-field border border-line bg-bg p-3.5 text-base outline-none focus:border-brand"
              value={local.notes ?? ""}
              onChange={(e) => set("notes", e.target.value)}
              onBlur={() => commit("notes")}
            />
          </div>

          {local.fit_reasons.length > 0 && (
            <div className="rounded-field border border-line bg-raised p-4">
              <p className="mb-2 text-sm font-medium text-soft">
                Scored {local.fit_score} when it came off the board
              </p>
              <ul className="space-y-1 text-sm text-soft">
                {local.fit_reasons.map((r) => <li key={r}>— {r}</li>)}
              </ul>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => onChange({ starred: !job.starred })}
              className={`h-11 rounded-field px-4 text-base font-medium ${job.starred ? "bg-brand-soft text-brand" : "border border-line text-soft hover:bg-raised"}`}
            >
              ★ {job.starred ? "Starred" : "Star"}
            </button>
            {local.url && (
              <a
                href={local.url}
                target="_blank"
                rel="noreferrer"
                className="flex h-11 items-center rounded-field border border-line px-4 text-base font-medium text-soft hover:bg-raised"
              >
                Open posting
              </a>
            )}
            <button onClick={onClose} className="h-11 rounded-field border border-line px-4 text-base font-medium text-soft hover:bg-raised">
              Close
            </button>
          </div>

          <div className="border-t border-line pt-4">
            {confirming ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-soft">Remove this job?</span>
                <button onClick={onDelete} className="h-9 rounded-md bg-closed px-3 text-sm font-semibold text-white">
                  Remove
                </button>
                <button onClick={() => setConfirming(false)} className="h-9 rounded-md border border-line px-3 text-sm text-soft">
                  Keep
                </button>
              </div>
            ) : (
              <button onClick={() => setConfirming(true)} className="text-sm text-faint underline-offset-4 hover:text-closed hover:underline">
                Remove this job
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
