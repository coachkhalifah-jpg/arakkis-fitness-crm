import Link from "next/link";

export function Navigation() {
  return (
    <header className="border-b border-slate-200 bg-white">
      <nav
        className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4"
        aria-label="Main navigation"
      >
        <Link className="font-semibold tracking-tight text-ink" href="/">
          Fitness Event CRM
        </Link>
        <Link className="text-sm font-medium text-slate-600 hover:text-brand" href="/admin">
          Admin placeholder
        </Link>
      </nav>
    </header>
  );
}
