"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ScopePicker, StagePicker, scopeAfterLocationEdit } from "./bits";
import SalaryFields, { fromDraft, toDraft, type SalaryDraft } from "./salary-fields";
import { input, label, textarea, secondaryButton } from "./styles";
import type { MyJob } from "@/lib/my-jobs";

type JobEditorProps = {
  job: MyJob;
  onChange: (patch: Partial<MyJob>) => void;
  onDelete: () => void;
  onClose: () => void;
};

const TEXT_KEYS = ["company", "title", "url", "location", "next_action", "draft", "notes"] as const;
type TextKey = (typeof TEXT_KEYS)[number];

const sameDraft = (a: SalaryDraft, b: SalaryDraft) =>
  a.min === b.min && a.max === b.max && a.currency === b.currency && a.period === b.period;

const pad = (n: number) => String(n).padStart(2, "0");
const dayOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
/** A timestamp as the viewer's local calendar day, the value a date input takes. */
const toDay = (iso: string | null) => (iso && !Number.isNaN(Date.parse(iso)) ? dayOf(new Date(iso)) : "");
/** Local noon, so the day doesn't slip when read back in another timezone. */
const fromDay = (day: string) => (day ? new Date(`${day}T12:00:00`).toISOString() : null);

/** Edits save on blur, so typing doesn't write to storage on every keystroke. */
export default function JobEditor({ job, onChange, onDelete, onClose }: JobEditorProps) {
  const id = useId();
  const [values, setValues] = useState(job);
  const [salary, setSalary] = useState(() => toDraft(job));
  const [appliedDay, setAppliedDay] = useState(() => toDay(job.applied_at));
  const [confirming, setConfirming] = useState(false);

  // A sync or a save re-reads the list, so `job` arrives as a fresh object even
  // when nothing changed. Fields still being edited keep what's typed; the rest
  // take the new values. Otherwise switching tabs mid-sentence lost the sentence.
  const shown = useRef(job);
  useEffect(() => {
    const before = shown.current;
    shown.current = job;
    setValues((v) => {
      const next = { ...job };
      for (const key of TEXT_KEYS) {
        if (v[key] !== before[key]) (next as Record<TextKey, string | null>)[key] = v[key];
      }
      return next;
    });
    setSalary((s) => (sameDraft(s, toDraft(before)) ? toDraft(job) : s));
    setAppliedDay((d) => (d === toDay(before.applied_at) ? toDay(job.applied_at) : d));
  }, [job]);

  const saveSalary = (draft: SalaryDraft) => {
    const next = fromDraft(draft);
    if ((Object.keys(next) as (keyof typeof next)[]).some((k) => next[k] !== job[k])) onChange(next);
  };

  const bind = (key: TextKey) => ({
    id: `${id}-${key}`,
    value: values[key] ?? "",
    onChange: (e: { target: { value: string } }) => setValues((v) => ({ ...v, [key]: e.target.value })),
    onBlur: () =>
      values[key] !== job[key] &&
      onChange({
        [key]: values[key],
        // Where follows the location unless it was picked by hand.
        ...(key === "location" && {
          remote_scope: scopeAfterLocationEdit(job.remote_scope, job.location, values.location),
        }),
      }),
  });

  const field = (key: TextKey, text: string, placeholder?: string) => (
    <div>
      <label className={label} htmlFor={`${id}-${key}`}>{text}</label>
      <input className={input} placeholder={placeholder} {...bind(key)} />
    </div>
  );

  return (
    <div className="border-t border-line bg-sunken px-4 py-5 sm:px-5 sm:py-6">
      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {field("company", "Company")}
            {field("title", "Role")}
            {field("url", "Link")}
            {field("location", "Location", "Remote, Berlin…")}
            <div>
              <label className={label} htmlFor={`${id}-scope`}>Where</label>
              <ScopePicker
                id={`${id}-scope`}
                value={job.remote_scope}
                onChange={(remote_scope) => remote_scope !== job.remote_scope && onChange({ remote_scope })}
              />
            </div>
            <div>
              <label className={label} htmlFor={`${id}-stage`}>Stage</label>
              <StagePicker id={`${id}-stage`} value={job.status} onChange={(status) => onChange({ status })} />
            </div>
            <div>
              <label className={label} htmlFor={`${id}-applied`}>Applied on</label>
              <input
                id={`${id}-applied`}
                type="date"
                className={input}
                max={dayOf(new Date())}
                value={appliedDay}
                onChange={(e) => setAppliedDay(e.target.value)}
                onBlur={() => appliedDay !== toDay(job.applied_at) && onChange({ applied_at: fromDay(appliedDay) })}
              />
            </div>
            {field("next_action", "What's next", "Follow up on Friday")}
            <SalaryFields id={`${id}-salary`} value={salary} onChange={setSalary} onCommit={saveSalary} />
          </div>

          <div>
            <label className={label} htmlFor={`${id}-draft`}>Your message to them</label>
            <textarea rows={9} className={textarea} placeholder="Write what you'll send." {...bind("draft")} />
            {values.draft && <CopyButton text={values.draft} fieldId={`${id}-draft`} />}
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className={label} htmlFor={`${id}-notes`}>Notes</label>
            <textarea rows={5} className={textarea} {...bind("notes")} />
          </div>

          {job.fit_reasons.length > 0 && (
            <div className="rounded-field border border-line bg-raised p-4">
              <p className="mb-2 text-sm font-medium text-soft">Scored {job.fit_score} when you added it</p>
              <ul className="list-disc space-y-1 pl-5 text-sm text-soft">
                {job.fit_reasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => onChange({ starred: !job.starred })}
              className={job.starred ? "h-11 rounded-field bg-brand-soft px-4 text-base font-medium text-brand" : secondaryButton}
            >
              ★ {job.starred ? "Starred" : "Star"}
            </button>
            {job.url && (
              <a href={job.url} target="_blank" rel="noopener" className={`${secondaryButton} flex items-center`}>
                Open posting
              </a>
            )}
            <button onClick={onClose} className={secondaryButton}>Close</button>
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
              <button
                onClick={() => setConfirming(true)}
                className="text-sm text-faint underline-offset-4 hover:text-closed hover:underline"
              >
                Remove this job
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

type CopyButtonProps = {
  text: string;
  /** The field holding the text, selected when the clipboard is blocked so it can be copied by hand. */
  fieldId: string;
};

/** Flips to "Copied" for a moment, so a click never goes unanswered. */
function CopyButton({ text, fieldId }: CopyButtonProps) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  async function copy() {
    clearTimeout(timer.current);
    try {
      await navigator.clipboard.writeText(text);
      setState("copied");
      timer.current = setTimeout(() => setState("idle"), 2000);
    } catch {
      setState("failed");
      const field = document.getElementById(fieldId);
      if (field instanceof HTMLTextAreaElement) field.select();
    }
  }

  // A width can only transition between two numbers, so the button takes its
  // label's measured width; the observer also catches the web font swapping in.
  const buttonRef = useRef<HTMLButtonElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);
  const [width, setWidth] = useState<number>();
  useEffect(() => {
    const button = buttonRef.current;
    const label = labelRef.current;
    if (!button || !label) return;
    const observer = new ResizeObserver(() =>
      setWidth(label.offsetWidth + button.offsetWidth - button.clientWidth),
    );
    observer.observe(label);
    return () => observer.disconnect();
  }, []);

  const copied = state === "copied";
  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
      <button
        ref={buttonRef}
        type="button"
        onClick={copy}
        style={{
          width,
          transition:
            "width 350ms cubic-bezier(0.2, 0.8, 0.2, 1), color 300ms, background-color 300ms, border-color 300ms, scale 150ms",
        }}
        className={`inline-flex h-9 items-center justify-center overflow-hidden rounded-md border text-sm font-medium active:scale-95 ${
          copied
            ? "border-brand bg-brand-soft text-brand"
            : "border-line text-soft hover:border-line-strong hover:bg-raised hover:text-text"
        }`}
      >
        <span ref={labelRef} className="shrink-0 whitespace-nowrap px-3">
          <span key={String(copied)} className="inline-flex animate-[tip-in_250ms_ease-out] items-center gap-1.5">
            <svg aria-hidden viewBox="0 0 16 16" className="h-4 w-4 shrink-0">
              {copied ? (
                <path d="M3.5 8.5 6.5 11.5 12.5 4.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              ) : (
                <g fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
                  <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" />
                  <path d="M10.5 3.5v-.5a1.5 1.5 0 0 0-1.5-1.5H4A1.5 1.5 0 0 0 2.5 3v5A1.5 1.5 0 0 0 4 9.5h.5" />
                </g>
              )}
            </svg>
            {copied ? "Copied" : "Copy message"}
          </span>
        </span>
      </button>
      <span role="status" className={`text-sm ${state === "failed" ? "text-closed" : "sr-only"}`}>
        {state === "failed" ? "The browser blocked the clipboard. The message is selected, so copy it by hand." : copied ? "Message copied." : ""}
      </span>
    </div>
  );
}
