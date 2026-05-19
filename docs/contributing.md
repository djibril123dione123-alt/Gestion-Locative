# Contribution

Ce projet doit rester coherent et maintenable malgre sa richesse fonctionnelle.

## Avant de coder

1. Identifier le domaine concerne : finance, GED, RBAC, UI, offline, document, SaaS.
2. Lire le document `/docs` correspondant.
3. Verifier s'il existe deja un composant ou service reutilisable.
4. Eviter les patterns visuels ou techniques isoles.

## Standards code

- TypeScript strict autant que possible.
- Fonctions metier courtes et testables.
- Pas d'ecriture financiere directe client.
- Pas d'acces Storage prive sans signed URL.
- Pas de bypass RLS.
- Commentaires courts uniquement pour les blocs non evidents.

## Standards UI

- Utiliser le design system existant.
- Harmoniser headers, cards, tables, modals, filters, empty states.
- Mobile-first sur les pages operationnelles.
- Pas de surcharge decorative.
- Respecter dark mode et touch targets.

## Checklist PR

```bash
npm run typecheck
npm run lint
npm run build
```

Si la PR touche un workflow critique :

- tester mobile ;
- tester offline si mutation ;
- tester utilisateur sans permission ;
- tester deux agences ;
- verifier absence de mojibake ;
- verifier qu'aucune donnees critique n'est supprimee brutalement.

## Encodage

Les fichiers doivent rester en UTF-8. Apres modification de textes francais, lancer le scan mojibake utilise dans le projet ou verifier manuellement les sequences d'encodage cassees les plus courantes avant de committer.
