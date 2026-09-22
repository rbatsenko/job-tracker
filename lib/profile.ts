/**
 * Role families, as data.
 *
 * The board is shared but taste is not: an engineer and a designer looking at
 * the same listing should not see the same score. A profile is picked per
 * viewer and applied when jobs are read, so nothing about one person's
 * preferences is baked into the stored rows.
 */

/** Where someone can actually work. Drives the geography weighting. */
export type Reach = {
  /** Regions they can work from, e.g. ["eu", "pl"]. */
  regions: string[];
  /** True if they can take a US-only role. */
  canWorkUS: boolean;
  /** True if on-site roles outside their regions are acceptable. */
  willRelocate: boolean;
};

export type Money = {
  /** Below this, a listing looks low. 0 disables the check. */
  floor: number;
  /** At or above this, a listing looks strong. 0 disables the check. */
  strong: number;
  currency: "EUR" | "USD" | "GBP" | "PLN";
};

export type Profile = {
  key: string;
  label: string;
  /** Everything below is editable per viewer. */
  reach: Reach;
  money: Money;
  /** Heavily weighted: the centre of this person's work. */
  coreStack: readonly string[];
  /** Real, but secondary. */
  secondaryStack: readonly string[];
  /** Topical interest, lightly weighted. */
  bonusTopics: readonly string[];
  /** Title patterns that fit. */
  goodTitles: readonly string[];
  /** Titles to push down *for this family*. */
  badTitles: readonly string[];
  /** Ingest gate: a listing matching any of these is worth storing. */
  relevance: readonly string[];
};

/** Neutral starting point: works anywhere remote, no salary opinion. */
export const DEFAULT_REACH: Reach = { regions: ["worldwide"], canWorkUS: false, willRelocate: false };
export const DEFAULT_MONEY: Money = { floor: 0, strong: 0, currency: "EUR" };

export const ENGINEERING: Profile = {
  key: "engineering",
  label: "Engineering",
  reach: DEFAULT_REACH,
  money: DEFAULT_MONEY,
  coreStack: [
    "typescript", "react", "next.js", "nextjs", "react native", "expo",
    "node", "node.js", "javascript",
  ],
  secondaryStack: [
    "kotlin", "spring", "spring boot", "kafka", "postgres", "postgresql",
    "supabase", "express", "graphql", "aws", "docker", "datadog", "cypress",
    "playwright", "swift", "swiftui",
  ],
  bonusTopics: [
    "ai", "llm", "agent", "mcp", "anthropic", "claude", "openai", "ai sdk",
    "rag", "integrations", "developer tools", "devtools", "mobile",
  ],
  goodTitles: [
    "senior", "staff", "lead", "principal", "full stack", "fullstack",
    "full-stack", "frontend", "front end", "front-end", "backend", "back end",
    "back-end", "software engineer", "product engineer", "mobile engineer",
    "founding engineer", "web engineer", "design engineer", "developer",
    "engineer", "programmer",
  ],
  badTitles: [
    "embedded", "firmware", "hardware", "asic", "mechanical",
    "machine learning engineer", "ml engineer", "research scientist",
    "data scientist", "data engineer", "devops", "site reliability", " sre",
    "security engineer", "qa engineer",
    // Design roles are not this person's work — down here, not excluded.
    "ux designer", "ui designer", "product designer", "visual designer",
    "brand designer", "graphic designer",
  ],
  relevance: [
    "typescript", "javascript", "react", "node", "software engineer",
    "web developer", "full stack", "fullstack", "frontend", "front end",
    "backend", "back end", "product engineer", "kotlin", "python", "golang",
  ],
};

export const DESIGN: Profile = {
  key: "design",
  label: "Design",
  reach: DEFAULT_REACH,
  money: DEFAULT_MONEY,
  coreStack: [
    "figma", "design system", "design systems", "prototyping", "prototype",
    "user research", "interaction design", "ux", "ui", "wireframe",
    "usability", "product design",
  ],
  secondaryStack: [
    "sketch", "framer", "webflow", "adobe", "illustrator", "photoshop",
    "after effects", "motion design", "typography", "accessibility", "wcag",
    "user testing", "design token", "storybook", "html", "css",
  ],
  bonusTopics: [
    "ai", "design ops", "designops", "0 to 1", "zero to one", "b2b",
    "saas", "mobile", "brand", "content design", "service design",
  ],
  goodTitles: [
    "senior", "staff", "lead", "principal", "head of design", "design director",
    "product designer", "ux designer", "ui designer", "ux/ui", "ui/ux",
    "interaction designer", "visual designer", "design lead", "designer",
    "ux researcher", "user researcher", "content designer", "design engineer",
    "brand designer", "design manager",
  ],
  badTitles: [
    "embedded", "firmware", "hardware", "devops", "site reliability", " sre",
    "data engineer", "machine learning engineer", "ml engineer",
    "security engineer", "qa engineer",
    // Pure engineering roles are not this person's work.
    "backend engineer", "back end engineer", "software engineer",
    "full stack engineer", "fullstack engineer", "platform engineer",
  ],
  relevance: [
    "designer", "design", "figma", " ux", "ux ", "ui/ux", "ux/ui",
    "user research", "interaction design", "product design", "visual design",
    "design system", "user experience",
  ],
};

export const PROFILES = { engineering: ENGINEERING, design: DESIGN } as const;
export type ProfileKey = keyof typeof PROFILES;

export const DEFAULT_PROFILE: ProfileKey = "engineering";

export const getProfile = (key?: string | null): Profile =>
  PROFILES[(key as ProfileKey) ?? DEFAULT_PROFILE] ?? PROFILES[DEFAULT_PROFILE];

const asList = (v: unknown, fallback: readonly string[]): string[] =>
  Array.isArray(v)
    ? v.map((x) => String(x).toLowerCase().trim()).filter(Boolean).slice(0, 200)
    : [...fallback];

/**
 * Builds a usable profile from whatever a viewer sends. Anything missing falls
 * back to the preset it is based on, so a half-filled form still scores.
 * Everything is clamped — this arrives from a browser.
 */
export function resolveProfile(input?: unknown): Profile {
  if (!input || typeof input !== "object") return getProfile(null);
  const raw = input as Record<string, unknown>;
  const base = getProfile(typeof raw.basedOn === "string" ? raw.basedOn : (raw.key as string));

  const reachIn = (raw.reach ?? {}) as Record<string, unknown>;
  const moneyIn = (raw.money ?? {}) as Record<string, unknown>;
  const cur = String(moneyIn.currency ?? base.money.currency).toUpperCase();

  return {
    key: typeof raw.key === "string" ? raw.key.slice(0, 40) : base.key,
    label: typeof raw.label === "string" ? raw.label.slice(0, 40) : base.label,
    reach: {
      regions: asList(reachIn.regions, base.reach.regions),
      canWorkUS: Boolean(reachIn.canWorkUS ?? base.reach.canWorkUS),
      willRelocate: Boolean(reachIn.willRelocate ?? base.reach.willRelocate),
    },
    money: {
      floor: Math.max(0, Math.min(Number(moneyIn.floor ?? base.money.floor) || 0, 10_000_000)),
      strong: Math.max(0, Math.min(Number(moneyIn.strong ?? base.money.strong) || 0, 10_000_000)),
      currency: (["EUR", "USD", "GBP", "PLN"].includes(cur) ? cur : "EUR") as Money["currency"],
    },
    coreStack: asList(raw.coreStack, base.coreStack),
    secondaryStack: asList(raw.secondaryStack, base.secondaryStack),
    bonusTopics: asList(raw.bonusTopics, base.bonusTopics),
    goodTitles: asList(raw.goodTitles, base.goodTitles),
    badTitles: asList(raw.badTitles, base.badTitles),
    relevance: base.relevance,
  };
}

/** Anything any profile wants is worth storing; taste is applied on read. */
export const ALL_RELEVANCE = Array.from(
  new Set(Object.values(PROFILES).flatMap((p) => p.relevance)),
);

/** Kept for compatibility with code that predates multiple profiles. */
export const PROFILE = ENGINEERING;
