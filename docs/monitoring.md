# Monitoring

Le monitoring doit couvrir l'app, la vitrine, Supabase, les documents, les paiements et l'expérience terrain.

## Signaux critiques

| Domaine | Signal à surveiller |
|---|---|
| Frontend | page blanche, erreur JS, route cassée |
| Paiements | doublons, mois soldés repassés payables, reliquats incorrects |
| Documents | QR absent, URL QR mauvaise, type incohérent |
| Vérification | erreurs `verify-document`, document authentique affiché introuvable |
| RLS | refus inattendu ou fuite inter-agence |
| Storage | fichier absent, signed URL expirée, quota proche |
| Offline | skeleton infini, données à `0`, redirection Welcome hors ligne |
| Vercel | build échoué, domaine mal lié, rewrite cassé |

## Alertes recommandées

- erreur critique sur `/verify` ;
- Edge Function `verify-document` en erreur ;
- génération document sans entrée registre ;
- paiement créé sans document attendu ;
- `document_type` inconnu ;
- échec build Vercel ;
- erreurs Supabase Auth répétées ;
- Storage > 80% du quota.

## Runbooks

Voir :

- [runbooks/DEPLOYMENT.md](runbooks/DEPLOYMENT.md)
- [runbooks/INCIDENT_JS_ERRORS.md](runbooks/INCIDENT_JS_ERRORS.md)
- [runbooks/INCIDENT_RLS_BLOCKING.md](runbooks/INCIDENT_RLS_BLOCKING.md)

## Vérification post-déploiement

Après chaque push app :

- ouvrir `app.samaykeur.com` ;
- générer un document test ;
- vérifier le QR sur `samaykeur.com/verify` ;
- tester dashboard et paiements.

Après chaque push vitrine :

- ouvrir `samaykeur.com` ;
- ouvrir `/verify` avec et sans paramètres ;
- vérifier les pages légales et CTA.
