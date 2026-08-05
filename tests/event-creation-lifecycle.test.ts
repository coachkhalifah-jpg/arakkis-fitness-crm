import { describe, expect, it, vi } from "vitest";
import {
  clearCommittedCleanupCandidates,
  runPostCommitRefresh,
} from "@/lib/services/event-creation-lifecycle";

describe("event creation commit boundary", () => {
  it("clears attached image cleanup candidates before refresh", () => {
    const committedPath = "event_image_staging/request/event/image.jpg";
    const candidates = [committedPath];
    const cleanup = vi.fn();

    clearCommittedCleanupCandidates(candidates);
    const refresh = runPostCommitRefresh(() => {
      if (candidates.length) cleanup(candidates);
      throw new Error("cache refresh failed");
    });

    expect(refresh.ok).toBe(false);
    expect(candidates).toEqual([]);
    expect(cleanup).not.toHaveBeenCalled();
  });

  it("preserves a committed result when refresh throws", () => {
    const error = new Error("revalidate failed");
    const refresh = runPostCommitRefresh(() => {
      throw error;
    });

    expect(refresh).toEqual({ ok: false, error });
  });
});
