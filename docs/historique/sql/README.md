# Historique SQL — Artefacts de conception

> ⚠️ **Ces fichiers ne doivent PAS être appliqués directement sur Supabase.**

---

## Fichiers présents

### `MIGRATION_CRITIQUE_A_APPLIQUER.sql`

- **Date de création** : 2026-01-07
- **Rôle original** : Brouillon de travail listant les corrections critiques identifiées lors d'un audit interne (colonnes manquantes, soft-delete, triggers d'audit, vue matérialisée).
- **Statut** : **Décomposé et appliqué** via les migrations officielles suivantes :
  - `20260127193800_corrections_critiques_01_colonnes.sql` — colonnes `commission`, `debut_contrat`, `destination`, renommage `pourcentage_agence → commission`, contraintes CHECK
  - `20260127193828_corrections_critiques_03_soft_delete_audit.sql` — `deleted_at`, `actif` sur `paiements`/`depenses`, fonction `log_table_changes()`, triggers audit
  - `20260107224202_multi_tenant_01_agencies_v3.sql` — table `agency_settings` multi-tenant
- **Éléments non migrés** (code mort) : vue matérialisée `dashboard_kpis`, fonction `get_loyers_impayes` — non utilisées dans le frontend, non prioritaires.

---

### `MIGRATION_MULTI_TENANT.sql`

- **Date de création** : Antérieure à octobre 2025 (estimation)
- **Rôle original** : Document source de conception de l'architecture multi-tenant SaaS. Décrivait la création de 9 nouvelles tables et la modification des tables existantes pour l'isolation par `agency_id`.
- **Statut** : **Entièrement appliqué** via la migration officielle :
  - `20260107224202_multi_tenant_01_agencies_v3.sql` — tables `agencies`, `invitations`, `notifications`, `documents`, `inventaires`, `interventions`, `evenements`, `subscription_plans`, `subscriptions`, colonnes `agency_id` sur toutes les tables métier, RLS, policies, triggers.
- **Section 12 (données initiales)** : Données de migration vers "Confort Immo Archi" appliquées manuellement lors de la mise en production initiale. Ne pas ré-appliquer.

---

## Règle de gestion

Ces fichiers sont conservés **à titre documentaire uniquement** pour tracer l'histoire des décisions d'architecture.

```
INTERDIT : appliquer ces fichiers via Supabase Dashboard ou CLI
INTERDIT : les référencer dans des scripts de déploiement
AUTORISÉ : les lire pour comprendre les décisions initiales
```

Toute nouvelle migration doit être créée dans `supabase/migrations/` avec un timestamp unique au format `YYYYMMDDHHmmss_description.sql` et appliquée via `supabase db push`.

---

*Archivé le 2026-06-11 par audit CTO.*
