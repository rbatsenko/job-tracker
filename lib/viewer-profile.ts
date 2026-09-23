/** The viewer's ranking preferences. Absent by default, so the board shows no scores. */

import { fieldLabel } from "./fields";

const KEY = "job-tracker:profile:v2";

export type ViewerProfile = {
  /** A key from lib/fields.ts. */
  basedOn: string;
  label: string;
  /** Free text from the form, split on commas. Empty means use the preset's. */
  coreStack: string[];
  reach: { regions: string[]; canWorkUS: boolean; willRelocate: boolean };
  money: { floor: number; currency: "EUR" | "USD" | "GBP" | "PLN" };
};

export const BLANK_PROFILE: ViewerProfile = {
  basedOn: "engineering",
  label: "Engineering",
  coreStack: [],
  reach: { regions: ["worldwide"], canWorkUS: false, willRelocate: false },
  money: { floor: 0, currency: "EUR" },
};

/** A saved profile with its field filled in from the current lists. */
export const withField = (p: ViewerProfile, basedOn: string): ViewerProfile => ({
  ...p,
  basedOn,
  label: fieldLabel(basedOn),
  coreStack: p.basedOn === basedOn ? p.coreStack : [],
});

export function readProfile(): ViewerProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    const p = raw ? (JSON.parse(raw) as ViewerProfile) : null;
    return p && withField(p, p.basedOn);
  } catch {
    return null;
  }
}

export function saveProfile(p: ViewerProfile) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(p));
  } catch {}
}

export function clearProfile() {
  try {
    window.localStorage.removeItem(KEY);
  } catch {}
}

/** The shape the scorer expects. `strong` is derived so the form stays short. */
export function toScoringProfile(p: ViewerProfile) {
  return {
    basedOn: p.basedOn,
    key: p.basedOn,
    label: p.label,
    coreStack: p.coreStack.length ? p.coreStack : undefined,
    reach: p.reach,
    money: {
      floor: p.money.floor,
      strong: p.money.floor > 0 ? Math.round(p.money.floor * 1.5) : 0,
      currency: p.money.currency,
    },
  };
}

export const splitList = (s: string) =>
  s.split(",").map((x) => x.trim().toLowerCase()).filter(Boolean);
