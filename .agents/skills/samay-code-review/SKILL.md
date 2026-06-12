---

name: samay-code-review
description: Reviews Samay Këur code changes for bugs, regressions, project conventions, Ledger safety, RLS safety, TypeScript strictness, and build readiness. Use when reviewing any code diff, PR, or generated implementation.
----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

# Samay Këur Code Review Skill

When reviewing code changes in Samay Këur, always check:

## 1. Project principles

* Ledger must remain the only financial source of truth.
* RLS must never be disabled or bypassed.
* Multi-tenant isolation must be preserved.
* No business rule duplication.
* No hidden fallback on money calculations.
* No feature bloat.

## 2. TypeScript and structure

* No `any` in financial modules.
* Avoid `unknown` index signatures unless justified.
* Pages should remain thin when possible.
* Extract large UI blocks into components.
* Keep domain services pure.
* Supabase access belongs in repositories, API services, Edge Functions, or controlled service layers.

## 3. Financial safety

For payment, commission, reliquat, quittance, ledger, or report changes:

* verify idempotence;
* verify partial payments;
* verify reliquats;
* verify cancellation behavior;
* verify that calculations do not happen only in UI.

## 4. UX safety

* Drawer-first behavior must remain intact.
* Mobile-first behavior must remain intact.
* No horizontal overflow.
* No hidden critical actions.
* No page-level regression.

## 5. Required final checks

Before marking work complete:

* `npm run typecheck`
* `npm run lint`
* `npm run build`

## Review output format

Return:

1. Verdict
2. Critical issues
3. Major issues
4. Minor issues
5. Files requiring attention
6. Required tests
7. Safe-to-merge decision
