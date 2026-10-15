"use client";

import { useActionState, useMemo, useState } from "react";
import { saveTakeHomeWorkout, type WorkoutEditorState } from "@/lib/workouts/actions";
import type { WorkoutStep, WorkoutStepKind } from "@/lib/workouts/csv";
import { convertSlipSheet, slugifyWorkoutTitle } from "@/lib/workouts/slip-sheet";
import { parseWorkoutCsv } from "@/lib/workouts/csv";
import { ProgressiveDisclosureSection } from "@/components/admin/progressive-disclosure-section";
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
  // Remount via parent `key` when loading an existing workout into the editor.

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
    // Keep identity already set on the editor; sheet fills gaps + replaces steps.
    setSlug((prev) => prev.trim() || next.slug);
    setTitle((prev) => prev.trim() || next.title);
    setTheme((prev) => prev.trim() || next.theme || "");
    setSteps(toEditorSteps(next.steps));
    setLoadError(null);
    setLoadMessage(
      `Loaded ${next.steps.length} steps. Row order is the step order. Review identity, then save.`,
    );
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
      setLoadError(
        "Flat CSV has multiple workouts. Use bulk import in Active workouts, or split the file.",
      );
      return;
    }
    applyConverted(parsed.workouts[0]);
  }

  return (
    <form action={action} className="admin-create-event-form admin-workout-editor-form">
      <input type="hidden" name="payload" value={payload} />

      <ProgressiveDisclosureSection
        id="workout-identity"
        number="01"
        title="Workout identity"
        defaultOpen
        errorKeywords={["slug", "title", "theme"]}
      >
        <p className="admin-workout-help">
          Slug, title, and theme are set here — not as required CSV columns. Step order follows the
          table row order below.
        </p>
        <label>
          Title
          <input
            value={title}
            onChange={(event) => {
              const next = event.target.value;
              setTitle(next);
              if (!slug || slug === slugifyWorkoutTitle(title)) {
                setSlug(slugifyWorkoutTitle(next));
              }
            }}
            placeholder="SlipL - A"
            required
          />
        </label>
        <label>
          Slug
          <input
            value={slug}
            onChange={(event) => setSlug(event.target.value.toLowerCase())}
            placeholder="slipl-a"
            autoComplete="off"
            required
            pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
          />
        </label>
        <label>
          Theme <span>(optional)</span>
          <input
            value={theme}
            onChange={(event) => setTheme(event.target.value)}
            placeholder="Outside Slip + Pendulum Footwork"
          />
        </label>
      </ProgressiveDisclosureSection>

      <ProgressiveDisclosureSection
        id="workout-import"
        number="02"
        title="Load coach sheet"
        defaultOpen
        errorKeywords={["sheet", "csv", "convert"]}
      >
        <p className="admin-workout-help">
          Paste or upload a SlipL Google Sheets export. Converts into the step table — does not
          publish until you save.
        </p>
        <label className="admin-create-checkbox-label">
          <input
            type="checkbox"
            checked={addBookends}
            onChange={(event) => setAddBookends(event.target.checked)}
          />
          Add Prepare / Done bookends when the sheet omits them
        </label>
        <label>
          Coach sheet
          <textarea
            value={sheetText}
            onChange={(event) => setSheetText(event.target.value)}
            placeholder="Paste SlipL sheet CSV export here…"
          />
        </label>
        <div className="admin-workout-actions">
          <button
            type="button"
            className="admin-workout-secondary-btn"
            onClick={() => loadCoachSheet(sheetText)}
          >
            Convert into steps
          </button>
          <label className="admin-workout-file-btn">
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
          <label className="admin-workout-file-btn">
            Load flat CSV
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
          <p role="alert" className="admin-workout-error">
            {loadError}
          </p>
        ) : null}
        {loadMessage ? (
          <p role="status" className="admin-workout-status">
            {loadMessage}
          </p>
        ) : null}
      </ProgressiveDisclosureSection>

      <ProgressiveDisclosureSection
        id="workout-steps"
        number="03"
        title={`Steps (${steps.length})`}
        defaultOpen
        errorKeywords={["step", "duration", "kind"]}
      >
        <div className="admin-workout-steps-toolbar">
          <p className="admin-workout-help">
            # is row order (saved as step order). Edit title, seconds, kind, cue, and block.
          </p>
          <button
            type="button"
            className="admin-workout-secondary-btn"
            onClick={() => setSteps((prev) => [...prev, emptyStep(prev.at(-1)?.block ?? "")])}
          >
            Add step
          </button>
        </div>

        <div className="admin-workout-steps-scroll">
          <table className="admin-workout-steps-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Title</th>
                <th>Sec</th>
                <th>Kind</th>
                <th>Cue</th>
                <th>Block</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {steps.map((step, index) => (
                <tr key={step.key}>
                  <td>{index + 1}</td>
                  <td>
                    <input
                      value={step.title}
                      onChange={(event) =>
                        setSteps((prev) =>
                          prev.map((row) =>
                            row.key === step.key ? { ...row, title: event.target.value } : row,
                          ),
                        )
                      }
                      required
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min={1}
                      max={3600}
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
                      required
                    />
                  </td>
                  <td>
                    <select
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
                  <td>
                    <input
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
                  <td>
                    <input
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
                  <td>
                    <button
                      type="button"
                      className="admin-workout-remove"
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
      </ProgressiveDisclosureSection>

      <div className="admin-workout-save-row">
        <SubmitButton>Save workout</SubmitButton>
        {slug ? (
          <a className="admin-workout-open-link" href={`/workouts/${slug}`}>
            Open run page
          </a>
        ) : null}
      </div>
      {state.error ? (
        <p role="alert" className="admin-workout-error">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p role="status" className="admin-workout-status">
          {state.success}{" "}
          {state.slug ? (
            <a className="admin-workout-open-link" href={`/workouts/${state.slug}`}>
              Open run page
            </a>
          ) : null}
        </p>
      ) : null}
    </form>
  );
}
