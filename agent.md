# agent.md — SAMAY KËUR

## 1. Purpose

Ce fichier est le point d'entrée opérationnel des agents IA travaillant sur le projet Samay Këur. Il définit les processus de travail, l'intégration des compétences et les normes de qualité à respecter rigoureusement à chaque intervention.

---

## 2. Required Reading Order

Avant d'exécuter la moindre modification de code, d'audit ou de planification, tout agent IA doit lire les fichiers de contexte dans l'ordre strict suivant :

1. **[AGENTS.md](file:///c:/Users/DELL/Documents/Samay%20Keur/App%20Samay%20Keur/AGENTS.md)** : Identité, stack et principes fondamentaux de développement du projet.
2. **[SAMAY_KEUR_CONTEXT.md](file:///c:/Users/DELL/Documents/Samay%20Keur/App%20Samay%20Keur/SAMAY_KEUR_CONTEXT.md)** : Vision globale du produit, frontières logiques et priorités.
3. **[CONVENTIONS.md](file:///c:/Users/DELL/Documents/Samay%20Keur/App%20Samay%20Keur/CONVENTIONS.md)** : Règles de codage (absence d'any, validation, services et repositories).
4. **[docs/current-state.md](file:///c:/Users/DELL/Documents/Samay%20Keur/App%20Samay%20Keur/docs/current-state.md)** : État réel des modules actifs en production et limites connues.
5. **[docs/roadmap.md](file:///c:/Users/DELL/Documents/Samay%20Keur/App%20Samay%20Keur/docs/roadmap.md)** : Priorités du cycle de stabilisation et objectifs (P0 à P4).
6. **[.agents/skills/](file:///c:/Users/DELL/Documents/Samay%20Keur/App%20Samay%20Keur/.agents/skills/)** : Chargement des instructions de compétences spécifiques requises.
7. **Documentation du chantier actif** (par exemple, **[docs/occupants-baux-spec.md](file:///c:/Users/DELL/Documents/Samay%20Keur/App%20Samay%20Keur/docs/occupants-baux-spec.md)** s'il est présent).

---

## 3. Active Workstream

```text
Current active workstream:
Occupants & Baux
```

> [!IMPORTANT]
> Ne pas abandonner ou dévier du chantier actif vers d'autres sujets (Finances, Rapports, GED, Monitoring, etc.) sans instruction ou arbitrage explicite de Djibril.

---

## 4. Execution Discipline

* **Un seul chantier actif à la fois** : Concentrer tous les efforts de développement sur le workstream en cours.
* **Finir avant d'ajouter** : Un module ou une page existante doit être totalement stable et vérifié avant d'entamer de nouvelles fonctionnalités.
* **Roadmap immuable** : L'identification d'anomalies lors d'audits ne modifie pas automatiquement la roadmap du projet.
* **Gestion de la dette** : Toute dette technique ou anomalie découverte hors du scope immédiat doit être répertoriée dans le backlog (ou signalée), et non corrigée de manière sauvage si elle ne bloque pas le chantier en cours.

---

## 5. Decision Framework

Avant de valider ou de proposer une décision d'architecture, de design ou de code, l'agent doit répondre aux questions suivantes :
1. **Confiance** : Est-ce que cela renforce la confiance globale dans l'application pour les utilisateurs ?
2. **Ledger** : Est-ce que cela protège et respecte l'invariant "Ledger-First" pour les flux financiers ?
3. **RLS/Multi-tenant** : Est-ce que cela respecte rigoureusement la sécurité de Row Level Security ?
4. **Finalité** : Est-ce que cela rapproche concrètement le chantier actif de sa définition de "terminé" ?
5. **Simplicité** : Est-ce que cela évite le "feature creep" (inflation de fonctionnalités inutiles) ?

---

## 6. Agent Roles

Les responsabilités et frontières opérationnelles des agents IA sont réparties comme suit :

### ChatGPT
* **Rôle** : Chief Technology and Product Officer (CTO).
* **Domaines** : Arbitrages stratégiques, validation de l'architecture, priorisation de la roadmap et vision globale.

### Codex
* **Rôle** : Ingénieur Principal de développement.
* **Domaines** : Implémentations lourdes, exploration approfondie du dépôt et refactoring de grande envergure.

### Antigravity
* **Rôle** : Auditeur Qualité et Développeur Cible.
* **Domaines** : Audit de code, QA, validation de sécurité/RLS, documentation, améliorations UX, corrections de bugs ciblées et petites/moyennes implémentations.

---

## 7. Skill Selection

Toute tâche importante doit débuter par le chargement et le respect du skill Samay localisé dans le dossier `.agents/skills/` :

* **`samay-cto`** : Arbitrages techniques, risques d'architecture et de roadmap.
* **`samay-product-architect`** : Arbitrage fonctionnel et adéquation avec les cas d'usage réels.
* **`samay-code-review`** : Validation de la qualité du code avant soumission.
* **`samay-supabase-security`** : Audits RLS, intégrité des migrations SQL et Edge Functions.
* **`samay-frontend-ux`** : Conformité avec les standards de design premium, drawers et responsive.
* **`samay-documentation`** : Maintien et mise à jour des documents d'état du dépôt.

Les skills externes (clonées depuis Anthropics dans `.agents/skills/` telles que `pdf`, `xlsx`, `docx`, `webapp-testing`...) sont des outils d'assistance technique secondaires. **Elles ne remplacent jamais les règles et guardrails des skills Samay.**

---

## 8. Non-Negotiables

* **Ledger First** : Le Ledger reste la source de vérité financière unique. Pas d'écriture ou d'ajustement financier factice côté UI.
* **RLS First** : La sécurité Row Level Security ne doit jamais être contournée ou désactivée.
* **Multi-tenant Strict** : Toutes les requêtes et écritures doivent être isolées via `agency_id` / `organization_id`.
* **Drawer First** : Favoriser les fiches d'informations et formulaires dans des drawers latéraux pour préserver le contexte de l'utilisateur.
* **Mobile First** : Tout écran ou parcours utilisateur critique doit fonctionner de manière irréprochable sur mobile.
* **Source unique de vérité** : Zéro duplication de logique ou de données sensibles.
* **Sécurité frontend** : Ne jamais exposer la clé `service_role` ou des secrets dans le code client.
* **Contrôle d'environnement** : Pas de commandes Supabase distantes (migration push, deploy functions) sans validation explicite.
* **Git Propre** : Pas de commits ni de pushs sauvages sans approbation humaine.

---

## 9. Validation Checklist

Avant de notifier que votre tâche est terminée, vous devez obligatoirement :

1. **Exécuter les validations locales** :
   ```bash
   npm run typecheck
   npm run lint
   npm run build
   ```
2. **Vérifier l'état de Git** :
   ```bash
   git diff --check
   git status --short
   ```
3. **Rédiger votre rapport de fin de tâche** incluant systématiquement :
   * Les fichiers créés ou modifiés ;
   * Les tests et vérifications exécutés ;
   * Les risques ou limites restantes ;
   * La confirmation que le build est propre.
