"use client";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <section className="mx-auto max-w-5xl px-6 py-16">
      <h1 className="text-3xl font-semibold text-ink">Something went wrong</h1>
      <p className="mt-3 text-slate-600">Please try again.</p>
      <button className="mt-6 rounded-md bg-brand px-4 py-2 text-white" onClick={() => reset()}>
        Try again
      </button>
    </section>
  );
}
