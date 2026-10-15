"use server";

import { revalidatePath } from "next/cache";
import { requireSystemAdmin } from "@/lib/authorization/server";
import { createClient } from "@/lib/db/server";
import {
  looksLikeCoachSlipSheet,
  parseWorkoutCsv,
  type ParsedWorkout,
  type WorkoutStepKind,
} from "@/lib/workouts/csv";
import { convertSlipSheet } from "@/lib/workouts/slip-sheet";
import { persistTakeHomeWorkout } from "@/lib/workouts/persist";

export type WorkoutImportState = { error?: string; success?: string };
export type WorkoutEditorState = { error?: string; success?: string; slug?: string };

const STEP_KINDS = new Set<WorkoutStepKind>(["prepare", "work", "rest", "done"]);
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function revalidateWorkout(slug: string) {
  revalidatePath(`/workouts/${slug}`);
  revalidatePath("/admin/workouts");
}

export async function importTakeHomeWorkouts(
  _state: WorkoutImportState,
  form: FormData,
): Promise<WorkoutImportState> {
  try {
    const admin = await requireSystemAdmin("/admin/workouts");
    const file = form.get("csv");
    if (!(file instanceof File) || file.size === 0) {
      return { error: "Choose a CSV file to import." };
    }
    if (file.size > 512 * 1024) {
      return { error: "CSV files must be 512 KiB or smaller." };
    }
    const name = file.name.toLowerCase();
    if (
      !name.endsWith(".csv") &&
      file.type &&
      !file.type.includes("csv") &&
      file.type !== "text/plain"
    ) {
      return { error: "Upload a .csv file exported from Google Sheets." };
    }

    const text = await file.text();
    let workouts: ParsedWorkout[] = [];

    if (looksLikeCoachSlipSheet(text)) {
      const converted = convertSlipSheet(text);
      if (converted.error || !converted.workout) {
        return {
          error:
            converted.error ??
            "Could not convert the coach sheet. Prefer Paste/Upload in the Workout editor above.",
        };
      }
      workouts = [converted.workout];
    } else {
      const parsed = parseWorkoutCsv(text);
      if (parsed.error) return { error: parsed.error };
      workouts = parsed.workouts;
    }

    if (!workouts.length) return { error: "No workouts found in the CSV." };

    const db = await createClient();
    for (const workout of workouts) {
      const result = await persistTakeHomeWorkout(db, admin.userId, workout);
      if (result.error) return { error: result.error };
      revalidateWorkout(workout.slug);
    }

    revalidatePath("/admin/workouts");
    const labels = workouts.map((workout) => workout.slug).join(", ");
    return {
      success:
        workouts.length === 1
          ? `Imported workout "${labels}". Open /workouts/${workouts[0].slug}.`
          : `Imported ${workouts.length} workouts: ${labels}.`,
    };
  } catch {
    return { error: "The workout CSV could not be imported." };
  }
}

function parseEditorPayload(raw: string): { workout?: ParsedWorkout; error?: string } {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { error: "The Workout editor payload was invalid." };
  }
  if (!data || typeof data !== "object") {
    return { error: "The Workout editor payload was invalid." };
  }
  const record = data as Record<string, unknown>;
  const slug = String(record.slug ?? "")
    .trim()
    .toLowerCase();
  const title = String(record.title ?? "").trim();
  const themeRaw = String(record.theme ?? "").trim();
  if (!SLUG_PATTERN.test(slug)) {
    return { error: "Slug must be lowercase kebab-case (e.g. slipl-a)." };
  }
  if (!title || title.length > 160) {
    return { error: "Title must be 1–160 characters." };
  }
  if (themeRaw.length > 160) {
    return { error: "Theme must be at most 160 characters." };
  }
  if (!Array.isArray(record.steps) || record.steps.length < 1 || record.steps.length > 200) {
    return { error: "Add between 1 and 200 steps." };
  }

  const steps: ParsedWorkout["steps"] = [];
  for (let i = 0; i < record.steps.length; i += 1) {
    const step = record.steps[i] as Record<string, unknown>;
    const stepTitle = String(step.title ?? "").trim();
    const durationSeconds = Number(step.durationSeconds);
    const kind = String(step.kind ?? "").toLowerCase() as WorkoutStepKind;
    const cue = String(step.cue ?? "").trim();
    const block = String(step.block ?? "").trim();
    if (!stepTitle || stepTitle.length > 120) {
      return { error: `Step ${i + 1}: title must be 1–120 characters.` };
    }
    if (!Number.isInteger(durationSeconds) || durationSeconds < 1 || durationSeconds > 3600) {
      return { error: `Step ${i + 1}: duration must be an integer from 1 to 3600.` };
    }
    if (!STEP_KINDS.has(kind)) {
      return { error: `Step ${i + 1}: kind must be prepare, work, rest, or done.` };
    }
    if (cue.length > 200) return { error: `Step ${i + 1}: cue must be at most 200 characters.` };
    if (block.length > 80) return { error: `Step ${i + 1}: block must be at most 80 characters.` };
    steps.push({
      order: i + 1,
      title: stepTitle,
      durationSeconds,
      kind,
      ...(cue ? { cue } : {}),
      ...(block ? { block } : {}),
    });
  }

  return {
    workout: {
      slug,
      title,
      ...(themeRaw ? { theme: themeRaw } : {}),
      steps,
    },
  };
}

export async function saveTakeHomeWorkout(
  _state: WorkoutEditorState,
  form: FormData,
): Promise<WorkoutEditorState> {
  try {
    const admin = await requireSystemAdmin("/admin/workouts");
    const parsed = parseEditorPayload(String(form.get("payload") ?? ""));
    if (parsed.error || !parsed.workout) return { error: parsed.error ?? "Invalid workout." };

    const db = await createClient();
    const result = await persistTakeHomeWorkout(db, admin.userId, parsed.workout);
    if (result.error) return { error: result.error };

    revalidateWorkout(parsed.workout.slug);
    return {
      success: `Saved workout "${parsed.workout.slug}". Open /workouts/${parsed.workout.slug}.`,
      slug: parsed.workout.slug,
    };
  } catch {
    return { error: "The workout could not be saved." };
  }
}

export async function retireTakeHomeWorkout(form: FormData): Promise<void> {
  await requireSystemAdmin("/admin/workouts");
  const slug = String(form.get("slug") ?? "").trim();
  if (!slug) return;
  const db = await createClient();
  await db
    .from("take_home_workouts")
    .update({ active: false, updated_at: new Date().toISOString() })
    .eq("slug", slug)
    .eq("active", true);
  revalidatePath("/admin/workouts");
  revalidatePath(`/workouts/${slug}`);
}
