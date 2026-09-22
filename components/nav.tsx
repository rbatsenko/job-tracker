"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import ThemeToggle from "./theme-toggle";

export default function Nav() {
  const path = usePathname();
  const tabs = [
    { href: "/", label: "My jobs" },
    { href: "/board", label: "Find jobs" },
  ];

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-bg/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[1400px] items-center gap-6 px-5">
        <span className="text-lg font-bold tracking-tight">Job Tracker</span>

        <nav className="flex items-center gap-1">
          {tabs.map((t) => {
            const active = path === t.href;
            return (
              <Link
                key={t.href}
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={`flex h-10 items-center rounded-field px-4 text-base font-medium transition ${
                  active ? "bg-brand-soft text-brand" : "text-soft hover:bg-sunken hover:text-text"
                }`}
              >
                {t.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto">
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
