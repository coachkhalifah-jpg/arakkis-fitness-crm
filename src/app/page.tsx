import { Card } from "@/components/ui/card";

export default function HomePage() {
  return (
    <section className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl items-center px-6 py-16">
      <Card className="max-w-2xl border-brand/20 bg-white p-8 shadow-sm sm:p-12">
        <p className="mb-4 text-sm font-semibold uppercase tracking-[0.18em] text-brand">
          Fitness Event CRM
        </p>
        <h1 className="text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
          The foundation is running.
        </h1>
        <p className="mt-6 max-w-xl text-lg leading-8 text-slate-600">
          Phase 0 establishes the application shell and engineering foundations. Event registration
          and administration will arrive in later approved phases.
        </p>
      </Card>
    </section>
  );
}
