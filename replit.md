# Samay Këur — Plateforme de Gestion Locative

## Run & Operate

- **Run command**: `npm run dev` → serves on port 5000
- **Build**: `npm run build` → outputs to `dist/`
- **Typecheck**: `npm run typecheck`
- **Test**: `npm run test:unit`
- **Required Env Vars**: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (Replit Secret)
- **Optional Env Vars**: `VITE_POSTHOG_KEY`, `VITE_POSTHOG_HOST`, `VITE_SENTRY_DSN`
- **Edge Functions Deployment**: `supabase functions deploy [function-name]` (e.g., `create-paiement`, `initiate-payment`)

## Stack

- **Frontend**: React 18 (TypeScript), Vite, Tailwind CSS, React Router v6 (HashRouter)
- **Backend**: Supabase (PostgreSQL, Auth, Storage, Edge Functions, RLS)
- **ORM**: Supabase client (`@supabase/supabase-js`)
- **Validation**: Zod
- **Build Tool**: Vite
- **Charting**: Recharts
- **PDF Generation**: jspdf, jspdf-autotable
- **Excel Export**: SheetJS (xlsx)
- **Testing**: Vitest

## Where things live

- **DB Schema**: `supabase/migrations/` (all `.sql` files, ordered by timestamp)
- **API Contracts (Edge Functions)**: `supabase/functions/*/index.ts` (Zod schemas within)
- **Domain Services**: `src/services/domain/` (e.g., `commissionService.ts`, `paiementService.ts`)
- **Repositories**: `src/repositories/` (DB interaction layer)
- **UI Components**: `src/components/ui/` (Design System)
- **Core Types**: `src/types/entities.ts`, `src/types/database.ts`, `src/types/pdf.ts`, `src/types/forms.ts`
- **PDF Templates**: `src/lib/pdf.ts`
- **Offline Logic**: `src/services/db.ts`, `src/services/offlineQueue.ts`, `src/services/localBackup.ts`
- **Analytics Wrapper**: `src/lib/analytics.ts`
- **Global CSS**: `src/index.css`
- **Routing**: `src/App.tsx` (centralized routes)

## Architecture decisions

- **Multi-tenant SaaS**: All data is scoped by `agency_id`, enforced by Supabase RLS.
- **Backend-for-Frontend (BFF) with Edge Functions**: All critical financial mutations (create/update/cancel paiement/contrat) go through Supabase Edge Functions for server-side validation, commission calculation, and ledger entries, ensuring data integrity and security.
- **Event-Driven Architecture**: Critical business events (e.g., `paiement.created`, `contrat.updated`) are emitted to `event_outbox`, triggering asynchronous jobs in `job_queue` via PostgreSQL triggers and pg_cron workers. This enables self-healing, rule-based processing, and KPI aggregation.
- **Offline-First with IndexedDB**: The application supports offline usage by storing data snapshots and pending mutations in IndexedDB. Mutations are replayed against Supabase when connectivity is restored, with retry mechanisms.
- **Immutable Financial Ledger**: All financial transactions are recorded in an immutable `ledger_entries` table, ensuring an auditable trail.

## Product

Samay Këur is a property management platform for agencies, offering:
- **Financial Management**: Tracking payments, overdue rents, expenses, commissions, and comprehensive financial reports.
- **Tenant & Contract Management**: Managing tenants, lease contracts, properties (buildings, units), and property owners.
- **Automated Workflows**: Automated email/SMS notifications for payment reminders, renewals, and account status changes.
- **Self-Service Onboarding & Billing**: Streamlined agency creation, invitation system, and self-service subscription management with integrated payment (PayDunya simulation).
- **Offline Capability**: Core functionalities remain accessible and data is synchronized when online.
- **Real-time Monitoring**: Audit Dashboard for super_admins to monitor system health, job queues, financial integrity, and anomalies.
- **Mobile-first Design**: Responsive UI with a dedicated bottom navigation for mobile users, mobile-optimized tables, and calendars.

## User preferences

_Populate as you build_

## Gotchas

- **RLS Enforcement**: Always verify RLS policies for new tables or functions to ensure proper multi-tenancy and prevent data leaks.
- **Edge Function Security**: Edge Functions called from the client must validate JWTs and never trust `agency_id` from the client. Inject `agency_id` server-side.
- **Idempotent Migrations**: SQL migrations should be written to be idempotent to prevent errors during re-runs.
- **Financial Fallbacks**: Avoid silent fallbacks (e.g., `?? 10`) for financial values; ensure explicit validation or calculated defaults.
- **`any` Caching**: If `agency_settings` are cached (e.g., for PDF generation), ensure there's a mechanism to invalidate the cache.

## Pointers

- **Supabase Docs**: [https://supabase.com/docs](https://supabase.com/docs)
- **React Router Docs**: [https://reactrouter.com/en/main](https://reactrouter.com/en/main)
- **Tailwind CSS Docs**: [https://tailwindcss.com/docs](https://tailwindcss.com/docs)
- **Vitest Docs**: [https://vitest.dev/guide/](https://vitest.dev/guide/)
- **Zod Docs**: [https://zod.dev/](https://zod.dev/)
- **Recharts Docs**: [https://recharts.org/en-US/api](https://recharts.org/en-US/api)
- **`jspdf` & `jspdf-autotable` Docs**: Search npm documentation for usage.
- **`xlsx` Docs**: [https://docs.sheetjs.com/](https://docs.sheetjs.com/)