"use client";

import { STATUSES, type Status } from "@/lib/types";

/** Where each stage sits in the search, and what it means for the outcome. */
export const STAGE_ORDER: Status[] = [
  "shortlist",
  "drafted",
  "applied",
  "replied",
  "interviewing",
  "offer",
];

/** Statuses are stored lowercase; they are only ever shown capitalised. */
export const stageLabel = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export const stageTone = (s: Status) =>
  s === "offer" ? "won" : s === "rejected" ? "closed" : s === "archived" || s === "new" ? "quiet" : "live";

/**
 * Stage shown as progress, not as one of nine colours: how far along, plus the
 * word. Readable without seeing colour at all.
 */
export function StageBar({ status }: { status: Status }) {
  const tone = stageTone(status);
  const idx = STAGE_ORDER.indexOf(status);
  const done = idx >= 0 ? idx + 1 : 0;
  const colour =
    tone === "won" ? "bg-won" : tone === "closed" ? "bg-closed" : tone === "quiet" ? "bg-quiet" : "bg-live";

  return (
    <span className="flex items-center gap-2.5">
      <span className="flex gap-[3px]" aria-hidden>
        {STAGE_ORDER.map((_, i) => (
          <span
            key={i}
            className={`h-1.5 w-4 rounded-full ${
              status === "rejected" || status === "archived"
                ? "bg-line"
                : i < done
                  ? colour
                  : "bg-line"
            }`}
          />
        ))}
      </span>
      <span
        className={`text-sm font-medium ${
          tone === "won" ? "text-won" : tone === "closed" ? "text-closed" : tone === "quiet" ? "text-faint" : "text-text"
        }`}
      >
        {stageLabel(status)}
      </span>
    </span>
  );
}

export function StagePicker({
  value,
  onChange,
}: {
  value: Status;
  onChange: (s: Status) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as Status)}
      aria-label="Stage"
      className="h-11 rounded-field border border-line bg-raised px-3 text-base"
    >
      {STATUSES.map((s) => (
        <option key={s} value={s}>
          {stageLabel(s)}
        </option>
      ))}
    </select>
  );
}

export function money(j: {
  salary_min?: number | null;
  salary_max?: number | null;
  currency?: string | null;
  salary_period?: string | null;
}) {
  if (!j.salary_max) return null;
  const sym = j.currency === "EUR" ? "€" : j.currency === "GBP" ? "£" : j.currency === "PLN" ? "" : "$";
  const suffix = j.currency === "PLN" ? " PLN" : "";
  const per = j.salary_period === "month" ? "/mo" : j.salary_period === "hour" ? "/h" : "";
  const k = (n: number) =>
    n >= 10_000 && j.salary_period !== "month" ? `${Math.round(n / 1000)}K` : n.toLocaleString();
  const lo = j.salary_min && j.salary_min !== j.salary_max ? `${k(j.salary_min)}–` : "";
  return `${sym}${lo}${k(j.salary_max)}${suffix}${per}`;
}

export const SCOPE_LABEL: Record<string, string> = {
  worldwide: "Remote worldwide",
  eu: "Remote in Europe",
  pl: "Poland",
  us: "US only",
  other: "On-site",
  unknown: "Unclear",
};

export function ScopeTag({ scope }: { scope: string }) {
  const bad = scope === "us" || scope === "other";
  return (
    <span
      className={`inline-flex h-7 items-center rounded-md px-2.5 text-sm ${
        bad ? "bg-sunken text-faint" : "bg-brand-soft text-brand"
      }`}
    >
      {SCOPE_LABEL[scope] ?? scope}
    </span>
  );
}

/** How long a job has been waiting, which is the thing that actually stings. */
export function sinceLabel(iso: string | null | undefined) {
  if (!iso) return null;
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  const months = Math.round(days / 30);
  return `${months} month${months > 1 ? "s" : ""} ago`;
}
