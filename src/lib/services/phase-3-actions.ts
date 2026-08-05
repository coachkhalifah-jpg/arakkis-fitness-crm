"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireActiveAdmin, requireSystemAdmin } from "@/lib/authorization/server";
import { createClient } from "@/lib/db/server";
import { createPrivilegedClient } from "@/lib/db/privileged";
import {
  audit,
  eventSchema,
  buildWeeklyOccurrences,
  localDateTimeToUtc,
  organizationSchema,
  parseCommunicationLink,
  parseEventTimes,
  Phase3Error,
  recurrenceSchema,
  venueSchema,
} from "@/lib/services/phase-3";
import {
  createWalkInSubmit as phase5CreateWalkInSubmit,
  finalizeAttendanceSubmit as phase5FinalizeAttendanceSubmit,
  markAttendance as phase5MarkAttendance,
  markAttendanceSubmit as phase5MarkAttendanceSubmit,
  openAttendanceSubmit as phase5OpenAttendanceSubmit,
  reopenAttendanceSubmit as phase5ReopenAttendanceSubmit,
} from "@/lib/services/phase-5-actions";

export type Phase3ActionState = {
  error?: string;
  errorAction?: string;
  errorCode?: string;
  success?: string;
};
const message = (error: unknown) =>
  error instanceof Phase3Error || error instanceof Error
    ? error.message
    : "The request could not be completed.";
const value = (form: FormData, key: string) => String(form.get(key) ?? "").trim();
const eventImageMimeTypes = ["image/jpeg", "image/png", "image/webp", "image/svg+xml"];
const maxEventImageBytes = 5 * 1024 * 1024;

export async function setOccurrenceLocationOverride(form: FormData): Promise<Phase3ActionState> {
  try {
    const admin = await requireSystemAdmin();
    const eventId = value(form, "eventId");
    const venueId = value(form, "venueId");
    const db = await createClient();
    const { data: event } = await db
      .from("events")
      .select("id,venue_id,host_organization_id")
      .eq("id", eventId)
      .single();
    if (!event) throw new Phase3Error("not_found", "Occurrence not found.");
    const { data: venue } = await db
      .from("venues")
      .select("id,organization_id,active_status")
      .eq("id", venueId)
      .single();
    if (!venue || venue.active_status !== "ACTIVE")
      throw new Phase3Error("invalid", "Choose an active venue.");
    const { error } = await db
      .from("events")
      .update({
        location_override_venue_id: venue.id,
        location_override_at: new Date().toISOString(),
        location_override_by_admin_id: admin.userId,
        location_override_note: value(form, "note") || null,
      })
      .eq("id", eventId);
    if (error) throw new Phase3Error("conflict", "Occurrence location could not be updated.");
    await audit(
      admin.userId,
      "EVENT_OCCURRENCE_LOCATION_UPDATED",
      "EVENT",
      eventId,
      { old_venue_id: event.venue_id, new_venue_id: venue.id, note: value(form, "note") },
      event,
    );
    revalidatePath(`/admin/events/${eventId}`);
    revalidatePath("/events");
    return { success: "This occurrence now uses the selected venue." };
  } catch (error) {
    return { error: message(error) };
  }
}

export async function setOccurrenceLocationOverrideSubmit(form: FormData): Promise<void> {
  await setOccurrenceLocationOverride(form);
}

function eventImageFile(form: FormData) {
  const file = form.get("eventImage");
  if (!(file instanceof File) || file.size === 0) return null;
  if (file.size > maxEventImageBytes)
    throw new Phase3Error("invalid", "Event images must be 5 MiB or smaller.");
  if (!eventImageMimeTypes.includes(file.type))
    throw new Phase3Error("invalid", "Use a JPEG, PNG, WebP, or SVG event image.");
  return file;
}

function eventImageExtension(file: File) {
  if (file.type === "image/svg+xml") return ".svg";
  if (file.type === "image/png") return ".png";
  if (file.type === "image/webp") return ".webp";
  return ".jpg";
}

async function saveEventImages(
  db: Awaited<ReturnType<typeof createClient>>,
  adminId: string,
  eventIds: string[],
  eventName: string,
  file: File | null,
) {
  if (!file || !eventIds.length) return;
  const storage = createPrivilegedClient();
  const uploadedPaths: string[] = [];
  try {
    for (const eventId of eventIds) {
      const path = `event_image_desktop/${eventId}/${randomUUID()}${eventImageExtension(file)}`;
      const { error: uploadError } = await storage.storage
        .from("design-assets")
        .upload(path, await file.arrayBuffer(), {
          contentType: file.type,
          cacheControl: "31536000",
          upsert: false,
        });
      if (uploadError) throw new Phase3Error("conflict", "The event image could not be uploaded.");
      uploadedPaths.push(path);
      const { data: asset, error: insertError } = await db
        .from("design_assets")
        .insert({
          asset_type: "EVENT_IMAGE_DESKTOP",
          event_id: eventId,
          storage_path: path,
          original_filename: file.name.slice(0, 255),
          mime_type: file.type,
          byte_size: file.size,
          alt_text: `${eventName} event image`,
          focal_position: "center",
          created_by_admin_id: adminId,
        })
        .select("id")
        .single();
      if (insertError || !asset)
        throw new Phase3Error("conflict", "The event image metadata could not be saved.");
      const { error: auditError } = await db.from("audit_events").insert({
        actor_admin_id: adminId,
        action: "DESIGN_ASSET_UPLOADED",
        entity_type: "DESIGN_ASSET",
        entity_id: asset.id,
        new_values: {
          asset_type: "EVENT_IMAGE_DESKTOP",
          event_id: eventId,
          mime_type: file.type,
          byte_size: file.size,
        },
      });
      if (auditError)
        throw new Phase3Error("conflict", "The event image change could not be recorded.");
    }
  } catch (error) {
    if (uploadedPaths.length) await storage.storage.from("design-assets").remove(uploadedPaths);
    throw error;
  }
}

export async function createOrganization(
  _state: Phase3ActionState,
  form: FormData,
): Promise<Phase3ActionState> {
  try {
    const admin = await requireSystemAdmin();
    const input = organizationSchema.parse({
      name: value(form, "name"),
      organizationType: value(form, "organizationType"),
      street: value(form, "street"),
      city: value(form, "city"),
      state: value(form, "state"),
      postalCode: value(form, "postalCode"),
    });
    const db = await createClient();
    const { data, error } = await db
      .from("organizations")
      .insert({
        name: input.name,
        organization_type: input.organizationType || null,
        street: input.street || null,
        city: input.city || null,
        state: input.state || null,
        postal_code: input.postalCode || null,
      })
      .select("id")
      .single();
    if (error || !data)
      throw new Phase3Error(
        "conflict",
        error?.code === "23505"
          ? "An active organization with this name already exists."
          : "Organization could not be created.",
      );
    await audit(admin.userId, "ORGANIZATION_CREATED", "ORGANIZATION", data.id, input);
    revalidatePath("/admin/organizations");
    return { success: "Organization created." };
  } catch (error) {
    return { error: message(error) };
  }
}

export async function updateOrganization(
  _state: Phase3ActionState,
  form: FormData,
): Promise<Phase3ActionState> {
  try {
    const admin = await requireSystemAdmin();
    const id = value(form, "id");
    const input = organizationSchema.parse({
      name: value(form, "name"),
      organizationType: value(form, "organizationType"),
      street: value(form, "street"),
      city: value(form, "city"),
      state: value(form, "state"),
      postalCode: value(form, "postalCode"),
    });
    const db = await createClient();
    const { data: old } = await db.from("organizations").select("*").eq("id", id).single();
    if (!old) throw new Phase3Error("not_found", "Organization not found.");
    const { error } = await db
      .from("organizations")
      .update({
        name: input.name,
        organization_type: input.organizationType || null,
        street: input.street || null,
        city: input.city || null,
        state: input.state || null,
        postal_code: input.postalCode || null,
      })
      .eq("id", id);
    if (error)
      throw new Phase3Error(
        "conflict",
        error.code === "23505"
          ? "An active organization with this name already exists."
          : "Organization could not be updated.",
      );
    await audit(admin.userId, "ORGANIZATION_UPDATED", "ORGANIZATION", id, input, old);
    revalidatePath("/admin/organizations");
    return { success: "Organization updated." };
  } catch (error) {
    return { error: message(error) };
  }
}

export async function archiveOrganization(id: string): Promise<Phase3ActionState> {
  try {
    const admin = await requireSystemAdmin();
    const db = await createClient();
    const { data: old } = await db.from("organizations").select("*").eq("id", id).single();
    if (!old) throw new Phase3Error("not_found", "Organization not found.");
    const { error } = await db
      .from("organizations")
      .update({ active_status: "ARCHIVED", archived_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw new Phase3Error("conflict", "Organization could not be archived.");
    await audit(
      admin.userId,
      "ORGANIZATION_ARCHIVED",
      "ORGANIZATION",
      id,
      { active_status: "ARCHIVED" },
      old,
    );
    revalidatePath("/admin/organizations");
    return { success: "Organization archived." };
  } catch (error) {
    return { error: message(error) };
  }
}

export async function createVenue(
  _state: Phase3ActionState,
  form: FormData,
): Promise<Phase3ActionState> {
  try {
    const admin = await requireActiveAdmin();
    const assignedOrganizationId =
      admin.role === "HOST_ADMIN"
        ? admin.organizationIds.length === 1
          ? admin.organizationIds[0]
          : null
        : value(form, "organizationId");
    if (!assignedOrganizationId)
      throw new Phase3Error(
        "invalid",
        "Your account must have exactly one active organization assignment to create a venue.",
      );
    const input = venueSchema.parse({
      name: value(form, "name"),
      organizationId: assignedOrganizationId,
      street: value(form, "street"),
      city: value(form, "city"),
      state: value(form, "state"),
      postalCode: value(form, "postalCode"),
      timezone: value(form, "timezone"),
    });
    if (!isTimezone(input.timezone))
      throw new Phase3Error("invalid", "Choose a valid IANA timezone.");
    const db = await createClient();
    const { data: org } = await db
      .from("organizations")
      .select("id")
      .eq("id", input.organizationId)
      .eq("active_status", "ACTIVE")
      .single();
    if (!org) throw new Phase3Error("invalid", "Choose an active organization.");
    const { data, error } = await db
      .from("venues")
      .insert({
        organization_id: input.organizationId,
        name: input.name,
        street: input.street,
        city: input.city,
        state: input.state,
        postal_code: input.postalCode,
        timezone: input.timezone,
      })
      .select("id")
      .single();
    if (error || !data) throw new Phase3Error("conflict", "Venue could not be created.");
    await audit(admin.userId, "VENUE_CREATED", "VENUE", data.id, input);
    revalidatePath("/admin/venues");
    revalidatePath("/admin/events");
    return { success: "Venue created." };
  } catch (error) {
    return { error: message(error) };
  }
}

export async function archiveVenue(id: string): Promise<Phase3ActionState> {
  try {
    const admin = await requireSystemAdmin();
    const db = await createClient();
    const { data: old } = await db.from("venues").select("*").eq("id", id).single();
    if (!old) throw new Phase3Error("not_found", "Venue not found.");
    const { error } = await db
      .from("venues")
      .update({ active_status: "ARCHIVED", archived_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw new Phase3Error("conflict", "Venue could not be archived.");
    await audit(admin.userId, "VENUE_ARCHIVED", "VENUE", id, { active_status: "ARCHIVED" }, old);
    revalidatePath("/admin/venues");
    revalidatePath("/admin/events");
    return { success: "Venue archived." };
  } catch (error) {
    return { error: message(error) };
  }
}

export async function updateVenue(form: FormData): Promise<Phase3ActionState> {
  try {
    const admin = await requireActiveAdmin();
    const id = value(form, "id");
    const db = await createClient();
    const { data: old } = await db.from("venues").select("*").eq("id", id).single();
    if (!old) throw new Phase3Error("not_found", "Venue not found.");
    if (
      admin.role !== "SYSTEM_ADMIN" &&
      !admin.organizationIds.includes(old.organization_id ?? "")
    ) {
      throw new Phase3Error("forbidden", "You cannot edit this venue.");
    }
    const input = venueSchema.parse({
      name: value(form, "name"),
      organizationId:
        admin.role === "SYSTEM_ADMIN" ? value(form, "organizationId") : old.organization_id,
      street: value(form, "street"),
      city: value(form, "city"),
      state: value(form, "state"),
      postalCode: value(form, "postalCode"),
      timezone: value(form, "timezone"),
    });
    if (!isTimezone(input.timezone))
      throw new Phase3Error("invalid", "Choose a valid IANA timezone.");
    const { data: org } = await db
      .from("organizations")
      .select("id")
      .eq("id", input.organizationId)
      .eq("active_status", "ACTIVE")
      .single();
    if (!org) throw new Phase3Error("invalid", "Choose an active organization.");
    const { error } = await db
      .from("venues")
      .update({
        organization_id: input.organizationId,
        name: input.name,
        street: input.street,
        city: input.city,
        state: input.state,
        postal_code: input.postalCode,
        timezone: input.timezone,
      })
      .eq("id", id);
    if (error) throw new Phase3Error("conflict", "Venue could not be updated.");
    await audit(admin.userId, "VENUE_UPDATED", "VENUE", id, input, old);
    revalidatePath("/admin/venues");
    revalidatePath("/admin/events");
    return { success: "Venue updated." };
  } catch (error) {
    return { error: message(error) };
  }
}

function isTimezone(value: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

export async function createEvent(
  _state: Phase3ActionState,
  form: FormData,
): Promise<Phase3ActionState> {
  try {
    const admin = await requireSystemAdmin();
    const input = eventSchema.parse({
      hostOrganizationId: value(form, "hostOrganizationId"),
      venueId: value(form, "venueId"),
      name: value(form, "name"),
      description: value(form, "description"),
      participantInstructions: value(form, "participantInstructions"),
      startLocal: value(form, "startLocal"),
      endLocal: value(form, "endLocal"),
      registrationDeadlineLocal: value(form, "registrationDeadlineLocal"),
      capacity: value(form, "capacity"),
      visibility: value(form, "visibility"),
      communicationUrl: value(form, "communicationUrl"),
      communicationLabel: value(form, "communicationLabel"),
    });
    const imageFile = eventImageFile(form);
    const communication = parseCommunicationLink(input.communicationUrl, input.communicationLabel);
    const recurrence = recurrenceSchema.parse({
      enabled: form.get("recurring") === "on",
      endsOn: value(form, "recurrenceEndsOn") || undefined,
    });
    const db = await createClient();
    const { data: venue } = await db
      .from("venues")
      .select("organization_id, timezone")
      .eq("id", input.venueId)
      .eq("active_status", "ACTIVE")
      .single();
    if (!venue || venue.organization_id !== input.hostOrganizationId)
      throw new Phase3Error("invalid", "Choose a venue belonging to the selected organization.");
    const times = parseEventTimes(input, venue.timezone);
    if (recurrence.enabled) {
      const occurrences = buildWeeklyOccurrences(input, venue.timezone, recurrence.endsOn!);
      const { data: series, error: seriesError } = await db
        .from("event_series")
        .insert({
          frequency: "WEEKLY",
          interval_count: 1,
          ends_on: recurrence.endsOn!,
          selection_window_days: 14,
          created_by_admin_id: admin.userId,
        })
        .select("id")
        .single();
      if (seriesError || !series)
        throw new Phase3Error("conflict", "Recurring series could not be created.");
      const { data: created, error } = await db
        .from("events")
        .insert(
          occurrences.map((occurrence) => ({
            event_series_id: series.id,
            series_occurrence_number: occurrence.occurrence,
            host_organization_id: input.hostOrganizationId,
            venue_id: input.venueId,
            name: input.name,
            description: input.description || null,
            participant_instructions: input.participantInstructions || null,
            starts_at: occurrence.startsAt,
            ends_at: occurrence.endsAt,
            timezone: venue.timezone,
            registration_deadline: occurrence.registrationDeadline,
            capacity: input.capacity,
            visibility: input.visibility,
            communication_url: communication.url,
            communication_label: communication.label,
            created_by_admin_id: admin.userId,
          })),
        )
        .select("id");
      if (error || !created?.length)
        throw new Phase3Error("conflict", "Recurring events could not be created.");
      await saveEventImages(
        db,
        admin.userId,
        created.map((event) => event.id),
        input.name,
        imageFile,
      );
      await audit(admin.userId, "EVENT_SERIES_CREATED", "EVENT_SERIES", series.id, {
        ...input,
        frequency: "WEEKLY",
        endsOn: recurrence.endsOn,
        occurrenceCount: occurrences.length,
      });
      revalidatePath("/admin/events");
      return { success: `Recurring series created with ${created.length} weekly dates.` };
    }
    const { data, error } = await db
      .from("events")
      .insert({
        host_organization_id: input.hostOrganizationId,
        venue_id: input.venueId,
        name: input.name,
        description: input.description || null,
        participant_instructions: input.participantInstructions || null,
        starts_at: times.startsAt,
        ends_at: times.endsAt,
        timezone: venue.timezone,
        registration_deadline: times.registrationDeadline,
        capacity: input.capacity,
        visibility: input.visibility,
        communication_url: communication.url,
        communication_label: communication.label,
        created_by_admin_id: admin.userId,
      })
      .select("id")
      .single();
    if (error || !data) throw new Phase3Error("conflict", "Event could not be created.");
    await saveEventImages(db, admin.userId, [data.id], input.name, imageFile);
    await audit(admin.userId, "EVENT_CREATED", "EVENT", data.id, {
      ...input,
      ...times,
      timezone: venue.timezone,
    });
    revalidatePath("/admin/events");
    return { success: "Draft event created." };
  } catch (error) {
    return { error: message(error) };
  }
}

export async function publishEvent(id: string): Promise<Phase3ActionState> {
  return changeEventStatus(id, "OPEN", "EVENT_PUBLISHED", "Event published.");
}
export async function cancelEvent(id: string, reason: string): Promise<Phase3ActionState> {
  try {
    const admin = await requireSystemAdmin();
    if (reason.trim().length < 1)
      throw new Phase3Error("invalid", "A cancellation reason is required.");
    const db = await createClient();
    const { data: old } = await db.from("events").select("*").eq("id", id).single();
    if (!old) throw new Phase3Error("not_found", "Event not found.");
    const { error } = await db.from("events").update({ status: "CANCELLED" }).eq("id", id);
    if (error)
      throw new Phase3Error(
        "conflict",
        error.code === "42501"
          ? "This event cannot be cancelled in its current state."
          : "Event could not be cancelled.",
      );
    await audit(admin.userId, "EVENT_CANCELLED", "EVENT", id, { status: "CANCELLED", reason }, old);
    revalidatePath("/admin/events");
    return { success: "Event cancelled permanently." };
  } catch (error) {
    return { error: message(error) };
  }
}

export async function updateEvent(
  _state: Phase3ActionState,
  form: FormData,
): Promise<Phase3ActionState> {
  try {
    const admin = await requireSystemAdmin();
    const id = value(form, "id");
    const db = await createClient();
    const { data: old } = await db.from("events").select("*").eq("id", id).single();
    if (!old) throw new Phase3Error("not_found", "Event not found.");
    if (old.status === "CANCELLED" || old.status === "COMPLETED")
      throw new Phase3Error("forbidden", "This historical event cannot be edited.");
    const input = eventSchema.parse({
      hostOrganizationId: value(form, "hostOrganizationId"),
      venueId: value(form, "venueId"),
      name: value(form, "name"),
      description: value(form, "description"),
      participantInstructions: value(form, "participantInstructions"),
      startLocal: value(form, "startLocal"),
      endLocal: value(form, "endLocal"),
      registrationDeadlineLocal: value(form, "registrationDeadlineLocal"),
      capacity: value(form, "capacity"),
      visibility: value(form, "visibility"),
      communicationUrl: value(form, "communicationUrl"),
      communicationLabel: value(form, "communicationLabel"),
    });
    const communication = parseCommunicationLink(input.communicationUrl, input.communicationLabel);
    if (
      old.status !== "DRAFT" &&
      (input.hostOrganizationId !== old.host_organization_id || input.venueId !== old.venue_id)
    )
      throw new Phase3Error("forbidden", "Published event ownership cannot be changed.");
    const { data: venue } = await db
      .from("venues")
      .select("organization_id,timezone")
      .eq("id", input.venueId)
      .eq("active_status", "ACTIVE")
      .single();
    if (!venue || venue.organization_id !== input.hostOrganizationId)
      throw new Phase3Error("invalid", "Choose a venue belonging to the selected organization.");
    const times = parseEventTimes(input, venue.timezone);
    const { error } = await db
      .from("events")
      .update({
        host_organization_id: input.hostOrganizationId,
        venue_id: input.venueId,
        name: input.name,
        description: input.description || null,
        participant_instructions: input.participantInstructions || null,
        starts_at: times.startsAt,
        ends_at: times.endsAt,
        timezone: venue.timezone,
        registration_deadline: times.registrationDeadline,
        capacity: input.capacity,
        visibility: input.visibility,
        communication_url: communication.url,
        communication_label: communication.label,
      })
      .eq("id", id);
    if (error)
      throw new Phase3Error(
        "conflict",
        error.code === "42501"
          ? "This event cannot be edited in its current state."
          : "Event could not be updated.",
      );
    await audit(
      admin.userId,
      "EVENT_UPDATED",
      "EVENT",
      id,
      { ...input, ...times, timezone: venue.timezone },
      old,
    );
    revalidatePath("/admin/events");
    revalidatePath(`/admin/events/${id}`);
    return { success: "Event updated." };
  } catch (error) {
    return { error: message(error) };
  }
}

async function changeEventStatus(
  id: string,
  status: "OPEN",
  action: string,
  success: string,
): Promise<Phase3ActionState> {
  try {
    const admin = await requireSystemAdmin();
    const db = await createClient();
    const { data: old } = await db.from("events").select("*").eq("id", id).single();
    if (!old) throw new Phase3Error("not_found", "Event not found.");
    const { error } = await db.from("events").update({ status }).eq("id", id);
    if (error)
      throw new Phase3Error(
        "invalid",
        error.code === "22023"
          ? "This event is not valid for publication."
          : "Event could not be published.",
      );
    await audit(admin.userId, action, "EVENT", id, { status }, old);
    revalidatePath("/admin/events");
    return { success };
  } catch (error) {
    return { error: message(error) };
  }
}

export async function copyEvent(id: string): Promise<Phase3ActionState> {
  try {
    const admin = await requireSystemAdmin();
    const db = await createClient();
    const { data: source } = await db
      .from("events")
      .select(
        "host_organization_id, venue_id, name, description, participant_instructions, starts_at, ends_at, timezone, capacity, registration_deadline, visibility, communication_url, communication_label",
      )
      .eq("id", id)
      .single();
    if (!source) throw new Phase3Error("not_found", "Event not found.");
    const { data, error } = await db
      .from("events")
      .insert({
        ...source,
        name: `${source.name} (Copy)`,
        status: "DRAFT",
        created_by_admin_id: admin.userId,
      })
      .select("id")
      .single();
    if (error || !data) throw new Phase3Error("conflict", "Event could not be copied.");
    await audit(admin.userId, "EVENT_COPIED", "EVENT", data.id, { source_event_id: id });
    revalidatePath("/admin/events");
    return { success: "A new draft copy was created." };
  } catch (error) {
    return { error: message(error) };
  }
}

export async function assertPhase3ReadAccess() {
  return requireActiveAdmin();
}

export async function createOrganizationForm(form: FormData) {
  await createOrganization({}, form);
}
export async function updateOrganizationForm(form: FormData) {
  await updateOrganization({}, form);
}
export async function createVenueForm(form: FormData) {
  const result = await createVenue({}, form);
  if (result.success) redirect("/admin/venues");
}
export async function createEventForm(form: FormData) {
  const result = await createEvent({}, form);
  if (result.success) redirect("/admin/events");
}
export async function updateEventForm(form: FormData) {
  await updateEvent({}, form);
}
export async function publishEventForm(id: string) {
  await publishEvent(id);
}
export async function copyEventForm(id: string) {
  await copyEvent(id);
}
export async function cancelEventForm(id: string) {
  await cancelEvent(id, "Cancelled by System Admin");
}
export async function archiveOrganizationForm(id: string) {
  await archiveOrganization(id);
}
export async function archiveVenueForm(id: string) {
  await archiveVenue(id);
}
export async function updateVenueForm(form: FormData) {
  await updateVenue(form);
}
export async function updateVenueState(_state: Phase3ActionState, form: FormData) {
  return updateVenue(form);
}

// Keep event-page mutations in this route's existing server-action module so
// Next.js includes them in the route action manifest.
export async function openAttendanceSubmit(form: FormData) {
  return phase5OpenAttendanceSubmit(form);
}
export async function finalizeAttendanceSubmit(form: FormData) {
  return phase5FinalizeAttendanceSubmit(form);
}
export async function reopenAttendanceSubmit(form: FormData) {
  return phase5ReopenAttendanceSubmit(form);
}
export async function markAttendance(state: Phase3ActionState, form: FormData) {
  return phase5MarkAttendance(state, form);
}
export async function markAttendanceSubmit(form: FormData): Promise<void> {
  await phase5MarkAttendanceSubmit(form);
}
export async function createWalkInSubmit(form: FormData) {
  return phase5CreateWalkInSubmit(form);
}
