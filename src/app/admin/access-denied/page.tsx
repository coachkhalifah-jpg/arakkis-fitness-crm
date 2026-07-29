import Link from "next/link";

export default function AccessDeniedPage() {
  return (
    <section className="mx-auto max-w-xl px-6 py-16">
      <h1 className="text-4xl font-semibold tracking-tight text-ink">Access denied</h1>
      <p className="mt-4 text-slate-600">Your account does not have active administrator access.</p>
      <Link className="mt-6 inline-block text-brand underline" href="/">
        Return home
      </Link>
    </section>
  );
}
