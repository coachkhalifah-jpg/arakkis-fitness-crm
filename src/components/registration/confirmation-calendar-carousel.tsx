"use client";

import { Children, useEffect, useRef, useState, type ReactNode } from "react";

export function ConfirmationCalendarCarousel({ children }: { children: ReactNode }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const childCount = Children.count(children);
  const [canScrollBack, setCanScrollBack] = useState(false);
  const [canScrollForward, setCanScrollForward] = useState(false);

  function updateControls() {
    const track = trackRef.current;
    if (!track) return;
    setCanScrollBack(track.scrollLeft > 4);
    setCanScrollForward(track.scrollLeft + track.clientWidth < track.scrollWidth - 4);
  }

  useEffect(() => {
    updateControls();
    const track = trackRef.current;
    if (!track) return;
    track.addEventListener("scroll", updateControls, { passive: true });
    window.addEventListener("resize", updateControls);
    return () => {
      track.removeEventListener("scroll", updateControls);
      window.removeEventListener("resize", updateControls);
    };
  }, []);

  function move(direction: number) {
    trackRef.current?.scrollBy({
      left: direction * (trackRef.current.clientWidth * 0.82),
      behavior: "smooth",
    });
  }

  return (
    <div className="confirmation-calendar-carousel-wrapper confirmation-calendar-carousel-breakout">
      <div
        ref={trackRef}
        className={`confirmation-calendar-session-list${childCount === 1 ? " is-single" : ""}`}
      >
        {children}
      </div>
      {canScrollBack ? (
        <button
          type="button"
          className="confirmation-calendar-carousel-control confirmation-calendar-carousel-control-previous"
          onClick={() => move(-1)}
          aria-label="Previous booking"
        >
          ‹
        </button>
      ) : null}
      {canScrollForward ? (
        <button
          type="button"
          className="confirmation-calendar-carousel-control confirmation-calendar-carousel-control-next"
          onClick={() => move(1)}
          aria-label="Next booking"
        >
          ›
        </button>
      ) : null}
    </div>
  );
}
