import { describe, expect, it, vi } from "vitest";
import { runReplacementLifecycle } from "@/lib/services/design-asset-replacement";

const ok = { ok: true, attempts: 1, unresolvedPaths: [] as string[] };
const debt = { ok: false, attempts: 2, unresolvedPaths: ["old.jpg"] };

function baseOps() {
  return {
    retirePrevious: vi.fn().mockResolvedValue({ error: null }),
    activateNew: vi.fn().mockResolvedValue({ error: null }),
    restorePrevious: vi.fn().mockResolvedValue(undefined),
    deactivateNew: vi.fn().mockResolvedValue(undefined),
    cleanupNew: vi.fn().mockResolvedValue(ok),
    cleanupPrevious: vi.fn().mockResolvedValue(ok),
    refresh: vi.fn(),
  };
}

describe("Event image replacement failure paths", () => {
  it("restores the previous asset and cleans the staged object on activation failure", async () => {
    const ops = baseOps();
    ops.activateNew.mockResolvedValue({ error: { message: "activation failed" } });
    const result = await runReplacementLifecycle(ops);
    expect(result).toMatchObject({ committed: false, error: "activation failed" });
    expect(ops.restorePrevious).toHaveBeenCalledOnce();
    expect(ops.deactivateNew).toHaveBeenCalledOnce();
    expect(ops.cleanupNew).toHaveBeenCalledOnce();
    expect(ops.cleanupPrevious).not.toHaveBeenCalled();
  });

  it("commits the replacement and reports old-object cleanup debt", async () => {
    const ops = baseOps();
    ops.cleanupPrevious.mockResolvedValue(debt);
    const result = await runReplacementLifecycle(ops);
    expect(result).toMatchObject({ committed: true, cleanupDebt: true });
    expect(ops.restorePrevious).not.toHaveBeenCalled();
    expect(ops.deactivateNew).not.toHaveBeenCalled();
    expect(ops.cleanupNew).not.toHaveBeenCalled();
  });

  it("keeps the committed replacement when refresh fails", async () => {
    const ops = baseOps();
    ops.refresh.mockImplementation(() => {
      throw new Error("refresh failed");
    });
    const result = await runReplacementLifecycle(ops);
    expect(result).toMatchObject({ committed: true, refreshFailed: true, cleanupDebt: false });
    expect(ops.restorePrevious).not.toHaveBeenCalled();
    expect(ops.deactivateNew).not.toHaveBeenCalled();
  });

  it("preserves the previous active asset for a pre-commit failure", async () => {
    const ops = baseOps();
    ops.retirePrevious.mockResolvedValue({ error: { message: "pre-commit failure" } });
    const result = await runReplacementLifecycle(ops);
    expect(result.committed).toBe(false);
    expect(result.error).toBe("pre-commit failure");
    expect(ops.restorePrevious).toHaveBeenCalledOnce();
    expect(ops.cleanupNew).toHaveBeenCalledOnce();
  });
});
