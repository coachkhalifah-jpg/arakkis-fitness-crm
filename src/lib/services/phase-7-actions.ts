"use server";

import { revalidatePath } from "next/cache";
import { requireSystemAdmin } from "@/lib/authorization/server";
import { createClient } from "@/lib/db/server";
import { getServerEnv } from "@/lib/config/env";
import { audit, Phase3Error } from "@/lib/services/phase-3";
import { assertPublicSlug, normalizePublicSlug } from "@/lib/services/phase-7";

export type Phase7ActionState = { error?: string; success?: string };

async function scopedEvent(id: string) {
  const admin = await requireSystemAdmin();
  const db = await createClient();
  const { data: event } = await db.from("events").select("*").eq("id", id).maybeSingle();
  if (!event) {
    throw new Phase3Error("forbidden", "You do not have access to this event.");
  }
  return { admin, db, event };
}

export async function publishPhase7Event(id: string): Promise<Phase7ActionState> {
  try {
    const { admin, db, event } = await scopedEvent(id);
    if (event.status === "CANCELLED" || event.archived_at)
      throw new Phase3Error("forbidden", "Cancelled events cannot be published.");
    const { data: series } = event.event_series_id
      ? await db
          .from("event_series")
          .select("id,public_slug")
          .eq("id", event.event_series_id)
          .maybeSingle()
      : { data: null };
    if (series) {
      const slug = series.public_slug ?? normalizePublicSlug(event.name);
      assertPublicSlug(slug);
      const { error: seriesError } = await db
        .from("event_series")
        .update({ public_slug: slug })
        .eq("id", series.id);
      const { error } = await db
        .from("events")
        .update({
          status: "OPEN",
          publication_status: "PUBLISHED",
          last_published_at: new Date().toISOString(),
          published_by_admin_id: admin.userId,
        })
        .eq("event_series_id", series.id)
        .neq("status", "CANCELLED");
      if (seriesError || error)
        throw new Phase3Error(
          "conflict",
          seriesError?.code === "23505"
            ? "That public slug is already in use."
            : "Recurring series could not be published.",
        );
      await audit(admin.userId, "EVENT_SERIES_PUBLISHED", "EVENT_SERIES", series.id, {
        publication_status: "PUBLISHED",
        public_slug: slug,
      });
      revalidatePath("/admin/events");
      revalidatePath(`/register/${slug}`);
      return { success: "Recurring series published." };
    }
    const slug = event.public_slug ?? normalizePublicSlug(event.name);
    assertPublicSlug(slug);
    const { error } = await db
      .from("events")
      .update({
        status: "OPEN",
        publication_status: "PUBLISHED",
        public_slug: slug,
        last_published_at: new Date().toISOString(),
        published_by_admin_id: admin.userId,
      })
      .eq("id", id);
    if (error)
      throw new Phase3Error(
        "conflict",
        error.code === "23505"
          ? "That public slug is already in use."
          : "Event could not be published.",
      );
    await audit(
      admin.userId,
      "EVENT_PUBLISHED",
      "EVENT",
      id,
      { publication_status: "PUBLISHED", public_slug: slug },
      event,
    );
    revalidatePath("/admin/events");
    revalidatePath(`/admin/events/${id}`);
    revalidatePath(`/register/${slug}`);
    return { success: "Event published." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Event could not be published." };
  }
}

export async function unpublishPhase7Event(id: string): Promise<Phase7ActionState> {
  try {
    const { admin, db, event } = await scopedEvent(id);
    if (event.event_series_id) {
      const { error } = await db
        .from("events")
        .update({ publication_status: "UNPUBLISHED" })
        .eq("event_series_id", event.event_series_id);
      if (error) throw new Phase3Error("conflict", "Recurring series could not be unpublished.");
      await audit(admin.userId, "EVENT_SERIES_UNPUBLISHED", "EVENT_SERIES", event.event_series_id, {
        publication_status: "UNPUBLISHED",
      });
      revalidatePath("/admin/events");
      return { success: "Recurring series unpublished." };
    }
    const { error } = await db
      .from("events")
      .update({ publication_status: "UNPUBLISHED" })
      .eq("id", id);
    if (error) throw new Phase3Error("conflict", "Event could not be unpublished.");
    await audit(
      admin.userId,
      "EVENT_UNPUBLISHED",
      "EVENT",
      id,
      { publication_status: "UNPUBLISHED" },
      event,
    );
    revalidatePath("/admin/events");
    revalidatePath(`/admin/events/${id}`);
    return { success: "Event unpublished." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Event could not be unpublished." };
  }
}

export async function setPhase7Slug(id: string, value: string): Promise<Phase7ActionState> {
  try {
    const { admin, db, event } = await scopedEvent(id);
    const slug = assertPublicSlug(normalizePublicSlug(value));
    if (event.event_series_id) {
      const { error } = await db
        .from("event_series")
        .update({ public_slug: slug })
        .eq("id", event.event_series_id);
      if (error)
        throw new Phase3Error(
          "conflict",
          error.code === "23505"
            ? "That public slug is already in use."
            : "Series public slug could not be saved.",
        );
      await audit(
        admin.userId,
        "EVENT_SERIES_SLUG_CHANGED",
        "EVENT_SERIES",
        event.event_series_id,
        { public_slug: slug },
      );
      revalidatePath(`/admin/events/${id}`);
      return { success: "Series public slug saved." };
    }
    const { error } = await db.from("events").update({ public_slug: slug }).eq("id", id);
    if (error)
      throw new Phase3Error(
        "conflict",
        error.code === "23505"
          ? "That public slug is already in use."
          : "Public slug could not be saved.",
      );
    await audit(admin.userId, "EVENT_SLUG_CHANGED", "EVENT", id, { public_slug: slug }, event);
    revalidatePath(`/admin/events/${id}`);
    return { success: "Public slug saved." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Public slug could not be saved." };
  }
}

export async function setRegistrationPaused(
  id: string,
  paused: boolean,
): Promise<Phase7ActionState> {
  try {
    const { admin, db, event } = await scopedEvent(id);
    const value = paused ? new Date().toISOString() : null;
    const { error } = await db
      .from("events")
      .update({ registration_paused_at: value })
      .eq("id", id);
    if (error) throw new Phase3Error("conflict", "Registration availability could not be changed.");
    await audit(
      admin.userId,
      paused ? "REGISTRATION_PAUSED" : "REGISTRATION_RESUMED",
      "EVENT",
      id,
      { registration_paused_at: value },
      event,
    );
    revalidatePath("/admin/events");
    revalidatePath(`/admin/events/${id}`);
    return { success: paused ? "Registration paused." : "Registration resumed." };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Registration availability could not be changed.",
    };
  }
}

export async function phase7EventUrl(slug: string) {
  const env = getServerEnv();
  const base = env.APP_BASE_URL || env.NEXT_PUBLIC_APP_URL;
  return `${base.replace(/\/+$/, "")}/register/${encodeURIComponent(assertPublicSlug(slug))}`;
}

export async function publishPhase7EventForm(id: string) {
  await publishPhase7Event(id);
}

export async function unpublishPhase7EventForm(id: string) {
  await unpublishPhase7Event(id);
}

export async function pausePhase7EventForm(formData: FormData) {
  await setRegistrationPaused(String(formData.get("eventId") ?? ""), true);
}

export async function resumePhase7EventForm(formData: FormData) {
  await setRegistrationPaused(String(formData.get("eventId") ?? ""), false);
}

export async function setPhase7SlugForm(id: string, formData: FormData) {
  await setPhase7Slug(id, String(formData.get("publicSlug") ?? ""));
}
