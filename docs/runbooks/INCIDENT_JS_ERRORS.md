# Runbook - Incident: Erreurs JavaScript Massives

**Auteur**: Équipe DevOps | **Date**: 2026-04-26 | **Criticité**: HIGH

## 1. Symptômes

- Page blanche ou contenu partiellement chargé
- Erreurs JavaScript dans la console navigateur
- Erreurs apparaissant en temps réel dans Sentry
- Performance dégradée de l'application

## 2. Diagnostic rapide

```bash
# 1. Vérifier le statut de l'application
curl -s https://samay-keur.vercel.app | head -n 50

# 2. Vérifier les logs Sentry
# Aller sur https://sentry.io > Samay Këur > Issues
# Filtrer par timestamp et chercher les erreurs récentes

# 3. Vérifier les variables d'environnement
# Vercel Dashboard > Settings > Environment Variables
# Vérifier que VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY sont présents

# 4. Vérifier la disponibilité de Supabase
curl -s https://znvcfjelmikprjeoxrug.supabase.co/rest/v1/
```

## 3. Causes courantes et solutions

### Cause: Configuration Supabase manquante ou incorrecte

**Symptômes**: Erreur "TypeError: Cannot read properties of undefined"

**Solution**:
```bash
# 1. Vérifier la console du navigateur (F12)
# 2. Vérifier Sentry pour le message d'erreur exact
# 3. En production (Vercel):
#    - Dashboard > Settings > Environment Variables
#    - Vérifier VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY
# 4. Redéployer après correction:
#    - Vercel auto-redéploie à la modif des env vars
```

### Cause: Supabase indisponible ou en maintenance

**Symptômes**: Erreurs réseau, timeouts, "Failed to fetch"

**Solution**:
```bash
# 1. Vérifier le statut de Supabase
curl -s https://status.supabase.com/ | grep -i incidents

# 2. Vérifier la RLS (Row Level Security)
# Supabase Dashboard > Authentication > Policies
# Chercher les policies qui auraient changé

# 3. Si Supabase récemment redémarré:
# - Les tokens actifs restent valides
# - Rafraîchir la page devrait suffire
# - Si non: vider le cache et cookies

# 4. Contacter le support Supabase si persistant
```

### Cause: Code bunlé incompatible

**Symptômes**: Erreur lors du parsing du JS, "Unexpected token"

**Solution**:
```bash
# 1. Vérifier le build log dans Vercel
#    - Vercel Dashboard > Deployments > Logs
# 2. Chercher les avertissements de build

# 3. Vérifier la version de Node
#    - Vercel > Settings > Node Version
#    - Assurer qu'elle match le package.json

# 4. Nettoyer et redéployer
cd /workspaces/Gestion-Locative
npm ci
npm run build
# Si OK localement, pousser sur main pour redéployer Vercel
```

### Cause: Dépendances cassées ou conflit de versions

**Symptômes**: Erreurs aléatoires, "Cannot find module", issues avec React

**Solution**:
```bash
# 1. Vérifier les vulnérabilités
npm audit

# 2. Mettre à jour si nécessaire
npm audit fix

# 3. Vérifier les tests passent
npm run build
npm run typecheck
npm run lint

# 4. Si problème persiste, nettoyer et réinstaller
rm -rf node_modules package-lock.json
npm install
npm test
```

## 4. Escalade

### Si l'incident n'est pas résolu après 15 min:

1. **Alerter l'équipe**
   - Ping équipe frontend dans Slack: #samay-keur-alerts
   - Créer un incident GitHub: Issues > New issue

2. **Actions supplémentaires**
   - Vérifier les logs Sentry en détail
   - Comparer avec le dernier déploiement réussi
   - Rollback si nécessaire:
     ```bash
     # Dans Vercel Dashboard:
     # Deployments > Sélectionner le bon déploiement > Promote to Production
     ```

3. **Enquête post-incident**
   - Documenter les causes
   - Créer des tests pour éviter régression
   - Améliorer la détection d'erreurs

## 5. Récupération

### Étapes de vérification post-incident

```bash
# 1. Vérifier que les erreurs ne réapparaissent plus
# Sur Sentry, attendre 5-10 min après le fix
# et vérifier que le nombre d'erreurs diminue

# 2. Tester les flux critiques
- Se connecter avec un compte de test
- Créer/lire/modifier/supprimer des données
- Vérifier les graphiques

# 3. Vérifier la performance
# Lighthouse: DevTools > Lighthouse > Generate report
# Target: Score >= 80 pour Performance

# 4. Nettoyer les logs si erreurs temporaires
# Sentry > Issues > "Resolve" pour les faux positifs
```

### Communication

```
1. Post-incident sur Slack #samay-keur-alerts:
   "✅ Incident résolu à [TIME]. Cause: [CAUSE]. 
    Action: [ACTION PRISE]. 
    Monitoring: [STATUS DE MONITORING ACTIF]"

2. Créer postmortem si incident sérieux:
   - Quand: Dans les 24 heures
   - Où: Google Doc lié dans GitHub issue
   - Contenu: Timeline, root cause, actions correctives
```

## 6. Prévention

- ✅ Configurer des alertes Sentry pour les erreurs critiques
- ✅ Tester avant chaque déploiement: `npm run build && npm test`
- ✅ Utiliser les GitHub Actions pour CI/CD
- ✅ Monitorer régulièrement les logs
- ✅ Maintenir une liste d'erreurs connues et leurs solutions