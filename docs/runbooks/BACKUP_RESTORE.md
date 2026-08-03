# Database backup and restore runbook

## Current guarantee

The scheduled workflow creates a PostgreSQL custom-format dump, validates its
catalog, encrypts it with AES-256-CBC/PBKDF2, and stores a SHA-256 checksum.
The application service-role key is never used as a database password.

This mechanism is **not considered operationally proven** until a complete
restore drill has succeeded against an isolated database and the result has
been recorded by the operator.

## Required secrets

- `SUPABASE_DB_URL`: direct or pooler PostgreSQL connection string dedicated to
  backups, with the minimum privileges required to dump all tenant data.
- `BACKUP_ENCRYPTION_PASSPHRASE`: long random secret stored separately from the
  backup artifact.
- Optional off-site copy: `BACKUP_BUCKET`, `AWS_ACCESS_KEY_ID`,
  `AWS_SECRET_ACCESS_KEY`, and `AWS_REGION`.

## Daily backup

The `Encrypted database backup` workflow runs daily at 02:00 UTC and can be
started manually. A successful run must contain both a `.dump.enc` file and its
`.sha256` companion. A failed run opens a repository issue labelled
`backup-failure`.

## Restore drill

1. Provision a disposable PostgreSQL/Supabase test project. Never use a
   production connection string.
2. Download the encrypted dump and checksum into the same directory.
3. Export the following variables:

   ```bash
   export BACKUP_FILE=/secure/path/samay-keur-YYYYMMDDTHHMMSSZ.dump.enc
   export BACKUP_ENCRYPTION_PASSPHRASE='...'
   export RESTORE_DATABASE_URL='postgresql://...isolated-test...'
   export RESTORE_ENVIRONMENT=isolated-test
   export ALLOW_DESTRUCTIVE_RESTORE_TEST=true
   ```

4. Run `bash scripts/verify-backup-restore.sh`.
5. Verify authentication, tenant counts, financial ledger totals, document
   registry counts, and a sample of private storage metadata before destroying
   the test project.
6. Record the drill date, backup timestamp, duration, operator, row-count
   checks, and any deviation in the launch evidence report.

## Recovery targets

- Target RPO: 24 hours while the workflow runs daily.
- Target RTO: four hours for a small beta tenant set.

These are operational targets, not measured guarantees. They become proven only
after repeated restore drills include storage recovery and application smoke
tests.
