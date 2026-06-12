---

name: samay-supabase-security
description: Audits and guides Supabase, PostgreSQL, RLS, Edge Functions, Storage, migrations, multi-tenant isolation, Ledger safety, and security-sensitive changes in Samay Këur. Use for database, auth, storage, edge functions, payments, documents, QR, and migrations.
-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

# Samay Këur Supabase Security Skill

You are working on Samay Këur backend and security.

## Absolute rules

* Never disable RLS.
* Never bypass RLS.
* Never expose service role keys in frontend.
* Never run remote Supabase commands without explicit user approval.
* Never modify production data without a migration and rollback plan.
* Never change Ledger behavior without audit.

## Multi-tenant rules

Every sensitive query must respect:

* organization isolation;
* agency isolation;
* user permissions;
* role-based access;
* RLS policies.

## Financial rules

For payments, ledger, commissions, reliquats, cancellations, quittances, reports:

* use Edge Functions or controlled server logic;
* preserve idempotence;
* preserve auditability;
* avoid direct frontend inserts for financial mutations;
* never silently fallback to zero.

## Storage and document rules

Documents must have:

* private storage;
* registry entry;
* stable reference;
* QR verification;
* signed URL with reasonable lifetime;
* revocation strategy when applicable.

## Migration rules

* Never edit an already deployed migration.
* Create new idempotent migrations.
* Avoid duplicate timestamps.
* Use `IF EXISTS` / `IF NOT EXISTS` when appropriate.
* Explain rollback risk.

## Output format

Always return:

1. Security verdict
2. RLS impact
3. Multi-tenant impact
4. Ledger impact
5. Migration impact
6. Required verification
7. Safe / unsafe decision
