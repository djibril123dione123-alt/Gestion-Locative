# Autopilot Engine V3.1 — Documentation de référence

## Vue d'ensemble

L'Autopilot Engine est un système de traitement asynchrone côté base de données (PL/pgSQL + pg_cron). Il garantit que chaque action métier génère les bons effets de bord sans bloquer l'utilisateur.

## Architecture

```
Action métier (paiement créé, contrat activé…)
        │
        ▼
  event_outbox     ← Table d'événements immuable, source de vérité
        │
        ▼
   job_queue       ← Jobs typés avec priorité, retry et statut
        │
        ▼
   Workers         ← fn_worker_finance / fn_worker_analytics
        │
        ▼
  ledger_entries   ← Mouvements financiers immuables
  kpi_daily        ← KPIs agrégés quotidiennement
  kpi_monthly      ← KPIs consolidés mensuellement
  system_health    ← Snapshot de santé toutes les 30 min
```

## Tables principales

### `event_outbox`
Enregistre chaque événement métier. **Ne jamais supprimer ou modifier une entrée.**

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | uuid | Identifiant unique |
| `event_type` | text | Ex: `paiement.created`, `contrat.activated` |
| `agency_id` | uuid | Tenant concerné |
| `payload` | jsonb | Données brutes de l'événement |
| `status` | text | `pending` → `processed` → `failed` |
| `created_at` | timestamptz | Timestamp immuable |

### `job_queue`
Jobs créés par les triggers sur `event_outbox`.

| Priorité | Type de job | Worker |
|----------|-------------|--------|
| 1 | `GENERATE_LEDGER` | `fn_worker_finance` |
| 2 | `RECONCILE_FINANCE` | `fn_worker_finance` |
| 4 | `KPI_DAILY_AGGREGATION` | `fn_worker_analytics` |
| 5 | `KPI_MONTHLY_AGGREGATION` | `fn_worker_analytics` |
| 8 | `SEND_NOTIFICATION` | `fn_worker_notification` |

### `ledger_entries`
Journal comptable immuable. **RLS interdit UPDATE et DELETE.**

## Workers

### `fn_worker_finance()`
- Traite les jobs `GENERATE_LEDGER` et `RECONCILE_FINANCE`
- Crée les entrées dans `ledger_entries`
- Applique les contraintes de cohérence `part_a + part_b = montant_total`
- Schedulé toutes les **15 minutes** via pg_cron

### `fn_worker_analytics()`
- Agrège les KPIs dans `kpi_daily` et `kpi_monthly`
- Calcule MRR, ARR, taux de recouvrement, churn_rate
- Schedulé toutes les **heures** via pg_cron

### `fn_snapshot_health()`
- Capture l'état du système dans `system_health`
- Mesure : backlog jobs, orphan events, ledger_drift, temps moyen de traitement
- Schedulé toutes les **30 minutes** via pg_cron

## Scheduling pg_cron

```sql
-- Vérifier que les jobs sont planifiés
SELECT jobname, schedule, command, active FROM cron.job;

-- Logs d'exécution
SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 20;

-- Relancer un job manuellement (debug)
SELECT fn_worker_finance();
SELECT fn_worker_analytics();
SELECT fn_snapshot_health();
```

**PRÉREQUIS** : L'extension `pg_cron` doit être activée dans  
Supabase Dashboard → Project Settings → Extensions → pg_cron.

## Diagnostics

### Vérifier les événements bloqués
```sql
SELECT COUNT(*), event_type
FROM event_outbox
WHERE status = 'pending' AND created_at < NOW() - INTERVAL '15 minutes'
GROUP BY event_type;
```

### Vérifier les jobs en échec
```sql
SELECT id, type, status, error_message, retry_count, created_at
FROM job_queue
WHERE status = 'failed'
ORDER BY created_at DESC;
```

### Vérifier la dérive du ledger
```sql
SELECT
  p.id,
  p.montant_total,
  p.part_agence + p.part_bailleur AS somme_parts,
  p.montant_total - (p.part_agence + p.part_bailleur) AS drift
FROM paiements p
WHERE p.part_agence + p.part_bailleur != p.montant_total
  AND p.statut != 'annule';
```

## Règles immuables

1. **Ne jamais modifier `event_outbox`** — c'est le registre d'audit financier.
2. **Ne jamais supprimer `ledger_entries`** — seuls les reversals sont permis.
3. **Ne pas réécrire l'engine** — V3.1 est la version gelée. Toute évolution se fait par migration additive.
4. **Toujours tester fn_worker_finance() manuellement** après une migration qui touche `paiements` ou `contrats`.
