# Samay Këur Brand System

Cette référence reprend le board `BRAND SYSTEM / UI SYSTEM BOARD`. Ce board n'est pas une bannière à reproduire : c'est le système de marque complet à appliquer dans le produit, le site, les documents, les emails et les supports investisseurs.

## Positionnement

Samay Këur est la plateforme moderne de gestion immobilière africaine. La marque doit évoquer la stabilité, la croissance, la prospérité, le patrimoine et la confiance financière.

Promesse courte :

> Manage. Grow. Prosper.

## Palette Officielle

| Token | Hex | Usage |
| --- | --- | --- |
| `brand-900` | `#0D1B16` | Fond principal dark, sidebar, splash, footer premium |
| `brand-700` | `#1F3B2E` | Vert patrimoine, surfaces dark, états actifs |
| `brand-paper` | `#F2EDE3` | Ivoire, wordmark, fonds premium light |
| `action-500` | `#FF8A00` | Triangle logo, CTA, paiement, alerte/action |

Règle clé : le vert porte la confiance, l'orange signale l'action. Ne jamais faire dominer l'orange hors CTA ou paiement.

## Logo

Actifs officiels :

- Source de vérité locale : `C:\Users\DELL\Documents\Perso\projet\samay Keur\new logo`.
- `/public/brand/mark-transparent.png` : symbole transparent officiel pour surfaces sans tuile.
- `/public/brand/app-icon-primary.png` : app icon / sidebar / loaders sur fond sombre.
- `/public/brand/app-icon-light.png` : variante claire sur surfaces ivoire/blanches.
- `/public/brand/app-icon-monochrome.png` : variante monochrome.
- `/public/brand/favicon.png` : favicon officiel.
- `/public/brand/logo-lockup-dark.png` : lockup officiel sur fond sombre.
- `/public/brand/logo-monochrome-lockup.png` : lockup monochrome.
- `/public/brand/splash-mobile.png` et `/public/brand/splash-desktop.png` : splash screens officiels.
- `/public/brand/logo-loader.mp4` et `/public/brand/logo-loader.lottie` : motion assets officiels de chargement.
- `/public/brand-mark.png` et `/public/logo.png` : alias de compatibilité uniquement.

Variantes à respecter :

- Version sombre : logo ivoire/orange sur fond `#0D1B16` ou `#1F3B2E`.
- Version claire : logo vert/orange sur fond ivoire ou blanc cassé.
- Monochrome : uniquement quand la couleur nuit à la lisibilité.
- Micro : icône seule, sans wordmark, à partir des petits formats.

Zone de protection : garder au minimum l'équivalent d'un quart de la largeur du symbole autour du logo.

Interdits :

- Logo noir sur orange plein.
- Glow agressif.
- Recoloration hors palette.
- Étirement du symbole.
- Usage du logo comme motif décoratif dense.

## Typographie

Direction du board : Poppins.

Produit :

- Famille : `Poppins`, fallback `Inter`, `system-ui`.
- Wordmark : capitales, letter spacing large.
- UI : titres courts, labels forts, chiffres lisibles.
- Aucun letter-spacing négatif.

## UI System

Surfaces :

- Page light : ivoire `#F2EDE3`.
- Card light : `#F8F4EC` ou blanc.
- Dark shell : `#0D1B16`.
- Dark elevated : `#14251E` / `#1F3B2E`.
- Bordures : fines, peu contrastées, jamais grises dures.

CTA :

- Création et paiement : orange `#FF8A00`.
- Navigation active : vert profond.
- Danger : rouge maîtrisé, jamais néon.

Motion :

- Construction du logo par segments.
- Glow lent et subtil.
- Hover maximum : `translateY(-2px)` ou `translateY(-4px)`.
- Pas d'effet gaming, pas de flash.

## Intégration Produit

Le logo doit vivre dans :

- Sidebar : lockup complet, version dark.
- Mobile topbar : icône seule.
- Auth : grand logo + fond premium.
- Splash/loading : logo animé.
- Empty states : watermark discret.
- Modals : micro-branding dans le header.
- Documents/PDF/emails : logo propre, vert profond, accent orange uniquement pour l'action.

## Contraste

Règles :

- Sur fond dark : texte ivoire ou blanc, orange pour CTA.
- Sur fond light : texte `#0D1B16`, vert pour structure, orange pour action.
- Ne jamais utiliser blanc sur ivoire sans séparation.
- Ne jamais utiliser noir pur sur dark.

## Sens De Marque

Le rendu final doit ressembler à une proptech/fintech africaine premium : calme, institutionnelle, moderne, très lisible, capable de rassurer agences, bailleurs et investisseurs.
