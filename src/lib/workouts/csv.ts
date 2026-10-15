export type WorkoutStepKind = "prepare" | "work" | "rest" | "done";

export type WorkoutStep = {
  order: number;
  title: string;
  durationSeconds: number;
  kind: WorkoutStepKind;
  cue?: string;
  block?: string;
};

export type ParsedWorkout = {
  slug: string;
  title: string;
  theme?: string;
  steps: WorkoutStep[];
};

const STEP_KINDS = new Set<WorkoutStepKind>(["prepare", "work", "rest", "done"]);
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const REQUIRED_HEADERS = [
  "workout_slug",
  "workout_title",
  "step_order",
  "step_title",
  "duration_seconds",
  "step_kind",
] as const;
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

function normalizeHeader(value: string) {
  return value
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase();
}

function optionalText(value: string | undefined, max: number): string | undefined {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return undefined;
  if (trimmed.length > max) return undefined;
  return trimmed;
}

export function parseWorkoutCsv(raw: string): { workouts: ParsedWorkout[]; error?: string } {
  const text = raw.replace(/^\uFEFF/, "").trim();
  if (!text) return { workouts: [], error: "The CSV file is empty." };

  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (lines.length < 2) return { workouts: [], error: "Add a header row and at least one step." };

  const headers = splitCsvLine(lines[0]).map(normalizeHeader);
  for (const required of REQUIRED_HEADERS) {
    if (!headers.includes(required)) {
      return {
        workouts: [],
        error: `Missing required column "${required}". Use the take-home workout CSV template.`,
      };
    }
  }

  const index = Object.fromEntries(headers.map((header, i) => [header, i])) as Record<string, number>;
  const hasTheme = headers.includes("workout_theme");
  const hasCue = headers.includes("cue");
  const hasBlock = headers.includes("block");

  type Draft = {
    slug: string;
    title: string;
    theme?: string;
    steps: WorkoutStep[];
  };
  const drafts = new Map<string, Draft>();

  for (let rowNumber = 2; rowNumber <= lines.length; rowNumber += 1) {
    const cells = splitCsvLine(lines[rowNumber - 1]);
    const slug = (cells[index.workout_slug] ?? "").toLowerCase();
    const title = cells[index.workout_title] ?? "";
    const orderRaw = cells[index.step_order] ?? "";
    const stepTitle = cells[index.step_title] ?? "";
    const durationRaw = cells[index.duration_seconds] ?? "";
    const kindRaw = (cells[index.step_kind] ?? "").toLowerCase() as WorkoutStepKind;
    const themeRaw = hasTheme ? (cells[index.workout_theme] ?? "") : "";
    const cueRaw = hasCue ? (cells[index.cue] ?? "") : "";
    const blockRaw = hasBlock ? (cells[index.block] ?? "") : "";

    if (!SLUG_PATTERN.test(slug)) {
      return {
        workouts: [],
        error: `Row ${rowNumber}: workout_slug must be lowercase kebab-case (e.g. home-core-15).`,
      };
    }
    if (!title || title.length > 160) {
      return {
        workouts: [],
        error: `Row ${rowNumber}: workout_title must be 1–160 characters.`,
      };
    }
    if (hasTheme && themeRaw.trim().length > 160) {
      return {
        workouts: [],
        error: `Row ${rowNumber}: workout_theme must be at most 160 characters.`,
      };
    }
    const order = Number(orderRaw);
    if (!Number.isInteger(order) || order < 1 || order > 200) {
      return {
        workouts: [],
        error: `Row ${rowNumber}: step_order must be an integer from 1 to 200.`,
      };
    }
    if (!stepTitle || stepTitle.length > 120) {
      return {
        workouts: [],
        error: `Row ${rowNumber}: step_title must be 1–120 characters.`,
      };
    }
    const durationSeconds = Number(durationRaw);
    if (!Number.isInteger(durationSeconds) || durationSeconds < 1 || durationSeconds > 3600) {
      return {
        workouts: [],
        error: `Row ${rowNumber}: duration_seconds must be an integer from 1 to 3600.`,
      };
    }
    if (!STEP_KINDS.has(kindRaw)) {
      return {
        workouts: [],
        error: `Row ${rowNumber}: step_kind must be prepare, work, rest, or done.`,
      };
    }
    if (hasCue && cueRaw.trim().length > 200) {
      return {
        workouts: [],
        error: `Row ${rowNumber}: cue must be at most 200 characters.`,
      };
    }
    if (hasBlock && blockRaw.trim().length > 80) {
      return {
        workouts: [],
        error: `Row ${rowNumber}: block must be at most 80 characters.`,
      };
    }

    const theme = optionalText(themeRaw, 160);
    const cue = optionalText(cueRaw, 200);
    const block = optionalText(blockRaw, 80);

    const existing = drafts.get(slug);
    if (existing && existing.title !== title) {
      return {
        workouts: [],
        error: `Row ${rowNumber}: workout_title for slug "${slug}" does not match earlier rows.`,
      };
    }
    if (existing && (existing.theme ?? "") !== (theme ?? "")) {
      return {
        workouts: [],
        error: `Row ${rowNumber}: workout_theme for slug "${slug}" does not match earlier rows.`,
      };
    }
    const draft = existing ?? { slug, title, theme, steps: [] };
    if (!existing && theme) draft.theme = theme;
    if (draft.steps.some((step) => step.order === order)) {
      return {
        workouts: [],
        error: `Row ${rowNumber}: duplicate step_order ${order} for slug "${slug}".`,
      };
    }
    draft.steps.push({
      order,
      title: stepTitle,
      durationSeconds,
      kind: kindRaw,
      ...(cue ? { cue } : {}),
      ...(block ? { block } : {}),
    });
    drafts.set(slug, draft);
  }

  const workouts = [...drafts.values()].map((draft) => ({
    slug: draft.slug,
    title: draft.title,
    ...(draft.theme ? { theme: draft.theme } : {}),
    steps: draft.steps.sort((a, b) => a.order - b.order),
  }));

  for (const workout of workouts) {
    if (workout.steps.length > 200) {
      return {
        workouts: [],
        error: `Workout "${workout.slug}" has too many steps (max 200).`,
      };
    }
  }

  return { workouts };
}
