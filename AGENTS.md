# AGENTS.md - Samay Keur

## Identite du projet

Samay Keur est un SaaS premium de gestion locative pour agences immobilieres,
gestionnaires et bailleurs individuels en Afrique francophone.

Objectif produit : remplacer Excel, cahiers et WhatsApp par une infrastructure
fiable, tracable, securisee et professionnelle.

Deux surfaces restent separees :

- App SaaS : `app.samaykeur.com` / repo `app.SamayKeur.com.git`
- Vitrine publique : `samaykeur.com` / repo `SamayKeur.com.git`

Ne jamais melanger la vitrine et l'application connectee.

## Stack

- Frontend : React, Vite, TypeScript strict, Tailwind CSS
- Backend : Supabase Auth, PostgreSQL, RLS, Storage, Edge Functions, Realtime
- Documents : PDF app, GED privee, registre documentaire, QR public
- Verification publique : `https://samaykeur.com/verify?token=...&ref=...&type=...`

## Regles non negociables

- Source unique de verite : ne pas dupliquer une donnee metier.
- Multi-tenant strict : toujours respecter `agency_id` et les guards existants.
- Ne jamais desactiver RLS pour contourner un bug.
- Ne jamais exposer de secret `service_role` cote frontend.
- Ne pas creer d'ecran maquette sans donnees reelles.
- Ne pas casser le mode agence en adaptant le mode bailleur individuel.
- `agencies.is_bailleur_account = true` reste la source Phase 1 du mode bailleur individuel.
- Les composants doivent preferer `accountProfile` aux lectures directes de flags bruts.

## Finance et Ledger

- Ledger first : aucune operation financiere ne doit contourner le Ledger.
- Les paiements, reliquats, commissions, net bailleur et rapports financiers sont P0.
- Ne jamais corriger un calcul financier dans l'UI.
- Pas de fallback silencieux sur l'argent : lever une erreur explicite.
- Les paiements doivent passer par Edge Function / service serveur prevu, pas par insert direct.
- Ne jamais confirmer paiement, quittance ou mutation financiere si l'ecriture reseau a echoue.
- Ne pas introduire de queue offline pour les paiements sans validation explicite.

## Supabase, RLS et donnees

- Toute requete metier doit filtrer par organisation quand pertinent.
- Les migrations deja deployees ne doivent pas etre modifiees : creer une nouvelle migration.
- Les migrations doivent etre idempotentes (`IF EXISTS`, `IF NOT EXISTS`, backfills prudents).
- Ne pas lancer de commande Supabase distante, migration, deploy Edge Function ou modification RLS
  sans demande explicite de l'utilisateur.
- Les anciens comptes doivent rester compatibles ; fallback agence par defaut.

## Documents, GED et QR

- Un document verifiable doit avoir : type stable, reference, entree GED/registre, QR public.
- Types critiques : `quittance`, `contrat`, `mandat`, `rapport_bailleur`, `rapport_proprietaire`.
- Les nouveaux QR publics doivent pointer vers `samaykeur.com/verify`, jamais vers l'app privee.
- Les documents bailleur individuel ne doivent pas afficher agence, mandataire ou commission
  quand ce n'est pas pertinent.

## UI / UX

- Mobile first sur les pages terrain : aucun overflow horizontal non voulu.
- Drawer first : preferer un drawer lateral a un changement de page quand cela garde le contexte.
- Design premium, clair, dense et operationnel ; pas de decoration inutile.
- Textes lisibles, actions accessibles, etats vides utiles, skeletons bornes.
- Quand un drawer est ouvert, cacher les colonnes secondaires si necessaire au lieu de seulement compacter.
- Ne pas ajouter de refactor massif pour une correction UI ciblee.

## Commandes de validation

Depuis la racine de l'app :

```bash
npm run typecheck
npm run lint
npm run build
```

Pour la vitrine, executer les validations dans le repo vitrine separe.

## Git

- Ne jamais commit ni push sans demande explicite.
- Un commit = une intention claire.
- Ne pas stage des changements sans verifier `git status --short`.
- Ne pas inclure logs, fichiers debug, sorties de build ou changements hors scope.
- Ne jamais utiliser `git reset --hard`, `git checkout --` ou clean global sans validation humaine.

## Discipline d'agent

- Lire le contexte avant d'agir : `SAMAY_KEUR_CONTEXT.md`, `CONVENTIONS.md`, `docs/`.
- Pour les taches importantes, charger la skill locale pertinente dans `.agents/skills/`.
- Modifier le minimum de fichiers necessaires.
- Annoncer les limites restantes si une verification n'a pas pu etre faite.
