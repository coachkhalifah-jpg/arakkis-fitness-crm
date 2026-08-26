import { describe, expect, it } from "vitest";
import {
  ENGAGE_CATEGORIES,
  ENGAGE_RECOMMENDATION_LIBRARY,
  validateEngageRecommendationLibrary,
  getEngageRecommendationPeriod,
  selectEngageRecommendations,
} from "@/lib/services/engage-recommendations";

describe("Group Engage Slice 1 recommendation contract", () => {
  it("supports exactly the six approved categories", () => {
    expect(ENGAGE_CATEGORIES).toEqual([
      "BEFORE_CLASS",
      "AFTER_CLASS",
      "CHALLENGES",
      "TIPS",
      "POLLS",
      "LOGISTICS",
    ]);
    expect(new Set(ENGAGE_RECOMMENDATION_LIBRARY.map((item) => item.category))).toEqual(
      new Set(ENGAGE_CATEGORIES),
    );
    expect(ENGAGE_RECOMMENDATION_LIBRARY).toHaveLength(90);
    for (const category of ENGAGE_CATEGORIES) {
      expect(
        ENGAGE_RECOMMENDATION_LIBRARY.filter((item) => item.category === category),
      ).toHaveLength(15);
    }
  });

  it("keeps stable IDs and selects the same recommendation within a period", () => {
    const first = selectEngageRecommendations({ period: "2026-W34" });
    const second = selectEngageRecommendations({ period: "2026-W34" });

    expect(first).toEqual(second);
    expect(
      first.every((item) =>
        ENGAGE_RECOMMENDATION_LIBRARY.some((candidate) => candidate.id === item.id),
      ),
    ).toBe(true);
    expect(new Set(first.map((item) => item.id)).size).toBe(first.length);
    expect(first.every((item) => item.source === "EVERGREEN")).toBe(true);
  });

  it("can rotate a category when the deterministic period changes", () => {
    const periods = Array.from(
      { length: 40 },
      (_, index) => `2026-W${String(index + 1).padStart(2, "0")}`,
    );
    const selectedIds = new Set(
      periods.map((period) => selectEngageRecommendations({ period, categories: ["TIPS"] })[0].id),
    );

    expect(selectedIds.size).toBeGreaterThan(1);
  });

  it("derives a stable ISO week period without persistence or task fields", () => {
    const first = getEngageRecommendationPeriod(new Date("2026-08-17T12:00:00.000Z"));
    const second = getEngageRecommendationPeriod(new Date("2026-08-23T23:59:59.000Z"));
    const next = getEngageRecommendationPeriod(new Date("2026-08-24T00:00:00.000Z"));

    expect(first).toBe(second);
    expect(next).not.toBe(first);
    expect(
      selectEngageRecommendations({ period: first }).every(
        (item) =>
          !Object.hasOwn(item, "dueAt") &&
          !Object.hasOwn(item, "status") &&
          !Object.hasOwn(item, "assignedAdminId"),
      ),
    ).toBe(true);
  });

  it("validates IDs, required fields, categories, copy, and CTA/category contracts", () => {
    expect(() => validateEngageRecommendationLibrary(ENGAGE_RECOMMENDATION_LIBRARY)).not.toThrow();
    const invalid: Array<Record<string, unknown>> = ENGAGE_RECOMMENDATION_LIBRARY.map((item) => ({
      ...item,
    }));
    invalid[1] = { ...invalid[1], id: invalid[0].id };
    invalid[2] = { ...invalid[2], title: invalid[0].title };
    invalid[3] = { ...invalid[3], category: "POLLS", cta: "Draft Tip" };
    invalid[4] = { ...invalid[4], suggestedNote: "" };
    expect(() => validateEngageRecommendationLibrary(invalid)).toThrow(
      /duplicate recommendation id/,
    );
    expect(() => validateEngageRecommendationLibrary(invalid)).toThrow(/invalid CTA/);
    expect(() => validateEngageRecommendationLibrary(invalid)).toThrow(
      /empty or malformed suggestedNote/,
    );
    expect(() => validateEngageRecommendationLibrary(invalid.slice(0, 1))).toThrow(
      /missing recommendation category/,
    );
  });

  it("keeps deterministic category selection lightweight for a 96-item library", () => {
    const ctas = {
      BEFORE_CLASS: "Draft Reminder",
      AFTER_CLASS: "Create Class Note",
      CHALLENGES: "Draft Challenge",
      TIPS: "Draft Tip",
      POLLS: "Create Poll",
      LOGISTICS: "Draft Reminder",
    } as const;
    const synthetic = Array.from({ length: 96 }, (_, index) => {
      const category = ENGAGE_CATEGORIES[index % ENGAGE_CATEGORIES.length];
      return {
        id: `synthetic-${index}`,
        source: "EVERGREEN" as const,
        category,
        eyebrow: category,
        title: `Synthetic recommendation ${index}`,
        context: `Synthetic context ${index}`,
        suggestedNote: `Synthetic note ${index}`,
        cta: ctas[category],
      };
    });
    validateEngageRecommendationLibrary(synthetic);
    const first = selectEngageRecommendations({ period: "2026-W34", library: synthetic });
    const second = selectEngageRecommendations({ period: "2026-W34", library: synthetic });
    expect(first).toEqual(second);
    expect(first).toHaveLength(ENGAGE_CATEGORIES.length);
    expect(new Set(first.map((item) => item.id)).size).toBe(first.length);
    expect(first.map((item) => item.category)).toEqual([...ENGAGE_CATEGORIES]);
  });
});
