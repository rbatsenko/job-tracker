/**
 * Sync between devices with a code instead of an account. The list is encrypted in
 * the browser with the code; the server stores the encrypted copy under a hash of
 * the code and never sees the code itself.
 */

import { exportDoc, mergeDoc, type MergeResult } from "./my-jobs";

const KEY = "job-tracker:sync:v1";
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
const PBKDF2_ROUNDS = 210_000;

export type SyncState = { code: string; syncedAt: string | null };

export function readSync(): SyncState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as SyncState) : null;
  } catch {
    return null;
  }
}

function saveSync(state: SyncState | null) {
  try {
    if (state) localStorage.setItem(KEY, JSON.stringify(state));
    else localStorage.removeItem(KEY);
  } catch {}
}

/** 20 characters from a 31-letter alphabet, so a code can't be guessed. Groups of four read easier. */
export function newCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(20));
  const chars = [...bytes].map((b) => ALPHABET[b % ALPHABET.length]);
  return [0, 4, 8, 12, 16].map((i) => chars.slice(i, i + 4).join("")).join("-");
}

export const normalizeCode = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
export const prettyCode = (s: string) => normalizeCode(s).replace(/(.{4})(?=.)/g, "$1-");

const utf8 = (s: string) => new TextEncoder().encode(s);
const b64 = (bytes: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(bytes)));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const hex = (bytes: ArrayBuffer) => [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");

/** The storage id is a hash of the code; the key is derived separately, so the id gives nothing away. */
async function keys(code: string) {
  const normalized = normalizeCode(code);
  const id = hex(await crypto.subtle.digest("SHA-256", utf8(`jobshelf-sync-id:${normalized}`)));
  const material = await crypto.subtle.importKey("raw", utf8(normalized), "PBKDF2", false, ["deriveKey"]);
  const key = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: utf8("jobshelf-sync-v1"), iterations: PBKDF2_ROUNDS, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
  return { id, key };
}

async function encrypt(key: CryptoKey, text: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, utf8(text));
  return { iv: b64(iv), data: b64(data) };
}

async function decrypt(key: CryptoKey, payload: { iv: string; data: string }) {
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(payload.iv) }, key, unb64(payload.data));
  return new TextDecoder().decode(plain);
}

const json = { headers: { "Content-Type": "application/json" } };

export async function syncAvailable() {
  try {
    const res = await fetch("/api/sync", { cache: "no-store" });
    return res.ok && Boolean(((await res.json()) as { available?: boolean }).available);
  } catch {
    return false;
  }
}

/** Uploads this browser's list under the code. */
export async function push(code: string) {
  const { id, key } = await keys(code);
  const body = await encrypt(key, exportDoc());
  const res = await fetch("/api/sync", { method: "PUT", ...json, body: JSON.stringify({ id, ...body }) });
  if (!res.ok) throw new Error("The sync server didn't accept the upload.");
  saveSync({ code: normalizeCode(code), syncedAt: new Date().toISOString() });
}

/** Merges whatever is stored under the code into this browser. Null when nothing is stored yet. */
export async function pull(code: string): Promise<MergeResult | null> {
  const { id, key } = await keys(code);
  const res = await fetch(`/api/sync?id=${id}`, { cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("The sync server didn't answer.");
  const doc = JSON.parse(await decrypt(key, (await res.json()) as { iv: string; data: string }));
  return mergeDoc(doc);
}

/** Pull, then push, so both sides end up with the same list. */
export async function syncNow(code: string) {
  const merged = await pull(code);
  await push(code);
  return merged;
}

export function forgetSync() {
  saveSync(null);
}

export async function deleteSynced(code: string) {
  const { id } = await keys(code);
  await fetch("/api/sync", { method: "DELETE", ...json, body: JSON.stringify({ id }) });
  saveSync(null);
}
