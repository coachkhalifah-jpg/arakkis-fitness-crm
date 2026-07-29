import { describe, expect, it } from "vitest";
import {
  canonicalRegistrationUrl,
  getAvailabilityState,
  normalizePublicSlug,
  resolveCanonicalBaseUrl,
} from "@/lib/services/phase-7";

describe("Phase 7 publishing services", () => {
  it("normalizes safe, bounded slugs and protects reserved routes", () => {
    expect(normalizePublicSlug("  Spring Strength & Mobility 2026! ")).toBe(
      "spring-strength-mobility-2026",
    );
    expect(normalizePublicSlug("admin")).toBe("admin-event");
    expect(normalizePublicSlug("Ä".repeat(100)).length).toBeLessThanOrEqual(80);
  });

  it("constructs canonical URLs without trailing slashes or tracking data", () => {
    const base = resolveCanonicalBaseUrl({
      appEnv: "staging",
      appBaseUrl: "https://events.example.test///",
    });
    expect(canonicalRegistrationUrl(base, "spring-strength")).toBe(
      "https://events.example.test/register/spring-strength",
    );
  });

  it("fails closed for non-local HTTP environments", () => {
    expect(() =>
      resolveCanonicalBaseUrl({ appEnv: "production", appBaseUrl: "http://events.example.test" }),
    ).toThrow(/HTTPS/);
  });

  it.each([
    ["NOT_YET_OPEN", { opensAt: "2030-01-01T00:00:00Z" }],
    ["PAUSED", { paused: true }],
    ["FULL", { activeRegistrations: 10, capacity: 10 }],
    ["CLOSED", { closesAt: "2020-01-01T00:00:00Z" }],
    ["UNPUBLISHED", { published: false }],
    ["CANCELLED", { cancelled: true }],
  ] as const)("returns %s availability", (state, overrides) => {
    expect(
      getAvailabilityState({
        published: true,
        cancelled: false,
        organizationActive: true,
        venueActive: true,
        paused: false,
        activeRegistrations: 0,
        capacity: 10,
        legallyBlocked: false,
        now: new Date("2026-01-01T00:00:00Z"),
        ...overrides,
      }),
    ).toBe(state);
  });
});
