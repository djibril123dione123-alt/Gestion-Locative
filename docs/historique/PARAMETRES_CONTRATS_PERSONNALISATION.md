# Personnalisation des Contrats et Mandats - Documentation

## Résumé des modifications

La personnalisation des paramètres d'agence s'applique maintenant **réellement** aux PDFs de contrats et mandats. Tous les textes en dur ont été remplacés par des variables dynamiques.

## 1. Nouveaux champs ajoutés à `agency_settings`

### Champs d'identification
- `rc` : Registre de commerce de l'agence
- `representant_nom` : Nom complet du représentant légal
- `representant_fonction` : Fonction (Gérant, Directeur, etc.)
- `manager_id_type` : Type de pièce d'identité (CNI, Passeport)
- `manager_id_number` : Numéro de la pièce d'identité
- `city` : Ville de l'agence (pour juridiction)

### Champs financiers personnalisables
- `penalite_retard_montant` : Montant des pénalités par jour de retard (défaut: 1000 FCFA)
- `penalite_retard_delai_jours` : Nombre de jours de pénalités avant procédure (défaut: 3 jours)
- `frais_huissier` : Montant des frais d'huissier (défaut: 37 500 FCFA)

### Mentions légales personnalisables
- `mention_tribunal` : Texte de la juridiction compétente
- `mention_penalites` : Texte complet sur les pénalités de retard
- `mention_frais_huissier` : Texte sur les frais d'huissier
- `mention_litige` : Texte sur les frais en cas de litige

## 2. Modifications du code

### Fichier `src/lib/pdf.ts`

#### Interface `AgencySettings` étendue
```typescript
interface AgencySettings {
  // ... champs existants
  penalite_retard_montant: number | null;
  penalite_retard_delai_jours: number | null;
  frais_huissier: number | null;
  mention_tribunal: string | null;
  mention_penalites: string | null;
  mention_frais_huissier: string | null;
  mention_litige: string | null;
}
```

#### Fonction `loadAgencySettings()` mise à jour
- Charge maintenant TOUS les champs de personnalisation
- Valeurs par défaut cohérentes pour tous les nouveaux champs

#### Fonction `generateContratPDF()` améliorée
Nouvelles variables injectées :
- `{{penalite_montant}}` : Montant formaté avec devise
- `{{penalite_delai}}` : Nombre de jours
- `{{frais_huissier}}` : Montant formaté avec devise
- `{{mention_tribunal}}` : Texte juridiction
- `{{mention_penalites}}` : Texte pénalités
- `{{mention_frais_huissier}}` : Texte frais huissier
- `{{mention_litige}}` : Texte litige

#### Fonction `generateMandatBailleurPDF()` améliorée
Nouvelles variables injectées :
- `{{mention_tribunal}}` : Pour la juridiction compétente
- `{{mention_penalites}}` : Clauses pénalités
- `{{mention_frais_huissier}}` : Clauses frais huissier

## 3. Templates mis à jour

### `public/templates/contrat_location.txt`

**Avant (texte en dur) :**
```
des pénalités qui s'élèvent à 1000fcfa par jour de retard,
seront appliquées pendant 03 jours.
...
une somme de 37 500 FCFA est prélevée sur la caution
```

**Après (variables dynamiques) :**
```
des pénalités qui s'élèvent à {{penalite_montant}} par jour de retard,
seront appliquées pendant {{penalite_delai}} jours.
...
{{mention_frais_huissier}} Le montant des frais d'huissier s'élève à {{frais_huissier}}.
```

### `public/templates/mandat_gerance.txt`

**Avant (texte en dur) :**
```
En cas de litige, le Tribunal de commerce de Dakar est seul compétent.
```

**Après (variables dynamiques) :**
```
{{mention_tribunal}}
{{mention_penalites}}
{{mention_frais_huissier}}
```

## 4. Utilisation

### Dans l'écran Paramètres
Les administrateurs peuvent maintenant personnaliser :

1. **Informations juridiques** :
   - Registre de commerce
   - Nom et fonction du représentant
   - Type et numéro de pièce d'identité

2. **Pénalités et frais** :
   - Montant des pénalités par jour (en XOF/EUR/USD selon devise)
   - Délai avant procédure judiciaire (en jours)
   - Frais d'huissier (en XOF/EUR/USD)

3. **Mentions légales** :
   - Texte du tribunal compétent
   - Clause complète sur les pénalités
   - Clause sur les frais d'huissier
   - Clause sur les litiges

### Impact sur les PDFs

Quand un contrat ou mandat est généré :
1. Les valeurs sont chargées depuis `agency_settings`
2. Les montants sont automatiquement formatés avec la devise choisie
3. Toutes les variables `{{}}` sont remplacées par les valeurs réelles
4. Le PDF généré reflète exactement les paramètres sauvegardés

## 5. Valeurs par défaut

Si aucune valeur n'est configurée, le système utilise :
- Pénalités : 1 000 FCFA par jour pendant 3 jours
- Frais huissier : 37 500 FCFA
- Tribunal : Dakar
- Mentions légales : Textes standards conformes à la loi sénégalaise

## 6. Migration de la base de données

Une migration a été appliquée pour ajouter les nouvelles colonnes :
- Fichier : `add_agency_settings_contract_fields.sql`
- Toutes les colonnes ont des valeurs par défaut appropriées
- Migration compatible avec les données existantes

## 7. Avantages

✅ **Personnalisation complète** : Chaque agence peut adapter les contrats à ses besoins
✅ **Conformité légale** : Les mentions peuvent être ajustées selon la juridiction
✅ **Multi-devise** : Les montants s'adaptent à la devise choisie (XOF, EUR, USD)
✅ **Facilité d'utilisation** : Tout se configure dans l'écran Paramètres
✅ **Cohérence** : Les mêmes paramètres s'appliquent à tous les documents

## 8. Tests recommandés

1. Modifier les paramètres dans l'écran Paramètres
2. Générer un contrat de location
3. Vérifier que les valeurs personnalisées apparaissent dans le PDF
4. Générer un mandat de gérance
5. Vérifier que les mentions personnalisées sont présentes
6. Tester avec différentes devises (XOF, EUR, USD)
7. Vérifier le formatage des montants

## Notes techniques

- Les templates utilisent la syntaxe `{{variable}}` pour le remplacement
- Le formatage des montants respecte la devise configurée
- Les valeurs dynamiques apparaissent en **gras** dans les PDFs
- Les mentions vides ne cassent pas la génération (chaînes vides)
