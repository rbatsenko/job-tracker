import { card, secondaryButton } from "./styles";

const code = "rounded bg-sunken px-1.5 py-0.5";

const EXAMPLE = `{
  "version": 1,
  "jobs": [
    {
      "id": "mj_7f2c...",                 // keep it, or leave it out for a new job
      "company": "Acme",                  // required
      "title": "Senior Product Designer", // required
      "url": "https://acme.com/jobs/12",
      "location": "Remote (Europe)",
      "status": "applied",
      "notes": "Referred by a friend",
      "draft": "Hi — I saw you're hiring...",
      "next_action": "Follow up Friday",
      "applied_at": "2026-09-22T10:00:00.000Z"
    }
  ]
}`;

export default function SavingHelp({ onClose }: { onClose: () => void }) {
  return (
    <section className={`${card} mb-6 p-5 sm:p-6`}>
      <h2 className="text-lg font-semibold">Where your jobs are saved</h2>
      <p className="mt-2 max-w-prose text-base text-soft">
        Only in this browser. Nothing is sent to a server, so your notes and drafts stay with you — but
        they won't appear on another device, or survive clearing site data. Export is how you move them
        and how you back them up.
      </p>

      <dl className="mt-5 space-y-4 text-base">
        <div>
          <dt className="font-semibold">Export</dt>
          <dd className="mt-0.5 max-w-prose text-soft">
            Downloads <code className={code}>my-jobs.json</code> with everything: stages, notes, drafts, dates.
          </dd>
        </div>
        <div>
          <dt className="font-semibold">Import</dt>
          <dd className="mt-0.5 max-w-prose text-soft">
            Takes that file back. It merges, so a job you already have is updated rather than duplicated.
          </dd>
        </div>
        <div>
          <dt className="font-semibold">Copy for Claude</dt>
          <dd className="mt-0.5 max-w-prose text-soft">
            Copies your list with instructions for an assistant. Ask it to rank your jobs or draft a
            message; if it hands back an edited list, save it as a file and import it.
          </dd>
        </div>
      </dl>

      <h3 className="mt-7 text-base font-semibold">The file</h3>
      <p className="mt-1.5 max-w-prose text-base text-soft">
        Plain JSON. Only <strong className="text-text">company</strong> and{" "}
        <strong className="text-text">title</strong> are required, and unknown fields are ignored. Keep{" "}
        <code className={code}>id</code> when editing an existing job.
      </p>
      <pre className="scroll-thin mt-3 overflow-x-auto rounded-field border border-line bg-sunken p-4 text-sm leading-relaxed">
        {EXAMPLE}
      </pre>
      <p className="mt-3 max-w-prose text-base text-soft">
        <strong className="text-text">status</strong> is one of new, shortlist, drafted, applied, replied,
        interviewing, offer, rejected or archived. Salary goes in <code className={code}>salary_min</code>,{" "}
        <code className={code}>salary_max</code> and <code className={code}>currency</code>. The full schema is
        at{" "}
        <a href="/llms.txt" className="text-brand underline underline-offset-4">
          /llms.txt
        </a>
        , which is also what to point an assistant at.
      </p>

      <button onClick={onClose} className={`${secondaryButton} mt-5`}>
        Got it
      </button>
    </section>
  );
}
