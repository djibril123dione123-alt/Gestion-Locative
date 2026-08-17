-- =============================================================================
-- Correctif de sécurité (trouvé pendant l'audit Offre Fondateurs / SenePay) :
--
-- La policy RLS "agency_tenant_update" autorise tout utilisateur ayant le
-- rôle 'admin' dans son agence à faire un UPDATE sur SA PROPRE ligne
-- `agencies` — mais une policy RLS ne peut restreindre QUE les lignes
-- concernées, pas les colonnes. Résultat vérifié : un admin d'agence pouvait,
-- via une requête client directe (`supabase.from('agencies').update({...})`),
-- modifier lui-même plan / status / founder_eligible / founder_paid_cycles_used
-- et s'octroyer un abonnement payant gratuitement, en contournant entièrement
-- initiate-payment / activate_subscription.
--
-- Vérifié : aucun code frontend n'appelle actuellement `.from('agencies').update()`
-- (toutes les mises à jour légitimes passent par des RPC SECURITY DEFINER —
-- approve_agency_request, activate_subscription, etc., toutes possédées par
-- `postgres`). Le trou n'était donc pas exploité par l'app elle-même, mais
-- restait ouvert à quiconque inspecte le client Supabase (clé anon publique)
-- et rejoue un appel direct.
--
-- Fix : trigger BEFORE UPDATE qui bloque toute modification des colonnes
-- sensibles (facturation / cycle de vie de l'abonnement) sauf quand l'appel
-- provient d'une fonction SECURITY DEFINER de confiance (current_user =
-- 'postgres', propriétaire de toutes les RPC d'administration) ou du
-- service_role (edge functions). Les colonnes non sensibles (nom, adresse,
-- téléphone, logo...) restent librement modifiables par un admin d'agence.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.fn_protect_agencies_billing_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Appels de confiance : RPC SECURITY DEFINER (owner postgres) ou service_role.
  IF current_user IN ('postgres', 'service_role', 'supabase_admin') THEN
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

DROP TRIGGER IF EXISTS trg_protect_agencies_billing_columns ON public.agencies;
CREATE TRIGGER trg_protect_agencies_billing_columns
  BEFORE UPDATE ON public.agencies
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_protect_agencies_billing_columns();

REVOKE ALL ON FUNCTION public.fn_protect_agencies_billing_columns() FROM PUBLIC, anon, authenticated;
