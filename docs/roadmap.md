# Roadmap

La roadmap doit proteger la coherence produit. Les prochaines evolutions doivent renforcer l'architecture existante au lieu d'ajouter des modules isoles.

## Priorite 1 : maturite production

- Rotation secrets.
- CI/CD complet migrations + Edge Functions.
- Tests E2E sur paiements, documents, permissions.
- Monitoring alerting plus strict.
- Smoke tests post-deploy automatises.

## Priorite 2 : experience metier

- Portail bailleur.
- Portail locataire.
- Signature electronique.
- Relances WhatsApp structurees.
- Workflows de validation equipe.

## Priorite 3 : intelligence documentaire

- OCR documents.
- Classification automatique.
- Recherche plein texte GED.
- Retention policies avancees.
- Export dossier bailleur/locataire.

## Priorite 4 : ecosysteme

- API partenaires.
- Integrations comptables.
- Multi-agence avance.
- White-label enterprise.
- Analytics predictifs.

## Principes produit

- Moins de duplication.
- Plus de workflow contextuel.
- Pas de nouveau pattern UI sans integration design system.
- Toute nouvelle operation critique doit etre idempotente, auditee et multi-tenant.
