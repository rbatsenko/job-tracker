"use client";

import { useRef, useState } from "react";
import { ScopePicker, StagePicker, scopeAfterLocationEdit } from "./bits";
import SalaryFields, { fromDraft, toDraft } from "./salary-fields";
import { input, label, card, primaryButton, secondaryButton } from "./styles";
import type { MyJob } from "@/lib/my-jobs";
import type { Status } from "@/lib/types";

type NewJob = Partial<MyJob> & { company: string; title: string };

export default function AddJobForm({ onSave, onCancel }: { onSave: (job: NewJob) => void; onCancel: () => void }) {
  const [url, setUrl] = useState("");
  const [company, setCompany] = useState("");
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [scope, setScope] = useState<string | null>(null);
  // The location Where was last worked out from, so a guess follows edits but a pick doesn't.
  const scopedFrom = useRef("");
  const [status, setStatus] = useState<Status>("shortlist");
  const [details, setDetails] = useState<Partial<MyJob>>({});
  const [salary, setSalary] = useState(() => toDraft({}));
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
      setScope(found.remote_scope && found.remote_scope !== "unknown" ? found.remote_scope : null);
      scopedFrom.current = found.location ?? "";
      setDetails({ description: found.description ?? null });
      // Only replace what's typed when the posting names a figure.
      if (found.salary_max || found.salary_min) setSalary(toDraft(found));
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
        // Enter submits without leaving the field, so settle Where here too.
        const remote_scope = scopeAfterLocationEdit(scope, scopedFrom.current, location);
        onSave({
          ...details,
          ...fromDraft(salary),
          company,
          title,
          status,
          remote_scope,
          url: url || null,
          location: location || null,
        });
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
            onBlur={() => {
              const before = scopedFrom.current;
              setScope((s) => scopeAfterLocationEdit(s, before, location));
              scopedFrom.current = location;
            }}
            placeholder="Remote, Berlin…"
          />
        </div>
        <div>
          <label className={label} htmlFor="new-scope">Where</label>
          <ScopePicker id="new-scope" value={scope} onChange={setScope} />
        </div>
        <div>
          <label className={label} htmlFor="new-stage">Stage</label>
          <StagePicker id="new-stage" value={status} onChange={setStatus} />
        </div>
        <SalaryFields id="new-salary" value={salary} onChange={setSalary} />
      </div>

      <div className="mt-6 flex gap-3">
        <button type="submit" className={primaryButton}>Save job</button>
        <button type="button" onClick={onCancel} className={secondaryButton}>Cancel</button>
      </div>
    </form>
  );
}
