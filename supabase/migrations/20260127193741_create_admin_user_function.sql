/*
  # Fonction pour créer un utilisateur administrateur

  Cette migration crée des fonctions helper pour créer facilement
  des profils utilisateurs après la création d'un compte via Supabase Auth.

  ## Fonctions créées
  - create_admin_profile : Crée un profil administrateur
  - create_agent_profile : Crée un profil agent
*/

-- Fonction pour créer un profil administrateur
CREATE OR REPLACE FUNCTION create_admin_profile(
  user_id uuid,
  user_email text,
  user_nom text,
  user_prenom text,
  user_telephone text DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  INSERT INTO user_profiles (id, email, nom, prenom, telephone, role, actif)
  VALUES (user_id, user_email, user_nom, user_prenom, user_telephone, 'admin', true)
  ON CONFLICT (id) DO UPDATE
  SET role = 'admin', actif = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction pour créer un profil agent
CREATE OR REPLACE FUNCTION create_agent_profile(
  user_id uuid,
  user_email text,
  user_nom text,
  user_prenom text,
  user_telephone text DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  INSERT INTO user_profiles (id, email, nom, prenom, telephone, role, actif)
  VALUES (user_id, user_email, user_nom, user_prenom, user_telephone, 'agent', true)
  ON CONFLICT (id) DO UPDATE
  SET role = 'agent', actif = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;