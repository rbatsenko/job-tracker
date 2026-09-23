"use client";

import { useEffect, useState } from "react";

type FeatureTipProps = {
  /** Remembers the dismissal, so each tip shows once per browser. */
  id: string;
  title: string;
  text: string;
  action: string;
  onAction: () => void;
  /** Only worth showing when this is true; the tip waits until it is. */
  when?: boolean;
};

const seenKey = (id: string) => `job-tracker:seen:${id}`;

/** A small note anchored under a control, pointing out something new. Shows once. */
export default function FeatureTip({ id, title, text, action, onAction, when = true }: FeatureTipProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!when) return;
    try {
      if (localStorage.getItem(seenKey(id))) return;
    } catch {
      return;
    }
    const t = setTimeout(() => setOpen(true), 1200);
    return () => clearTimeout(t);
  }, [id, when]);

  const dismiss = () => {
    setOpen(false);
    try {
      localStorage.setItem(seenKey(id), new Date().toISOString());
    } catch {}
  };

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-label={title}
      className="absolute right-0 top-[calc(100%+12px)] z-40 w-72 max-w-[calc(100vw-2rem)] rounded-card border border-line bg-raised p-4 text-left shadow-[var(--shadow)] motion-safe:animate-[tip-in_240ms_ease-out] sm:left-1/2 sm:right-auto sm:-translate-x-1/2"
    >
      <span aria-hidden className="absolute -top-1.5 right-6 h-3 w-3 rotate-45 border-l border-t border-line bg-raised sm:left-1/2 sm:right-auto sm:-translate-x-1/2" />
      <p className="text-sm font-semibold">{title}</p>
      <p className="mt-1 text-sm leading-relaxed text-soft">{text}</p>
      <div className="mt-3 flex gap-2">
        <button
          onClick={() => {
            dismiss();
            onAction();
          }}
          className="h-9 rounded-md bg-brand px-3 text-sm font-semibold text-brand-text hover:brightness-110"
        >
          {action}
        </button>
        <button onClick={dismiss} className="h-9 rounded-md px-3 text-sm text-soft hover:bg-sunken hover:text-text">
          Not now
        </button>
      </div>
    </div>
  );
}
