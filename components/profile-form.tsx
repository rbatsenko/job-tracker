"use client";

import { useState } from "react";
import {
  BLANK_PROFILE,
  splitList,
  type ViewerProfile,
} from "@/lib/viewer-profile";

const field =
  "h-11 w-full rounded-field border border-line bg-bg px-3.5 text-base outline-none focus:border-brand";
const label = "mb-1.5 block text-base font-medium";

const REGIONS: { key: string; label: string }[] = [
  { key: "worldwide", label: "Anywhere remote" },
  { key: "eu", label: "Europe" },
  { key: "pl", label: "Poland" },
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
        Nothing here leaves your browser. Skip any of it — anything you leave blank is
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
            {REGIONS.map((r) => (
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
            <button
              type="button"
              onClick={() => setCanWorkUS((v) => !v)}
              aria-pressed={canWorkUS}
              className={`h-11 rounded-field px-4 text-base font-medium transition ${
                canWorkUS ? "bg-brand-soft text-brand" : "border border-line text-soft hover:bg-sunken"
              }`}
            >
              United States
            </button>
          </div>
          <label className="mt-3 flex items-center gap-2.5 text-base text-soft">
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
              placeholder="Leave empty to ignore salary"
            />
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value as ViewerProfile["money"]["currency"])}
              aria-label="Currency"
              className="h-11 shrink-0 rounded-field border border-line bg-bg px-3 text-base"
            >
              {["EUR", "USD", "GBP", "PLN"].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          <p className="mt-1.5 text-sm text-faint">Gross per year.</p>
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
