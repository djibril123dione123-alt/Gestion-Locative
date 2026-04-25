# Samay Këur

## Récents ajouts (avril 2026)
- **Chantier 2** : `usePlanLimits` + `PlanGate` ; garde plan dans Immeubles/Unites.
- **Chantier 3** : page Équipe (membres, invitations) + `AcceptInvitation` (token URL).
- **Chantier 4** : `NotificationBell` (realtime Supabase) + page Notifications.
- **Chantier 5** : page Abonnement (plan, usage, historique, contact upgrade) + TrialBanner navigable.
- **Chantier 6** : pages Inventaires (états des lieux + PDF), Interventions (kanban), Calendrier (mensuel), Documents (storage `documents`).
- **Chantier 7** : Console super_admin enrichie (Configuration, Support broadcast). Migration `20260425000002_add_console_owner_features.sql` ajoute `agencies.tags`, `saas_config`, `feature_flags`.
- **Pass déploiement (avril 2026)** :
  - `ConfirmModal` accepte les alias `confirmLabel`/`cancelLabel`/`isDestructive`.
  - `AuthContext.signUp` : sleep arbitraire 1.5s remplacé par retry pattern (5 tentatives × 600ms).
  - `errorMessages.ts` typé strictement (`unknown` + narrowing).
  - `lib/templates/helpers.ts` : interface `AgencySettings` dupliquée supprimée, alias `Partial<AgencySettings>` depuis `types/agency.ts`.
  - `LoyersImpayes` : extraction d'UUID via regex (au lieu de `slice(0, 36)`).
  - `Calendrier` : protection contre les réponses obsolètes via `requestIdRef` (évite les états "zombies" lors d'une navigation rapide).
  - `TableauDeBordFinancierGlobal` + `Commissions` : passage à `import autoTable from 'jspdf-autotable'` + `autoTable(doc, ...)` ; suppression de l'import `Dollar` doublon.
  - `pdf.ts` : cache TTL 5 min des `agency_settings` par `agency_id` (+ helper `invalidateAgencySettingsCache`).
  - `SetupWizard` : champ `type_logement` retiré du formulaire (la colonne n'existe pas dans `unites`, déjà filtré côté insert).
  - `FiltresAvances` : élimination du N+1 sur les paiements via `.in(contrat_id, [...])` + map du dernier statut.
  - `Agences` : trace `owner_actions_log` après suppression d'une agence.
  - Bannière `MaintenanceBanner` (lecture `saas_config.maintenance_mode`) câblée dans `App.tsx`.
  - Hook `useFeatureFlag(flag)` (lecture `feature_flags` avec fallback global).
  - `vite.config.ts` enrichi (preview server, build chunkSizeWarningLimit, sourcemap off).
  - `.env.example` créé, `README.md` réécrit complet.

## Migrations en attente
- `supabase/migrations/20260425000002_add_console_owner_features.sql` – Gestion Locative
- `supabase/migrations/20260425000006_cleanup_agencies_insert_policies.sql` – nettoie ~7 policies INSERT historiques cumulées sur `agencies` et en crée deux propres (auth + super_admin).

## Overview
A real estate property management SaaS application (Gestion Locative) built with React, TypeScript, Vite and Tailwind CSS. It provides multi-tenant agency management with roles (admin, agent, comptable, bailleur), covering bailleurs, immeubles, unités, locataires, contrats, paiements, dépenses, and reporting.

## Architecture
- **Frontend**: React 18 + TypeScript + Vite (port 5000)
- **Auth & Database**: Supabase (hosted) — handles auth, Row Level Security, multi-tenant data isolation
- **Styling**: Tailwind CSS with custom color palette
- **Charts**: Recharts
- **PDF generation**: jspdf + jspdf-autotable
- **Excel export**: xlsx

## Running the App
```bash
npm run dev
```
The app runs on port 5000 in development.

## Required Environment Variables (Secrets)
- `VITE_SUPABASE_URL` — Supabase project URL
- `VITE_SUPABASE_ANON_KEY` — Supabase anonymous/public key

Both are set via the Replit Secrets store (Tools → Secrets), not committed to code or `.env` files.

## Replit setup notes
- Vite dev server runs on `0.0.0.0:5000` with `allowedHosts: 'all'` so the Replit preview iframe proxy can reach it.
- Workflow `Start application` runs `npm run dev` and waits for port 5000.
- Backend is Supabase (auth, Postgres + RLS, storage bucket `documents`, realtime). The Replit Postgres database created by the environment is currently unused — the app talks directly to Supabase.

## Key Pages
- `Dashboard` — Stats overview with charts
- `Bailleurs` — Property owner management
- `Immeubles` — Building management
- `Unites` — Unit/apartment management
- `Locataires` — Tenant management
- `Contrats` — Lease contract management
- `Paiements` — Payment recording
- `Depenses` — Expense tracking
- `Parametres` — Agency settings
- `Welcome` — Onboarding flow for new agencies

## Code Architecture

### Shared Utilities
- `src/lib/formatters.ts` — Centralized `formatCurrency`, `formatDate`, `formatMonth`. Import from here, never redefine locally.
- `src/lib/pdf.ts` — PDF generators for contrats, paiements, mandats. All generators are now strongly typed using `ContratPDFData`, `PaiementPDFData`, `MandatPDFData` from `src/types/pdf.ts`.
- `src/lib/supabase.ts` — Supabase client singleton.
- `src/lib/agencyHelper.ts` — Auth helpers (`getCurrentAgencyId`, `reloadUserProfile`).
- `src/lib/errorMessages.ts` — Supabase error translation utilities.

### Types
- `src/types/entities.ts` — Core domain entities (Bailleur, Immeuble, Unite, Locataire, Contrat, Paiement, Depense, Commission, Revenu).
- `src/types/database.ts` — Auth/platform types (UserProfile, Agency, AuditLog).
- `src/types/agency.ts` — AgencySettings + DEFAULT_AGENCY_SETTINGS constant.
- `src/types/pdf.ts` — Typed PDF data shapes for generators.
- `src/types/forms.ts` — Form input types derived from entities.
- `src/types/jspdf-autotable.d.ts` — Global ambient augmentation for jsPDF. Provides `doc.autoTable()` and `doc.lastAutoTable.finalY` types. Do NOT redeclare per-file.
- `src/types/index.ts` — Re-exports all types.

## Database Schema
All migrations are in `supabase/migrations/`. The schema includes:
- `user_profiles`, `agencies`, `agency_settings`
- `bailleurs`, `immeubles`, `unites`, `locataires`, `contrats`, `paiements`
- `revenus`, `depenses`, `bilans_mensuels`
- `invitations`, `notifications`, `documents`, `inventaires`, `interventions`, `evenements`
- `subscription_plans`, `subscriptions`
- `audit_logs`

## Multi-tenant Design
Every data table has an `agency_id` foreign key. Row Level Security policies on Supabase enforce tenant isolation — users can only see data belonging to their own agency.
