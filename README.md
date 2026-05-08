# Samay Keur - Gestion Locative SaaS

Samay Keur est une application SaaS multi-tenant de gestion immobiliere pour agences, bailleurs et equipes de gestion locative au Senegal et en Afrique francophone.

Le produit couvre la gestion des bailleurs, immeubles, unites, locataires, contrats, paiements, commissions, quittances, exports comptables, notifications et abonnements SaaS.

Production: https://samay-keur-gestion-locative.vercel.app

---

## Etat Actuel

Statut produit: beta stable, pas encore SaaS robuste a 100%.

Les flux critiques ont ete fortement durcis:

- Creation de contrat via Edge Function serveur.
- Creation, modification et annulation de paiements via Edge Functions, pas via insert client direct.
- Ledger financier limite aux paiements reellement encaisses.
- RLS multi-tenant durcie sur les tables coeur.
- Webhook PayDunya avec verification de hash, montant, token et transaction pending.
- Activation abonnement impossible depuis le frontend.
- Export comptable CSV signe SHA-256 et archive dans Supabase Storage.
- Defaults contrats:
  - caution par defaut = 2x loyer mensuel.
  - date de fin par defaut = date de debut + 2 ans.
- Paiement abonnement idempotent contre double clic, refresh et retry.
- Watchdog DB pour expirer les transactions PayDunya pending trop anciennes.
- Worker analytics corrige: plus de crash Postgres `FOR UPDATE` + `DISTINCT ON`.
- Integration branding premium finalisee:
  - assets officiels centralises dans `public/brand/`;
  - favicon, manifest, splash mobile/desktop et loader video alignes;
  - logo responsive selon contexte: sidebar, auth, vitrine, mobile, modals, empty states;
  - loaders unifies via composant brand;
  - pages Parametres, Analyses, Encaissements et Console super-admin harmonisees.

Dernieres verifications locales:

- `npm run lint`: OK
- `npm run typecheck`: OK
- `npm run test:unit`: OK, 31 tests
- `npm run build`: OK
- smoke test navigateur local: OK sur landing, auth, parametres, paiements

Dernier audit live DB:

- drift financier mois courant: `0`
- jobs pending: `0`
- jobs stuck: `0`
- jobs failed: `0`
- event_outbox ancien pending: `0`
- pending PayDunya > 24h: `0`

Attention: des secrets Supabase ont ete exposes pendant les sessions de travail. Ils doivent etre rotates avant tout lancement commercial.

---

## Stack Technique

- React 18
- Vite 5
- TypeScript
- TailwindCSS
- Supabase Auth
- Supabase PostgreSQL + RLS
- Supabase Edge Functions Deno
- Supabase Storage
- IndexedDB offline-first
- PayDunya pour Wave, Orange Money, Djamo et carte
- Resend pour emails
- Orange SMS API
- Sentry
- Vercel

---

## Branding Et Design System

Le branding Samay Keur est integre comme un systeme produit, pas comme une simple image.

Source officielle locale des assets:

```text
C:\Users\DELL\Documents\Perso\projet\samay Keur\new logo
```

Assets publics normalises:

| Asset | Usage |
|---|---|
| `public/brand/mark-transparent.png` | Symbole transparent pour surfaces sans fond |
| `public/brand/app-icon-primary.png` | App icon, sidebar, loader sombre |
| `public/brand/app-icon-light.png` | Logo sur surfaces claires/ivoire |
| `public/brand/app-icon-monochrome.png` | Variante monochrome |
| `public/brand/favicon.png` | Favicon navigateur |
| `public/brand/logo-lockup-dark.png` | Lockup complet sur fond sombre |
| `public/brand/logo-monochrome-lockup.png` | Lockup monochrome |
| `public/brand/splash-mobile.png` | Splash mobile |
| `public/brand/splash-desktop.png` | Splash desktop |
| `public/brand/logo-loader.mp4` | Animation de chargement |
| `public/brand/logo-loader.lottie` | Motion asset source |

Regles d'usage:

- Sidebar/mobile: icone seule, compacte, sans surcharge.
- Auth: logo compact dans le carre prevu, pas de grande bande intrusive.
- Landing/vitrine: lockup ou symbole selon le bloc, jamais distordu.
- Modals/empty states/loaders: micro-branding discret.
- Dark mode: variantes sombres ou transparentes.
- Light mode: variante claire ou app icon light.
- Ne jamais reprendre les fichiers depuis `Downloads`; utiliser uniquement la source officielle ci-dessus.

Composants principaux:

- `src/components/brand/BrandLogo.tsx`
- `src/components/ui/LoadingState.tsx`
- `src/components/ui/Button.tsx`
- `src/components/ui/EmptyState.tsx`
- `src/components/ui/Modal.tsx`

---

## Architecture

```text
Frontend React
  -> Hooks
  -> Services API / Services domaine
  -> Repositories
  -> Supabase client

Flux financiers sensibles
  -> Edge Functions
  -> Supabase service role
  -> PostgreSQL constraints / triggers / RPC
  -> ledger_entries / event_outbox / job_queue

Offline
  -> IndexedDB pending_mutations
  -> replay idempotent
  -> Edge Functions pour paiements
```

Regle importante: tout ce qui touche aux paiements, aux contrats critiques, au ledger ou a l'abonnement doit passer par une Edge Function ou une RPC securisee.

---

## Fonctionnalites

### Gestion locative

- Bailleurs
- Immeubles
- Unites
- Locataires
- Contrats
- Paiements
- Impayes
- Commissions
- Depenses
- Documents
- Calendrier
- Inventaires
- Interventions

### Finance

- Calcul serveur des parts agence / bailleur.
- Ledger append-only avec corrections/reversals.
- Snapshots financiers mensuels.
- Dashboard financier.
- Export livre comptable CSV signe SHA-256.
- Archivage Storage dans le bucket prive `agency-archives`.

### SaaS

- Multi-agence.
- Roles: `super_admin`, `admin`, `agent`, `comptable`, `bailleur`.
- Abonnements PayDunya.
- Plans: `starter`, `pro`, `business`, `enterprise`.
- Console super-admin.
- Audit dashboard.

### Offline-first

- Queue IndexedDB.
- Recovery des mutations restees en `syncing`.
- Replay paiements via Edge Functions.
- Idempotency keys pour eviter les doublons.

---

## Edge Functions

Fonctions principales:

| Function | Role |
|---|---|
| `create-contrat` | Creation contrat serveur avec agency_id injecte |
| `update-contrat` | Update contrat, transitions controlees |
| `create-paiement` | Creation paiement serveur, commission et ledger |
| `update-paiement` | Update paiement serveur |
| `cancel-paiement` | Annulation paiement + reversal ledger |
| `initiate-payment` | Creation transaction PayDunya |
| `paydunya-webhook` | IPN PayDunya, validation hash/montant/token |
| `export-accounting-ledger` | Export CSV comptable signe |
| `analytics-worker` | KPI et cohortes |
| `finance-worker` | Reconciliation finance |
| `notification-worker` | Jobs notifications |
| `send-email` | Envoi email |
| `send-sms` | Envoi SMS |
| `subscription-scheduler` | Suivi abonnements |

---

## Securite

Garanties actuellement en place:

- RLS active sur les tables exposees critiques.
- Policies multi-tenant strictes sur tables coeur.
- `activate_subscription` reserve au `service_role`.
- Pas d'activation abonnement depuis le frontend, meme en test mode.
- Webhook PayDunya valide:
  - hash PayDunya,
  - invoice token,
  - montant,
  - statut transaction,
  - idempotence via lock DB.
- Paiements directs client interdits dans le repository.
- Paiements offline replays via Edge Function.
- Export comptable archive en bucket prive avec URL signee.

Points critiques avant go-live:

- Rotater tous les secrets exposes.
- Verifier que la cle `service_role` n'existe jamais dans le frontend ni dans Vercel public env.
- Activer alertes Sentry paiement/ledger.
- Ajouter rate limiting externe ou applicatif sur toutes les Edge Functions publiques.
- Faire un audit Supabase Advisor complet avant vente.

---

## Base De Donnees Et Migrations Recentes

Migrations importantes recentes:

| Migration | Role |
|---|---|
| `20260506124617_phase3_payment_idempotency.sql` | Idempotence paiements loyers |
| `20260506125353_default_contract_caution.sql` | Caution par defaut = 2x loyer |
| `20260506130009_agency_archives_storage.sql` | Bucket Storage prive |
| `20260506131514_rls_tenant_core_tables.sql` | RLS tenant strict tables coeur |
| `20260506184449_default_contract_end_date.sql` | Date fin contrat = debut + 2 ans |
| `20260506190110_phase3_subscription_payment_idempotency.sql` | Idempotence paiement abonnement |
| `20260506190933_phase3_payment_watchdog.sql` | Watchdog pending PayDunya |
| `20260506191057_fix_worker_analytics_locking.sql` | Fix worker analytics |
| `20260512000001_phase3_finance_security_hardening.sql` | Durcissement finance/abonnement |

Appliquer les migrations avec prudence:

```bash
supabase db push
```

En production, verifier apres migration:

```sql
select count(*) from financial_snapshots
where period = date_trunc('month', current_date)::date
  and status <> 'ok';

select count(*) from job_queue where status = 'failed';

select count(*) from event_outbox
where status = 'pending'
  and created_at < now() - interval '15 minutes';
```

---

## Installation Locale

```bash
npm install
cp .env.example .env.local
npm run dev
```

Variables frontend obligatoires:

```env
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<publishable-or-anon-key>
VITE_APP_URL=http://localhost:5173
```

Variables serveur a configurer dans Supabase Edge Functions:

```env
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>

PAYDUNYA_ENV=test
PAYDUNYA_MASTER_KEY=...
PAYDUNYA_TEST_PRIVATE_KEY=...
PAYDUNYA_TEST_PUBLIC_KEY=...
PAYDUNYA_TEST_TOKEN=...
PAYDUNYA_LIVE_PRIVATE_KEY=...
PAYDUNYA_LIVE_PUBLIC_KEY=...
PAYDUNYA_LIVE_TOKEN=...

APP_URL=https://samay-keur-gestion-locative.vercel.app
```

Ne jamais commiter `.env.local`, service role, token Supabase Management API, cle PayDunya, cle Resend ou cle SMS.

---

## Scripts

| Commande | Description |
|---|---|
| `npm run dev` | Serveur Vite |
| `npm run build` | Build production |
| `npm run vercel-build` | Build utilise par Vercel |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript check |
| `npm run test:unit` | Tests Vitest |
| `npm run test` | Tests Playwright |

---

## Deploiement

Frontend:

```bash
npx vercel deploy --prod --yes --scope seul
```

Supabase Edge Functions:

```bash
npx supabase functions deploy create-paiement --project-ref <project-ref> --use-api
npx supabase functions deploy initiate-payment paydunya-webhook --project-ref <project-ref> --use-api
```

Verification minimale apres deploiement:

```bash
npm run lint
npm run typecheck
npm run test:unit
npm run build
```

---

## Flux Paiement Abonnement

1. Le frontend genere une `idempotency_key`.
2. `initiate-payment` verifie la session et l'agence.
3. La fonction refuse les plans non payables automatiquement.
4. Une transaction `payment_transactions` pending est creee.
5. PayDunya cree l'invoice.
6. Le token PayDunya est stocke.
7. Le client poll `payment_transactions.status`.
8. Le webhook PayDunya valide hash, token et montant.
9. `activate_subscription` active l'abonnement en service role uniquement.
10. La transaction passe en `completed`.

Cas controles:

- double clic: retourne la transaction existante.
- webhook replay: idempotent.
- montant incorrect: rejet.
- token inconnu: rejet.
- plan gratuit/enterprise: pas de paiement automatique.
- vieux pending: expiration via watchdog apres grace period.

---

## Flux Paiement Loyer

Les paiements de loyer ne doivent jamais etre inseres directement depuis le client.

Flux correct:

```text
Paiements.tsx
  -> createPaiementViaEdge()
  -> create-paiement Edge Function
  -> calcul commission serveur
  -> insert paiements
  -> trigger ledger_entries si statut paye/partiel
```

Le ledger ne doit enregistrer du cash que pour:

- `paye`
- `partiel`

Pas pour:

- `impaye`
- `en_attente`
- `annule`

---

## Offline

La queue offline est dans IndexedDB.

Regles:

- Les mutations non financieres peuvent passer par Supabase client si RLS le permet.
- Les paiements passent toujours par Edge Function.
- Chaque paiement offline doit avoir une `idempotency_key`.
- Les entrees `syncing` restees bloquees sont remises en `pending` au demarrage.

Limites restantes:

- Gestion de conflit multi-device encore basique.
- L'UI doit encore mieux distinguer local/pending/synced.
- Pas encore de backoffice complet de reconciliation.

---

## Scores Production Actuels

Evaluation realiste apres les derniers correctifs:

| Categorie | Score |
|---|---:|
| Fiabilite paiement | 78/100 |
| Resilience globale | 74/100 |
| Production readiness | 76/100 |
| Securite applicative | 75/100 hors rotation secrets |
| Scalabilite | 68/100 |

Verdict: beta stable avancee. Pas encore SaaS robuste pour scale 500 agences sans monitoring, rate limiting et reconciliation backoffice.

---

## Bloquants Avant Go-Live Payant

Critique immediat:

- Rotater tous les secrets exposes.
- Tester PayDunya sandbox/live de bout en bout avec vrai callback.
- Configurer alertes Sentry:
  - webhook failed,
  - activation failed,
  - ledger drift,
  - payment pending > 15 min,
  - worker failure.
- Ajouter rate limiting sur Edge Functions publiques.

Avant premiers clients:

- Backoffice reconciliation PayDunya.
- Tests Edge automatises: double webhook, spoof webhook, timeout, failed, pending, replay.
- Tests SQL RLS malveillants en CI.
- Tests SQL drift ledger en CI.
- UX offline plus explicite.

Avant scale:

- Pagination/virtualisation sur grandes listes.
- Cache client React Query ou SWR.
- Load test 10/100/1000 agences.
- Reduction bundle: isoler/remplacer `xlsx`, `jspdf`, gros chunks charts.
- Supabase Advisor complet et nettoyage des grants.

---

## Regles De Contribution

- Pas de modification finance sans test.
- Pas d'acces cross-tenant base sur `agency_id` fourni par le client.
- Pas de `service_role` dans le frontend.
- Pas de fallback silencieux sur commission, montant, statut ou plan.
- Pas de `.catch(() => {})` directement sur les query builders Supabase.
- Toute fonction `SECURITY DEFINER` doit avoir `SET search_path = public, pg_temp`.
- Toute nouvelle table exposee doit avoir RLS.
- Toute ecriture financiere doit etre idempotente.

---

## Note Securite

Si un secret a ete colle dans un chat, un ticket, un README ou un terminal partage, il est considere compromis.

Actions obligatoires:

1. Rotater le token Supabase Management API.
2. Rotater la cle `service_role`.
3. Rotater les cles PayDunya.
4. Rotater les cles Resend/SMS si elles ont ete exposees.
5. Re-deployer les Edge Functions et Vercel avec les nouveaux secrets.

---

Derniere mise a jour: 8 mai 2026.
