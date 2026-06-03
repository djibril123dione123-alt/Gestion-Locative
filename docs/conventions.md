# Conventions

Ce document centralise les conventions qui doivent rester stables dans toute l'application.

## Personnes

Ordre unique :

```txt
Prénom Nom
```

Utiliser un helper de formatage partagé plutôt que concaténer `nom` et `prenom` à la main.

## Comptes et rôles

Ne pas confondre :

- type de compte ;
- rôle utilisateur ;
- plan ;
- mode documentaire ;
- modules activés.

Les composants doivent consommer les helpers `accountProfile` et `features`.

## Documents

Types stables :

- `quittance`
- `facture`
- `contrat`
- `mandat`
- `rapport_bailleur`
- `rapport_proprietaire`

Les nouveaux QR publics utilisent toujours :

```txt
https://samaykeur.com/verify?token=...&ref=...&type=...
```

## Git et livraison

- Pas de commit/push sans validation explicite.
- Commits séparés pour app et vitrine.
- Pas de cleanup massif mélangé à une correction métier.
- Ne jamais committer `.env.local`, logs ou fichiers temporaires.

## Checks

Avant push app :

```bash
npm run typecheck
npm run lint
npm run build
```

Avant push vitrine :

```bash
npm run typecheck
npm run build
```
