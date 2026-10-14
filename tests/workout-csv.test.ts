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
