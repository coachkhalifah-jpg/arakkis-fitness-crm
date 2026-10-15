"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { WorkoutStep } from "@/lib/workouts/csv";
import { playWorkoutTone } from "@/lib/workouts/audio";
import "./workout-timer.css";

const MUTE_STORAGE_KEY = "arakkis.workout.preferences.muted";

function formatClock(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

const kindLabelFull: Record<WorkoutStep["kind"], string> = {
  prepare: "Get ready",
  work: "Work",
  rest: "Rest",
  done: "Done",
};

const kindLabelShort: Record<WorkoutStep["kind"], string> = {
  prepare: "Prep",
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

function readMutedPreference(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const stored = window.localStorage.getItem(MUTE_STORAGE_KEY);
    if (stored === null) return true;
    return stored !== "false";
  } catch {
    return true;
  }
}

export function WorkoutTimer({
  title,
  theme,
  steps,
}: {
  title: string;
  theme?: string;
  steps: WorkoutStep[];
}) {
  const ordered = useMemo(() => [...steps].sort((a, b) => a.order - b.order), [steps]);
  const [state, setState] = useState<TimerState>(() => initialState(ordered));
  const [muted, setMuted] = useState(true);
  const [stepsOpen, setStepsOpen] = useState(false);
  const stepsListId = useId();
  const { index, remaining, running, finished } = state;
  const current = ordered[index];
  const prevRef = useRef<{ index: number; remaining: number; running: boolean; finished: boolean }>({
    index: 0,
    remaining: ordered[0]?.durationSeconds ?? 0,
    running: false,
    finished: false,
  });
  const warnPlayedRef = useRef<number | null>(null);
  const mutedRef = useRef(muted);

  useEffect(() => {
    setMuted(readMutedPreference());
  }, []);

  useEffect(() => {
    mutedRef.current = muted;
    try {
      window.localStorage.setItem(MUTE_STORAGE_KEY, muted ? "true" : "false");
    } catch {
      // Ignore quota / private-mode failures; in-memory mute still works.
    }
  }, [muted]);

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

  useEffect(() => {
    const prev = prevRef.current;
    const toneMuted = mutedRef.current;

    if (!toneMuted) {
      const advanced = state.index !== prev.index;
      const startedFromIdle =
        state.running && !prev.running && !state.finished && state.remaining === (current?.durationSeconds ?? 0);
      const completedLast =
        state.finished && !prev.finished && state.index === ordered.length - 1;

      if (advanced && !state.finished) {
        playWorkoutTone("end");
        playWorkoutTone("begin");
        warnPlayedRef.current = null;
      } else if (startedFromIdle) {
        playWorkoutTone("begin");
        warnPlayedRef.current = null;
      } else if (completedLast) {
        playWorkoutTone("end");
      }

      if (
        state.running &&
        !state.finished &&
        state.remaining <= 3 &&
        state.remaining >= 1 &&
        warnPlayedRef.current !== state.remaining
      ) {
        playWorkoutTone("warn");
        warnPlayedRef.current = state.remaining;
      }
    }

    prevRef.current = {
      index: state.index,
      remaining: state.remaining,
      running: state.running,
      finished: state.finished,
    };
  }, [state, current?.durationSeconds, ordered.length]);

  if (!current) {
    return (
      <div className="workout-stage">
        <div className="workout-stage__inner">
          <p className="workout-stage__theme">This workout has no steps.</p>
        </div>
      </div>
    );
  }

  const warn = !finished && remaining <= 3 && remaining >= 0 && current.kind !== "done";
  const stepTitle = finished ? "Workout complete" : current.title;
  const cue = !finished && current.cue?.trim() ? current.cue.trim() : "";
  const block = !finished && current.block?.trim() ? current.block.trim() : "";
  const kindFull = finished ? kindLabelFull.done : kindLabelFull[current.kind];
  const kindShort = finished ? kindLabelShort.done : kindLabelShort[current.kind];
  const progressParts = [
    `Step ${Math.min(index + 1, ordered.length)} of ${ordered.length}`,
    kindShort,
    block,
  ].filter(Boolean);

  return (
    <div className="workout-stage">
      <div className="workout-stage__inner">
        <header className="workout-stage__meta">
          <p className="workout-stage__title">{title}</p>
          {theme?.trim() ? <p className="workout-stage__theme">{theme.trim()}</p> : null}
          <p className="workout-stage__progress">
            <span className="sm:hidden">{progressParts.join(" · ")}</span>
            <span className="hidden sm:inline">
              {`Step ${Math.min(index + 1, ordered.length)} of ${ordered.length}`}
              {!finished ? ` · ${kindFull}` : ""}
              {block ? ` · ${block}` : ""}
            </span>
          </p>
        </header>

        <div className="workout-stage__hero">
          <h1 className={`workout-stage__step-title${warn ? " is-warn" : ""}`}>{stepTitle}</h1>
          {cue ? <p className="workout-stage__cue">{cue}</p> : null}
          <p
            className={`workout-stage__clock${warn ? " is-warn" : ""}`}
            aria-live="polite"
            aria-atomic="true"
          >
            {formatClock(finished ? 0 : remaining)}
          </p>
          <p className={`workout-stage__kind${warn ? " is-warn" : ""}`}>
            <span className="sm:hidden">{kindShort}</span>
            <span className="hidden sm:inline">{kindFull}</span>
          </p>
        </div>

        <div className="workout-stage__controls">
          <button
            type="button"
            className="workout-stage__btn workout-stage__btn--primary"
            onClick={() => setState((prev) => ({ ...prev, running: !prev.running }))}
            disabled={finished}
          >
            {running ? "Pause" : "Start"}
          </button>
          <button
            type="button"
            className="workout-stage__btn"
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
              warnPlayedRef.current = null;
            }}
            disabled={finished}
          >
            Next
          </button>
          <button
            type="button"
            className="workout-stage__btn"
            onClick={() => {
              setState(initialState(ordered));
              warnPlayedRef.current = null;
            }}
          >
            Restart
          </button>
        </div>

        <div className="workout-stage__preferences">
          <button
            type="button"
            className="workout-stage__mute"
            aria-pressed={muted}
            aria-label={muted ? "Sound muted. Activate to unmute." : "Sound on. Activate to mute."}
            onClick={() => setMuted((prev) => !prev)}
          >
            {muted ? "Muted" : "Sound on"}
          </button>
        </div>

        <section className="workout-stage__steps" aria-label="Step list">
          <button
            type="button"
            className="workout-stage__steps-toggle"
            aria-expanded={stepsOpen}
            aria-controls={stepsListId}
            onClick={() => setStepsOpen((prev) => !prev)}
          >
            {stepsOpen ? "Hide steps" : "Show steps"}
          </button>
          <ol
            id={stepsListId}
            className={`workout-stage__step-list${stepsOpen ? "" : " is-collapsed"}`}
          >
            {ordered.map((step, stepIndex) => (
              <li
                key={`${step.order}-${step.title}`}
                className={[
                  "workout-stage__step-item",
                  stepIndex === index && !finished ? "is-current" : "",
                  finished || stepIndex < index ? "is-done-row" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <span>
                  {step.order}. {step.title}
                  {step.block?.trim() ? ` · ${step.block.trim()}` : ""}
                </span>
                <span>{formatClock(step.durationSeconds)}</span>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}
