# Templates 100% paramétrables - Résumé des modifications

## Objectif atteint

Tous les modèles de contrats et mandats sont maintenant **entièrement paramétrables** par agence. Plus aucune valeur en dur dans les templates.

## Modifications effectuées

### 1. Base de données

**Migration** : `add_agency_manager_city_fields.sql`

Trois nouveaux champs ajoutés à `agency_settings` :

| Champ | Type | Défaut | Description |
|-------|------|--------|-------------|
| `manager_id_type` | text | 'CNI' | Type de pièce d'identité (CNI, Passeport, Carte consulaire) |
| `manager_id_number` | text | null | Numéro de la pièce d'identité |
| `city` | text | 'Dakar' | Ville de l'agence (utilisé dans "Fait à...") |

### 2. Templates mis à jour

#### a) Contrat de location (`src/lib/templates/contrat.ts`)

**Avant (valeur en dur)** :
```text
M. {{bailleur_prenom}} {{bailleur_nom}} (Propriétaire),
représenté(e) par M. PAPA MOUHAMADOU FALL CNI n° 1761198600458, mandataire
...
Fait à Dakar, le {{date_du_jour}}
```

**Après (100% paramétrable)** :
```text
M. {{bailleur_prenom}} {{bailleur_nom}} (Propriétaire),
représenté(e) par M. {{representant_nom}}, {{representant_fonction}} de {{agence_nom}},
{{manager_id_type}} n° {{manager_id_number}}, mandataire
...
Fait à {{city}}, le {{date_du_jour}}
```

**Variables ajoutées** :
- `{{manager_id_type}}` : Type de pièce (CNI, Passeport, etc.)
- `{{manager_id_number}}` : Numéro de la pièce
- `{{city}}` : Ville de signature du contrat

**Signature mise à jour** :
```text
Le Locataire                                                Le Mandataire
(Signature)                                                 (Signature)
                                                            {{agence_nom}}
```

#### b) Mandat de gérance (`src/lib/templates/mandat.ts`)

**Avant (valeurs en dur)** :
```text
Et la société CONFORT IMMO ARCHI, domiciliée à Ouakam cité Comico,
en face de l'école 6, NINEA : 004786317 / RC : SN.DKR.2016.M.27828,
représentée par M. PAPA MOUHAMADOU FALL, Chef d'agence
...
Fait à Dakar, le {{date_du_jour}}
Le Manager CONFORT IMMO ARCHI
```

**Après (100% paramétrable)** :
```text
Et la société {{agence_nom}}, domiciliée à {{agence_adresse}},
NINEA : {{agence_ninea}} / RC : {{agence_rc}},
représentée par M./Mme {{representant_nom}}, {{representant_fonction}}
...
Fait à {{city}}, le {{date_du_jour}}
Le {{representant_fonction}}
{{agence_nom}}
```

**Variables ajoutées** :
- Toutes les infos agence sont maintenant des variables
- Ville paramétrable
- Fonction du représentant dynamique

### 3. Interface utilisateur

**Page Paramètres** (`src/pages/Parametres.tsx`)

Nouveaux champs dans l'onglet **Informations générales** :

1. **Type de pièce d'identité du représentant**
   - Menu déroulant : CNI / Passeport / Carte consulaire
   - Valeur par défaut : CNI

2. **Numéro de pièce d'identité**
   - Champ texte
   - Placeholder : "ex: 1761198600458"

3. **Ville de l'agence**
   - Champ texte
   - Placeholder : "ex: Dakar, Thiès, Saint-Louis"
   - Valeur par défaut : Dakar

**Message d'alerte ajouté** :
```
⚠️ Informations du représentant légal
Ces informations apparaîtront dans les contrats de location et mandats de gérance.
Assurez-vous qu'elles sont exactes et à jour.
```

### 4. Helpers mis à jour

**`src/lib/templates/helpers.ts`**

Interface `AgencySettings` mise à jour avec :
```typescript
manager_id_type?: string;
manager_id_number?: string;
city?: string;
```

## Variables disponibles par document

### Contrat de location

**Variables agence** :
- `{{agence_nom}}` : Nom de l'agence
- `{{agence_adresse}}` : Adresse complète
- `{{agence_telephone}}` : Numéro de téléphone
- `{{agence_email}}` : Email
- `{{agence_site_web}}` : Site web (optionnel)
- `{{agence_ninea}}` : NINEA (optionnel)
- `{{agence_rc}}` : Registre de Commerce (optionnel)
- `{{agence_representant_nom}}` : Nom du représentant
- `{{agence_representant_fonction}}` : Fonction (Gérant, Directeur, etc.)
- `{{agence_manager_id_type}}` : Type de pièce (CNI, Passeport, etc.)
- `{{agence_manager_id_number}}` : Numéro de pièce
- `{{agence_city}}` : Ville
- `{{agence_mention_tribunal}}` : Tribunal compétent
- `{{agence_mention_penalites}}` : Texte des pénalités
- `{{agence_frais_huissier}}` : Montant frais d'huissier
- `{{agence_pied_page}}` : Pied de page personnalisé

**Variables bailleur** :
- `{{bailleur_prenom}}`, `{{bailleur_nom}}`, `{{bailleur_cni}}`, `{{bailleur_adresse}}`

**Variables locataire** :
- `{{locataire_prenom}}`, `{{locataire_nom}}`, `{{locataire_cni}}`, `{{locataire_adresse}}`

**Variables bien** :
- `{{bien_designation}}`, `{{bien_adresse}}`, `{{bien_destination}}`

**Variables contrat** :
- `{{contrat_duree_annees}}`, `{{contrat_date_debut}}`, `{{contrat_date_fin}}`
- `{{contrat_loyer_mensuel}}`, `{{contrat_loyer_lettres}}`
- `{{contrat_depot_garantie}}`, `{{contrat_depot_lettres}}`
- `{{contrat_date_du_jour}}`

### Mandat de gérance

**Variables agence** : (même liste que contrat)

**Variables bailleur** : (même liste)

**Variables bien** :
- `{{bien_adresse}}`, `{{bien_composition}}` (ex: "2 chambres salon, cuisine")

**Variables mandat** :
- `{{mandat_date_debut}}` : Date de début du mandat
- `{{mandat_taux_honoraires}}` : Pourcentage des honoraires
- `{{mandat_date_du_jour}}` : Date de signature

## Exemple d'utilisation

```typescript
import { generateContratText, ContratData } from '../lib/templates/contrat';
import { getAgencySettings } from '../lib/templates/helpers';

// 1. Charger les paramètres de l'agence
const agencySettings = await getAgencySettings(agencyId);

// 2. Préparer les données
const contratData: ContratData = {
  agence: {
    nom: agencySettings.nom_agence,
    adresse: agencySettings.adresse,
    telephone: agencySettings.telephone,
    email: agencySettings.email,
    site_web: agencySettings.site_web,
    ninea: agencySettings.ninea,
    rc: agencySettings.rc,
    representant_nom: agencySettings.representant_nom,
    representant_fonction: agencySettings.representant_fonction,
    manager_id_type: agencySettings.manager_id_type,      // ✅ Nouveau
    manager_id_number: agencySettings.manager_id_number,  // ✅ Nouveau
    city: agencySettings.city,                            // ✅ Nouveau
    logo_url: agencySettings.logo_url,
    couleur_primaire: agencySettings.couleur_primaire,
    couleur_secondaire: agencySettings.couleur_secondaire,
    mention_tribunal: agencySettings.mention_tribunal,
    mention_penalites: agencySettings.mention_penalites,
    pied_page: agencySettings.pied_page_personnalise,
    frais_huissier: agencySettings.frais_huissier,
  },
  bailleur: {
    prenom: bailleur.prenom,
    nom: bailleur.nom,
    cni: bailleur.piece_identite,
    adresse: bailleur.adresse,
  },
  locataire: {
    prenom: locataire.prenom,
    nom: locataire.nom,
    cni: locataire.piece_identite,
    adresse: locataire.adresse_personnelle,
  },
  bien: {
    adresse: unite.immeuble.adresse,
    designation: unite.nom,
    destination: contrat.destination,
  },
  contrat: {
    duree_annees: 1,
    date_debut: '01/01/2024',
    date_fin: '31/12/2024',
    loyer_mensuel: 150000,
    loyer_lettres: 'cent cinquante mille francs CFA',
    depot_garantie: 300000,
    depot_lettres: 'trois cent mille francs CFA',
    date_du_jour: '15 janvier 2024',
  },
};

// 3. Générer le texte du contrat
const contratText = generateContratText(contratData);

// 4. Utiliser le texte dans la génération PDF
// ... votre logique de génération PDF
```

## Cas d'usage multi-agences

### Agence 1 : CONFORT IMMO ARCHI (Dakar)
```
Représentant : M. PAPA MOUHAMADOU FALL
Fonction : Chef d'agence
CNI n° 1761198600458
Ville : Dakar
```

### Agence 2 : THIÈS IMMO (Thiès)
```
Représentant : Mme FATOU DIOP
Fonction : Directrice
Passeport n° A12345678
Ville : Thiès
```

### Agence 3 : SAINT-LOUIS GESTION (Saint-Louis)
```
Représentant : M. OMAR NDIAYE
Fonction : Gérant
CNI n° 9876543210123
Ville : Saint-Louis
```

**Résultat** : Chaque agence génère des contrats avec ses propres informations, sans aucune modification de code.

## Résumé des fichiers modifiés

| Fichier | Type | Modification |
|---------|------|--------------|
| `supabase/migrations/add_agency_manager_city_fields.sql` | Migration | 3 nouveaux champs |
| `src/lib/templates/contrat.ts` | Template | Variables agence complètes |
| `src/lib/templates/mandat.ts` | Template | Variables agence complètes |
| `src/lib/templates/helpers.ts` | Helper | Interface mise à jour |
| `src/pages/Parametres.tsx` | UI | 3 nouveaux champs de saisie |

## Points de contrôle

### ✅ Plus de valeurs en dur
- ❌ ~~`M. PAPA MOUHAMADOU FALL CNI n° 1761198600458`~~
- ✅ `M. {{representant_nom}} {{manager_id_type}} n° {{manager_id_number}}`

### ✅ Ville paramétrable
- ❌ ~~`Fait à Dakar, le {{date_du_jour}}`~~
- ✅ `Fait à {{city}}, le {{date_du_jour}}`

### ✅ Agence paramétrable
- ❌ ~~`Le Manager CONFORT IMMO ARCHI`~~
- ✅ `Le {{representant_fonction}} {{agence_nom}}`

### ✅ Identification du représentant flexible
- Support CNI, Passeport, Carte consulaire
- Si numéro non renseigné, affiche uniquement le type
- Format automatique : "CNI n° 1234567" ou "Passeport"

## Bénéfices

1. **Multi-tenant complet** : Chaque agence a ses propres documents personnalisés
2. **Flexibilité géographique** : Agences dans différentes villes du Sénégal
3. **Conformité légale** : Informations exactes du représentant légal
4. **Maintenance simplifiée** : Modifications via interface, pas de code
5. **Évolutivité** : Facile d'ajouter de nouvelles variables si besoin

## Prochaines étapes recommandées

1. **Intégrer dans la génération PDF**
   - Modifier `src/pages/Contrats.tsx` pour utiliser les nouveaux templates
   - Ajouter le logo et les couleurs dans les PDF générés

2. **Valider les données obligatoires**
   - Ajouter une validation côté UI pour les champs critiques
   - Empêcher la génération de documents si informations manquantes

3. **Prévisualisation**
   - Ajouter un bouton "Aperçu" dans les Paramètres
   - Montrer un exemple de contrat avec les données de l'agence

4. **Export des templates**
   - Permettre aux agences d'exporter leurs templates en PDF/DOCX
   - Pour vérification/validation par un avocat

5. **Historique des modifications**
   - Logger les changements de paramètres (audit trail)
   - Savoir qui a modifié quoi et quand

## Support

En cas de questions :
- Les valeurs par défaut sont définies dans chaque template
- Si un champ est vide, un fallback raisonnable est utilisé
- Exemple : `representant_nom || 'Le Représentant'`

La base est maintenant 100% paramétrable et prête pour un usage multi-agences en production.
