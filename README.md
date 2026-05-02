# Samay Këur — Plateforme SaaS de Gestion Locative

> **Application web multi-tenant de gestion immobilière pour agences et bailleurs. Conçue pour le marché sénégalais et francophone. Production-ready.**

---

## Table des matières

1. [Présentation du produit](#1-présentation-du-produit)
2. [Contexte métier](#2-contexte-métier)
3. [Architecture générale](#3-architecture-générale)
4. [Stack technique](#4-stack-technique)
5. [Structure des dossiers](#5-structure-des-dossiers)
6. [Rôles et permissions](#6-rôles-et-permissions)
7. [Modèle multi-tenant](#7-modèle-multi-tenant)
8. [Base de données](#8-base-de-données)
9. [Frontend et navigation](#9-frontend-et-navigation)
10. [Backend, API et sécurité](#10-backend-api-et-sécurité)
11. [Offline-first et synchronisation](#11-offline-first-et-synchronisation)
12. [Backup et restauration](#12-backup-et-restauration)
13. [Logique métier (services domaine)](#13-logique-métier-services-domaine)
14. [Fonctionnalités implémentées](#14-fonctionnalités-implémentées)
15. [Fonctionnalités partiellement implémentées](#15-fonctionnalités-partiellement-implémentées)
16. [Fonctionnalités manquantes ou incomplètes](#16-fonctionnalités-manquantes-ou-incomplètes)
17. [Bugs connus et points de vigilance](#17-bugs-connus-et-points-de-vigilance)
18. [Variables d'environnement](#18-variables-denvironnement)
19. [Installation locale](#19-installation-locale)
20. [Lancement du projet](#20-lancement-du-projet)
21. [Scripts disponibles](#21-scripts-disponibles)
22. [Déploiement](#22-déploiement)
23. [Tests](#23-tests)
24. [Bonnes pratiques de contribution](#24-bonnes-pratiques-de-contribution)
25. [FAQ technique](#25-faq-technique)

---

## 1. Présentation du produit

**Samay Këur** (« mes maisons » en wolof) est une plateforme SaaS de gestion locative immobilière. Elle cible les agences immobilières et les bailleurs individuels souhaitant gérer leurs propriétés, locataires, contrats et encaissements depuis une interface web unique.

### Ce que fait l'application

- Gérer un parc immobilier : bailleurs → immeubles → unités (appartements, locaux, studios…)
- Gérer le cycle locatif complet : locataires → contrats → paiements → quittances PDF
- Suivre les impayés, les commissions d'agence et les dépenses d'exploitation
- Générer des documents légaux PDF : contrats de location, mandats de gérance, quittances
- Administrer plusieurs agences indépendantes depuis une console super-admin (SaaS propriétaire)
- Gérer une équipe avec des rôles différenciés (admin, agent, comptable, bailleur)
- Tracker les états des lieux, interventions de maintenance et événements calendrier
- Stocker des documents associés aux biens (GED légère)
- Fonctionner **hors ligne** avec synchronisation automatique au retour de connexion
- Sauvegarder et restaurer les données localement (backup IndexedDB + JSON)

### Pour qui

| Profil | Usage |
|--------|-------|
| Agence immobilière | Gestion multi-bailleurs, multi-immeubles, équipe collaborative |
| Bailleur individuel | Gestion de ses propres biens, vue simplifiée |
| Propriétaire SaaS | Console d'administration globale multi-agences |

---

## 2. Contexte métier

### Flux métier principal

```
Bailleur → Immeuble → Unité → Contrat → Paiement mensuel
                                    ↓
                              Quittance PDF / Commission agence
```

### Entités clés

- **Bailleur** : propriétaire du bien. Dispose d'un taux de commission défini au contrat.
- **Immeuble** : bâtiment rattaché à un bailleur.
- **Unité** (`unites`) : appartement, studio, bureau ou commerce au sein d'un immeuble. Statut : `libre`, `loue`, `maintenance`.
- **Locataire** : personne qui occupe une unité via un contrat.
- **Contrat** : lien entre locataire et unité, avec loyer mensuel, caution, taux de commission obligatoire et destination (Habitation/Commercial).
- **Paiement** : encaissement mensuel. Décomposé automatiquement en `part_agence` et `part_bailleur` via `commissionService`.
- **Dépense** : frais d'exploitation de l'agence.

### Spécificité marché sénégalais

- Devise par défaut : **XOF (Franc CFA)**
- Montants sans décimales dans l'affichage courant
- Formats de documents conformes aux usages locaux
- Coordonnées : numéros +221, NINEA (numéro d'identification fiscal sénégalais)
- Références au Tribunal de Dakar dans les mentions légales

---

## 3. Architecture générale

```
┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND                             │
│  React 18 + Vite 5 + TypeScript + Tailwind CSS             │
│                                                             │
│  SPA (state-based routing) + Lazy loading + Code Splitting  │
│  Offline-first : IndexedDB (snapshots + pending_mutations)  │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTPS / REST + WebSocket (realtime)
┌──────────────────────────▼──────────────────────────────────┐
│                       SUPABASE                              │
│                                                             │
│  ┌─────────────┐  ┌──────────┐  ┌───────────┐  ┌────────┐ │
│  │  PostgreSQL │  │   Auth   │  │  Storage  │  │  RPC   │ │
│  │  + RLS      │  │  (JWT)   │  │  Buckets  │  │  SQL   │ │
│  └─────────────┘  └──────────┘  └───────────┘  └────────┘ │
└─────────────────────────────────────────────────────────────┘
```

L'application est un **frontend-heavy SPA offline-first**. La logique métier est séparée dans une couche `/services/domain` et l'accès BDD dans `/repositories`. Supabase assure la persistance, l'authentification JWT, le stockage de fichiers et les politiques de sécurité (Row Level Security).

**Pattern d'architecture** :
```
UI → Hook → Service (domaine) → Repository → Supabase
                    ↓
            IndexedDB (offline queue / backup)
```

Il n'y a **pas de backend custom**. Les seules logiques serveur sont :
- Les **fonctions SQL** (SECURITY DEFINER) pour les opérations critiques
- Les **triggers PostgreSQL** (création automatique de profils et settings)
- Les **politiques RLS** pour l'isolation multi-tenant
- Les **RPCs agrégats** (`get_dashboard_stats`, `get_monthly_revenue`) pour les calculs serveur

---

## 4. Stack technique

### Frontend

| Technologie | Version | Rôle |
|-------------|---------|------|
| React | 18.x | Framework UI |
| Vite | 5.x | Bundler et dev server |
| TypeScript | 5.x | Typage statique (strict) |
| Tailwind CSS | 3.x | Styles utilitaires |
| Lucide React | 0.344.x | Icônes |
| Recharts | 3.x | Graphiques (bar, pie, line charts) |
| jsPDF + jspdf-autotable | 3.x / 5.x | Génération de PDF côté client |
| XLSX | 0.18.x | Export Excel |
| @sentry/react | 10.x | Monitoring d'erreurs |

### Backend (Supabase)

| Composant | Rôle |
|-----------|------|
| PostgreSQL (via Supabase) | Base de données relationnelle principale |
| Supabase Auth | Authentification email/password + JWT |
| Supabase Storage | Fichiers : `agency-assets` (logos), `documents` (GED) |
| Row Level Security (RLS) | Isolation multi-tenant et contrôle d'accès |
| SECURITY DEFINER Functions | Opérations privilégiées (approbation, invitation, agrégats) |
| PostgreSQL Triggers | Auto-création de profils et settings |

### Stockage local (IndexedDB)

| Store | Rôle |
|-------|------|
| `snapshots` | Backups des 7 tables critiques (JSON compressé) |
| `pending_mutations` | Queue offline des opérations CREATE/UPDATE/DELETE |

---

## 5. Structure des dossiers

```
samay-keur/
├── src/
│   ├── App.tsx                    # Router principal (state-based) + backup quotidien
│   ├── main.tsx                   # Point d'entrée, initialisation Sentry
│   ├── index.css                  # Animations Tailwind custom + mobile-first
│   │
│   ├── components/
│   │   ├── auth/
│   │   │   └── LoginForm.tsx      # Formulaire de connexion stylisé
│   │   ├── console/
│   │   │   ├── AgencyRequestsPanel.tsx  # Panel demandes agence (super-admin)
│   │   │   └── ConsoleModals.tsx        # Modales CRUD de la console
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx        # Navigation latérale (responsive, groupes pliables)
│   │   │   └── BottomNav.tsx      # Navigation bas de page mobile (4 items + "Plus")
│   │   └── ui/
│   │       ├── BackupIndicator.tsx    # Badge flottant backup (preview + merge/overwrite)
│   │       ├── Button.tsx             # Bouton réutilisable (variants, tailles, loading)
│   │       ├── ConfirmModal.tsx       # Modal de confirmation (destructive/warning/info)
│   │       ├── EmptyState.tsx         # État vide générique
│   │       ├── MaintenanceBanner.tsx  # Bannière maintenance (saas_config)
│   │       ├── Modal.tsx              # Modal générique (bottom-sheet mobile)
│   │       ├── NetworkBanner.tsx      # Bannière réseau (offline/sync/erreurs)
│   │       ├── NotificationBell.tsx   # Cloche notifications (realtime)
│   │       ├── PaymentModal.tsx       # Modal paiement Wave/Orange Money (simulé)
│   │       ├── PlanGate.tsx           # Blocage selon le plan
│   │       ├── QuickStart.tsx         # Guide de démarrage
│   │       ├── SetupWizard.tsx        # Assistant configuration initiale (6 étapes)
│   │       ├── Skeleton.tsx           # Squelettes de chargement
│   │       ├── Table.tsx              # Tableau générique (mobile cards + desktop table)
│   │       ├── Tabs.tsx               # Onglets réutilisables
│   │       ├── Toast.tsx              # Notifications toast
│   │       └── TrialBanner.tsx        # Bannière période d'essai
│   │
│   ├── contexts/
│   │   └── AuthContext.tsx        # Context Auth : user, profile, signIn, signUp, signOut
│   │
│   ├── hooks/
│   │   ├── useBackup.ts           # Backup IndexedDB (save/download/restore/preview/isDailyDue)
│   │   ├── useErrorReporting.ts   # Intégration Sentry
│   │   ├── useExport.ts           # Export Excel (locataires, paiements, contrats)
│   │   ├── useFeatureFlag.ts      # Feature flags depuis Supabase
│   │   ├── useOfflineSync.ts      # Queue offline (sync, recovery stale, errorCount)
│   │   ├── usePlanLimits.ts       # Vérification limites plan
│   │   ├── useRetry.ts            # Exponential backoff générique
│   │   ├── useToast.ts            # Gestion des toasts
│   │   └── useTracking.ts         # Audit trail (audit_logs)
│   │
│   ├── lib/
│   │   ├── agencyHelper.ts        # Utilitaires : getCurrentAgencyId, reloadUserProfile
│   │   ├── errorMessages.ts       # Traduction erreurs Supabase → français
│   │   ├── formatters.ts          # formatCurrency (XOF/EUR/USD), formatDate, formatMonth
│   │   ├── pdf.ts                 # Générateurs PDF (contrat, quittance, mandat) + cache settings
│   │   ├── sentry.ts              # Initialisation Sentry
│   │   ├── supabase.ts            # Client Supabase singleton
│   │   └── templates/
│   │       ├── contrat.ts         # Template contrat de location
│   │       ├── helpers.ts         # Utilitaires templates
│   │       └── mandat.ts          # Template mandat de gérance
│   │
│   ├── repositories/
│   │   └── paiementsRepository.ts  # Accès BDD paiements (list, insert, update, softDelete…)
│   │
│   ├── services/
│   │   ├── db.ts                  # Wrapper IndexedDB (openDB, dbPut, dbGet, dbGetAll…)
│   │   ├── localBackup.ts         # Backup 7 tables, parsePreview, restoreFromFile, runFullBackup
│   │   ├── offlineQueue.ts        # Queue mutations offline (CREATE/UPDATE/DELETE, retry, recovery)
│   │   └── domain/
│   │       ├── commissionService.ts  # validateCommission, calculateCommission, isCommissionMissing
│   │       ├── contratService.ts     # validateContrat, isStatutTransitionValid, computeDateFin
│   │       └── paiementService.ts    # buildPaiementPayload, formatPaiementError
│   │
│   ├── pages/
│   │   ├── Abonnement.tsx         # Gestion plan/abonnement
│   │   ├── AcceptInvitation.tsx   # Acceptation invitation via token
│   │   ├── Agences.tsx            # CRUD agences (super-admin)
│   │   ├── Analyses.tsx           # Hub : Rapports financiers + Filtres avancés
│   │   ├── Auth.tsx               # Page connexion/inscription
│   │   ├── Bailleurs.tsx          # CRUD bailleurs + génération mandat PDF
│   │   ├── Calendrier.tsx         # Calendrier événements mensuel
│   │   ├── Commissions.tsx        # Rapport commissions (export PDF)
│   │   ├── Console.tsx            # Console super-admin (8 onglets)
│   │   ├── Contrats.tsx           # CRUD contrats + génération PDF
│   │   ├── Dashboard.tsx          # Tableau de bord (KPIs, graphiques)
│   │   ├── Depenses.tsx           # CRUD dépenses
│   │   ├── Documents.tsx          # GED : upload/téléchargement
│   │   ├── Encaissements.tsx      # Hub : Paiements reçus + Loyers impayés
│   │   ├── Equipe.tsx             # Gestion membres et invitations
│   │   ├── FiltresAvances.tsx     # Recherche multi-critères sur contrats
│   │   ├── Immeubles.tsx          # CRUD immeubles
│   │   ├── Interventions.tsx      # Kanban maintenance
│   │   ├── Inventaires.tsx        # États des lieux + export PDF
│   │   ├── LoyersImpayes.tsx      # Liste impayés + paiement rapide
│   │   ├── Locataires.tsx         # CRUD locataires (avec pagination)
│   │   ├── Notifications.tsx      # Centre de notifications
│   │   ├── Paiements.tsx          # CRUD paiements + KPIs + factures PDF
│   │   ├── Parametres.tsx         # Paramètres agence
│   │   ├── ParametresHub.tsx      # Hub : Agence + Équipe + Abonnement
│   │   ├── TableauDeBordFinancierGlobal.tsx  # 4 vues financières
│   │   ├── Unites.tsx             # CRUD unités
│   │   └── Welcome.tsx            # Onboarding (demande de création d'agence)
│   │
│   └── types/
│       ├── agency.ts              # AgencySettings + DEFAULT_AGENCY_SETTINGS
│       ├── database.ts            # UserProfile, Agency, AuditLog
│       ├── entities.ts            # Entités domaine (Bailleur, Immeuble, Unite…)
│       ├── forms.ts               # Types formulaires
│       ├── index.ts               # Re-exports centralisés
│       ├── jspdf-autotable.d.ts   # Augmentation type jsPDF
│       └── pdf.ts                 # ContratPDFData, PaiementPDFData, MandatPDFData
│
├── supabase/
│   └── migrations/                # ~45 fichiers SQL (appliquer dans l'ordre)
│       ├── _archive/              # Migrations obsolètes (ne pas rejouer)
│       └── *.sql
│
├── public/
│   └── templates/
│       ├── contrat_location.txt   # Template texte contrat (variables {{...}})
│       └── mandat_gerance.txt     # Template texte mandat
│
├── scripts/
│   ├── backup-supabase.sh         # Sauvegarde BDD (CI)
│   ├── extract-pdf.mjs            # Extraction PDFs → templates texte
│   ├── migrate-agency-id.mjs      # Migration one-shot (obsolète)
│   ├── seed-direct.mjs            # Seed données de test
│   ├── seed-test-data.mjs         # Seed données de test (variante SDK)
│   └── update-all-pages.mjs       # Transformation batch (obsolète)
│
├── tests/                         # Tests Playwright (configuré)
├── .github/
│   └── workflows/
│       ├── backup.yml             # Sauvegarde BDD quotidienne (2h UTC)
│       └── ci.yml                 # CI : typecheck + lint + build
├── .env.example                   # Variables d'environnement modèle
├── playwright.config.ts
├── tailwind.config.js
├── vite.config.ts
└── vercel.json
```

---

## 6. Rôles et permissions

Le système dispose de **5 rôles** définis via l'enum PostgreSQL `user_role` :

| Rôle | Contexte | Capacités |
|------|----------|-----------|
| `super_admin` | Propriétaire SaaS | Accès total à toutes les agences, console d'administration |
| `admin` | Admin d'agence | Accès complet à son agence : CRUD tout, gestion équipe, paramètres |
| `agent` | Agent immobilier | CRUD bailleurs, immeubles, unités, locataires, contrats, paiements, maintenance |
| `comptable` | Comptable | Lecture des finances ; pas d'écriture |
| `bailleur` | Compte bailleur individuel | Vue limitée à ses propres biens et paiements |

### Matrice d'accès

| Table | super_admin | admin | agent | comptable | bailleur |
|-------|-------------|-------|-------|-----------|---------|
| agencies | ALL | own | — | — | — |
| bailleurs | ALL | R/W/D | R/W | R | own |
| immeubles | ALL | R/W/D | R/W | R | own |
| unites | ALL | R/W/D | R/W | R | own |
| locataires | ALL | R/W/D | R/W | R | — |
| contrats | ALL | R/W/D | R/W | R | own |
| paiements | ALL | R/W/D | R/W | R | own |
| depenses | ALL | R/W/D | R/W | R | — |

---

## 7. Modèle multi-tenant

### Principe d'isolation

Chaque **agence** est un tenant isolé. Toutes les tables métier ont une colonne `agency_id` (UUID, FK). Les politiques RLS filtrent systématiquement par `agency_id = current_user_agency_id()`.

```
agencies (tenant root)
  └── user_profiles (membres)
  └── agency_settings (config)
  └── bailleurs
        └── immeubles
              └── unites
                    └── contrats
                          └── paiements
  └── locataires → contrats
  └── depenses / documents / interventions / inventaires / evenements
  └── notifications / subscriptions
```

### Cycle de vie d'une agence

```
1. Utilisateur s'inscrit (Auth Supabase)
   → Trigger crée user_profiles avec agency_id = NULL

2. Utilisateur remplit le formulaire Welcome
   → INSERT dans agency_creation_requests (status='pending')

3. super_admin approuve dans la Console
   → RPC approve_agency_request (SECURITY DEFINER)
   → Crée agence, agency_settings, subscription, rattache l'admin

4. OU: invitation d'un utilisateur
   → Admin crée une invitation (token UUID, 7j)
   → Invité clique le lien → RPC accept_invitation
```

### Plans d'abonnement

| Plan | Prix XOF/mois | Utilisateurs | Immeubles | Unités |
|------|---------------|--------------|-----------|--------|
| `basic` (Essai) | 0 | 1 | 3 | 10 |
| `pro` | 15 000 | 999 | 999 | 9 999 |
| `enterprise` | Sur devis | Illimité | Illimité | Illimité |

---

## 8. Base de données

### Tables principales

#### Infrastructure
| Table | Description |
|-------|-------------|
| `agencies` | Tenants SaaS |
| `user_profiles` | Extension auth.users avec rôle et agency_id |
| `agency_settings` | Configuration par agence |
| `subscription_plans` + `subscriptions` | Plans et abonnements |
| `invitations` | Tokens d'invitation (7j) |
| `agency_creation_requests` | Demandes onboarding |
| `notifications` | Notifications in-app (realtime) |
| `audit_logs` | Historique modifications (triggers) |
| `owner_actions_log` | Actions super-admin |
| `saas_config` | Configuration globale SaaS (key/value) |
| `feature_flags` | Feature flags globaux ou par agence |

#### Métier
| Table | Description |
|-------|-------------|
| `bailleurs` | Propriétaires |
| `immeubles` | Bâtiments |
| `unites` | Logements/locaux (libre/loue/maintenance) |
| `locataires` | Locataires |
| `contrats` | Contrats de location |
| `paiements` | Encaissements (part_agence / part_bailleur) |
| `depenses` | Dépenses d'exploitation |
| `revenus` | Revenus non-loyer |
| `documents` | GED |
| `inventaires` | États des lieux |
| `interventions` | Tickets maintenance |
| `evenements` | Calendrier |

### Fonctions SQL

| Fonction | Type | Rôle |
|----------|------|------|
| `handle_new_user()` | Trigger SECURITY DEFINER | Auto-création user_profiles à l'inscription |
| `current_user_agency_id()` | SQL SECURITY DEFINER | Retourne l'agency_id sans récursion RLS |
| `is_super_admin()` / `is_admin()` | SQL SECURITY DEFINER | Tests de rôle pour les policies |
| `check_plan_limits(agency_id)` | PL/pgSQL SECURITY DEFINER | Vérifie les quotas du plan |
| `accept_invitation(token)` | PL/pgSQL SECURITY DEFINER | Accepte une invitation |
| `get_invitation_by_token(token)` | PL/pgSQL SECURITY DEFINER | Lecture invitation pré-auth |
| `approve_agency_request(id)` | PL/pgSQL SECURITY DEFINER | Crée l'agence complète |
| `reject_agency_request(id, reason)` | PL/pgSQL SECURITY DEFINER | Rejette avec motif |
| `get_dashboard_stats(agency_id, month)` | PL/pgSQL SECURITY DEFINER | Agrégats dashboard (1 requête SQL) |
| `get_monthly_revenue(agency_id, year)` | PL/pgSQL SECURITY DEFINER | Revenus mensuels serveur |
| `log_table_changes()` | Trigger SECURITY DEFINER | Alimente audit_logs |
| `cleanup_expired_invitations()` | PL/pgSQL SECURITY DEFINER | Expire les invitations |

### Storage Buckets

| Bucket | Public | Contenu |
|--------|--------|---------|
| `agency-assets` | Oui (URLs publiques) | Logos d'agence (max 5 Mo) |
| `documents` | Non | GED (contrats, pièces jointes) |

---

## 9. Frontend et navigation

### Routing

Routing par **état React** (pas de React Router). La variable `currentPage` dans `App.tsx` contrôle la page rendue. Chaque page est chargée en **lazy load** via `React.lazy()`.

URLs supportées par compatibilité ascendante :
- `#/paiements` → Encaissements (onglet paiements)
- `#/loyers-impayes` → Encaissements (onglet impayés)
- `#/tableau-de-bord-financier` → Analyses (onglet rapports)
- `#/filtres-avances` → Analyses (onglet filtres)
- `#/equipe`, `#/abonnement` → ParametresHub

### Information architecture (barre latérale)

```
🏠 Tableau de bord
💰 Finances ▾         Encaissements · Dépenses · Commissions · Analyses
👥 Locations ▾        Locataires · Contrats
🏢 Patrimoine ▾       Bailleurs · Immeubles · Produits
🛠 Activité ▾         Calendrier · Maintenance · États des lieux · Documents
⚙  Paramètres         (tabbed : Mon agence | Équipe | Abonnement)
```

### Design system

| Composant | Description |
|-----------|-------------|
| `Button.tsx` | Variants: primary (gradient orange→rouge), secondary, ghost, danger, success |
| `Modal.tsx` | Bottom-sheet sur mobile, dialog centré sur desktop |
| `Table.tsx` | Cards mobiles (`<sm`) + table desktop (`sm+`) |
| `BottomNav.tsx` | Navigation bas de page mobile (4 items + Plus) |
| `NetworkBanner.tsx` | 4 états : offline (rouge), erreurs sync (orange), en sync (bleu), reconnecté (vert) |
| `BackupIndicator.tsx` | Badge flottant : aperçu restauration, merge/overwrite, téléchargement |
| `Skeleton.tsx` | SkeletonCards, SkeletonTable |
| `Tabs.tsx` | Onglets avec badges + active underline |

---

## 10. Backend, API et sécurité

### Politiques RLS

1. **Isolation tenant** : toutes les tables filtrent sur `agency_id = current_user_agency_id()`
2. **Pas de récursion** : `current_user_agency_id()` est SECURITY DEFINER
3. **Escalade** : le super_admin bypass via `is_super_admin()`
4. **Opérations critiques** : toujours via RPC SECURITY DEFINER

### Points de sécurité

- Tokens d'invitation : UUID v4, expiration 7 jours
- Le rôle `super_admin` ne peut pas être attribué via les invitations (CHECK constraint)
- Fonctions SQL : `SET search_path = public, pg_temp` (anti schema-hijacking)
- Policy `"Invitations readable by token"` remplacée : le flux anon passe par `get_invitation_by_token` (sortie sanitisée)
- Policies `WITH CHECK (true)` supprimées (`agency_settings`, `audit_logs`)
- Bucket `agency-assets` : LIST restreint par tenant

---

## 11. Offline-first et synchronisation

### Architecture

L'application fonctionne intégralement hors ligne. Les opérations de création, modification et suppression sont mises en file d'attente dans IndexedDB (`pending_mutations`) et synchronisées automatiquement au retour de connexion.

### Stores IndexedDB

| Store | Rôle |
|-------|------|
| `snapshots` | Backups JSON des 7 tables critiques |
| `pending_mutations` | Queue des opérations en attente (autoIncrement, index status) |

### Actions supportées dans la queue

- `paiement_create` / `paiement_update`
- `locataire_create` / `locataire_update`
- `contrat_create` / `contrat_update`
- `*_delete` (soft delete avec `deleted_at`)

### Stratégie de sync

- **Retry** : 3 tentatives max par mutation (backoff exponentiel via `useRetry`)
- **Recovery** : `recoverStaleSyncing()` récupère les mutations coincées en état `syncing` au démarrage de l'app (redémarrage brutal, crash)
- **Résultat** : `SyncResult { synced, errors, errorMessages }` exposé via `useOfflineSync`

### Hooks

| Hook | API exposée |
|------|-------------|
| `useOfflineSync` | `{ isOnline, pendingCount, syncing, errorCount, lastSyncResult, queueMutation, syncNow }` |
| `useBackup` | `{ save, download, preview, restore, isDailyBackupDue, saving, lastBackupTime }` |
| `useRetry` | `retry(fn, { maxAttempts, baseDelay })` — exponential backoff |

### Indicateurs UI

- **NetworkBanner** : offline rouge (count pending), erreurs sync orange, en sync bleu, reconnecté vert
- **BackupIndicator** : badge flottant bas-droit avec état, panel expandable, aperçu restauration

---

## 12. Backup et restauration

### Backup automatique

Au démarrage de l'app (après authentification), si la dernière sauvegarde date de plus de 24h et que la connexion est disponible, `runFullBackup(agencyId)` est déclenché silencieusement. Il charge les 7 tables depuis Supabase et les sauvegarde dans IndexedDB.

**Tables sauvegardées** : `agences`, `bailleurs`, `immeubles`, `unites`, `locataires`, `contrats`, `paiements`

### Backup manuel

Via le **BackupIndicator** (badge bas-droit) → "Télécharger une sauvegarde" : génère un fichier `samay-keur-backup-YYYY-MM-DD.json`.

### Format du fichier backup

```json
{
  "version": 1,
  "exported_at": "2026-05-02T13:00:00.000Z",
  "agency_id": "uuid",
  "tables": ["agences", "bailleurs", ...],
  "counts": { "agences": 1, "bailleurs": 5, ... },
  "data": { "agences": [...], "bailleurs": [...], ... },
  "pending_mutations": [...]
}
```

### Restauration

1. Cliquer "Restaurer une sauvegarde" → sélection fichier `.json`
2. **Aperçu automatique** : date d'export, nombre d'entrées par table, alerte si mutations hors-ligne présentes
3. Choisir la stratégie :
   - **Fusionner** (recommandé) : conserve les données actuelles, ajoute/met à jour ce qui est dans le fichier
   - **Remplacer** : écrase entièrement les données locales
4. Confirmer → rechargement automatique de l'app

---

## 13. Logique métier (services domaine)

Toute la logique métier est isolée dans `src/services/domain/` — **jamais dans les composants React**.

### commissionService.ts

```typescript
validateCommission(commission: number | null): void
// Lance CommissionRequiredError si commission null ou 0
// Aucun fallback silencieux — le contrat DOIT avoir une commission configurée

calculateCommission(montantTotal: number, commission: number): { partAgence, partBailleur }

isCommissionMissing(commission: number | null | undefined): boolean
// Utilisé dans le formulaire Paiements pour afficher l'avertissement UI
```

### paiementService.ts

```typescript
buildPaiementPayload(input, contrat, agencyId): PaiementInsert
// Calcule part_agence et part_bailleur via commissionService
// Lance CommissionRequiredError si commission absente

formatPaiementError(err: unknown): string
// Type-safe : gère CommissionRequiredError, PaiementValidationError, Error, unknown
```

### contratService.ts

```typescript
validateContrat(contrat): void          // Valide les champs requis
isStatutTransitionValid(from, to): bool // Vérifie la légalité des transitions de statut
computeDateFin(dateDebut, dureeMois): string
isContratExpire(dateFin): boolean
formatContratError(err: unknown): string
```

### paiementsRepository.ts

```typescript
paiementsRepository.list(agencyId, { from, to })          // Pagination serveur
paiementsRepository.listActiveContrats(agencyId)
paiementsRepository.findForPDF(agencyId, paiementId)
paiementsRepository.insert(payload)
paiementsRepository.update(id, payload)
paiementsRepository.softDelete(id)    // deleted_at + actif = false
paiementsRepository.hardDelete(id)    // Purge administrative uniquement
```

---

## 14. Fonctionnalités implémentées

### Gestion immobilière (core)
- [x] CRUD complet : Bailleurs, Immeubles, Unités, Locataires
- [x] CRUD Contrats avec commission **obligatoire** (CommissionRequiredError si absente)
- [x] Statut des unités : libre / loué / maintenance
- [x] Soft delete sur toutes les entités (`actif`, `deleted_at`)

### Encaissements et finances
- [x] Enregistrement paiements avec décomposition `part_agence` / `part_bailleur` (via commissionService)
- [x] Avertissement UI si la commission n'est pas configurée sur le contrat sélectionné
- [x] Recherche explicite (nom/prénom locataire, unité, référence, mois, mode, statut) — pas de JSON.stringify
- [x] KPIs temps réel : encaissé ce mois, mois précédent, en attente, taux de recouvrement
- [x] Détection automatique des loyers impayés (6 derniers mois)
- [x] Gestion des dépenses par catégorie et immeuble
- [x] Rapport commissions avec graphiques et export PDF
- [x] Filtres avancés multi-critères sur contrats + export Excel

### Documents PDF
- [x] Génération contrat de location (paramètres agence, variables dynamiques)
- [x] Génération mandat de gérance
- [x] Génération quittance/facture avec numérotation unique (`QIT-AAAAMM-{id}{rand}`)
- [x] Cache paramètres agence pour les PDF (TTL 5 min, invalidation manuelle)

### Offline-first
- [x] Queue de mutations IndexedDB (CREATE / UPDATE / DELETE)
- [x] Synchronisation automatique au retour de connexion
- [x] Retry 3 tentatives max (backoff)
- [x] Recovery des mutations bloquées en "syncing" au démarrage
- [x] Feedback UI complet (NetworkBanner 4 états, BackupIndicator)

### Backup
- [x] Backup automatique quotidien depuis Supabase (7 tables)
- [x] Téléchargement manuel en JSON
- [x] Aperçu avant restauration (comptage par table, date export, alerte mutations)
- [x] Restauration merge ou overwrite

### Dashboard et analyses
- [x] KPIs agrégés : bailleurs, immeubles, unités, locataires, contrats actifs, revenus mois
- [x] Bilan mensuel agence (loyers, commissions, dépenses, solde)
- [x] Graphiques recharts (bar, pie, line)
- [x] Migration SQL prête : `get_dashboard_stats` et `get_monthly_revenue` (1 requête au lieu de 8+)

### Paramètres agence
- [x] Informations générales (NINEA, RC, représentant)
- [x] Upload logo (bucket `agency-assets`)
- [x] Mentions légales personnalisables
- [x] Couleurs et positionnement logo dans les documents

### Équipe et invitation
- [x] Liste des membres, invitation par lien (token 7j)
- [x] Acceptation invitation (flux complet pré/post-auth)
- [x] Désactivation soft d'un membre

### Abonnement
- [x] Plan actuel, statut, période d'essai countdown
- [x] Barres de progression utilisation
- [x] Modal upgrade (contact WhatsApp/email)

### Modules additionnels
- [x] États des lieux + export PDF
- [x] Interventions/maintenance (kanban)
- [x] Calendrier événements (vue mensuelle)
- [x] GED Documents (upload Storage, téléchargement signé)
- [x] Notifications in-app (realtime Supabase)
- [x] Feature flags par agence

### Console super-admin
- [x] KPIs SaaS globaux
- [x] Gestion agences (suspendre, réactiver, changer plan, supprimer)
- [x] Gestion demandes de création (approbation/rejet avec motif)
- [x] Gestion utilisateurs globaux
- [x] Journal des actions (`owner_actions_log`)
- [x] Panel support (broadcast notification)

### CI/CD et monitoring
- [x] GitHub Actions CI (typecheck + lint + build)
- [x] Sauvegarde BDD quotidienne (2h UTC, rétention 30j)
- [x] Monitoring Sentry

---

## 15. Fonctionnalités partiellement implémentées

### QR code sur les quittances
Le paramètre `qr_code_quittances` existe dans `agency_settings` mais le code de génération QR dans les PDF n'est pas branché.

### Bilans mensuels automatiques
La table `bilans_mensuels` existe mais n'est pas alimentée automatiquement. Les bilans sont calculés à la volée dans `TableauDeBordFinancierGlobal.tsx`.

### Mobile Money
Les paramètres Wave, Orange Money et Free Money existent dans `agency_settings` mais aucune intégration de paiement n'est implémentée.

### Notifications automatiques métier
La table et le realtime sont en place, mais pas de rappels automatiques (impayés, échéances contrat).

### Plan limits enforcement
La vérification `usePlanLimits` est implémentée sur Immeubles et Unités mais pas sur toutes les entités.

### Dashboard RPC
La migration SQL `get_dashboard_stats` / `get_monthly_revenue` est écrite et prête. Le Dashboard utilise encore les 8 requêtes parallèles côté client — **à migrer** après `supabase db push` de la migration `20260502000001`.

---

## 16. Fonctionnalités manquantes ou incomplètes

- **Paiement en ligne** (Stripe, Wave Business) — modal de contact uniquement
- **QR code quittances** — paramètre présent, génération absente
- **Envoi email/SMS automatique** (rappels, quittances, notifications échéance)
- **Portail locataire** — pas d'accès locataire à ses quittances/contrats
- **Signature électronique** des contrats et mandats
- **Export comptable** (FEC, logiciel comptable)
- **Application mobile native** — web responsive uniquement
- **Gestion des feature flags** depuis la console UI (table présente, pas d'UI)

---

## 17. Bugs connus et points de vigilance

### Critiques

1. **Récursion RLS sur `user_profiles`** — Historiquement présent, corrigé par `current_user_agency_id()` (SECURITY DEFINER). Ne pas recréer de policies manuelles sans utiliser cette fonction.

2. **Doublons de policies** — Visibles dans `_archive/`. Sur une BDD neuve, appliquer les migrations dans l'ordre résout tout.

### Importants

3. **State-based routing sans history API** — Pas de support URLs directes ni bouton retour navigateur. Une migration vers React Router est envisageable.

4. **Cache PDF non invalidé automatiquement** — `settingsCache` a un TTL 5 min. Appeler `invalidateAgencySettingsCache(agencyId)` après sauvegarde des paramètres.

5. **`bilans_mensuels` jamais alimentée** — Ne pas se fier à cette table pour des rapports.

6. **Template PDF vides** — Si `agency_settings` n'est pas renseigné, les `{{...}}` produisent des chaînes vides.

### Vigilance

7. **Race condition Calendrier/Contrats** — Gérée par `requestIdRef`. Reproduire ce pattern dans toute nouvelle page avec rechargement fréquent.

8. **`localStorage` dans QuickStart** — Utilisé pour persister "dismissed". Pas un problème dans l'app principale.

---

## 18. Variables d'environnement

```env
# Obligatoires
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...

# Optionnels — scripts de seed et backup CI
SUPABASE_SERVICE_ROLE_KEY=eyJ...     # Bypass RLS (ne jamais exposer côté client)
SUPABASE_PROJECT_ID=<project-ref>

# Optionnels — monitoring Sentry
VITE_SENTRY_DSN=https://...@sentry.io/...
SENTRY_ORG=your-org-slug
SENTRY_PROJECT=your-project-slug
SENTRY_AUTH_TOKEN=...

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

> **Sur Replit** : configurer via le panneau **Secrets** (icône cadenas). Ne jamais commiter `.env`.

---

## 19. Installation locale

### Prérequis

- Node.js ≥ 18
- npm ≥ 9
- Un projet Supabase actif

### Étapes

```bash
# 1. Cloner le dépôt
git clone <url-du-repo>
cd samay-keur

# 2. Installer les dépendances
npm install

# 3. Configurer l'environnement
cp .env.example .env
# Éditer .env avec vos credentials Supabase

# 4. Appliquer les migrations (si nouvelle BDD)
supabase db push
# OU exécuter chaque fichier supabase/migrations/*.sql dans l'ordre alphabétique
# ⚠️ Ne pas jouer les fichiers de _archive/

# 5. Créer le premier super_admin
# Dans le SQL Editor Supabase, après création d'un compte Auth :
UPDATE user_profiles SET role = 'super_admin' WHERE email = 'votre@email.com';

# 6. Lancer l'application
npm run dev
```

L'application est disponible sur [http://localhost:5000](http://localhost:5000).

---

## 20. Lancement du projet

```bash
npm run dev          # Développement (hot reload, port 5000)
npm run build        # Build production
npm run preview      # Preview du build prod
npm run typecheck    # Vérification TypeScript (0 erreur)
npm run lint         # ESLint
```

---

## 21. Scripts disponibles

| Script | Commande | Description |
|--------|----------|-------------|
| Dev server | `npm run dev` | Vite dev server (port 5000, HMR) |
| Build | `npm run build` | Build production dans `dist/` |
| Preview | `npm run preview` | Serveur statique du build prod |
| TypeCheck | `npm run typecheck` | `tsc --noEmit` |
| Lint | `npm run lint` | ESLint sur les fichiers src |
| Tests E2E | `npm run test` | Playwright (headless) |
| Seed | `npm run seed` | Seed données de test (nécessite `SERVICE_ROLE_KEY`) |

---

## 22. Déploiement

### Vercel (recommandé)

```bash
vercel
# Build command : npm run build
# Output directory : dist/
```

Variables à configurer dans Vercel :
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_ENV=production`, `VITE_SENTRY_DSN`

### Replit

Workflow `Start application` → `npm run dev` (port 5000). Pour la production :
- Build : `npm run build`
- Run : `npm run preview`
- Deployment target : `static` / Public directory : `dist/`

### Après déploiement — migration BDD

Si vous venez de merger des migrations SQL :

```bash
supabase db push
```

La migration `20260502000001_add_dashboard_stats_rpc.sql` ajoute les RPCs `get_dashboard_stats` et `get_monthly_revenue`. Elle est idempotente (`CREATE OR REPLACE FUNCTION`).

---

## 23. Tests

### Configuration Playwright

```typescript
{
  testDir: './tests',
  baseURL: 'http://localhost:5000',
  projects: ['chromium', 'firefox', 'webkit', 'Mobile Chrome', 'Mobile Safari']
}
```

### Convention `data-testid`

- `button-{action}-{context}` → ex : `button-approve-<id>`
- `input-{champ}` → ex : `input-invite-email`
- `select-{champ}` → ex : `select-invite-role`
- `filter-{champ}` → ex : `filter-statut`
- `row-{entité}-{id}` → ex : `row-request-<uuid>`

---

## 24. Bonnes pratiques de contribution

### Conventions de code

- **TypeScript strict** : `strict: true`, `noUnusedLocals`, `noUnusedParameters`
- **Formatters** : importer depuis `src/lib/formatters.ts` uniquement
- **Toasts** : `useToast()` uniquement, pas de `alert()`
- **Erreurs Supabase** : `translateSupabaseError()` de `src/lib/errorMessages.ts`
- **Agency ID** : toujours filtrer par `agency_id` dans toutes les requêtes
- **Logique métier** : dans `src/services/domain/`, jamais dans les composants React
- **Accès BDD** : via `src/repositories/`, pas directement dans les pages
- **Race conditions** : pattern `requestIdRef` (voir `Calendrier.tsx`, `Contrats.tsx`)

### Pattern d'une nouvelle page

```tsx
// 1. Hooks standard
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/useToast';
import { useBackup } from '../hooks/useBackup';

// 2. Guard agency_id
useEffect(() => {
  if (profile?.agency_id) loadData();
}, [profile?.agency_id]);

// 3. Toutes les requêtes filtrées par agency_id
const { data } = await supabase
  .from('ma_table')
  .select('*')
  .eq('agency_id', profile.agency_id);

// 4. agency_id dans tous les INSERTs
await supabase.from('ma_table').insert({ ...data, agency_id: profile.agency_id });

// 5. Backup après loadData
save('ma_table', data);
```

### Nouvelles migrations SQL

1. Nommer : `YYYYMMDDHHMMSS_description.sql`
2. Rendre **idempotente** (`IF NOT EXISTS`, `ON CONFLICT DO NOTHING`, `CREATE OR REPLACE`)
3. Fonctions SECURITY DEFINER : toujours `SET search_path = public, pg_temp`
4. Vérification multi-tenant dans les fonctions : `EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND agency_id = p_agency_id)`
5. Commenter l'objectif en tête de fichier

---

## 25. FAQ technique

**Q : Comment créer le premier compte super_admin ?**

```sql
UPDATE user_profiles SET role = 'super_admin' WHERE email = 'admin@example.com';
```
Le rôle ne peut pas être attribué via les invitations (CHECK constraint intentionnel).

---

**Q : Comment déboguer un problème RLS "row violates policy" ?**

```sql
SELECT id, role, agency_id FROM user_profiles WHERE email = 'user@example.com';
```

---

**Q : Comment invalider le cache PDF des paramètres agence ?**

```typescript
import { invalidateAgencySettingsCache } from '../lib/pdf';
invalidateAgencySettingsCache(profile.agency_id); // après sauvegarde paramètres
```

---

**Q : Comment ajouter un nouveau module (ex : "Sinistres") ?**

1. Créer la table avec `agency_id` et RLS dans une nouvelle migration
2. Créer `src/services/domain/sinistreService.ts` (logique métier)
3. Créer `src/repositories/sinistresRepository.ts` (accès BDD)
4. Créer `src/pages/Sinistres.tsx` (UI)
5. Ajouter dans `Sidebar.tsx` (rôles autorisés)
6. Ajouter dans `App.tsx` (`renderPage()` + lazy import)

---

**Q : Pourquoi le routing ne supporte pas les URLs directes ?**

L'app utilise un routing par état React sans React Router — limitation connue. Le bouton retour et les liens directs vers une sous-page ne fonctionnent pas. Migration vers React Router ou TanStack Router envisageable.

---

**Q : La commission est obligatoire — que faire si un ancien contrat n'en a pas ?**

Mettre à jour le contrat en y ajoutant le taux de commission depuis la fiche contrat. Le formulaire de paiement affiche un avertissement orange dès qu'un contrat sans commission est sélectionné. L'enregistrement sera bloqué par `CommissionRequiredError` si la commission est nulle ou zéro.

---

**Q : Comment appliquer la migration dashboard RPC ?**

```bash
supabase db push
# ou via le SQL Editor Supabase :
# copier-coller supabase/migrations/20260502000001_add_dashboard_stats_rpc.sql
```
Ensuite, dans `Dashboard.tsx`, remplacer les 8 requêtes parallèles par :
```typescript
const { data } = await supabase.rpc('get_dashboard_stats', {
  p_agency_id: agencyId,
  p_year_month: new Date().toISOString().slice(0, 7),
});
```

---

**Q : Où trouver les logs d'actions de la console super-admin ?**

Table `owner_actions_log`. Accessible depuis Console → onglet "Audit".

---

**Q : Comment tester en local sans super_admin ?**

```sql
UPDATE user_profiles
SET agency_id = '<agency-uuid>', role = 'admin'
WHERE id = '<user-uuid>';
```

---

*README mis à jour — mai 2026. Reflète fidèlement l'état du code source.*
