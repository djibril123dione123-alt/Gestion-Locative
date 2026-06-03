# Documentation Samay Këur

Cette documentation décrit l'application SaaS connectée. La vitrine publique est un projet séparé.

Dernière mise à jour : 2026-06-03.

## Navigation rapide

| Domaine | Document |
|---|---|
| État actuel du produit | [current-state.md](current-state.md) |
| Architecture globale | [architecture.md](architecture.md) |
| Adaptabilité multi-profils | [adaptive-profiles-phase-0.md](adaptive-profiles-phase-0.md) |
| Séparation vitrine / app | [marketing-app-separation.md](marketing-app-separation.md) |
| Sécurité | [security.md](security.md) |
| Finance engine | [finance-engine.md](finance-engine.md) |
| Paiements | [payments.md](payments.md) |
| Offline-first | [offline-first.md](offline-first.md) |
| GED et stockage | [document-storage.md](document-storage.md) |
| RBAC et multi-tenant | [rbac.md](rbac.md) |
| Edge Functions | [edge-functions.md](edge-functions.md) |
| Déploiement | [deployment.md](deployment.md) |
| Monitoring | [monitoring.md](monitoring.md) |
| Roadmap | [roadmap.md](roadmap.md) |
| Contribution | [contributing.md](contributing.md) |
| Design system | [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) |
| Brand guidelines | [BRAND_GUIDELINES.md](BRAND_GUIDELINES.md) |
| Conventions | [conventions.md](conventions.md) |

## Règles transverses

- L'app privée vit dans `App Samay Keur` et cible `app.samaykeur.com`.
- La vitrine publique vit dans le dépôt `SamayKeur.com.git` et cible `samaykeur.com`.
- Les QR documentaires publics doivent pointer vers `https://samaykeur.com/verify`.
- Les personnes s'affichent toujours dans l'ordre `Prénom Nom`.
- Ne pas confondre rôle utilisateur, type de compte, plan, mode documentaire et modules activés.
- Tout changement finance, RLS, document ou paiement doit passer par `npm run typecheck`, `npm run lint` et `npm run build`.

## Statut des docs

Les documents de ce dossier sont des références opérationnelles. Les notes historiques ou audits passés doivent rester dans `docs/historique` pour éviter de brouiller l'état courant.
