export function translateSupabaseError(error: any): string {
  if (!error) return 'Une erreur est survenue';

  const errorMessage = error.message || error.error_description || String(error);
  const errorCode = error.code || error.error || '';

  const errorMap: Record<string, string> = {
    'Invalid login credentials': 'Email ou mot de passe incorrect',
    'Email not confirmed': 'Veuillez confirmer votre email',
    'User already registered': 'Cet email est déjà enregistré',
    'Invalid email': 'Adresse email invalide',
    'Password should be at least 6 characters': 'Le mot de passe doit contenir au moins 6 caractères',
    'duplicate key value violates unique constraint': 'Cette valeur existe déjà',
    'violates foreign key constraint': 'Impossible de supprimer : des données liées existent',
    'violates check constraint': 'Valeur non valide',
    'permission denied': 'Vous n\'avez pas les permissions nécessaires',
    'JWT expired': 'Session expirée, veuillez vous reconnecter',
    'Invalid JWT': 'Session invalide, veuillez vous reconnecter',
    'Network request failed': 'Erreur de connexion réseau',
    'Failed to fetch': 'Erreur de connexion au serveur',
    'PGRST116': 'Enregistrement introuvable',
  };

  for (const [key, value] of Object.entries(errorMap)) {
    if (errorMessage.includes(key) || errorCode.includes(key)) {
      return value;
    }
  }

  if (errorMessage.includes('unique')) {
    return 'Cette valeur existe déjà dans la base de données';
  }

  if (errorMessage.includes('foreign key')) {
    return 'Impossible de supprimer : d\'autres données dépendent de cet élément';
  }

  if (errorMessage.includes('null value')) {
    return 'Tous les champs obligatoires doivent être remplis';
  }

  if (errorMessage.includes('timeout')) {
    return 'La requête a pris trop de temps. Veuillez réessayer';
  }

  if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
    return 'Erreur de connexion. Vérifiez votre connexion internet';
  }

  return errorMessage.length > 100
    ? 'Une erreur est survenue. Veuillez réessayer'
    : errorMessage;
}

export function getSuccessMessage(action: 'create' | 'update' | 'delete', entity: string): string {
  const messages = {
    create: `${entity} créé avec succès`,
    update: `${entity} mis à jour avec succès`,
    delete: `${entity} supprimé avec succès`,
  };
  return messages[action];
}
