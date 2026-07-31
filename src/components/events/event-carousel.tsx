"use client";

import Link from "next/link";
import { useRef } from "react";

type EventCard = {
  id: string;
  name: string;
  date: string;
  time: string;
  venue: string;
  spots: number;
  href: string;
  availability: string;
};

const art = [
  "from-[#174c68] via-[#2e8f88] to-[#d7a779]",
  "from-[#d66d55] via-[#e8b26e] to-[#4b3a66]",
  "from-[#24345d] via-[#6875b8] to-[#d7e0d7]",
];

export function EventCarousel({ events }: { events: EventCard[] }) {
  const track = useRef<HTMLDivElement>(null);
  const move = (direction: number) => {
    track.current?.scrollBy({
      left: direction * (track.current.clientWidth * 0.82),
      behavior: "smooth",
    });
  };
  return (
    <div className="relative mt-10">
      <div
        ref={track}
        className="event-carousel -mx-5 flex snap-x snap-mandatory gap-5 overflow-x-auto px-5 pb-6 sm:-mx-8 sm:px-8"
        aria-label="Upcoming classes"
      >
        {events.map((event, index) => (
          <article
            key={event.id}
            className="w-[min(82vw,25rem)] shrink-0 snap-start overflow-hidden rounded-[2rem] border-2 border-ink bg-white shadow-[0_10px_0_#17212b] transition duration-200 hover:-translate-y-1 hover:shadow-[0_14px_0_#17212b]"
          >
            <div
              className={`relative flex aspect-[1.18] items-end overflow-hidden bg-gradient-to-br ${art[index % art.length]} p-6`}
            >
              <div className="absolute -right-10 -top-12 h-44 w-44 rounded-full border-[22px] border-white/25" />
              <div className="absolute bottom-8 left-8 h-20 w-20 rotate-12 rounded-3xl bg-white/20 backdrop-blur-sm" />
              <p className="relative max-w-[13ch] text-3xl font-black leading-[0.92] tracking-[-0.05em] text-white">
                Move with your people.
              </p>
            </div>
            <div className="p-5">
              <h2 className="min-h-[3.5rem] text-xl font-bold leading-tight tracking-[-0.025em]">
                {event.name}
              </h2>
              <p className="mt-3 text-sm font-semibold text-coral">
                {event.date} · {event.time}
              </p>
              <p className="mt-1 truncate text-sm text-slate-500">{event.venue}</p>
              <div className="mt-5 flex items-center justify-between gap-3">
                <span
                  className={`text-sm font-semibold ${event.spots > 0 ? "text-brand" : "text-slate-500"}`}
                >
                  {event.spots > 0
                    ? `${event.spots} spots left`
                    : event.availability === "LEGALLY_BLOCKED"
                      ? "Booking paused"
                      : "Full"}
                </span>
                <Link
                  className="rounded-xl bg-brand px-4 py-3 text-sm font-bold text-white transition hover:bg-brand-dark focus-visible:ring-2 focus-visible:ring-brand/40"
                  href={event.href}
                >
                  {event.spots > 0 ? "View class" : "View details"}
                </Link>
              </div>
            </div>
          </article>
        ))}
      </div>
      {events.length > 1 ? (
        <div className="mt-1 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => move(-1)}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-300 bg-white text-xl shadow-sm"
            aria-label="Previous class"
          >
            ←
          </button>
          <button
            type="button"
            onClick={() => move(1)}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-300 bg-white text-xl shadow-sm"
            aria-label="Next class"
          >
            →
          </button>
        </div>
      ) : null}
    </div>
  );
}
