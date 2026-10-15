"use server";

import { revalidatePath } from "next/cache";
import { requireSystemAdmin } from "@/lib/authorization/server";
import { createClient } from "@/lib/db/server";
import { parseWorkoutCsv } from "@/lib/workouts/csv";

export type WorkoutImportState = { error?: string; success?: string };

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

    const parsed = parseWorkoutCsv(await file.text());
    if (parsed.error) return { error: parsed.error };
    if (!parsed.workouts.length) return { error: "No workouts found in the CSV." };

    const db = await createClient();
    for (const workout of parsed.workouts) {
      const steps = workout.steps.map((step) => ({
        order: step.order,
        title: step.title,
        duration_seconds: step.durationSeconds,
        kind: step.kind,
      }));
      const { data: existing } = await db
        .from("take_home_workouts")
        .select("id")
        .eq("slug", workout.slug)
        .eq("active", true)
        .maybeSingle();

      if (existing) {
        const { error } = await db
          .from("take_home_workouts")
          .update({
            title: workout.title,
            steps,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);
        if (error) return { error: "The workout could not be updated." };
      } else {
        const { error } = await db.from("take_home_workouts").insert({
          slug: workout.slug,
          title: workout.title,
          steps,
          active: true,
          created_by_admin_id: admin.userId,
        });
        if (error) return { error: "The workout could not be saved." };
      }
      revalidatePath(`/workouts/${workout.slug}`);
    }

    revalidatePath("/admin/workouts");
    const labels = parsed.workouts.map((workout) => workout.slug).join(", ");
    return {
      success:
        parsed.workouts.length === 1
          ? `Imported workout "${labels}". Open /workouts/${parsed.workouts[0].slug}.`
          : `Imported ${parsed.workouts.length} workouts: ${labels}.`,
    };
  } catch {
    return { error: "The workout CSV could not be imported." };
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
