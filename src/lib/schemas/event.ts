import { z } from "zod";

/**
 * Client-safe Create Event schema surface for Admin Events V2.
 * Authoritative server validation remains in `src/lib/services/phase-3.ts`.
 * Phase 4 will wire deadline presets and structured field errors through this module.
 */

export const localDateTimeSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Enter a valid date and time.");

export const deadlinePresetSchema = z.enum([
  "AT_START",
  "MINUTES_30",
  "HOURS_1",
  "HOURS_2",
  "CUSTOM",
]);

export type DeadlinePreset = z.infer<typeof deadlinePresetSchema>;

export const createEventClientSchema = z.object({
  hostOrganizationId: z.string().uuid("Choose an Organization."),
  venueId: z.string().uuid("Choose a Venue."),
  name: z.string().trim().min(1, "Enter an Event name.").max(200),
  eventTitleColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .default("#FFFFFF"),
  description: z.string().trim().max(5000).optional().or(z.literal("")),
  participantInstructions: z.string().trim().max(5000).optional().or(z.literal("")),
  startLocal: localDateTimeSchema,
  endLocal: localDateTimeSchema,
  /** Authoritative local deadline string submitted to the server. */
  registrationDeadlineLocal: localDateTimeSchema,
  /** UI-only preset; translated to registrationDeadlineLocal before submit. */
  deadlinePreset: deadlinePresetSchema.default("AT_START"),
  capacity: z.coerce
    .number({ invalid_type_error: "Enter capacity per class." })
    .int()
    .positive("Capacity per class must be at least 1.")
    .max(100000),
  /** Create Event V2 omits AFFILIATION_RESTRICTED (CE-013). */
  visibility: z.enum(["PUBLIC"]),
  accessMode: z.enum(["PUBLIC", "UNLISTED", "INVITE_ONLY"]),
  communicationUrl: z.string().trim().max(2048).optional().or(z.literal("")),
  communicationLabel: z.string().trim().max(100).optional().or(z.literal("")),
});

export type CreateEventClientInput = z.infer<typeof createEventClientSchema>;

export const DEADLINE_PRESET_OFFSET_MINUTES: Record<
  Exclude<DeadlinePreset, "CUSTOM">,
  number
> = {
  AT_START: 0,
  MINUTES_30: 30,
  HOURS_1: 60,
  HOURS_2: 120,
};

/**
 * Translate a relative deadline preset into a local datetime string
 * compatible with the existing `registrationDeadlineLocal` server field.
 */
export function resolveDeadlineLocal(
  startLocal: string,
  preset: DeadlinePreset,
  customLocal?: string,
): string {
  if (preset === "CUSTOM") {
    if (!customLocal || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(customLocal)) {
      throw new Error("Enter a custom registration deadline.");
    }
    return customLocal;
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(startLocal);
  if (!match) {
    throw new Error("Enter a valid Event start before setting the deadline.");
  }

  const [, year, month, day, hour, minute] = match;
  const start = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    0,
    0,
  );
  const offset = DEADLINE_PRESET_OFFSET_MINUTES[preset];
  const deadline = new Date(start.getTime() - offset * 60_000);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${deadline.getFullYear()}-${pad(deadline.getMonth() + 1)}-${pad(deadline.getDate())}T${pad(deadline.getHours())}:${pad(deadline.getMinutes())}`;
}

export function formatCreateEventFieldErrors(
  error: z.ZodError,
): Array<{ field?: string; message: string }> {
  return error.issues.map((issue) => ({
    field: issue.path.length ? String(issue.path[0]) : undefined,
    message: issue.message,
  }));
}
