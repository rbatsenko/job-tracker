"use client";

import Select from "./select";
import { input, label } from "./styles";
import type { MyJob } from "@/lib/my-jobs";
import { readProfile } from "@/lib/viewer-profile";

type Salary = Pick<MyJob, "salary_min" | "salary_max" | "currency" | "salary_period">;

/** The fields as typed, so "45." or "80 000" survive until they're saved. */
export type SalaryDraft = { min: string; max: string; currency: string; period: string };

const CURRENCIES = ["EUR", "USD", "GBP", "PLN"];
const PERIODS = [
  { value: "year", label: "per year" },
  { value: "month", label: "per month" },
  { value: "hour", label: "per hour" },
];

export function toDraft(j: Partial<Salary>): SalaryDraft {
  return {
    min: j.salary_min?.toString() ?? "",
    max: j.salary_max?.toString() ?? "",
    currency: j.currency ?? readProfile()?.money.currency ?? "EUR",
    period: j.salary_period ?? "year",
  };
}

const parse = (s: string) => {
  const n = Number(s.replace(/[\s,_]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
};

/** A lone "from" stays a minimum, so a figure never jumps between fields on save. */
export function fromDraft(d: SalaryDraft): Salary {
  let min = parse(d.min);
  let max = parse(d.max);
  if (min === null && max === null) return { salary_min: null, salary_max: null, currency: null, salary_period: null };
  if (min !== null && max !== null && min > max) [min, max] = [max, min];
  return { salary_min: min === max ? null : min, salary_max: max, currency: d.currency, salary_period: d.period };
}

type SalaryFieldsProps = {
  id: string;
  value: SalaryDraft;
  onChange: (draft: SalaryDraft) => void;
  /** Runs when a figure loses focus or a menu changes, with the draft as it now stands. */
  onCommit?: (draft: SalaryDraft) => void;
};

export default function SalaryFields({ id, value, onChange, onCommit }: SalaryFieldsProps) {
  const pick = (patch: Partial<SalaryDraft>) => {
    const next = { ...value, ...patch };
    onChange(next);
    onCommit?.(next);
  };
  const figure = (key: "min" | "max", text: string) => (
    <input
      id={key === "min" ? id : undefined}
      aria-label={`Salary ${text.toLowerCase()}`}
      className={input}
      inputMode="decimal"
      placeholder={text}
      value={value[key]}
      onChange={(e) => onChange({ ...value, [key]: e.target.value })}
      onBlur={() => onCommit?.(value)}
    />
  );

  // A posting can bring a currency or period the menus don't list; keep it choosable.
  const currencies = CURRENCIES.includes(value.currency) ? CURRENCIES : [...CURRENCIES, value.currency];
  const periods = PERIODS.some((p) => p.value === value.period)
    ? PERIODS
    : [...PERIODS, { value: value.period, label: `per ${value.period}` }];
  return (
    <div className="sm:col-span-2">
      <label className={label} htmlFor={id}>Salary</label>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_1fr_7rem_9rem]">
        {figure("min", "From")}
        {figure("max", "To")}
        <Select
          label="Currency"
          inset
          value={value.currency}
          onChange={(currency) => pick({ currency })}
          options={currencies.map((c) => ({ value: c, label: c }))}
        />
        <Select
          label="Salary period"
          inset
          align="end"
          value={value.period}
          onChange={(period) => pick({ period })}
          options={periods}
        />
      </div>
    </div>
  );
}
