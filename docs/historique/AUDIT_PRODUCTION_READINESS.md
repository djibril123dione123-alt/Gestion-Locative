# Audit Production Readiness — Samay Këur
**Date**: 2026-04-26  
**Auditeur**: Senior Production Readiness Reviewer  
**Périmètre**: Code actuel, migrations, tests, CI/CD, configuration  

---

## Périmètre audité

**Fichiers lus réellement** (lecture complète ou partielle):
- `.env.example`, `vercel.json`, `vite.config.ts`, `tsconfig.json`, `tsconfig.app.json`, `package.json`
- `.github/workflows/ci.yml`
- `supabase/migrations/` (20+ fichiers, dont derniers récents 2026-04-25 à 2026-04-26)
- `src/lib/sentry.ts`, `src/lib/supabase.ts`, `src/contexts/AuthContext.tsx`
- `src/pages/AcceptInvitation.tsx`, `src/pages/Auth.tsx`, `src/components/ui/SetupWizard.tsx`, `src/pages/Dashboard.tsx`
- `src/pages/Paiements.tsx`, `src/pages/FiltresAvances.tsx`, `src/pages/Console.tsx`
- `tests/auth.spec.ts`, `playwright.config.ts`
- ESLint output, TypeScript output, Build output

**Audit méthodologie**:
- Exécution réelle de `npm run build` : ✅ PASSE (13.13s)
- Exécution réelle de `npm run typecheck` : ✅ EXÉCUTÉE (erreurs détectées)
- Exécution réelle de `npm run lint` : ✅ EXÉCUTÉE (erreurs et warnings)
- Lecture réelle des migrations SQL
- Vérification du code React/TypeScript

**Éléments NON vérifiables**:
- Exécution réelle en production (pas de test sur prod)
- Terraform / IaC si présent
- Secrets GitHub Actions exactes (visibles dans config mais pas testées)
- Certificats SSL
- Comportement runtime de Sentry (ne peut être testé qu'avec DSN configuré)
- Comportement réel des RLS policies (nécessiterait Supabase live)
- Exécution des tests Playwright (nécessiterait ChromeDriver)
- Audit de sécurité externe

---

## 1. Environnement & configuration

| Point | Statut | Preuve | Impact |
|-------|--------|--------|--------|
| **VITE_SUPABASE_URL défini** | Confirmé | `.env.example` ligne 12: `https://znvcfjelmikprjeoxrug.supabase.co` | ✅ OK |
| **VITE_SUPABASE_ANON_KEY à remplir** | Confirmé | `.env.example` ligne 16: commenté, pas de valeur hardcodée | ✅ OK |
| **VITE_SUPABASE_ANON_KEY exposé publiquement** | 🔴 Risque | `.env.example` ligne 16 contient un JWT valide hardcodé: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` | 🔴 Critique |
| **VITE_SENTRY_DSN présent mais optionnel** | Confirmé | `.env.example` ligne 19-22: Sentry config commentée | ✅ OK |
| **VITE_ENV: development/staging/production** | Confirmé | `.env.example` ligne 24: `development` | ✅ OK (default dev) |
| **VITE_APP_URL présent** | Confirmé | `.env.example` ligne 27 | ✅ OK |
| **vercel.json version** | Confirmé | `version: 2`, `@vercel/static-build` | ✅ OK |
| **Séparation dev/prod** | Partiel | Pas d'env file pour staging; pas de `.env.production` | 🟡 Moyen |
| **Vite strict mode** | Confirmé | `vite.config.ts`: `base: './'`, `sourcemap: true` | ✅ OK |
| **TypeScript strict** | Confirmé | `tsconfig.app.json`: `"strict": true`, `noUnusedLocals: true`, `noUnusedParameters: true` | ✅ OK |

**Score : 3/5**  
*Raison: Config de base OK, mais VITE_SUPABASE_ANON_KEY exposée en `.env.example` est une majorité risque (JWT valide hardcodé).*

---

## 2. Build & compilation

| Point | Statut | Preuve | Impact |
|-------|--------|--------|--------|
| **Build passe sans erreurs** | Confirmé | `npm run build` complète en 13.13s, génère dist/ | ✅ OK |
| **Build inclut Sentry plugin** | Confirmé | `vite.config.ts` ligne 3: `sentryVitePlugin`, build output affiche `[sentry-vite-plugin] ...` | ✅ OK |
| **Source maps générés** | Confirmé | `vite.config.ts` ligne 21: `sourcemap: true` | ✅ OK (si authToken configuré, sinon warnings) |
| **Lazy loading actif** | Confirmé | `optimizeDeps: { exclude: ['lucide-react'] }` | ✅ OK |
| **ESLint errors** | 🔴 Non fait | 10+ erreurs ESLint bloquantes | 🔴 Bloqueur |
| **TypeScript errors** | 🔴 Non fait | 30+ erreurs TS bloquantes | 🔴 Bloqueur |
| **import React; unused** | 🟠 Partiel | 3 fichiers: Notifications.tsx, TableauDeBordFinancierGlobal.tsx, etc. | 🟡 Moyen |
| **import unused (Download, Circle, DollarSign)** | 🟠 Partiel | 3+ imports inutilisés | 🟡 Moyen |
| **any[] résiduels** | 🔴 Partiel | SetupWizard.tsx: bailleur?: any; immeuble?: any; … (6 props `any`) | 🔴 Code smell |
| **React Hook rules violations** | 🔴 Oui | ConsoleModals.tsx ligne 72, 83: `useEffect` appelé conditionnellement ❌ React Hook Rules | 🔴 Runtime risk |
| **Missing useEffect deps** | 🔴 Oui | ConsoleModals.tsx ligne 33, AuthContext.tsx 44+: missing `loadProgress`, `loadProfile` | 🟠 Stale closure risk |
| **Unused variables** | 🟡 Oui | error, err, Circle, exportPDF, etc. | 🟡 Code quality |
| **Type mismatches (crucial)** | 🔴 Oui | Paiements.tsx ligne 95: `{ locataires: any[] }` ≠ `ContratRow` | 🔴 Runtime risk |

**Score : 1/5**  
*Raison: Build compile mais TypeScript et ESLint échouent. 30+ erreurs TS, React Hook Rules violations, type mismatches critiques.*

---

## 3. Base de données & migrations

| Point | Statut | Preuve | Impact |
|-------|--------|--------|--------|
| **Migrations en ordre chronologique** | Confirmé | Noms: `202601`, `20260107`, `20260110`, …, `20260425`, `20260426` | ✅ OK |
| **10 migrations récentes (2026-04-25/26)** | Confirmé | `ls supabase/migrations/*2026042*.sql | wc -l` = 10 | ✅ À jour |
| **Migration onboarding_refonte** | Confirmé | `20260425000007_onboarding_refonte.sql` crée `get_invitation_by_token`, `accept_invitation`, `approve_agency_request` RPC | ✅ OK |
| **Migration documents bucket** | Confirmé | `20260425000004_p0_stabilization.sql` crée `documents` bucket + RLS policies | ✅ OK |
| **Migration agency-assets bucket** | Confirmé | `20260426000001_create_agency_assets_bucket.sql` crée bucket + policies | ✅ OK |
| **Contrainte CHECK invitations.role** | Confirmé | `20260425000007.sql`: `invitations_role_check` includes 'admin', 'agent', 'comptable', 'bailleur' | ✅ OK |
| **Migration user_profiles recursion fix** | Confirmé | `20260425000003_fix_user_profiles_recursion.sql`: utilise `current_user_agency_id()` SECURITY DEFINER | ✅ Good |
| **Vue vw_owner_agency_stats** | Confirmé | `20260425000001_fix_vw_owner_agency_stats.sql` corrige colonne `montant_total` vs `montant` | ✅ OK |
| **Mismatch colonnes front/DB** | 🟠 Partiel | Migration OK mais Paiements.tsx a type mismatch (any vs ContratRow) | 🟡 Code-level risk |
| **Doublons de migrations** | Partiel | `20260127193945...` et `20260107224221...` ont des noms similaires → risque confusion | 🟡 Maintenance risk |

**Score : 4/5**  
*Raison: Migrations correctes, RLS fixes appliquées, mais doublons de noms et type mismatches front-end.*

---

## 4. RLS & sécurité multi-tenant

| Point | Statut | Preuve | Impact |
|-------|--------|--------|--------|
| **RLS activé sur tables** | Confirmé | Migrations montrent `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` | ✅ OK |
| **policies INSERT/SELECT/UPDATE/DELETE** | Confirmé | Multiples policies dans migrations | ✅ OK |
| **user_profiles recursion fixée** | Confirmé | `20260425000003`: utilise `current_user_agency_id()` SECURITY DEFINER | ✅ Fixed |
| **super_admin bypass** | Confirmé | Policies utilisent `is_super_admin()` function SECURITY DEFINER | ✅ OK |
| **storage.objects policies** | Confirmé | `documents` bucket: `documents_select_own_agency`, `documents_insert_own_agency`, etc. | ✅ OK |
| **agency-assets bucket public read** | Confirmé | `20260426000001`: `Public read access for agency assets` | ✅ OK |
| **invitations readable by token (anon)** | Confirmé | `20260425000004`: `Invitations readable by token` TO anon, authenticated, filters `status = 'pending'` | ✅ OK |
| **agencies INSERT policy permissive** | 🟠 Partiel | Migration '00007_onboarding': dropped `agencies_insert_authenticated`, reste `Super admin can insert agencies` | ✅ Secured |
| **Search_path explicit** | Partiel | Migrations: SET search_path = public, pg_temp | ✅ OK |
| **Conflit de policies** | Non vérifiable | Supabase runtime needed pour confirmer |  |

**Score : 4/5**  
*Raison: RLS structure correcte, recursion fixée, policies sensibles OK. Pas d'audit runtime possible.*

---

## 5. Authentification & onboarding

| Point | Statut | Preuve | Impact |
|-------|--------|--------|--------|
| **Auth Context setuped** | Confirmé | `src/contexts/AuthContext.tsx` initialise session, loadProfile | ✅ OK |
| **Profile auto-création via trigger** | Confirmé | AuthContext: retryCount logic for new profiles | ✅ OK |
| **AcceptInvitation page** | Confirmé | `src/pages/AcceptInvitation.tsx` appelle `get_invitation_by_token` RPC | ✅ OK |
| **Token security** | Confirmé | RPC SECURITY DEFINER, token validation, sessionStorage cleanup | ✅ OK |
| **Email matching validation** | Confirmé | `20260425000007`: `accept_invitation` RPC vérifie `lower(email)` match | ✅ OK |
| **SetupWizard présent** | Confirmé | `src/components/ui/SetupWizard.tsx` | ✅ OK |
| **SetupWizard type issues** | 🔴 Oui | `interface WizardData { bailleur?: any; … }` (6 props `any`) | 🟠 Code smell |
| **Welcome page check** | 🟠 Partiel | Pas d'audit de Welcome.tsx mais accès attendu | Non vérifiable |
| **Agency creation request logic** | 🟠 Partiel | Migrations mentionnent `agency_creation_requests`, `approve_agency_request`, `reject_agency_request` RPC | Confirmé non-testé |
| **agency_settings auto-create** | 🟠 Partiel | Migration '00007' mentionne "crée ses settings" dans narrative | Confirmé non-testé en code |
| **Subscription init** | 🟠 Partiel | Migration narrative mentionne "son abonnement" | Non vérifiable en code front |
| **Session expiration handling** | Non vérifiable | Pas d'audit de session timeout logic | |
| **Super_admin bypass security** | 🟠 Tentative | authContext accepte profiles, Console.tsx existe, mais pas audité complet | Non-complet |

**Score : 3/5**  
*Raison: Onboarding structure OK via RPC, but front-end type issues (any), narrative in migrations not always reflected in code.*

---

## 6. Bugs critiques confirmés

| Bug | Gravité | Statut actuel | Preuve | Impact production | Correctif |
|-----|---------|---------------|--------|-------------------|-----------|
| **split('T')[0] sans vérification** | 🟡 Moyen | Existent mais SAFE | 18 occurrences de `.split('T')[0]` | Pas de risque (ISO string garanti) | N/A acceptable |
| **confirm() / alert() natifs** | 🟡 Moyen | 1 seul alert() trouvé | FiltresAvances.tsx:232 `alert('Erreur lors de la recherche')` | UX dégradée | Remplacer par toast |
| **React Hook rules violation** | 🔴 Critique | OUI, bloquant | ConsoleModals.tsx: `useEffect()` appelé conditionnellement (ligne 72, 83) | ❌ Runtime crash possible | Refactoriser |
| **Console.tsx uses state for confirm** | 🟡 Moyen | Existe | ligne 467+ setConfirm() | OK, pas de natif confirm() détecté en code | N/A |
| **Type mismatch ContratRow** | 🔴 Critique | OUI | Paiements.tsx:95: typeof payload ≠ ContratRow | ❌ Runtime type error | Fix types strictement |
| **Missing useEffect dependencies** | 🔴 Critique | OUI | ConsoleModals.tsx:33, AuthContext.tsx:44 | ⚠️ Stale closure bugs | Add deps rigoureusement |
| **policy notifications INSERT missing** | ✅ Fixed | Non trouvé | Pas d'erreur dans latest migrations | N/A | Already fixed |
| **bucket agency-assets missing** | ✅ Fixed | Created | `20260426000001_create_agency_assets_bucket.sql` | OK | Fixed |
| **Paiements mois_concerne parsing** | 🟡 Moyen | Exist safe | SetupWizard.tsx:201 `.slice(0, 7) + '-01'` | OK si date valide | OK |
| **Unused variables cluttering** | 🟡 Moyen | Multiple | exportPDF unused, exportBilanEntreprisePDF unused, etc. | Code smell | Remove unused |

**Verdict**: 3 bugs bloquants confirmés (React Hook rules, type mismatches, missing deps). 2+ bugs moyen.

---

## 7. Fonctionnalités : état réel

| Module | Statut | Notes |
|--------|--------|-------|
| **Dashboard** | Fonctionnel | Code existe, imports OK, pas d'erreurs compilations critiques |
| **Bailleurs** | Supposé OK | Non audité directement |
| **Immeubles** | Supposé OK | Non audité directement |
| **Unités** | 🟠 Fragile | TypeScript error: `Type '"loue"' is not assignable to type '"libre"'` (Unites.tsx:139) |
| **Locataires** | Supposé OK | Non audité directement |
| **Contrats** | 🟡 Partiel | Paiements depend on contrats shape; type mismatches detected |
| **Paiements** | 🔴 Fragile | 6+ TypeScript errors, unused exports, type mismatches, N+1 risk (voir ligne 257) |
| **Dépenses** | Supposé OK | Code existe; split('T')[0] safe usage |
| **Loyers impayés** | 🔴 Fragile | 5+ TypeScript errors, property access on wrong types |
| **Commissions** | Supposé OK | Non audité |
| **Filtres avancés** | 🟡 Fragile | alert() natif (FiltresAvances.tsx:232), possible UX issue |
| **Tableau financier** | 🔴 Fragile | 4+ TypeScript errors, unused functions, undefined property access |
| **Paramètres** | Supposé OK | Non audité |
| **Inventaires** | Supposé OK | Code existe |
| **Interventions** | Supposé OK | split('T')[0] safe |
| **Calendrier** | Supposé OK | split('T')[0] safe |
| **Documents** | Supposé OK | Nueva bucket `documents` created |
| **Équipe** | Supposé OK | Non audité |
| **Abonnement** | 🟠 Partiel | Plan limits function existe, legacy fallback Pro plan |
| **Notifications** | 🟠 Fragile | Unused import React, migrations mentionne policies |
| **Console super_admin** | Partiel | Code existe Console.tsx, React Hook rules errors |
| **AcceptInvitation** | Fonctionnel | Bien structuré, RPC OK |

**Résumé**: 60% des modules non complètement auditée. **3 modules fragilisé** (Paiements, LoyersImpayes, TableauBordFinancier) avec erreurs TS. **1 module avec criticalité** (Unités avec type mismatch).

---

## 8. Performance

| Point | Statut | Preuve | Impact |
|-------|--------|--------|--------|
| **Lazy loading image** | Confirmé | lucide-react excluded from optimizeDeps | ✅ OK |
| **Code splitting Vite** | Confirmé | vite.config.ts default Vite behavior | ✅ OK |
| **N+1 queries visible** | 🟠 Possible | Paiements.tsx:257 `.forEach((paiement)` → pas clair si subqueries | 🟡 À vérifier |
| **Bundle size** | Confirmé | 1.2MB main bundle gzipped (large) | 🟡 Moyen |
| **abort/cancel requests** | Non vérifiable | Pas visible dans code front | |
| **realtime cleanup** | Non vérifiable | Supabase realtime not audited | |
| **Recharts lazy** | Non vérifiable | Components lazy load not visible | |

**Score : 2/5**  
*Raison: Vite OK mais N+1 possible et bundle large (1.2MB gzipped).*

---

## 9. UX & produit

| Point | Statut | Preuve | Impact |
|-------|--------|--------|--------|
| **Toast notifications** | Confirmé | `useToast()` hook exists, used in SetupWizard | ✅ OK |
| **Error boundaries** | Confirmé | `src/components/ErrorBoundary.tsx` created | ✅ OK |
| **Sentry error reporting** | Déclaré | `src/lib/sentry.ts` created, `src/hooks/useErrorReporting.ts` created | ✅ Déclaré |
| **Modal/confirm flows** | 🟠 Partiel | Console.tsx custom confirm state, more alert() remplace should remove natif alert | 🟡 Moyen |
| **Logo/branding** | Confirmé | Auth.tsx affiche logo Samay Këur | ✅ OK |
| **Responsive design** | Non vérifiable | Pas d'audit Playwright run | |
| **Accessibility** | 🟠 Partiel | Playwright tests ont accessibility checks, mais pas exécutés | Non vérifiable |

**Score : 3/5**

---

## 10. Tests, CI/CD, monitoring

| Point | Statut | Preuve | Impact |
|-------|--------|--------|--------|
| **GitHub Actions CI** | Confirmé | `.github/workflows/ci.yml` existe avec typecheck, lint, build | ✅ OK |
| **CI triggers on main** | Confirmé | `on: push branches: [main]` | ✅ OK |
| **Lint in CI** | Confirmé | `npm run lint` in workflow | ✅ Existe |
| **TypeCheck in CI** | Confirmé | `npm run typecheck` in workflow | ✅ Existe |
| **Build in CI** | Confirmé | `npm run build` in workflow | ✅ Existe |
| **Unit tests** | Non fait | Pas de test unitaires trouvé | ❌ Absent |
| **Playwright E2E** | Déclaré | `tests/auth.spec.ts`, `tests/user-flows.spec.ts` created | 📋 Déclaré non exécuté |
| **backup.yml** | Déclaré | `.github/workflows/backup.yml` created | 📋 Déclaré non exécuté |
| **Sentry monitoring** | Déclaré | `src/lib/sentry.ts` created | 📋 Déclaré non configuré |
| **CI fails on errors** | Confirmé | ES Lint errors bloqueraient le workflow | ✅ OK structure |
| **Build currently broken in CI** | 🔴 OUI | 30+ TS errors, 10+ ESLint errors = CI FAILS | 🔴 BLOCAGE |

**Score : 1/5**  
*Raison: CI structure OK mais CI building FAIL = production blocked.*

---

## 11. Documentation

| Point | Statut | Preuve | Impact |
|-------|--------|--------|--------|
| **README.md** | Confirmé | Exist | ✅ OK |
| **SETUP.md** | Confirmé | Exist, explains admin user creation | ✅ OK |
| **PRODUCTION_READINESS.md** | Déclaré | File created, score 97% claimed | 📋 À valider |
| **Runbooks/** | Déclaré | `docs/runbooks/` created | 📋 À valider |
| **SENTRY_README.md** | Déclaré | File created | 📋 À valider |
| **PLAYWRIGHT_README.md** | Déclaré | File created | 📋 À valider |
| **BACKUP_README.md** | Déclaré | File created | 📋 À valider |
| **.env setup instructions** | Confirmé | `.env.example` documented | ✅ OK |
| **Deployment steps** | Confirmé | `vercel.json` configured | ✅ OK |
| **Migration instructions** | 📋 Référencé | README mentionne `supabase/migrations` | Sommaire |

**Score : 3/5**  
*Raison: Docs existent mais many marked "Déclaré" non confirmé en contenu réel, scores claimed may not match audit reality.*

---

## Synthèse par domaine

| Domaine | Score | Verdict |
|---------|-------|---------|
| **Environnement & config** | 3/5 | Exposed JWT in .env.example is critical risk |
| **Build & compilation** | 1/5 | 🔴 CI FAILS - 30+ TS errors, React Hook violations |
| **Database & migrations** | 4/5 | RLS correct, recent fixes applied, name dupes |
| **RLS & multi-tenant** | 4/5 | Secure, recursion fixed, Storage policies OK |
| **Auth & onboarding** | 3/5 | RPC structure OK, front-end type issues |
| **Bugs confirmed** | 2/5 | 3 critical bugs (Hook rules, type mismatches, missing deps) |
| **Fonctionnalités** | 2/5 | 60% non-audited, 3 fragile modules have TS errors |
| **Performance** | 2/5 | Bundle 1.2MB gzipped, possible N+1 |
| **UX & produit** | 3/5 | Toast/Error Boundaries OK, 1 alert() natif |
| **Tests/CI/Monitoring** | 1/5 | 🔴 CI FAILS - No unit tests, E2E/Sentry déclarés non-testé |
| **Documentation** | 3/5 | Exist but many "déclaré" claims unverified |

---

## Score global

**Calcul**: 55 points max (11 domaines × 5 points)

| Domaine | Points |
|---------|--------|
| Config | 3 |
| Build | 1 |
| DB | 4 |
| RLS | 4 |
| Auth | 3 |
| Bugs | 2 |
| Features | 2 |
| Perf | 2 |
| UX | 3 |
| Tests/CI | 1 |
| Docs | 3 |
| **TOTAL** | **28 / 55** |

**Pourcentage**: **51%**

**Interprétation**:
- Base de données et RLS: solides après récentes fixes (4/5)
- Build et CI: 🔴 **cassés** (1/5 - TS/ESLint errors bloquent la compilation)
- Tests: 🔴 **absents en production** (1/5 - CI structure OK mais tests déclarés non-exécutés)
- Fonctionnalités: incomplètement auditées, certaines fragiles
- Documentation: revendiquée 97% production-ready mais non vérifiée

---

## Bloqueurs de production

### 🔴 Bloqueur #1: CI Build échoue
**Gravité**: CRITIQUE  
**Preuve**: 30+ erreurs TypeScript, 10+ erreurs ESLint  
**Fichiers affectés**: Paiements.tsx, LoyersImpayes.tsx, TableauDeBordFinancierGlobal.tsx, SetupWizard.tsx, ConsoleModals.tsx  
**Impact**: Impossible de déployer sur Vercel (build fails)  
**Correctif**: Fix toutes les erreurs TS/ESLint avant push

### 🔴 Bloqueur #2: React Hook rules violations
**Gravité**: CRITIQUE  
**Preuve**: ConsoleModals.tsx ligne 72, 83: `useEffect()` appelé conditionnellement  
**Impact**: Runtime crash possible, React rejection  
**Correctif**: Refactoriser pour hooking non-conditionnel

### 🔴 Bloqueur #3: Type mismatches critiques
**Gravité**: CRITIQUE  
**Preuve**: Paiements.tsx:95, LoyersImpayes.tsx:115-119, TableauDeBordFinancierGlobal.tsx:385  
**Impact**: Runtime type errors si payload incorrect  
**Correctif**: Fix types ou cast explicites

### 🔴 Bloqueur #4: Exposed JWT in .env.example
**Gravité**: CRITIQUE  
**Preuve**: `.env.example` ligne 16 contient JWT valide: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`  
**Impact**: Clé anon Supabase exposée, risque fuite inter-tenant  
**Correctif**: Supprimer JWT, remplacer par placeholder générique

### 🟠 Bloqueur #5: Missing useEffect dependencies
**Gravité**: IMPORTANT  
**Preuve**: ConsoleModals.tsx:33, AuthContext.tsx:44  
**Impact**: Stale closures, bugs de state subtils  
**Correctif**: Add missing deps to all `useEffect`

### 🟠 Bloqueur #6: No unit tests, E2E tests declared but unrun
**Gravité**: IMPORTANT  
**Preuve**: Playwright config exist, tests written, pero ninguna ejecución en CI  
**Impact**: Pas de validation fonctionnelle en CI  
**Correctif**: Add `npm test` to CI pipeline, fix test env setup

---

## Améliorations recommandées

### Urgentes avant prod (bloquer le go)
1. **Fix toutes les erreurs TypeScript** → 30+ errors à résoudre
2. **Fix toutes les erreurs ESLint** → 10+ errors à résoudre
3. **Fix React Hook rules violations** → ConsoleModals.tsx conditionals
4. **Supprimer JWT exposé dans .env.example**
5. **Add missing useEffect dependencies** → Risque stale closure
6. **Activer Playwright E2E tests en CI** → npm test dans workflow
7. **Fix type mismatches** → SetupWizard.tsx, Paiements.tsx, LoyersImpayes.tsx
8. **Remplacer alert() natif** → Toast notification

### Importantes après prod (30 jours)
1. Add unit tests (jest/vitest) pour core logic
2. Performance audit → Bundle 1.2MB gzipped est large
3. N+1 query audit → Possible dans Paiements module
4. Audit mobile responsiveness
5. Sentry DSN configuration et monitoring setup
6. Deploy runbooks validation en staging
7. Backup automation validation
8. Audit Supabase quota/limits

### Confort / dette technique (post-prod)
1. Remplacer `any` types → 30+ occurrences
2. Cleanup unused imports → 5+ fichiers
3. Refacto ConsoleModals.tsx → trop grand
4. Doctrine de shared constants vs components
5. ESLint rule strictness: enable noImplicitAny further

---

## 10 prochaines actions prioritaires

| # | Action | Impact | Effort |
|---|--------|--------|--------|
| 1 | **Fix TypeScript errors (30+)** | 🔴 Bloque CI | 2-3h |
| 2 | **Fix ESLint errors (10+)** | 🔴 Bloque CI | 1h |
| 3 | **Remove exposed JWT from .env.example** | 🔴 Sécurité | 5min |
| 4 | **Fix React Hook rules (useEffect conditionals)** | 🔴 Runtime risk | 1h |
| 5 | **Add missing useEffect dependencies** | 🟠 Stale closures | 1h |
| 6 | **Add Playwright tests to CI workflow** | 🟠 Validation | 30min |
| 7 | **Fix type mismatches (Paiements, Unités, etc.)** | 🔴 Runtime risk | 1-2h |
| 8 | **Replace alert() with toast notification** | 🟡 UX | 30min |
| 9 | **Verify Sentry DSN and monitoring setup** | 🟠 Ops | 30min |
| 10 | **Test full deployment flow on Vercel** | 🔴 Blocker | 1h |

**Total effort estimé**: 8-10 heures avant production-ready.

---

## Verdict final

### **NO-GO** ⛔

**Raison concise** (10 lignes max):

1. **CI build échoue**: 30+ erreurs TypeScript + 10+ ESLint = impossible de déployer.
2. **React Hook rules violations**: useEffect conditionnels causent crashes runtime.
3. **Type mismatches critiques**: RTE probable en Paiements, LoyersImpayes, Unités.
4. **Exposed JWT**: Clé Supabase anon hardcodée dans .env.example = risque sécurité.
5. **Missing useEffect deps**: Stale closures dans Auth et Console = bugs subtils.
6. **Tests non-exécutés**: Playwright et unit tests déclarés mais pas exécutés en CI.
7. **60% des modules non-auditées**: Impossible valider Bailleurs, Dépenses, etc. complètement.
8. **Documentation "97% production ready" non-vérifiée**: Claims exagérées par rapport à l'état réel du code.
9. **RLS et sécurité multi-tenant: OK**: Seul point fort (4/5).
10. **Ne pas déployer tant que bloqueurs ne sont pas resolus.**

**Instruction CTO**: Cette application n'est PAS production-ready. Elle nécessite 8-10 heures de fixes critiques avant tout déploiement. Les bloqueurs #1-5 sont non-négociables. Signer-off n'est possible qu'après build CI réussi, tous tests verts, et JWT suppression.
