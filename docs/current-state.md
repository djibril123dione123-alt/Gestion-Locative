# État actuel du produit

Dernière mise à jour : 2026-06-03.

Samay Këur est une plateforme SaaS de gestion locative pour agences, gestionnaires et bailleurs individuels en Afrique francophone.

## Surfaces en production

| Surface | Dépôt | Domaine | Rôle |
|---|---|---|---|
| Application SaaS | `djibril123dione123-alt/app.SamayKeur.com.git` | `app.samaykeur.com` | Espace connecté, métier, données privées |
| Vitrine publique | `djibril123dione123-alt/SamayKeur.com.git` | `samaykeur.com` | Marketing, pages légales, `/verify` public |

Les deux projets doivent rester séparés. La vitrine ne doit pas être réintégrée dans l'app.

## Capacités produit actives

- Portefeuille locatif : bailleurs, biens, unités, locataires, contrats.
- Encaissements : paiements complets, paiements partiels, reliquats et impayés.
- Documents : quittances, factures, contrats, mandats, rapports bailleurs/propriétaires.
- GED : stockage, registre documentaire, QR de vérification publique.
- Finance : rapports, commissions agence, revenus propriétaires, exports.
- Administration : rôles, équipe, paramètres, abonnement, console admin.
- Profil bailleur individuel : UX simplifiée et bailleur unique interne.

## Mode bailleur individuel

En Phase 1, la source de vérité reste :

```txt
agencies.is_bailleur_account = true
```

Comportement attendu :

- l'utilisateur est le propriétaire principal de son espace ;
- les pages `Bailleurs`, `Mandats`, `Commissions agence` sont masquées si non pertinentes ;
- les formulaires qui exigent un bailleur utilisent automatiquement le bailleur interne unique ;
- les documents parlent de propriétaire direct, pas de mandataire ;
- le plan affiché par défaut est Starter si aucun abonnement payant réel n'est actif.

## Documents vérifiables

Les nouveaux QR générés par l'app doivent utiliser :

```txt
https://samaykeur.com/verify?token=...&ref=...&type=...
```

La route `/verify` vit côté vitrine et appelle l'Edge Function `verify-document`.

Types prioritaires :

- `quittance`
- `contrat`
- `mandat`
- `rapport_bailleur`
- `rapport_proprietaire`

## État connu et limites

- Le mode agence reste le fallback pour les anciens comptes.
- `organization_type`, `document_mode` et `enabled_modules` sont préparés progressivement, mais ne doivent pas être utilisés comme seule source tant que la migration produit n'est pas complète.
- L'offline-first est une cible de robustesse terrain. Les actions financières ne doivent pas être confirmées hors ligne.
- Les QR anciens ne changent pas automatiquement ; seuls les documents régénérés après déploiement utilisent la nouvelle URL publique.

## Checks obligatoires

```bash
npm run typecheck
npm run lint
npm run build
```

Pour la vitrine, exécuter les checks dans le projet vitrine séparé.
