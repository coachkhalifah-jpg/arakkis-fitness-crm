// @vitest-environment node

import { describe, expect, it } from "vitest";
import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import {
  applySessionCacheHeaders,
  applySessionCookies,
  hasSupabaseAuthTokenCookie,
  passwordResetRedirectTo,
  publicAppOrigin,
  redirectWithSession,
  supabaseAuthCookieOptions,
  writeRefreshedSession,
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
    expect(hasSupabaseAuthTokenCookie([{ name: "sb-abc-auth-token", value: "" }])).toBe(false);
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

  it("marks auth cookies Secure only for an https public app URL", () => {
    expect(supabaseAuthCookieOptions("https://arakkis.onrender.com")).toMatchObject({
      path: "/",
      sameSite: "lax",
      secure: true,
    });
    expect(supabaseAuthCookieOptions("http://127.0.0.1:3000").secure).toBe(false);
    expect(supabaseAuthCookieOptions("not a url").secure).toBe(false);
  });

  it("writes refreshed session cookies onto the request and the response", () => {
    const request = new NextRequest("https://arakkis.onrender.com/admin", {
      headers: { cookie: "sb-abc-auth-token=stale" },
    });
    const response = writeRefreshedSession(
      request,
      [
        {
          name: "sb-abc-auth-token",
          value: "refreshed",
          options: { path: "/", sameSite: "lax", secure: true, httpOnly: false, maxAge: 34560000 },
        },
      ],
      {
        "Cache-Control": "private, no-cache, no-store, must-revalidate, max-age=0",
        Expires: "0",
        Pragma: "no-cache",
      },
    );

    expect(request.cookies.get("sb-abc-auth-token")?.value).toBe("refreshed");
    expect(response.cookies.get("sb-abc-auth-token")?.value).toBe("refreshed");
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("pragma")).toBe("no-cache");
  });

  it("keeps cleared session cookies on an unauthenticated redirect", () => {
    const source = writeRefreshedSession(
      new NextRequest("https://arakkis.onrender.com/admin/events"),
      [
        {
          name: "sb-abc-auth-token",
          value: "",
          options: { path: "/", sameSite: "lax", secure: true, maxAge: 0 },
        },
      ],
    );
    const response = redirectWithSession(
      new URL("https://arakkis.onrender.com/admin/sign-in?next=/admin/events"),
      [
        {
          name: "sb-abc-auth-token",
          value: "",
          options: { path: "/", sameSite: "lax", secure: true, maxAge: 0 },
        },
      ],
      source,
    );

    expect(response.headers.get("location")).toBe(
      "https://arakkis.onrender.com/admin/sign-in?next=/admin/events",
    );
    expect(response.cookies.get("sb-abc-auth-token")?.value).toBe("");
    expect(response.headers.get("cache-control")).toContain("no-store");
  });

  it("falls back to no-store cache headers when the SSR library omits them", () => {
    const response = writeRefreshedSession(new NextRequest("https://arakkis.onrender.com/admin"), [
      { name: "sb-abc-auth-token", value: "refreshed", options: { path: "/" } },
    ]);
    expect(response.headers.get("cache-control")).toBe(
      "private, no-cache, no-store, must-revalidate, max-age=0",
    );
    applySessionCacheHeaders(response, { Expires: "0" });
    expect(response.headers.get("expires")).toBe("0");
  });
});
