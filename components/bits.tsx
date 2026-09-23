"use client";

import Select from "./select";
import { countryName } from "@/lib/countries";
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

const STAGE_SWATCH: Record<string, string> = {
  new: "var(--quiet)",
  shortlist: "var(--live)",
  drafted: "var(--live)",
  applied: "var(--live)",
  replied: "var(--live)",
  interviewing: "var(--live)",
  offer: "var(--won)",
  rejected: "var(--closed)",
  archived: "var(--quiet)",
};

export function StagePicker({
  value,
  onChange,
  className,
  id,
}: {
  value: Status;
  onChange: (s: Status) => void;
  className?: string;
  id?: string;
}) {
  return (
    <Select
      label="Stage"
      id={id}
      className={className}
      value={value}
      onChange={(v) => onChange(v as Status)}
      options={STATUSES.map((s) => ({
        value: s,
        label: stageLabel(s),
        swatch: STAGE_SWATCH[s],
      }))}
    />
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

const FIXED: Record<string, string> = {
  worldwide: "Remote worldwide",
  eu: "Remote in Europe",
  us: "US only",
  other: "On-site",
  unknown: "Location not stated",
};

export const scopeLabel = (scope: string) => FIXED[scope] ?? countryName(scope);

export function ScopeTag({ scope }: { scope: string }) {
  const bad = scope === "us" || scope === "other";
  return (
    <span
      className={`inline-flex h-7 items-center rounded-md px-2.5 text-sm ${
        bad ? "bg-sunken text-faint" : "bg-brand-soft text-brand"
      }`}
    >
      {scopeLabel(scope)}
    </span>
  );
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/**
 * How long a job has been waiting, which is the thing that actually stings.
 *
 * Counts calendar days in the viewer's own timezone, not elapsed 24-hour
 * periods: something you applied to yesterday evening should say "yesterday"
 * this morning, not "today". Rounding absorbs the 23- and 25-hour days that
 * daylight saving produces.
 */
export function sinceLabel(iso: string | null | undefined) {
  if (!iso) return null;
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return null;

  const days = Math.round((startOfDay(new Date()) - startOfDay(then)) / 86_400_000);
  if (days < 0) return null;
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;

  const months = Math.max(1, Math.round(days / 30.44));
  return `${months} month${months > 1 ? "s" : ""} ago`;
}
