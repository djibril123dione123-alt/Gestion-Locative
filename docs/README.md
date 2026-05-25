# Documentation Samay Këur

Cette documentation est organisee pour separer les besoins des lecteurs :

- produit et vision : README principal ;
- architecture et decisions techniques : documents dans `/docs` ;
- exploitation : deployment, monitoring et runbooks ;
- historique : anciens audits et notes dans `/docs/historique`.

## Navigation rapide

| Domaine | Document |
|---|---|
| Etat actuel du produit | [current-state.md](current-state.md) |
| Architecture globale | [architecture.md](architecture.md) |
| Adaptabilite multi-profils | [adaptive-profiles-phase-0.md](adaptive-profiles-phase-0.md) |
| Separation vitrine / app | [marketing-app-separation.md](marketing-app-separation.md) |
| Securite | [security.md](security.md) |
| Finance engine | [finance-engine.md](finance-engine.md) |
| Paiements | [payments.md](payments.md) |
| Offline-first | [offline-first.md](offline-first.md) |
| GED et stockage | [document-storage.md](document-storage.md) |
| RBAC et multi-tenant | [rbac.md](rbac.md) |
| Edge Functions | [edge-functions.md](edge-functions.md) |
| Deploiement | [deployment.md](deployment.md) |
| Monitoring | [monitoring.md](monitoring.md) |
| Roadmap | [roadmap.md](roadmap.md) |
| Contribution | [contributing.md](contributing.md) |
| Design system | [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) |
| Brand guidelines | [BRAND_GUIDELINES.md](BRAND_GUIDELINES.md) |

## Convention

- README : vue d'ensemble courte.
- Docs metier : logique produit et invariants.
- Docs techniques : architecture, securite, fonctions, deploiement.
- Runbooks : actions operationnelles en cas d'incident.

## Conventions transverses

- Les noms de personnes s'affichent et se saisissent toujours dans l'ordre `Prenom Nom`.
- Les composants doivent utiliser `formatPersonName(person)` au lieu de recreer l'ordre manuellement.
- Les composants produit ne doivent pas lire directement `is_bailleur_account`; ils doivent passer par `accountProfile`.
- La vitrine autonome vit dans `marketing/` et ne doit pas etre reintegree dans l'application React.
