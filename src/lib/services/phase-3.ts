import "server-only";

import { z } from "zod";
import type { AdminContext } from "@/lib/authorization/server";
import { createClient } from "@/lib/db/server";
import { createPrivilegedClient } from "@/lib/db/privileged";

export const organizationSchema = z.object({
  name: z.string().trim().min(1).max(200),
  organizationType: z.string().trim().max(100).optional(),
  street: z.string().trim().max(200).optional(),
  city: z.string().trim().max(100).optional(),
  state: z.string().trim().max(50).optional(),
  postalCode: z.string().trim().max(20).optional(),
});

export const venueSchema = organizationSchema.omit({ name: true }).extend({
  name: z.string().trim().min(1).max(200),
  organizationId: z.string().uuid().nullable().optional(),
  street: z.string().trim().min(1).max(200),
  city: z.string().trim().min(1).max(100),
  state: z.string().trim().min(1).max(50),
  postalCode: z.string().trim().min(1).max(20),
  timezone: z.string().trim().min(1).max(100),
});

export const eventSchema = z.object({
  hostOrganizationId: z.string().uuid(),
  venueId: z.string().uuid(),
  name: z.string().trim().min(1).max(200),
  eventTitleColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .default("#FFFFFF"),
  description: z.string().trim().max(5000).optional(),
  participantInstructions: z.string().trim().max(5000).optional(),
  startLocal: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/),
  endLocal: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/),
  registrationDeadlineLocal: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/),
  capacity: z.coerce.number().int().positive().max(100000),
  visibility: z.enum(["PUBLIC", "AFFILIATION_RESTRICTED"]),
  accessMode: z.enum(["PUBLIC", "UNLISTED", "INVITE_ONLY"]),
  communicationUrl: z.string().trim().max(2048).optional().or(z.literal("")),
  communicationLabel: z.string().trim().max(100).optional().or(z.literal("")),
});

export const recurrenceSchema = z
  .object({
    enabled: z.boolean(),
    endsOn: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
  })
  .refine((value) => !value.enabled || Boolean(value.endsOn), {
    message: "Choose an end date for the recurring series.",
  });

export const scheduleRuleInputSchema = z.object({
  weekday: z.number().int().min(1).max(7),
  localStartTime: z.string().regex(/^\d{2}:\d{2}$/, "Enter a valid start time."),
  localEndTime: z.string().regex(/^\d{2}:\d{2}$/, "Enter a valid end time."),
});

export const multiScheduleSchema = z
  .array(scheduleRuleInputSchema)
  .min(1, "Add at least one day and time schedule.")
  .max(14, "A recurring Event may contain at most 14 schedules.")
  .superRefine((rules, context) => {
    const seen = new Set<string>();
    rules.forEach((rule, index) => {
      if (rule.localEndTime <= rule.localStartTime) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: [index, "localEndTime"],
          message: `Schedule row ${index + 1}: end time must be after start time.`,
        });
      }
      const exact = `${rule.weekday}:${rule.localStartTime}:${rule.localEndTime}`;
      if (seen.has(exact)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: [index],
          message: `Schedule row ${index + 1} duplicates another day and time.`,
        });
      }
      seen.add(exact);
    });
    for (let left = 0; left < rules.length; left += 1) {
      for (let right = left + 1; right < rules.length; right += 1) {
        const a = rules[left];
        const b = rules[right];
        if (
          a.weekday === b.weekday &&
          a.localStartTime < b.localEndTime &&
          b.localStartTime < a.localEndTime
        ) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: [right],
            message: `Schedule row ${right + 1} overlaps schedule row ${left + 1}.`,
          });
        }
      }
    }
  });

export class Phase3Error extends Error {
  constructor(
    public readonly kind: "invalid" | "conflict" | "forbidden" | "not_found",
    message: string,
  ) {
    super(message);
  }
}

export function parseCommunicationLink(url = "", label = "") {
  if (!url) return { url: null, label: null };
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Phase3Error("invalid", "Enter a valid HTTPS communication link.");
  }
  if (parsed.protocol !== "https:")
    throw new Phase3Error("invalid", "Communication links must use HTTPS.");
  return { url: parsed.toString(), label: label || "Join the group" };
}

function partsFor(instant: Date, timezone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  })
    .formatToParts(instant)
    .reduce<Record<string, string>>((result, part) => {
      if (part.type !== "literal") result[part.type] = part.value;
      return result;
    }, {});
}

function offsetAt(instant: Date, timezone: string) {
  const p = partsFor(instant, timezone);
  const asUtc = Date.UTC(
    Number(p.year),
    Number(p.month) - 1,
    Number(p.day),
    Number(p.hour),
    Number(p.minute),
  );
  return asUtc - instant.getTime();
}

export function isValidTimezone(timezone: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format();
    return true;
  } catch {
    return false;
  }
}

export function localDateTimeToUtc(
  value: string,
  timezone: string,
  occurrence?: "first" | "second",
) {
  if (!isValidTimezone(timezone)) throw new Phase3Error("invalid", "Choose a valid IANA timezone.");
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) throw new Phase3Error("invalid", "Enter a valid local date and time.");
  const [, year, month, day, hour, minute] = match;
  const localAsUtc = Date.UTC(+year, +month - 1, +day, +hour, +minute);
  const offsets = new Set<number>();
  for (const delta of [-36, -24, -12, 0, 12, 24, 36])
    offsets.add(offsetAt(new Date(localAsUtc + delta * 3600000), timezone));
  const candidates = [...offsets]
    .map((offset) => new Date(localAsUtc - offset))
    .filter((date) => {
      const p = partsFor(date, timezone);
      return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}` === value;
    })
    .sort((a, b) => a.getTime() - b.getTime());
  if (candidates.length === 0)
    throw new Phase3Error("invalid", "That local time does not exist in the selected timezone.");
  if (candidates.length > 1 && !occurrence)
    throw new Phase3Error(
      "invalid",
      "Choose which occurrence to use for this repeated local time.",
    );
  if (candidates.length > 1 && occurrence === "second")
    return candidates[candidates.length - 1].toISOString();
  return candidates[0].toISOString();
}

export function parseEventTimes(input: z.infer<typeof eventSchema>, timezone: string) {
  const startsAt = localDateTimeToUtc(input.startLocal, timezone);
  const endsAt = localDateTimeToUtc(input.endLocal, timezone);
  const registrationDeadline = localDateTimeToUtc(input.registrationDeadlineLocal, timezone);
  if (new Date(endsAt) <= new Date(startsAt))
    throw new Phase3Error("invalid", "End time must be after start time.");
  if (new Date(registrationDeadline) > new Date(startsAt))
    throw new Phase3Error("invalid", "Registration deadline must be at or before the event start.");
  return { startsAt, endsAt, registrationDeadline };
}

function addDays(value: string, days: number) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function withDate(localDateTime: string, date: string) {
  return `${date}T${localDateTime.slice(11)}`;
}

export function buildWeeklyOccurrences(
  input: z.infer<typeof eventSchema>,
  timezone: string,
  endsOn: string,
) {
  const startDate = input.startLocal.slice(0, 10);
  const endDate = input.endLocal.slice(0, 10);
  if (endsOn < startDate)
    throw new Phase3Error(
      "invalid",
      "The recurrence end date must be on or after the first event.",
    );
  const result: Array<
    ReturnType<typeof parseEventTimes> & { localDate: string; occurrence: number }
  > = [];
  for (
    let occurrence = 1, localDate = startDate;
    localDate <= endsOn;
    occurrence += 1, localDate = addDays(localDate, 7)
  ) {
    const times = parseEventTimes(
      {
        ...input,
        startLocal: withDate(input.startLocal, localDate),
        endLocal: withDate(input.endLocal, localDate),
        registrationDeadlineLocal: withDate(input.registrationDeadlineLocal, localDate),
      },
      timezone,
    );
    result.push({ ...times, localDate, occurrence });
    if (result.length > 104)
      throw new Phase3Error("invalid", "A recurring series may contain at most 104 weekly dates.");
  }
  return result;
}

export function buildMultiScheduleOccurrences(
  input: z.infer<typeof eventSchema>,
  rules: z.infer<typeof multiScheduleSchema>,
  timezone: string,
  endsOn: string,
) {
  const parsedRules = multiScheduleSchema.parse(rules);
  const startDate = input.startLocal.slice(0, 10);
  if (endsOn < startDate)
    throw new Phase3Error(
      "invalid",
      "The recurrence end date must be on or after the first event.",
    );
  const registrationOffset =
    new Date(`${input.registrationDeadlineLocal}:00`).getTime() -
    new Date(`${input.startLocal}:00`).getTime();
  const result: Array<
    ReturnType<typeof parseEventTimes> & { localDate: string; scheduleIndex: number }
  > = [];
  parsedRules.forEach((rule, scheduleIndex) => {
    for (let localDate = startDate; localDate <= endsOn; localDate = addDays(localDate, 1)) {
      const weekday = new Date(`${localDate}T00:00:00Z`).getUTCDay() || 7;
      if (weekday !== rule.weekday) continue;
      const startLocal = `${localDate}T${rule.localStartTime}`;
      const endLocal = `${localDate}T${rule.localEndTime}`;
      const deadlineDate = new Date(new Date(`${startLocal}:00`).getTime() + registrationOffset);
      const deadlineLocal = `${localDate}T${String(deadlineDate.getHours()).padStart(2, "0")}:${String(deadlineDate.getMinutes()).padStart(2, "0")}`;
      result.push({
        ...parseEventTimes(
          { ...input, startLocal, endLocal, registrationDeadlineLocal: deadlineLocal },
          timezone,
        ),
        localDate,
        scheduleIndex,
      });
    }
  });
  result.sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
  if (!result.length)
    throw new Phase3Error("invalid", "The schedules have no valid dates before the series end.");
  if (result.length > 104)
    throw new Phase3Error("invalid", "A recurring series may contain at most 104 total dates.");
  return result;
}

export async function assertOrganizationScope(context: AdminContext, organizationId: string) {
  if (context.role === "HOST_ADMIN" && !context.organizationIds.includes(organizationId))
    throw new Phase3Error("forbidden", "You do not have access to this organization.");
}

export async function audit(
  actorId: string,
  action: string,
  entityType: string,
  entityId: string,
  newValues?: object,
  oldValues?: object,
  privileged = false,
) {
  const supabase = privileged ? createPrivilegedClient() : await createClient();
  const { error } = await supabase.from("audit_events").insert({
    actor_admin_id: actorId,
    action,
    entity_type: entityType,
    entity_id: entityId,
    old_values: oldValues ?? null,
    new_values: newValues ?? null,
  });
  if (error) throw new Phase3Error("conflict", "The change was not recorded.");
}
