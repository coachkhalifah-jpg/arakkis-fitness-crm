"use client";

import { useEffect, useRef } from "react";
import { eventCardAsset } from "@/lib/config/admin-visual-assets";
import { FloatingBackButton } from "@/components/registration/floating-back-button";
import { participantDisplayName } from "@/lib/registration/display";

export function EventHero({
  eventName,
  host,
  venue,
  imageUrl,
  mobileImageUrl,
  focalPosition = "center",
}: {
  eventName: string;
  host: string;
  venue: string;
  imageUrl?: string;
  mobileImageUrl?: string;
  focalPosition?: string;
}) {
  const heroRef = useRef<HTMLDivElement>(null);
  const displayEventName = participantDisplayName(eventName);
  const displayHost = participantDisplayName(host);
  const displayVenue = participantDisplayName(venue);
  const image = imageUrl ?? eventCardAsset(eventName);

  useEffect(() => {
    const hero = heroRef.current;
    if (!hero || typeof window === "undefined") return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;

    const updateProgress = () => {
      frame = 0;
      const rect = hero.getBoundingClientRect();
      const fadeStart = 16;
      const fadeEnd = Math.max(hero.offsetHeight * 0.68, 1);
      const scrolled = Math.max(0, -rect.top - fadeStart);
      const progress = Math.min(1, scrolled / fadeEnd);

      hero.style.setProperty("--hero-progress", progress.toFixed(3));
      hero.style.setProperty("--hero-sharp-opacity", (1 - progress * 0.9).toFixed(3));
      hero.style.setProperty("--hero-sharp-scale", (1 + progress * 0.03).toFixed(3));
      hero.style.setProperty("--hero-sharp-blur", `${(progress * 6).toFixed(2)}px`);
      hero.style.setProperty("--hero-blur-opacity", (0.42 * (1 - progress * 0.85)).toFixed(3));
      hero.style.setProperty("--hero-content-opacity", (1 - progress * 0.82).toFixed(3));
      hero.style.setProperty("--hero-content-shift", `${(progress * -8).toFixed(2)}px`);
    };

    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(updateProgress);
    };

    if (reducedMotion.matches) {
      hero.style.setProperty("--hero-progress", "0");
      hero.style.setProperty("--hero-sharp-opacity", "1");
      hero.style.setProperty("--hero-sharp-scale", "1");
      hero.style.setProperty("--hero-sharp-blur", "0px");
      hero.style.setProperty("--hero-blur-opacity", "0.42");
      hero.style.setProperty("--hero-content-opacity", "1");
      hero.style.setProperty("--hero-content-shift", "0px");
      return;
    }
    updateProgress();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  const imageStyle = {
    backgroundImage: `url(${image})`,
    "--event-focal": focalPosition,
  } as React.CSSProperties;

  return (
    <div
      ref={heroRef}
      className="event-hero relative overflow-hidden"
      style={
        {
          "--event-image": `url(${image})`,
          "--event-image-mobile": `url(${mobileImageUrl ?? image})`,
          "--event-focal": focalPosition,
        } as React.CSSProperties
      }
    >
      <div
        className="event-hero-image event-hero-image-blur absolute inset-[-3%] bg-cover"
        style={imageStyle}
        aria-hidden="true"
      />
      <div
        className="event-hero-image event-hero-image-sharp absolute inset-0 bg-cover"
        style={imageStyle}
        role="img"
        aria-label={`${displayEventName} event image`}
      />
      <div className="event-hero-overlay absolute inset-0" aria-hidden="true" />
      <div className="form-page-scroll-fade relative mx-auto flex h-full max-w-3xl flex-col justify-end px-5 pb-12 pt-20 sm:px-8">
        <FloatingBackButton />
        <div className="event-hero-identity mx-auto max-w-[92%] text-center text-white">
          <p className="event-hero-host">{displayHost}</p>
          <h1 className="event-hero-title">{displayEventName}</h1>
          <p className="event-hero-venue">{displayVenue}</p>
        </div>
      </div>
    </div>
  );
}
