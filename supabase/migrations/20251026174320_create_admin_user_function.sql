/*
  # Fonction pour créer un utilisateur administrateur

  Cette migration crée une fonction helper qui permet de créer facilement
  un profil utilisateur administrateur après la création d'un compte via Supabase Auth.

  ## Instructions d'utilisation

  Après avoir créé un utilisateur via l'interface Auth de Supabase,
  exécutez cette requête SQL en remplaçant les valeurs :

  ```sql
  SELECT create_admin_profile(
    'uuid-de-votre-utilisateur'::uuid,
    'admin@confortimmo.com',
    'Admin',
    'Système',
    '+221 XX XXX XX XX'
  );
  ```
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
