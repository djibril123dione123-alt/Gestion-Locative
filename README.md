# Samay Këur — Plateforme SaaS de gestion locative

Application web multi-tenant de gestion immobilière pour les agences et
bailleurs (initialement orientée Sénégal). Construite sur React + Vite +
TypeScript + Supabase.

## Sommaire

- [Stack technique](#stack-technique)
- [Prérequis](#prérequis)
- [Installation locale](#installation-locale)
- [Variables d'environnement](#variables-denvironnement)
- [Scripts npm](#scripts-npm)
- [Structure du projet](#structure-du-projet)
- [Base de données](#base-de-données)
- [Déploiement sur Replit](#déploiement-sur-replit)
- [Rôles utilisateur](#rôles-utilisateur)

## Stack technique

- **Frontend** : React 18, Vite 5, TypeScript, Tailwind CSS
- **Backend** : Supabase (PostgreSQL, Auth, Storage, RLS)
- **PDF / exports** : jsPDF + jspdf-autotable, xlsx
- **Graphiques** : Recharts
- **Icônes** : Lucide React

## Prérequis

- Node.js ≥ 18
- npm ≥ 9
- Un projet Supabase actif (ou utilisation du PostgreSQL Replit + adaptation)

## Installation locale

```bash
git clone <url-du-repo>
cd <repo>
npm install
cp .env.example .env
# éditer .env avec vos credentials Supabase
npm run dev
```

L'application est ensuite servie sur [http://localhost:5000](http://localhost:5000).

## Variables d'environnement

Voir [`.env.example`](.env.example) pour la liste complète. Les deux variables
obligatoires sont :

| Variable                  | Description                                |
| ------------------------- | ------------------------------------------ |
| `VITE_SUPABASE_URL`       | URL publique du projet Supabase            |
| `VITE_SUPABASE_ANON_KEY`  | Clé anonyme (publique) Supabase            |

Sur Replit, configurer ces secrets via le panneau **Secrets** (icône cadenas
dans la sidebar), jamais dans un fichier commité.

## Scripts npm

| Commande          | Description                                      |
| ----------------- | ------------------------------------------------ |
| `npm run dev`     | Lance le dev server Vite sur le port 5000        |
| `npm run build`   | Construit l'application pour la production       |
| `npm run preview` | Sert le build de production en local             |
| `npm run lint`    | Vérifie le code avec ESLint                      |

## Structure du projet

```
src/
├── components/
│   ├── layout/        # Sidebar, layout principal
│   └── ui/            # Composants UI réutilisables (Modal, Toast, …)
├── contexts/          # React contexts (Auth, …)
├── hooks/             # Hooks personnalisés (useToast, useFeatureFlag, …)
├── lib/               # Helpers (supabase, pdf, formatters, templates, …)
├── pages/             # Pages applicatives (Dashboard, Bailleurs, …)
├── types/             # Types TypeScript partagés
└── App.tsx            # Routeur principal (state-based)

supabase/
└── migrations/        # Migrations SQL versionnées (à appliquer dans l'ordre)
```

## Base de données

Toutes les migrations SQL sont dans `supabase/migrations/` et doivent être
appliquées dans l'ordre alphabétique (la convention `YYYYMMDDHHMMSS_xxx.sql`
garantit l'ordre).

Pour appliquer les migrations sur un nouveau projet Supabase :

1. Aller dans **SQL Editor** dans le dashboard Supabase
2. Exécuter chaque fichier de migration dans l'ordre
3. Vérifier que les politiques RLS sont actives sur toutes les tables sensibles

L'architecture est multi-tenant : chaque agence (`agencies.id`) isole ses
données via la colonne `agency_id` présente sur toutes les tables métier, avec
des politiques RLS qui imposent ce filtrage.

## Déploiement sur Replit

1. Configurer les Secrets `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY`
2. Le workflow `Start application` lance `npm run dev` (port 5000)
3. Pour déployer en production : utiliser le bouton **Deploy** de Replit
   - Build command : `npm run build`
   - Run command : `npm run preview`
   - Public directory : `dist/`

## Rôles utilisateur

Quatre rôles principaux gérés via la colonne `user_profiles.role` :

| Rôle          | Description                                              |
| ------------- | -------------------------------------------------------- |
| `super_admin` | Propriétaire du SaaS — accès à la Console multi-agences  |
| `admin`       | Administrateur d'agence — accès complet à son agence     |
| `agent`       | Agent immobilier — accès opérationnel limité             |
| `comptable`   | Comptabilité — accès financier                           |
| `bailleur`    | Compte bailleur — vue limitée à ses biens                |

Le premier utilisateur d'une agence devient automatiquement `admin`.
