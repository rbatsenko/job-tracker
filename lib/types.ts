export const STATUSES = [
  "new",
  "shortlist",
  "drafted",
  "applied",
  "replied",
  "interviewing",
  "offer",
  "rejected",
  "archived",
] as const;

export type Status = (typeof STATUSES)[number];

/**
 * How far a listing reaches: "worldwide", "eu", "other" (on-site somewhere we
 * could not place), "unknown", or a two-letter country code such as "pl" or
 * "de". It used to be a closed list with Poland as the only country, which
 * made every other country "other".
 */
export const SCOPE_KEYWORDS = ["worldwide", "eu", "other", "unknown"] as const;
export type Scope = string;

export type Job = {
  id: number;
  source: string;
  external_id: string;
  url: string;
  company: string;
  company_url: string | null;
  title: string;
  location: string | null;
  remote_scope: Scope;
  employment: string | null;
  salary_min: number | null;
  salary_max: number | null;
  currency: string | null;
  salary_period: string | null;
  tags: string[];
  description: string | null;
  posted_at: string | null;
  discovered_at: string;
  fit_score: number;
  fit_reasons: string[];
  status: Status;
  starred: 0 | 1;
  notes: string | null;
  draft: string | null;
  applied_at: string | null;
  updated_at: string;
};

/** What every source normalises to before it hits the database. */
export type IncomingJob = {
  source: string;
  external_id: string;
  url: string;
  company: string;
  company_url?: string | null;
  title: string;
  location?: string | null;
  remote_scope?: Scope;
  employment?: string | null;
  salary_min?: number | null;
  salary_max?: number | null;
  currency?: string | null;
  salary_period?: string | null;
  tags?: string[];
  description?: string | null;
  posted_at?: string | null;
};
