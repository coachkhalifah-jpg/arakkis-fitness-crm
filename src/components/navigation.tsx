"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function Navigation() {
  const pathname = usePathname();
  const bookingMode = pathname.startsWith("/register/");
  if (bookingMode) return null;
  return (
    <header className="sticky top-0 z-20 border-b border-[var(--border-subtle)] bg-[color:rgba(31,34,39,0.9)] backdrop-blur">
      <nav
        className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8"
        aria-label="Main navigation"
      >
        <Link className="flex items-center gap-2 font-semibold tracking-tight text-ink" href="/">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand text-sm font-bold text-[var(--accent-foreground)]">
            F
          </span>
          Fitness Event CRM
        </Link>
        <div className="flex items-center gap-5 text-sm font-semibold">
          <Link className="nav-link hidden sm:inline" href="/events">
            Explore events
          </Link>
          <Link className="nav-link" href="/admin/sign-in">
            {pathname.startsWith("/admin") ? "Admin" : "Admin sign-in"}
          </Link>
        </div>
      </nav>
    </header>
  );
}
