# Séparation Vitrine / Application

Samay Këur est désormais pensé comme deux surfaces distinctes :

- **Vitrine marketing** : site public, léger, SEO-friendly, orienté conversion.
- **Application SaaS** : espace authentifié React/Vite, connecté à Supabase et aux workflows métier.

## Domaines recommandés

```text
samaykeur.com       -> vitrine marketing autonome
www.samaykeur.com   -> vitrine marketing autonome
app.samaykeur.com   -> application SaaS
```

La vitrine expose uniquement les pages publiques et redirige :

- `/login` vers `https://app.samaykeur.com/login`
- `/signup` vers `https://app.samaykeur.com/signup`
- `/register` vers `https://app.samaykeur.com/signup`

## Projets

```text
marketing/
  index.html        -> landing statique premium
  styles.css        -> CSS critique de la vitrine
  script.js         -> CTA, FAQ, tracking dataLayer
  vite.config.ts    -> build indépendant vers dist-marketing
  vercel.json       -> config déploiement vitrine

src/
  App.tsx           -> application SaaS authentifiée
  pages/Auth.tsx    -> pont login/signup
```

## Scripts

```bash
npm run marketing:dev
npm run marketing:build
npm run dev
npm run build
```

## Branding partagé

Les deux surfaces consomment les mêmes assets publics :

```text
public/brand/
  app-icon-primary.png
  favicon.png
  logo-lockup-dark.png
  brand-tokens.css
  marketing/
  screens/
```

`public/brand/brand-tokens.css` contient les tokens de marque utilisables par la vitrine et par toute surface externe future.

## Pont Auth

L’application accepte maintenant les entrées directes :

- `/login` affiche l’écran connexion ;
- `/signup` ou `/register` affiche l’écran inscription ;
- `/#/auth` reste compatible avec l’ancien routage interne.

Si l’utilisateur non connecté arrive sur l’application sans route explicite, il est dirigé vers l’écran d’authentification plutôt que vers la vitrine React.

## Analytics

La vitrine pousse des événements dans `window.dataLayer` :

- `marketing_page_view`
- `marketing_cta_click`
- `marketing_section_scroll`
- `marketing_faq_toggle`

Cela permet de brancher Google Analytics, Meta Pixel ou un tag manager sans ajouter de dépendance dans l’application SaaS.
