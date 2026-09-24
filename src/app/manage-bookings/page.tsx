import { PublicErrorState } from "@/components/registration/public-error-state";
import { resolveRememberedParticipant } from "@/lib/registration/device";
import { redirect } from "next/navigation";

export default async function ManageBookingsPage() {
  if (await resolveRememberedParticipant()) redirect("/");

  return (
    <PublicErrorState
      variant="recovery"
      eyebrow="Bookings"
      title="Open a booking with a saved link."
      message="This page opens a reservation from a confirmation or booking link you already have. After you book, you can also choose Remember this device on that browser so your upcoming classes appear here. Browse events to book, or return home if you need to find a saved link."
      actionLabel="Browse events"
      actionHref="/events"
      secondaryActionLabel="Return home"
      secondaryActionHref="/"
    />
  );
}
