-- fn_protect_agencies_billing_columns (migration précédente) bloque à raison
-- toute modification directe des colonnes de facturation par un admin
-- d'agence classique. Mais la policy RLS agency_tenant_update autorise
-- explicitement aussi is_super_admin() à modifier n'importe quelle agence —
-- un vrai super-admin doit donc pouvoir écraser ces colonnes depuis un futur
-- outil console, sans passer par un RPC dédié. Aucun code actuellement
-- déployé et atteignable n'utilise ce chemin (vérifié : seule la page
-- src/pages/Agences.tsx le fait, et un test dédié — legacyAdminRoute.test.ts —
-- garantit qu'elle n'est jamais montée dans l'app), donc ce n'est pas un
-- correctif de régression, seulement une mise en cohérence avec l'intention
-- déjà actée par la policy RLS.
CREATE OR REPLACE FUNCTION public.fn_protect_agencies_billing_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF current_user IN ('postgres', 'service_role', 'supabase_admin') OR public.is_super_admin() THEN
    RETURN NEW;
  END IF;

  IF NEW.plan IS DISTINCT FROM OLD.plan
     OR NEW.status IS DISTINCT FROM OLD.status
     OR NEW.trial_ends_at IS DISTINCT FROM OLD.trial_ends_at
     OR NEW.pilot_status IS DISTINCT FROM OLD.pilot_status
     OR NEW.first_payment_at IS DISTINCT FROM OLD.first_payment_at
     OR NEW.first_contract_at IS DISTINCT FROM OLD.first_contract_at
     OR NEW.activation_at IS DISTINCT FROM OLD.activation_at
     OR NEW.payment_provider IS DISTINCT FROM OLD.payment_provider
     OR NEW.payment_phone IS DISTINCT FROM OLD.payment_phone
     OR NEW.last_payment_at IS DISTINCT FROM OLD.last_payment_at
     OR NEW.next_renewal_at IS DISTINCT FROM OLD.next_renewal_at
     OR NEW.suspension_at IS DISTINCT FROM OLD.suspension_at
     OR NEW.closed_at IS DISTINCT FROM OLD.closed_at
     OR NEW.closure_reason IS DISTINCT FROM OLD.closure_reason
     OR NEW.closure_report_id IS DISTINCT FROM OLD.closure_report_id
     OR NEW.founder_eligible IS DISTINCT FROM OLD.founder_eligible
     OR NEW.founder_paid_cycles_used IS DISTINCT FROM OLD.founder_paid_cycles_used
     OR NEW.founder_cycles_total IS DISTINCT FROM OLD.founder_cycles_total
  THEN
    RAISE EXCEPTION 'BILLING_COLUMNS_PROTECTED: ces champs ne peuvent être modifiés que par le système de facturation.'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;
