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
    <header className="sticky top-0 z-30 border-b border-line bg-bg/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-2 px-4 sm:h-16 sm:gap-5 sm:px-5">
        <span className="hidden whitespace-nowrap text-lg font-bold tracking-tight sm:inline">
          Jobshelf
        </span>

        <nav className="flex min-w-0 items-center gap-1">
          {tabs.map((t) => {
            const active = path === t.href;
            return (
              <Link
                key={t.href}
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={`flex h-10 items-center whitespace-nowrap rounded-field px-3 text-[0.9375rem] font-medium transition sm:px-4 sm:text-base ${
                  active ? "bg-brand-soft text-brand" : "text-soft hover:bg-sunken hover:text-text"
                }`}
              >
                {t.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto shrink-0">
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
