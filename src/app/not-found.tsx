import Link from "next/link";

export default function NotFound() {
  return (
    <section className="mx-auto max-w-5xl px-6 py-16">
      <h1 className="text-3xl font-semibold text-ink">Page not found</h1>
      <p className="mt-3 text-slate-600">The requested page does not exist.</p>
      <Link className="mt-6 inline-block text-brand underline" href="/">
        Return home
      </Link>
    </section>
  );
}
