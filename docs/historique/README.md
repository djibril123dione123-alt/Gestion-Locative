# Historique des chantiers

Ce dossier regroupe les **22 documents de travail** produits au cours
du développement de Samay Këur (audits, plans d'amélioration, guides de
features successives, notes de migration, etc.).

Ils ont été déplacés ici depuis la racine du dépôt le **26 avril 2026**
pour alléger la racine, qui ne conserve désormais que :

- `README.md` — présentation publique du projet
- `SETUP.md` — guide d'installation
- `replit.md` — mémoire de l'agent Replit (état courant + historique
  des chantiers récents)

## Que faire de ces fichiers ?

Aucun de ces documents n'est référencé par le code, le build, ou un
script CI. Ils sont conservés à des fins **historiques uniquement** :

- `AUDIT_*.md`, `CORRECTIONS_*.md`, `IMPROVEMENTS_*.md`,
  `STATUT_*.md` → traces de chantiers terminés.
- `GUIDE_*.md`, `PARAMETRES_*.md`, `PLANS_*.md`,
  `TEMPLATES_*.md`, `ROADMAP_*.md` → notes fonctionnelles potentiellement
  utiles, mais qui devraient à terme être migrées dans un wiki ou
  fusionnées dans `README.md` / `SETUP.md`.
- `BACKUP_README.md`, `SEED_DATA_README.md`, `SENTRY_README.md`,
  `PLAYWRIGHT_README.md` → docs d'outils ; à promouvoir dans
  `docs/` si l'outil correspondant reste actif.

Si vous reprenez le projet, le résumé à jour de l'état du chantier se
trouve dans `replit.md` à la racine.
