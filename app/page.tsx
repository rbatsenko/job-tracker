"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import AddJobForm from "@/components/add-job-form";
import { ScopeTag, StageBar, money, sinceLabel } from "@/components/bits";
import JobEditor from "@/components/job-editor";
import SavingHelp from "@/components/saving-help";
import Select from "@/components/select";
import { card, primaryButton } from "@/components/styles";
import {
  SORTS,
  SORT_LABEL,
  addMyJob,
  copyForAssistant,
  exportMyJobs,
  importMyJobs,
  listMyJobs,
  removeMyJob,
  sortMyJobs,
  updateMyJob,
  type MyJob,
  type SortKey,
} from "@/lib/my-jobs";

type Message = { tone: "ok" | "error"; text: string } | null;

const toolbarButton =
  "h-11 flex-1 whitespace-nowrap rounded-field border border-line px-3 text-[0.9375rem] font-medium text-soft transition hover:bg-sunken hover:text-text sm:flex-none sm:px-4 sm:text-base";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

function download(name: string, contents: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([contents], { type: "application/json" }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

export default function MyJobsPage() {
  const [jobs, setJobs] = useState<MyJob[]>([]);
  const [ready, setReady] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [sort, setSort] = useState<SortKey>("progress");
  const [message, setMessage] = useState<Message>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setJobs(listMyJobs());
    setReady(true);
  }, []);

  /** Applies a change, re-reads the list, and mirrors it to SQLite when running locally. */
  function mutate(change: () => void) {
    try {
      change();
      const next = listMyJobs();
      setJobs(next);
      fetch("/api/my-jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobs: next }),
      }).catch(() => {});
    } catch (e) {
      setMessage({ tone: "error", text: e instanceof Error ? e.message : String(e) });
    }
  }

  async function importFile(file: File) {
    try {
      const added = importMyJobs(await file.text());
      mutate(() => {});
      setMessage({ tone: "ok", text: added ? `Added ${plural(added, "job")}.` : "Nothing new. Existing jobs were updated." });
    } catch {
      setMessage({ tone: "error", text: "That file couldn't be read. It should be a my-jobs.json exported from here." });
    }
  }

  async function copyList() {
    await navigator.clipboard.writeText(copyForAssistant());
    setMessage({ tone: "ok", text: `Copied ${plural(jobs.length, "job")} with instructions. Paste it into Claude.` });
  }

  const applied = jobs.filter((j) => j.status === "applied").length;
  const interviewing = jobs.filter((j) => j.status === "interviewing").length;
  const summary = [plural(jobs.length, "job"), applied && `${applied} applied`, interviewing && `${interviewing} interviewing`]
    .filter(Boolean)
    .join(", ");

  return (
    <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-5 sm:py-8">
      <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">My jobs</h1>
          <p className="mt-1.5 text-base text-soft">{!ready ? " " : jobs.length ? summary : "Nothing here yet."}</p>
        </div>

        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <button onClick={copyList} className={toolbarButton}>Copy for Claude</button>
          <button onClick={() => download("my-jobs.json", exportMyJobs())} className={toolbarButton}>Export</button>
          <button onClick={() => fileInput.current?.click()} className={toolbarButton}>Import</button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) importFile(file);
              e.target.value = "";
            }}
          />
          <button
            onClick={() => setShowHelp((v) => !v)}
            aria-expanded={showHelp}
            aria-label="How saving works"
            className={`${toolbarButton} w-11 flex-none`}
          >
            ?
          </button>
          <button onClick={() => setAdding(true)} className={`${primaryButton} w-full sm:w-auto`}>
            Add a job
          </button>
        </div>
      </header>

      {showHelp && <SavingHelp onClose={() => setShowHelp(false)} />}

      {!showHelp && jobs.length > 0 && (
        <div className="mb-5 space-y-4">
          {jobs.length > 1 && (
            <div className="flex items-center gap-2.5">
              <span className="shrink-0 text-sm text-faint">Sort by</span>
              <Select
                label="Sort my jobs"
                className="w-56"
                value={sort}
                onChange={(v) => setSort(v as SortKey)}
                options={SORTS.map((k) => ({ value: k, label: SORT_LABEL[k] }))}
              />
            </div>
          )}
          <p className="text-sm text-faint">
            Export saves a file, Import merges one back in, and Copy for Claude copies your list with
            instructions for an assistant.
          </p>
        </div>
      )}

      {message && (
        <p
          role="status"
          className={`mb-5 rounded-field border px-4 py-3 text-base ${
            message.tone === "ok" ? "border-brand/40 bg-brand-soft text-brand" : "border-closed/40 bg-closed/10 text-closed"
          }`}
        >
          {message.text}
        </p>
      )}

      {adding && (
        <AddJobForm
          onCancel={() => setAdding(false)}
          onSave={(job) =>
            mutate(() => {
              addMyJob(job);
              setAdding(false);
            })
          }
        />
      )}

      {ready && !jobs.length && !adding && (
        <div className={`${card} p-6 sm:p-12 sm:text-center`}>
          <h2 className="text-xl font-semibold sm:text-2xl">Add the first job you're chasing</h2>
          <p className="mt-2 max-w-md text-base text-soft sm:mx-auto">
            Paste one you found anywhere, or browse the board and add from there. Everything stays in this browser.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <button onClick={() => setAdding(true)} className={primaryButton}>Add a job</button>
            <Link
              href="/board"
              className="flex h-11 items-center justify-center rounded-field border border-line px-5 text-base font-medium text-soft hover:bg-sunken"
            >
              Browse the board
            </Link>
          </div>
        </div>
      )}

      {jobs.length > 0 && (
        <ul className={`${card} overflow-hidden`}>
          {sortMyJobs(jobs, sort).map((job, i) => (
            <li key={job.id} className={i ? "border-t border-line" : ""}>
              <button
                onClick={() => setOpenId(openId === job.id ? null : job.id)}
                aria-expanded={openId === job.id}
                className="flex w-full flex-col items-start gap-2.5 px-4 py-4 text-left transition hover:bg-sunken sm:flex-row sm:items-center sm:gap-5 sm:px-5"
              >
                <span className="w-full min-w-0 flex-1">
                  <span className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
                    {job.starred && <span className="text-brand">★</span>}
                    <span className="text-lg font-semibold leading-snug">{job.title}</span>
                    <span className="truncate text-base text-soft">{job.company}</span>
                  </span>
                  <span className="mt-1.5 flex flex-wrap items-center gap-2.5 text-sm text-faint">
                    {job.remote_scope && <ScopeTag scope={job.remote_scope} />}
                    {money(job) && <span className="text-soft">{money(job)}</span>}
                    {job.applied_at && <span>applied {sinceLabel(job.applied_at)}</span>}
                    {job.next_action && <span className="text-brand">next: {job.next_action}</span>}
                  </span>
                </span>
                <StageBar status={job.status} />
              </button>

              {openId === job.id && (
                <JobEditor
                  job={job}
                  onChange={(patch) => mutate(() => updateMyJob(job.id, patch))}
                  onDelete={() => mutate(() => removeMyJob(job.id))}
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
