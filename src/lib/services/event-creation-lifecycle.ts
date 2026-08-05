export type PostCommitRefreshResult = {
  ok: boolean;
  error?: unknown;
};

export function clearCommittedCleanupCandidates(paths: string[]) {
  paths.splice(0, paths.length);
}

export function runPostCommitRefresh(refresh: () => void): PostCommitRefreshResult {
  try {
    refresh();
    return { ok: true };
  } catch (error) {
    return { ok: false, error };
  }
}
