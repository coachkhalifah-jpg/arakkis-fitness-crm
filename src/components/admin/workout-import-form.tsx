"use client";

import { useActionState } from "react";
import { importTakeHomeWorkouts, type WorkoutImportState } from "@/lib/workouts/actions";
import { SubmitButton } from "@/components/admin/submit-button";

const initialState: WorkoutImportState = {};

export function WorkoutImportForm() {
  const [state, action] = useActionState(importTakeHomeWorkouts, initialState);
  return (
    <form action={action} className="grid gap-4">
      <label className="grid gap-2 text-sm">
        Workout CSV
        <input
          name="csv"
          type="file"
          required
          accept=".csv,text/csv,text/plain"
          className="rounded border border-dashed p-3"
        />
        <span className="text-slate-600">
          Use columns workout_slug, workout_title, step_order, step_title, duration_seconds,
          step_kind. Template:{" "}
          <a className="underline" href="/templates/take-home-workout-timer.csv" download>
            take-home-workout-timer.csv
          </a>
        </span>
      </label>
      <SubmitButton>Import workouts</SubmitButton>
      {state.error ? (
        <p role="alert" className="text-sm text-red-700">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p role="status" className="text-sm text-emerald-800">
          {state.success}
        </p>
      ) : null}
    </form>
  );
}
