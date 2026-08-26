"use server";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { requireSystemAdmin } from "@/lib/authorization/server";
import { createClient } from "@/lib/db/server";
import { Phase3Error } from "@/lib/services/phase-3";

const timeValue = z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, "Enter a valid local time.");
const dateValue = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid effective date.");

const addInput = z.object({
  requestId: z.string().uuid().optional(),
  seriesId: z.string().uuid(),
  weekday: z.number().int().min(1).max(7),
  localStartTime: timeValue,
  localEndTime: timeValue,
  effectiveStartDate: dateValue.optional(),
});

const changeInput = addInput
  .extend({ ruleId: z.string().uuid() })
  .omit({ requestId: true })
  .extend({
    requestId: z.string().uuid().optional(),
  });

const stopInput = z.object({
  requestId: z.string().uuid().optional(),
  ruleId: z.string().uuid(),
  effectiveEndDate: dateValue,
});

const extendInput = z.object({
  requestId: z.string().uuid().optional(),
  seriesId: z.string().uuid(),
  newEndsOn: dateValue,
});

export type RecurrenceMutationResult = {
  rule_id?: string;
  previous_rule_id?: string;
  series_id?: string;
  occurrence_ids?: string[];
  occurrence_count?: number;
  effective_end_date?: string;
  previous_ends_on?: string;
  new_ends_on?: string;
  series_extended?: boolean;
  idempotent?: boolean;
};

function safeMessage(error: unknown) {
  if (error instanceof Phase3Error) return error.message;
  if (error instanceof z.ZodError) return error.issues[0]?.message ?? "Check the schedule details.";
  if (error instanceof Error && error.message) {
    if (
      /schedule|series|occurrence|effective|timezone|overlap|duplicate|unique|request|System Admin/i.test(
        error.message,
      )
    ) {
      return error.message;
    }
  }
  return "The schedule change could not be completed.";
}

async function callMutation(
  rpc: string,
  input: Record<string, unknown>,
): Promise<{ data?: RecurrenceMutationResult; error?: string }> {
  try {
    const admin = await requireSystemAdmin("/admin/events");
    const db = await createClient();
    const { data, error } = await db.rpc(
      rpc as never,
      {
        ...input,
        p_actor_admin_id: admin.userId,
      } as never,
    );
    if (error) return { error: safeMessage(error) };
    return { data: (data ?? {}) as RecurrenceMutationResult };
  } catch (error) {
    return { error: safeMessage(error) };
  }
}

/** Add one weekday/time schedule and atomically materialize its future dates. */
export async function addScheduleRule(input: z.input<typeof addInput>) {
  try {
    const parsed = addInput.parse(input);
    return callMutation("phase3_add_schedule_rule", {
      p_request_id: parsed.requestId ?? randomUUID(),
      p_series_id: parsed.seriesId,
      p_weekday: parsed.weekday,
      p_local_start_time: parsed.localStartTime,
      p_local_end_time: parsed.localEndTime,
      p_effective_start_date: parsed.effectiveStartDate ?? null,
    });
  } catch (error) {
    return { error: safeMessage(error) };
  }
}

/** Close the prior rule and create/materialize a prospective successor rule. */
export async function changeScheduleRule(input: z.input<typeof changeInput>) {
  try {
    const parsed = changeInput.parse(input);
    return callMutation("phase3_change_schedule_rule", {
      p_request_id: parsed.requestId ?? randomUUID(),
      p_rule_id: parsed.ruleId,
      p_weekday: parsed.weekday,
      p_local_start_time: parsed.localStartTime,
      p_effective_start_date: parsed.effectiveStartDate,
      p_local_end_time: parsed.localEndTime,
    });
  } catch (error) {
    return { error: safeMessage(error) };
  }
}

/** Stop one rule prospectively without deleting any materialized occurrence. */
export async function stopScheduleRule(input: z.input<typeof stopInput>) {
  try {
    const parsed = stopInput.parse(input);
    return callMutation("phase3_stop_schedule_rule", {
      p_request_id: parsed.requestId ?? randomUUID(),
      p_rule_id: parsed.ruleId,
      p_effective_end_date: parsed.effectiveEndDate,
    });
  } catch (error) {
    return { error: safeMessage(error) };
  }
}

/** Extend the series boundary and atomically materialize its new occurrences. */
export async function extendSeriesEndDate(input: z.input<typeof extendInput>) {
  try {
    const parsed = extendInput.parse(input);
    return callMutation("phase3_extend_series_end_date", {
      p_request_id: parsed.requestId ?? randomUUID(),
      p_series_id: parsed.seriesId,
      p_new_ends_on: parsed.newEndsOn,
    });
  } catch (error) {
    return { error: safeMessage(error) };
  }
}
