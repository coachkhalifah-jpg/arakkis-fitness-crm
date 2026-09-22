import { afterEach, describe, expect, it, vi } from "vitest";

describe("features", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("defaults all Admin Events flags to false when env vars are unset", async () => {
    vi.stubEnv("NEXT_PUBLIC_FEATURE_ADMIN_EVENTS_V2", undefined);
    vi.stubEnv("NEXT_PUBLIC_FEATURE_RECURRENCE_PREVIEW", undefined);
    vi.stubEnv("NEXT_PUBLIC_FEATURE_PUBLISH_CONFIRM", undefined);
    vi.stubEnv("NEXT_PUBLIC_FEATURE_DRAFT_RECOVERY", undefined);

    const { features, isFeatureEnabled } = await import("@/lib/features");

    expect(features.adminEventsV2).toBe(false);
    expect(features.eventRecurrencePreview).toBe(false);
    expect(features.eventPublishConfirmation).toBe(false);
    expect(features.eventDraftRecovery).toBe(false);
    expect(isFeatureEnabled("adminEventsV2")).toBe(false);
  });

  it("enables a flag only when the env value is exactly true", async () => {
    vi.stubEnv("NEXT_PUBLIC_FEATURE_ADMIN_EVENTS_V2", "true");
    vi.stubEnv("NEXT_PUBLIC_FEATURE_RECURRENCE_PREVIEW", "1");
    vi.stubEnv("NEXT_PUBLIC_FEATURE_PUBLISH_CONFIRM", "TRUE");
    vi.stubEnv("NEXT_PUBLIC_FEATURE_DRAFT_RECOVERY", "false");

    const { features } = await import("@/lib/features");

    expect(features.adminEventsV2).toBe(true);
    expect(features.eventRecurrencePreview).toBe(false);
    expect(features.eventPublishConfirmation).toBe(false);
    expect(features.eventDraftRecovery).toBe(false);
  });
});

describe("resolveDeadlineLocal", () => {
  it("translates relative presets to registrationDeadlineLocal strings", async () => {
    const { resolveDeadlineLocal } = await import("@/lib/schemas/event");

    expect(resolveDeadlineLocal("2026-10-01T18:00", "AT_START")).toBe("2026-10-01T18:00");
    expect(resolveDeadlineLocal("2026-10-01T18:00", "MINUTES_30")).toBe("2026-10-01T17:30");
    expect(resolveDeadlineLocal("2026-10-01T18:00", "HOURS_1")).toBe("2026-10-01T17:00");
    expect(resolveDeadlineLocal("2026-10-01T18:00", "HOURS_2")).toBe("2026-10-01T16:00");
    expect(resolveDeadlineLocal("2026-10-01T18:00", "CUSTOM", "2026-10-01T12:00")).toBe(
      "2026-10-01T12:00",
    );
  });
});
