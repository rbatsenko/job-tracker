"use client";

import Select from "./select";
import { COUNTRY_OPTIONS, countryName } from "@/lib/countries";
import { inferScope } from "@/lib/score";
import { STATUSES, type Status } from "@/lib/types";

const PIPELINE: Status[] = ["shortlist", "drafted", "applied", "replied", "interviewing", "offer"];

type Tone = "live" | "won" | "closed" | "quiet";

const TONE: Record<Status, Tone> = {
  new: "quiet",
  shortlist: "live",
  drafted: "live",
  applied: "live",
  replied: "live",
  interviewing: "live",
  offer: "won",
  rejected: "closed",
  archived: "quiet",
};

const TONE_STYLE: Record<Tone, { bar: string; text: string; swatch: string }> = {
  live: { bar: "bg-live", text: "text-text", swatch: "var(--live)" },
  won: { bar: "bg-won", text: "text-won", swatch: "var(--won)" },
  closed: { bar: "bg-closed", text: "text-closed", swatch: "var(--closed)" },
  quiet: { bar: "bg-quiet", text: "text-faint", swatch: "var(--quiet)" },
};

export const stageLabel = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Progress plus a word, so the stage reads without relying on colour. */
export function StageBar({ status }: { status: Status }) {
  const style = TONE_STYLE[TONE[status]];
  const filled = PIPELINE.indexOf(status) + 1;

  return (
    <span className="flex items-center gap-2.5">
      <span className="flex gap-[3px]" aria-hidden>
        {PIPELINE.map((stage, i) => (
          <span key={stage} className={`h-1.5 w-4 rounded-full ${i < filled ? style.bar : "bg-line"}`} />
        ))}
      </span>
      <span className={`text-sm font-medium ${style.text}`}>{stageLabel(status)}</span>
    </span>
  );
}

export function StagePicker({
  id,
  value,
  onChange,
}: {
  id?: string;
  value: Status;
  onChange: (s: Status) => void;
}) {
  return (
    <Select
      id={id}
      label="Stage"
      inset
      value={value}
      onChange={(v) => onChange(v as Status)}
      options={STATUSES.map((s) => ({ value: s, label: stageLabel(s), swatch: TONE_STYLE[TONE[s]].swatch }))}
    />
  );
}

const SYMBOL: Record<string, string> = { EUR: "€", GBP: "£", USD: "$" };

export function money(j: {
  salary_min?: number | null;
  salary_max?: number | null;
  currency?: string | null;
  salary_period?: string | null;
}) {
  if (!j.salary_max && !j.salary_min) return null;
  const monthly = j.salary_period === "month";
  const short = (n: number) => (n >= 10_000 && !monthly ? `${Math.round(n / 1000)}K` : n.toLocaleString());
  const range = !j.salary_max
    ? `${short(j.salary_min!)}+`
    : j.salary_min && j.salary_min !== j.salary_max
      ? `${short(j.salary_min)}-${short(j.salary_max)}`
      : short(j.salary_max);
  const per = monthly ? "/mo" : j.salary_period === "hour" ? "/h" : "";
  const symbol = SYMBOL[j.currency ?? "USD"];
  return symbol ? `${symbol}${range}${per}` : `${range} ${j.currency}${per}`;
}

const SCOPE_LABEL: Record<string, string> = {
  worldwide: "Remote worldwide",
  eu: "Remote in Europe",
  us: "US only",
  unknown: "Location not stated",
};

export const scopeLabel = (scope: string) => SCOPE_LABEL[scope] ?? countryName(scope);

export function ScopeTag({ scope }: { scope: string }) {
  const outOfReach = scope === "us";
  return (
    <span
      className={`inline-flex h-7 items-center rounded-md px-2.5 text-sm ${
        outOfReach ? "bg-sunken text-faint" : "bg-brand-soft text-brand"
      }`}
    >
      {scopeLabel(scope)}
    </span>
  );
}

const SCOPE_OPTIONS = [
  { value: "unknown", label: "Not stated" },
  { value: "worldwide", label: "Remote worldwide" },
  { value: "eu", label: "Remote in Europe" },
  { value: "us", label: "US only" },
  ...COUNTRY_OPTIONS.map((c) => ({ value: c.code, label: c.name, group: "Country" })),
];

/** The reach tag shown in the list. "Not stated" saves as no tag at all. */
export function ScopePicker({
  id,
  value,
  onChange,
}: {
  id?: string;
  value: string | null;
  onChange: (scope: string | null) => void;
}) {
  return (
    <Select
      id={id}
      label="Where"
      inset
      value={value ?? "unknown"}
      onChange={(v) => onChange(v === "unknown" ? null : v)}
      options={SCOPE_OPTIONS}
    />
  );
}

const guessScope = (location: string | null | undefined) => {
  const scope = inferScope(location);
  return scope === "unknown" ? null : scope;
};

/**
 * The reach to keep after the location changes. It follows the location while
 * it's unset or still the guess from the old text; a hand-picked one stays.
 */
export function scopeAfterLocationEdit(scope: string | null, before: string | null, after: string | null) {
  const followed = !scope || scope === "unknown" || scope === guessScope(before);
  return followed ? guessScope(after) : scope;
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/** Calendar days in the viewer's timezone, so last night reads "yesterday" this morning. */
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
