import { describe, expect, it } from "vitest";
import { appPathUrl } from "@/lib/http/app-redirect";

describe("appPathUrl", () => {
  it("builds Location from APP_BASE_URL, not an internal request host", () => {
    expect(
      appPathUrl("/registration/confirmation?token=abc", {
        APP_BASE_URL: "https://arakkis-candidate.onrender.com",
        NEXT_PUBLIC_APP_URL: "https://fallback.example.com",
      }),
    ).toBe("https://arakkis-candidate.onrender.com/registration/confirmation?token=abc");
  });

  it("falls back to NEXT_PUBLIC_APP_URL", () => {
    expect(
      appPathUrl("/manage-bookings", {
        NEXT_PUBLIC_APP_URL: "https://arakkis-candidate.onrender.com",
      }),
    ).toBe("https://arakkis-candidate.onrender.com/manage-bookings");
  });
});
