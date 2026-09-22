import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  mapDesignAssetUploadError,
  uploadDesignAssetObject,
} from "@/lib/services/design-asset-storage";

function storageClient(result: { error: { message: string; statusCode?: string } | null }) {
  const from = vi.fn(() => ({
    upload: vi
      .fn()
      .mockResolvedValue({ data: result.error ? null : { path: "ok" }, error: result.error }),
  }));
  return {
    client: { storage: { from } } as unknown as SupabaseClient,
    from,
  };
}

describe("design asset storage upload", () => {
  it("maps bucket and permission failures to actionable messages", () => {
    expect(mapDesignAssetUploadError({ message: "Bucket not found" })).toBe(
      "Image storage is not configured (missing design-assets bucket).",
    );
    expect(
      mapDesignAssetUploadError(
        { message: "new row violates row-level security policy" },
        "event image",
      ),
    ).toBe("The event image could not be uploaded because storage permission was denied.");
    expect(mapDesignAssetUploadError({ message: "mysterious failure" })).toBe(
      "The image could not be uploaded.",
    );
  });

  it("uses the session client when it succeeds", async () => {
    const session = storageClient({ error: null });
    const privileged = storageClient({ error: { message: "should not be called" } });
    const result = await uploadDesignAssetObject(
      session.client,
      privileged.client,
      "event_image_desktop/a.png",
      Buffer.from("png"),
      "image/png",
    );
    expect(result.error).toBeNull();
    expect(session.from).toHaveBeenCalledWith("design-assets");
    expect(privileged.from).not.toHaveBeenCalled();
  });

  it("falls back to the privileged client after a session upload failure", async () => {
    const session = storageClient({
      error: { message: "new row violates row-level security policy", statusCode: "403" },
    });
    const privileged = storageClient({ error: null });
    const result = await uploadDesignAssetObject(
      session.client,
      privileged.client,
      "event_image_desktop/a.png",
      Buffer.from("png"),
      "image/png",
    );
    expect(result.error).toBeNull();
    expect(session.from).toHaveBeenCalledOnce();
    expect(privileged.from).toHaveBeenCalledOnce();
  });

  it("returns the privileged error when both clients fail", async () => {
    const session = storageClient({ error: { message: "session denied" } });
    const privileged = storageClient({ error: { message: "Bucket not found", statusCode: "404" } });
    const result = await uploadDesignAssetObject(
      session.client,
      privileged.client,
      "event_image_desktop/a.png",
      Buffer.from("png"),
      "image/png",
    );
    expect(result.error?.message).toBe("Bucket not found");
    expect(mapDesignAssetUploadError(result.error!)).toBe(
      "Image storage is not configured (missing design-assets bucket).",
    );
  });
});
