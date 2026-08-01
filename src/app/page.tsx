import { Badge } from "@/components/ui/badge";
import Link from "next/link";

export default function HomePage() {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute -right-32 -top-24 h-96 w-96 rounded-full bg-brand/10 blur-3xl" />
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl items-center gap-12 px-5 py-16 sm:px-8 lg:grid-cols-[1.1fr_.9fr] lg:py-24">
        <div className="relative">
          <Badge>Move better, together</Badge>
          <h1 className="mt-6 max-w-3xl text-5xl font-semibold leading-[1.03] tracking-[-0.04em] text-ink sm:text-7xl">
            The foundation is running — move better, together.
          </h1>
          <p className="mt-7 max-w-xl text-lg leading-8 text-slate-600">
            Welcoming, well-organized fitness events for real communities. Find a date that fits and
            reserve your spot in under a minute.
          </p>
          <div className="public-primary-stack mt-9">
            <Link
              className="public-primary-control bg-white/[0.72] text-ink shadow-soft hover:bg-white/[0.85]"
              href="/events"
            >
              Explore upcoming events{" "}
              <span aria-hidden="true" className="ml-2">
                →
              </span>
            </Link>
            <Link
              className="public-primary-control border border-white/70 bg-white/[0.58] text-ink hover:border-brand hover:bg-white/[0.8] hover:text-brand"
              href="/registration"
            >
              Reserve by date
            </Link>
          </div>
          <div className="mt-12 flex flex-wrap gap-x-8 gap-y-3 text-sm font-medium text-slate-600">
            <span>✓ No account required</span>
            <span>✓ One simple form</span>
            <span>✓ Calendar-ready</span>
          </div>
        </div>
        <div className="relative rounded-[2rem] bg-brand p-5 shadow-soft sm:p-7">
          <div className="rounded-[1.5rem] bg-sand p-6 sm:p-8">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand">
              Your next good hour
            </p>
            <div className="mt-10 rounded-2xl bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-coral">SAT · 9:00 AM</p>
                  <h2 className="mt-2 text-2xl font-semibold">Community Flow</h2>
                </div>
                <span className="rounded-full bg-brand/10 px-3 py-1 text-xs font-bold text-brand">
                  Open
                </span>
              </div>
              <p className="mt-5 text-sm leading-6 text-slate-600">
                A steady, energizing session designed to leave you feeling stronger and lighter.
              </p>
              <div className="mt-5 border-t border-slate-100 pt-4 text-sm text-slate-500">
                The Garden Studio · 8 spots left
              </div>
            </div>
            <p className="mt-6 text-center text-sm font-medium text-brand">
              Small groups. Good energy. Come as you are.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
