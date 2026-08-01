import { eventCardAsset } from "@/lib/config/admin-visual-assets";
import { FloatingBackButton } from "@/components/registration/floating-back-button";

export function EventHero({
  eventName,
  host,
  venue,
  date,
  availability,
}: {
  eventName: string;
  host: string;
  venue: string;
  date: string;
  availability: string;
}) {
  return (
    <div className="event-hero relative overflow-hidden rounded-b-[2.5rem]">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${eventCardAsset(eventName)})` }}
        role="img"
        aria-label={`${eventName} event image`}
      />
      <div className="event-hero-overlay absolute inset-0" />
      <div className="relative mx-auto flex min-h-[min(58svh,34rem)] max-w-3xl flex-col justify-end px-5 pb-12 pt-20 sm:px-8">
        <FloatingBackButton />
        <div className="max-w-xl text-white">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/75">{host}</p>
          <h1 className="mt-3 text-4xl font-semibold leading-[0.98] tracking-[-0.05em] sm:text-6xl">
            {eventName}
          </h1>
          <p className="mt-5 text-sm font-semibold text-white/85 sm:text-base">
            {date} · {venue}
          </p>
          <span className="mt-4 inline-flex rounded-full border border-white/30 bg-white/15 px-3 py-1 text-sm font-semibold backdrop-blur-sm">
            {availability.replaceAll("_", " ")}
          </span>
        </div>
      </div>
    </div>
  );
}
