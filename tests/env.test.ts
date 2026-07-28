// @vitest-environment node

import { afterEach, describe, expect, it } from "vitest";
import { getPublicEnv, getServerEnv } from "@/lib/config/env";

const originalEnv = process.env;

afterEach(() => {
  process.env = originalEnv;
});

describe("environment validation", () => {
  it("rejects missing public variables", () => {
    process.env = { NODE_ENV: "test" };
    expect(() => getPublicEnv()).toThrow();
  });

  it("separates validated public and server variables", () => {
    process.env = {
      NODE_ENV: "test",
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "public-key",
      NEXT_PUBLIC_APP_URL: "http://localhost:3000",
      SUPABASE_SERVICE_ROLE_KEY: "server-only-key",
      APP_ENV: "test",
    };
    expect(getPublicEnv()).not.toHaveProperty("SUPABASE_SERVICE_ROLE_KEY");
    expect(getServerEnv()).toHaveProperty("SUPABASE_SERVICE_ROLE_KEY", "server-only-key");
  });
});
