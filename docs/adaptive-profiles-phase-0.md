# Samay Keur Adaptative - Phase 0 / Phase 1

## Objectif

Preparer Samay Keur a fonctionner comme une plateforme immobiliere adaptable sans casser le socle actuel.

La regle de securite reste conservatrice : tout compte existant sans signal clair est traite comme une agence.

## Etat d'avancement Phase 1

La Phase 1 bailleur individuel est maintenant branchee dans l'application.

Livre :

- helper central `accountProfile` ;
- dictionnaire adaptatif ;
- sidebar et bottom navigation adaptees ;
- routes directes bloquees pour les modules masques ;
- proprietaire interne unique pour bailleur individuel ;
- auto-selection du proprietaire dans les formulaires qui exigent un bailleur ;
- plan Starter par defaut si aucun abonnement payant actif n'existe ;
- documents adaptes au proprietaire direct ;
- mandat de gerance masque ou bloque ;
- convention globale `Prenom Nom`.

Toujours a finaliser en Phase 2+ :

- persistance complete par `organization_type` pour tous les profils ;
- mode documentaire entierement modulaire ;
- dashboard completement differencie pour gestionnaire, bailleur multi-biens et groupe ;
- feature flags de rollout par type de compte.

## Matrice Profil vs Fonctionnalites

| Zone | Bailleur individuel | Gestionnaire independant | Agence structuree | Groupe / reseau |
|---|---|---|---|---|
| Type cible | `individual` | `freelance` | `agency` | `group` |
| Compatibilite Phase 1 | `is_bailleur_account = true` | prepare dictionnaire | fallback par defaut | prepare dictionnaire |
| Mode document par defaut | `simple` | `professional` | `legal` | `legal` |
| Dashboard | revenus personnels, impayes, biens | portefeuille, honoraires, proprietaires | KPIs agence, equipe, commissions | consolidation reseau |
| Biens | `Mes biens` | `Portefeuille` | `Immeubles` / `Biens` | parc multi-agences |
| Bailleurs / proprietaires | masque | `Proprietaires` | `Bailleurs` | supervision |
| Mandats | masque / bloque | visible | visible | centralise |
| Commissions | masque | `Honoraires` | `Commissions` | revenus consolides |
| Equipe | masque | optionnel | visible | gouvernance |
| Audit trail | masque | masque par defaut | visible | centralise |
| NINEA / RC | secondaire ou masque | optionnel selon statut | visible | visible par entite |
| Quittance | proprietaire direct | gestionnaire pour le compte de | agence mandataire | en-tete agence locale |
| Contrat | proprietaire / locataire | gestionnaire / proprietaire / locataire | agence mandataire | standard reseau |
| Pricing | Starter | Pro | Business | Enterprise |

## Source de verite semantique

Le dictionnaire central est dans :

- `src/constants/dictionary.ts`
- `src/types/organization.ts`
- `src/lib/accountProfile.ts`

Il couvre :

- labels de navigation ;
- groupes de sidebar ;
- modules masques ;
- features fonctionnelles ;
- role de signature documentaire ;
- mode documentaire par defaut ;
- message de blocage des mandats.

Les composants ne doivent pas lire directement `is_bailleur_account`. Ils doivent consommer :

- `accountProfile.labels`
- `accountProfile.features`
- `getAccountPageLabel()`
- `canAccessAccountPage()`
- `getEffectiveRoleForAccount()`
- `getAccountGroupCopy()`

## Garde-fous de Phase 1

- Migrations limitees a la compatibilite bailleur individuel, sans casser les comptes agence.
- Aucune modification destructive RLS.
- Aucune modification ledger ou calcul financier agence.
- `is_bailleur_account` reste la source de verite uniquement pour le bailleur individuel.
- Fallback agence strict si l'agence est absente ou si le champ est faux.
- Les types `freelance` et `group` sont prepares cote dictionnaire, mais non finalises en UX complete.

## Proprietaire unique en mode bailleur individuel

Un compte `is_bailleur_account = true` doit toujours disposer d'un bailleur interne utilisable par les relations metier.

Regles :

- le proprietaire interne est marque comme proprietaire principal du compte quand la colonne existe ;
- sa commission est `0` ;
- les formulaires immeubles/biens ne doivent pas demander de bailleur ;
- les contrats et documents recuperent ce proprietaire automatiquement ;
- si les colonnes recentes ne sont pas encore presentes, le service garde un fallback non bloquant.

Fichier central :

- `src/services/individualOwner.ts`

Migration associee :

- `supabase/migrations/20260524000001_individual_landlord_owner_profile.sql`

## Convention Prenom Nom

Tous les affichages de personnes doivent suivre :

```text
Prenom Nom
```

Cela concerne les bailleurs, locataires, utilisateurs, rapports, exports et documents.

Helper obligatoire :

```ts
formatPersonName(person)
```

Ne pas utiliser `nom prenom` dans les nouveaux composants.

## Code Map

### Navigation et acces

| Fichier | Risque | Action |
|---|---|---|
| `src/components/layout/Sidebar.tsx` | menus visibles au mauvais profil | consommer labels/features depuis `accountProfile` |
| `src/components/layout/BottomNav.tsx` | navigation mobile generique | variantes profil depuis `accountProfile` |
| `src/App.tsx` | acces URL direct | bloquer via `canAccessAccountPage()` |
| `src/lib/rbac.ts` | vocabulaire agence dans descriptions | harmoniser progressivement via dictionnaire |

### Pages metier

| Fichier | Risque | Action |
|---|---|---|
| `src/pages/Dashboard.tsx` | KPIs trop agence | utiliser labels et features |
| `src/pages/Parametres.tsx` | NINEA/RC trop centraux | rendre secondaires pour individual |
| `src/pages/Paiements.tsx` | vocabulaire encaissements/agence | labels dynamiques |
| `src/pages/Contrats.tsx` | commission visible | masquer avec `features.canUseCommissions` |
| `src/pages/Documents.tsx` | entites bailleurs visibles | masquer categories non pertinentes |
| `src/pages/TableauDeBordFinancierGlobal.tsx` | rapport bailleur / commissions | variantes proprietaire |
| `src/pages/Welcome.tsx` | aiguillage limite | Phase 2 : `organization_type` complet |

### Documents

| Fichier | Risque | Action |
|---|---|---|
| `src/lib/pdf.ts` | mandataire/NINEA/RC hors contexte | conditions via settings + account profile |
| `public/templates/contrat_location.txt` | clauses agence dans tous les cas | variante legere Phase 1, partiels Phase 3 |
| `public/templates/mandat_gerance.txt` | non pertinent pour proprietaire | generation bloquee si individual |
| `src/lib/templates/*.ts` | templates legacy agence | a basculer vers partiels Phase 3 |

## Commandes d'audit

```powershell
rg -n "agence|Agence|AGENCE|bailleur|Bailleur|commission|Commission|mandat|Mandat|NINEA|RC|mandataire|Mandataire|equipe|Equipe" src --glob "*.tsx" --glob "*.ts"
```

```powershell
rg -n "is_bailleur_account|organization_type|document_mode|enabled_modules" src supabase --glob "*.ts" --glob "*.tsx" --glob "*.sql"
```

## Prochaine phase

La Phase 2 doit generaliser `organization_type`, `document_mode` et `enabled_modules` en base avec backfill agence par defaut, puis activer progressivement les profils `multi_property_landlord`, `property_manager` et `group`.
