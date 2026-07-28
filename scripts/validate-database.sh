#!/usr/bin/env bash
set -euo pipefail

if command -v supabase >/dev/null 2>&1; then
  supabase db reset --local
  supabase db reset --local
  supabase db lint --local
  exit 0
fi

if command -v psql >/dev/null 2>&1; then
  if [[ -z "${DATABASE_URL:-}" ]]; then
    echo 'DATABASE_URL is required when Supabase CLI is unavailable.' >&2
    exit 2
  fi
  psql "$DATABASE_URL" --set ON_ERROR_STOP=1 --single-transaction -f supabase/tests/phase-1-schema-assertions.sql
  exit 0
fi

echo 'Database runtime validation blocked: install/use the project-local Supabase CLI or provide psql and DATABASE_URL.' >&2
exit 2
