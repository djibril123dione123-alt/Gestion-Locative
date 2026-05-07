# Samay Këur Product Design System

## North Star

Samay Këur doit ressembler à une console de gestion immobilière et financière premium : calme, lisible, rapide, structurée. L’utilisateur doit sentir qu’il contrôle mieux son patrimoine, ses paiements et ses équipes.

## Design Principles

1. **Clarté avant décoration** : chaque surface doit aider à lire un montant, un statut ou une action.
2. **Fintech calme** : les flux d’argent doivent inspirer confiance, pas excitation.
3. **Mobile-first terrain** : les agents utilisent l’app en déplacement, parfois avec réseau instable.
4. **Hiérarchie forte** : titre, KPI, statut, action. Rien ne doit se battre visuellement.
5. **Orange contrôlé** : orange uniquement pour paiement, action critique ou notification importante.

## Color Tokens

| Token | Hex | Usage |
| --- | --- | --- |
| `brand-950` | `#06110D` | Sidebar, dark shell, surfaces institutionnelles |
| `brand-900` | `#0D3B2C` | Panels dark |
| `brand-800` | `#14532D` | Navigation active, focus |
| `brand-700` | `#166534` | Actions secondaires, labels actifs |
| `brand-400` | `#34D399` | CTA principal, succès |
| `action-500` | `#F97316` | Paiement, notification importante |
| `brand-paper` | `#F7F3EA` | Fond app premium |
| `brand-surface` | `#FBFAF6` | Header de tables, surfaces douces |

## App Shell

Sidebar :
- Fond `brand-950`
- Logo `brand-mark.svg`
- Actif : fond emerald transparent + barre gauche emerald
- Les groupes s’ouvrent dans une sous-ligne discrète

Mobile topbar :
- Fond blanc translucide
- Logo compact
- Texte noir premium
- Bouton menu vert profond

## Buttons

Primary :
- Fond `brand-400`
- Texte `emerald-950`
- Ombre douce emerald
- Hover : léger lift `-translate-y-0.5`

Secondary :
- Blanc, bordure slate, hover emerald très léger

Danger :
- Rouge uniquement pour destruction ou annulation à risque

Payment CTA :
- Peut utiliser `action-500`, mais seulement dans les modules paiement/abonnement.

## Tables

Tables desktop :
- Conteneur blanc, border slate, radius 8
- Header sticky `brand-surface`
- Header uppercase, petit, très lisible
- Hover row emerald très léger
- Actions compactes à droite

Tables mobile :
- Cartes empilées
- Labels uppercase à gauche
- Valeurs à droite
- Actions pleine largeur sous la carte

Next steps recommandés :
- Ajouter density modes
- Ajouter pagination standard
- Ajouter toolbar de recherche premium
- Ajouter column visibility unifiée

## Modals

Overlay :
- `brand-950/64`
- Backdrop blur subtil

Panel :
- Radius 8 desktop
- Bottom sheet mobile
- Header `brand-surface`
- Titre noir premium
- Bouton close emerald hover

## Empty States

Empty state = surface utile, pas illustration décorative.

Structure :
- Icône Lucide dans carré emerald doux
- Titre clair
- Description courte
- CTA unique si nécessaire

## Tabs

Tabs sont des segmented controls :
- Fond blanc
- Border slate
- Actif `brand-950`
- Badge actif emerald

## Skeletons

Skeletons :
- Dégradé slate/emerald doux
- Pas de gris trop sombre
- Cartes skeleton avec même radius que les cards réelles

## Dashboard Direction

KPI cards :
- Montant dominant
- Label court
- Delta petit
- Statut explicite

Graphiques :
- Emerald pour revenu/recouvrement
- Orange pour paiement/action
- Amber pour risque/retard
- Rouge uniquement pour critique

Activity feed :
- Paiement reçu
- Quittance générée
- Relance prête
- Bailleur notifié

## Forms

Inputs :
- Utiliser `.sk-input`
- Focus emerald doux
- Labels courts et précis
- Erreurs rouges avec message actionnable

Modals de création :
- Sections courtes
- Résumé financier visible si montant/contrat
- CTA sticky sur mobile si formulaire long

## Payment UX

Paiement doit ressembler à une fintech :
- Timeline statut
- Montant très visible
- Provider visible : Wave, Orange Money, PayDunya, Djamo
- Pending explicite
- Échec avec prochaine action claire
- Reçu/quittance immédiatement accessible

## Mobile UX

Règles :
- Boutons min-height 44px
- Bottom navigation stable
- Tables converties en cards
- Actions critiques confirmées par modal
- États offline visibles sans alarmer

## Motion

Motion allowed :
- Hover lift léger
- Fade/reveal court
- Skeleton pulse doux
- Modal scale/bottom sheet

Motion forbidden :
- Blur sur texte important
- Rebond fort
- Rotation inutile
- Animation infinie sur toutes les cartes

## Implementation Rules

1. Réutiliser `Button`, `Table`, `Modal`, `Tabs`, `EmptyState`, `Skeleton`.
2. Ne plus ajouter de gradients orange/rouge pour les actions normales.
3. Ne pas utiliser de radius supérieur à 8px sauf mobile sheet, avatar ou phone mockup.
4. Toujours vérifier contraste sur dark et light.
5. Utiliser `brand-mark.svg` pour logo app.
6. Garder l’orange pour paiement/action, pas pour navigation principale.
