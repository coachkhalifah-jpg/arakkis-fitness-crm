"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { WorkoutStep } from "@/lib/workouts/csv";
import { playWorkoutTone } from "@/lib/workouts/audio";
import "./workout-timer.css";

const MUTE_STORAGE_KEY = "arakkis.workout.preferences.muted";
const mutedListeners = new Set<() => void>();

function formatClock(totalSeconds: number) {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

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

function subscribeMuted(listener: () => void) {
  mutedListeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === MUTE_STORAGE_KEY || event.key === null) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    mutedListeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function writeMutedPreference(nextMuted: boolean) {
  try {
    window.localStorage.setItem(MUTE_STORAGE_KEY, nextMuted ? "true" : "false");
  } catch {
    // Ignore quota / private-mode failures; in-memory mute still works via emit.
  }
  for (const listener of mutedListeners) listener();
}

function useScreenWakeLock(enabled: boolean) {
  useEffect(() => {
    if (!enabled || typeof navigator === "undefined" || !("wakeLock" in navigator)) {
      return;
    }

    let lock: WakeLockSentinel | null = null;
    let cancelled = false;

    const request = async () => {
      try {
        if (cancelled || document.visibilityState !== "visible") return;
        lock = await navigator.wakeLock.request("screen");
        lock.addEventListener("release", () => {
          lock = null;
        });
      } catch {
        // Unsupported / denied — timer still works without wake lock.
      }
    };

    void request();
    const onVisibility = () => {
      if (document.visibilityState === "visible") void request();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      void lock?.release();
      lock = null;
    };
  }, [enabled]);
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
  const muted = useSyncExternalStore(subscribeMuted, readMutedPreference, () => true);
  const { index, remaining, running, finished } = state;
  const current = ordered[index];
  const prevRef = useRef<{ index: number; remaining: number; running: boolean; finished: boolean }>(
    {
      index: 0,
      remaining: ordered[0]?.durationSeconds ?? 0,
      running: false,
      finished: false,
    },
  );
  const warnPlayedRef = useRef<number | null>(null);
  const mutedRef = useRef(muted);

  useScreenWakeLock(true);

  useEffect(() => {
    mutedRef.current = muted;
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
        state.running &&
        !prev.running &&
        !state.finished &&
        state.remaining === (current?.durationSeconds ?? 0);
      const completedLast = state.finished && !prev.finished && state.index === ordered.length - 1;

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

  const totals = useMemo(() => {
    const totalDuration = ordered.reduce((sum, step) => sum + step.durationSeconds, 0);
    let elapsedBefore = 0;
    for (let i = 0; i < index; i += 1) {
      elapsedBefore += ordered[i]?.durationSeconds ?? 0;
    }
    const currentDuration = current?.durationSeconds ?? 0;
    const elapsedInStep = finished ? currentDuration : Math.max(0, currentDuration - remaining);
    const elapsed = finished ? totalDuration : elapsedBefore + elapsedInStep;
    const remainingTotal = Math.max(0, totalDuration - elapsed);
    const progress =
      finished || currentDuration <= 0
        ? 100
        : Math.min(100, (elapsedInStep / currentDuration) * 100);
    return { elapsed, remainingTotal, progress, totalDuration };
  }, [ordered, index, remaining, finished, current?.durationSeconds]);

  const upcoming = useMemo(() => {
    if (finished) return [];
    return ordered.slice(index + 1, index + 4);
  }, [ordered, index, finished]);

  if (!current) {
    return (
      <div className="workout-stage">
        <p className="workout-stage__empty">This workout has no steps.</p>
      </div>
    );
  }

  const warn = !finished && remaining <= 3 && remaining >= 0 && current.kind !== "done";
  const stepTitle = finished ? "Workout complete" : current.title;
  const cue = !finished && current.cue?.trim() ? current.cue.trim() : "";
  const kind = finished ? "done" : current.kind;
  const stepNumber = Math.min(index + 1, ordered.length);

  return (
    <div
      className={`workout-stage${warn ? " is-warn" : ""}`}
      data-kind={kind}
      style={{ ["--wt-progress" as string]: `${totals.progress}%` }}
    >
      <div className="workout-stage__chrome">
        <p className="workout-stage__brand">
          {title}
          {theme?.trim() ? <span>{` · ${theme.trim()}`}</span> : null}
        </p>
        <div className="workout-stage__chrome-actions">
          <button
            type="button"
            className="workout-stage__mute"
            aria-pressed={muted}
            aria-label={muted ? "Sound muted. Activate to unmute." : "Sound on. Activate to mute."}
            onClick={() => writeMutedPreference(!muted)}
          >
            {muted ? "Muted" : "Sound on"}
          </button>
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
      </div>

      <section className="workout-stage__board" aria-label="Current interval">
        <div className="workout-stage__fill" aria-hidden="true" />
        <div className="workout-stage__board-inner">
          <h1 className="workout-stage__step-title">{stepTitle}</h1>
          {cue ? <p className="workout-stage__cue">{cue}</p> : null}
          <p className="workout-stage__clock" aria-live="polite" aria-atomic="true">
            {formatClock(finished ? 0 : remaining)}
          </p>
        </div>
        <p className="workout-stage__index" aria-hidden="true">
          {stepNumber}
        </p>
      </section>

      <div className="workout-stage__stats" aria-label="Workout progress">
        <p className="workout-stage__stat">
          <span>Elapsed</span>
          <strong>{formatClock(totals.elapsed)}</strong>
        </p>
        <p className="workout-stage__stat">
          <span>Round</span>
          <strong>
            {stepNumber} / {ordered.length}
          </strong>
        </p>
        <p className="workout-stage__stat">
          <span>Remaining</span>
          <strong>{formatClock(totals.remainingTotal)}</strong>
        </p>
      </div>

      {upcoming.length > 0 ? (
        <div className="workout-stage__upcoming" aria-label="Upcoming intervals">
          {upcoming.map((step, offset) => (
            <article
              key={`${step.order}-${step.title}`}
              className="workout-stage__card"
              data-kind={step.kind}
            >
              <p className="workout-stage__card-title">{step.title}</p>
              <p className="workout-stage__card-time">{formatClock(step.durationSeconds)}</p>
              <p className="workout-stage__card-index" aria-hidden="true">
                {index + 2 + offset}
              </p>
            </article>
          ))}
        </div>
      ) : null}
    </div>
  );
}
