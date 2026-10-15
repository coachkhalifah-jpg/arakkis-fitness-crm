import { describe, expect, it } from "vitest";
import { parseWorkoutCsv } from "@/lib/workouts/csv";

const sample = `workout_slug,workout_title,step_order,step_title,duration_seconds,step_kind
home-core-15,15-Minute Core Finisher,1,Get ready,10,prepare
home-core-15,15-Minute Core Finisher,2,Dead bug,40,work
home-core-15,15-Minute Core Finisher,3,Rest,20,rest
`;

describe("take-home workout CSV import", () => {
  it("parses a valid multi-step workout", () => {
    const result = parseWorkoutCsv(sample);
    expect(result.error).toBeUndefined();
    expect(result.workouts).toHaveLength(1);
    expect(result.workouts[0]).toMatchObject({
      slug: "home-core-15",
      title: "15-Minute Core Finisher",
    });
    expect(result.workouts[0].steps).toHaveLength(3);
    expect(result.workouts[0].steps[1]).toEqual({
      order: 2,
      title: "Dead bug",
      durationSeconds: 40,
      kind: "work",
    });
  });

  it("parses optional theme, cue, and block", () => {
    const result = parseWorkoutCsv(`workout_slug,workout_title,workout_theme,step_order,step_title,duration_seconds,step_kind,cue,block
slip-a,Slip Ladder A,Outside Slip + Pendulum,1,Get ready,10,prepare,,Warmup
slip-a,Slip Ladder A,Outside Slip + Pendulum,2,Jab slip,30,work,Stay tall,Round 1
`);
    expect(result.error).toBeUndefined();
    expect(result.workouts[0]).toMatchObject({
      slug: "slip-a",
      title: "Slip Ladder A",
      theme: "Outside Slip + Pendulum",
    });
    expect(result.workouts[0].steps[1]).toEqual({
      order: 2,
      title: "Jab slip",
      durationSeconds: 30,
      kind: "work",
      cue: "Stay tall",
      block: "Round 1",
    });
    expect(result.workouts[0].steps[0].cue).toBeUndefined();
  });

  it("rejects mismatched theme rows for the same slug", () => {
    const result = parseWorkoutCsv(`workout_slug,workout_title,workout_theme,step_order,step_title,duration_seconds,step_kind
slip-a,Slip Ladder A,Theme A,1,Get ready,10,prepare
slip-a,Slip Ladder A,Theme B,2,Work,30,work
`);
    expect(result.error).toMatch(/workout_theme/);
  });

  it("rejects missing columns and bad slugs", () => {
    expect(parseWorkoutCsv("a,b\n1,2").error).toMatch(/Missing required column/);
    expect(
      parseWorkoutCsv(
        `workout_slug,workout_title,step_order,step_title,duration_seconds,step_kind
Bad_Slug,Title,1,Step,10,work
`,
      ).error,
    ).toMatch(/kebab-case/);
  });

  it("groups multiple workouts from one CSV", () => {
    const result = parseWorkoutCsv(`${sample}
box-warmup,Boxing Warmup,1,Jump rope,60,work
`);
    expect(result.error).toBeUndefined();
    expect(result.workouts.map((workout) => workout.slug).sort()).toEqual([
      "box-warmup",
      "home-core-15",
    ]);
  });
});
