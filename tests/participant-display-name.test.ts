import { describe, expect, it } from "vitest";
import { participantDisplayName } from "@/lib/registration/display";
import { eventCardAsset } from "@/lib/config/admin-visual-assets";

describe("participantDisplayName", () => {
  it("returns empty string for nullish values instead of throwing", () => {
    expect(participantDisplayName(null)).toBe("");
    expect(participantDisplayName(undefined)).toBe("");
  });

  it("still strips fixture suffixes from real names", () => {
    expect(participantDisplayName("Dar Al Hijrah")).toBe("Dar Al Hijrah");
  });
});

describe("eventCardAsset", () => {
  it("accepts nullish names without throwing", () => {
    expect(() => eventCardAsset(null)).not.toThrow();
    expect(() => eventCardAsset(undefined)).not.toThrow();
    expect(eventCardAsset(null)).toBeTruthy();
  });
});
