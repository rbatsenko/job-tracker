"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import AddJobForm from "@/components/add-job-form";
import FeatureTip from "@/components/feature-tip";
import { ScopeTag, StageBar, money, sinceLabel, stageLabel } from "@/components/bits";
import JobEditor from "@/components/job-editor";
import SavingHelp from "@/components/saving-help";
import Select from "@/components/select";
import SyncPanel from "@/components/sync-panel";
import { card, primaryButton } from "@/components/styles";
import { STATUSES } from "@/lib/types";
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
  type MergeResult,
  type MyJob,
  type SortKey,
} from "@/lib/my-jobs";
import { push, readSync, syncAvailable, syncNow, type SyncState } from "@/lib/sync";

type Message = { tone: "ok" | "error"; text: string } | null;

const searchInput =
  "h-11 w-full rounded-field border border-line bg-raised px-3.5 text-base outline-none focus:border-brand sm:w-64";

const toolbarButton =
  "h-11 flex-1 whitespace-nowrap rounded-field border border-line px-3 text-[0.9375rem] font-medium text-soft transition hover:bg-sunken hover:text-text sm:flex-none sm:px-4 sm:text-base";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

const SYNC_FAILED = "Couldn't reach sync. Your changes are safe here and go up next time it connects.";

/** What a sync changed, or null when both copies already matched. */
function describeDrift({ added, updated, removed, ahead }: MergeResult) {
  const came = [added && plural(added, "new job"), updated && `${updated} updated`, removed && `${removed} removed`].filter(Boolean);
  const parts = [
    came.length && `brought in ${came.join(", ")} from another device`,
    ahead && `sent ${plural(ahead, "change")} it hadn't seen yet`,
  ].filter(Boolean) as string[];
  return parts.length ? `Synced: ${parts.join(" and ")}.` : null;
}

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
  const [showSync, setShowSync] = useState(false);
  const [syncState, setSyncState] = useState<SyncState | null>(null);
  const [canSync, setCanSync] = useState(false);
  const pushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [sort, setSort] = useState<SortKey>("progress");
  const [q, setQ] = useState("");
  const [stage, setStage] = useState("all");
  const [message, setMessage] = useState<Message>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setJobs(listMyJobs());
    setReady(true);
    setSyncState(readSync());
    syncAvailable().then(setCanSync);
  }, []);

  // A synced browser pulls when the page opens and whenever the tab comes back, and
  // says so when the two copies had drifted apart. In step, it stays quiet.
  useEffect(() => {
    if (!syncState) return;
    const run = () => {
      if (document.visibilityState !== "visible") return;
      syncNow(syncState.code)
        .then((merged) => {
          setJobs(listMyJobs());
          setSyncState(readSync());
          const drift = merged && describeDrift(merged);
          setMessage((m) => (drift ? { tone: "ok", text: drift } : m?.text === SYNC_FAILED ? null : m));
        })
        .catch(() => setMessage({ tone: "error", text: SYNC_FAILED }));
    };
    run();
    document.addEventListener("visibilitychange", run);
    return () => document.removeEventListener("visibilitychange", run);
  }, [syncState?.code]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Uploads shortly after the last change, so typing doesn't upload on every keystroke. */
  function schedulePush() {
    const code = readSync()?.code;
    if (!code) return;
    if (pushTimer.current) clearTimeout(pushTimer.current);
    pushTimer.current = setTimeout(() => push(code).then(() => setSyncState(readSync())).catch(() => {}), 800);
  }

  async function runSync(code: string) {
    const merged = await syncNow(code);
    setJobs(listMyJobs());
    setSyncState(readSync());
    if (!merged) return "Synced. Nothing was stored under this code before, so it starts from this list.";
    return describeDrift(merged) ?? "Synced. Both sides already matched.";
  }

  /** Applies a change, re-reads the list, and mirrors it to SQLite when running locally. */
  function sync(change?: () => void, removed?: string) {
    try {
      change?.();
      const next = listMyJobs();
      setJobs(next);
      const json = { headers: { "Content-Type": "application/json" } };
      fetch("/api/my-jobs", { method: "POST", ...json, body: JSON.stringify({ jobs: next }) }).catch(() => {});
      if (removed) fetch("/api/my-jobs", { method: "DELETE", ...json, body: JSON.stringify({ ids: [removed] }) }).catch(() => {});
      schedulePush();
    } catch (e) {
      setMessage({ tone: "error", text: e instanceof Error ? e.message : String(e) });
    }
  }

  async function importFile(file: File) {
    try {
      const added = importMyJobs(await file.text());
      sync();
      setMessage({ tone: "ok", text: added ? `Added ${plural(added, "job")}.` : "Nothing new. Existing jobs were updated." });
    } catch {
      setMessage({ tone: "error", text: "That file couldn't be read. It should be a my-jobs.json exported from here." });
    }
  }

  async function copyList() {
    try {
      await navigator.clipboard.writeText(copyForAssistant());
      setMessage({ tone: "ok", text: `Copied ${plural(jobs.length, "job")} with instructions. Paste it into ChatGPT, Claude or any assistant.` });
    } catch {
      setMessage({ tone: "error", text: "The browser blocked the clipboard. Use Export instead." });
    }
  }

  const needle = q.trim().toLowerCase();
  const shown = sortMyJobs(
    jobs.filter(
      (j) =>
        (stage === "all" || j.status === stage) &&
        (!needle || `${j.company} ${j.title} ${j.location ?? ""}`.toLowerCase().includes(needle)),
    ),
    sort,
  );
  const filtering = needle !== "" || stage !== "all";

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
          {jobs.length > 0 && (
            <>
              <button onClick={copyList} className={toolbarButton}>Copy for AI</button>
              <button onClick={() => download("my-jobs.json", exportMyJobs())} className={toolbarButton}>Export</button>
            </>
          )}
          <button onClick={() => fileInput.current?.click()} className={toolbarButton}>Import</button>
          {canSync && (
            <span className="relative flex flex-1 sm:flex-none">
              <button
                onClick={() => {
                  setShowSync((v) => !v);
                  setShowHelp(false);
                }}
                aria-expanded={showSync}
                className={`${toolbarButton} ${syncState ? "text-brand" : ""}`}
              >
                {syncState ? "Synced" : "Sync"}
              </button>
              <FeatureTip
                id="sync"
                when={ready && jobs.length > 0 && !syncState && !showSync}
                title="New: sync between devices"
                text="Keep your phone and laptop on the same list with a code. No account, and the list is encrypted before it leaves your browser."
                action="Show me"
                onAction={() => {
                  setShowSync(true);
                  setShowHelp(false);
                }}
              />
            </span>
          )}
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
            onClick={() => {
              setShowHelp((v) => !v);
              setShowSync(false);
            }}
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
      {showSync && (
        <SyncPanel
          state={syncState}
          available={canSync}
          onSync={runSync}
          onChange={() => {
            setSyncState(readSync());
            setJobs(listMyJobs());
          }}
          onClose={() => setShowSync(false)}
        />
      )}

      {!showHelp && !showSync && jobs.length > 0 && (
        <div className="mb-5 space-y-4">
          {jobs.length > 1 && (
            <div className="grid grid-cols-2 gap-2.5 sm:flex sm:flex-wrap sm:items-center sm:gap-3">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search company or role"
                aria-label="Search my jobs"
                className={`${searchInput} col-span-2`}
              />
              <Select
                label="Stage"
                className="w-full sm:w-44"
                value={stage}
                onChange={setStage}
                options={[
                  { value: "all", label: "All stages" },
                  ...STATUSES.map((s) => ({ value: s, label: stageLabel(s) })),
                ]}
              />
              <Select
                label="Sort"
                className="w-full sm:w-48"
                value={sort}
                onChange={(v) => setSort(v as SortKey)}
                options={SORTS.map((k) => ({ value: k, label: SORT_LABEL[k] }))}
              />
              {filtering && (
                <span className="col-span-2 text-sm text-faint sm:ml-auto">
                  {shown.length} of {jobs.length}
                </span>
              )}
            </div>
          )}
          <p className="text-sm text-faint">
            Export saves a file, Import merges one back in, Copy for AI copies your list with
            instructions for an assistant{canSync ? ", and Sync keeps another device in step" : ""}.
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
            sync(() => {
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
          {shown.map((job, i) => (
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
                    {job.remote_scope && job.remote_scope !== "unknown" && <ScopeTag scope={job.remote_scope} />}
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
                  onChange={(patch) => sync(() => updateMyJob(job.id, patch))}
                  onDelete={() => sync(() => removeMyJob(job.id), job.id)}
                  onClose={() => setOpenId(null)}
                />
              )}
            </li>
          ))}
          {!shown.length && (
            <li className="p-10 text-center text-base text-soft">Nothing matches. Clear the search or pick another stage.</li>
          )}
        </ul>
      )}
    </main>
  );
}
