import { FIELDS, getField } from "./fields";

export type Reach = {
  /** "worldwide", "eu", or country codes. */
  regions: string[];
  canWorkUS: boolean;
  willRelocate: boolean;
};

export type Money = {
  floor: number;
  strong: number;
  currency: "EUR" | "USD" | "GBP" | "PLN";
};

export type Profile = {
  /** A key from FIELDS. "other" skips the title check and ranks on skills alone. */
  field: string;
  label: string;
  reach: Reach;
  money: Money;
  coreStack: readonly string[];
  secondaryStack: readonly string[];
  bonusTopics: readonly string[];
};

const DEFAULT_REACH: Reach = { regions: ["worldwide"], canWorkUS: false, willRelocate: false };
const DEFAULT_MONEY: Money = { floor: 0, strong: 0, currency: "EUR" };

/** One preset per field, built from the same lists that classify listings. */
export const PRESETS: Record<string, Profile> = Object.fromEntries(
  FIELDS.map((f) => [
    f.key,
    {
      field: f.key,
      label: f.label,
      reach: DEFAULT_REACH,
      money: DEFAULT_MONEY,
      coreStack: f.skills,
      secondaryStack: f.secondary,
      bonusTopics: f.topics,
    } satisfies Profile,
  ]),
);

export const getProfile = (key?: string | null): Profile => PRESETS[getField(key).key];

const asList = (v: unknown, fallback: readonly string[]): string[] =>
  Array.isArray(v)
    ? v.map((x) => String(x).toLowerCase().trim()).filter(Boolean).slice(0, 200)
    : [...fallback];

const clamp = (v: unknown, fallback: number) =>
  Math.max(0, Math.min(Number(v ?? fallback) || 0, 10_000_000));

/** Merges whatever a viewer sends over the preset it's based on. Input comes from a browser, so it's clamped. */
export function resolveProfile(input?: unknown): Profile {
  if (!input || typeof input !== "object") return getProfile("other");
  const raw = input as Record<string, unknown>;
  const base = getProfile((raw.basedOn ?? raw.field ?? raw.key) as string);
  const reach = (raw.reach ?? {}) as Record<string, unknown>;
  const money = (raw.money ?? {}) as Record<string, unknown>;
  const currency = String(money.currency ?? base.money.currency).toUpperCase();

  return {
    ...base,
    reach: {
      regions: asList(reach.regions, base.reach.regions),
      canWorkUS: Boolean(reach.canWorkUS ?? base.reach.canWorkUS),
      willRelocate: Boolean(reach.willRelocate ?? base.reach.willRelocate),
    },
    money: {
      floor: clamp(money.floor, base.money.floor),
      strong: clamp(money.strong, base.money.strong),
      currency: (["EUR", "USD", "GBP", "PLN"].includes(currency) ? currency : "EUR") as Money["currency"],
    },
    coreStack: asList(raw.coreStack, base.coreStack),
    secondaryStack: asList(raw.secondaryStack, base.secondaryStack),
    bonusTopics: asList(raw.bonusTopics, base.bonusTopics),
  };
}
