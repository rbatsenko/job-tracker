"use client";

import { useEffect, useId, useRef, useState } from "react";

const pad = (n: number) => String(n).padStart(2, "0");
/** A local calendar day as "YYYY-MM-DD", the same shape a date input uses. */
export const dayOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseDay = (day: string) => {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const shift = (d: Date, days: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);
const monthOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);

const longMonth = new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" });
const shortDay = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" });
const fullDay = new Intl.DateTimeFormat(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

/** Six weeks starting on the Monday on or before the 1st, so the grid never changes height. */
function weeksOf(month: Date) {
  const first = monthOf(month);
  const start = shift(first, -((first.getDay() + 6) % 7));
  return Array.from({ length: 6 }, (_, w) => Array.from({ length: 7 }, (_, d) => shift(start, w * 7 + d)));
}

type DatePickerProps = {
  id?: string;
  label: string;
  /** "YYYY-MM-DD", or "" for no date. */
  value: string;
  onChange: (day: string) => void;
  /** Latest pickable day, "YYYY-MM-DD". */
  max?: string;
  placeholder?: string;
};

/** A calendar in the style of Select: a button that opens a month grid, with arrow-key movement. */
export default function DatePicker({ id, label, value, onChange, max, placeholder = "Pick a day" }: DatePickerProps) {
  const reactId = useId();
  const baseId = id ?? reactId;
  const today = dayOf(new Date());
  const latest = max && max < today ? max : (max ?? today);

  const [open, setOpen] = useState(false);
  // The day the arrow keys move; also decides which month is shown.
  const [cursor, setCursor] = useState(() => parseDay(value || latest));
  const rootRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    setCursor(parseDay(value || latest));
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep focus on the cursor day so screen readers follow the arrows.
  useEffect(() => {
    if (open) gridRef.current?.querySelector<HTMLButtonElement>(`[data-day="${dayOf(cursor)}"]`)?.focus();
  }, [open, cursor]);

  const pickable = (day: string) => day <= latest;

  const pick = (day: string) => {
    if (!pickable(day)) return;
    onChange(day);
    setOpen(false);
    buttonRef.current?.focus();
  };

  const close = () => {
    setOpen(false);
    buttonRef.current?.focus();
  };

  const onGridKeyDown = (e: React.KeyboardEvent) => {
    const moves: Record<string, () => Date> = {
      ArrowLeft: () => shift(cursor, -1),
      ArrowRight: () => shift(cursor, 1),
      ArrowUp: () => shift(cursor, -7),
      ArrowDown: () => shift(cursor, 7),
      Home: () => shift(cursor, -((cursor.getDay() + 6) % 7)),
      End: () => shift(cursor, 6 - ((cursor.getDay() + 6) % 7)),
      PageUp: () => new Date(cursor.getFullYear(), cursor.getMonth() - (e.shiftKey ? 12 : 1), cursor.getDate()),
      PageDown: () => new Date(cursor.getFullYear(), cursor.getMonth() + (e.shiftKey ? 12 : 1), cursor.getDate()),
    };
    if (moves[e.key]) {
      e.preventDefault();
      setCursor(moves[e.key]());
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      pick(dayOf(cursor));
    } else if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  };

  const month = monthOf(cursor);
  const stepMonth = (by: number) => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + by, 1));
  const navButton = "flex h-8 w-8 items-center justify-center rounded-md text-soft transition hover:bg-sunken hover:text-text";

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        id={baseId}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (!open && ["Enter", " ", "ArrowDown", "ArrowUp"].includes(e.key)) {
            e.preventDefault();
            setOpen(true);
          }
        }}
        className={`flex h-11 w-full items-center gap-2 rounded-field border border-line bg-bg pl-3.5 text-left text-base transition hover:border-line-strong ${value ? "pr-10" : "pr-3.5"}`}
      >
        <svg aria-hidden viewBox="0 0 16 16" className="h-4 w-4 shrink-0 text-faint">
          <g fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2.5" y="3.5" width="11" height="10" rx="1.5" />
            <path d="M2.5 7h11M5.5 2v3M10.5 2v3" />
          </g>
        </svg>
        <span className={`min-w-0 flex-1 truncate ${value ? "" : "text-faint"}`}>
          {value ? shortDay.format(parseDay(value)) : placeholder}
        </span>
      </button>
      {value && (
        // A sibling, not a child: buttons can't nest.
        <button
          type="button"
          aria-label={`Clear ${label.toLowerCase()}`}
          onClick={() => onChange("")}
          className="absolute right-2.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-faint transition hover:bg-sunken hover:text-text"
        >
          <svg aria-hidden viewBox="0 0 12 12" className="h-3 w-3">
            <path d="M3 3l6 6M9 3l-6 6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
      )}

      {open && (
        <div
          role="dialog"
          aria-label={label}
          className="absolute left-0 top-[calc(100%+4px)] z-50 w-[19rem] animate-[tip-in_150ms_ease-out] rounded-card border border-line bg-raised p-3 shadow-[var(--shadow)]"
        >
          <div className="mb-2 flex items-center justify-between">
            <button type="button" onClick={() => stepMonth(-1)} aria-label="Previous month" className={navButton}>
              <svg aria-hidden viewBox="0 0 12 12" className="h-3 w-3">
                <path d="M7.5 2 4 6l3.5 4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <span aria-live="polite" className="text-base font-medium">{longMonth.format(month)}</span>
            <button
              type="button"
              onClick={() => stepMonth(1)}
              disabled={dayOf(month) >= latest.slice(0, 8) + "01"}
              aria-label="Next month"
              className={`${navButton} disabled:opacity-30 disabled:hover:bg-transparent`}
            >
              <svg aria-hidden viewBox="0 0 12 12" className="h-3 w-3">
                <path d="M4.5 2 8 6l-3.5 4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>

          <div ref={gridRef} role="grid" aria-label={longMonth.format(month)} onKeyDown={onGridKeyDown}>
            <div role="row" className="grid grid-cols-7">
              {WEEKDAYS.map((w) => (
                <span key={w} role="columnheader" className="py-1 text-center text-xs font-medium text-faint">{w}</span>
              ))}
            </div>
            {weeksOf(month).map((week, i) => (
              <div key={i} role="row" className="grid grid-cols-7">
                {week.map((d) => {
                  const day = dayOf(d);
                  const inMonth = d.getMonth() === month.getMonth();
                  const isSelected = day === value;
                  const isCursor = day === dayOf(cursor);
                  const isToday = day === today;
                  const can = pickable(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      role="gridcell"
                      data-day={day}
                      tabIndex={isCursor ? 0 : -1}
                      aria-selected={isSelected}
                      aria-label={fullDay.format(d)}
                      disabled={!can}
                      onClick={() => pick(day)}
                      className={`mx-auto flex h-9 w-9 items-center justify-center rounded-md text-sm transition ${
                        isSelected
                          ? "bg-brand font-semibold text-brand-text"
                          : isCursor
                            ? "bg-sunken text-text"
                            : inMonth
                              ? "text-text hover:bg-sunken"
                              : "text-faint hover:bg-sunken"
                      } ${isToday && !isSelected ? "ring-1 ring-inset ring-brand" : ""} disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent`}
                    >
                      {d.getDate()}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          <div className="mt-2 flex items-center justify-between border-t border-line pt-2">
            <button type="button" onClick={() => pick(today)} className="rounded-md px-2 py-1 text-sm font-medium text-brand transition hover:bg-brand-soft">
              Today
            </button>
            {value && (
              <button type="button" onClick={() => { onChange(""); close(); }} className="rounded-md px-2 py-1 text-sm text-soft transition hover:bg-sunken hover:text-text">
                Clear
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
