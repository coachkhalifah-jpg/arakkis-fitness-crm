import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createEventImageIntent,
  EVENT_IMAGE_ASSET_TYPE,
  verifyEventImageIntent,
} from "@/lib/services/event-image-intent";

describe("event image replacement intent", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  function useServerEnv() {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-test-key");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-test-key");
    vi.stubEnv("APP_ENV", "development");
  }
  const eventA = "11111111-1111-4111-8111-111111111111";
  const eventB = "22222222-2222-4222-8222-222222222222";
  const actor = "33333333-3333-4333-8333-333333333333";

  it("binds the signed context to actor, event, purpose, and expiry", () => {
    vi.stubGlobal("window", undefined);
    useServerEnv();
    const now = 1_700_000_000_000;
    const token = createEventImageIntent(eventA, actor, EVENT_IMAGE_ASSET_TYPE, now);
    expect(verifyEventImageIntent(token, eventA, actor, EVENT_IMAGE_ASSET_TYPE, now + 1)).toBe(
      true,
    );
    expect(verifyEventImageIntent(token, eventA, actor, "EVENT_IMAGE_MOBILE", now + 1)).toBe(false);
    expect(verifyEventImageIntent(token, eventA, actor, "", now + 1)).toBe(false);
    expect(verifyEventImageIntent(token, eventB, actor, EVENT_IMAGE_ASSET_TYPE, now + 1)).toBe(
      false,
    );
    expect(
      verifyEventImageIntent(
        token,
        eventA,
        "44444444-4444-4444-8444-444444444444",
        EVENT_IMAGE_ASSET_TYPE,
        now + 1,
      ),
    ).toBe(false);
    expect(
      verifyEventImageIntent(token, eventA, actor, EVENT_IMAGE_ASSET_TYPE, now + 10 * 60 * 1000),
    ).toBe(false);
    expect(
      verifyEventImageIntent(
        createEventImageIntent(eventA, actor, "EVENT_IMAGE_MOBILE", now),
        eventA,
        actor,
        "EVENT_IMAGE_MOBILE",
        now + 1,
      ),
    ).toBe(false);
  });

  it("rejects a modified signature and malformed context", () => {
    vi.stubGlobal("window", undefined);
    useServerEnv();
    const token = createEventImageIntent(eventA, actor, EVENT_IMAGE_ASSET_TYPE, 1_700_000_000_000);
    const [payload, signature] = token.split(".");
    expect(
      verifyEventImageIntent(
        `${payload}.${signature.slice(0, -1)}x`,
        eventA,
        actor,
        EVENT_IMAGE_ASSET_TYPE,
        1_700_000_000_001,
      ),
    ).toBe(false);
    expect(verifyEventImageIntent("not-a-token", eventA, actor, EVENT_IMAGE_ASSET_TYPE)).toBe(
      false,
    );
    const wrongPurpose = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    wrongPurpose.purpose = "OTHER_OPERATION";
    const changedPayload = Buffer.from(JSON.stringify(wrongPurpose)).toString("base64url");
    expect(
      verifyEventImageIntent(
        `${changedPayload}.${signature}`,
        eventA,
        actor,
        EVENT_IMAGE_ASSET_TYPE,
        1_700_000_000_001,
      ),
    ).toBe(false);
  });
});
