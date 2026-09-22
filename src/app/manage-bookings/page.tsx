import { PublicErrorState } from "@/components/registration/public-error-state";
import { resolveRememberedParticipant } from "@/lib/registration/device";
import { redirect } from "next/navigation";

export default async function ManageBookingsPage() {
  if (await resolveRememberedParticipant()) redirect("/");

  return (
    <PublicErrorState
      variant="recovery"
      eyebrow="Bookings"
      title="This device isn’t connected to your bookings yet."
      message="Use a saved confirmation or booking link to open a reservation. After you book, choose Remember this device so you can see and manage all your classes here."
      actionLabel="Browse events"
      actionHref="/events"
      secondaryActionLabel="Return home"
      secondaryActionHref="/"
    />
  );
}
