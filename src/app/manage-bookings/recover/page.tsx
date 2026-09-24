import { redirect } from "next/navigation";
import { PublicErrorState } from "@/components/registration/public-error-state";
import { consumeParticipantManageRecovery } from "@/lib/registration/device";

export default async function ManageBookingsRecoverPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const token = (await searchParams).token?.trim() ?? "";
  if (!token) {
    return (
      <PublicErrorState
        variant="recovery"
        eyebrow="Bookings"
        title="This recovery link isn’t available."
        message="Ask your admin for a new manage link, or use a saved confirmation link from a device you already use."
        actionLabel="Browse events"
        actionHref="/events"
        secondaryActionLabel="View your bookings"
        secondaryActionHref="/manage-bookings"
      />
    );
  }

  const result = await consumeParticipantManageRecovery(token);
  if (!("error" in result)) {
    redirect("/");
  }

  return (
    <PublicErrorState
      variant="recovery"
      eyebrow="Bookings"
      title="This recovery link isn’t available."
      message="It may have expired, already been used, or been revoked. Ask your admin for a new manage link, or use a saved confirmation link."
      actionLabel="Browse events"
      actionHref="/events"
      secondaryActionLabel="View your bookings"
      secondaryActionHref="/manage-bookings"
    />
  );
}
