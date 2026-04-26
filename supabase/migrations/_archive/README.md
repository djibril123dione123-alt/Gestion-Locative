# Migrations archivées

Ces fichiers sont conservés **à titre historique uniquement**. Ils ont été
appliqués une fois sur la base Supabase, puis annulés ou recouverts par des
migrations ultérieures. Ils ne doivent **plus jamais** être rejoués sur une
nouvelle base — utilisez la séquence canonique dans `../`.

## Inventaire

### Policies temporaires de seed (annulées)
- `20260116153838_temp_allow_seed_insertions.sql`
- `20260116153903_temp_allow_anon_insertions.sql`

→ Recouvertes par `20260425000006_cleanup_agencies_insert_policies.sql` qui
les `DROP` explicitement.

### Historique des correctifs INSERT sur `agencies` (7 itérations cumulées)
- `20260110003141_add_agencies_insert_policy.sql`
- `20260110013927_fix_agencies_insert_policy.sql`
- `20260110015449_clean_duplicate_agencies_insert_policy.sql`
- `20260113193843_fix_agencies_insert_rls_policy.sql`
- `20260113194029_fix_agencies_rls_with_auth_check.sql`
- `20260113195044_fix_agencies_insert_policy_authenticated_role.sql`

→ Toutes recouvertes par :
- `20260425000006_cleanup_agencies_insert_policies.sql` (DROP de toutes les
  variantes + recréation propre pour `super_admin`).
- `20260425000007_onboarding_refonte.sql` (suppression de la policy
  `agencies_insert_authenticated` trop large ; les agences sont désormais
  créées exclusivement via la RPC `approve_agency_request` SECURITY DEFINER
  ou par la Console super_admin).

### Doublon de policies
- `20260110003936_remove_duplicate_rls_policies.sql`

→ Devenue redondante après les nettoyages d'avril 2026.

## Pourquoi les garder ?

Pour pouvoir auditer l'historique sécurité et comprendre comment l'état
actuel a été atteint, sans polluer la liste de migrations active.
