/*
  # Migration Multi-Tenant - Partie 7 : Migration données existantes

  1. Création agence par défaut
    - Confort Immo Archi avec plan Pro
  
  2. Migration données
    - Association user_profiles à l'agence par défaut
    - Association agency_settings à l'agence par défaut
    - Association toutes tables métier à l'agence par défaut
  
  3. Abonnement
    - Création abonnement Pro pour l'agence par défaut
*/

DO $$
DECLARE
  default_agency_id uuid;
BEGIN
  -- Créer l'agence par défaut si elle n'existe pas
  INSERT INTO agencies (name, email, phone, plan, status)
  VALUES ('Confort Immo Archi', 'contact@confortimmoarchi.sn', '+221 XX XXX XX XX', 'pro', 'active')
  ON CONFLICT DO NOTHING
  RETURNING id INTO default_agency_id;

  -- Si l'agence existait déjà, récupérer son ID
  IF default_agency_id IS NULL THEN
    SELECT id INTO default_agency_id FROM agencies WHERE name = 'Confort Immo Archi' LIMIT 1;
  END IF;

  -- Mettre à jour tous les profils sans agency_id
  UPDATE user_profiles
  SET agency_id = default_agency_id
  WHERE agency_id IS NULL;

  -- Mettre à jour agency_settings
  UPDATE agency_settings
  SET agency_id = default_agency_id
  WHERE agency_id IS NULL;

  -- Mettre à jour toutes les tables métier
  UPDATE bailleurs SET agency_id = default_agency_id WHERE agency_id IS NULL;
  UPDATE immeubles SET agency_id = default_agency_id WHERE agency_id IS NULL;
  UPDATE unites SET agency_id = default_agency_id WHERE agency_id IS NULL;
  UPDATE locataires SET agency_id = default_agency_id WHERE agency_id IS NULL;
  UPDATE contrats SET agency_id = default_agency_id WHERE agency_id IS NULL;
  UPDATE paiements SET agency_id = default_agency_id WHERE agency_id IS NULL;
  UPDATE depenses SET agency_id = default_agency_id WHERE agency_id IS NULL;
  UPDATE audit_logs SET agency_id = default_agency_id WHERE agency_id IS NULL;

  -- Créer un abonnement Pro pour l'agence par défaut
  INSERT INTO subscriptions (agency_id, plan_id, status)
  VALUES (default_agency_id, 'pro', 'active')
  ON CONFLICT (agency_id) DO NOTHING;

  RAISE NOTICE 'Migration multi-tenant terminée avec succès !';
  RAISE NOTICE 'Agence par défaut créée : Confort Immo Archi (ID: %)', default_agency_id;
  RAISE NOTICE 'Toutes les données existantes ont été associées à cette agence';
  RAISE NOTICE 'Plan Pro activé pour l''agence par défaut';
END $$;