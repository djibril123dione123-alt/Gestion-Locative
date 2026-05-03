BEGIN;

DROP POLICY IF EXISTS "outbox_insert_all" ON public.event_outbox;
CREATE POLICY "outbox_insert_service" ON public.event_outbox
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "event_insert_service" ON public.event_log;
CREATE POLICY "event_insert_service" ON public.event_log
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "ledger_insert_service" ON public.ledger_entries;
CREATE POLICY "ledger_insert_service" ON public.ledger_entries
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "snapshots_insert_service" ON public.financial_snapshots;
CREATE POLICY "snapshots_insert_service" ON public.financial_snapshots
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "snapshots_update_service" ON public.financial_snapshots;
CREATE POLICY "snapshots_update_service" ON public.financial_snapshots
  FOR UPDATE
  TO authenticated
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "health_insert" ON public.system_health;
CREATE POLICY "health_insert_service" ON public.system_health
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "kpi_daily_insert" ON public.kpi_daily;
CREATE POLICY "kpi_daily_insert_service" ON public.kpi_daily
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "kpi_daily_update" ON public.kpi_daily;
CREATE POLICY "kpi_daily_update_service" ON public.kpi_daily
  FOR UPDATE
  TO authenticated
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "kpi_monthly_insert" ON public.kpi_monthly;
CREATE POLICY "kpi_monthly_insert_service" ON public.kpi_monthly
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "kpi_monthly_update" ON public.kpi_monthly;
CREATE POLICY "kpi_monthly_update_service" ON public.kpi_monthly
  FOR UPDATE
  TO authenticated
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "cache_insert" ON public.cache_store;
CREATE POLICY "cache_insert_service" ON public.cache_store
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "cache_update" ON public.cache_store;
CREATE POLICY "cache_update_service" ON public.cache_store
  FOR UPDATE
  TO authenticated
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "cache_delete" ON public.cache_store;
CREATE POLICY "cache_delete_service" ON public.cache_store
  FOR DELETE
  TO authenticated
  USING (auth.role() = 'service_role');

ALTER TABLE public.event_outbox FORCE ROW LEVEL SECURITY;
ALTER TABLE public.event_log FORCE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_entries FORCE ROW LEVEL SECURITY;
ALTER TABLE public.financial_snapshots FORCE ROW LEVEL SECURITY;
ALTER TABLE public.system_health FORCE ROW LEVEL SECURITY;
ALTER TABLE public.kpi_daily FORCE ROW LEVEL SECURITY;
ALTER TABLE public.kpi_monthly FORCE ROW LEVEL SECURITY;
ALTER TABLE public.cache_store FORCE ROW LEVEL SECURITY;

COMMIT;