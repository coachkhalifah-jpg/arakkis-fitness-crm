#!/usr/bin/env bash
set -euo pipefail

run_schema_assertions() {
  local db_container
  db_container="$(docker ps --filter "name=supabase_db_" --format '{{.Names}}' | head -n 1)"
  if [[ -z "$db_container" ]]; then
    echo 'Local Supabase database container is not running.' >&2
    exit 2
  fi
  docker exec -i "$db_container" psql \
    --set ON_ERROR_STOP=1 \
    --username postgres \
    --dbname postgres \
    --file - < supabase/tests/phase-1-schema-assertions.sql
}

run_runtime_tests() {
  local db_container
  db_container="$(docker ps --filter "name=supabase_db_" --format '{{.Names}}' | head -n 1)"
  if [[ -z "$db_container" ]]; then
    echo 'Local Supabase database container is not running.' >&2
    exit 2
  fi
  docker exec -i "$db_container" psql \
    --set ON_ERROR_STOP=1 \
    --username postgres \
    --dbname postgres \
    --file - < supabase/tests/phase-1-runtime.sql
}

run_phase_2_tests() {
  local db_container
  db_container="$(docker ps --filter "name=supabase_db_" --format '{{.Names}}' | head -n 1)"
  if [[ -z "$db_container" ]]; then
    echo 'Local Supabase database container is not running.' >&2
    exit 2
  fi
  docker exec -i "$db_container" psql \
    --set ON_ERROR_STOP=1 \
    --username postgres \
    --dbname postgres \
    --file - < supabase/tests/phase-2-auth.sql
}

run_phase_6_tests() {
  local db_container
  db_container="$(docker ps --filter "name=supabase_db_" --format '{{.Names}}' | head -n 1)"
  if [[ -z "$db_container" ]]; then
    echo 'Local Supabase database container is not running.' >&2
    exit 2
  fi
  docker exec -i "$db_container" psql --set ON_ERROR_STOP=1 --username postgres --dbname postgres --file - < supabase/tests/phase-6-schema-assertions.sql
  docker exec -i "$db_container" psql --set ON_ERROR_STOP=1 --username postgres --dbname postgres --file - < supabase/tests/phase-6-runtime.sql
}

if command -v supabase >/dev/null 2>&1; then
  # CLI 2.110.0's db reset wrapper fails before reaching Postgres with a
  # legacy profile error. Stop with --no-backup removes only this local
  # project's data volume; start then recreates the database and reapplies
  # every tracked migration from zero.
  supabase stop --no-backup
  supabase start
  run_schema_assertions
  run_runtime_tests
  supabase stop --no-backup
  supabase start
  run_schema_assertions
  supabase db lint --local
  if command -v jq >/dev/null 2>&1; then
    lint_json="$(supabase db lint --local --output-format json)"
    if jq -e 'any(.results[]?; ((.issues // []) | length) > 0)' >/dev/null <<<"$lint_json"; then
      echo 'Supabase schema lint reported errors.' >&2
      exit 1
    fi
  fi
  run_phase_2_tests
  run_phase_6_tests
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
