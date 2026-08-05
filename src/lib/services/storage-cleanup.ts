export type StorageCleanupError = {
  message?: string;
  statusCode?: string | number;
};

export type StorageCleanupResult = {
  ok: boolean;
  attempts: number;
  unresolvedPaths: string[];
  lastError?: StorageCleanupError;
};

export function isAlreadyAbsentStorageError(error: StorageCleanupError | null | undefined) {
  if (!error) return false;
  return (
    String(error.statusCode) === "404" ||
    /not found|does not exist|no such object|already removed/i.test(error.message ?? "")
  );
}

export async function cleanupStoragePaths(
  paths: string[],
  remove: (paths: string[]) => Promise<{ error: StorageCleanupError | null }>,
  maxAttempts = 2,
): Promise<StorageCleanupResult> {
  const unresolvedPaths = [...new Set(paths)];
  if (!unresolvedPaths.length) return { ok: true, attempts: 0, unresolvedPaths: [] };

  let lastError: StorageCleanupError | undefined;
  for (let attempt = 1; attempt <= Math.max(1, maxAttempts); attempt += 1) {
    let error: StorageCleanupError | null;
    try {
      ({ error } = await remove(unresolvedPaths));
    } catch (caught) {
      error = { message: caught instanceof Error ? caught.message : String(caught) };
    }
    if (!error || isAlreadyAbsentStorageError(error)) {
      return { ok: true, attempts: attempt, unresolvedPaths: [] };
    }
    lastError = error;
  }

  return {
    ok: false,
    attempts: Math.max(1, maxAttempts),
    unresolvedPaths,
    lastError,
  };
}
