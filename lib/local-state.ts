"use client";

import type { Status } from "./types";

/**
 * Per-viewer tracking state. This is deliberately the source of truth for
 * anything the user owns, so the same app works when it is deployed somewhere
 * without a writable database and several people use their own copy.
 */
export type Tracked = {
  status?: Status;
  starred?: boolean;
  notes?: string;
  draft?: string;
  applied_at?: string | null;
};

const KEY = "job-tracker:state:v1";

/** Stable across databases and deploys, unlike the autoincrement id. */
export const jobKey = (j: { source: string; external_id: string }) =>
  `${j.source}:${j.external_id}`;

export function readState(): Record<string, Tracked> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(KEY) ?? "{}") as Record<string, Tracked>;
  } catch {
    return {};
  }
}

export function writeState(state: Record<string, Tracked>) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Private windows and blocked site data: tracking is lost, the app still works.
  }
}

export function exportState(): string {
  return JSON.stringify(readState(), null, 2);
}

export function importState(json: string): number {
  const incoming = JSON.parse(json) as Record<string, Tracked>;
  const merged = { ...readState(), ...incoming };
  writeState(merged);
  return Object.keys(incoming).length;
}
