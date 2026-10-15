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
        CSV file
        <input
          name="csv"
          type="file"
          required
          accept=".csv,text/csv,text/plain"
          className="rounded border border-dashed p-3"
        />
        <span className="admin-workout-help">
          Accepts coach SlipL exports or flat step CSV. Required step columns: step_title,
          duration_seconds, step_kind. Optional: workout_title, workout_theme, workout_slug,
          step_order (row order used if omitted), cue, block. Prefer setting slug/title/theme in the
          Workout editor. Template:{" "}
          <a
            className="admin-workout-open-link"
            href="/templates/take-home-workout-timer.csv"
            download
          >
            take-home-workout-timer.csv
          </a>
        </span>
      </label>
      <SubmitButton>Import workouts</SubmitButton>
      {state.error ? (
        <p role="alert" className="admin-workout-error">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p role="status" className="admin-workout-status">
          {state.success}
        </p>
      ) : null}
    </form>
  );
}
