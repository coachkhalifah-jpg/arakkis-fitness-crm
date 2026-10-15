"use client";

import { useEffect, useMemo, useState } from "react";
import type { WorkoutStep } from "@/lib/workouts/csv";

function formatClock(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

const kindLabel: Record<WorkoutStep["kind"], string> = {
  prepare: "Get ready",
  work: "Work",
  rest: "Rest",
  done: "Done",
};

type TimerState = {
  index: number;
  remaining: number;
  running: boolean;
  finished: boolean;
};

function initialState(ordered: WorkoutStep[]): TimerState {
  return {
    index: 0,
    remaining: ordered[0]?.durationSeconds ?? 0,
    running: false,
    finished: false,
  };
}

export function WorkoutTimer({ title, steps }: { title: string; steps: WorkoutStep[] }) {
  const ordered = useMemo(() => [...steps].sort((a, b) => a.order - b.order), [steps]);
  const [state, setState] = useState<TimerState>(() => initialState(ordered));
  const { index, remaining, running, finished } = state;
  const current = ordered[index];

  useEffect(() => {
    if (!running || finished) return;
    const id = window.setInterval(() => {
      setState((prev) => {
        if (!prev.running || prev.finished) return prev;
        if (prev.remaining > 1) {
          return { ...prev, remaining: prev.remaining - 1 };
        }
        if (prev.index >= ordered.length - 1) {
          return { ...prev, remaining: 0, running: false, finished: true };
        }
        const nextIndex = prev.index + 1;
        return {
          ...prev,
          index: nextIndex,
          remaining: ordered[nextIndex]?.durationSeconds ?? 0,
        };
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [running, finished, ordered]);

  if (!current) {
    return <p className="text-sm text-slate-600">This workout has no steps.</p>;
  }

  return (
    <div className="workout-timer mx-auto flex w-full max-w-lg flex-col items-center gap-6 px-4 py-10 text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
        Take-home workout
      </p>
      <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">{title}</h1>
      <p className="text-sm text-slate-500">
        Step {Math.min(index + 1, ordered.length)} of {ordered.length}
        {!finished ? ` · ${kindLabel[current.kind]}` : ""}
      </p>
      <p className="min-h-[3.5rem] text-3xl font-semibold text-slate-900 sm:text-4xl">
        {finished ? "Workout complete" : current.title}
      </p>
      <p
        className="font-mono text-7xl font-semibold tabular-nums tracking-tight text-slate-900 sm:text-8xl"
        aria-live="polite"
      >
        {formatClock(finished ? 0 : remaining)}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          className="rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white disabled:opacity-40"
          onClick={() => setState((prev) => ({ ...prev, running: !prev.running }))}
          disabled={finished}
        >
          {running ? "Pause" : "Start"}
        </button>
        <button
          type="button"
          className="rounded-full border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-800 disabled:opacity-40"
          onClick={() => {
            setState((prev) => {
              if (prev.index >= ordered.length - 1) {
                return { ...prev, running: false, finished: true, remaining: 0 };
              }
              const nextIndex = prev.index + 1;
              return {
                ...prev,
                index: nextIndex,
                remaining: ordered[nextIndex]?.durationSeconds ?? 0,
                finished: false,
              };
            });
          }}
          disabled={finished}
        >
          Next
        </button>
        <button
          type="button"
          className="rounded-full border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-800"
          onClick={() => setState(initialState(ordered))}
        >
          Restart
        </button>
      </div>
      <ol className="mt-4 w-full max-w-md space-y-2 text-left text-sm text-slate-600">
        {ordered.map((step, stepIndex) => (
          <li
            key={`${step.order}-${step.title}`}
            className={
              stepIndex === index && !finished
                ? "rounded-lg bg-slate-100 px-3 py-2 font-medium text-slate-900"
                : "px-3 py-1"
            }
          >
            {step.order}. {step.title}{" "}
            <span className="text-slate-400">({formatClock(step.durationSeconds)})</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
