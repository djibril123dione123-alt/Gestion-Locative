# Etat actuel de Samay Keur

Derniere mise a jour : 2026-05-25

Ce document resume l'etat fonctionnel actuel de Samay Keur apres la separation vitrine/application, l'adaptation au mode bailleur individuel et les dernieres passes UX.

## Positionnement produit

Samay Keur est une plateforme SaaS proptech pour l'Afrique francophone. Elle centralise :

- bailleurs et proprietaires ;
- biens, immeubles et unites ;
- locataires ;
- contrats et mandats ;
- encaissements, paiements partiels et reliquats ;
- impayes ;
- quittances, factures, contrats, mandats et rapports ;
- GED, QR de verification et stockage documentaire ;
- equipe, roles, permissions et reporting financier.

Le produit doit rester une infrastructure de gestion immobiliere, pas une simple application de quittances.

## Surfaces applicatives

| Surface | Chemin local | Role |
|---|---|---|
| Application SaaS | `src/` | Espace authentifie React/Vite connecte a Supabase |
| Vitrine marketing | `marketing/` | Landing autonome HTML/CSS/JS, build separe |
| Assets partages | `public/brand/` | Logos, images marketing, screenshots, tokens |
| Documentation | `docs/` | Architecture, runbooks, produit, securite |

La vitrine ne doit pas etre reintegree dans l'ancienne landing React.

## Repositories GitHub

| Depot | Contenu |
|---|---|
| `djibril123dione123-alt/Samay-Keur.git` | Application SaaS principale + migrations + documentation |
| `djibril123dione123-alt/vitrine-Samay-Keur.git` | Vitrine marketing autonome + assets publics necessaires |

Le remote principal local doit pointer vers `Samay-Keur.git`.

## Scripts importants

```bash
npm run dev
npm run build
npm run preview -- --host 127.0.0.1 --port 4175
```

```bash
npm run marketing:dev
npm run marketing:build
```

Checks avant push :

```bash
npm run typecheck
npm run lint
npm run build
npm run marketing:build
```

## Mode bailleur individuel

Le mode bailleur individuel est active via `agencies.is_bailleur_account = true` pour la Phase 1.

Comportement attendu :

- l'utilisateur est le proprietaire unique de son espace ;
- aucun select bailleur ne doit etre impose ;
- un bailleur interne est cree ou rattache automatiquement ;
- les immeubles/biens sont rattaches au proprietaire unique ;
- les contrats utilisent une commission a `0` ;
- les modules agence non pertinents sont masques ;
- les documents parlent de proprietaire direct, pas de mandataire ;
- le plan affiche par defaut est Starter s'il n'existe pas d'abonnement payant actif.

Fichiers principaux :

- `src/lib/accountProfile.ts`
- `src/constants/dictionary.ts`
- `src/services/individualOwner.ts`
- `src/hooks/usePlanLimits.ts`
- `src/pages/Abonnement.tsx`
- `src/pages/Immeubles.tsx`
- `src/pages/Contrats.tsx`
- `src/lib/pdf.ts`

## Navigation adaptative

La navigation doit etre construite depuis le contexte compte, pas depuis des conditions dispersees.

Regle cible :

```ts
sidebarItems = getSidebarItems(accountType, role, enabledModules, plan)
```

En Phase 1, les composants doivent consommer :

- `accountProfile.labels`
- `accountProfile.features`
- `getAccountPageLabel()`
- `canAccessAccountPage()`
- `getEffectiveRoleForAccount()`

Ils ne doivent pas lire directement `is_bailleur_account` sauf dans les helpers centraux.

## Documents PDF

La charte documentaire commune couvre :

- en-tete ;
- footer ;
- titres de section ;
- tableaux ;
- blocs totaux ;
- signatures ;
- QR de verification ;
- fallbacks en cas de donnees manquantes.

Pour bailleur individuel :

- quittance emise par le proprietaire ;
- contrat direct proprietaire / locataire ;
- rapport nomme `Resume mensuel proprietaire` ;
- mandat de gerance bloque ou masque ;
- pas de commission agence ;
- NINEA/RC secondaires ou absents si non renseignes.

Pour agence :

- logique mandataire conservee ;
- commissions conservees ;
- rapports bailleurs conserves ;
- NINEA/RC, representant, cachet et signature restent pertinents.

## Convention noms de personnes

Dans toute l'application, l'ordre d'affichage et de saisie est :

```text
Prenom Nom
```

Cette convention s'applique aux :

- locataires ;
- bailleurs/proprietaires ;
- utilisateurs equipe ;
- contrats ;
- rapports ;
- quittances/factures ;
- exports ;
- recherches ;
- notifications.

Utiliser le helper :

```ts
formatPersonName(person)
```

Ne pas recreer manuellement des chaines `nom + prenom`.

## Paiements et reliquats

Le workflow paiement doit rester serveur-centrique :

- creation via Edge Function ;
- idempotency key obligatoire ;
- mois soldes bloques ;
- mois partiels selectionnables ;
- total paye a date calcule avec l'historique du mois ;
- reliquat affiche comme difference entre loyer total et total paye ;
- quittance/facture explicite les paiements precedents si le paiement courant solde un reliquat.

## Migrations recentes

Migrations importantes :

- `20260524000001_individual_landlord_owner_profile.sql`
- `20260524000002_account_profile_structuring.sql`

Objectifs :

- autoriser commission `0` pour bailleur individuel ;
- ajouter le proprietaire interne unique ;
- preparer `organization_type`, `document_mode` et `enabled_modules` ;
- conserver la compatibilite avec les anciens comptes agence.

Avant toute nouvelle migration :

- verifier les comptes existants ;
- garder fallback agence ;
- ne pas casser RLS ;
- ne pas casser le ledger ;
- documenter les policies modifiees.

## Etat QA local connu

Dernieres commandes executees avec succes :

- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `npm run marketing:build`

Previews locales :

- Application : `http://127.0.0.1:4175/`
- Vitrine : `http://127.0.0.1:4176/`

## Points de vigilance restants

- Les profils `property_manager`, `multi_property_landlord` et `group` sont prepares conceptuellement mais pas finalises.
- Le mode documentaire `simple / professional / legal` existe progressivement, mais tous les templates ne sont pas encore entierement modulaires.
- Les deployments Vercel CLI peuvent rester en statut `UNKNOWN`; verifier le dashboard Vercel apres chaque push.
- Toute evolution RLS doit etre testee avec au minimum un compte agence et un compte bailleur individuel.
