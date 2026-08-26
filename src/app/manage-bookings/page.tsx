import { redirect } from "next/navigation";
import { PublicErrorState } from "@/components/registration/public-error-state";
import { resolveRememberedParticipant } from "@/lib/registration/device";

export default async function ManageBookingsPage() {
  if (await resolveRememberedParticipant()) redirect("/");

  return (
    <PublicErrorState
      code="NO LINK"
      title="This device is not connected to your bookings."
      message="Use your saved confirmation or booking link to access a specific reservation."
      actionLabel="Browse events"
      actionHref="/events"
    />
  );
}
