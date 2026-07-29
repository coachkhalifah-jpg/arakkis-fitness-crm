export default function Loading() {
  return (
    <div
      className="mx-auto max-w-6xl px-5 py-12 sm:px-8 sm:py-16"
      aria-busy="true"
      aria-live="polite"
    >
      <span className="sr-only">Loading page</span>
      <div className="h-4 w-32 animate-pulse rounded-full bg-slate-200" />
      <div className="mt-4 h-10 w-3/4 max-w-xl animate-pulse rounded-xl bg-slate-200" />
      <div className="mt-3 h-5 w-full max-w-2xl animate-pulse rounded-xl bg-slate-200" />
      <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((item) => (
          <div key={item} className="h-72 animate-pulse rounded-2xl bg-white shadow-sm" />
        ))}
      </div>
    </div>
  );
}
