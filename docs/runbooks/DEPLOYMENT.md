# Runbook - Déploiement en Production

**Auteur**: Équipe DevOps | **Date**: 2026-04-26 | **Type**: Procédure standard

## 1. Pré-déploiement (2 heures avant)

### Checklist

- [ ] Tous les tests passent: `npm run build && npm run typecheck && npm run lint`
- [ ] Les tests E2E passent: `npm test` (si applicable)
- [ ] Pas de vulnérabilités critiques: `npm audit`
- [ ] Changements documentés dans le commit
- [ ] Code reviewé et approuvé
- [ ] Migrations SQL testées en staging
- [ ] Variables d'environnement vérifiées (Vercel > Settings)

### Préparation

```bash
# 1. Créer une branche de release
git checkout -b release/v1.x.x

# 2. Vérifier le version bump si applicable
# package.json version field

# 3. Mettre à jour CHANGELOG.md
# Format: Date - Version - Changes

# 4. Commit et push
git add .
git commit -m "chore: release v1.x.x"
git push origin release/v1.x.x
```

## 2. Déploiement (exécution)

### Via GitHub / Vercel (recommandé)

```bash
# 1. Créer une Pull Request
# GitHub Web > Create PR from release/v1.x.x to main

# 2. Attendre les checks GitHub Actions
# - Lint: ✅
# - TypeCheck: ✅
# - Build: ✅
# - E2E tests (si présents): ✅

# 3. Merge la PR
# GitHub Web > "Merge pull request"

# 4. Vercel déploie automatiquement
# Vercel Dashboard > Deployments > Observer le statut
# Checker "Production" en vert
```

### Déploiement manuel (si nécessaire)

```bash
# 1. S'assurer que main est à jour
git checkout main
git pull origin main

# 2. Construire et tester
npm ci
npm run build
npm run typecheck

# 3. Déployer avec Vercel CLI
npm install -g vercel
vercel --prod

# 4. Verifier le déploiement
vercel list  # Voir les récents déploiements
```

## 3. Post-déploiement (vérification)

### Vérifications immédates (5-10 min)

```bash
# 1. Vérifier l'accès à l'application
curl -s https://samay-keur.vercel.app | grep -E "<title>|<h1"

# 2. Vérifier les variables d'environnement
# Outre qu'il ne y a pas d'erreur 500

# 3. Vérifier les logs Sentry
# Sentry Dashboard > Issues
# - Chercher les nouvelles erreurs
# - Comparer avec le déploiement précédent

# 4. Tester manuellement depuis le navigateur
# - Aller sur https://samay-keur.vercel.app
# - Se connecter avec un test account
# - Naviguer dans l'application

# 5. Vérifier que le build est correct
# DevTools > Console > Pas d'erreurs rouge
# Network > Les ressources chargent correctement (200, pas 404)
```

### Monitoring (30 min après déploiement)

```bash
# 1. Sentry - Monitorer les erreurs
# Vérifier que les erreurs ne commencent pas à s'accumuler

# 2. Vercel - Monitorer la performance
# Vercel Dashboard > Analytics
# Chercher les spikes dans les latences

# 3. Google Analytics (si configuré)
# Vérifier que les utilisateurs arrivent à accéder

# 4. Uptime monitor (si configuré)
# Vérifier que le site reste accessible
```

## 4. Rollback (si incident)

###  Rollback immédiat

```bash
# EN CAS D'INCIDENT CRITIQUE - Rollback dans les 2 minutes

# Option 1: Via Vercel Dashboard (plus rapide)
# Vercel > Deployments > Sélectionner le déploiement précédent fonctionnel
# Cliquer "Promote to Production"

# Option 2: Via Git (si Vercel auto-deploy)
git revert HEAD  # Annule le dernier commit
git push origin main
# Vercel redesploie automatiquement

# Option 3: Via CLI
vercel --prod --force  # Re-déploie la production depuis le code courant
```

### Post-rollback

```bash
# 1. Notifier l'équipe sur Slack
# #samay-keur-alerts: "⚠️ Rollback effectué - Cause: [CAUSE]"

# 2. Investiguer le problème
# - Vérifier les logs Sentry
# - Vérifier les test locaux
# - Chercher des edge cases manqués

# 3. Fixes et redéploiement
# - Créer une branch fix/xxx
# - Corriger le problème
# - Passer par review avant re-déployed
```

## 5. Communication

### Pré-déploiement

```
Slack #samay-keur:
"🚀 Déploiement en production prévu à [TIME]
 Changements: [BREF RÉSUMÉ]
 Durée estimée: 5-10 min
 Monitoring: Actif"
```

### Post-déploiement réussi

```
Slack #samay-keur:
"✅ Déploiement réussi v1.x.x en production
 URL: https://samay-keur.vercel.app
 Monitoring: Actif - Pas d'erreurs détectées"
```

### Post-déploiement avec incident

```
Slack #samay-keur-critical:
"🚨 INCIDENT POST-DÉPLOIEMENT
 Symptômes: [DESCRIPTION]
 Actions: [IMMÉDIATE]
 ETA fix: [TEMPS ESTIMÉ]"
```

## 6. Monitoring pour les 24 heures

```bash
# 1. Sentry - Configurer une alerte
# Issues > Filter > "is:new" > "last 24h"
# Chercher les patterns d'erreurs

# 2. Performance - Vérifier Vercel Analytics
# Latency, Edge config, Database queries

# 3. Utilisateurs - Vérifier les rapports d'erreurs
# Slack, email, ou formulaire de feedback

# 4. Logs applicatifs
# Vérifier les erreurs métier (echec paiement, etc.)
```

## 7. Runbook de déploiement échoué

### Le build échoue

```bash
# 1. Vérifier l'erreur
# Vercel Dashboard > Deployments > Logs

# 2. Passer les mêmes étapes localement
npm ci
npm run build

# 3. Corriger sur une branche
git checkout -b fix/build-error

# 4. Après correction
npm ci
npm run build  # OK?
git push origin fix/build-error
# Créer PR, merger à main, Vercel rédéploie
```

### Les tests échouent

```bash
# 1. Vérifier les logs des tests
# GitHub Actions > Workflow "CI" > Logs

# 2. Reproduire localement
npm test

# 3. Fixer et relancer
git commit -am "fix: test errors"
git push origin [current-branch]

# 4. Attendre les checks GitHub avant merge
```

### Performance dégradée

```bash
# 1. Vérifier Vercel Analytics
# Latency, Bandwidth, CPU

# 2. Vérifier Sentry pour les erreurs de timeout
# Chercher "timeout" ou "504"

# 3. Vérifier la base de données Supabase
# Supabase Dashboard > Database > Monitoring

# 4. Si toujours slow:
# - Rollback (voir section 4)
# - Investiguer avant re-déployer
```

## 8. Journal de déploiement recommandé

```markdown
## Déploiement v1.x.x - [DATE]

### Puré-déploiement
- ✅ Tests locaux passent
- ✅ Code review approuvé
- ✅ Migrations testées

### Déploiement
- Heure début: [TIME]
- Branch: release/v1.x.x
- Commit: [SHA]

### Post-déploiement
- ✅ Build: OK
- ✅ Sentry: 0 nuevos errores (prima hora)
- ✅ Performance: Stable

### Monitoring  
- ✅ 24h - Sin problemas detectados

### Rollback
- N/A (deployment successful)
```