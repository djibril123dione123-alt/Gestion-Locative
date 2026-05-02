# Samay Këur — Plateforme de Gestion Locative

## Replit Environment

- **Stack**: React + Vite SPA (TypeScript), Tailwind CSS, React Router v6
- **Backend**: Supabase (auth, PostgreSQL database, storage, edge functions)
- **Run command**: `npm run dev` → serves on port 5000
- **Build**: `npm run build` → outputs to `dist/`

### Environment Variables (set via Replit Secrets/Env Vars)
- `VITE_SUPABASE_URL` — Supabase project URL (shared env var)
- `VITE_SUPABASE_ANON_KEY` — Supabase anon public key (shared env var)
- `VITE_ENV` — Environment name: `development` | `production`
- `VITE_POSTHOG_KEY` — PostHog analytics key (optional, no-op if missing)
- `VITE_POSTHOG_HOST` — PostHog host (optional, defaults to eu.posthog.com)
- `VITE_SENTRY_DSN` — Sentry DSN for error monitoring (optional, no-op if missing)

### Key Dependencies
- `@supabase/supabase-js` — Supabase client (auth + db queries)
- `react-router-dom` v6 — Client-side routing via HashRouter
- `jspdf` v2 + `jspdf-autotable` v3 — PDF generation
- `recharts` v2 — Charts and analytics
- `posthog-js` — Optional product analytics
- `@sentry/react` — Optional error monitoring

### Architecture Notes
- Multi-tenant SaaS: all data scoped by `agency_id`
- Roles: `super_admin`, `admin`, `agent`, `comptable`, `bailleur`
- Supabase RLS enforces tenant isolation at the DB level
- Offline support via IndexedDB (snapshots + mutation queue)
- Edge Functions on Supabase for business-critical operations

---

## Récents ajouts (mai 2026) — Autopilot Engine v2 : Self-Healing + Rule Engine + Observabilité

### Migration `20260506000002_autopilot_v2_self_healing.sql`

#### Upgrades tables existantes
| Table | Colonnes ajoutées |
|---|---|
| `event_outbox` | `trace_id uuid` (propagé aux jobs), `error_class` (transient / business_rule / system_failure / data_inconsistency) |
| `job_queue` | `trace_id uuid`, `weight_cost int`, `tenant_load_score numeric`, `retry_strategy` (linear / exponential / dead_letter) |
| `kpi_monthly` | `ltv`, `cac`, `ltv_cac_ratio`, `revenue_quality_score`, `recurring_ratio`, `churn_risk`, `payment_consistency` |

#### Nouvelle table `system_health`
- Snapshot d'observabilité : queue_backlog, failed_jobs, orphan_events, stale_jobs, drift_agencies, worker_latency_ms, failure_rate, health_score (0–1)
- Inséré automatiquement par `fn_self_heal()` à chaque exécution
- Auto-cleanup pg_cron : snapshots > 7 jours supprimés à 3h

#### `fn_rule_engine(job_id)` — Orchestration intelligente
- Appelé via trigger AFTER INSERT sur job_queue (appliqué à chaque nouveau job automatiquement)
- Règles : `RECONCILE_FINANCE` → priorité 1 toujours · MRR > 500k FCFA → priorité 2 · RECALCUL_KPI avec backlog > 200 → différé prio 8 (backpressure)
- Calcule `weight_cost` (1–4), `tenant_load_score` (0.3–0.9), `retry_strategy` (linear/exponential/dead_letter)

#### `fn_self_heal()` — Auto-réparation système
1. **Orphan events** : events pending > 10 min sans job → re-enqueue automatique
2. **Stale jobs** : jobs en status `processing` depuis > 30 min (crash) → reset à `pending`
3. **Drift financier** : agences avec `financial_snapshots.status = 'drift'` → enqueue `RECONCILE_FINANCE` priorité 1
4. **Dead letter classification** : jobs failed max_retries → `error_class` auto-classifié (transient/business_rule/system_failure/data_inconsistency)
5. **Health score** : calcul automatique 0–1, snapshot dans `system_health`

#### `fn_compute_revenue_quality(agency_id, period)` — Unit Economics
- `recurring_ratio` = MRR / total encaissé
- `payment_consistency` = 1 − taux impayés
- `churn_risk` = contrats résiliés / (actifs + résiliés) ce mois
- `revenue_quality_score` = recurring × 0.4 + consistency × 0.4 + (1−churn) × 0.2
- `ltv` = MRR × mois de rétention réels (depuis first_payment_at)
- Upsert dans `kpi_monthly`, appelé par pg_cron toutes les heures

#### Trace ID — Observabilité bout-en-bout
- Chaque `event_outbox` génère un `trace_id` UUID
- `fn_enqueue_jobs_from_outbox` propage ce `trace_id` à tous les jobs dérivés
- Visible dans le Control Tower pour suivre event → job → ledger → KPI

#### pg_cron v2 (en plus des jobs v1)
| Job | Schedule | Action |
|---|---|---|
| `self-heal` | `*/30 * * * *` | fn_self_heal() auto-réparation |
| `revenue-quality` | `0 * * * *` | fn_compute_revenue_quality() pour toutes agences actives |
| `cleanup-health` | `0 3 * * *` | DELETE system_health > 7 jours |

### AuditDashboard.tsx — Investor Mode (réécriture complète)
- **Real-time Supabase subscriptions** : channel `autopilot-live` sur event_outbox + job_queue (INSERT + UPDATE) — badge LIVE animé
- **System Health Banner** : health score 0–100%, queue backlog, failed jobs, orphelins, taux d'échec — couleur verte/ambre/rouge selon seuils
- **Métriques Investisseur** : MRR, ARR, LTV, LTV/CAC (> 3× → vert), Revenue Quality Score avec barres recurring/consistency/churn
- **Bouton Self-Heal** : appelle `fn_self_heal()` via supabase.rpc, affiche le résultat (orphelins fixés, stale resets, drifts requeueés)
- **Trace ID** visible dans le flux Event Outbox (8 premiers caractères)
- **Risk summary** intégré dans section Anomalies : taux impayés, churn risk, contrats actifs
- **Pipeline status** : visualisation de la chaîne complète Outbox → Rule Engine → Job Queue → Workers → Self-Heal → Ledger/KPI → Dashboard

## Récents ajouts (mai 2026) — Autopilot Engine Série A

### event_outbox — Source unique de vérité
- `supabase/migrations/20260506000001_autopilot_engine.sql`
- Table `event_outbox` (id, agency_id, event_type, entity_type, entity_id, payload, status, source, retry_count, error, processed_at)
- Statuts : `pending → processing → processed | failed`
- **Triggers** sur `paiements` et `contrats` : chaque INSERT/UPDATE critique écrit dans event_outbox automatiquement
- RLS activé : SELECT par agency_id ou admin, INSERT libre (service role)

### job_queue — Orchestration asynchrone
- Table `job_queue` (id, type, agency_id, payload, status, priority, retry_count, max_retries, next_retry_at, source_event_id, started_at, completed_at, error)
- Statuts : `pending → processing → done | failed`
- Types de jobs : `GENERATE_LEDGER`, `RECONCILE_FINANCE`, `RECALCUL_KPI`, `SYNC_POSTHOG`, `SEND_NOTIFICATION`, `UPDATE_COHORT`
- Retry exponentiel : `5 min × retry_count` entre chaque tentative, max 3 retries
- `fn_enqueue_jobs_from_outbox(limit)` — traduit chaque événement outbox en 1-3 jobs spécialisés

### KPI Tables — Investor-ready metrics
- `kpi_daily` : MRR, paiements (count + total), impayés (count + montant), contrats new/actifs — UNIQUE(agency_id, date)
- `kpi_monthly` : MRR, ARR (GENERATED × 12), impayes_rate, new/cancelled contracts — UNIQUE(agency_id, period)
- `agency_cohort` : signup_week, first_contract_week, first_payment_week, conversion_time_days, retention 30/60/90d, churn_score
- `cache_store` : key, value jsonb, agency_id, ttl_seconds, expires_at (GENERATED), avec auto-cleanup pg_cron

### SQL Workers — Exécution inline pg_cron
- `fn_worker_finance(batch)` — traite GENERATE_LEDGER + RECONCILE_FINANCE, retry automatique
- `fn_worker_analytics(batch)` — traite RECALCUL_KPI + UPDATE_COHORT, DISTINCT ON pour déduplication
- `fn_aggregate_kpi_daily(agency_id, date)` — upsert kpi_daily depuis paiements + contrats
- `fn_aggregate_kpi_monthly(agency_id, period)` — upsert kpi_monthly avec calcul taux impayés

### Autopilot Loop — pg_cron (activer pg_cron dans Supabase Dashboard)
| Job cron | Schedule | Action |
|---|---|---|
| `enqueue-jobs-from-outbox` | `*/5 * * * *` | Outbox → jobs |
| `finance-worker` | `*/10 * * * *` | GENERATE_LEDGER + RECONCILE_FINANCE |
| `analytics-worker` | `*/15 * * * *` | RECALCUL_KPI + UPDATE_COHORT |
| `cleanup-cache` | `0 * * * *` | DELETE cache_store expiré |

### Edge Function Workers — Invocation manuelle (Audit Dashboard)
- `supabase/functions/finance-worker/index.ts` — POST endpoint, requiert rôle admin/super_admin
- `supabase/functions/analytics-worker/index.ts` — flush outbox + RECALCUL_KPI, POST endpoint

### vw_system_anomalies — Vue anomalies
- `paiement_sans_contrat` — paiements non annulés sans contrat référencé
- `unite_loue_sans_contrat_actif` — unités en statut 'loué' sans contrat actif
- `pilot_inactif` — agences trial depuis >30j sans aucun paiement

### AuditDashboard.tsx — Control Tower
- Route : `/audit` (lazy, réservé admin/super_admin)
- 4 sections : Event Outbox live, Job Queue stats, Finance Integrity, Anomalies système
- Boutons "Finance Worker" + "Analytics Worker" → invoke Edge Functions en direct
- KPI du jour : MRR, encaissé, impayés, contrats actifs, jobs en file
- Alertes rapides : outbox en attente, jobs en échec, écarts comptables

### eventBus.ts — Triple-write pattern
1. `event_outbox` (source primaire, fire-and-forget)
2. `event_log` (audit trail, fire-and-forget)
3. PostHog analytics

## Récents ajouts (mai 2026) — Revenue-Grade Architecture : Réconciliation + Event Bus + State Machine

### financial_snapshots — Couche de réconciliation investisseur
- `supabase/migrations/20260505000001_financial_snapshots_reconciliation.sql`
- Table `financial_snapshots` : `total_paiements`, `total_ledger_credits`, `diff` (GENERATED ALWAYS), `status` (ok/drift/error)
- UNIQUE(agency_id, period) — une snapshot par agence par mois
- `fn_compute_financial_snapshots(period)` — compare SUM(paiements) vs SUM(ledger credits), insère/met à jour
- Vue `vw_financial_drift_report` — toutes les agences avec écart non nul
- pg_cron : `financial-reconciliation` (0 2 2 * * — 2h le 2 de chaque mois)

### eventBus.ts — Émetteur d'événements universel
- `src/lib/eventBus.ts` — UNE seule fonction `emitEvent({type, agency_id, entity_type, entity_id, payload})`
  - Persiste en SQL (`event_log`) fire-and-forget si `agency_id` présent
  - Envoie à PostHog via `trackEvent()`
  - `emitPaiementEvent()` et `emitContratEvent()` — helpers typés
- Remplacement de `trackEvent()` par `emitEvent()` dans : `Paiements.tsx`, `Contrats.tsx`, `LoyersImpayes.tsx`
- Nomenclature normalisée : `paiement.created`, `paiement.updated`, `paiement.cancelled`, `contrat.created`, `contrat.updated`

### stateMachine.ts — Machines d'état business
- `src/services/domain/stateMachine.ts` — source de vérité des transitions autorisées
- Paiement : `impaye → [paye|partiel|annule]`, `partiel → [paye|annule]`, `paye → [annule]`, `annule → ∅`
- Contrat : `actif → [expire|resilie]`, `expire → [actif]`, `resilie → ∅`
- `validatePaiementTransition(from, to)` — lève erreur si transition interdite
- `validateContratTransition(from, to)` — idem contrats
- Helpers : `isPaiementTerminal()`, `isContratTerminal()`, `getAllowedTransitions()`
- **Appliquée côté Edge Functions (Deno inline)** : `update-paiement` et `update-contrat` refusent les transitions invalides (code `INVALID_TRANSITION`)

## Récents ajouts (mai 2026) — Architecture Série A : 100% Edge Functions + Ledger + Job System

### Zéro write direct Supabase sur paiements/contrats
Toutes les mutations financières passent désormais par des Edge Functions Supabase :

| Opération | Edge Function | Remplace |
|-----------|--------------|---------|
| Créer paiement | `create-paiement` ✅ | `supabase.from('paiements').insert()` |
| Modifier paiement | `update-paiement` ✅ | `supabase.from('paiements').update()` |
| Annuler paiement | `cancel-paiement` ✅ | `supabase.from('paiements').delete()` |
| Créer contrat | `create-contrat` ✅ | `supabase.from('contrats').insert()` |
| Modifier contrat | `update-contrat` ✅ | `supabase.from('contrats').update()` |

### API Layer complet (`src/services/api/`)
- `paiementApi.ts` — `createPaiementViaEdge`, `updatePaiementViaEdge`, `cancelPaiementViaEdge`
- `contratApi.ts` — `createContratViaEdge`, `updateContratViaEdge`, `ContratApiError`

### Migration SQL `20260504000001_ledger_event_system.sql`
- **`ledger_entries`** — journal financier immutable (règle NO UPDATE/NO DELETE)
  - Chaque paiement génère : credit brut + credit commission + debit part_bailleur
  - Chaque annulation génère : debit reversal
- **`event_log`** — bus d'événements métier (`paiement.created`, `contrat.created`, `paiement.cancelled`, `paiement.updated`, `contrat.updated`)
- **Pilot tracking** sur `agencies` : `pilot_status` (trial/pilot/active/churned), `first_payment_at`, `first_contract_at`, `activation_at`
- **Triggers PL/pgSQL** : `trg_after_paiement_insert`, `trg_after_contrat_insert`, `trg_after_paiement_cancel`
- **Fonctions cron** : `fn_detect_impayes()`, `fn_generate_quittances_mensuelles()`
- **pg_cron** : `detect-impayes` (0 6 * * *), `generate-quittances` (0 7 1 * *) — s'installe si l'extension est activée

### PostHog events élargis
- `paiement_created` (existant)
- `paiement_updated` (nouveau)
- `paiement_cancelled` (nouveau)
- `contract_created` (nouveau)
- `contract_updated` (nouveau)

### Déploiement Edge Functions
```
supabase functions deploy create-paiement
supabase functions deploy update-paiement
supabase functions deploy cancel-paiement
supabase functions deploy create-contrat
supabase functions deploy update-contrat
```

## Récents ajouts (mai 2026) — Architecture backend + Analytics

### Edge Function Supabase — create-paiement
- `supabase/functions/create-paiement/index.ts` — Source de vérité serveur pour la création de paiements.
  - JWT vérifié, `agency_id` injecté côté serveur uniquement (jamais lu depuis le client)
  - Payload validé avec **Zod** (types, bornes, formats)
  - Propriété du contrat vérifiée via RLS (client JWT)
  - Commission calculée serveur (identique à `commissionService.ts`)
  - INSERT via service role avec `agency_id` injecté
  - Déploiement : `supabase functions deploy create-paiement`

### React Router (HashRouter)
- `src/App.tsx` — Migré de hash-state manuel vers **React Router HashRouter**
  - `currentPage` dérivé de `useLocation().pathname` (pas de useState)
  - `handleNavigate(page)` utilise `useNavigate()` — compatible avec l'interface `onNavigate: (page: string) => void` existante sur tous les composants
  - URLs : `/#/dashboard`, `/#/bailleurs`, etc. — aucune régression comportementale
  - `<Routes><Route path="*" /></Routes>` — routage complet + browser history

### PostHog Analytics
- `src/lib/analytics.ts` — Wrapper PostHog configurable via `VITE_POSTHOG_KEY`
  - No-op si clé non définie (0 erreur en développement sans clé)
  - `initAnalytics()` → `main.tsx`
  - `identifyUser()` → App.tsx après connexion
  - `trackPageView(page)` → App.tsx à chaque changement de route
  - `trackEvent(event, props)` → `Paiements.tsx` + `LoyersImpayes.tsx` sur `paiement_created`

### API Service — paiementApi.ts
- `src/services/api/paiementApi.ts` — Client pour l'Edge Function `create-paiement`
  - `createPaiementViaEdge(input)` — appel via `supabase.functions.invoke()`
  - `PaiementApiError` — classe d'erreur typée (code + message métier)
  - Utilisé dans `Paiements.tsx` (CREATE) et `LoyersImpayes.tsx` (paiement impayé)

### Infrastructure pilotes (10 clients fondateurs)
- `src/pages/Abonnement.tsx` — Section "Programme Pilote" avec 3 tiers tarifaires (Starter/Pro/Agence)
  - CTA WhatsApp + email pré-rempli pour rejoindre le programme

### Intégrité financière — Migration SQL
- `supabase/migrations/20260503000001_financial_integrity_constraints.sql`
  - Fix schéma `bilans_mensuels` : `agency_id`, `total_encaisse`, `nb_paiements` (colonnes manquantes)
  - 9 contraintes CHECK (idempotentes) sur paiements/contrats/bailleurs/depenses
  - Trigger `trg_validate_paiement_integrite` — validation serveur BEFORE INSERT/UPDATE
  - Trigger `trg_validate_contrat_commission` — commission obligatoire si statut='actif'
  - Trigger `trg_update_bilan_mensuel` — alimentation automatique AFTER INSERT

## Récents ajouts (mai 2026) — Finalisation production SaaS

### Repositories ajoutés (src/repositories/)
- `bailleursRepository.ts` — `list`, `findById`, `findWithImmeubles`, `insert`, `update`, `softDelete`
- `contratsRepository.ts` — `list`, `findById`, `findCommission`, `listActive`, `insert`, `update`, `softDelete`
- `paiementsRepository.ts` — existant, complété (voir ci-dessous)

### Corrections qualité code
- `LoyersImpayes.tsx` — suppression `?? 10` fallback commission, utilise `buildPaiementPayload` + `formatPaiementError`
- `pdf.ts` — fallback `'10'` dans mandat remplacé par `''` (aucune valeur inventée dans document légal)
- `Depenses.tsx` — `JSON.stringify(d)` remplacé par filtre explicite sur champs indexés
- `agencyHelper.ts` — tous les `console.log` supprimés
- `sentry.ts` — `console.log` d'initialisation supprimé
- `Dashboard.tsx`, `Paiements.tsx` handleDelete, `SetupWizard.tsx` — `catch (error: any)` → `catch (error: unknown)`
- `Contrats.tsx` — `catch (err: any)` → `catch (err: unknown)`, console.error supprimés
- `FiltresAvances.tsx` — erreurs silencieuses corrigées, console.error nettoyés
- `SetupWizard.tsx` — commission via `calculateCommission`, console.error redondants supprimés
- `README.md` — restructuré en 12 sections orientées développeur (spec SAAS READY)

### Règles absolues (production-grade)
- 0 `console.log` / `console.error` inutile en production
- 0 `catch (error: any)` — toujours `unknown`
- 0 fallback financier silencieux (`?? 10`, `|| 10`)
- TypeScript : 0 erreur confirmé à chaque étape
- Architecture : UI → Hook → Service domain → Repository → Supabase

## Récents ajouts (mai 2026) — Audit P3→P7 (logique métier, offline, architecture, PDF, UX)

### Services domaine (src/services/domain/)
- `commissionService.ts` — `validateCommission`, `calculateCommission`, `CommissionRequiredError`, `isCommissionMissing`. Suppression définitive du fallback `|| 10` silencieux.
- `paiementService.ts` — `buildPaiementPayload` (calcul part_agence/part_bailleur via commissionService), `formatPaiementError` (type-safe). Utilisé dans `Paiements.tsx` handleSubmit.
- `contratService.ts` — `validateContrat`, `isStatutTransitionValid`, `computeDateFin`, `isContratExpire`, `formatContratError`, `ContratValidationError`.

### Couche repository (src/repositories/)
- `paiementsRepository.ts` — Pattern repository complet : `list` (pagination), `listActiveContrats`, `findForPDF`, `insert`, `update`, `softDelete` (soft delete avec `deleted_at`/`actif`), `hardDelete`. Séparation totale DB ↔ logique métier.

### Offline & sync (améliorations P3)
- `offlineQueue.ts` — DELETE actions, `recoverStaleSyncing` (recovery des mutations bloquées en "syncing"), `MAX_RETRIES=3`, `SyncResult` avec `errorMessages`, `getErrorMutations`.
- `useOfflineSync.ts` — recovery stale au montage, `lastSyncResult`, `errorCount` exposés.
- `App.tsx` — `recoverStaleSyncing()` appelé au montage ; backup complet quotidien `runFullBackup(agencyId)` déclenché si `isDue` (> 24h depuis le dernier backup) avec fail silencieux.

### Backup complet (P1 finalisation)
- `localBackup.ts` — `runFullBackup(agencyId)` depuis Supabase : 7 tables (agences/bailleurs/immeubles/unites/locataires/contrats/paiements), `parseBackupPreview()` (lecture sans écriture), `restoreFromFile(strategy: merge|overwrite)`.
- `BackupIndicator.tsx` v2 — preview de restauration (comptage par table, date export, warning mutations hors-ligne) avec choix merge/overwrite avant confirmation.
- `NetworkBanner.tsx` v2 — 4 états : hors-ligne (rouge + count pending), erreurs sync (orange), en sync (bleu spinner), connexion rétablie (vert + count synchronisé).

### Paiements.tsx (P2 logique métier)
- Recherche : remplacé `JSON.stringify(p)` par filtre explicite sur nom/prénom locataire, nom unité, référence, mois, mode, statut.
- handleSubmit : utilise `buildPaiementPayload` + `formatPaiementError` — plus aucun fallback commission silencieux.
- Formulaire : avertissement `AlertTriangle` si le contrat sélectionné n'a pas de commission configurée (`isCommissionMissing`).

### Migration SQL (P8 Dashboard RPC)
- `supabase/migrations/20260502000001_add_dashboard_stats_rpc.sql` — RPC `get_dashboard_stats(agency_id, year_month)` : 1 seule requête SQL au lieu de 8 en parallèle. RPC `get_monthly_revenue(agency_id, year)` : agrégats mensuels côté Postgres, pas de chargement en mémoire. Les deux fonctions ont `SECURITY DEFINER` + vérification multi-tenant + `REVOKE/GRANT` correct.

## Récents ajouts (mai 2026) — 3 piliers de résilience (offline-first)

### Architecture ajoutée

**Services IndexedDB (src/services/)**
- `db.ts` — wrapper IndexedDB minimal sans lib externe (`openDB`, `dbPut`, `dbGet`, `dbGetAll`, `dbDelete`, `dbClear`, `dbGetByIndex`). 2 stores : `snapshots` (backups) + `pending_mutations` (queue offline).
- `localBackup.ts` — `saveSnapshot(key, data)` / `loadSnapshot(key)` / `downloadBackup()` (JSON) / `restoreFromFile(file)` / `clearAllSnapshots()`. Timestamp en localStorage.
- `offlineQueue.ts` — `enqueueMutation` / `getPendingMutations` / `syncPendingMutations` (replay contre Supabase, last-write-wins) / `clearDoneMutations`. Actions : `locataire_create/update`, `paiement_create/update`, `contrat_create/update`.

**Hooks (src/hooks/)**
- `useBackup.ts` — `{ save, download, restore, getSnapshot, saving, downloading, lastBackupTime }`. Auto-save IndexedDB après chaque mutation/fetch.
- `useOfflineSync.ts` — `{ isOnline, pendingCount, syncing, enqueue, syncNow }`. Replay auto sur `window.online`. Ref-guard pour éviter les doubles syncs.
- `useExport.ts` — `{ exportLocataires, exportPaiements, exportContrats, exportAll, exporting }`. Génération Excel côté client via SheetJS (xlsx déjà installé). Colonnes typées, largeurs configurées.

**Composant BackupIndicator (src/components/ui/BackupIndicator.tsx)**
- Badge flottant bas-droit (au-dessus de BottomNav sur mobile).
- 3 états visuels : vert "sauvegardé il y a X min" / bleu spinner "synchronisation" / orange "X actions en attente".
- Clic → panel expandable avec boutons "Télécharger sauvegarde" + "Restaurer sauvegarde".

**NetworkBanner amélioré**
- Offline : compte les actions en attente (`pending_mutations`).
- Reconnexion : flush automatique de la queue + message "X actions synchronisées".
- Synchronisation en cours : barre bleue avec spinner.

**Intégrations pages**
- `App.tsx` : `useOfflineSync` + `<BackupIndicator syncing pendingCount>`.
- `Paiements.tsx` : bouton "Exporter Excel", auto-backup après loadData, queue offline si `!isOnline` au moment du submit.
- `Locataires.tsx` : bouton "Exporter Excel", auto-backup après loadData.
- `Contrats.tsx` : bouton "Exporter Excel", auto-backup après loadData.

## Récents ajouts (mai 2026) — 7 features

- **1. Dashboard valeurs financières (Dashboard.tsx)** :
  - Ajout de `nbPaiementsMois` / `nbImpayesMois` dans `DashboardStats`.
  - Bande de 4 cartes KPI : encaissés du mois, impayés, contrats actifs, taux d'occupation.
  - Bannière rouge cliquable quand `nbImpayesMois > 0` → navigation vers `loyers-impayes`.

- **2. Paiement Wave / Orange Money simulé (`src/components/ui/PaymentModal.tsx`)** :
  - Nouveau composant modal 4 étapes : choisir le moyen → numéro de téléphone → traitement (2 s) → succès.
  - Simulation pure (pas d'API externe) : upsert `subscriptions` + update `agencies.status = 'active'`.
  - Intégré dans `Abonnement.tsx` : bouton "Payer l'abonnement" avec gradient orange, place le modal au-dessus du bouton d'upgrade.

- **3. Gestion des erreurs réseau (`src/hooks/useRetry.ts` + `src/components/ui/NetworkBanner.tsx`)** :
  - `useRetry(fn, { maxAttempts, baseDelay })` : exponential backoff configurable, retourne `{ data, error, loading, retry }`.
  - `NetworkBanner` : détecte `window.onfline/offline`, s'affiche en orange-rouge "Mode hors ligne" / vert "Connexion rétablie". Monté dans `App.tsx` avant la `TrialBanner`.

- **4. Pagination Locataires (`src/pages/Locataires.tsx`)** :
  - `ITEMS_PER_PAGE = 10` ; état `currentPage` remis à 1 à chaque changement de recherche.
  - UI pagination complète : ‹ Préc. · N pages · Suiv. › + sauts début/fin, bouton page active en orange.
  - Compteur "X locataires enregistrés" + compteur de résultats lors d'une recherche.

- **5. Numéros de quittance uniques (`src/lib/pdf.ts`)** :
  - Nouvelle fonction `generateQuittanceRef(p)` : format `QIT-AAAAMM-{4 chars ID}{4 chars random}`.
  - Distincte de `generateFactureRef` (`FAC-…`), utilisée dans `generatePaiementFacturePDF`.
  - Validation préalable des champs critiques (locataire, unité, montant, mois) avec `console.warn` si manquants mais génération continue.

- **6. Audit RLS** :
  - Toutes les tables métier ont `agency_id` FK + policies RLS tenant-scoped (confirmé dans les migrations en attente).
  - P0 déjà corrigé (avril 2026) : policy `invitations` anon restreinte à la RPC SECURITY DEFINER.
  - Recommandation en attente : appliquer `supabase/migrations/20260426000002_security_warnings_fixes.sql` via Dashboard pour corriger les warnings Advisor (`search_path`, policies `WITH CHECK (true)` sur `agency_settings`/`audit_logs`).

- **7. Système de tracking / usage (`src/hooks/useTracking.ts`)** :
  - Hook `useTracking()` → `{ track }` : insère dans `audit_logs { user_id, agency_id, action, entity_type, entity_id, metadata }`. Fail silencieux (pas de throw).
  - Intégré dans `Paiements.tsx` (action `paiement_create`) et `Contrats.tsx` (action `contrat_create`) après succès de l'opération.

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
- `Encaissements` — Tabbed wrapper merging Paiements (received) + LoyersImpayes (overdue)
- `Paiements` — Payment recording (now embedded inside Encaissements; KPI strip + status filters + redesigned modal)
- `LoyersImpayes` — Overdue rents (embedded inside Encaissements)
- `Depenses` — Expense tracking
- `Commissions` — Agency commissions
- `Analyses` — Tabbed wrapper merging financial reports + advanced filters
- `Bailleurs` — Property owner management
- `Immeubles` — Building management
- `Unites` — Unit/apartment management
- `Locataires` — Tenant management
- `Contrats` — Lease contract management
- `Calendrier`, `Interventions`, `Inventaires`, `Documents` — Operations
- `ParametresHub` — Tabbed wrapper for Mon agence + Équipe + Abonnement
- `Welcome` — Onboarding flow for new agencies

### Information architecture (Apr 2026 refactor)
The sidebar was reduced from **18 flat entries to 6 collapsible top-level groups** to match real estate manager workflows:
- 🏠 **Tableau de bord** (direct link)
- 💰 **Finances** ▾ Encaissements · Dépenses · Commissions · Analyses
- 👥 **Locations** ▾ Locataires · Contrats
- 🏢 **Patrimoine** ▾ Bailleurs · Immeubles · Produits
- 🛠 **Activité** ▾ Calendrier · Maintenance · États des lieux · Documents
- ⚙ **Paramètres** (single link → tabbed page Mon agence | Équipe | Abonnement)

Three pages were merged using **internal tabs** to keep related workflows together:
- `Encaissements` = Paiements + Loyers impayés (the two faces of cash flow)
- `Analyses` = Rapports financiers + Filtres avancés (all analytics in one place)
- `ParametresHub` = Mon agence + Équipe + Abonnement (config moved out of main menu)

**Backward compatibility**: legacy page IDs (`paiements`, `loyers-impayes`, `tableau-de-bord-financier`, `filtres-avances`, `equipe`, `abonnement`) still work — they route to the new tabbed wrappers with the correct initial tab. This preserves all notification deep-links.

### Design system
- `src/components/ui/Button.tsx` — Variants: primary (orange→red gradient), secondary, ghost, danger, success. With loading/disabled states.
- `src/components/ui/Tabs.tsx` — Generic tab bar with badges + active gradient underline.
- `src/components/ui/Skeleton.tsx` — Skeleton loaders (`SkeletonCards`, `SkeletonTable`, etc).
- `src/components/ui/EmptyState.tsx` — Empty state with optional CTA.
- `src/components/ui/Modal.tsx` — **Responsive**: bottom-sheet on mobile (slides up, drag handle, body-scroll lock), centered dialog on desktop. Uses `animate-slideUp` / `animate-scaleIn`.
- `src/components/ui/Table.tsx` — **Responsive**: mobile card view (`< sm`, hidden columns collapsed) + full table (`sm+`). All pages using `<Table>` get mobile cards automatically.
- `src/components/layout/BottomNav.tsx` — **NEW** fixed bottom navigation bar for mobile (4 quick items + "Plus" menu button). Hidden on `lg+`.

### Mobile-first responsive redesign (May 2026)
- `src/index.css` — Added `scrollbar-hide` utility, `animate-slideUp` keyframe, `touch-action: manipulation` on interactive elements, `font-size: 16px` on inputs (prevents iOS auto-zoom).
- `src/App.tsx` — Integrated `BottomNav`; shows current page name in mobile top bar (`PAGE_LABELS` map); main content has `pb-16 lg:pb-0` for BottomNav clearance.
- `src/pages/Interventions.tsx` — Mobile kanban: column tab pill selector (shows active column count); columns hidden on mobile unless active; all 3 shown on `lg+`.
- `src/pages/Calendrier.tsx` — Smaller cells on mobile (`min-h-14 sm:min-h-20`); colored dots only on `< sm` (no text); text labels on `sm+`.
- `src/pages/Commissions.tsx` — Detail rows: mobile card view (`sm:hidden`) + desktop table (`hidden sm:block`); empty state added.

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
