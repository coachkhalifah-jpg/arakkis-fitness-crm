"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function ParticipantModeNav() {
  const pathname = usePathname();
  const eventsActive = pathname === "/events";
  const bookingsActive = pathname === "/";

  return (
    <nav
      className="participant-events-mode-nav"
      data-active={eventsActive ? "events" : bookingsActive ? "bookings" : undefined}
      aria-label="Participant navigation"
    >
      <Link href="/events" prefetch aria-current={eventsActive ? "page" : undefined}>
        Events
      </Link>
      <Link href="/" prefetch aria-current={bookingsActive ? "page" : undefined}>
        Manage bookings
      </Link>
    </nav>
  );
}
