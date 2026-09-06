import { describe, expect, it } from "vitest";
import { NextResponse } from "next/server";
import {
  applySessionCookies,
  hasSupabaseAuthTokenCookie,
  passwordResetRedirectTo,
  publicAppOrigin,
} from "@/lib/auth/session-cookies";
import { PASSWORD_UPDATE_PATH } from "@/lib/auth/redirects";

describe("session cookie helpers", () => {
  it("detects non-empty Supabase SSR auth-token cookies", () => {
    expect(
      hasSupabaseAuthTokenCookie([
        { name: "sb-abc-auth-token", value: "chunk" },
        { name: "other", value: "x" },
      ]),
    ).toBe(true);
    expect(
      hasSupabaseAuthTokenCookie([{ name: "sb-abc-auth-token", value: "" }]),
    ).toBe(false);
    expect(hasSupabaseAuthTokenCookie([{ name: "session", value: "nope" }])).toBe(false);
  });

  it("prefers APP_BASE_URL for the public application origin", () => {
    expect(
      publicAppOrigin({
        APP_BASE_URL: "https://app.example.com",
        NEXT_PUBLIC_APP_URL: "https://fallback.example.com",
      }),
    ).toBe("https://app.example.com");
    expect(
      publicAppOrigin({
        NEXT_PUBLIC_APP_URL: "https://fallback.example.com",
      }),
    ).toBe("https://fallback.example.com");
  });

  it("builds password-reset redirectTo against the configured public origin", () => {
    expect(passwordResetRedirectTo("https://app.example.com", PASSWORD_UPDATE_PATH)).toBe(
      `https://app.example.com/auth/callback?next=${PASSWORD_UPDATE_PATH}`,
    );
  });

  it("does not use an internal request host when applying redirect cookies", () => {
    const response = NextResponse.redirect("https://app.example.com/admin/update-password");
    applySessionCookies(response, [
      {
        name: "sb-abc-auth-token",
        value: "session-value",
        options: { path: "/", sameSite: "lax", secure: true, httpOnly: false },
      },
    ]);
    const cookie = response.cookies.get("sb-abc-auth-token");
    expect(cookie?.value).toBe("session-value");
    expect(response.headers.get("location")).toBe("https://app.example.com/admin/update-password");
  });
});
