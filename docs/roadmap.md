# Roadmap

La roadmap doit renforcer la bêta premium sans créer de modules isolés.

## P0 - Stabilisation bêta

- chaîne documentaire complète : PDF -> GED -> registry -> QR -> `/verify` ;
- paiements complets, partiels et reliquats fiables ;
- rapports bailleurs/propriétaires cohérents ;
- bailleur individuel utilisable de bout en bout ;
- mobile sans overflow sur pages critiques ;
- monitoring erreurs documents/paiements.

## P1 - Résilience terrain

- offline lecture/cache sur pages prioritaires ;
- skeletons bornés ;
- états réseau fermables ;
- refresh à la reconnexion ;
- blocage clair des actions financières hors ligne.

## P2 - Profils structurés

- `organization_type` comme source officielle ;
- `document_mode` simple/professionnel/juridique ;
- `enabled_modules` par compte/plan ;
- gestionnaire indépendant ;
- bailleur multi-biens.

## P3 - Portails et workflows

- portail bailleur ;
- portail locataire ;
- relances structurées ;
- signature électronique ;
- workflows d'équipe.

## P4 - Enterprise

- multi-organisation ;
- reporting consolidé ;
- white-label ;
- API partenaires ;
- gouvernance avancée.

## Garde-fous

- pas de refonte finance sans tests ;
- pas de migration risquée sans backfill ;
- pas de nouvel écran maquette sans données réelles ;
- pas de mélange vitrine/app.
