#!/usr/bin/env bash

set -Eeuo pipefail
umask 077

BACKUP_DIR="${BACKUP_DIR:-.backups}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
RAW_DUMP="${BACKUP_DIR}/samay-keur-${TIMESTAMP}.dump"
ENCRYPTED_DUMP="${RAW_DUMP}.enc"
CHECKSUM_FILE="${ENCRYPTED_DUMP}.sha256"

cleanup() {
  rm -f "$RAW_DUMP"
}
trap cleanup EXIT

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

require_secret SUPABASE_DB_URL
require_secret BACKUP_ENCRYPTION_PASSPHRASE
require_command pg_dump
require_command pg_restore
require_command openssl
require_command sha256sum

if ! [[ "$RETENTION_DAYS" =~ ^[0-9]+$ ]]; then
  echo "RETENTION_DAYS must be a non-negative integer." >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"

echo "Creating a tenant database backup at ${TIMESTAMP}..."
pg_dump "$SUPABASE_DB_URL" \
  --format=custom \
  --no-owner \
  --no-privileges \
  --file="$RAW_DUMP"

# A custom archive that cannot be listed is not a usable backup.
pg_restore --list "$RAW_DUMP" >/dev/null

openssl enc -aes-256-cbc \
  -salt \
  -pbkdf2 \
  -iter 200000 \
  -in "$RAW_DUMP" \
  -out "$ENCRYPTED_DUMP" \
  -pass env:BACKUP_ENCRYPTION_PASSPHRASE

(
  cd "$BACKUP_DIR"
  sha256sum "$(basename "$ENCRYPTED_DUMP")" > "$(basename "$CHECKSUM_FILE")"
)

if [[ ! -s "$ENCRYPTED_DUMP" || ! -s "$CHECKSUM_FILE" ]]; then
  echo "Backup output is empty or incomplete." >&2
  exit 1
fi

find "$BACKUP_DIR" -maxdepth 1 -type f \
  \( -name 'samay-keur-*.dump.enc' -o -name 'samay-keur-*.dump.enc.sha256' \) \
  -mtime "+${RETENTION_DAYS}" -delete

echo "Encrypted backup created: ${ENCRYPTED_DUMP}"
if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
  {
    echo "backup_file=${ENCRYPTED_DUMP}"
    echo "checksum_file=${CHECKSUM_FILE}"
  } >> "$GITHUB_OUTPUT"
fi
