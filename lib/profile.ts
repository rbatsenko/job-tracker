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
  key: string;
  label: string;
  reach: Reach;
  money: Money;
  coreStack: readonly string[];
  secondaryStack: readonly string[];
  bonusTopics: readonly string[];
  goodTitles: readonly string[];
  badTitles: readonly string[];
  /** Keywords that make a listing worth storing at all. */
  relevance: readonly string[];
};

const DEFAULT_REACH: Reach = { regions: ["worldwide"], canWorkUS: false, willRelocate: false };
const DEFAULT_MONEY: Money = { floor: 0, strong: 0, currency: "EUR" };

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
    "ai", "llm", "agent", "mcp", "openai", "anthropic", "rag",
    "integrations", "developer tools", "devtools", "mobile",
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
    "security engineer", "qa engineer", "ux designer", "ui designer",
    "product designer", "visual designer", "brand designer", "graphic designer",
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
    "security engineer", "qa engineer", "backend engineer", "back end engineer",
    "software engineer", "full stack engineer", "fullstack engineer",
    "platform engineer",
  ],
  relevance: [
    "designer", "design", "figma", " ux", "ux ", "ui/ux", "ux/ui",
    "user research", "interaction design", "product design", "visual design",
    "design system", "user experience",
  ],
};

export const PROFILES = { engineering: ENGINEERING, design: DESIGN } as const;
export type ProfileKey = keyof typeof PROFILES;

export const getProfile = (key?: string | null): Profile =>
  PROFILES[key as ProfileKey] ?? ENGINEERING;

/** Everything any profile cares about. Storage uses the union; taste is applied on read. */
export const ALL_RELEVANCE = [...new Set(Object.values(PROFILES).flatMap((p) => p.relevance))];

const asList = (v: unknown, fallback: readonly string[]): string[] =>
  Array.isArray(v)
    ? v.map((x) => String(x).toLowerCase().trim()).filter(Boolean).slice(0, 200)
    : [...fallback];

const clamp = (v: unknown, fallback: number) =>
  Math.max(0, Math.min(Number(v ?? fallback) || 0, 10_000_000));

/** Merges whatever a viewer sends over the preset it's based on. Input comes from a browser, so it's clamped. */
export function resolveProfile(input?: unknown): Profile {
  if (!input || typeof input !== "object") return ENGINEERING;
  const raw = input as Record<string, unknown>;
  const base = getProfile((raw.basedOn ?? raw.key) as string);
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
    goodTitles: asList(raw.goodTitles, base.goodTitles),
    badTitles: asList(raw.badTitles, base.badTitles),
  };
}
