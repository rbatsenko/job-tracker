"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

export type Option = {
  value: string;
  label: string;
  /** Shown dimmed to the right — counts, extra context. */
  hint?: string;
  /** Options sharing a group are rendered under one heading. */
  group?: string;
  /** A small colour marker, for things like pipeline stages. */
  swatch?: string;
};

type Props = {
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  label: string;
  /** Adds a filter box. Defaults to on once the list is long. */
  searchable?: boolean;
  className?: string;
  id?: string;
};

/** A styled select following the ARIA combobox pattern, with keyboard support and type-ahead. */
export default function Select({
  value,
  onChange,
  options,
  label,
  searchable,
  className = "",
  id,
}: Props) {
  const reactId = useId();
  const baseId = id ?? reactId;
  const listId = `${baseId}-list`;

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const typeahead = useRef({ buffer: "", at: 0 });

  const withSearch = searchable ?? options.length > 12;

  const shown = useMemo(() => {
    if (!query.trim()) return options;
    const q = query.toLowerCase();
    return options.filter(
      (o) => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q),
    );
  }, [options, query]);

  const selected = options.find((o) => o.value === value);

  const grouped = useMemo(() => {
    const out: { group?: string; items: Option[] }[] = [];
    for (const o of shown) {
      const last = out[out.length - 1];
      if (last && last.group === o.group) last.items.push(o);
      else out.push({ group: o.group, items: [o] });
    }
    return out;
  }, [shown]);

  const flat = shown;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      return;
    }
    const i = flat.findIndex((o) => o.value === value);
    setActive(i >= 0 ? i : 0);
    if (withSearch) requestAnimationFrame(() => searchRef.current?.focus());
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return;
    listRef.current
      ?.querySelector(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  const commit = (i: number) => {
    const opt = flat[i];
    if (!opt) return;
    onChange(opt.value);
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (["Enter", " ", "ArrowDown", "ArrowUp"].includes(e.key)) {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    switch (e.key) {
      case "Escape":
        e.preventDefault();
        setOpen(false);
        break;
      case "Enter":
        e.preventDefault();
        commit(active);
        break;
      case "ArrowDown":
        e.preventDefault();
        setActive((a) => Math.min(a + 1, flat.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActive((a) => Math.max(a - 1, 0));
        break;
      case "Home":
        e.preventDefault();
        setActive(0);
        break;
      case "End":
        e.preventDefault();
        setActive(flat.length - 1);
        break;
      case "Tab":
        setOpen(false);
        break;
      default: {
        // Type-ahead
        if (withSearch || e.key.length !== 1) return;
        const now = Date.now();
        const t = typeahead.current;
        t.buffer = now - t.at > 800 ? e.key : t.buffer + e.key;
        t.at = now;
        const i = flat.findIndex((o) => o.label.toLowerCase().startsWith(t.buffer.toLowerCase()));
        if (i >= 0) setActive(i);
      }
    }
  };

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        id={baseId}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open && flat[active] ? `${baseId}-opt-${active}` : undefined}
        aria-label={label}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={onKeyDown}
        className="flex h-11 w-full items-center gap-2 rounded-field border border-line bg-raised px-3.5 text-left text-base transition hover:border-line-strong"
      >
        {selected?.swatch && (
          <span
            aria-hidden
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ background: selected.swatch }}
          />
        )}
        <span className="min-w-0 flex-1 truncate">{selected?.label ?? label}</span>
        <svg
          aria-hidden
          viewBox="0 0 12 12"
          className={`h-3 w-3 shrink-0 text-faint transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path d="M2 4.5 6 8.5 10 4.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-50 min-w-[14rem] overflow-hidden rounded-card border border-line bg-raised shadow-[var(--shadow)]">
          {withSearch && (
            <div className="border-b border-line p-2">
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActive(0);
                }}
                onKeyDown={onKeyDown}
                placeholder="Type to filter"
                aria-label={`Filter ${label}`}
                className="h-9 w-full rounded-md border border-line bg-bg px-2.5 text-base outline-none focus:border-brand"
              />
            </div>
          )}

          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            aria-label={label}
            className="scroll-thin max-h-72 overflow-y-auto py-1"
          >
            {grouped.map((section, gi) => (
              <li key={section.group ?? gi} role="presentation">
                {section.group && (
                  <p className="px-3 pb-1 pt-2.5 text-sm font-medium text-faint">{section.group}</p>
                )}
                <ul role="presentation">
                  {section.items.map((o) => {
                    const i = flat.indexOf(o);
                    const isActive = i === active;
                    const isSelected = o.value === value;
                    return (
                      <li
                        key={o.value}
                        id={`${baseId}-opt-${i}`}
                        data-index={i}
                        role="option"
                        aria-selected={isSelected}
                        onMouseEnter={() => setActive(i)}
                        onClick={() => commit(i)}
                        className={`flex cursor-pointer items-center gap-2.5 px-3 py-2.5 text-base ${
                          isActive ? "bg-sunken" : ""
                        } ${isSelected ? "font-medium text-brand" : "text-text"}`}
                      >
                        {o.swatch && (
                          <span
                            aria-hidden
                            className="h-2.5 w-2.5 shrink-0 rounded-full"
                            style={{ background: o.swatch }}
                          />
                        )}
                        <span className="min-w-0 flex-1 truncate">{o.label}</span>
                        {o.hint && <span className="shrink-0 text-sm text-faint">{o.hint}</span>}
                        {isSelected && (
                          <svg aria-hidden viewBox="0 0 12 12" className="h-3.5 w-3.5 shrink-0">
                            <path d="M2.5 6.5 5 9l4.5-5.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}

            {!flat.length && (
              <li className="px-3 py-3 text-base text-faint">Nothing matches “{query}”</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
