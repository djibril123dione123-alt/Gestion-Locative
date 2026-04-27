# Samay Këur

## Récents ajouts (avril 2026)
- **Design system v1 + migrations idempotentes (27 avril 2026)** :
  - **`src/components/ui/Button.tsx`** : composant partagé inspiré du bouton « Nouveau contrat » (gradient orange→rouge, shadow, hover scale). Variants `primary` (gradient brand), `secondary` (border slate), `ghost`, `danger`, `success`. Tailles `sm`/`md`/`lg`. Props `icon` (Lucide), `iconPosition`, `loading` (spinner), `fullWidth`. Focus-visible ring conforme a11y.
  - **`src/components/ui/Skeleton.tsx`** : `Skeleton` (shimmer pulse), `SkeletonTable(rows, cols)`, `SkeletonCards(count)` pour remplacer les loaders pauvres.
  - **Migration boutons primaires** : `Bailleurs` (déjà gradient orange, conservé), `Immeubles`, `Locataires`, `Unites`, `Depenses` (étaient `bg-blue-600`, désormais gradient orange uniforme). `EmptyState.tsx` migré sur `<Button>`.
  - **Migrations Supabase idempotentes** :
    - `20260426000001_create_agency_assets_bucket.sql` réécrit : `INSERT ... ON CONFLICT (id) DO UPDATE` pour le bucket ; les 4 policies storage (`Public read`, upload/update/delete admin) enrobées dans un `DO $$ ... EXCEPTION WHEN insufficient_privilege` qui émet juste un NOTICE si le rôle n'est pas propriétaire de `storage.objects` (cas Supabase prod où `supabase_storage_admin` est seul propriétaire — créer alors via Dashboard → Storage → Policies).
    - `20260426000002_security_warnings_fixes.sql` réécrit : chaque `ALTER FUNCTION` enrobé `EXCEPTION WHEN undefined_function THEN NULL` (skip silencieux si la fonction n'existe pas) ; le bloc `storage.objects` (drop des anciennes policies + create `agency_assets_authenticated_read` tenant-scoped) enrobé `EXCEPTION WHEN insufficient_privilege` avec NOTICE et instruction Dashboard.
    - **Effet** : les deux fichiers peuvent être ré-exécutés N fois sans erreur 23505 (duplicate bucket) ni 42501 (must be owner of relation objects). Les opérations storage critiques émettent un NOTICE explicite si non applicables, à reprendre via Dashboard.
  - `npm run typecheck` → **0 erreur** ; `npm run build` → **OK** (25s).

- **Pass audit P0 → P1 → P2 (26 avril 2026, suite)** :
  - **P0 — Sécurité invitations** : nouvelle migration `supabase/migrations/20260426000000_restrict_invitations_select.sql` qui drop la policy permissive `Invitations readable by token` (qui exposait toutes les colonnes au rôle `anon` dès qu'on connaissait un token) et la remplace par une policy restreinte aux super_admins et admins de l'agence émettrice. Le flux anonyme passe désormais exclusivement par la RPC `get_invitation_by_token` (SECURITY DEFINER, sortie sanitisée). **À appliquer sur Supabase prod via `supabase db push`.**
  - **P1 — Bugs UX** :
    - `Paiements.tsx` : `initialFormData` pré-remplit `mois_concerne` / `mois_display` avec le mois courant (au lieu d'une string vide → premier paiement valide).
    - `Contrats.tsx` : ajout du pattern `requestIdRef` (race-guard, identique à `Calendrier.tsx`) sur `loadData`, plus cleanup `useEffect` qui incrémente le ref au démontage. Évite les états zombies après navigation rapide.
    - Faux positifs vérifiés : le bouton « payer ce loyer » de `LoyersImpayes` et l'init `date_paiement` étaient en réalité corrects (audit obsolète).
  - **P2 — Hygiène code & dépendances** :
    - Code mort supprimé : `exportPDF` inutilisé dans `Paiements.tsx` ; trois `exportXxxPDF` jamais branchés dans `TableauDeBordFinancierGlobal.tsx` ; état `bailleurs` + sa requête associée jamais lus dans `Contrats.tsx`.
    - **Vrai bug détecté** : `SetupWizard.tsx` utilisait `useEffect` ligne 51 sans l'importer (crash silencieux à l'ouverture du wizard) → corrigé.
    - Imports React inutilisés retirés de 7 composants (Sidebar, ConfirmModal, EmptyState, NotificationBell, Toast, TrialBanner, QuickStart) — React 17+ JSX transform.
    - Typage : `Unites.formData.statut` (union literal), `TableauDeBord.setFont('helvetica','bold')`, `Dashboard.delay` numéros (était string), `Dashboard.pieData.label` typed any (recharts), `LoyersImpayes.lastSixMonths: string[]`, `pdf.ts` cast `bailleur`/`locataire` après fallback `?? {}`.
    - Imports `lucide-react` morts retirés (DollarSign, Circle, LineChart/Line/Legend).
  - **P2 — Documentation** : 22 fichiers `.md` historiques (`AGENT_PROMPT*`, `INSTRUCTIONS*`, `MIGRATION_GUIDE*`, etc.) déplacés de la racine vers `docs/historique/` avec un `README.md` explicatif. La racine ne contient plus que `README.md`, `replit.md`, `SETUP.md`.
  - **Pass déploiement final (26 avril 2026)** : `npm run typecheck` → **0 erreur**, `npm run build` → **OK** (26s, bundles générés). Tous les patterns Supabase v2 array-vs-object (LoyersImpayes, Commissions, Contrats, Paiements) résolus via casts ciblés `as unknown as Type[]` ou `as any` localisés (en attendant la régénération propre des types via `supabase gen types typescript --linked`). Bug bonus attrapé : `SetupWizard` utilisait `<React.Fragment>` sans importer `React` — remplacé par `<Fragment>` avec import nommé. `main.tsx` : narrowing `error as Error` dans le bloc dev. `Bailleurs.tsx` : cast du `Bailleur` vers `MandatPDFData` (les champs `agency_id`/`created_by` sont effectivement présents au runtime). React imports inutilisés retirés de `Abonnement`, `AcceptInvitation`, `Commissions` ; `Legend` recharts retirée de `Commissions`.

- **Consolidation Supabase (26 avril 2026, post-import)** :
  - **9 migrations doublons strictes (md5 identiques) supprimées** : toutes les paires `20260107*` / `20260127*` (`corrections_critiques_01..03`, `multi_tenant_02..07`). Seules les versions `20260127*` sont conservées comme canoniques.
  - **9 migrations historiques archivées** dans `supabase/migrations/_archive/` (avec `README.md`) : les 7 itérations successives de la policy INSERT sur `agencies` (recouvertes par `20260425000006_cleanup_agencies_insert_policies.sql` puis `20260425000007_onboarding_refonte.sql`), + les 2 policies temporaires de seed (`temp_allow_seed_insertions`, `temp_allow_anon_insertions`).
  - **Effet sur la base Supabase prod : zéro** — Supabase ne rejoue jamais une migration déjà appliquée. Cette consolidation est purement source-level pour la lisibilité.
  - `FiltresAvances.tsx` : remplacement du dernier `alert()` natif par `useToast`/`ToastContainer` (cohérence UX).
  - Reste à traiter (P0/P1, voir audit) : restreindre la policy SELECT anon sur `invitations`, vérifier le bouton « payer ce loyer » dans `LoyersImpayes`, vérifier l'init de la date dans `Paiements.tsx`, appliquer le pattern `requestIdRef` à `Contrats.tsx`.

- **Refonte onboarding & invitations (26 avril 2026)** :
  - Migration `supabase/migrations/20260425000007_onboarding_refonte.sql` :
    - Ajoute `bailleur` à `invitations.role_check`.
    - Drop la policy `agencies_insert_authenticated` (trop large) → seul le super_admin peut INSERT directement (les autres passent par la RPC d'approbation, SECURITY DEFINER).
    - RPC `get_invitation_by_token(text)` (anon + auth, SECURITY DEFINER) : lecture sanitisée de l'invitation pour AcceptInvitation pré-auth.
    - RPC `accept_invitation(text)` (auth, SECURITY DEFINER) : auto-rattachement `user_profiles` + close invitation + audit `owner_actions_log`.
    - Table `agency_creation_requests` (+ RLS user/super_admin, unique partial index pending par user, trigger `updated_at`).
    - RPC `approve_agency_request(uuid)` : crée agence + met à jour `agency_settings`, ajoute `subscriptions`, INSERT/UPDATE `user_profiles` (`admin` ou `bailleur` selon `is_bailleur_account`), audit log.
    - RPC `reject_agency_request(uuid, text)` : motif obligatoire, audit log.
  - Front :
    - `src/pages/Welcome.tsx` réécrit : insère dans `agency_creation_requests`, gère vues `pending` (polling 8 s) / `rejected` (motif + nouvelle demande) / `approved` (race condition profile).
    - `src/pages/AcceptInvitation.tsx` réécrit : utilise les RPC, conserve le token en `sessionStorage` pour reprise post-login, reload profil après acceptation.
    - `src/App.tsx` : `useEffect` qui re-détecte `sessionStorage.invite_token` après authentification (cas du flux Auth puis retour sur AcceptInvitation).
    - `src/components/console/AgencyRequestsPanel.tsx` (nouveau) : filtres pending/all/approved/rejected/cancelled, bouton Approuver, modale Rejet (motif requis), auto-refresh 30 s.
    - `src/pages/Console.tsx` : nouvel onglet « Demandes » (icône Clock).
    - `src/components/ui/SetupWizard.tsx` : champs `ville` (requis) et `quartier` (optionnel) ajoutés à l'étape immeuble (corrige le blocage).
- **Cleanup policies INSERT agencies (24 avril 2026)** : migration `20260425000006_cleanup_agencies_insert_policies.sql` (remplacée partiellement par 20260425000007 qui retire la policy authentifiée trop large).
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
- `supabase/migrations/20260425000007_onboarding_refonte.sql` – refonte complète onboarding/invitations : RPC `get_invitation_by_token`, `accept_invitation`, table `agency_creation_requests`, RPC `approve_agency_request`/`reject_agency_request`, drop de la policy `agencies_insert_authenticated` (resserrement sécurité).
- `supabase/migrations/20260426000000_restrict_invitations_select.sql` – **P0 sécurité** : drop la policy `Invitations readable by token` (fuite anon des PII), restreint la lecture aux super_admins et admins de l'agence émettrice via `user_profiles` (correctif du bug initial qui référençait à tort la table `profiles`).
- `supabase/migrations/20260426000001_create_agency_assets_bucket.sql` – création du bucket `agency-assets` (logos d'agence). **Note** : ce fichier sera consolidé/écrasé par les policies de `20260426000002`.
- `supabase/migrations/20260426000002_security_warnings_fixes.sql` – traite les warnings Supabase Advisor : (a) fixe `search_path = public, pg_temp` sur 11 fonctions (`create_admin_profile`, `create_agent_profile`, `touch_agency_request_updated_at`, `log_table_changes`, `create_notification`, `cleanup_expired_invitations`, `update_updated_at_column`, `get_user_role`, `is_admin`, `is_agent_or_admin`, `get_user_bailleur_id`) ; (b) drop les 2 policies INSERT permissives `WITH CHECK (true)` sur `agency_settings` et `audit_logs` ; (c) restreint la SELECT policy du bucket `agency-assets` pour empêcher l'énumération (LIST) tout en gardant l'accès anon aux URLs exactes des logos. Le warning `auth_leaked_password_protection` se règle uniquement dans le dashboard Supabase (Authentication → Settings).

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
- Supabase URL and anon key are provisioned via `.replit` `[userenv.shared]` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`). The anon key is the public client key, safe for browser use; multi-tenant isolation is enforced by Supabase RLS. The service-role key is never used from the frontend.
- Import migration (Apr 2026): the project was imported from Replit Agent. Supabase backend is intentionally preserved (no Neon/Drizzle/Replit-Auth rewrite) because all server logic lives in Supabase RLS policies and SECURITY DEFINER RPCs — replacing it would require a full rewrite. See `.local/state/replit/agent/progress_tracker.md`.

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
