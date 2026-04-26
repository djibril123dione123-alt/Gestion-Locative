# Configuration Sentry - Monitoring des Erreurs

## Vue d'ensemble

Sentry est intégré à l'application Samay Këur pour le monitoring des erreurs en production. Cette intégration permet de:

- Capturer automatiquement les erreurs JavaScript et React
- Monitorer les performances de l'application
- Enregistrer les sessions utilisateur pour le debugging
- Recevoir des alertes en temps réel sur les erreurs critiques

## Configuration

### Variables d'environnement

Ajoutez ces variables dans votre fichier `.env` :

```bash
# DSN Sentry (obligatoire pour l'envoi des erreurs)
VITE_SENTRY_DSN=https://your-dsn@sentry.io/project-id

# Pour le plugin Vite (optionnel - pour les releases automatiques)
SENTRY_ORG=your-org-slug
SENTRY_PROJECT=your-project-slug
SENTRY_AUTH_TOKEN=your-auth-token
```

### Comment obtenir les credentials Sentry

1. Créez un compte sur [sentry.io](https://sentry.io)
2. Créez un nouveau projet pour votre application
3. Récupérez le DSN dans les paramètres du projet
4. Générez un auth token dans les paramètres de compte > API keys

## Fonctionnalités activées

### Error Boundary
- Capture automatique des erreurs React non gérées
- Interface utilisateur élégante en cas d'erreur
- Possibilité de réessayer après une erreur

### Performance Monitoring
- Suivi des Core Web Vitals
- Monitoring des transactions utilisateur
- Détection des problèmes de performance

### Session Replay
- Enregistrement des sessions utilisateur
- Reproduction des bugs en contexte réel
- Analyse du comportement utilisateur

### Source Maps
- Upload automatique des source maps en production
- Stack traces lisibles avec le code source original
- Debugging facilité

## Utilisation dans le code

### Hook useErrorReporting

```typescript
import { useErrorReporting } from '@/hooks/useErrorReporting';

function MyComponent() {
  const { captureError, captureMessage, setUserContext } = useErrorReporting();

  const handleError = (error: Error) => {
    captureError(error, {
      component: 'MyComponent',
      action: 'handleSubmit',
      data: { formData: formValues }
    });
  };

  const handleUserAction = () => {
    captureMessage('User completed onboarding', 'info', {
      component: 'OnboardingFlow',
      action: 'completion',
      userId: user.id,
      agencyId: user.agencyId
    });
  };

  // Définir le contexte utilisateur au montage
  useEffect(() => {
    setUserContext({
      userId: user.id,
      email: user.email,
      agencyId: user.agencyId,
      role: user.role
    });
  }, [user]);
}
```

### Capture manuelle d'erreurs

```typescript
import * as Sentry from '@sentry/react';

try {
  // Code risqué
  riskyOperation();
} catch (error) {
  Sentry.captureException(error, {
    tags: {
      component: 'PaymentProcessor',
      action: 'processPayment'
    },
    extra: {
      amount: paymentAmount,
      currency: 'EUR'
    }
  });
}
```

## Bonnes pratiques

### 1. Contexte utilisateur
Toujours définir le contexte utilisateur dès que possible :
```typescript
Sentry.setUser({
  id: userId,
  email: userEmail,
});
```

### 2. Tags et contexte
Utilisez des tags pour filtrer et grouper les erreurs :
```typescript
Sentry.setTag('component', 'PaymentForm');
Sentry.setTag('action', 'submit');
Sentry.setContext('form_data', { amount: 100, currency: 'EUR' });
```

### 3. Niveaux de sévérité
- `fatal`: Erreur critique bloquante
- `error`: Erreur fonctionnelle
- `warning`: Avertissement non bloquant
- `info`: Information utile
- `debug`: Debug (désactivé en prod)

### 4. Données sensibles
Sentry filtre automatiquement les données sensibles, mais évitez de logger :
- Mots de passe
- Tokens d'authentification
- Données de carte bancaire
- Informations médicales

## Monitoring en production

### Alertes
Configurez des alertes dans Sentry pour :
- Nouvelles erreurs
- Erreurs fréquentes
- Erreurs affectant de nombreux utilisateurs
- Problèmes de performance

### Releases
Les releases sont automatiquement créées lors du build de production grâce au plugin Vite.

### Environnements
- `development`: Erreurs capturées mais pas d'alertes
- `staging`: Alertes limitées
- `production`: Alertes complètes

## Dépannage

### Erreurs non capturées
Si certaines erreurs n'apparaissent pas dans Sentry :
1. Vérifiez que `VITE_SENTRY_DSN` est défini
2. Vérifiez la console pour les erreurs CORS
3. Assurez-vous que l'Error Boundary englobe bien l'app

### Source maps non uploadés
Si les stack traces ne montrent pas le code source :
1. Vérifiez que `SENTRY_AUTH_TOKEN` est défini
2. Vérifiez que `SENTRY_ORG` et `SENTRY_PROJECT` sont corrects
3. Vérifiez les logs du build pour les erreurs d'upload

### Performance impact
Sentry a un impact minimal sur les performances :
- Chargement initial: ~10-20KB
- Capture d'erreur: ~1-2ms
- Session replay: activé seulement sur 10% des sessions par défaut