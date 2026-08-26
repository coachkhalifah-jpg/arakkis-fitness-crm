"use client";

import Link from "next/link";
import { useRef } from "react";

type EventCard = {
  id: string;
  name: string;
  date: { weekday: string; day: string; month: string };
  time: string;
  organizationName?: string;
  venueName?: string;
  spots: number;
  href: string;
  availability: string;
  imageUrl?: string;
  titleColor?: string;
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
        className="event-card-carousel flex gap-5 overflow-x-auto pb-6"
        aria-label="Upcoming classes"
      >
        {events.map((event, index) => (
          <Link
            key={event.id}
            href={event.href}
            className="event-card-shell event-card-public-link"
          >
            <span
              className={`event-card-media relative block bg-gradient-to-br ${art[index % art.length]}`}
              style={event.imageUrl ? { backgroundImage: `url(${event.imageUrl})` } : undefined}
            >
              <span className="absolute left-4 top-4 rounded-full bg-black/35 px-3 py-1 text-[0.68rem] font-bold uppercase tracking-[.16em] text-white backdrop-blur-sm">
                {event.spots > 0
                  ? "OPEN"
                  : event.availability === "LEGALLY_BLOCKED"
                    ? "BOOKING PAUSED"
                    : "FULL"}
              </span>
              <span
                className="event-card-title-overlay"
                style={{ color: event.titleColor ?? "#FFFFFF" }}
              >
                {event.name}
              </span>
            </span>
            <span className="event-card-caption block text-left">
              <span className="event-card-date-time-row mt-2 flex items-center justify-between gap-2">
                <span className="event-card-date-block block text-left">
                  <span className="block text-[0.65rem] font-bold uppercase tracking-[0.14em] text-slate-600">
                    {event.date.weekday}
                  </span>
                  <span className="my-0.5 block text-2xl font-bold tracking-tight text-ink">
                    {event.date.day}
                  </span>
                  <span className="block text-[0.65rem] font-bold uppercase tracking-[0.14em] text-slate-600">
                    {event.date.month}
                  </span>
                </span>
                <span className="event-card-time text-right text-2xl font-bold tracking-tight text-ink">
                  {event.time}
                </span>
              </span>
              {event.organizationName ? (
                <span className="mt-2 block text-xs font-semibold uppercase tracking-[0.08em] text-slate-600">
                  {event.organizationName}
                </span>
              ) : null}
              {event.venueName ? (
                <span className="block text-xs font-semibold uppercase tracking-[0.08em] text-slate-600">
                  {event.venueName}
                </span>
              ) : null}
              <span className="mt-2 block text-xs font-semibold text-brand">
                {event.spots > 0 ? "spots available" : "full"}
              </span>
            </span>
          </Link>
        ))}
      </div>
      {events.length > 1 ? (
        <div className="event-card-carousel-controls" aria-label="Event carousel controls">
          <button
            type="button"
            onClick={() => move(-1)}
            className="ui-button ui-button-icon"
            aria-label="Previous class"
          >
            ←
          </button>
          <button
            type="button"
            onClick={() => move(1)}
            className="ui-button ui-button-icon"
            aria-label="Next class"
          >
            →
          </button>
        </div>
      ) : null}
    </div>
  );
}
