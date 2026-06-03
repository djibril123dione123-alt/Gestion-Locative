# Séparation vitrine / app

Samay Këur utilise deux projets séparés.

## Responsabilités

| Surface | Domaine | Dépôt | Responsabilité |
|---|---|---|---|
| Vitrine | `samaykeur.com` | `SamayKeur.com.git` | Marketing, pages légales, pricing public, `/verify` |
| App | `app.samaykeur.com` | `app.SamayKeur.com.git` | Auth, métier, données privées, documents, finance |

## Règles de séparation

- La vitrine ne contient pas la logique métier privée.
- L'app ne doit pas redevenir une landing publique complète.
- `/login` et `/signup` côté vitrine redirigent vers l'app.
- `/verify` reste public sur la vitrine et ne demande pas de connexion.

## URLs importantes

```txt
https://samaykeur.com
https://samaykeur.com/verify?token=...&ref=...&type=...
https://app.samaykeur.com/login
https://app.samaykeur.com/signup
```

## Variables d'environnement côté app

```env
VITE_PUBLIC_VERIFY_BASE_URL=https://samaykeur.com
VITE_APP_URL=https://app.samaykeur.com
VITE_PUBLIC_APP_URL=https://app.samaykeur.com
VITE_MARKETING_URL=https://samaykeur.com
```

Les QR documentaires publics ne doivent jamais utiliser `app.samaykeur.com` comme base.

## Variables côté vitrine

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_PUBLIC_VERIFY_BASE_URL=https://samaykeur.com
VITE_APP_URL=https://app.samaykeur.com
VITE_MARKETING_URL=https://samaykeur.com
```

Ne jamais exposer de clé `service_role`.
