import type { StorageCleanupResult } from "@/lib/services/storage-cleanup";

export type ReplacementFailure = { message: string };

export type ReplacementLifecycleOps = {
  retirePrevious: () => Promise<{ error: ReplacementFailure | null }>;
  activateNew: () => Promise<{ error: ReplacementFailure | null }>;
  restorePrevious: () => Promise<void>;
  deactivateNew: () => Promise<void>;
  cleanupNew: () => Promise<StorageCleanupResult>;
  cleanupPrevious: () => Promise<StorageCleanupResult>;
  refresh: () => void;
};

export type ReplacementLifecycleResult = {
  committed: boolean;
  cleanupDebt: boolean;
  refreshFailed: boolean;
  error?: string;
};

export async function runReplacementLifecycle(
  ops: ReplacementLifecycleOps,
): Promise<ReplacementLifecycleResult> {
  let committed = false;
  try {
    const retired = await ops.retirePrevious();
    if (retired.error) throw new Error(retired.error.message);
    const activated = await ops.activateNew();
    if (activated.error) throw new Error(activated.error.message);
    committed = true;

    const previousCleanup = await ops.cleanupPrevious();
    let refreshFailed = false;
    try {
      ops.refresh();
    } catch {
      refreshFailed = true;
    }
    return {
      committed: true,
      cleanupDebt: !previousCleanup.ok,
      refreshFailed,
    };
  } catch (error) {
    if (!committed) {
      await ops.restorePrevious().catch(() => undefined);
      await ops.deactivateNew().catch(() => undefined);
      await ops.cleanupNew().catch(() => undefined);
    }
    return {
      committed: false,
      cleanupDebt: false,
      refreshFailed: false,
      error: error instanceof Error ? error.message : "Replacement failed.",
    };
  }
}
