-- Add cron job for send-sms worker
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_cron') THEN
    IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sms_queue_worker') THEN
      PERFORM cron.schedule(
        'sms_queue_worker',
        '*/5 * * * *',
        'SELECT net.http_post(url := current_setting(''app.supabase_url'') || ''/functions/v1/send-sms'', headers := jsonb_build_object(''Authorization'', ''Bearer '' || current_setting(''app.service_role_key'')), body := ''{}''::jsonb)'
      );
    END IF;
    RAISE NOTICE 'pg_cron : sms_queue_worker planifié.';
  ELSE
    RAISE NOTICE 'pg_cron non disponible. Planifiez manuellement.';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron erreur (non bloquant) : %', SQLERRM;
END $$;
