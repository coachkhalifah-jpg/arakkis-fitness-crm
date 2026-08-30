"use server";

import { createHash, randomBytes, randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireActiveAdmin, requireSystemAdmin } from "@/lib/authorization/server";
import { createClient } from "@/lib/db/server";
import { createPrivilegedClient } from "@/lib/db/privileged";
import {
  clearCommittedCleanupCandidates,
  runPostCommitRefresh,
} from "@/lib/services/event-creation-lifecycle";
import {
  audit,
  buildMultiScheduleOccurrences,
  eventSchema,
  localDateTimeToUtc,
  organizationSchema,
  parseCommunicationLink,
  parseEventTimes,
  Phase3Error,
  multiScheduleSchema,
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
import { cleanupStoragePaths } from "@/lib/services/storage-cleanup";
import { normalizePublicSlug } from "@/lib/services/phase-7";
import { getServerEnv } from "@/lib/config/env";

export type Phase3ActionState = {
  error?: string;
  errorAction?: string;
  errorCode?: string;
  success?: string;
  createdEventId?: string;
  createdName?: string;
  createdStatus?: "Draft" | "Published";
  publicUrl?: string;
  inviteUrl?: string;
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
    if (
      !venue ||
      venue.active_status !== "ACTIVE" ||
      (venue.organization_id !== null && venue.organization_id !== event.host_organization_id)
    )
      throw new Phase3Error(
        "invalid",
        "Choose an active venue belonging to the Event organization or a Public Venue.",
      );
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

async function removeEventImagePaths(paths: string[], requestId: string, operation: string) {
  const requestPrefix = `event_image_staging/${requestId}/`;
  const scopedPaths = paths.filter((path) => path.startsWith(requestPrefix));
  if (scopedPaths.length !== paths.length) {
    console.error("[event-image-cleanup] refused out-of-request cleanup candidate", {
      requestId,
      operation,
      paths: paths.filter((path) => !path.startsWith(requestPrefix)),
    });
  }
  if (!scopedPaths.length) return { ok: true, attempts: 0, unresolvedPaths: [] };
  const storage = createPrivilegedClient();
  const result = await cleanupStoragePaths(
    scopedPaths,
    async (candidatePaths) => {
      const { error } = await storage.storage.from("design-assets").remove(candidatePaths);
      return {
        error: error ? { message: error.message, statusCode: error.statusCode } : null,
      };
    },
    2,
  );
  if (!result.ok) {
    console.error("[event-image-cleanup] unresolved staged objects", {
      requestId,
      operation,
      attempts: result.attempts,
      paths: result.unresolvedPaths,
      error: result.lastError?.message,
    });
  }
  return result;
}

async function uploadEventImages(
  requestId: string,
  eventIds: string[],
  eventName: string,
  file: File | null,
) {
  if (!file || !eventIds.length) return { paths: [], assets: [] };
  const storage = createPrivilegedClient();
  const uploadedPaths: string[] = [];
  const assets: Array<Record<string, string | number>> = [];
  const fileBytes = Buffer.from(await file.arrayBuffer());
  const contentSha256 = createHash("sha256").update(fileBytes).digest("hex");
  try {
    for (const eventId of eventIds) {
      const path = `event_image_staging/${requestId}/${eventId}/${randomUUID()}${eventImageExtension(file)}`;
      const { error: uploadError } = await storage.storage
        .from("design-assets")
        .upload(path, fileBytes, {
          contentType: file.type,
          cacheControl: "31536000",
          upsert: false,
        });
      if (uploadError) throw new Phase3Error("conflict", "The event image could not be uploaded.");
      uploadedPaths.push(path);
      assets.push({
        event_id: eventId,
        storage_path: path,
        original_filename: file.name.slice(0, 255) || "event-image",
        mime_type: file.type,
        byte_size: file.size,
        content_sha256: contentSha256,
        alt_text: `${eventName} event image`,
      });
    }
  } catch (error) {
    await removeEventImagePaths(uploadedPaths, requestId, "staged-upload-failure");
    throw error;
  }
  return { paths: uploadedPaths, assets };
}

async function uploadScheduleEventImage(
  requestId: string,
  occurrenceCount: number,
  eventName: string,
  file: File | null,
) {
  if (!file || occurrenceCount < 1) return { paths: [], assets: [] };
  const storage = createPrivilegedClient();
  const uploadedPaths: string[] = [];
  const assets: Array<Record<string, string | number>> = [];
  const fileBytes = Buffer.from(await file.arrayBuffer());
  const contentSha256 = createHash("sha256").update(fileBytes).digest("hex");
  try {
    for (let index = 0; index < occurrenceCount; index += 1) {
      const path = `event_image_staging/${requestId}/occurrence-${index + 1}/${randomUUID()}${eventImageExtension(file)}`;
      const { error: uploadError } = await storage.storage
        .from("design-assets")
        .upload(path, fileBytes, {
          contentType: file.type,
          cacheControl: "31536000",
          upsert: false,
        });
      if (uploadError) throw new Phase3Error("conflict", "The event image could not be uploaded.");
      uploadedPaths.push(path);
      assets.push({
        occurrence_index: index + 1,
        storage_path: path,
        original_filename: file.name.slice(0, 255) || "event-image",
        mime_type: file.type,
        byte_size: file.size,
        content_sha256: contentSha256,
        alt_text: `${eventName} event image`,
      });
    }
  } catch (error) {
    await removeEventImagePaths(uploadedPaths, requestId, "staged-upload-failure");
    throw error;
  }
  return { paths: uploadedPaths, assets };
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
    if (admin.role === "HOST_ADMIN" && !assignedOrganizationId)
      throw new Phase3Error(
        "invalid",
        "Your account must have exactly one active organization assignment to create a venue.",
      );
    const input = venueSchema.parse({
      name: value(form, "name"),
      organizationId: assignedOrganizationId || null,
      street: value(form, "street"),
      city: value(form, "city"),
      state: value(form, "state"),
      postalCode: value(form, "postalCode"),
      timezone: value(form, "timezone"),
    });
    if (!isTimezone(input.timezone))
      throw new Phase3Error("invalid", "Choose a valid IANA timezone.");
    const db = await createClient();
    if (input.organizationId) {
      const { data: org } = await db
        .from("organizations")
        .select("id")
        .eq("id", input.organizationId)
        .eq("active_status", "ACTIVE")
        .single();
      if (!org) throw new Phase3Error("invalid", "Choose an active organization.");
    }
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
    const auditInput = {
      ...input,
      venueType: input.organizationId ? "ORGANIZATION" : "INDEPENDENT_PUBLIC",
    };
    await audit(
      admin.userId,
      "VENUE_CREATED",
      "VENUE",
      data.id,
      auditInput,
      undefined,
      admin.role === "HOST_ADMIN",
    );
    revalidatePath("/admin/organizations");
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
    const requestedOrganizationId =
      admin.role === "SYSTEM_ADMIN" ? value(form, "organizationId") || null : old.organization_id;
    const input = venueSchema.parse({
      name: value(form, "name"),
      organizationId: requestedOrganizationId,
      street: value(form, "street"),
      city: value(form, "city"),
      state: value(form, "state"),
      postalCode: value(form, "postalCode"),
      timezone: value(form, "timezone"),
    });
    if (!isTimezone(input.timezone))
      throw new Phase3Error("invalid", "Choose a valid IANA timezone.");
    if (input.organizationId) {
      const { data: org } = await db
        .from("organizations")
        .select("id")
        .eq("id", input.organizationId)
        .eq("active_status", "ACTIVE")
        .single();
      if (!org) throw new Phase3Error("invalid", "Choose an active organization.");
    }
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
    const auditInput = {
      ...input,
      venueType: input.organizationId ? "ORGANIZATION" : "INDEPENDENT_PUBLIC",
      previousVenueType: old.organization_id ? "ORGANIZATION" : "INDEPENDENT_PUBLIC",
    };
    await audit(
      admin.userId,
      "VENUE_UPDATED",
      "VENUE",
      id,
      auditInput,
      old,
      admin.role === "HOST_ADMIN",
    );
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
  let uploadedPaths: string[] = [];
  try {
    const admin = await requireSystemAdmin();
    const input = eventSchema.parse({
      hostOrganizationId: value(form, "hostOrganizationId"),
      venueId: value(form, "venueId"),
      name: value(form, "name"),
      eventTitleColor: value(form, "eventTitleColor") || "#FFFFFF",
      description: value(form, "description"),
      participantInstructions: value(form, "participantInstructions"),
      startLocal: value(form, "startLocal"),
      endLocal: value(form, "endLocal"),
      registrationDeadlineLocal: value(form, "registrationDeadlineLocal"),
      capacity: value(form, "capacity"),
      visibility: value(form, "visibility"),
      accessMode: value(form, "accessMode") || "PUBLIC",
      communicationUrl: value(form, "communicationUrl"),
      communicationLabel: value(form, "communicationLabel"),
    });
    const imageFile = eventImageFile(form);
    const communication = parseCommunicationLink(input.communicationUrl, input.communicationLabel);
    const recurrence = recurrenceSchema.parse({
      enabled: form.get("recurring") === "on",
      endsOn: value(form, "recurrenceEndsOn") || undefined,
    });
    if (recurrence.enabled && input.accessMode === "INVITE_ONLY")
      throw new Phase3Error(
        "invalid",
        "Invite-only access is currently available for single Events only.",
      );
    const scheduleRules = recurrence.enabled
      ? multiScheduleSchema.parse(
          form.getAll("scheduleRuleWeekday").map((weekday, index) => ({
            weekday: Number(weekday),
            localStartTime: String(form.getAll("scheduleRuleStartTime")[index] ?? ""),
            localEndTime: String(form.getAll("scheduleRuleEndTime")[index] ?? ""),
          })),
        )
      : null;
    const db = await createClient();
    const { data: venue } = await db
      .from("venues")
      .select("organization_id, timezone")
      .eq("id", input.venueId)
      .eq("active_status", "ACTIVE")
      .single();
    if (
      !venue ||
      (venue.organization_id !== null && venue.organization_id !== input.hostOrganizationId)
    )
      throw new Phase3Error(
        "invalid",
        "Choose a venue belonging to the selected organization or an independent/public venue.",
      );
    const times = parseEventTimes(input, venue.timezone);
    const occurrences = recurrence.enabled
      ? buildMultiScheduleOccurrences(input, scheduleRules!, venue.timezone, recurrence.endsOn!)
      : [{ ...times, localDate: input.startLocal.slice(0, 10), occurrence: 1 }];
    const eventIds = recurrence.enabled ? [] : occurrences.map(() => randomUUID());
    const seriesId = recurrence.enabled ? randomUUID() : null;
    const requestId = value(form, "creationRequestId") || randomUUID();
    const uploaded = recurrence.enabled
      ? await uploadScheduleEventImage(requestId, occurrences.length, input.name, imageFile)
      : await uploadEventImages(requestId, eventIds, input.name, imageFile);
    uploadedPaths = uploaded.paths;
    const rpcName = recurrence.enabled
      ? "phase3_create_multi_schedule_bundle"
      : "phase3_create_event_bundle";
    const rpcInput = recurrence.enabled
      ? {
          p_request_id: requestId,
          p_actor_admin_id: admin.userId,
          p_series_id: seriesId,
          p_series_ends_on: recurrence.endsOn,
          p_schedule_rules: scheduleRules!.map((rule) => ({
            weekday: rule.weekday,
            local_start_time: rule.localStartTime,
            local_end_time: rule.localEndTime,
            effective_start_date: input.startLocal.slice(0, 10),
          })),
          p_defaults: {
            host_organization_id: input.hostOrganizationId,
            venue_id: input.venueId,
            name: input.name,
            description: input.description || null,
            participant_instructions: input.participantInstructions || null,
            timezone: venue.timezone,
            capacity: input.capacity,
            visibility: input.visibility,
            access_mode: input.accessMode,
            communication_url: communication.url,
            communication_label: communication.label,
            event_title_color: input.eventTitleColor,
            start_local: input.startLocal,
            end_local: input.endLocal,
            registration_deadline_local: input.registrationDeadlineLocal,
          },
          p_assets: uploaded.assets,
          p_audit_action: "EVENT_SERIES_CREATED",
          p_audit_values: {
            name: input.name,
            host_organization_id: input.hostOrganizationId,
            venue_id: input.venueId,
            venue_type: venue.organization_id ? "ORGANIZATION" : "INDEPENDENT_PUBLIC",
            timezone: venue.timezone,
            frequency: "WEEKLY",
            ends_on: recurrence.endsOn,
            schedule_count: scheduleRules!.length,
            occurrence_count: occurrences.length,
          },
        }
      : {
          p_request_id: requestId,
          p_actor_admin_id: admin.userId,
          p_series_id: seriesId,
          p_series_ends_on: null,
          p_event_rows: occurrences.map((occurrence, index) => ({
            id: eventIds[index],
            series_occurrence_number: null,
            starts_at: occurrence.startsAt,
            ends_at: occurrence.endsAt,
            registration_deadline: occurrence.registrationDeadline,
          })),
          p_defaults: {
            host_organization_id: input.hostOrganizationId,
            venue_id: input.venueId,
            name: input.name,
            description: input.description || null,
            participant_instructions: input.participantInstructions || null,
            timezone: venue.timezone,
            capacity: input.capacity,
            visibility: input.visibility,
            access_mode: input.accessMode,
            communication_url: communication.url,
            communication_label: communication.label,
            event_title_color: input.eventTitleColor,
          },
          p_assets: uploaded.assets,
          p_audit_action: "EVENT_CREATED",
          p_audit_values: {
            name: input.name,
            host_organization_id: input.hostOrganizationId,
            venue_id: input.venueId,
            venue_type: venue.organization_id ? "ORGANIZATION" : "INDEPENDENT_PUBLIC",
            timezone: venue.timezone,
            frequency: null,
            ends_on: null,
            occurrence_count: 1,
          },
        };
    const { data: bundle, error: bundleError } = (await db.rpc(
      rpcName as never,
      rpcInput as never,
    )) as {
      data: { event_ids?: string[]; idempotent?: boolean } | null;
      error: { message?: string; code?: string } | null;
    };
    if (bundleError || !bundle?.event_ids?.length) {
      await removeEventImagePaths(uploadedPaths, requestId, "database-bundle-failure");
      uploadedPaths = [];
      throw new Phase3Error(
        "conflict",
        recurrence.enabled
          ? "Recurring events could not be created."
          : "Event could not be created.",
      );
    }
    if (bundle.idempotent) {
      await removeEventImagePaths(uploadedPaths, requestId, "idempotent-replay");
    }
    // The RPC commit is authoritative. Never let a later cache/UI failure delete
    // storage objects that are now attached to the committed event(s).
    clearCommittedCleanupCandidates(uploadedPaths);
    const { error: accessError } = await db
      .from("events")
      .update({ access_mode: input.accessMode })
      .in("id", bundle.event_ids);
    if (accessError) throw new Phase3Error("conflict", "Event access could not be saved.");
    let createdStatus: "Draft" | "Published" = "Draft";
    let publicUrl: string | undefined;
    let publicationNotice = "";
    if (value(form, "intent") === "publish") {
      const { phase7EventUrl, publishPhase7Event } = await import("@/lib/services/phase-7-actions");
      for (const eventId of bundle.event_ids) {
        const publication = await publishPhase7Event(eventId);
        if (publication.error) {
          publicationNotice = ` Draft created, but publishing failed: ${publication.error}`;
          break;
        }
      }
      if (!publicationNotice) {
        createdStatus = "Published";
        publicUrl = await phase7EventUrl(normalizePublicSlug(input.name));
      }
    }
    const refresh = runPostCommitRefresh(() => revalidatePath("/admin/events"));
    if (!refresh.ok) {
      console.error("[event-create] committed event refresh failed", {
        requestId,
        eventIds: bundle.event_ids,
        error: refresh.error,
      });
    }
    return {
      success: !refresh.ok
        ? recurrence.enabled
          ? `Recurring series created with ${bundle.event_ids.length} weekly dates.${publicationNotice}`
          : `${createdStatus === "Published" ? "Published event" : "Draft event"} created.${publicationNotice}`
        : recurrence.enabled
          ? `Recurring series created with ${bundle.event_ids.length} weekly dates.`
          : `${createdStatus === "Published" ? "Published event" : "Draft event"} created.${publicationNotice}`,
      createdEventId: bundle.event_ids[0],
      createdName: input.name,
      createdStatus,
      publicUrl,
    };
  } catch (error) {
    const requestId = value(form, "creationRequestId") || "missing-request-id";
    if (uploadedPaths.length) {
      await removeEventImagePaths(uploadedPaths, requestId, "unexpected-event-create-failure");
    }
    if (error instanceof z.ZodError) {
      const issue = error.issues[0];
      const field = issue?.path.length ? `${issue.path.join(".")}: ` : "";
      return { error: `${field}${issue?.message ?? "Check the event details."}` };
    }
    console.error("[event-create] request failed", error);
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

export async function archiveCancelledEvent(id: string): Promise<Phase3ActionState> {
  try {
    const admin = await requireSystemAdmin();
    const db = await createClient();
    const { data: old } = await db.from("events").select("*").eq("id", id).single();
    if (!old) throw new Phase3Error("not_found", "Event not found.");
    if (old.status !== "CANCELLED")
      throw new Phase3Error("forbidden", "Only cancelled events can be archived.");
    if (old.archived_at) return { success: "Event is already archived." };
    const archivedAt = new Date().toISOString();
    const { error } = await db
      .from("events")
      .update({ archived_at: archivedAt })
      .eq("id", id)
      .is("archived_at", null);
    if (error) throw new Phase3Error("conflict", "Event could not be archived.");
    await audit(
      admin.userId,
      "EVENT_ARCHIVED",
      "EVENT",
      id,
      { archived_at: archivedAt, status: "CANCELLED" },
      old,
    );
    revalidatePath("/admin/events");
    revalidatePath(`/admin/events/${id}`);
    return { success: "Event archived. Its history remains available." };
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
      eventTitleColor: value(form, "eventTitleColor") || "#FFFFFF",
      description: value(form, "description"),
      participantInstructions: value(form, "participantInstructions"),
      startLocal: value(form, "startLocal"),
      endLocal: value(form, "endLocal"),
      registrationDeadlineLocal: value(form, "registrationDeadlineLocal"),
      capacity: value(form, "capacity"),
      visibility: value(form, "visibility"),
      accessMode: value(form, "accessMode") || "PUBLIC",
      communicationUrl: value(form, "communicationUrl"),
      communicationLabel: value(form, "communicationLabel"),
    });
    if (old.event_series_id && input.accessMode === "INVITE_ONLY")
      throw new Phase3Error(
        "invalid",
        "Invite-only access is currently available for single Events only.",
      );
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
    if (
      !venue ||
      (venue.organization_id !== null && venue.organization_id !== input.hostOrganizationId)
    )
      throw new Phase3Error(
        "invalid",
        "Choose a venue belonging to the selected organization or an independent/public venue.",
      );
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
        access_mode: input.accessMode,
        communication_url: communication.url,
        communication_label: communication.label,
        event_title_color: input.eventTitleColor,
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
      {
        ...input,
        ...times,
        timezone: venue.timezone,
        venue_type: venue.organization_id ? "ORGANIZATION" : "INDEPENDENT_PUBLIC",
      },
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

export async function generateEventInviteLink(
  _state: Phase3ActionState,
  form: FormData,
): Promise<Phase3ActionState> {
  try {
    const admin = await requireActiveAdmin();
    const eventId = value(form, "eventId");
    const db = await createClient();
    const { data: event } = await db
      .from("events")
      .select("id,access_mode,public_slug,event_series(public_slug),host_organization_id,status")
      .eq("id", eventId)
      .single();
    if (
      !event ||
      (admin.role === "HOST_ADMIN" && !admin.organizationIds.includes(event.host_organization_id))
    )
      throw new Phase3Error("forbidden", "You cannot manage this event.");
    if (event.access_mode !== "INVITE_ONLY" || event.status === "CANCELLED")
      throw new Phase3Error(
        "invalid",
        "Invite links are available only for active invite-only events.",
      );
    const slug = event.public_slug ?? event.event_series?.[0]?.public_slug;
    if (!slug)
      throw new Phase3Error("invalid", "Publish the event before creating an invite link.");
    const rawToken = randomBytes(32).toString("base64url");
    const privileged = createPrivilegedClient();
    const { error } = await privileged.from("event_invite_links").insert({
      event_id: event.id,
      token_hash: `\\x${createHash("sha256").update(rawToken).digest("hex")}`,
      created_by_admin_id: admin.userId,
    });
    if (error) throw new Phase3Error("conflict", "The invite link could not be created.");
    const env = getServerEnv();
    const base = env.APP_BASE_URL || env.NEXT_PUBLIC_APP_URL;
    return {
      success: "Reusable invite link created.",
      inviteUrl: `${base.replace(/\/+$/, "")}/register/${encodeURIComponent(slug)}?invite=${rawToken}`,
    };
  } catch (error) {
    return { error: message(error) };
  }
}

export async function revokeEventInviteLinks(form: FormData): Promise<Phase3ActionState> {
  try {
    const admin = await requireActiveAdmin();
    const eventId = value(form, "eventId");
    const db = await createClient();
    const { data: event } = await db
      .from("events")
      .select("id,host_organization_id")
      .eq("id", eventId)
      .single();
    if (
      !event ||
      (admin.role === "HOST_ADMIN" && !admin.organizationIds.includes(event.host_organization_id))
    )
      throw new Phase3Error("forbidden", "You cannot manage this event.");
    const privileged = createPrivilegedClient();
    const { error } = await privileged
      .from("event_invite_links")
      .update({ revoked_at: new Date().toISOString() })
      .eq("event_id", eventId)
      .is("revoked_at", null);
    if (error) throw new Phase3Error("conflict", "Active invite links could not be revoked.");
    revalidatePath(`/admin/events/${eventId}`);
    return { success: "Active invite links revoked." };
  } catch (error) {
    return { error: message(error) };
  }
}

export async function revokeEventInviteLinksForm(form: FormData): Promise<void> {
  await revokeEventInviteLinks(form);
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
export async function archiveCancelledEventForm(id: string) {
  await archiveCancelledEvent(id);
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
