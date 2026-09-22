import { describe, expect, it } from "vitest";
import { formatCreateEventFieldErrors, resolveDeadlineLocal } from "@/lib/schemas/event";
import { z } from "zod";

describe("create event validation helpers", () => {
  it("maps zod issues to field errors", () => {
    const schema = z.object({ capacity: z.number().positive() });
    const result = schema.safeParse({ capacity: -1 });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(formatCreateEventFieldErrors(result.error)).toEqual([
      expect.objectContaining({ field: "capacity" }),
    ]);
  });

  it("keeps custom deadline passthrough", () => {
    expect(resolveDeadlineLocal("2026-10-01T10:00", "CUSTOM", "2026-10-01T08:15")).toBe(
      "2026-10-01T08:15",
    );
  });
});
