import { describe, expect, it, vi } from "vitest";
import { cleanupStoragePaths, isAlreadyAbsentStorageError } from "@/lib/services/storage-cleanup";

describe("staged event image cleanup", () => {
  it("removes duplicate paths once and succeeds", async () => {
    const remove = vi.fn().mockResolvedValue({ error: null });
    await expect(cleanupStoragePaths(["a", "a", "b"], remove)).resolves.toMatchObject({
      ok: true,
      attempts: 1,
      unresolvedPaths: [],
    });
    expect(remove).toHaveBeenCalledWith(["a", "b"]);
  });

  it("treats an already-absent object as successful cleanup", async () => {
    const remove = vi.fn().mockResolvedValue({ error: { statusCode: 404, message: "Not found" } });
    await expect(cleanupStoragePaths(["request-scoped-path"], remove)).resolves.toMatchObject({
      ok: true,
      attempts: 1,
    });
    expect(isAlreadyAbsentStorageError({ message: "Object does not exist" })).toBe(true);
  });

  it("retries once and reports unresolved paths after the bounded limit", async () => {
    const remove = vi
      .fn()
      .mockResolvedValue({ error: { statusCode: 503, message: "Storage unavailable" } });
    await expect(cleanupStoragePaths(["request-scoped-path"], remove, 2)).resolves.toMatchObject({
      ok: false,
      attempts: 2,
      unresolvedPaths: ["request-scoped-path"],
    });
    expect(remove).toHaveBeenCalledTimes(2);
  });

  it("keeps retry limits when the storage adapter rejects", async () => {
    const remove = vi.fn().mockRejectedValue(new Error("network failure"));
    await expect(cleanupStoragePaths(["request-scoped-path"], remove, 2)).resolves.toMatchObject({
      ok: false,
      attempts: 2,
      unresolvedPaths: ["request-scoped-path"],
      lastError: { message: "network failure" },
    });
  });
});
