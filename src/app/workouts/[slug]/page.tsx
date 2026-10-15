import { notFound } from "next/navigation";
import { createClient } from "@/lib/db/server";
import { WorkoutTimer } from "@/components/workouts/workout-timer";
import type { WorkoutStep, WorkoutStepKind } from "@/lib/workouts/csv";

type StoredStep = {
  order?: number;
  title?: string;
  duration_seconds?: number;
  kind?: WorkoutStepKind;
  cue?: string;
  block?: string;
};

function toSteps(value: unknown): WorkoutStep[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const step = item as StoredStep;
      if (
        typeof step.order !== "number" ||
        typeof step.title !== "string" ||
        typeof step.duration_seconds !== "number" ||
        (step.kind !== "prepare" &&
          step.kind !== "work" &&
          step.kind !== "rest" &&
          step.kind !== "done")
      ) {
        return null;
      }
      const cue = typeof step.cue === "string" ? step.cue.trim() : "";
      const block = typeof step.block === "string" ? step.block.trim() : "";
      return {
        order: step.order,
        title: step.title,
        durationSeconds: step.duration_seconds,
        kind: step.kind,
        ...(cue ? { cue } : {}),
        ...(block ? { block } : {}),
      } satisfies WorkoutStep;
    })
    .filter((step): step is WorkoutStep => step !== null)
    .sort((a, b) => a.order - b.order);
}

export default async function TakeHomeWorkoutPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const slug = (await params).slug.trim().toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) notFound();

  const db = await createClient();
  const { data: workout } = await db
    .from("take_home_workouts")
    .select("slug,title,theme,steps")
    .eq("slug", slug)
    .eq("active", true)
    .maybeSingle();

  if (!workout) notFound();
  const steps = toSteps(workout.steps);
  if (!steps.length) notFound();
  const theme = typeof workout.theme === "string" ? workout.theme.trim() : "";

  return (
    <main>
      <WorkoutTimer
        key={workout.slug}
        title={workout.title}
        theme={theme || undefined}
        steps={steps}
      />
    </main>
  );
}
