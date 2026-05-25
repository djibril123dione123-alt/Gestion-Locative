# Samay Këur Adaptative - Phase 0

## Objectif

Préparer Samay Këur à fonctionner comme une plateforme immobilière adaptable sans casser le socle actuel. La Phase 0 fige les règles UX, le vocabulaire, les garde-fous et les zones de code à refactoriser avant les migrations plus lourdes.

La règle de sécurité est volontairement conservatrice : tout compte existant sans signal clair reste traité comme une agence.

## Matrice Profil vs Fonctionnalités

| Zone | Bailleur individuel | Gestionnaire indépendant | Agence structurée | Groupe / réseau |
| --- | --- | --- | --- | --- |
| Type cible | `individual` | `freelance` | `agency` | `group` |
| Compatibilité Phase 1 | `is_bailleur_account = true` | préparé dictionnaire | fallback par défaut | préparé dictionnaire |
| Mode document par défaut | `simple` | `professional` | `legal` | `legal` |
| Dashboard | Revenus personnels, impayés, biens | Portefeuille, honoraires, propriétaires | KPIs agence, équipe, commissions | Consolidation réseau |
| Biens | `Mes biens` | `Portefeuille` | `Immeubles` | `Parc multi-agences` |
| Bailleurs / propriétaires | masqué | `Propriétaires` | `Bailleurs` | supervision |
| Mandats | masqué / bloqué | visible | visible | centralisé |
| Commissions | masqué | `Honoraires` | `Commissions` | revenus consolidés |
| Équipe | masqué | optionnel | visible | gouvernance |
| Audit trail | masqué | masqué par défaut | visible | centralisé |
| NINEA / RC | secondaire ou masqué | optionnel selon statut | visible | visible par entité |
| Quittance | propriétaire direct | gestionnaire pour le compte de | agence mandataire | entête agence locale |
| Contrat | propriétaire ↔ locataire | gestionnaire / propriétaire / locataire | agence mandataire | standard réseau |
| Pricing | Starter | Pro | Business | Enterprise |

## Source de vérité sémantique

Le dictionnaire central est maintenant dans :

- `src/constants/dictionary.ts`
- `src/types/organization.ts`

Il couvre :

- labels de navigation ;
- groupes de sidebar ;
- modules masqués ;
- features fonctionnelles ;
- rôle de signature documentaire ;
- mode documentaire par défaut ;
- message de blocage des mandats.

Les composants ne doivent pas lire directement `is_bailleur_account`. Ils doivent consommer :

- `accountProfile.labels`
- `accountProfile.features`
- `getAccountPageLabel()`
- `canAccessAccountPage()`
- `getAccountGroupCopy()`

## Garde-fous de Phase 1

- Aucune migration Supabase.
- Aucune modification RLS.
- Aucune modification ledger ou calcul financier profond.
- `is_bailleur_account` reste la source de vérité uniquement pour le bailleur individuel.
- Fallback agence strict si l'agence est absente ou si le champ est faux.
- Les types `freelance` et `group` sont préparés côté dictionnaire, mais non activés en base.

## Code Map

### Navigation et accès

| Fichier | Risque | Action |
| --- | --- | --- |
| `src/components/layout/Sidebar.tsx` | menus visibles au mauvais profil | consommer labels/features depuis `accountProfile` |
| `src/components/layout/BottomNav.tsx` | navigation mobile générique | variantes profil depuis `accountProfile` |
| `src/App.tsx` | accès URL direct | bloquer via `canAccessAccountPage()` |
| `src/lib/rbac.ts` | vocabulaire agence dans descriptions | à harmoniser progressivement via dictionnaire |

### Pages métier

| Fichier | Risque | Action |
| --- | --- | --- |
| `src/pages/Dashboard.tsx` | KPIs trop agence | utiliser labels et features |
| `src/pages/Parametres.tsx` | NINEA/RC trop centraux | rendre secondaires pour individual |
| `src/pages/Paiements.tsx` | vocabulaire encaissements/agence | labels dynamiques |
| `src/pages/Contrats.tsx` | commission visible | masquer avec `features.canUseCommissions` |
| `src/pages/Documents.tsx` | entités bailleurs visibles | masquer catégories non pertinentes |
| `src/pages/TableauDeBordFinancierGlobal.tsx` | rapport bailleur / commissions | variantes propriétaire déjà commencées |
| `src/pages/Welcome.tsx` | aiguillage trop limité | future Phase 2 : `organization_type` |

### Documents

| Fichier | Risque | Action |
| --- | --- | --- |
| `src/lib/pdf.ts` | mandataire/NINEA/RC hors contexte | conditions via settings + account profile |
| `public/templates/contrat_location.txt` | clauses agence dans tous les cas | variante légère Phase 1, partiels Phase 3 |
| `public/templates/mandat_gerance.txt` | non pertinent pour propriétaire | génération bloquée si individual |
| `src/lib/templates/*.ts` | templates legacy agence | à basculer vers partiels Phase 3 |

## Commandes d'audit

```powershell
rg -n "agence|Agence|AGENCE|bailleur|Bailleur|commission|Commission|mandat|Mandat|NINEA|RC|mandataire|Mandataire|équipe|Équipe" src --glob "*.tsx" --glob "*.ts"
```

```powershell
rg -n "is_bailleur_account|organization_type|document_mode|enabled_modules" src supabase --glob "*.ts" --glob "*.tsx" --glob "*.sql"
```

## Prochaine phase

La Phase 1 doit continuer à brancher les écrans visibles sur `accountProfile` et `ADAPTIVE_DICTIONARY`, puis vérifier un vrai compte bailleur individuel connecté. La Phase 2 ajoutera `organization_type`, `document_mode` et `enabled_modules` en base avec backfill agence par défaut.
