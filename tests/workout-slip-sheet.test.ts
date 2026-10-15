import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { convertSlipSheet, slugifyWorkoutTitle } from "@/lib/workouts/slip-sheet";

const slipL = `SlipL - A,,
AT-HOME:,,
,,
Theme: Outside Slip + Pendulum Footwork,,
Warmup (3 min),,
Time,Exercise,Notes
:30,wrist circles,
:30,shoulder rolls,
:30,torso twists,
:30,knee bends,
:30,alternating foot taps,
:30,shadowboxing light,
,,
"Round 1: Footwork (3 min, 1 min rest)",,
Time,Exercise,Notes
:30,pendulum step (forward/back),
:30,slipL + pause,
:30,lateral exit left,
Repeat once,,
:60,rest,
"Round 2: Shadowboxing (3 min, 1 min rest)",,
Time,Exercise,Notes
:30,1-2 only,
:30,1-slipL-1,
:30,slipL → 3 (lead hook),
Repeat once,,
:60,rest,
"Round 3: Flow / Conditioning (3 min, 1 min rest)",,
Time,Exercise,Notes
:30,1-2-slipL-3-2,
:30,1-slipL-1,
:30,slipL → 3 → 2,
Repeat once,,
:60,rest,
Core (5 min),,
Time,Exercise,Notes
:45,plank,
:45,Russian twists,
:45,leg raises,
:45,bicycle crunches,
:45,rest,
Repeat once,,
Cooldown (2 min),,
Time,Exercise,Notes
:30,Deep breathing,
:30,Shoulder stretch,
:30,Hip flexor stretch,
:30,Calf stretch,
`;

describe("SlipL coach sheet converter", () => {
  it("slugifies titles", () => {
    expect(slugifyWorkoutTitle("SlipL - A")).toBe("slipl-a");
  });

  it("expands SlipL-A to 43 steps with bookends", () => {
    const result = convertSlipSheet(slipL);
    expect(result.error).toBeUndefined();
    expect(result.workout).toMatchObject({
      slug: "slipl-a",
      title: "SlipL - A",
      theme: "Outside Slip + Pendulum Footwork",
    });
    expect(result.workout?.steps).toHaveLength(43);
    expect(result.workout?.steps[0]).toMatchObject({
      kind: "prepare",
      title: "Get ready",
      durationSeconds: 10,
    });
    expect(result.workout?.steps.at(-1)).toMatchObject({
      kind: "done",
      title: "Done",
      durationSeconds: 5,
    });

    // Round 1: 3 exercises ×2 + one post rest
    const round1 = result.workout!.steps.filter((step) =>
      step.block?.startsWith("Round 1"),
    );
    expect(round1).toHaveLength(7);
    expect(round1.filter((step) => step.kind === "rest")).toHaveLength(1);
    expect(round1.at(-1)).toMatchObject({ title: "rest", durationSeconds: 60, kind: "rest" });

    // Core: inner rest repeats with each pass (5 × 2)
    const core = result.workout!.steps.filter((step) => step.block === "Core (5 min)");
    expect(core).toHaveLength(10);
    expect(core.filter((step) => step.kind === "rest")).toHaveLength(2);
  });

  it("can omit prepare/done bookends", () => {
    const result = convertSlipSheet(slipL, { addBookends: false });
    expect(result.workout?.steps).toHaveLength(41);
    expect(result.workout?.steps[0]?.kind).not.toBe("prepare");
  });

  it("converts the downloaded Google Sheet export fixture when present", () => {
    let raw = "";
    try {
      raw = readFileSync("/tmp/slipl-a.csv", "utf8");
    } catch {
      return;
    }
    const result = convertSlipSheet(raw);
    expect(result.error).toBeUndefined();
    expect(result.workout?.steps.length).toBeGreaterThanOrEqual(41);
  });
});
