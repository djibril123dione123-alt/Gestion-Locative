-- Migration: Respect agency communication settings for encaissements
-- Description: Updates queue_loyer_encaisse_notification to check email_notifications_actif

CREATE OR REPLACE FUNCTION queue_loyer_encaisse_notification(
  p_paiement_id uuid,
  p_agency_id   uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pmt record;
  v_email_enabled boolean;
BEGIN
  -- Verify if email notifications are enabled for this agency
  SELECT email_notifications_actif INTO v_email_enabled
  FROM agency_settings
  WHERE agency_id = p_agency_id;

  IF NOT v_email_enabled THEN
    RETURN;
  END IF;

  SELECT p.montant_total, p.mois_concerne, p.part_bailleur, p.part_agence,
         c.commission, u.nom AS unite_nom,
         b.id AS bailleur_id, b.email AS bailleur_email,
         b.prenom || ' ' || b.nom AS bailleur_nom
  INTO v_pmt
  FROM paiements p
  JOIN contrats c ON c.id = p.contrat_id
  JOIN unites u ON u.id = c.unite_id
  JOIN bailleurs b ON b.id = c.bailleur_id
  WHERE p.id = p_paiement_id AND p.agency_id = p_agency_id;

  IF NOT FOUND OR v_pmt.bailleur_email IS NULL THEN RETURN; END IF;

  INSERT INTO notification_queue (
    agency_id, type, channel, recipient_email, recipient_name,
    subject, template_data, scheduled_for
  ) VALUES (
    p_agency_id,
    'loyer_encaisse_bailleur',
    'email',
    v_pmt.bailleur_email,
    v_pmt.bailleur_nom,
    'Loyer encaissé — ' || v_pmt.unite_nom,
    jsonb_build_object(
      'bailleur_nom',   v_pmt.bailleur_nom,
      'unite_nom',      v_pmt.unite_nom,
      'montant_total',  v_pmt.montant_total,
      'part_bailleur',  v_pmt.part_bailleur,
      'part_agence',    v_pmt.part_agence,
      'commission',     v_pmt.commission,
      'mois_concerne',  v_pmt.mois_concerne
    ),
    now()
  );
END;
$$;
