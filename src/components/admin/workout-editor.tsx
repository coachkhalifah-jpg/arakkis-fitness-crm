"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { saveTakeHomeWorkout, type WorkoutEditorState } from "@/lib/workouts/actions";
import type { WorkoutStep, WorkoutStepKind } from "@/lib/workouts/csv";
import { convertSlipSheet, slugifyWorkoutTitle } from "@/lib/workouts/slip-sheet";
import { parseWorkoutCsv } from "@/lib/workouts/csv";
import { SubmitButton } from "@/components/admin/submit-button";

type EditorStep = {
  key: string;
  title: string;
  durationSeconds: number;
  kind: WorkoutStepKind;
  cue: string;
  block: string;
};

export type EditableWorkout = {
  slug: string;
  title: string;
  theme: string;
  steps: WorkoutStep[];
};

type Props = {
  initialWorkout?: EditableWorkout | null;
};

const KINDS: WorkoutStepKind[] = ["prepare", "work", "rest", "done"];

function newKey() {
  return `step-${Math.random().toString(36).slice(2, 10)}`;
}

function toEditorSteps(steps: WorkoutStep[]): EditorStep[] {
  return [...steps]
    .sort((a, b) => a.order - b.order)
    .map((step) => ({
      key: newKey(),
      title: step.title,
      durationSeconds: step.durationSeconds,
      kind: step.kind,
      cue: step.cue ?? "",
      block: step.block ?? "",
    }));
}

function emptyStep(block = ""): EditorStep {
  return {
    key: newKey(),
    title: "",
    durationSeconds: 30,
    kind: "work",
    cue: "",
    block,
  };
}

const initialState: WorkoutEditorState = {};

export function WorkoutEditor({ initialWorkout = null }: Props) {
  const [slug, setSlug] = useState(initialWorkout?.slug ?? "");
  const [title, setTitle] = useState(initialWorkout?.title ?? "");
  const [theme, setTheme] = useState(initialWorkout?.theme ?? "");
  const [steps, setSteps] = useState<EditorStep[]>(() =>
    initialWorkout?.steps?.length ? toEditorSteps(initialWorkout.steps) : [emptyStep()],
  );
  const [sheetText, setSheetText] = useState("");
  const [loadMessage, setLoadMessage] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [addBookends, setAddBookends] = useState(true);
  const [state, action] = useActionState(saveTakeHomeWorkout, initialState);

  useEffect(() => {
    if (!initialWorkout) return;
    setSlug(initialWorkout.slug);
    setTitle(initialWorkout.title);
    setTheme(initialWorkout.theme);
    setSteps(initialWorkout.steps.length ? toEditorSteps(initialWorkout.steps) : [emptyStep()]);
  }, [initialWorkout]);

  const payload = useMemo(
    () =>
      JSON.stringify({
        slug,
        title,
        theme,
        steps: steps.map((step) => ({
          title: step.title,
          durationSeconds: step.durationSeconds,
          kind: step.kind,
          cue: step.cue,
          block: step.block,
        })),
      }),
    [slug, title, theme, steps],
  );

  function applyConverted(next: {
    slug: string;
    title: string;
    theme?: string;
    steps: WorkoutStep[];
  }) {
    setSlug(next.slug);
    setTitle(next.title);
    setTheme(next.theme ?? "");
    setSteps(toEditorSteps(next.steps));
    setLoadError(null);
    setLoadMessage(`Loaded ${next.steps.length} steps into the Workout editor. Review, then save.`);
  }

  function loadCoachSheet(raw: string) {
    const result = convertSlipSheet(raw, {
      slug: slug.trim() || undefined,
      addBookends,
    });
    if (result.error || !result.workout) {
      setLoadMessage(null);
      setLoadError(result.error ?? "Could not convert the coach sheet.");
      return;
    }
    applyConverted(result.workout);
  }

  function loadFlatCsv(raw: string) {
    const parsed = parseWorkoutCsv(raw);
    if (parsed.error || !parsed.workouts[0]) {
      setLoadMessage(null);
      setLoadError(parsed.error ?? "No workout found in the flat CSV.");
      return;
    }
    if (parsed.workouts.length > 1) {
      setLoadMessage(null);
      setLoadError("Flat CSV has multiple workouts. Import those with Bulk CSV import below.");
      return;
    }
    applyConverted(parsed.workouts[0]);
  }

  return (
    <div className="grid gap-8">
      <section className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-5">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Workout editor</h2>
          <p className="mt-1 text-sm text-slate-600">
            Author identity once, then steps. Load a coach SlipL sheet or flat CSV into the editor,
            review, and save. This does not touch Events or People.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-sm sm:col-span-1">
            Slug
            <input
              className="rounded border border-slate-300 px-3 py-2"
              value={slug}
              onChange={(event) => setSlug(event.target.value.toLowerCase())}
              placeholder="slipl-a"
              autoComplete="off"
            />
          </label>
          <label className="grid gap-1 text-sm sm:col-span-1">
            Title
            <input
              className="rounded border border-slate-300 px-3 py-2"
              value={title}
              onChange={(event) => {
                const next = event.target.value;
                setTitle(next);
                if (!slug || slug === slugifyWorkoutTitle(title)) {
                  setSlug(slugifyWorkoutTitle(next));
                }
              }}
              placeholder="SlipL - A"
            />
          </label>
          <label className="grid gap-1 text-sm sm:col-span-2">
            Theme <span className="text-slate-500">(optional)</span>
            <input
              className="rounded border border-slate-300 px-3 py-2"
              value={theme}
              onChange={(event) => setTheme(event.target.value)}
              placeholder="Outside Slip + Pendulum Footwork"
            />
          </label>
        </div>
      </section>

      <section className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-5">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Load from coach sheet</h3>
          <p className="mt-1 text-sm text-slate-600">
            Paste a Google Sheets export (Time / Exercise / Notes, Repeat once). Converts into the
            editor — does not save until you click Save workout.
          </p>
        </div>
        <label className="inline-flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={addBookends}
            onChange={(event) => setAddBookends(event.target.checked)}
          />
          Add Prepare / Done bookends when the sheet omits them
        </label>
        <textarea
          className="min-h-40 rounded border border-slate-300 px-3 py-2 font-mono text-xs"
          value={sheetText}
          onChange={(event) => setSheetText(event.target.value)}
          placeholder="Paste SlipL sheet CSV export here…"
        />
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className="rounded bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
            onClick={() => loadCoachSheet(sheetText)}
          >
            Convert into editor
          </button>
          <label className="cursor-pointer rounded border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800">
            Upload sheet CSV
            <input
              type="file"
              accept=".csv,text/csv,text/plain"
              className="sr-only"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                const text = await file.text();
                setSheetText(text);
                loadCoachSheet(text);
                event.target.value = "";
              }}
            />
          </label>
          <label className="cursor-pointer rounded border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800">
            Load flat timer CSV
            <input
              type="file"
              accept=".csv,text/csv,text/plain"
              className="sr-only"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                loadFlatCsv(await file.text());
                event.target.value = "";
              }}
            />
          </label>
        </div>
        {loadError ? (
          <p role="alert" className="text-sm text-red-700">
            {loadError}
          </p>
        ) : null}
        {loadMessage ? (
          <p role="status" className="text-sm text-emerald-800">
            {loadMessage}
          </p>
        ) : null}
      </section>

      <section className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-base font-semibold text-slate-900">Steps ({steps.length})</h3>
          <button
            type="button"
            className="text-sm font-semibold underline"
            onClick={() => setSteps((prev) => [...prev, emptyStep(prev.at(-1)?.block ?? "")])}
          >
            Add step
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <th className="px-2 py-2">#</th>
                <th className="px-2 py-2">Title</th>
                <th className="px-2 py-2">Sec</th>
                <th className="px-2 py-2">Kind</th>
                <th className="px-2 py-2">Cue</th>
                <th className="px-2 py-2">Block</th>
                <th className="px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {steps.map((step, index) => (
                <tr key={step.key} className="border-b border-slate-100 align-top">
                  <td className="px-2 py-2 text-slate-500">{index + 1}</td>
                  <td className="px-2 py-2">
                    <input
                      className="w-40 rounded border border-slate-300 px-2 py-1 sm:w-52"
                      value={step.title}
                      onChange={(event) =>
                        setSteps((prev) =>
                          prev.map((row) =>
                            row.key === step.key ? { ...row, title: event.target.value } : row,
                          ),
                        )
                      }
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="number"
                      min={1}
                      max={3600}
                      className="w-20 rounded border border-slate-300 px-2 py-1"
                      value={step.durationSeconds}
                      onChange={(event) =>
                        setSteps((prev) =>
                          prev.map((row) =>
                            row.key === step.key
                              ? { ...row, durationSeconds: Number(event.target.value) || 0 }
                              : row,
                          ),
                        )
                      }
                    />
                  </td>
                  <td className="px-2 py-2">
                    <select
                      className="rounded border border-slate-300 px-2 py-1"
                      value={step.kind}
                      onChange={(event) =>
                        setSteps((prev) =>
                          prev.map((row) =>
                            row.key === step.key
                              ? { ...row, kind: event.target.value as WorkoutStepKind }
                              : row,
                          ),
                        )
                      }
                    >
                      {KINDS.map((kind) => (
                        <option key={kind} value={kind}>
                          {kind}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-2">
                    <input
                      className="w-36 rounded border border-slate-300 px-2 py-1 sm:w-44"
                      value={step.cue}
                      onChange={(event) =>
                        setSteps((prev) =>
                          prev.map((row) =>
                            row.key === step.key ? { ...row, cue: event.target.value } : row,
                          ),
                        )
                      }
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      className="w-32 rounded border border-slate-300 px-2 py-1 sm:w-40"
                      value={step.block}
                      onChange={(event) =>
                        setSteps((prev) =>
                          prev.map((row) =>
                            row.key === step.key ? { ...row, block: event.target.value } : row,
                          ),
                        )
                      }
                    />
                  </td>
                  <td className="px-2 py-2">
                    <button
                      type="button"
                      className="text-xs font-semibold text-red-700"
                      onClick={() =>
                        setSteps((prev) =>
                          prev.length <= 1 ? prev : prev.filter((row) => row.key !== step.key),
                        )
                      }
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <form action={action} className="grid gap-3">
          <input type="hidden" name="payload" value={payload} />
          <SubmitButton>Save workout</SubmitButton>
          {state.error ? (
            <p role="alert" className="text-sm text-red-700">
              {state.error}
            </p>
          ) : null}
          {state.success ? (
            <p role="status" className="text-sm text-emerald-800">
              {state.success}{" "}
              {state.slug ? (
                <a className="underline" href={`/workouts/${state.slug}`}>
                  Open run page
                </a>
              ) : null}
            </p>
          ) : null}
        </form>
      </section>
    </div>
  );
}
