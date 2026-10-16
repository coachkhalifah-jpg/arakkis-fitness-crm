"use client";

import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { WorkoutStep } from "@/lib/workouts/csv";
import { playWorkoutTone } from "@/lib/workouts/audio";
import { DisclosureToggle } from "@/components/ui/disclosure-toggle";
import "./workout-timer.css";

const MUTE_STORAGE_KEY = "arakkis.workout.preferences.muted";
const mutedListeners = new Set<() => void>();
const RING_RADIUS = 45;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

function formatClock(totalSeconds: number) {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

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
  const [movementsOpen, setMovementsOpen] = useState(false);
  const [ringProgress, setRingProgress] = useState(0);
  const movementsId = useId();
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
  const secondStartedAtRef = useRef<number | null>(null);
  const stateRef = useRef(state);
  const orderedRef = useRef(ordered);

  useScreenWakeLock(true);

  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    orderedRef.current = ordered;
  }, [ordered]);

  useEffect(() => {
    if (running && !finished) {
      secondStartedAtRef.current = performance.now();
    } else {
      secondStartedAtRef.current = null;
    }
  }, [running, finished, remaining, index]);

  useEffect(() => {
    const syncProgress = () => {
      const currentState = stateRef.current;
      const stepsOrdered = orderedRef.current;
      const step = stepsOrdered[currentState.index];
      const duration = step?.durationSeconds ?? 0;
      if (currentState.finished || duration <= 0) {
        setRingProgress(1);
        return;
      }
      const wholeElapsed = Math.max(0, duration - currentState.remaining);
      const fraction =
        currentState.running && secondStartedAtRef.current != null
          ? Math.min(0.999, Math.max(0, (performance.now() - secondStartedAtRef.current) / 1000))
          : 0;
      setRingProgress(Math.min(1, Math.max(0, (wholeElapsed + fraction) / duration)));
    };

    syncProgress();
    if (!running || finished) return;

    let raf = 0;
    const loop = () => {
      syncProgress();
      raf = window.requestAnimationFrame(loop);
    };
    raf = window.requestAnimationFrame(loop);
    return () => window.cancelAnimationFrame(raf);
  }, [running, finished, remaining, index]);

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
    const wholeElapsedInStep = finished
      ? currentDuration
      : Math.max(0, currentDuration - remaining);
    const elapsed = finished ? totalDuration : elapsedBefore + wholeElapsedInStep;
    const remainingTotal = Math.max(0, totalDuration - elapsed);
    return { elapsed, remainingTotal, totalDuration };
  }, [ordered, index, remaining, finished, current?.durationSeconds]);

  const upcoming = useMemo(() => {
    if (finished) return [];
    return ordered.slice(index + 1, index + 4);
  }, [ordered, index, finished]);

  const toggleRunning = () => {
    if (finished) return;
    setState((prev) => ({ ...prev, running: !prev.running }));
  };

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
  const dashOffset = RING_CIRCUMFERENCE * (1 - ringProgress);

  return (
    <div className={`workout-stage${warn ? " is-warn" : ""}`} data-kind={kind}>
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
            onClick={toggleRunning}
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
        <h1 className="workout-stage__step-title">{stepTitle}</h1>
        {cue ? <p className="workout-stage__cue">{cue}</p> : null}

        <button
          type="button"
          className="workout-stage__dial"
          onClick={toggleRunning}
          disabled={finished}
          aria-label={
            finished
              ? "Workout complete"
              : running
                ? `Pause timer, ${formatClock(remaining)} remaining`
                : `Start timer, ${formatClock(remaining)} remaining`
          }
        >
          <svg className="workout-stage__ring" viewBox="0 0 100 100" aria-hidden="true">
            <circle className="workout-stage__ring-track" cx="50" cy="50" r={RING_RADIUS} />
            <circle
              className="workout-stage__ring-progress"
              cx="50"
              cy="50"
              r={RING_RADIUS}
              strokeDasharray={RING_CIRCUMFERENCE}
              strokeDashoffset={dashOffset}
            />
          </svg>
          <div className="workout-stage__dial-face">
            <p className="workout-stage__clock" aria-live="polite" aria-atomic="true">
              {formatClock(finished ? 0 : remaining)}
            </p>
            <p className="workout-stage__dial-hint">
              {finished ? "Done" : running ? "Tap to pause" : "Tap to start"}
            </p>
          </div>
        </button>
      </section>

      <div className="workout-stage__rows">
        <div className="workout-stage__row" aria-label="Workout progress">
          <div className="workout-stage__stats">
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
        </div>

        <div className="workout-stage__row" aria-label="Upcoming intervals">
          {upcoming.length > 0 ? (
            <div className="workout-stage__upcoming">
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
          ) : (
            <p className="workout-stage__upcoming-empty">No upcoming intervals</p>
          )}
        </div>

        <div className="workout-stage__row">
          <DisclosureToggle
            className="workout-stage__movements-toggle"
            expanded={movementsOpen}
            controls={movementsId}
            onClick={() => setMovementsOpen((open) => !open)}
          >
            Movements
          </DisclosureToggle>
          <div id={movementsId} className="workout-stage__movements-panel" hidden={!movementsOpen}>
            <table className="workout-stage__movements-table">
              <thead>
                <tr>
                  <th scope="col">Exercises</th>
                  <th scope="col">Block</th>
                  <th scope="col">Time</th>
                </tr>
              </thead>
              <tbody>
                {ordered.map((step, stepIndex) => (
                  <tr
                    key={`${step.order}-${step.title}-row`}
                    className={stepIndex === index && !finished ? "is-current" : undefined}
                  >
                    <td>
                      {step.title}
                      <span className="sr-only">{` (${kindLabelShort[step.kind]})`}</span>
                    </td>
                    <td>{step.block?.trim() || "—"}</td>
                    <td>{formatClock(step.durationSeconds)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
