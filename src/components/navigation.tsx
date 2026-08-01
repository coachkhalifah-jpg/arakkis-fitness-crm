"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function Navigation() {
  const pathname = usePathname();
  const bookingMode = pathname.startsWith("/register/");
  if (bookingMode) return null;
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/90 backdrop-blur">
      <nav
        className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8"
        aria-label="Main navigation"
      >
        <Link className="flex items-center gap-2 font-semibold tracking-tight text-ink" href="/">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand text-sm font-bold text-white">
            F
          </span>
          Fitness Event CRM
        </Link>
        <div className="flex items-center gap-5 text-sm font-semibold">
          <Link className="hidden text-slate-600 hover:text-brand sm:inline" href="/events">
            Explore events
          </Link>
          <Link className="text-slate-600 hover:text-brand" href="/admin/sign-in">
            {pathname.startsWith("/admin") ? "Operational Workspace" : "Admin sign-in"}
          </Link>
        </div>
      </nav>
    </header>
  );
}
