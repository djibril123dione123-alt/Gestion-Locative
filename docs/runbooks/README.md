# Operating Procedures - Samay Këur SaaS

## Vue d'ensemble des runbooks

Cette documentation couvre les procédures opérationnelles pour Samay Këur:

### Incidents
- [Erreurs JavaScript](./runbooks/INCIDENT_JS_ERRORS.md) - Diagnostic et solution
- [RLS Policy Bloquant](./runbooks/INCIDENT_RLS_BLOCKING.md) - Problèmes d'accès aux données

### Procédures standard
- [Déploiement en production](./runbooks/DEPLOYMENT.md) - Checklist et vérifications

## Structure des runbooks

Chaque runbook suit cette structure:

1. **Symptômes** - Signes visibles du problème
2. **Diagnostic rapide** - Commandes pour identifier la cause
3. **Causes courantes et solutions** - Solutions rapides par cause
4. **Escalade** - Quand et comment impliquer l'équipe
5. **Récupération** - Étapes post-incident
6. **Prévention** - Comment éviter le problème à l'avenir

## Escalade d'incident

### Critère de sévérité

| Sévérité | Impact | Temps de réponse | Escalade |
|----------|--------|------------------|----------|
| **CRITICAL** | 100% d'utilisateurs bloqués | < 5 min | CEO, VP Eng |
| **HIGH** | 50%+ d'utilisateurs affectés | < 15 min | Tech Lead, DevOps |
| **MEDIUM** | Fonctionnalité critique en panne | < 1h | Engineering Team |
| **LOW** | Impact limité ou mineur | < 24h | Backlog |

### Escalade immédiate

Pour les incidents **CRITICAL**, escalader dans cet ordre:

1. **Tech Lead** - Responsable technique
2. **DevOps** - Infrastructure et déploiement
3. **VP Engineering** - Stratégie et support ressources
4. **CEO** - Communication client si plus de 1h impact

### Canaux de communication

- **Incident actif**: Slack #samay-keur-critical (real-time)
- **Post-mortem**: Email et GitHub issues
- **Documentation**: Ce dossier (docs/runbooks/)
- **Alertes**: Sentry, Vercel, GitHub Actions

## Checklist d'incident

```markdown
### Lors d'un incident

- [ ] Identifier la sévérité (CRITICAL/HIGH/MEDIUM/LOW)
- [ ] Notifier Slack approprié
- [ ] Ouvrir le runbook correspondan
- [ ] Suivre les étapes de diagnostic
- [ ] Escalader si nécessaire
- [ ] Documenter les actions prises
- [ ] Monitorer post-incident
- [ ] Planifier post-mortem (CRITICAL/HIGH)

### Post-incident

- [ ] Rédiger un post-mortem
- [ ] Identifier les améliorations
- [ ] Créer des issues GitHub si correction nécessaire
- [ ] Améliorer ce runbook basé sur l'expérience
- [ ] Mettre à jour la prévention
```

## Outils de diagnostique

### Monitoring et logging

| Outil | Purpose | Accès |
|-------|---------|-------|
| **Sentry** | Error tracking | https://sentry.io |
| **Vercel** | Deployment & analytics | https://vercel.com |
| **Supabase** | Database & auth logs | https://app.supabase.com |
| **GitHub** | CI/CD logs | Actions tab |
| **Lighthouse** | Performance | DevTools |

### Commandes utiles

```bash
# Vérifier le status de l'app
curl -s https://samay-keur.vercel.app/api/health

# Vérifier les dépendances
npm audit
npm outdated

# Tester localement
npm run dev
npm run build
npm run test

# Logs
git log --oneline -10
gh run list --limit 5
```

## Templates de communication

### Incident déclaré

```
🚨 INCIDENT DÉCLARÉ - [SÉVÉRITÉ]
📍 Composant: [e.g., "Auth", "Dashboard", "API"]
⏰ Heure début: [TIME]
❓ Impact: [Description]
🔧 Actions en cours: [Description]
📍 Tracking: [Sentry link] / [GitHub issue]
```

### Incident résolu

```
✅ INCIDENT RÉSOLU
📍 Composant: [e.g., "Auth", "Dashboard", "API"]
⏰ Durée: [X min]
🔍 Root cause: [Description]
🔧 Action effectuée: [Description]
📊 Impact: [X utilisateurs, X min d'indisponibilité]
🎯 Plan d'action: [Voir Jira/GitHub issue]
```

### Post-mortem

```
## Post-mortem: [Titre incident]

**Date**: [DATE]
**Sévérité**: [CRITICAL/HIGH/...]
**Impact**: [Description quantifiée]

### Timeline
- [TIME] Incident begins
- [TIME] Alert triggered
- [TIME] Investigation started
- [TIME] Fix deployed
- [TIME] Incident resolved

### Root cause
[Explication simple de la cause racine]

### Actions correctives
- [ ] Action court terme
- [ ] Action moyen terme
- [ ] Action long terme

### Apprentissages
- Bien fait: [...]
- À améliorer: [...]

### Propriétaire
- Post-mortem: [Owner]
- Follow-up: [Owner]
```

## Maintenance régulière

### Hebdomadaire
- [ ] Vérifier les alertes Sentry non traitées
- [ ] Vérifier les deployments réussis
- [ ] Vérifier les logs d'erreurs

### Mensuel
- [ ] Reviser les incidents du mois
- [ ] Mettre à jour les runbooks basé sur les incidents
- [ ] Planifier les améliorations de monitoring
- [ ] Audit des accès et permissions

### Trimestriel
- [ ] Revoir du plan de disaster recovery
- [ ] Tester une restauration de backup
- [ ] Vérifier la documentation à jour
- [ ] Vérifier les vulnérabilités (`npm audit`)

## Liens rapides

- [Sentry Issues](https://sentry.io)
- [Vercel Dashboard](https://vercel.com/dashboard)
- [Supabase Dashboard](https://app.supabase.com)
- [GitHub Repo](https://github.com)
- [CI/CD Workflows](.github/workflows/)