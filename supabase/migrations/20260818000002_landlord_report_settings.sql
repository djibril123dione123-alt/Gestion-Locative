-- Migration: Landlord Report Settings & Cron

CREATE TABLE IF NOT EXISTS landlord_report_settings (
  bailleur_id uuid PRIMARY KEY REFERENCES bailleurs(id) ON DELETE CASCADE,
  agency_id uuid REFERENCES agencies(id) ON DELETE CASCADE,
  enabled boolean DEFAULT false,
  recipient_email text,
  frequency text DEFAULT 'monthly' CHECK (frequency IN ('monthly', 'quarterly')),
  send_day integer DEFAULT 1,
  send_time time DEFAULT '08:00',
  timezone text DEFAULT 'Africa/Dakar',
  last_sent_at timestamptz,
  next_send_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE landlord_report_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their agency landlord report settings"
  ON landlord_report_settings FOR SELECT
  USING (agency_id IN (
    SELECT agency_id FROM user_profiles WHERE id = auth.uid()
  ));

CREATE POLICY "Users can insert their agency landlord report settings"
  ON landlord_report_settings FOR INSERT
  WITH CHECK (agency_id IN (
    SELECT agency_id FROM user_profiles WHERE id = auth.uid()
  ));

CREATE POLICY "Users can update their agency landlord report settings"
  ON landlord_report_settings FOR UPDATE
  USING (agency_id IN (
    SELECT agency_id FROM user_profiles WHERE id = auth.uid()
  ));

-- Create the cron job if pg_cron is available
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_cron') THEN
    IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'landlord_report_worker') THEN
      PERFORM cron.schedule(
        'landlord_report_worker',
        '0 * * * *',
        'SELECT net.http_post(url := current_setting(''app.supabase_url'') || ''/functions/v1/landlord-report-worker'', headers := jsonb_build_object(''Authorization'', ''Bearer '' || current_setting(''app.service_role_key'')), body := ''{}''::jsonb)'
      );
    END IF;
  END IF;
END $$;
