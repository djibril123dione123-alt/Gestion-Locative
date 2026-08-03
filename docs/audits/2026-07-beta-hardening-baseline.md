# Baseline de durcissement pre-beta - 16 juillet 2026

## Perimetre

- Branche observee : `main`.
- Depot : application React/Vite et backend Supabase de Samay Keur.
- Environnement : poste local Windows, sans deploiement ni mutation d'un environnement distant.
- Les modifications preexistantes et concurrentes du worktree ont ete preservees.

## Resultats reproductibles

| Controle | Resultat | Qualification |
| --- | --- | --- |
| `npm run typecheck` | code 0 | CONFIRME PAR UN TEST |
| `npm run lint` | code 0 | CONFIRME PAR UN TEST |
| `npm run test:unit` | 165 tests reussis, 26 fichiers | CONFIRME PAR UN TEST |
| `npm run build` | code 0, bundle Vite de production genere | CONFIRME PAR UN TEST |
| `git diff --check` | code 0 | CONFIRME PAR UN TEST |
| `npm audit --omit=dev --audit-level=high` | 0 vulnerabilite connue | CONFIRME PAR UN TEST |
| Playwright sur preview de production | 70/70 tests reussis : 14 Chromium, 14 Firefox, 14 WebKit, 14 Mobile Chrome, 14 Mobile Safari | CONFIRME PAR UN TEST |
| `supabase test db` | impossible localement : aucune pile PostgreSQL/Supabase ou Docker disponible | NON PROUVE LOCALEMENT |
| restauration d'une sauvegarde | scripts et workflow presents, aucun exercice complet execute | NON PROUVE |

Les tests navigateur couvrent l'authentification publique, l'inscription, la tarification et la redirection des routes protegees. Ils ne constituent pas une preuve des workflows metier authentifies.

## Durcissements implementes

- Commandes serveur ajoutees pour les mutations d'administration tenant et super-admin.
- Creation, renouvellement et mise a jour des contrats delegues a des commandes transactionnelles serveur.
- Paiements proteges par une cle d'idempotence et une empreinte de payload ; annulation centralisee cote serveur.
- Unicite des ecritures ledger renforcee par contraintes SQL.
- Snapshots documentaires et financiers persistants ajoutes pour rendre les documents reproductibles.
- Registre documentaire, verification QR et fermeture de compte exposes par des commandes serveur controlees.
- Assets d'identite agence prives avec validation serveur et URLs signees.
- `FORCE ROW LEVEL SECURITY` et restrictions de lecture/ecriture ajoutees aux surfaces critiques et legacy.
- Tests pgTAP statiques et d'isolation runtime ajoutes sous `supabase/tests`.
- CI etendue aux tests unitaires, au build, a l'audit des dependances, au smoke test Chromium et aux tests Supabase isoles.
- Telemetrie filtree, politique CSP/headers renforcee et caches locaux sensibles limites au tenant.
- Workflow de sauvegarde et procedure de verification de restauration documentes.

## Preuves encore manquantes

- Application des migrations `20260715000001` a `20260715000012` sur une base isolee puis distante.
- Execution verte de tous les tests pgTAP sur l'etat final de la base.
- Test de concurrence reel de creation/annulation de paiements et des workflows contrat.
- Parcours E2E authentifies : agence, bien, unite, occupant, bail, paiement, quittance et rapport bailleur.
- Exercice de restauration reel avec RPO et RTO mesures.
- Configuration et alertes de monitoring prouvees sur l'environnement cible.
- Validation de la retention, de la fermeture de compte et des URLs signees sur un projet Supabase isole.

## Decision

Le code frontend est compilable, les suites unitaires et les smoke tests publics sont verts, et les chemins critiques ont ete durcis dans le depot. Le statut reste toutefois `NO-GO` pour une production payante ouverte tant que les migrations et tests RLS ne sont pas executes sur une base isolee, qu'un exercice de restauration n'est pas reussi et que les workflows metier authentifies ne disposent pas de preuves E2E.

Une beta fermee ne peut etre envisagee qu'apres ces trois gates, sur un nombre limite d'agences, avec monitoring et support rapproches.
