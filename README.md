# Samay Këur — Plateforme SaaS de Gestion Locative

> **Application web multi-tenant de gestion immobilière pour agences et bailleurs. Conçue initialement pour le marché sénégalais, mais généralisable à tout contexte francophone de gestion locative.**

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
11. [Fonctionnalités implémentées](#11-fonctionnalités-implémentées)
12. [Fonctionnalités partiellement implémentées](#12-fonctionnalités-partiellement-implémentées)
13. [Fonctionnalités manquantes ou incomplètes](#13-fonctionnalités-manquantes-ou-incomplètes)
14. [Bugs connus et points de vigilance](#14-bugs-connus-et-points-de-vigilance)
15. [Variables d'environnement](#15-variables-denvironnement)
16. [Installation locale](#16-installation-locale)
17. [Lancement du projet](#17-lancement-du-projet)
18. [Scripts disponibles](#18-scripts-disponibles)
19. [Déploiement](#19-déploiement)
20. [Tests](#20-tests)
21. [Bonnes pratiques de contribution](#21-bonnes-pratiques-de-contribution)
22. [FAQ technique](#22-faq-technique)

---

## 1. Présentation du produit

**Samay Këur** (« mes maisons » en wolof) est une plateforme SaaS de gestion locative immobilière. Elle cible les agences immobilières et les bailleurs individuels souhaitant gérer leurs propriétés, locataires, contrats et encaissements depuis une interface web unique.

### Ce que fait l'application

- Gérer un parc immobilier : bailleurs → immeubles → unités (appartements, locaux, studios…)
- Gérer le cycle locatif complet : locataires → contrats → paiements → quittances PDF
- Suivre les impayés, les commissions d'agence et les dépenses d'exploitation
- Générer des documents légaux PDF : contrats de location, mandats de gérance, quittances
- Administrer plusieurs agences indépendantes depuis une console super-admin (SaaS proprietaire)
- Gérer une équipe avec des rôles différenciés (admin, agent, comptable, bailleur)
- Tracker les états des lieux, interventions de maintenance et événements calendrier
- Stocker des documents associés aux biens (GED légère)

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

- **Bailleur** : propriétaire du bien. Dispose d'un taux de commission défini.
- **Immeuble** : bâtiment rattaché à un bailleur.
- **Unité** (`unites`) : appartement, studio, bureau ou commerce au sein d'un immeuble. Statut : `libre`, `loue`, `maintenance`.
- **Locataire** : personne qui occupe une unité via un contrat.
- **Contrat** : lien entre locataire et unité, avec loyer mensuel, caution, taux de commission et destination (Habitation/Commercial).
- **Paiement** : encaissement mensuel. Décomposé automatiquement en `part_agence` et `part_bailleur`.
- **Dépense** : frais d'exploitation de l'agence (eau, électricité, salaires, entretien…).

### Spécificité marché sénégalais

- Devise par défaut : **XOF (Franc CFA)**
- Montants sans décimales dans l'affichage courant
- Formats de documents (contrats, mandats) conformes aux usages locaux
- Coordonnées : numéros +221, NINEA (numéro d'identification fiscal sénégalais)
- Références au Tribunal de Dakar dans les mentions légales

---

## 3. Architecture générale

```
┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND                             │
│  React 18 + Vite 5 + TypeScript + Tailwind CSS             │
│                                                             │
│  Single Page Application (state-based routing)             │
│  Lazy loading par page, Suspense + Code Splitting          │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTPS / REST + WebSocket (realtime)
┌──────────────────────────▼──────────────────────────────────┐
│                       SUPABASE                              │
│                                                             │
│  ┌─────────────┐  ┌──────────┐  ┌───────────┐  ┌────────┐ │
│  │  PostgreSQL │  │   Auth   │  │  Storage  │  │  Edge  │ │
│  │  + RLS      │  │  (JWT)   │  │  Buckets  │  │  Func  │ │
│  └─────────────┘  └──────────┘  └───────────┘  └────────┘ │
└─────────────────────────────────────────────────────────────┘
```

L'application est un **frontend-heavy SPA** : toute la logique métier (calcul des parts, validation, filtrage) est exécutée côté client. Supabase assure la persistance, l'authentification JWT, le stockage de fichiers et les politiques de sécurité (Row Level Security).

Il n'y a **pas de backend custom** (pas de serveur Node/Express/API maison). Les seules logiques serveur sont :
- Les **fonctions SQL** Supabase (SECURITY DEFINER) pour les opérations critiques (approbation d'agence, acceptation d'invitation, vérification des limites de plan)
- Les **triggers PostgreSQL** (création automatique de `user_profiles` et `agency_settings`)
- Les **politiques RLS** pour l'isolation multi-tenant

---

## 4. Stack technique

### Frontend

| Technologie | Version | Rôle |
|-------------|---------|------|
| React | 18.x | Framework UI |
| Vite | 5.x | Bundler et dev server |
| TypeScript | 5.x | Typage statique |
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
| SECURITY DEFINER Functions | Opérations privilégiées (approbation, invitation) |
| PostgreSQL Triggers | Auto-création de profils et settings |

### CI/CD et outillage

| Outil | Rôle |
|-------|------|
| GitHub Actions | CI (typecheck, lint, build) + sauvegarde BDD quotidienne |
| Playwright | Tests E2E (configuré, non exhaustifs) |
| ESLint | Linting TypeScript/React |
| Vercel | Déploiement statique (configuration présente) |
| Replit | Environnement de développement cloud (`.replit` configuré) |

---

## 5. Structure des dossiers

```
samay-keur/
├── src/
│   ├── App.tsx                    # Router principal (state-based, pas React Router)
│   ├── main.tsx                   # Point d'entrée, initialisation Sentry
│   ├── index.css                  # Animations Tailwind custom
│   │
│   ├── components/
│   │   ├── auth/
│   │   │   └── LoginForm.tsx      # Formulaire de connexion stylisé (composant alternatif)
│   │   ├── console/
│   │   │   ├── AgencyRequestsPanel.tsx  # Panel demandes agence (super-admin)
│   │   │   └── ConsoleModals.tsx        # Modales CRUD de la console propriétaire
│   │   ├── layout/
│   │   │   └── Sidebar.tsx        # Navigation latérale (responsive, groupes pliables)
│   │   └── ui/
│   │       ├── Button.tsx         # Bouton réutilisable (variants, tailles, loading)
│   │       ├── ConfirmModal.tsx   # Modal de confirmation (destructive/warning/info)
│   │       ├── EmptyState.tsx     # État vide générique
│   │       ├── MaintenanceBanner.tsx  # Bannière maintenance (saas_config)
│   │       ├── Modal.tsx          # Modal générique
│   │       ├── NotificationBell.tsx   # Cloche notifications (realtime)
│   │       ├── PlanGate.tsx       # Composant de blocage selon le plan
│   │       ├── QuickStart.tsx     # Guide de démarrage pour nouveaux utilisateurs
│   │       ├── SetupWizard.tsx    # Assistant de configuration initiale (6 étapes)
│   │       ├── Skeleton.tsx       # Squelettes de chargement (cards, table)
│   │       ├── Table.tsx          # Tableau générique (colonnes configurables)
│   │       ├── Tabs.tsx           # Onglets réutilisables
│   │       ├── Toast.tsx          # Notifications toast (success/error/warning)
│   │       └── TrialBanner.tsx    # Bannière période d'essai (countdown)
│   │
│   ├── contexts/
│   │   └── AuthContext.tsx        # Context Auth : user, profile, signIn, signUp, signOut
│   │
│   ├── hooks/
│   │   ├── useErrorReporting.ts   # Intégration Sentry
│   │   ├── useFeatureFlag.ts      # Feature flags depuis supabase (feature_flags table)
│   │   ├── usePlanLimits.ts       # Vérification limites plan (RPC check_plan_limits)
│   │   └── useToast.ts            # Gestion des toasts
│   │
│   ├── lib/
│   │   ├── agencyHelper.ts        # Utilitaires : getCurrentAgencyId, reloadUserProfile
│   │   ├── errorMessages.ts       # Traduction erreurs Supabase → français
│   │   ├── formatters.ts          # formatCurrency (XOF/EUR/USD), formatDate, formatMonth
│   │   ├── pdf.ts                 # Générateurs PDF : contrat, quittance, mandat
│   │   ├── sentry.ts              # Initialisation Sentry
│   │   ├── supabase.ts            # Client Supabase + types UserProfile
│   │   └── templates/
│   │       ├── contrat.ts         # Template contrat de location (texte)
│   │       ├── helpers.ts         # Utilitaires templates : getAgencySettings, formatters
│   │       └── mandat.ts          # Template mandat de gérance (texte)
│   │
│   ├── pages/
│   │   ├── Abonnement.tsx         # Gestion plan/abonnement
│   │   ├── AcceptInvitation.tsx   # Acceptation invitation via token
│   │   ├── Agences.tsx            # CRUD agences (super-admin, vue legacy)
│   │   ├── Analyses.tsx           # Hub : Rapports financiers + Filtres avancés
│   │   ├── Auth.tsx               # Page connexion/inscription
│   │   ├── Bailleurs.tsx          # CRUD bailleurs + génération mandat PDF
│   │   ├── Calendrier.tsx         # Calendrier événements mensuel
│   │   ├── Commissions.tsx        # Rapport commissions agence (export PDF)
│   │   ├── Console.tsx            # Console super-admin (8 onglets)
│   │   ├── Contrats.tsx           # CRUD contrats + génération PDF
│   │   ├── Dashboard.tsx          # Tableau de bord (KPIs, graphiques)
│   │   ├── Depenses.tsx           # CRUD dépenses
│   │   ├── Documents.tsx          # GED : upload/téléchargement documents
│   │   ├── Encaissements.tsx      # Hub : Paiements reçus + Loyers impayés
│   │   ├── Equipe.tsx             # Gestion membres et invitations
│   │   ├── FiltresAvances.tsx     # Recherche multi-critères sur contrats
│   │   ├── Immeubles.tsx          # CRUD immeubles
│   │   ├── Interventions.tsx      # Kanban maintenance (à faire / en cours / terminé)
│   │   ├── Inventaires.tsx        # États des lieux + export PDF
│   │   ├── LoyersImpayes.tsx      # Liste impayés + action paiement rapide
│   │   ├── Locataires.tsx         # CRUD locataires
│   │   ├── Notifications.tsx      # Centre de notifications
│   │   ├── Paiements.tsx          # CRUD paiements + KPIs encaissement + factures PDF
│   │   ├── Parametres.tsx         # Paramètres agence (3 onglets : général/docs/apparence)
│   │   ├── ParametresHub.tsx      # Hub : Agence + Équipe + Abonnement
│   │   ├── TableauDeBordFinancierGlobal.tsx  # 4 vues financières agrégées
│   │   ├── Unites.tsx             # CRUD unités
│   │   └── Welcome.tsx            # Onboarding : formulaire de demande de création d'agence
│   │
│   └── types/
│       ├── agency.ts              # AgencySettings (type complet + DEFAULT_AGENCY_SETTINGS)
│       ├── database.ts            # UserProfile, Agency, AuditLog
│       ├── entities.ts            # Bailleur, Immeuble, Unite, Locataire, Contrat, Paiement…
│       ├── forms.ts               # Types formulaires (Omit des champs DB auto)
│       ├── index.ts               # Re-exports centralisés
│       ├── jspdf-autotable.d.ts   # Augmentation type jsPDF
│       └── pdf.ts                 # ContratPDFData, PaiementPDFData, MandatPDFData
│
├── supabase/
│   └── migrations/                # ~40 fichiers SQL migrés (voir section BDD)
│       ├── _archive/              # Migrations obsolètes conservées pour historique
│       └── *.sql
│
├── public/
│   └── templates/
│       ├── contrat_location.txt   # Template texte contrat (variables {{...}})
│       └── mandat_gerance.txt     # Template texte mandat (variables {{...}})
│
├── scripts/
│   ├── backup-supabase.sh         # Script de sauvegarde BDD (utilisé par CI)
│   ├── extract-pdf.mjs            # Extraction de PDFs bruts en templates texte
│   ├── migrate-agency-id.mjs      # Script migration agency_id (one-shot)
│   ├── seed-direct.mjs            # Seed données de test (méthode directe)
│   ├── seed-test-data.mjs         # Seed données de test (méthode via SDK)
│   └── update-all-pages.mjs       # Script transformation batch des pages
│
├── tests/                         # Tests Playwright (répertoire configuré)
├── .github/
│   └── workflows/
│       ├── backup.yml             # Sauvegarde BDD quotidienne (2h UTC)
│       └── ci.yml                 # CI : typecheck + lint + build
├── .env.example                   # Variables d'environnement (voir section dédiée)
├── playwright.config.ts           # Config Playwright
├── tailwind.config.js             # Config Tailwind (couleurs custom Samay Këur)
├── vite.config.ts                 # Config Vite (Sentry, port 5000, SPA)
└── vercel.json                    # Config déploiement Vercel (SPA fallback)
```

---

## 6. Rôles et permissions

Le système dispose de **5 rôles** définis via l'enum PostgreSQL `user_role` :

| Rôle | Contexte | Capacités |
|------|----------|-----------|
| `super_admin` | Propriétaire SaaS | Accès total à toutes les agences, console d'administration, aucun `agency_id` requis |
| `admin` | Admin d'agence | Accès complet à son agence : CRUD tout, gestion équipe, paramètres, abonnement |
| `agent` | Agent immobilier | CRUD bailleurs, immeubles, unités, locataires, contrats, paiements, maintenance, GED |
| `comptable` | Comptable | Lecture des finances (paiements, revenus, dépenses, bilans) ; pas d'écriture |
| `bailleur` | Compte bailleur individuel | Vue limitée à ses propres biens et paiements |

### Matrice d'accès (tables principales)

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
| revenus | ALL | R/W | R/W | R | — |
| user_profiles | ALL | R/W (agence) | — | — | — |
| agency_settings | ALL | R/W | R/W | R/W | — |

> Les politiques RLS sont implémentées dans les migrations SQL. Le frontend n'est pas la seule barrière : Supabase enforce les droits au niveau base de données.

---

## 7. Modèle multi-tenant

### Principe d'isolation

Chaque **agence** (`agencies`) est un tenant isolé. Toutes les tables métier disposent d'une colonne `agency_id` (UUID, FK vers `agencies.id`). Les politiques RLS filtrent systématiquement par `agency_id = (SELECT agency_id FROM user_profiles WHERE id = auth.uid())`.

```
agencies (tenant root)
  └── user_profiles (members)
  └── agency_settings (config)
  └── bailleurs
        └── immeubles
              └── unites
                    └── contrats
                          └── paiements
  └── locataires → contrats
  └── depenses
  └── documents
  └── interventions
  └── inventaires
  └── evenements
  └── notifications
  └── subscriptions → subscription_plans
```

### Cycle de vie d'une agence

```
1. Utilisateur s'inscrit (Auth Supabase)
   → Trigger `handle_new_user` crée un `user_profiles` avec agency_id = NULL

2. Utilisateur remplit le formulaire Welcome
   → INSERT dans `agency_creation_requests` (status='pending')

3. super_admin approuve dans la Console
   → RPC `approve_agency_request` (SECURITY DEFINER)
   → Crée l'agence, agency_settings, subscription, rattache l'utilisateur (role='admin')

4. OU: invitation d'un utilisateur dans une agence existante
   → Admin crée une invitation (token UUID)
   → Invité clique le lien → RPC `accept_invitation`
   → user_profiles.agency_id mis à jour
```

### Plans d'abonnement

| Plan | Prix XOF/mois | Utilisateurs | Immeubles | Unités | Stockage |
|------|---------------|--------------|-----------|--------|---------|
| `basic` (Essai) | 0 | 1 | 3 | 10 | 1 Go |
| `pro` | 15 000 | 999 | 999 | 9 999 | 20 Go |
| `enterprise` | Sur devis | Illimité | Illimité | Illimité | 100 Go |

> **Note** : La vérification des limites se fait via la RPC `check_plan_limits`. Le paiement en ligne n'est pas implémenté — le passage au plan Pro se fait par contact WhatsApp/email (voir page Abonnement).

---

## 8. Base de données

### Migrations

Les migrations sont dans `supabase/migrations/` et doivent être appliquées **dans l'ordre alphabétique** (convention `YYYYMMDDHHMMSS_description.sql`). Le dossier `_archive/` contient des migrations historiques/obsolètes à **ne pas rejouer**.

### Tables principales

#### Tables d'infrastructure
| Table | Description |
|-------|-------------|
| `agencies` | Tenants SaaS |
| `user_profiles` | Extension de `auth.users` avec rôle et agency_id |
| `agency_settings` | Configuration par agence (1 ligne par agence, PK = agency_id) |
| `subscription_plans` | Plans disponibles (basic, pro, enterprise) |
| `subscriptions` | Abonnement actif par agence |
| `invitations` | Invitations d'utilisateurs (token UUID, expiration 7j) |
| `agency_creation_requests` | Demandes de création d'agence (flux onboarding) |
| `notifications` | Notifications in-app par utilisateur |
| `audit_logs` | Historique des modifications (INSERT/UPDATE/DELETE via triggers) |
| `owner_actions_log` | Actions super-admin (console propriétaire) |
| `saas_config` | Configuration globale SaaS (key/value JSON) |
| `feature_flags` | Feature flags globaux ou par agence |

#### Tables métier
| Table | Description |
|-------|-------------|
| `bailleurs` | Propriétaires, avec `commission` (%) et `debut_contrat` |
| `immeubles` | Bâtiments, rattachés à un bailleur |
| `unites` | Logements/locaux (statut : `libre`/`loue`/`maintenance`) |
| `locataires` | Locataires avec infos contact et CNI |
| `contrats` | Contrats de location (loyer, caution, commission, destination) |
| `paiements` | Encaissements avec `part_agence` et `part_bailleur` calculés |
| `depenses` | Dépenses d'exploitation de l'agence |
| `revenus` | Revenus non-loyer (peut être lié à un paiement) |
| `bilans_mensuels` | Bilans pré-calculés (non alimentés automatiquement) |
| `documents` | GED : métadonnées + path Storage |
| `inventaires` | États des lieux (pièces JSON, signatures) |
| `interventions` | Tickets de maintenance (kanban) |
| `evenements` | Calendrier |

### Fonctions SQL importantes

| Fonction | Type | Rôle |
|----------|------|------|
| `handle_new_user()` | Trigger SECURITY DEFINER | Auto-création `user_profiles` à l'inscription |
| `create_agency_settings_on_agency_insert()` | Trigger SECURITY DEFINER | Auto-création `agency_settings` à la création d'agence |
| `is_super_admin()` | SQL SECURITY DEFINER | Test rôle super_admin (utilisé dans les policies) |
| `is_admin()` | SQL SECURITY DEFINER | Test rôle admin (utilisé dans les policies legacy) |
| `is_agent_or_admin()` | SQL SECURITY DEFINER | Test rôle agent ou admin |
| `current_user_agency_id()` | SQL SECURITY DEFINER | Retourne l'agency_id courant sans récursion RLS |
| `check_plan_limits(agency_id)` | PL/pgSQL SECURITY DEFINER | Vérifie les quotas du plan, retourne jsonb |
| `accept_invitation(token)` | PL/pgSQL SECURITY DEFINER | Accepte une invitation et rattache l'utilisateur |
| `get_invitation_by_token(token)` | PL/pgSQL SECURITY DEFINER STABLE | Lit une invitation sans auth (flux pré-connexion) |
| `approve_agency_request(id)` | PL/pgSQL SECURITY DEFINER | Crée l'agence + settings + subscription + rattache le demandeur |
| `reject_agency_request(id, reason)` | PL/pgSQL SECURITY DEFINER | Rejette une demande avec motif |
| `update_updated_at_column()` | Trigger | Met à jour `updated_at` automatiquement |
| `log_table_changes()` | Trigger SECURITY DEFINER | Alimente `audit_logs` sur INSERT/UPDATE/DELETE |
| `cleanup_expired_invitations()` | PL/pgSQL SECURITY DEFINER | Marque les invitations expirées |

### Vue
| Vue | Description |
|-----|-------------|
| `vw_owner_agency_stats` | Métriques agrégées par agence pour la console super-admin |

### Storage Buckets

| Bucket | Public | Contenu | Taille max |
|--------|--------|---------|------------|
| `agency-assets` | Oui (URLs publiques) | Logos d'agence | 5 Mo (images uniquement) |
| `documents` | Non | Fichiers GED (contrats, pièces jointes…) | Illimité |

---

## 9. Frontend et navigation

### Routing

L'application utilise un **routing par état React** (pas de React Router). La variable `currentPage` dans `App.tsx` contrôle quelle page est rendue. Chaque page est chargée en **lazy load** via `React.lazy()`.

### Flux d'authentification

```
Chargement → AuthContext.getSession()
           ↓
    Pas de session → <Auth /> (login/register)
           ↓
    Session + token d'invitation → <AcceptInvitation />
           ↓
    Session + profile.role === 'super_admin' → <Console />
           ↓
    Session + !profile.agency_id → <Welcome /> (onboarding)
           ↓
    Session + agency_id → Application principale
```

### Structure de navigation (Sidebar)

La sidebar est organisée en **groupes pliables** :

| Groupe | Pages |
|--------|-------|
| — | Tableau de bord |
| **Finances** | Encaissements, Dépenses, Commissions, Analyses |
| **Locations** | Locataires, Contrats |
| **Patrimoine** | Bailleurs, Immeubles, Produits (Unités) |
| **Activité** | Calendrier, Maintenance, États des lieux, Documents |
| **Paramètres** | Agence + Équipe + Abonnement (page à onglets) |

> ⚠️ **Terminologie** : les unités sont appelées "Produits" dans l'interface utilisateur (choix UX intentionnel visible dans le code et la sidebar).

### Pages consolidées (hubs)

Plusieurs pages sont des **hubs** regroupant plusieurs fonctionnalités sous onglets :

| Hub | Pages intégrées |
|-----|----------------|
| `Encaissements` | Paiements reçus + Loyers impayés |
| `Analyses` | Rapports financiers + Filtres avancés |
| `ParametresHub` | Mon agence + Équipe + Abonnement |

### Génération PDF

La génération PDF est entièrement **côté client** (jsPDF). Les templates de documents sont des fichiers texte dans `public/templates/` avec des variables `{{variable}}`. La fonction `loadAgencySettings()` dans `src/lib/pdf.ts` charge les paramètres de l'agence avec un **cache TTL 5 minutes** pour éviter les appels répétés.

Documents générables :
- **Contrat de location** (template `/public/templates/contrat_location.txt`)
- **Mandat de gérance** (template `/public/templates/mandat_gerance.txt`)
- **Quittance de loyer** (générée programmatiquement, pas de template texte)

---

## 10. Backend, API et sécurité

### Politiques RLS — Principes généraux

1. **Isolation tenant** : toutes les tables métier filtrent sur `agency_id = current_user_agency_id()`
2. **Pas de récursion** : la fonction `current_user_agency_id()` est SECURITY DEFINER pour contourner la récursion RLS sur `user_profiles`
3. **Escalade de privilèges** : le super_admin bypass toutes les politiques via `is_super_admin()`
4. **Opérations critiques** : création d'agence, acceptation d'invitation, approbation → toujours via RPC SECURITY DEFINER

### Sécurité notable

- Les passwords sont validés côté Supabase Auth (min 6 caractères)
- Les tokens d'invitation sont des UUID v4 aléatoires (entropy suffisante)
- Les invitations expirent après 7 jours
- Le rôle `super_admin` ne peut pas être attribué via les invitations (CHECK constraint)
- La promotion en super_admin est une opération SQL manuelle intentionnellement
- Les fonctions SQL ont `SET search_path = public, pg_temp` pour prévenir le schema hijacking
- La liste (LIST) du bucket `agency-assets` est restreinte par tenant (migration `20260426000002`)

### Points de vigilance sécurité

- La policy `"Invitations readable by token"` (créée dans `20260425000004`) expose toutes les invitations `pending` à la lecture anon — **corrigée partiellement** dans `20260426000000` qui la supprime et la remplace par des policies admin-seulement. Le flux pré-auth passe désormais par la RPC `get_invitation_by_token`.
- Les policies `WITH CHECK (true)` héritées du setup initial (agency_settings, audit_logs) ont été supprimées dans `20260426000002`.

---

## 11. Fonctionnalités implémentées

### Gestion immobilière (core)
- [x] CRUD complet : Bailleurs, Immeubles, Unités, Locataires
- [x] CRUD Contrats avec calcul automatique commission au contrat
- [x] Statut des unités : libre / loué / maintenance (mis à jour à la création/résiliation de contrat)
- [x] Soft delete sur bailleurs, immeubles, unités, locataires (colonne `actif`)
- [x] Soft delete sur paiements et dépenses (colonnes `actif` + `deleted_at`)

### Encaissements et finances
- [x] Enregistrement des paiements avec décomposition `part_agence` / `part_bailleur`
- [x] KPIs temps réel sur Paiements : encaissé ce mois, mois précédent, en attente, taux de recouvrement
- [x] Détection automatique des loyers impayés (6 derniers mois, cross-référence contrats actifs / paiements)
- [x] Action "Payer ce loyer" depuis la liste des impayés
- [x] Gestion des dépenses d'exploitation par catégorie et immeuble
- [x] Rapport commissions avec graphiques (par immeuble, camembert) et export PDF
- [x] Filtres avancés multi-critères sur contrats (bailleur > immeuble > unité > statut > loyer > dates)
- [x] Export Excel des résultats de filtres avancés

### Documents PDF
- [x] Génération contrat de location (avec paramètres agence, variables dynamiques)
- [x] Génération mandat de gérance (avec paramètres agence)
- [x] Génération quittance de loyer / facture (avec mentions légales)
- [x] Cache des paramètres agence pour les PDF (TTL 5 min)

### Tableau de bord financier global
- [x] Bilan mensuel agence (loyers, commissions, dépenses, solde)
- [x] Comptabilité annuelle (évolution mensuelle)
- [x] Rapports par immeuble (taux occupation, loyers perçus, frais gestion)
- [x] Bilans bailleurs avec export PDF par bailleur

### Paramètres agence
- [x] Informations générales agence (nom, contact, représentant, NINEA, RC)
- [x] Upload logo (bucket `agency-assets`)
- [x] Mentions légales personnalisables (tribunal, pénalités, frais huissier)
- [x] Couleurs et positionnement logo dans les documents
- [x] Pied de page personnalisé

### Équipe et invitation
- [x] Liste des membres par agence
- [x] Invitation par lien (token UUID, expiration 7j, rôles : admin/agent/comptable)
- [x] Désactivation d'un membre (soft)
- [x] Acceptation d'invitation (flux complet avec gestion pré/post-auth)

### Abonnement
- [x] Affichage plan actuel, statut, période
- [x] Barres de progression utilisation (utilisateurs, immeubles, unités)
- [x] Bannière countdown période d'essai (30j, alerte à 7j et 3j)
- [x] Historique des abonnements
- [x] Modal upgrade (contact WhatsApp/email)

### Modules additionnels
- [x] États des lieux (inventaires) avec pièces, états, caution retenue, export PDF
- [x] Interventions/maintenance (kanban 3 colonnes, filtres urgence/catégorie/immeuble)
- [x] Calendrier événements (vue mensuelle, CRUD événements)
- [x] GED Documents (upload vers Storage, téléchargement signé, filtres dossier/type)
- [x] Notifications in-app (realtime via Supabase channel)
- [x] Feature flags par agence (`feature_flags` table + hook `useFeatureFlag`)

### Console super-admin
- [x] Vue globale avec KPIs SaaS (agences, utilisateurs, volumes)
- [x] Gestion agences : suspendre, réactiver, changer plan, +14j essai, supprimer
- [x] Gestion demandes de création d'agence (approbation/rejet avec motif)
- [x] Gestion utilisateurs globaux (modifier rôle, agence, statut)
- [x] Gestion abonnements
- [x] Journal des actions super-admin (`owner_actions_log`)
- [x] Configuration SaaS (saas_config, key/value JSON)
- [x] Panel support (broadcast notification ciblée ou globale)

### Onboarding
- [x] Formulaire Welcome (3 étapes) avec soumission de demande
- [x] Polling automatique statut demande (8s)
- [x] Guide de démarrage rapide (QuickStart) pour nouveaux utilisateurs
- [x] Assistant de configuration guidée (SetupWizard, 6 étapes)

### CI/CD
- [x] GitHub Actions CI (typecheck + lint + build)
- [x] Sauvegarde BDD quotidienne (2h UTC) avec rétention 30j et upload S3 optionnel
- [x] Monitoring Sentry (erreurs, performances, session replay)

---

## 12. Fonctionnalités partiellement implémentées

### Génération PDF
- Les templates texte `contrat_location.txt` et `mandat_gerance.txt` existent mais contiennent des variables qui peuvent produire des chaînes vides si les paramètres agence ne sont pas renseignés. Pas de validation de complétude avant génération.
- La quittance ne génère pas de QR code malgré le paramètre `qr_code_quittances` présent dans `agency_settings`.

### Bilans mensuels automatiques
- La table `bilans_mensuels` existe mais **n'est pas alimentée automatiquement**. Les bilans sont calculés à la volée dans `TableauDeBordFinancierGlobal.tsx`. Les données dans la table ne sont jamais écrites par l'application.

### Mobile Money
- Les paramètres Wave, Orange Money et Free Money existent dans `agency_settings` (champs `wave_actif`, `wave_numero`, etc.) mais **aucune intégration de paiement n'est implémentée**. Ces champs sont affichés dans les paramètres mais ne déclenchent aucune action.

### Notifications automatiques
- Les notifications peuvent être créées manuellement (console support) ou via des triggers, mais il n'y a **pas de système de notifications automatiques métier** (rappel d'impayé, échéance contrat, etc.). La table et le système temps réel sont en place.

### SMS et email notifications
- Les paramètres `email_notifications_actif` et `sms_notifications_actif` existent dans `agency_settings` mais **aucun envoi n'est implémenté**.

### Module dépenses
- La fonctionnalité existe mais le paramètre `module_depenses_actif` dans `agency_settings` n'est pas vérifié dans le front pour activer/désactiver l'entrée de navigation.

### Plan limits enforcement
- La vérification `usePlanLimits` est implémentée sur Immeubles et Unités mais **pas systématiquement appliquée** sur toutes les entités (locataires, contrats, etc.).

### Paiements en ligne
- L'interface Abonnement affiche un bouton "Passer au plan Pro" qui ouvre un modal de contact WhatsApp/email. **Aucune intégration de paiement en ligne** (Stripe, Wave, etc.) n'est implémentée.

---

## 13. Fonctionnalités manquantes ou incomplètes

### Non implémenté
- **Paiement en ligne** (Stripe, Wave Business, Orange Money Business) — modal de contact uniquement
- **QR code sur les quittances** — paramètre présent, code absent
- **Envoi email/SMS automatique** (rappels loyers, envoi quittances, notifications échéance)
- **Export comptable** (FEC, intégration logiciel comptable)
- **Rapports exportables** par bailleur automatisés (bilan mensuel envoyé par email)
- **Application mobile native** — application web responsive uniquement
- **Portail locataire** — pas d'accès locataire à ses quittances/contrats
- **Signature électronique** des contrats et mandats
- **OCR / reconnaissance de documents** pour import automatique

### Interface super-admin incomplète
- Pas de gestion des `feature_flags` depuis la console (table présente, pas d'UI dédiée)
- La suppression d'agence ne vérifie pas les données orphelines potentielles au niveau Storage

### Gestion des erreurs
- Les pages n'ont pas toutes une gestion d'erreur réseau (certaines affichent juste un loading infini si la requête échoue)
- Pas de mécanisme de retry automatique côté client

---

## 14. Bugs connus et points de vigilance

### ⚠️ Critiques

1. **Récursion RLS sur `user_profiles`** — Historiquement présent, corrigé par `20260425000003` via `current_user_agency_id()`. Si des politiques sont recréées manuellement sans utiliser cette fonction, la récursion peut réapparaître.

2. **Doublons de policies** — L'historique des migrations montre de nombreux correctifs de policies en doublon sur `agencies`. Le dossier `_archive/` contient les anciennes versions. Sur une BDD neuve, appliquer les migrations dans l'ordre résout tout, mais une BDD ancienne peut avoir des états intermédiaires.

3. **Calcul loyers impayés** — Le calcul dans `LoyersImpayes.tsx` effectue 2 requêtes supplémentaires par contrat (batch optimisé dans la version actuelle). Sur de grands volumes, la performance peut dégrader. La pagination n'est pas implémentée.

### ⚠️ Importants

4. **State-based routing sans history API** — L'application ne supporte pas les URLs directes ni le bouton retour du navigateur. Rafraîchir la page ramène toujours au dashboard.

5. **Cache PDF non invalidé** — Le cache `settingsCache` de `src/lib/pdf.ts` a un TTL de 5 minutes en mémoire. Si un utilisateur modifie les paramètres agence et génère immédiatement un PDF, les anciens paramètres peuvent être utilisés. `invalidateAgencySettingsCache()` est disponible mais pas appelé automatiquement après sauvegarde.

6. **`bilans_mensuels` jamais alimentée** — La table existe, les politiques RLS existent, mais aucun code ne l'écrit. Ne pas se fier à cette table pour des exports/rapports.

7. **Seed et données de test** — Les scripts `seed-*.mjs` nécessitent `SUPABASE_SERVICE_ROLE_KEY` (bypass RLS). Avec `ANON_KEY` uniquement, l'insertion échoue sur les agences. Les scripts ne gèrent pas les conflits (à relancer sur une BDD propre).

8. **Template PDF vides** — Si `agency_settings` n'est pas renseigné (agence nouvellement créée), les variables `{{...}}` dans les templates produisent des chaînes vides sans avertissement.

### ℹ️ Vigilance

9. **Appel N+1 historique** — `FiltresAvances.tsx` effectuait historiquement N+1 requêtes pour le filtre `statut_paiement`. Corrigé dans la version actuelle par un batch. Surveiller les évolutions futures.

10. **Race condition Calendrier** — Gérée par `requestIdRef` dans `Calendrier.tsx` et `Contrats.tsx`. Pattern de bonne pratique à reproduire dans les nouvelles pages à fort volume de requêtes.

11. **`localStorage` dans QuickStart** — `QuickStart.tsx` utilise `localStorage` pour persister l'état "dismissed". Les artefacts Claude.ai interdisent `localStorage`, mais dans l'app principale ce n'est pas un problème. À noter pour les tests.

---

## 15. Variables d'environnement

Copier `.env.example` vers `.env` et renseigner :

```env
# Obligatoires
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...

# Optionnels — scripts de seed et backup CI
SUPABASE_SERVICE_ROLE_KEY=eyJ...      # Bypass RLS (ne jamais exposer côté client)
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
VITE_ENV=development               # development | staging | production
VITE_APP_URL=http://localhost:5000
VITE_APP_VERSION=1.0.0             # Pour le suivi des releases Sentry
```

> **Sécurité** : Sur Replit, configurer via le panneau **Secrets** (icône cadenas). Ne jamais commiter `.env` (il est dans `.gitignore`).

---

## 16. Installation locale

### Prérequis

- Node.js ≥ 18
- npm ≥ 9
- Un projet Supabase actif (ou accès aux credentials du projet existant)

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
# → Dans le SQL Editor de Supabase, exécuter chaque fichier
# de supabase/migrations/ dans l'ordre alphabétique
# ⚠️ Ne pas jouer les fichiers de supabase/migrations/_archive/

# 5. Créer le premier super_admin (opération SQL manuelle)
# Dans le SQL Editor Supabase, après création d'un compte Auth :
UPDATE user_profiles
SET role = 'super_admin'
WHERE email = 'votre@email.com';

# 6. Lancer l'application
npm run dev
```

L'application est disponible sur [http://localhost:5000](http://localhost:5000).

### Appliquer les migrations dans l'ordre

```bash
# Lister les migrations dans l'ordre
ls supabase/migrations/*.sql | grep -v _archive | sort

# Les appliquer une par une dans le SQL Editor Supabase
# ou utiliser la Supabase CLI si disponible :
supabase db push
```

---

## 17. Lancement du projet

```bash
# Développement (hot reload, port 5000)
npm run dev

# Build production
npm run build

# Preview du build production
npm run preview

# Vérification TypeScript
npm run typecheck

# Linting ESLint
npm run lint
```

---

## 18. Scripts disponibles

| Script | Commande | Description |
|--------|----------|-------------|
| Dev server | `npm run dev` | Vite dev server (port 5000, HMR) |
| Build | `npm run build` | Build production dans `dist/` |
| Preview | `npm run preview` | Serveur statique du build prod |
| TypeCheck | `npm run typecheck` | `tsc --noEmit` sur `tsconfig.app.json` |
| Lint | `npm run lint` | ESLint sur les fichiers src |
| Tests E2E | `npm run test` | Playwright (headless) |
| Tests headed | `npm run test:headed` | Playwright avec navigateur visible |
| Tests UI | `npm run test:ui` | Interface graphique Playwright |
| Seed | `npm run seed` | Seed de données de test (nécessite `SUPABASE_SERVICE_ROLE_KEY`) |
| Extract PDF | `npm run extract:pdf` | Extraction de PDFs bruts en templates texte |

### Scripts Node.js

| Fichier | Usage |
|---------|-------|
| `scripts/seed-test-data.mjs` | Seed 3 agences avec données réalistes (petit/moyen/grand volume) |
| `scripts/seed-direct.mjs` | Variante seed avec insertion directe |
| `scripts/backup-supabase.sh` | Sauvegarde BDD via Supabase CLI ou pg_dump (utilisé par CI) |
| `scripts/migrate-agency-id.mjs` | Migration one-shot : ajoute agency_id dans les pages (obsolète) |
| `scripts/update-all-pages.mjs` | Transformation batch des pages (obsolète) |
| `scripts/extract-pdf.mjs` | Extraction PDFs → templates texte (dev one-shot) |

---

## 19. Déploiement

### Vercel (recommandé)

Le fichier `vercel.json` est configuré pour un déploiement SPA statique :

```json
{
  "builds": [{ "src": "package.json", "use": "@vercel/static-build" }],
  "routes": [
    { "handle": "filesystem" },
    { "src": "/.*", "dest": "/index.html" }
  ]
}
```

```bash
# Via Vercel CLI
vercel

# Build command : npm run build (ou npm run vercel-build)
# Output directory : dist/
```

Variables d'environnement à configurer dans le dashboard Vercel :
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_ENV=production`
- `VITE_SENTRY_DSN` (optionnel)
- `SENTRY_AUTH_TOKEN` (pour les source maps Sentry)

### Replit

Le fichier `.replit` configure le workflow `Start application` qui lance `npm run dev` (port 5000). Pour la production sur Replit :
- Build : `npm run build`
- Run : `npm run preview`
- Deployment target : `static`
- Public directory : `dist/`

Les variables Supabase sont dans `[userenv.shared]` du `.replit` (attention : elles sont visibles dans le fichier, préférer les Secrets Replit en production).

---

## 20. Tests

### Configuration Playwright

```typescript
// playwright.config.ts
{
  testDir: './tests',
  baseURL: 'http://localhost:5000',
  projects: ['chromium', 'firefox', 'webkit', 'Mobile Chrome', 'Mobile Safari']
}
```

### État actuel des tests

> ⚠️ Le répertoire `tests/` est configuré et le framework Playwright est installé, mais **aucun fichier de test n'est visible dans le code source fourni**. Les composants UI disposent de nombreux `data-testid` (ex : `data-testid="button-new-inventaire"`, `data-testid="input-invite-email"`) qui suggèrent une intention de test E2E sérieuse, mais les tests effectifs ne sont pas vérifiables dans l'état actuel du repo.

### Convention `data-testid`

Les composants respectent une convention de nommage :
- `button-{action}-{context}` → ex : `button-approve-<id>`, `button-delete-agency-<id>`
- `input-{champ}` → ex : `input-invite-email`, `input-name`
- `select-{champ}` → ex : `select-invite-role`
- `filter-{champ}` → ex : `filter-folder`, `filter-statut`
- `text-{info}` → ex : `text-current-plan`, `text-trial-days`
- `row-{entité}-{id}` → ex : `row-request-<uuid>`, `row-notification-<id>`

---

## 21. Bonnes pratiques de contribution

### Conventions de code

- **TypeScript strict** : `strict: true`, `noUnusedLocals`, `noUnusedParameters` activés
- **Formatters** : toujours importer depuis `src/lib/formatters.ts` (ne pas redéfinir localement)
- **Toasts** : utiliser le hook `useToast()`, pas de `alert()`
- **Erreurs Supabase** : utiliser `translateSupabaseError()` de `src/lib/errorMessages.ts`
- **Agency ID** : toujours filtrer par `agency_id` dans les requêtes Supabase (`.eq('agency_id', profile?.agency_id)`)
- **Race conditions** : sur les pages avec rechargement fréquent, utiliser le pattern `requestIdRef` (voir `Calendrier.tsx`, `Contrats.tsx`)

### Structure d'une nouvelle page

```tsx
// 1. Importer les hooks et composants UI standard
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/useToast';

// 2. Guard agency_id
useEffect(() => {
  if (profile?.agency_id) {
    loadData();
  }
}, [profile?.agency_id]);

// 3. Guard dans la fonction de chargement
const loadData = async () => {
  if (!profile?.agency_id) return;
  // ...
};

// 4. Filtrer TOUTES les requêtes par agency_id
const { data } = await supabase
  .from('ma_table')
  .select('*')
  .eq('agency_id', profile.agency_id);

// 5. Ajouter agency_id à tous les INSERTs
await supabase.from('ma_table').insert({
  ...formData,
  agency_id: profile.agency_id,
});
```

### Nouvelles migrations SQL

1. Nommer le fichier `YYYYMMDDHHMMSS_description.sql`
2. Rendre la migration **idempotente** (`IF NOT EXISTS`, `ON CONFLICT DO NOTHING`, `DROP ... IF EXISTS`)
3. Pour les fonctions SECURITY DEFINER, toujours ajouter `SET search_path = public, pg_temp`
4. Documenter l'objectif de la migration en commentaire SQL en tête de fichier
5. Ne jamais modifier une migration déjà appliquée en production

### Workflow Git (recommandé)

```
main         → production stable
feature/*    → nouvelles fonctionnalités
fix/*        → corrections de bugs
migration/*  → nouvelles migrations BDD
```

Le CI (`.github/workflows/ci.yml`) tourne sur chaque PR vers `main` : typecheck → lint → build.

---

## 22. FAQ technique

**Q : Comment créer le premier compte super_admin ?**

```sql
-- 1. Créer un compte via l'interface Auth ou /register
-- 2. Dans le SQL Editor Supabase :
UPDATE user_profiles
SET role = 'super_admin'
WHERE email = 'admin@example.com';
```
Le rôle `super_admin` ne peut pas être attribué via les invitations (CHECK constraint). C'est intentionnel.

---

**Q : Pourquoi certaines pages utilisent `profile?.agency_id` et d'autres `user?.id` ?**

`profile` est le `user_profiles` étendu (rôle, agency_id). `user` est l'objet `auth.User` Supabase (id, email). Pour les requêtes métier, toujours utiliser `profile.agency_id`. Pour les opérations Auth (signOut, etc.), utiliser `user`.

---

**Q : Comment déboguer un problème de RLS "row violates policy" ?**

```sql
-- Vérifier le rôle de l'utilisateur
SELECT id, role, agency_id FROM user_profiles WHERE email = 'user@example.com';

-- Simuler une requête avec un rôle
SET LOCAL role = 'authenticated';
SET LOCAL "request.jwt.claims" = '{"sub": "<user-uuid>"}';
SELECT * FROM bailleurs WHERE agency_id = '<agency-uuid>';
```

---

**Q : Comment ajouter un nouveau module (ex : "Sinistres") ?**

1. Créer la table avec `agency_id` et RLS dans une nouvelle migration
2. Ajouter l'entrée dans `NAV` du `Sidebar.tsx` avec les rôles autorisés
3. Créer la page dans `src/pages/`
4. L'ajouter dans le switch `renderPage()` de `App.tsx`
5. Importer en lazy dans `App.tsx`

---

**Q : Pourquoi le routing ne supporte pas les URLs directes ?**

L'application utilise un routing par état React sans React Router. C'est une limitation connue : le bouton retour du navigateur et les liens directs vers une sous-page ne fonctionnent pas. Une migration vers React Router ou TanStack Router est une amélioration future possible.

---

**Q : Le seed échoue, que faire ?**

```bash
# Vérifier que SUPABASE_SERVICE_ROLE_KEY est bien défini
echo $SUPABASE_SERVICE_ROLE_KEY

# Le seed attend une BDD vierge. Si des agences existent déjà, des conflits peuvent survenir.
# Sur une BDD de dev : tronquer les tables d'abord (avec CASCADE)
# Ou utiliser un projet Supabase dédié au dev.
```

---

**Q : Comment invalider le cache PDF des paramètres agence ?**

```typescript
import { invalidateAgencySettingsCache } from '../lib/pdf';

// Après sauvegarde des paramètres :
invalidateAgencySettingsCache(profile.agency_id);
// ou pour tout invalider :
invalidateAgencySettingsCache();
```

---

**Q : Où trouver les logs d'actions de la console super-admin ?**

Dans la table `owner_actions_log`. Accessible depuis la Console → onglet "Audit".

---

**Q : Comment tester en local sans super_admin ?**

Créer un compte normal, approuver sa demande via SQL direct :

```sql
-- Forcer le rattachement sans passer par l'approbation
UPDATE user_profiles
SET agency_id = '<agency-uuid>',
    role = 'admin'
WHERE id = '<user-uuid>';
```

---

*Ce README reflète l'état du repository au moment de sa rédaction. Pour toute information non vérifiable dans le code source, l'indication [à confirmer] aurait été ajoutée — aucune n'a été nécessaire.*
