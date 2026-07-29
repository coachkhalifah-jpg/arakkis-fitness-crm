"use server";

import { revalidatePath } from "next/cache";
import { requireActiveAdmin, requireSystemAdmin } from "@/lib/authorization/server";
import { createClient } from "@/lib/db/server";
import {
  audit,
  eventSchema,
  localDateTimeToUtc,
  organizationSchema,
  parseEventTimes,
  Phase3Error,
  venueSchema,
} from "@/lib/services/phase-3";
import {
  createWalkInSubmit as phase5CreateWalkInSubmit,
  finalizeAttendanceSubmit as phase5FinalizeAttendanceSubmit,
  markAttendance as phase5MarkAttendance,
  openAttendanceSubmit as phase5OpenAttendanceSubmit,
  reopenAttendanceSubmit as phase5ReopenAttendanceSubmit,
} from "@/lib/services/phase-5-actions";

export type Phase3ActionState = { error?: string; success?: string };
const message = (error: unknown) =>
  error instanceof Phase3Error || error instanceof Error
    ? error.message
    : "The request could not be completed.";
const value = (form: FormData, key: string) => String(form.get(key) ?? "").trim();

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
    const admin = await requireSystemAdmin();
    const input = venueSchema.parse({
      name: value(form, "name"),
      organizationId: value(form, "organizationId"),
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
    const admin = await requireSystemAdmin();
    const id = value(form, "id");
    const input = venueSchema.parse({
      name: value(form, "name"),
      organizationId: value(form, "organizationId"),
      street: value(form, "street"),
      city: value(form, "city"),
      state: value(form, "state"),
      postalCode: value(form, "postalCode"),
      timezone: value(form, "timezone"),
    });
    if (!isTimezone(input.timezone))
      throw new Phase3Error("invalid", "Choose a valid IANA timezone.");
    const db = await createClient();
    const { data: old } = await db.from("venues").select("*").eq("id", id).single();
    if (!old) throw new Phase3Error("not_found", "Venue not found.");
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
        created_by_admin_id: admin.userId,
      })
      .select("id")
      .single();
    if (error || !data) throw new Phase3Error("conflict", "Event could not be created.");
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
    });
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
        "host_organization_id, venue_id, name, description, participant_instructions, starts_at, ends_at, timezone, capacity, registration_deadline, visibility",
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
  await createVenue({}, form);
}
export async function createEventForm(form: FormData) {
  await createEvent({}, form);
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
export async function createWalkInSubmit(form: FormData) {
  return phase5CreateWalkInSubmit(form);
}
