/*
  # Migration Multi-Tenant - Partie 6 : Fonctions utilitaires

  1. Fonctions
    - create_notification : Créer une notification
    - cleanup_expired_invitations : Nettoyer invitations expirées
    - check_plan_limits : Vérifier limites du plan
  
  2. Sécurité
    - SECURITY DEFINER pour accès contrôlé
*/

-- Fonction pour créer une notification
CREATE OR REPLACE FUNCTION create_notification(
  p_user_id uuid,
  p_agency_id uuid,
  p_type text,
  p_title text,
  p_message text,
  p_link text DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
  notification_id uuid;
BEGIN
  INSERT INTO notifications (user_id, agency_id, type, title, message, link)
  VALUES (p_user_id, p_agency_id, p_type, p_title, p_message, p_link)
  RETURNING id INTO notification_id;

  RETURN notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction pour nettoyer les invitations expirées
CREATE OR REPLACE FUNCTION cleanup_expired_invitations()
RETURNS void AS $$
BEGIN
  UPDATE invitations
  SET status = 'expired'
  WHERE status = 'pending' AND expires_at < now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction pour vérifier les limites du plan
CREATE OR REPLACE FUNCTION check_plan_limits(p_agency_id uuid)
RETURNS jsonb AS $$
DECLARE
  plan_limits jsonb;
  current_usage jsonb;
  plan_record RECORD;
BEGIN
  -- Récupérer les limites du plan
  SELECT sp.* INTO plan_record
  FROM subscriptions s
  JOIN subscription_plans sp ON s.plan_id = sp.id
  WHERE s.agency_id = p_agency_id;

  -- Si pas d'abonnement, retourner limites par défaut
  IF plan_record IS NULL THEN
    RETURN jsonb_build_object(
      'limits', jsonb_build_object(
        'max_users', 1,
        'max_immeubles', 3,
        'max_unites', 10
      ),
      'usage', jsonb_build_object(
        'users', 0,
        'immeubles', 0,
        'unites', 0
      ),
      'can_add_user', false,
      'can_add_immeuble', false,
      'can_add_unite', false
    );
  END IF;

  -- Calculer l'utilisation actuelle
  SELECT jsonb_build_object(
    'users', (SELECT COUNT(*) FROM user_profiles WHERE agency_id = p_agency_id),
    'immeubles', (SELECT COUNT(*) FROM immeubles WHERE agency_id = p_agency_id),
    'unites', (SELECT COUNT(*) FROM unites WHERE agency_id = p_agency_id)
  ) INTO current_usage;

  -- Construire la réponse
  RETURN jsonb_build_object(
    'limits', jsonb_build_object(
      'max_users', plan_record.max_users,
      'max_immeubles', plan_record.max_immeubles,
      'max_unites', plan_record.max_unites
    ),
    'usage', current_usage,
    'can_add_user', (current_usage->>'users')::int < plan_record.max_users OR plan_record.max_users = -1,
    'can_add_immeuble', (current_usage->>'immeubles')::int < plan_record.max_immeubles OR plan_record.max_immeubles = -1,
    'can_add_unite', (current_usage->>'unites')::int < plan_record.max_unites OR plan_record.max_unites = -1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;