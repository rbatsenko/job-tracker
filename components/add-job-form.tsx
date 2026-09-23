"use client";

import { useState } from "react";
import { StagePicker } from "./bits";
import { input, label, card, primaryButton, secondaryButton } from "./styles";
import type { MyJob } from "@/lib/my-jobs";
import type { Status } from "@/lib/types";

type NewJob = Partial<MyJob> & { company: string; title: string };

export default function AddJobForm({ onSave, onCancel }: { onSave: (job: NewJob) => void; onCancel: () => void }) {
  const [url, setUrl] = useState("");
  const [company, setCompany] = useState("");
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [status, setStatus] = useState<Status>("shortlist");
  const [details, setDetails] = useState<Partial<MyJob>>({});
  const [reading, setReading] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function fillFromLink(link: string) {
    if (!link.trim()) return;
    setReading(true);
    setNote(null);
    try {
      const res = await fetch("/api/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: link }),
      });
      const found = await res.json();
      if (!res.ok || !found.title) {
        setNote(found.error ?? "Couldn't read that page. Fill it in by hand.");
        return;
      }
      setUrl(found.url ?? link);
      setCompany(found.company ?? "");
      setTitle(found.title);
      setLocation(found.location ?? "");
      setDetails({
        remote_scope: found.remote_scope ?? null,
        description: found.description ?? null,
        salary_min: found.salary_min ?? null,
        salary_max: found.salary_max ?? null,
        currency: found.currency ?? null,
        salary_period: found.salary_period ?? null,
      });
      setNote(`Filled in from ${found.via}. Change anything that looks wrong.`);
    } catch {
      setNote("Couldn't reach that page. Fill it in by hand.");
    } finally {
      setReading(false);
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!company.trim() || !title.trim()) return;
        onSave({ ...details, company, title, status, url: url || null, location: location || null });
      }}
      className={`${card} mb-6 p-6`}
    >
      <h2 className="mb-5 text-xl font-semibold">Add a job</h2>

      <div className="mb-5">
        <label className={label} htmlFor="new-link">
          Paste a link
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            id="new-link"
            className={input}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onPaste={(e) => {
              const pasted = e.clipboardData.getData("text").trim();
              if (/^https?:\/\//.test(pasted)) setTimeout(() => fillFromLink(pasted));
            }}
            placeholder="https://job-boards.greenhouse.io/…"
            autoFocus
          />
          <button
            type="button"
            onClick={() => fillFromLink(url)}
            disabled={reading || !url.trim()}
            className={`${secondaryButton} shrink-0`}
          >
            {reading ? "Reading…" : "Fill it in"}
          </button>
        </div>
        <p className="mt-1.5 text-sm text-faint">
          {note ?? "Most posting links fill themselves in. If this one doesn't, type it below."}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={label} htmlFor="new-company">Company</label>
          <input id="new-company" className={input} value={company} onChange={(e) => setCompany(e.target.value)} required />
        </div>
        <div>
          <label className={label} htmlFor="new-title">Role</label>
          <input id="new-title" className={input} value={title} onChange={(e) => setTitle(e.target.value)} required />
        </div>
        <div>
          <label className={label} htmlFor="new-location">Location</label>
          <input
            id="new-location"
            className={input}
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Remote, Berlin…"
          />
        </div>
        <div>
          <label className={label} htmlFor="new-stage">Stage</label>
          <StagePicker id="new-stage" value={status} onChange={setStatus} />
        </div>
      </div>

      <div className="mt-6 flex gap-3">
        <button type="submit" className={primaryButton}>Save job</button>
        <button type="button" onClick={onCancel} className={secondaryButton}>Cancel</button>
      </div>
    </form>
  );
}
