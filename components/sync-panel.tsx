"use client";

import { useState } from "react";
import { sinceLabel } from "./bits";
import { card, input, primaryButton, secondaryButton } from "./styles";
import { deleteSynced, forgetSync, newCode, normalizeCode, prettyCode, syncNow, type SyncState } from "@/lib/sync";

type SyncPanelProps = {
  state: SyncState | null;
  available: boolean;
  /** Runs a sync and reloads the list. Resolves to a short summary, or throws. */
  onSync: (code: string) => Promise<string>;
  onChange: () => void;
  onClose: () => void;
};

export default function SyncPanel({ state, available, onSync, onChange, onClose }: SyncPanelProps) {
  const [typed, setTyped] = useState("");
  const [shown, setShown] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function run(code: string, done?: string) {
    setBusy(true);
    setNote(null);
    try {
      const summary = await onSync(code);
      setNote(done ?? summary);
      onChange();
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Sync failed.");
    } finally {
      setBusy(false);
    }
  }

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setNote("Copied.");
    } catch {
      setNote("The browser blocked the clipboard. Select the code and copy it by hand.");
    }
  };

  return (
    <section className={`${card} mb-6 p-5 sm:p-6`}>
      <h2 className="text-lg font-semibold">Sync between devices</h2>

      {!available ? (
        <p className="mt-2 max-w-prose text-base text-soft">
          Sync isn't set up on this copy of the app. Use Export and Import to move your list, or run it on
          jobshelf.app.
        </p>
      ) : state ? (
        <>
          <p className="mt-2 max-w-prose text-base text-soft">
            This browser syncs with the code below. Type it into Jobshelf on another device and both lists
            become one. Your jobs are encrypted with the code before they leave the browser, so keep it
            like a password.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <code className="rounded-field border border-line bg-bg px-3.5 py-2.5 font-mono text-base tracking-wide">
              {shown ? prettyCode(state.code) : "•••• •••• •••• •••• ••••"}
            </code>
            <button onClick={() => setShown((v) => !v)} className={secondaryButton}>
              {shown ? "Hide" : "Show"}
            </button>
            <button onClick={() => copy(prettyCode(state.code))} className={secondaryButton}>
              Copy code
            </button>
          </div>
          <p className="mt-3 text-sm text-faint">
            {state.syncedAt ? `Last synced ${sinceLabel(state.syncedAt)}.` : "Not synced yet."}{" "}
            It syncs by itself after every change and whenever you come back to the tab.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <button onClick={() => run(state.code, "Synced.")} disabled={busy} className={primaryButton}>
              {busy ? "Syncing…" : "Sync now"}
            </button>
            <button
              onClick={() => {
                forgetSync();
                setNote("This browser no longer syncs. The list stays here.");
                onChange();
              }}
              className={secondaryButton}
            >
              Stop syncing here
            </button>
            <button
              onClick={async () => {
                await deleteSynced(state.code);
                setNote("Deleted the synced copy. Other devices keep what they already have.");
                onChange();
              }}
              className="h-11 rounded-field px-4 text-base text-faint hover:text-closed"
            >
              Delete synced copy
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="mt-2 max-w-prose text-base text-soft">
            No account needed. Create a code here and type it on your other device, or enter a code you
            already have. Your list is encrypted with the code in the browser; the server only ever
            stores the encrypted copy.
          </p>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
            <button onClick={() => run(newCode(), "Done. Show the code and type it on your other device.")} disabled={busy} className={primaryButton}>
              {busy ? "Working…" : "Create a sync code"}
            </button>
            <span className="text-sm text-faint">or</span>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (normalizeCode(typed).length >= 16) run(typed);
                else setNote("A code has 20 letters and digits.");
              }}
            >
              <input
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder="xxxx-xxxx-xxxx-xxxx-xxxx"
                aria-label="Sync code"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                className={`${input} font-mono sm:w-72`}
              />
              <button type="submit" disabled={busy} className={secondaryButton}>
                Use this code
              </button>
            </form>
          </div>
        </>
      )}

      {note && (
        <p role="status" className="mt-4 text-base text-brand">
          {note}
        </p>
      )}

      <button onClick={onClose} className={`${secondaryButton} mt-5`}>
        Close
      </button>
    </section>
  );
}
