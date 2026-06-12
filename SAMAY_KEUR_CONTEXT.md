# SAMAY KEUR - MASTER AI CONTEXT

## Mission

Samay Këur est une plateforme SaaS de gestion immobilière destinée aux agences immobilières, administrateurs de biens et bailleurs individuels d'Afrique francophone.

Sa mission est de remplacer la gestion artisanale (Excel, cahiers, WhatsApp) par une infrastructure numérique fiable, traçable, sécurisée et professionnelle.

L'objectif n'est pas simplement de gérer des loyers mais de devenir la référence de confiance du secteur immobilier francophone africain.

---

## Vision Long Terme

Construire le logiciel de référence de la gestion immobilière africaine.

Objectifs :

* Rentabilité sans dépendance aux levées de fonds.
* Référence régionale.
* Infrastructure scalable.
* Déploiement Afrique francophone.
* Automatisation maximale des opérations.

---

## Principes Non Négociables

### Source Unique de Vérité

Une donnée ne doit jamais exister à plusieurs endroits.

### Ledger First

Toute opération financière passe par le Ledger.

Aucun calcul financier ne doit contourner le Ledger.

### Multi-Tenant Strict

Chaque organisation est totalement isolée.

RLS obligatoire.

Ne jamais désactiver RLS pour contourner un problème.

### Mobile First

Chaque écran doit fonctionner parfaitement sur mobile.

### Drawer First

Préférer les drawers latéraux aux changements de page.

### Finir avant d'ajouter

On termine un module avant d'en commencer un autre.

---

## Univers Produit

### Univers Agence

Gestion :

* bailleurs
* immeubles
* unités
* occupants
* baux
* paiements
* GED
* rapports
* finances

### Univers Bailleur Individuel

Même moteur.

UX simplifiée.

Pas de complexité agence.

---

## Architecture

Frontend :

* React
* Vite
* TypeScript strict
* Tailwind

Backend :

* Supabase
* PostgreSQL
* Auth
* Storage
* Edge Functions
* Realtime

---

## Priorités Produit

1. Patrimoine
2. Occupants & Baux
3. Finance Locative
4. GED
5. Documents PDF
6. Paramètres
7. Abonnement

---

## Standards UX

Inspirations :

* Apple
* Stripe
* Linear
* Airbnb

Objectifs :

* compréhension en moins de 30 secondes
* zéro surcharge
* zéro écran inutile
* ultra premium
* cohérence absolue

---

## IA Workflow

ChatGPT :

* vision produit
* architecture
* arbitrage

Gemini :

* recherche
* analyse
* documentation

NotebookLM :

* mémoire projet

Codex :

* implémentation

Antigravity :

* implémentation
* refactorisation
* QA
* audit

Règle :

Un seul agent modifie le dépôt à la fois.

---

## Project Skills

Toute tâche importante doit commencer par choisir et charger le skill adapté dans `.agents/skills/` :

* `samay-cto` : coordination stratégique, choix d'architecture et de roadmap.
* `samay-code-review` : vérification de la qualité, lints, types et non-régression.
* `samay-frontend-ux` : conformité de la charte graphique premium, drawers et responsivité.
* `samay-supabase-security` : RLS, sécurité des requêtes, structures de données et migrations SQL.
* `samay-product-architect` : arbitrage fonctionnel, priorisation et alignement avec la vision produit.
* `samay-documentation` : maintien des guides, roadmaps, schémas de données et logs.

---

## Interdictions

* désactiver RLS
* contourner le Ledger
* créer des fonctionnalités gadgets
* ajouter de l'IA marketing inutile
* casser la séparation vitrine/app
* créer du code sans build propre

---

## Validation Obligatoire

npm run typecheck

npm run lint

npm run build

Aucun travail n'est terminé sans ces trois validations.
