import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/db/server";
import { WorkoutTimer } from "@/components/workouts/workout-timer";
import type { WorkoutStep, WorkoutStepKind } from "@/lib/workouts/csv";

type StoredStep = {
  order?: number;
  title?: string;
  duration_seconds?: number;
  kind?: WorkoutStepKind;
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
      return {
        order: step.order,
        title: step.title,
        durationSeconds: step.duration_seconds,
        kind: step.kind,
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
    .select("slug,title,steps")
    .eq("slug", slug)
    .eq("active", true)
    .maybeSingle();

  if (!workout) notFound();
  const steps = toSteps(workout.steps);
  if (!steps.length) notFound();

  return (
    <main className="min-h-screen bg-stone-50 text-slate-900">
      <div className="mx-auto max-w-3xl px-4 pt-6">
        <Link href="/events" className="text-sm font-semibold text-slate-600 underline">
          Back to events
        </Link>
      </div>
      <WorkoutTimer title={workout.title} steps={steps} />
    </main>
  );
}
