"use client";

import Link from "next/link";
import { useState } from "react";
import type { WorkoutStep, WorkoutStepKind } from "@/lib/workouts/csv";
import { WorkoutEditor, type EditableWorkout } from "@/components/admin/workout-editor";
import { WorkoutImportForm } from "@/components/admin/workout-import-form";
import { retireTakeHomeWorkout } from "@/lib/workouts/actions";

type StoredStep = {
  order?: number;
  title?: string;
  duration_seconds?: number;
  kind?: WorkoutStepKind;
  cue?: string;
  block?: string;
};

export type AdminWorkoutListItem = {
  id: string;
  slug: string;
  title: string;
  theme: string | null;
  steps: unknown;
  updated_at: string;
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

function toEditable(item: AdminWorkoutListItem): EditableWorkout {
  return {
    slug: item.slug,
    title: item.title,
    theme: item.theme ?? "",
    steps: toSteps(item.steps),
  };
}

export function WorkoutAdminPanel({ workouts }: { workouts: AdminWorkoutListItem[] }) {
  const [editing, setEditing] = useState<EditableWorkout | null>(null);
  const [editorKey, setEditorKey] = useState(0);

  return (
    <div className="mt-8 grid gap-10">
      <WorkoutEditor key={editorKey} initialWorkout={editing} />

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Active workouts</h2>
            <p className="text-sm text-slate-600">
              Open the run page, load into the editor, or retire.
            </p>
          </div>
          <button
            type="button"
            className="text-sm font-semibold underline"
            onClick={() => {
              setEditing(null);
              setEditorKey((value) => value + 1);
            }}
          >
            New blank workout
          </button>
        </div>
        {workouts.length === 0 ? (
          <p className="text-sm text-slate-600">No take-home workouts saved yet.</p>
        ) : (
          <ul className="space-y-3">
            {workouts.map((workout) => {
              const stepCount = Array.isArray(workout.steps) ? workout.steps.length : 0;
              return (
                <li
                  key={workout.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3"
                >
                  <div>
                    <p className="font-semibold text-slate-900">{workout.title}</p>
                    <p className="text-sm text-slate-600">
                      /workouts/{workout.slug} · {stepCount} steps
                      {workout.theme ? ` · ${workout.theme}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      className="text-sm font-semibold underline"
                      onClick={() => {
                        setEditing(toEditable(workout));
                        setEditorKey((value) => value + 1);
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                    >
                      Edit
                    </button>
                    <Link
                      href={`/workouts/${workout.slug}`}
                      className="text-sm font-semibold underline"
                    >
                      Open page
                    </Link>
                    <form action={retireTakeHomeWorkout}>
                      <input type="hidden" name="slug" value={workout.slug} />
                      <button type="submit" className="text-sm font-semibold text-red-700">
                        Retire
                      </button>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-slate-900">Bulk flat CSV import</h2>
        <p className="mt-1 text-sm text-slate-600">
          Optional shortcut for already-flat timer CSVs (multiple workouts). Prefer the Workout
          editor above for SlipL coach sheets.
        </p>
        <div className="mt-4">
          <WorkoutImportForm />
        </div>
      </section>
    </div>
  );
}
