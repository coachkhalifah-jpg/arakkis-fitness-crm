import type { ParsedWorkout, WorkoutStep, WorkoutStepKind } from "@/lib/workouts/csv";

export type SlipSheetConvertOptions = {
  /** Override slug; otherwise derived from the sheet title. */
  slug?: string;
  /** Prepend prepare + append done when the sheet omits them (default true). */
  addBookends?: boolean;
};

type RawExercise = {
  durationSeconds: number;
  title: string;
  cue?: string;
};

type BlockDraft = {
  name: string;
  exercises: RawExercise[];
  repeatOnce: boolean;
  postRests: RawExercise[];
};

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === "," && !inQuotes) {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  cells.push(current.trim());
  return cells;
}

export function slugifyWorkoutTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function parseDuration(raw: string): number | null {
  const value = raw.trim();
  if (!value) return null;
  if (/^:\d{1,4}$/.test(value)) {
    const seconds = Number(value.slice(1));
    return Number.isInteger(seconds) && seconds >= 1 && seconds <= 3600 ? seconds : null;
  }
  if (/^\d{1,4}$/.test(value)) {
    const seconds = Number(value);
    return Number.isInteger(seconds) && seconds >= 1 && seconds <= 3600 ? seconds : null;
  }
  const mmss = value.match(/^(\d{1,2}):(\d{2})$/);
  if (mmss) {
    const seconds = Number(mmss[1]) * 60 + Number(mmss[2]);
    return seconds >= 1 && seconds <= 3600 ? seconds : null;
  }
  return null;
}

function isRestTitle(title: string) {
  return /^rest\b/i.test(title.trim());
}

function inferKind(title: string): WorkoutStepKind {
  return isRestTitle(title) ? "rest" : "work";
}

function isTimeHeader(cells: string[]) {
  return cells[0]?.toLowerCase() === "time" && cells[1]?.toLowerCase() === "exercise";
}

function isRepeatOnce(cells: string[]) {
  return /^repeat\s+once$/i.test(cells[0] ?? "");
}

function isThemeRow(cells: string[]) {
  return /^theme:\s*/i.test(cells[0] ?? "");
}

function isAtHomeMarker(cells: string[]) {
  return /^at-?home:?$/i.test(cells[0] ?? "");
}

function isBlank(cells: string[]) {
  return cells.every((cell) => !cell.trim());
}

function flushBlock(blocks: BlockDraft[], block: BlockDraft | null) {
  if (!block) return;
  if (block.exercises.length === 0 && block.postRests.length === 0) return;
  blocks.push(block);
}

/**
 * Convert a Coach SlipL-style sheet export (Time / Exercise / Notes blocks)
 * into a flat take-home workout for the timer + Workout editor.
 */
export function convertSlipSheet(
  raw: string,
  options: SlipSheetConvertOptions = {},
): { workout?: ParsedWorkout; error?: string } {
  const text = raw.replace(/^\uFEFF/, "").trim();
  if (!text) return { error: "The coach sheet is empty." };

  const rows = text
    .split(/\r?\n/)
    .map((line) => splitCsvLine(line))
    .filter((cells) => !isBlank(cells));

  if (!rows.length) return { error: "The coach sheet has no content rows." };

  let title = "";
  let theme: string | undefined;
  const blocks: BlockDraft[] = [];
  let current: BlockDraft | null = null;
  let sawRepeat = false;

  for (const cells of rows) {
    if (isAtHomeMarker(cells) || isTimeHeader(cells)) continue;

    if (isThemeRow(cells)) {
      const themeText = (cells[0] ?? "").replace(/^theme:\s*/i, "").trim();
      if (themeText) theme = themeText.slice(0, 160);
      continue;
    }

    if (isRepeatOnce(cells)) {
      if (!current) return { error: `"Repeat once" appeared before a block header.` };
      current.repeatOnce = true;
      sawRepeat = true;
      continue;
    }

    const duration = parseDuration(cells[0] ?? "");
    if (duration !== null && (cells[1] ?? "").trim()) {
      if (!current) {
        current = { name: "Session", exercises: [], repeatOnce: false, postRests: [] };
        sawRepeat = false;
      }
      const exerciseTitle = (cells[1] ?? "").trim().slice(0, 120);
      const cue = (cells[2] ?? "").trim().slice(0, 200) || undefined;
      const row: RawExercise = {
        durationSeconds: duration,
        title: exerciseTitle,
        ...(cue ? { cue } : {}),
      };
      if (sawRepeat && isRestTitle(exerciseTitle)) {
        current.postRests.push(row);
      } else {
        current.exercises.push(row);
      }
      continue;
    }

    // Block / title header: first column filled, no duration, little/no exercise col.
    const header = (cells[0] ?? "").trim();
    if (!header) continue;
    if (!title) {
      title = header.slice(0, 160);
      continue;
    }

    flushBlock(blocks, current);
    current = {
      name: header.slice(0, 80),
      exercises: [],
      repeatOnce: false,
      postRests: [],
    };
    sawRepeat = false;
  }

  flushBlock(blocks, current);

  if (!title) return { error: "Could not find a workout title on the sheet." };
  if (!blocks.length) return { error: "No exercise blocks found on the sheet." };

  const slug = (options.slug?.trim() || slugifyWorkoutTitle(title)).toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return { error: "Derived slug is invalid. Provide a kebab-case slug in the Workout editor." };
  }

  const steps: WorkoutStep[] = [];
  let order = 1;
  const addBookends = options.addBookends !== false;

  if (addBookends) {
    steps.push({
      order: order++,
      title: "Get ready",
      durationSeconds: 10,
      kind: "prepare",
      block: blocks[0]?.name,
    });
  }

  for (const block of blocks) {
    const pass = block.repeatOnce ? [...block.exercises, ...block.exercises] : [...block.exercises];
    const sequence = [...pass, ...block.postRests];
    for (const exercise of sequence) {
      steps.push({
        order: order++,
        title: exercise.title,
        durationSeconds: exercise.durationSeconds,
        kind: inferKind(exercise.title),
        ...(exercise.cue ? { cue: exercise.cue } : {}),
        block: block.name,
      });
    }
  }

  if (addBookends) {
    steps.push({
      order: order++,
      title: "Done",
      durationSeconds: 5,
      kind: "done",
    });
  }

  if (steps.length > 200) {
    return { error: `Converted workout has too many steps (${steps.length}; max 200).` };
  }

  return {
    workout: {
      slug,
      title,
      ...(theme ? { theme } : {}),
      steps,
    },
  };
}
