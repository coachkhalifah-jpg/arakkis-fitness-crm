import { describe, expect, it } from "vitest";
import { csvDocument, safeCsvFilename } from "@/lib/services/csv";

describe("CSV export helpers", () => {
  it("escapes delimiters, quotes, newlines, and formula-like values", () => {
    expect(csvDocument(["Value"], [['a,b"c\nd', "=SUM(A1)"]])).toBe(
      '"Value"\r\n"a,b""c\nd","\'=SUM(A1)"\r\n',
    );
  });

  it("creates safe download filenames", () => {
    expect(safeCsvFilename("Demo / Weekly Flow", "roster")).toBe("demo-weekly-flow.csv");
    expect(safeCsvFilename("!!!", "roster")).toBe("roster.csv");
  });
});
