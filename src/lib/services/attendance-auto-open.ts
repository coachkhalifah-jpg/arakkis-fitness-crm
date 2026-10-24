import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

/** On-access reconcile for one Event (Manage Event). Soft-fails so page load is not blocked. */
export async function reconcileAttendanceOpenForEvent(
  db: SupabaseClient,
  eventId: string,
): Promise<{ attendance_processing_state?: string } | null> {
  const { data, error } = await db.rpc("phase5_auto_open_attendance_if_due", {
    p_event_id: eventId,
  } as never);
  if (error) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[attendance] auto-open reconcile failed", {
        eventId,
        message: error.message,
      });
    }
    return null;
  }
  return (data as { attendance_processing_state?: string } | null) ?? null;
}

/** Batch on-access reconcile for Admin Events discovery. Soft-fails. */
export async function reconcileDueAttendanceOpens(db: SupabaseClient): Promise<number> {
  const { data, error } = await db.rpc("phase5_reconcile_due_attendance_opens" as never);
  if (error) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[attendance] due auto-open reconcile failed", {
        message: error.message,
      });
    }
    return 0;
  }
  return typeof data === "number" ? data : Number(data ?? 0);
}
