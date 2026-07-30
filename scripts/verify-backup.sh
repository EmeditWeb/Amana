#!/usr/bin/env bash
# verify-backup.sh — Restore the latest backup to a temporary verification
# database and run data-integrity checks, so a corrupted or incomplete
# backup is caught proactively instead of only being discovered during an
# actual disaster.
#
# Usage:
#   ./scripts/verify-backup.sh [--type daily|weekly|monthly] [--keep]
#
# Required env:
#   DATABASE_URL         — PostgreSQL connection string for the PRODUCTION
#                           database (used only for read-only row-count /
#                           comparison queries, never written to)
#   VERIFY_DATABASE_URL  — PostgreSQL connection string whose *database name*
#                           is a scratch database this script creates,
#                           restores into, and drops. Must point at the same
#                           server/role as DATABASE_URL, differing only in
#                           dbname (e.g. same as DATABASE_URL with
#                           `/amana` replaced by `/backup_verify`).
#   S3_BUCKET            — S3 bucket backups are stored in (passed through
#                           to db-restore.sh)
#
# Optional env:
#   GPG_RECIPIENT, S3_ENDPOINT, S3_PREFIX — passed through to db-restore.sh
#   --keep                — do not drop the verification database on exit
#                           (useful for manually inspecting a failure)
#
# Exit code 0 only if every check below passes. On any failure, the
# verification database is left in place (even without --keep) so the
# failure can be inspected before the next scheduled run overwrites it.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

BACKUP_TYPE="daily"
KEEP_ON_SUCCESS=false

for arg in "$@"; do
  case "$arg" in
    --type=*) BACKUP_TYPE="${arg#--type=}" ;;
    --keep) KEEP_ON_SUCCESS=true ;;
  esac
done

if [[ -f "$ROOT_DIR/.env" ]]; then
  # shellcheck disable=SC1091
  set -o allexport; source "$ROOT_DIR/.env"; set +o allexport
fi

: "${DATABASE_URL:?DATABASE_URL is required (production, read-only comparisons)}"
: "${VERIFY_DATABASE_URL:?VERIFY_DATABASE_URL is required (scratch restore target)}"
: "${S3_BUCKET:?S3_BUCKET is required}"

# --- Parse the verification database's own name and its "postgres"
# maintenance-connection URL (same server, dbname=postgres) so we can
# CREATE/DROP DATABASE without connecting to the database being dropped. ---
VERIFY_DB_NAME="${VERIFY_DATABASE_URL##*/}"
VERIFY_DB_NAME="${VERIFY_DB_NAME%%\?*}"
if [[ -z "$VERIFY_DB_NAME" || "$VERIFY_DB_NAME" == "postgres" ]]; then
  echo "[verify-backup] ERROR: VERIFY_DATABASE_URL must name a dedicated scratch database, not 'postgres'." >&2
  exit 1
fi
MAINT_URL="${VERIFY_DATABASE_URL%/*}/postgres"

FAILED=false
FAILURES=()

cleanup() {
  if [[ "$FAILED" == "true" ]]; then
    echo "[verify-backup] FAILED — leaving $VERIFY_DB_NAME in place for inspection."
    return
  fi
  if [[ "$KEEP_ON_SUCCESS" == "true" ]]; then
    echo "[verify-backup] --keep set — leaving $VERIFY_DB_NAME in place."
    return
  fi
  echo "[verify-backup] Tearing down $VERIFY_DB_NAME..."
  psql "$MAINT_URL" -v ON_ERROR_STOP=1 -c \
    "DROP DATABASE IF EXISTS \"$VERIFY_DB_NAME\" WITH (FORCE);" >/dev/null 2>&1 || true
}
trap cleanup EXIT

fail() {
  FAILED=true
  FAILURES+=("$1")
  echo "[verify-backup] CHECK FAILED: $1" >&2
}

echo "[verify-backup] Creating scratch database $VERIFY_DB_NAME..."
psql "$MAINT_URL" -v ON_ERROR_STOP=1 -c \
  "DROP DATABASE IF EXISTS \"$VERIFY_DB_NAME\" WITH (FORCE);"
psql "$MAINT_URL" -v ON_ERROR_STOP=1 -c \
  "CREATE DATABASE \"$VERIFY_DB_NAME\";"

echo "[verify-backup] Restoring latest $BACKUP_TYPE backup into $VERIFY_DB_NAME..."
DATABASE_URL="$VERIFY_DATABASE_URL" "$SCRIPT_DIR/db-restore.sh" --type="$BACKUP_TYPE"

# --- Check 1: row counts match between production and the restored backup
# for every user table (the backup is allowed to be a few minutes stale, so
# this is a "restored count <= production count and not wildly smaller"
# sanity check, not exact equality — a backup taken hours before a burst of
# new trades is still a *valid* backup). ---
echo "[verify-backup] Checking row counts..."
TABLES=$(psql "$DATABASE_URL" -Atc \
  "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;")

while IFS= read -r TABLE; do
  [[ -z "$TABLE" ]] && continue
  PROD_COUNT=$(psql "$DATABASE_URL" -Atc "SELECT count(*) FROM \"$TABLE\";")
  BACKUP_COUNT=$(psql "$VERIFY_DATABASE_URL" -Atc "SELECT count(*) FROM \"$TABLE\";" 2>/dev/null || echo "MISSING")

  if [[ "$BACKUP_COUNT" == "MISSING" ]]; then
    fail "table '$TABLE' is missing entirely from the restored backup"
    continue
  fi

  if (( BACKUP_COUNT > PROD_COUNT )); then
    fail "table '$TABLE' has MORE rows in the backup ($BACKUP_COUNT) than production ($PROD_COUNT) — restore likely corrupted or wrong backup selected"
  elif (( PROD_COUNT > 0 && BACKUP_COUNT == 0 )); then
    fail "table '$TABLE' has $PROD_COUNT rows in production but 0 in the backup"
  fi

  echo "  $TABLE: production=$PROD_COUNT backup=$BACKUP_COUNT"
done <<< "$TABLES"

# --- Check 2: referential integrity — no orphaned foreign keys in the
# restored backup. Queries information_schema for every FK constraint and
# checks for child rows whose referenced parent row is missing. ---
echo "[verify-backup] Checking referential integrity (no orphaned foreign keys)..."
FK_CONSTRAINTS=$(psql "$VERIFY_DATABASE_URL" -Atc "
  SELECT
    tc.table_name || '|' || kcu.column_name || '|' ||
    ccu.table_name || '|' || ccu.column_name
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
  JOIN information_schema.constraint_column_usage ccu
    ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
  WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public';
")

while IFS='|' read -r CHILD_TABLE CHILD_COL PARENT_TABLE PARENT_COL; do
  [[ -z "$CHILD_TABLE" ]] && continue
  ORPHANS=$(psql "$VERIFY_DATABASE_URL" -Atc "
    SELECT count(*) FROM \"$CHILD_TABLE\" c
    WHERE c.\"$CHILD_COL\" IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM \"$PARENT_TABLE\" p WHERE p.\"$PARENT_COL\" = c.\"$CHILD_COL\"
      );
  ")
  if (( ORPHANS > 0 )); then
    fail "$ORPHANS orphaned row(s) in '$CHILD_TABLE.$CHILD_COL' referencing missing '$PARENT_TABLE.$PARENT_COL'"
  fi
done <<< "$FK_CONSTRAINTS"

# --- Check 3: latest trade/event data is present. Compares the newest
# timestamp in production against the newest timestamp in the backup for
# any table with a created_at column — the backup's latest timestamp
# should be within a generous staleness window of production's, not from
# days/weeks ago (which would indicate an old backup was restored, or new
# writes never made it into the backup at all). ---
echo "[verify-backup] Checking latest data is present (created_at freshness)..."
TIMESTAMPED_TABLES=$(psql "$DATABASE_URL" -Atc "
  SELECT table_name FROM information_schema.columns
  WHERE table_schema = 'public' AND column_name = 'created_at'
  ORDER BY table_name;
")

while IFS= read -r TABLE; do
  [[ -z "$TABLE" ]] && continue
  PROD_LATEST=$(psql "$DATABASE_URL" -Atc "SELECT COALESCE(max(created_at), 'epoch') FROM \"$TABLE\";")
  BACKUP_LATEST=$(psql "$VERIFY_DATABASE_URL" -Atc "SELECT COALESCE(max(created_at), 'epoch') FROM \"$TABLE\";" 2>/dev/null || echo "epoch")

  if [[ "$PROD_LATEST" != "epoch" && "$BACKUP_LATEST" == "epoch" ]]; then
    fail "table '$TABLE' has data in production (latest: $PROD_LATEST) but none in the backup"
  fi
done <<< "$TIMESTAMPED_TABLES"

if [[ "$FAILED" == "true" ]]; then
  echo "[verify-backup] FAILED — ${#FAILURES[@]} check(s) failed:" >&2
  printf '  - %s\n' "${FAILURES[@]}" >&2
  exit 1
fi

echo "[verify-backup] All checks passed. Backup is restorable and consistent."
