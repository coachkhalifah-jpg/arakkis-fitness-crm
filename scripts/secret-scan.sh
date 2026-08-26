#!/usr/bin/env bash
set -euo pipefail

tracked_files=()
while IFS= read -r -d '' file; do
  [[ -f "$file" ]] && tracked_files+=("$file")
done < <(git ls-files -z)
if ((${#tracked_files[@]} > 0)) && rg -n --hidden --glob '!pnpm-lock.yaml' --glob '!*.md' \
  '(BEGIN (RSA|OPENSSH|EC) PRIVATE KEY|vercel_[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9]{20,})' \
  "${tracked_files[@]}"; then
  echo "Potential secret pattern found in tracked files." >&2
  exit 1
fi
if git ls-files | rg '(^|/)(\.env$|\.env\..*\.local$|.*\.pem$|.*\.key$)' >/dev/null; then
  echo "Secret-bearing filename is tracked." >&2
  exit 1
fi
echo "Tracked-file secret scan passed; no values were printed."
