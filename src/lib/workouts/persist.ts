import type { ParsedWorkout } from "@/lib/workouts/csv";
import type { createClient } from "@/lib/db/server";

type Db = Awaited<ReturnType<typeof createClient>>;

export function toStoredSteps(workout: ParsedWorkout) {
  return workout.steps.map((step) => ({
    order: step.order,
    title: step.title,
    duration_seconds: step.durationSeconds,
    kind: step.kind,
    ...(step.cue ? { cue: step.cue } : {}),
    ...(step.block ? { block: step.block } : {}),
  }));
}

export async function persistTakeHomeWorkout(
  db: Db,
  adminUserId: string,
  workout: ParsedWorkout,
): Promise<{ error?: string }> {
  const steps = toStoredSteps(workout);
  const theme = workout.theme?.trim() || null;
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
        theme,
        steps,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
    if (error) return { error: "The workout could not be updated." };
    return {};
  }

  const { error } = await db.from("take_home_workouts").insert({
    slug: workout.slug,
    title: workout.title,
    theme,
    steps,
    active: true,
    created_by_admin_id: adminUserId,
  });
  if (error) return { error: "The workout could not be saved." };
  return {};
}
