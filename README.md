# Samay Këur — Gestion Locative SaaS

Application web multi-tenant de gestion immobilière pour agences et bailleurs. Marché sénégalais et francophone.

---

## 1. Présentation du projet

**Samay Këur** (« mes maisons » en wolof) permet à une agence immobilière de gérer l'intégralité de son cycle locatif depuis une interface web unique.

**Problème résolu** : les agences africaines gèrent leurs bailleurs, locataires, loyers et documents légaux manuellement ou sur des tableurs. Cette application centralise tout, fonctionne hors ligne, et isole chaque agence dans un tenant sécurisé.

**Public cible** :
- Agences immobilières (multi-bailleurs, multi-immeubles, équipe collaborative)
- Bailleurs individuels (vue simplifiée sur leurs propres biens)
- Propriétaire SaaS (console d'administration multi-agences)

---

## 2. Fonctionnalités principales

**Gestion immobilière**
- CRUD bailleurs → immeubles → unités (appartements, studios, bureaux, commerces)
- Statuts unité : `libre` / `loué` / `maintenance`

**Contrats et locataires**
- CRUD locataires et contrats avec commission obligatoire
- Soft delete sur toutes les entités (`actif`, `deleted_at`)
- Détection automatique des impayés (6 derniers mois glissants)

**Paiements et finances**
- Enregistrement des encaissements avec décomposition `part_agence` / `part_bailleur`
- KPIs : encaissé ce mois, mois précédent, en attente, taux de recouvrement
- Rapport commissions par bailleur/immeuble avec export PDF
- Filtres avancés multi-critères + export Excel
- Gestion des dépenses par catégorie

**Documents PDF**
- Contrat de location, mandat de gérance, quittance/facture
- Variables dynamiques depuis `agency_settings`
- Numérotation unique quittances : `QIT-AAAAMM-{id}{rand}`

**Dashboard financier**
- Bilan mensuel agence (loyers, commissions, dépenses, solde)
- Graphiques Recharts (bar, pie, line)
- RPC SQL prêt : `get_dashboard_stats` / `get_monthly_revenue`

**Offline-first**
- Queue IndexedDB (CREATE / UPDATE / DELETE)
- Sync automatique au retour de connexion, retry 3× avec backoff
- Backup quotidien automatique des 7 tables critiques

**SaaS multi-tenant**
- Console super-admin (agences, plans, utilisateurs, audit)
- Onboarding : demande → approbation → création agence
- Invitations par token (7 jours), rôles différenciés
- Plans : `basic` (essai) / `pro` / `enterprise`

---

## 3. Architecture globale

```
┌────────────────────────────────────────────────────┐
│  React 18 + Vite 5 + TypeScript + Tailwind CSS     │
│  SPA offline-first (IndexedDB)                     │
│  Routing par état React (pas de React Router)      │
└───────────────────────┬────────────────────────────┘
                        │ HTTPS + WebSocket (realtime)
┌───────────────────────▼────────────────────────────┐
│  SUPABASE                                          │
│  PostgreSQL + RLS │ Auth JWT │ Storage │ RPC SQL   │
└────────────────────────────────────────────────────┘
```

**Pattern d'architecture obligatoire** :

```
UI → Hook → Service (src/services/domain/) → Repository (src/repositories/) → Supabase
                                                      ↓
                                           IndexedDB (offline queue / backup)
```

Il n'y a pas de backend custom. La logique serveur se limite aux fonctions SQL `SECURITY DEFINER` et aux politiques RLS.

---

## 4. Structure du projet

```
src/
├── App.tsx                      # Routing état + backup quotidien + recovery offline
├── main.tsx                     # Point d'entrée, init Sentry
│
├── components/
│   ├── auth/LoginForm.tsx
│   ├── layout/Sidebar.tsx       # Navigation responsive (groupes pliables)
│   └── ui/
│       ├── BackupIndicator.tsx  # Badge backup (aperçu, merge/overwrite)
│       ├── NetworkBanner.tsx    # Bannière réseau (4 états)
│       ├── SetupWizard.tsx      # Assistant onboarding (6 étapes)
│       └── ...                 # Button, Modal, Table, Toast, ConfirmModal…
│
├── contexts/AuthContext.tsx     # user, profile, signIn, signUp, signOut
│
├── hooks/
│   ├── useOfflineSync.ts        # Sync queue, errorCount, syncNow
│   ├── useBackup.ts             # save/download/restore/preview/isDailyDue
│   ├── useToast.ts
│   ├── useTracking.ts           # Audit trail (audit_logs)
│   └── useFeatureFlag.ts
│
├── lib/
│   ├── supabase.ts              # Client singleton
│   ├── pdf.ts                   # Génération PDF + cache settings (TTL 5 min)
│   ├── formatters.ts            # formatCurrency (XOF/EUR/USD), formatDate
│   ├── errorMessages.ts         # Traduction erreurs Supabase → français
│   └── sentry.ts
│
├── repositories/                # Accès DB uniquement — aucune logique métier
│   ├── bailleursRepository.ts
│   ├── contratsRepository.ts
│   └── paiementsRepository.ts
│
├── services/
│   ├── db.ts                    # Wrapper IndexedDB
│   ├── localBackup.ts           # Backup 7 tables, preview, restore, runFullBackup
│   ├── offlineQueue.ts          # Queue mutations (CREATE/UPDATE/DELETE, retry, recovery)
│   └── domain/                  # Logique métier pure — jamais dans les composants
│       ├── commissionService.ts
│       ├── contratService.ts
│       └── paiementService.ts
│
├── pages/                       # 25 pages, toutes lazy-loaded
│   ├── Dashboard.tsx
│   ├── Paiements.tsx
│   ├── LoyersImpayes.tsx
│   ├── Contrats.tsx
│   ├── Bailleurs.tsx
│   └── ...
│
└── types/                       # Entités domaine, formulaires, PDF, DB
```

```
supabase/migrations/             # ~45 fichiers SQL — appliquer dans l'ordre alphabétique
├── _archive/                    # ⚠️ Ne pas rejouer
└── *.sql

public/templates/                # Templates texte PDF (variables {{...}})
```

---

## 5. Logique métier critique

### Commission — règle absolue

La commission est **obligatoire** sur tout contrat. Aucun fallback silencieux n'est autorisé.

```typescript
// commissionService.ts
validateCommission(commission: number | null): void
// → lance CommissionRequiredError si null / undefined
// → lance CommissionRangeError si hors [0, 100]

calculateCommission(montantTotal, commission): { partAgence, partBailleur, tauxCommission }
isCommissionMissing(commission): boolean  // check UI, ne lance pas d'erreur
```

### Paiement

```typescript
// paiementService.ts
buildPaiementPayload(input, contrat, agencyId): PaiementInsert
// Calcule part_agence / part_bailleur via commissionService
// Lance CommissionRequiredError si commission absente

formatPaiementError(err: unknown): string
// Gère CommissionRequiredError, PaiementValidationError, Error, unknown
```

### Contrat

```typescript
// contratService.ts
validateContrat(contrat): void
isStatutTransitionValid(from, to): boolean
computeDateFin(dateDebut, dureeMois): string
formatContratError(err: unknown): string
```

### Repositories disponibles

| Repository | Méthodes clés |
|---|---|
| `bailleursRepository` | `list`, `findById`, `findWithImmeubles`, `insert`, `update`, `softDelete` |
| `contratsRepository` | `list`, `findById`, `findCommission`, `listActive`, `insert`, `update`, `softDelete` |
| `paiementsRepository` | `list`, `findForPDF`, `listActiveContrats`, `insert`, `update`, `softDelete`, `hardDelete` |

---

## 6. Règles de développement

**Interdits**
- Requêtes Supabase directes dans les pages — utiliser les repositories
- Logique métier dans les composants React — utiliser `src/services/domain/`
- Fallback silencieux sur données financières : `|| 10`, `?? 0` sur commission/paiement/taux
- `catch (error: any)` — toujours `catch (error: unknown)`
- `console.log` / `console.error` en production
- `JSON.stringify` pour filtrer des données métier

**Obligatoire**
- Toute commission → `commissionService`
- Tout paiement → `paiementService.buildPaiementPayload`
- Toute erreur utilisateur → `useToast()` + message typé
- `agency_id` dans tous les SELECT et INSERT
- Pattern `requestIdRef` sur toutes les pages avec chargement asynchrone

**Pattern nouvelle page**

```tsx
const requestIdRef = useRef(0);

const loadData = useCallback(async () => {
  const myId = ++requestIdRef.current;
  try {
    const { data, error } = await monRepository.list(profile.agency_id);
    if (myId !== requestIdRef.current) return;  // requête obsolète
    if (error) throw error;
    setData(data);
  } catch (err: unknown) {
    if (myId !== requestIdRef.current) return;
    showError(err instanceof Error ? err.message : 'Erreur de chargement');
  }
}, [profile?.agency_id]);

useEffect(() => {
  if (profile?.agency_id) loadData();
  return () => { requestIdRef.current++; };
}, [profile?.agency_id, loadData]);
```

**Nouvelle migration SQL**

1. Nom : `YYYYMMDDHHMMSS_description.sql`
2. Idempotente : `IF NOT EXISTS`, `CREATE OR REPLACE`, `ON CONFLICT DO NOTHING`
3. Fonctions SECURITY DEFINER : toujours `SET search_path = public, pg_temp`
4. Vérification multi-tenant : `EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND agency_id = p_agency_id)`

---

## 7. Offline-first et synchronisation

L'app fonctionne intégralement hors ligne via IndexedDB (`samay-keur-local` v1).

| Store IndexedDB | Rôle |
|---|---|
| `snapshots` | Backups JSON des 7 tables critiques |
| `pending_mutations` | Queue CREATE / UPDATE / DELETE en attente |

**Cycle de sync**
1. Action utilisateur → `queueMutation()` → écriture IndexedDB immédiate
2. Connexion détectée → `syncNow()` → replay des mutations dans l'ordre
3. Erreur → retry jusqu'à 3× (backoff exponentiel via `useRetry`)
4. Au démarrage → `recoverStaleSyncing()` récupère les mutations bloquées en `syncing`

**API `useOfflineSync`**
```typescript
{ isOnline, pendingCount, syncing, errorCount, lastSyncResult, queueMutation, syncNow }
```

**Backup automatique**

Au démarrage (post-auth), si la dernière sauvegarde date de +24h : `runFullBackup(agencyId)` charge les 7 tables depuis Supabase et les persiste dans IndexedDB.

Tables : `agences`, `bailleurs`, `immeubles`, `unites`, `locataires`, `contrats`, `paiements`

**Restauration** : `BackupIndicator` → aperçu (date, comptages, alerte mutations) → merge ou overwrite.

---

## 8. Installation

### Prérequis

- Node.js ≥ 18
- Un projet Supabase actif

### Étapes

```bash
# 1. Cloner
git clone <url> && cd samay-keur

# 2. Installer les dépendances
npm install

# 3. Configurer l'environnement
cp .env.example .env
# Renseigner VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY

# 4. Appliquer les migrations
supabase db push
# ⚠️ Ne pas exécuter les fichiers dans _archive/

# 5. Créer le premier super_admin (SQL Editor Supabase)
UPDATE user_profiles SET role = 'super_admin' WHERE email = 'admin@example.com';

# 6. Lancer
npm run dev
```

Application disponible sur `http://localhost:5000`.

**Scripts disponibles**

| Commande | Description |
|---|---|
| `npm run dev` | Vite dev server (port 5000, HMR) |
| `npm run build` | Build production → `dist/` |
| `npm run typecheck` | `tsc --noEmit` — doit retourner 0 erreur |
| `npm run lint` | ESLint |
| `npm run test` | Playwright (headless) |

---

## 9. Variables d'environnement

```env
# Obligatoires
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...

# Optionnels — monitoring
VITE_SENTRY_DSN=https://...@sentry.io/...
SENTRY_ORG=your-org
SENTRY_PROJECT=your-project
SENTRY_AUTH_TOKEN=...

# Optionnels — scripts CI/seed (jamais côté client)
SUPABASE_SERVICE_ROLE_KEY=eyJ...
SUPABASE_PROJECT_ID=<project-ref>

# Optionnel — backup S3 (CI uniquement)
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=...
BACKUP_BUCKET=your-s3-bucket

# Environnement
VITE_ENV=development
VITE_APP_URL=http://localhost:5000
VITE_APP_VERSION=1.0.0
```

> Sur Replit : configurer via **Secrets** (icône cadenas). Ne jamais commiter `.env`.

> `VITE_SUPABASE_ANON_KEY` est une clé publique — exposée côté client intentionnellement. La sécurité repose sur les politiques RLS de Supabase.

---

## 10. Migrations Supabase

Les migrations sont dans `supabase/migrations/`. Appliquer dans **l'ordre alphabétique strict**.

```bash
supabase db push
# ou copier-coller chaque fichier *.sql dans le SQL Editor Supabase
```

**Fonctions SQL critiques**

| Fonction | Type | Rôle |
|---|---|---|
| `handle_new_user()` | Trigger SECURITY DEFINER | Création automatique `user_profiles` |
| `current_user_agency_id()` | SQL SECURITY DEFINER | Retourne `agency_id` sans récursion RLS |
| `is_super_admin()` / `is_admin()` | SQL SECURITY DEFINER | Tests de rôle pour les policies |
| `check_plan_limits(agency_id)` | PL/pgSQL SECURITY DEFINER | Quotas plan |
| `approve_agency_request(id)` | PL/pgSQL SECURITY DEFINER | Crée l'agence complète |
| `accept_invitation(token)` | PL/pgSQL SECURITY DEFINER | Accepte une invitation |
| `get_dashboard_stats(agency_id, month)` | PL/pgSQL SECURITY DEFINER | Agrégats dashboard |
| `get_monthly_revenue(agency_id, year)` | PL/pgSQL SECURITY DEFINER | Revenus mensuels |

**Points d'attention**
- Ne jamais recréer de policies sur `user_profiles` sans utiliser `current_user_agency_id()` — risque de récursion RLS.
- Ne pas rejouer les fichiers dans `_archive/`.
- Toutes les fonctions SECURITY DEFINER doivent inclure `SET search_path = public, pg_temp`.

---

## 11. Bugs connus et limites

**Critiques**

| # | Problème | Statut |
|---|---|---|
| 1 | Récursion RLS `user_profiles` | Corrigé via `current_user_agency_id()`. Ne pas recréer de policies manuelles. |
| 2 | `bilans_mensuels` jamais alimentée | La table existe mais n'est pas renseignée automatiquement. Ne pas s'y fier pour les rapports — calculs à la volée dans `TableauDeBordFinancierGlobal`. |

**Importants**

| # | Problème | Détail |
|---|---|---|
| 3 | Routing sans history API | Pas d'URLs directes, pas de bouton retour navigateur. Migration vers React Router envisageable. |
| 4 | Cache PDF non invalidé automatiquement | `settingsCache` TTL 5 min. Appeler `invalidateAgencySettingsCache(agencyId)` après sauvegarde des paramètres agence. |
| 5 | Template PDF avec variables vides | Si `agency_settings` n'est pas renseigné, les `{{...}}` produisent des chaînes vides. |
| 6 | Dashboard — 8 requêtes parallèles | Migration SQL `get_dashboard_stats` prête (`20260502000001`). À appliquer via `supabase db push` puis migrer `Dashboard.tsx`. |

**Points de vigilance**

- **Race conditions** : pattern `requestIdRef` implémenté dans `Calendrier.tsx`, `Contrats.tsx`. À reproduire dans toute nouvelle page avec chargement asynchrone.
- **Plan limits** : `usePlanLimits` vérifié sur Immeubles et Unités, pas encore sur toutes les entités.
- **QR code quittances** : paramètre `qr_code_quittances` dans `agency_settings`, génération non branchée dans le PDF.

---

## 12. Améliorations futures

| Fonctionnalité | Priorité |
|---|---|
| Paiement en ligne (Stripe, Wave Business) | Haute |
| Envoi email/SMS automatique (rappels impayés, échéances) | Haute |
| Portail locataire (accès quittances/contrats) | Moyenne |
| Signature électronique des contrats et mandats | Moyenne |
| Migration routing vers React Router / TanStack Router | Moyenne |
| QR code sur les quittances | Basse |
| Export comptable (FEC) | Basse |
| Application mobile native (Expo) | Basse |
| Gestion des feature flags depuis la console UI | Basse |
| `bilans_mensuels` alimentée automatiquement (trigger SQL) | Basse |

---

*Dernière mise à jour : mai 2026. Reflète fidèlement l'état du code source.*
