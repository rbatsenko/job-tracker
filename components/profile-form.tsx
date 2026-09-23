"use client";

import { useState } from "react";
import Select from "@/components/select";
import { input as field } from "@/components/styles";
import { COUNTRY_OPTIONS, countryName } from "@/lib/countries";
import {
  BLANK_PROFILE,
  splitList,
  type ViewerProfile,
} from "@/lib/viewer-profile";

const label = "mb-1.5 block text-base font-medium";
const CURRENCIES = ["EUR", "USD", "GBP", "PLN"] as const;

const BROAD: { key: string; label: string }[] = [
  { key: "worldwide", label: "Anywhere remote" },
  { key: "eu", label: "Anywhere in Europe" },
];

export default function ProfileForm({
  initial,
  onSave,
  onCancel,
  onClear,
}: {
  initial: ViewerProfile | null;
  onSave: (p: ViewerProfile) => void;
  onCancel: () => void;
  onClear?: () => void;
}) {
  const start = initial ?? BLANK_PROFILE;
  const [basedOn, setBasedOn] = useState(start.basedOn);
  const [stack, setStack] = useState(start.coreStack.join(", "));
  const [regions, setRegions] = useState<string[]>(start.reach.regions);
  const [canWorkUS, setCanWorkUS] = useState(start.reach.canWorkUS);
  const [willRelocate, setWillRelocate] = useState(start.reach.willRelocate);
  const [floor, setFloor] = useState(String(start.money.floor || ""));
  const [currency, setCurrency] = useState(start.money.currency);

  const toggleRegion = (k: string) =>
    setRegions((r) => (r.includes(k) ? r.filter((x) => x !== k) : [...r, k]));

  const countryPicks = regions.filter((r) => r !== "worldwide" && r !== "eu");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave({
          basedOn,
          label: basedOn === "design" ? "Design" : "Engineering",
          coreStack: splitList(stack),
          reach: { regions: regions.length ? regions : ["worldwide"], canWorkUS, willRelocate },
          money: { floor: Number(floor) || 0, currency },
        });
      }}
      className="mb-6 rounded-card border border-line bg-raised p-5 shadow-[var(--shadow)] sm:p-6"
    >
      <h2 className="text-xl font-semibold">Rank these jobs for you</h2>
      <p className="mt-1.5 max-w-prose text-base text-soft">
        Nothing here leaves your browser. Skip any of it, anything you leave blank is
        simply not used.
      </p>

      <div className="mt-6 space-y-6">
        <fieldset>
          <legend className={label}>What do you do</legend>
          <div className="flex gap-2">
            {(["engineering", "design"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setBasedOn(k)}
                aria-pressed={basedOn === k}
                className={`h-11 rounded-field px-4 text-base font-medium transition ${
                  basedOn === k
                    ? "bg-brand text-brand-text"
                    : "border border-line text-soft hover:bg-sunken"
                }`}
              >
                {k === "design" ? "Design" : "Engineering"}
              </button>
            ))}
          </div>
        </fieldset>

        <div>
          <label className={label} htmlFor="stack">
            Skills that matter to you
          </label>
          <input
            id="stack"
            className={field}
            value={stack}
            onChange={(e) => setStack(e.target.value)}
            placeholder={
              basedOn === "design"
                ? "figma, design systems, user research"
                : "typescript, react, node"
            }
          />
          <p className="mt-1.5 text-sm text-faint">
            Comma separated. Leave empty to use the usual ones for {basedOn}.
          </p>
        </div>

        <fieldset>
          <legend className={label}>Where can you work</legend>
          <div className="flex flex-wrap gap-2">
            {BROAD.map((r) => (
              <button
                key={r.key}
                type="button"
                onClick={() => toggleRegion(r.key)}
                aria-pressed={regions.includes(r.key)}
                className={`h-11 rounded-field px-4 text-base font-medium transition ${
                  regions.includes(r.key)
                    ? "bg-brand-soft text-brand"
                    : "border border-line text-soft hover:bg-sunken"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>

          <div className="mt-3">
            <Select
              label="Add a country…"
              inset
              className="w-full sm:w-72"
              value=""
              onChange={toggleRegion}
              options={COUNTRY_OPTIONS.filter((c) => !regions.includes(c.code)).map((c) => ({
                value: c.code,
                label: c.name,
              }))}
            />
          </div>

          {countryPicks.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-2">
              {countryPicks.map((code) => (
                <li key={code}>
                  <button
                    type="button"
                    onClick={() => toggleRegion(code)}
                    className="flex h-9 items-center gap-2 rounded-md bg-brand-soft px-3 text-sm font-medium text-brand"
                    aria-label={`Remove ${countryName(code)}`}
                  >
                    {countryName(code)} <span aria-hidden>×</span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <label className="mt-4 flex items-center gap-2.5 text-base text-soft">
            <input
              type="checkbox"
              checked={canWorkUS}
              onChange={(e) => setCanWorkUS(e.target.checked)}
              className="h-5 w-5 accent-[var(--brand)]"
            />
            I can take a US-only role
          </label>
          <label className="mt-2 flex items-center gap-2.5 text-base text-soft">
            <input
              type="checkbox"
              checked={willRelocate}
              onChange={(e) => setWillRelocate(e.target.checked)}
              className="h-5 w-5 accent-[var(--brand)]"
            />
            I would consider on-site or relocating
          </label>
        </fieldset>

        <div>
          <label className={label} htmlFor="floor">
            Lowest salary worth your time
          </label>
          <div className="flex gap-2">
            <input
              id="floor"
              type="number"
              inputMode="numeric"
              min={0}
              className={field}
              value={floor}
              onChange={(e) => setFloor(e.target.value)}
              placeholder="Optional"
            />
            <Select
              label="Currency"
              inset
              className="w-28 shrink-0"
              align="end"
              value={currency}
              onChange={(v) => setCurrency(v as (typeof CURRENCIES)[number])}
              options={CURRENCIES.map((c) => ({ value: c, label: c }))}
            />
          </div>
          <p className="mt-1.5 text-sm text-faint">Gross per year. Leave empty to ignore salary.</p>
        </div>
      </div>

      <div className="mt-7 flex flex-wrap gap-3">
        <button
          type="submit"
          className="h-11 w-full rounded-field bg-brand px-5 text-base font-semibold text-brand-text sm:w-auto"
        >
          Rank the jobs
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="h-11 rounded-field border border-line px-5 text-base font-medium text-soft hover:bg-sunken"
        >
          Cancel
        </button>
        {onClear && initial && (
          <button
            type="button"
            onClick={onClear}
            className="h-11 rounded-field px-4 text-base text-faint hover:text-closed"
          >
            Turn ranking off
          </button>
        )}
      </div>
    </form>
  );
}
