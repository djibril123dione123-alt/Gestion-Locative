#!/usr/bin/env bash

set -Eeuo pipefail
umask 077

require_command() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "Required command is missing: $1" >&2
    exit 1
  }
}

require_secret() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    echo "Required environment variable is missing: ${name}" >&2
    exit 1
  fi
}

require_secret BACKUP_FILE
require_secret BACKUP_ENCRYPTION_PASSPHRASE
require_secret RESTORE_DATABASE_URL
require_secret RESTORE_ENVIRONMENT
require_command openssl
require_command sha256sum
require_command pg_restore
require_command psql

if [[ "$RESTORE_ENVIRONMENT" != "isolated-test" || "${ALLOW_DESTRUCTIVE_RESTORE_TEST:-}" != "true" ]]; then
  echo "Restore refused. Set RESTORE_ENVIRONMENT=isolated-test and ALLOW_DESTRUCTIVE_RESTORE_TEST=true." >&2
  exit 1
fi

if [[ ! -f "$BACKUP_FILE" || ! -f "${BACKUP_FILE}.sha256" ]]; then
  echo "Encrypted backup or checksum file is missing." >&2
  exit 1
fi

WORK_DIR="$(mktemp -d)"
RAW_DUMP="${WORK_DIR}/restore.dump"
cleanup() {
  rm -rf "$WORK_DIR"
}
trap cleanup EXIT

(
  cd "$(dirname "$BACKUP_FILE")"
  sha256sum --check "$(basename "${BACKUP_FILE}.sha256")"
)

openssl enc -d -aes-256-cbc \
  -pbkdf2 \
  -iter 200000 \
  -in "$BACKUP_FILE" \
  -out "$RAW_DUMP" \
  -pass env:BACKUP_ENCRYPTION_PASSPHRASE

pg_restore --list "$RAW_DUMP" >/dev/null
pg_restore "$RAW_DUMP" \
  --dbname="$RESTORE_DATABASE_URL" \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  --exit-on-error

psql "$RESTORE_DATABASE_URL" --set=ON_ERROR_STOP=1 <<'SQL'
DO $$
BEGIN
  IF to_regclass('auth.users') IS NULL THEN
    RAISE EXCEPTION 'Restore verification failed: auth.users is missing';
  END IF;
  IF to_regclass('public.user_profiles') IS NULL THEN
    RAISE EXCEPTION 'Restore verification failed: public.user_profiles is missing';
  END IF;
  IF to_regclass('public.agencies') IS NULL THEN
    RAISE EXCEPTION 'Restore verification failed: public.agencies is missing';
  END IF;
END
$$;
SQL

echo "Restore drill completed successfully in the isolated test database."
