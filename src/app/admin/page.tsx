import { Alert } from "@/components/ui/alert";

export default function AdminPage() {
  return (
    <section className="mx-auto max-w-5xl px-6 py-16">
      <div className="max-w-2xl">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand">Admin area</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-ink">
          Development placeholder
        </h1>
        <Alert className="mt-8">
          Authentication and authorization will be implemented in a later phase. No administrator
          access is available yet.
        </Alert>
      </div>
    </section>
  );
}
