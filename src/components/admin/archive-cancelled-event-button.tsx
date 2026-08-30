"use client";

import { ConfirmSubmit } from "@/components/admin/confirm-submit";

export function ArchiveCancelledEventButton({
  eventId,
  eventName,
  action,
}: {
  eventId: string;
  eventName: string;
  action: (id: string) => Promise<void>;
}) {
  return (
    <form action={action.bind(null, eventId)}>
      <ConfirmSubmit
        message={`Archive “${eventName}”? Its registrations and history will be preserved.`}
      >
        Archive event
      </ConfirmSubmit>
    </form>
  );
}
