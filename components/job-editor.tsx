"use client";

import { useEffect, useId, useState } from "react";
import { StagePicker } from "./bits";
import { input, label, textarea, secondaryButton } from "./styles";
import type { MyJob } from "@/lib/my-jobs";

type Props = {
  job: MyJob;
  onChange: (patch: Partial<MyJob>) => void;
  onDelete: () => void;
  onClose: () => void;
};

type TextKey = "company" | "title" | "url" | "location" | "next_action" | "draft" | "notes";

/** Edits save on blur, so typing doesn't write to storage on every keystroke. */
export default function JobEditor({ job, onChange, onDelete, onClose }: Props) {
  const id = useId();
  const [values, setValues] = useState(job);
  const [confirming, setConfirming] = useState(false);
  useEffect(() => setValues(job), [job]);

  const bind = (key: TextKey) => ({
    id: `${id}-${key}`,
    value: values[key] ?? "",
    onChange: (e: { target: { value: string } }) => setValues((v) => ({ ...v, [key]: e.target.value })),
    onBlur: () => values[key] !== job[key] && onChange({ [key]: values[key] }),
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
            {field("location", "Location")}
            <div>
              <label className={label} htmlFor={`${id}-stage`}>Stage</label>
              <StagePicker id={`${id}-stage`} value={job.status} onChange={(status) => onChange({ status })} />
            </div>
            {field("next_action", "What's next", "Follow up on Friday")}
          </div>

          <div>
            <label className={label} htmlFor={`${id}-draft`}>Your message to them</label>
            <textarea rows={9} className={textarea} placeholder="Write what you'll send." {...bind("draft")} />
            {values.draft && (
              <button
                onClick={() => navigator.clipboard.writeText(values.draft ?? "").catch(() => {})}
                className="mt-2 h-9 rounded-md border border-line px-3 text-sm text-soft hover:bg-raised"
              >
                Copy message
              </button>
            )}
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
