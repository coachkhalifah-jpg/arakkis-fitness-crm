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

run_legal_package_tests() {
  local db_container
  db_container="$(docker ps --filter "name=supabase_db_" --format '{{.Names}}' | head -n 1)"
  if [[ -z "$db_container" ]]; then
    echo 'Local Supabase database container is not running.' >&2
    exit 2
  fi
  docker exec -i "$db_container" psql --set ON_ERROR_STOP=1 --username postgres --dbname postgres --file - < supabase/tests/phase-8-consolidated-legal.sql
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

run_phase_7_tests() {
  local db_container
  db_container="$(docker ps --filter "name=supabase_db_" --format '{{.Names}}' | head -n 1)"
  if [[ -z "$db_container" ]]; then
    echo 'Local Supabase database container is not running.' >&2
    exit 2
  fi
  docker exec -i "$db_container" psql --set ON_ERROR_STOP=1 --username postgres --dbname postgres --file - < supabase/tests/phase-7-runtime.sql
}

run_phase_15_admin_lifecycle_tests() {
  local db_container
  db_container="$(docker ps --filter "name=supabase_db_" --format '{{.Names}}' | head -n 1)"
  if [[ -z "$db_container" ]]; then
    echo 'Local Supabase database container is not running.' >&2
    exit 2
  fi
  docker exec -i "$db_container" psql --set ON_ERROR_STOP=1 --username postgres --dbname postgres --file - < supabase/tests/phase-15-admin-lifecycle.sql
}

run_phase_15_participant_contact_tests() {
  local db_container
  db_container="$(docker ps --filter "name=supabase_db_" --format '{{.Names}}' | head -n 1)"
  if [[ -z "$db_container" ]]; then
    echo 'Local Supabase database container is not running.' >&2
    exit 2
  fi
  docker exec -i "$db_container" psql --set ON_ERROR_STOP=1 --username postgres --dbname postgres --file - < supabase/tests/phase-15-participant-contact.sql
}

run_phase_9_booking_transfer_tests() {
  local db_container
  db_container="$(docker ps --filter "name=supabase_db_" --format '{{.Names}}' | head -n 1)"
  if [[ -z "$db_container" ]]; then
    echo 'Local Supabase database container is not running.' >&2
    exit 2
  fi
  docker exec -i "$db_container" psql --set ON_ERROR_STOP=1 --username postgres --dbname postgres --file - < supabase/tests/phase-9-booking-transfer.sql
}

run_pnpm_script() {
  if command -v pnpm >/dev/null 2>&1; then
    pnpm "$@"
  elif command -v corepack >/dev/null 2>&1; then
    corepack pnpm "$@"
  elif command -v npx >/dev/null 2>&1; then
    # Keep the repository-declared package manager while supporting clean
    # environments where Corepack has not been installed or enabled.
    npx --yes -p pnpm@10.15.1 pnpm "$@"
  else
    echo 'pnpm 10.15.1 is required for the concurrency validation.' >&2
    exit 2
  fi
}

if command -v supabase >/dev/null 2>&1; then
  # CLI 2.110.0's db reset wrapper fails before reaching Postgres with a
  # legacy profile error. Stop with --no-backup removes only this local
  # project's data volume; start then recreates the database and reapplies
  # every tracked migration from zero.
  supabase stop --no-backup >/dev/null
  supabase start >/dev/null
  run_schema_assertions
  run_legal_package_tests
  run_runtime_tests
  supabase stop --no-backup >/dev/null
  supabase start >/dev/null
  run_schema_assertions
  run_legal_package_tests
  # plpgsql_check cannot resolve transaction-local relations created inside a
  # function, so phase3_create_multi_schedule_bundle is runtime-tested above
  # and its relation-not-found diagnostic is an accepted static false positive.
  # Every other lint error remains release-blocking; non-error diagnostics are
  # reported by the CLI and remain documented as non-blocking.
  lint_json="$(supabase db lint --local --fail-on none --output-format json)"
  if command -v jq >/dev/null 2>&1; then
    unexpected_lint="$(jq -c '
      [.results[]? as $result | $result.issues[]? |
        select(
          (.level == "error"
            and (($result.function == "public.phase3_create_multi_schedule_bundle"
              and (.message | test("^relation \\\"(phase3_create_schedule_rules|phase3_create_occurrences)\\\" does not exist$"))) | not))
        )
      ]
    ' <<<"$lint_json")"
    if [[ "$unexpected_lint" != "[]" ]]; then
      echo "$lint_json" >&2
      echo 'Supabase schema lint reported an unexpected issue.' >&2
      exit 1
    fi
  else
    echo 'jq is required to classify Supabase schema lint output.' >&2
    exit 2
  fi
  run_phase_2_tests
  run_phase_6_tests
  run_phase_7_tests
  run_phase_15_admin_lifecycle_tests
  run_phase_15_participant_contact_tests
  run_phase_9_booking_transfer_tests
  run_pnpm_script test:concurrency
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
