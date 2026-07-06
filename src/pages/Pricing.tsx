import { useState } from 'react';
import {
  ArrowRight,
  BarChart3,
  Building2,
  CheckCircle2,
  ChevronDown,
  Crown,
  Database,
  FileCheck2,
  Globe2,
  HardDrive,
  LockKeyhole,
  Network,
  ShieldCheck,
  Smartphone,
  Wifi,
  Zap,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { CheckoutModal } from '../components/billing/CheckoutModal';
import { BrandLogo } from '../components/brand/BrandLogo';
import orangeMoneyLogo from '../assets/payments/orange-money.png';
import waveLogo from '../assets/payments/wave.png';
import djamoLogo from '../assets/payments/djamo.png';

type PlanId = 'starter' | 'pro' | 'business' | 'enterprise';

interface PlanDef {
  id: PlanId;
  name: string;
  audience: string;
  price: number;
  priceLabel: string;
  billingLabel: string;
  positioning: string;
  outcome: string;
  icon: typeof Zap;
  accent: string;
  surface: string;
  highlighted?: boolean;
  badge?: string;
  capacities: {
    users: string;
    immeubles: string;
    unites: string;
    storage: string;
  };
  value: string[];
  infrastructure: string[];
  cta: string;
  ctaStyle: 'primary' | 'secondary' | 'outline' | 'contact';
}

const CONTACT_WHATSAPP = '221769010960';

const PLANS: PlanDef[] = [
  {
    id: 'starter',
    name: 'Starter',
    audience: 'Bailleur individuel',
    price: 5000,
    priceLabel: '5 000 F CFA',
    billingLabel: 'par mois',
    positioning: 'Pour structurer un petit patrimoine sans Excel dispersé.',
    outcome: 'Vous gardez une vision claire des loyers, documents et échéances essentielles.',
    icon: Zap,
    accent: '#475569',
    surface: '#F8FAFC',
    capacities: {
      users: '1 utilisateur',
      immeubles: '3 immeubles',
      unites: '10 unités',
      storage: '1 Go sécurisé',
    },
    value: [
      'Pilotage simple des loyers',
      'Documents locatifs professionnels',
      'Suivi basique des impayés',
      'Archivage documentaire léger',
    ],
    infrastructure: ['GED de démarrage', 'Exports essentiels', 'Support email'],
    cta: 'Commencer en Starter',
    ctaStyle: 'outline',
  },
  {
    id: 'pro',
    name: 'Pro',
    audience: 'Bailleur sérieux / petite gestion',
    price: 15000,
    priceLabel: '15 000 F CFA',
    billingLabel: 'par mois',
    positioning: 'Pour professionnaliser les encaissements et rassurer les propriétaires.',
    outcome: 'Vous automatisez le suivi financier, les relances et les rapports propriétaires.',
    icon: Building2,
    accent: '#F58220',
    surface: '#FFF7ED',
    highlighted: true,
    badge: 'Recommandé',
    capacities: {
      users: '5 utilisateurs',
      immeubles: '20 immeubles',
      unites: '100 unités',
      storage: '20 Go sécurisés',
    },
    value: [
      'Suivi propriétaire automatisé',
      'Reporting financier avancé',
      'Paiements Wave, Orange Money et Djamo',
      'QR de vérification documentaire',
      'Gestion des reliquats et paiements partiels',
    ],
    infrastructure: ['GED structurée', 'Synchronisation offline-first', 'Support WhatsApp prioritaire'],
    cta: 'Activer Pro',
    ctaStyle: 'primary',
  },
  {
    id: 'business',
    name: 'Business',
    audience: 'Agence immobilière structurée',
    price: 35000,
    priceLabel: '35 000 F CFA',
    billingLabel: 'par mois',
    positioning: 'Pour coordonner une équipe, sécuriser les workflows et piloter un portefeuille.',
    outcome: 'Votre agence gagne en contrôle : rôles, validations, audit trail et reporting consolidé.',
    icon: BarChart3,
    accent: '#0F766E',
    surface: '#ECFDF5',
    badge: 'Agence',
    capacities: {
      users: '15 utilisateurs',
      immeubles: '100 immeubles',
      unites: '500 unités',
      storage: '100 Go sécurisés',
    },
    value: [
      'Rôles et permissions avancés',
      'Workflows équipe et coordination agence',
      'Historique et audit trail opérationnel',
      'Rapports bailleurs et finance consolidés',
      'Portefeuille multi-gestionnaires',
    ],
    infrastructure: ['GED agence complète', 'API webhooks', 'Support prioritaire < 4h'],
    cta: 'Passer en Business',
    ctaStyle: 'secondary',
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    audience: 'Groupes, réseaux, multi-agences',
    price: 0,
    priceLabel: 'Sur devis',
    billingLabel: 'capacité sur mesure',
    positioning: 'Pour déployer une infrastructure immobilière gouvernée, sécurisée et scalable.',
    outcome: 'Vous obtenez une plateforme adaptée à vos règles, vos équipes et votre gouvernance.',
    icon: Crown,
    accent: '#14532D',
    surface: '#F0FDF4',
    capacities: {
      users: 'Sur mesure',
      immeubles: 'Sur mesure',
      unites: 'Sur mesure',
      storage: 'Fair usage contractualisé',
    },
    value: [
      'Multi-agence et gouvernance réseau',
      'SLA, sécurité et conformité renforcés',
      'Déploiement personnalisé et formation',
      'White-label et intégrations métier',
      'Account manager dédié',
    ],
    infrastructure: ['Architecture dédiée selon volume', 'API complète', 'Support institutionnel'],
    cta: 'Demander un devis',
    ctaStyle: 'contact',
  },
];

const TRUST_POINTS = [
  {
    icon: LockKeyhole,
    title: 'Stockage maîtrisé',
    text: 'Quotas par plan, archivage et réutilisation intelligente des documents générés.',
  },
  {
    icon: FileCheck2,
    title: 'Documents vérifiables',
    text: 'Contrats, quittances et factures avec QR de vérification et registre documentaire.',
  },
  {
    icon: Wifi,
    title: 'Terrain et mauvais réseau',
    text: 'Architecture offline-first pensée pour continuer le travail même en connexion instable.',
  },
  {
    icon: ShieldCheck,
    title: 'Sécurité multi-agence',
    text: 'Isolation tenant, permissions, audit trail et accès signés aux fichiers sensibles.',
  },
];

const COMPARISON_SECTIONS = [
  {
    title: 'Capacité opérationnelle',
    rows: [
      ['Positionnement', 'Bailleur individuel', 'Petite gestion locative', 'Agence structurée', 'Groupe / réseau'],
      ['Utilisateurs', '1', '5', '15', 'Sur mesure'],
      ['Immeubles', '3', '20', '100', 'Sur mesure'],
      ['Unités', '10', '100', '500', 'Sur mesure'],
      ['Stockage documents', '1 Go', '20 Go', '100 Go', 'Fair usage contractualisé'],
    ],
  },
  {
    title: 'Infrastructure documentaire',
    rows: [
      ['GED sécurisée', 'Légère', 'Structurée', 'Avancée', 'Gouvernée'],
      ['Documents générés', 'Essentiels', 'Professionnels', 'Avancés', 'Personnalisés'],
      ['QR de vérification', 'Base', 'Inclus', 'Inclus', 'Politiques dédiées'],
      ['Archivage et versioning', 'Standard', 'Standard', 'Avancé', 'Sur mesure'],
    ],
  },
  {
    title: 'Collaboration et contrôle',
    rows: [
      ['Rôles et permissions', 'Simple', 'Équipe réduite', 'Avancés', 'Gouvernance complète'],
      ['Audit trail', 'Basique', 'Opérationnel', 'Avancé', 'Conformité dédiée'],
      ['API / webhooks', 'Non inclus', 'Non inclus', 'Webhooks', 'API complète'],
      ['Support', 'Email', 'WhatsApp prioritaire', 'Prioritaire < 4h', 'Account manager'],
    ],
  },
];

const FAQS = [
  {
    q: 'Pourquoi le stockage est-il limité par plan ?',
    r: 'Le stockage documentaire a un coût réel. Les limites protègent la performance, la sécurité et les marges du service, tout en permettant une montée en capacité claire quand votre portefeuille grandit.',
  },
  {
    q: 'Que se passe-t-il si je dépasse mon quota ?',
    r: "Samay Këur vous alerte avant saturation. Vous pouvez archiver, nettoyer les fichiers temporaires ou passer au plan supérieur sans perdre vos documents critiques.",
  },
  {
    q: 'Les documents sont-ils sécurisés ?',
    r: 'Oui. Les fichiers sont séparés par agence, accessibles via URLs signées, et les documents critiques peuvent être versionnés, archivés et vérifiés par QR code.',
  },
  {
    q: 'Puis-je payer localement ?',
    r: 'Oui. Les plans supportent les circuits locaux comme Orange Money, Wave, Djamo et carte bancaire via PayDunya selon disponibilité.',
  },
  {
    q: 'Le mode offline est-il inclus ?',
    r: 'La logique offline-first est intégrée à la plateforme pour sécuriser le travail terrain, avec synchronisation lorsque la connexion revient.',
  },
  {
    q: 'Enterprise veut-il dire sans limite technique ?',
    r: 'Non. Enterprise signifie capacité contractualisée : stockage, utilisateurs, agences, SLA et intégrations sont dimensionnés selon votre volume réel.',
  },
];

interface PricingProps {
  embedded?: boolean;
  onNavigate?: (page: string) => void;
}

function PlanCard({ plan, onCta }: { plan: PlanDef; onCta: (plan: PlanDef) => void }) {
  const Icon = plan.icon;

  return (
    <article
      className={`relative mx-auto flex h-full w-full max-w-[20rem] min-w-0 flex-col overflow-hidden rounded-[1.7rem] border bg-white/96 shadow-premium backdrop-blur transition duration-300 hover:-translate-y-1 hover:border-emerald-900/25 hover:shadow-2xl sm:max-w-none ${
        plan.highlighted ? 'border-orange-300 ring-4 ring-orange-200/55' : 'border-white/70'
      }`}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-[radial-gradient(circle_at_22%_0%,rgba(245,130,32,0.13),transparent_11rem)]" />
      {plan.badge && (
        <div className="absolute right-4 top-4 z-10 rounded-full bg-emerald-950 px-3 py-1 text-xs font-extrabold uppercase tracking-[0.14em] text-white shadow-lg shadow-emerald-950/20">
          {plan.badge}
        </div>
      )}

      <div className="relative p-5 sm:p-6" style={{ background: `linear-gradient(145deg, ${plan.surface}, #FFFFFF 72%)` }}>
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-lg shadow-slate-950/5 ring-1 ring-black/5">
          <Icon className="h-5 w-5" style={{ color: plan.accent }} />
        </div>
        <p className="mt-5 text-xs font-black uppercase tracking-[0.18em] text-slate-500">{plan.audience}</p>
        <h3 className="mt-2 text-2xl font-extrabold tracking-tight text-slate-950">{plan.name}</h3>
        <p className="mt-3 min-h-[48px] break-words text-sm font-semibold leading-6 text-slate-600">{plan.positioning}</p>
        <div className="mt-5">
          <span className="text-3xl font-extrabold text-slate-950">{plan.priceLabel}</span>
          <span className="ml-2 text-sm font-bold text-slate-500">{plan.billingLabel}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 border-y border-emerald-950/10 bg-[linear-gradient(135deg,rgba(6,78,59,0.045),rgba(255,255,255,0.88),rgba(245,130,32,0.055))] p-4">
        {Object.entries(plan.capacities).map(([key, value]) => (
          <div key={key} className="rounded-xl border border-emerald-950/8 bg-white/82 px-3 py-2 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">{key === 'unites' ? 'unités' : key}</p>
            <p className="mt-1 text-xs font-black text-slate-800">{value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-1 flex-col gap-5 p-5 sm:p-6">
        <div>
          <p className="text-sm font-extrabold text-slate-950">Valeur métier</p>
          <ul className="mt-3 space-y-2.5">
            {plan.value.map((item) => (
              <li key={item} className="flex gap-2 text-sm font-semibold leading-5 text-slate-650">
                <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0" style={{ color: plan.accent }} />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-[1.25rem] border border-emerald-950/10 bg-gradient-to-br from-emerald-50 via-white to-orange-50/45 p-4 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-900">Infrastructure incluse</p>
          <ul className="mt-3 space-y-2">
            {plan.infrastructure.map((item) => (
              <li key={item} className="flex gap-2 text-xs font-bold leading-5 text-emerald-950/75">
                <Database className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-emerald-800" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <p className="mt-auto break-words text-sm font-semibold leading-6 text-slate-500">{plan.outcome}</p>

        <button
          type="button"
          onClick={() => onCta(plan)}
          className={`mt-1 flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-black transition active:scale-[0.98] ${
            plan.ctaStyle === 'outline'
              ? 'border border-emerald-900/20 bg-white text-emerald-950 hover:bg-emerald-50'
              : plan.ctaStyle === 'contact'
                ? 'bg-emerald-950 text-white hover:bg-emerald-900'
                : 'text-white shadow-lg'
          }`}
          style={
            plan.ctaStyle === 'primary' || plan.ctaStyle === 'secondary'
              ? { background: `linear-gradient(135deg, ${plan.accent}, #14532D)` }
              : undefined
          }
        >
          {plan.cta}
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </article>
  );
}

export function Pricing({ embedded = false, onNavigate }: PricingProps) {
  const { profile } = useAuth();
  const [checkoutPlan, setCheckoutPlan] = useState<PlanDef | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [showComparison, setShowComparison] = useState(false);

  const handleCta = (plan: PlanDef) => {
    if (plan.ctaStyle === 'contact') {
      window.open(
        `https://wa.me/${CONTACT_WHATSAPP}?text=${encodeURIComponent('Bonjour, je souhaite dimensionner un plan Enterprise Samay Këur.')}`,
        '_blank'
      );
      return;
    }

    if (!profile) {
      onNavigate?.('auth');
      return;
    }

    setCheckoutPlan(plan);
  };

  return (
    <div
      className={embedded ? '' : 'min-h-screen overflow-hidden'}
      style={{
        background: embedded
          ? 'transparent'
          : 'radial-gradient(circle at 16% 0%, rgba(245,130,32,0.24), transparent 19rem), radial-gradient(circle at 88% 4%, rgba(16,185,129,0.18), transparent 18rem), linear-gradient(180deg, #06120F 0%, #0B1B16 30%, #F4F0E7 56%, #FFFFFF 100%)',
      }}
    >
      {!embedded && (
        <section className="relative mx-auto max-w-6xl overflow-hidden rounded-b-[2.5rem] px-4 pb-9 pt-10 text-center sm:pb-12 sm:pt-16">
          <img
            src="/brand/marketing/landing-documents.jpg"
            alt=""
            aria-hidden="true"
            className="absolute inset-0 h-full w-full object-cover opacity-[0.24]"
          />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(245,130,32,0.18),transparent_18rem),linear-gradient(180deg,rgba(6,18,15,0.86),rgba(11,27,22,0.95))]" />
          <div className="pointer-events-none absolute left-1/2 top-6 h-64 w-64 -translate-x-1/2 rounded-full bg-orange-300/10 blur-3xl" />
          <div className="relative mb-5 flex justify-center">
            <BrandLogo size="sm" tone="dark" showTagline />
          </div>
          <div className="relative mx-auto inline-flex max-w-full items-center gap-2 rounded-full border border-white/12 bg-white/[0.08] px-3 py-2 text-xs font-extrabold uppercase tracking-[0.12em] text-emerald-50 shadow-sm backdrop-blur sm:px-4 sm:tracking-[0.16em]">
            <ShieldCheck className="h-4 w-4 text-orange-500" />
            <span className="truncate sm:hidden">Pricing SaaS</span>
            <span className="hidden sm:inline">Pricing infrastructure immobilière</span>
          </div>
          <h1 className="relative mx-auto mt-5 max-w-[17rem] text-[1.58rem] font-black leading-[1.12] tracking-tight text-white sm:mt-6 sm:max-w-4xl sm:text-6xl">
            Des plans pensés pour faire grandir une gestion locative sérieuse.
          </h1>
          <p className="relative mx-auto mt-5 max-w-[17.5rem] text-[0.88rem] font-semibold leading-7 text-emerald-50/80 sm:max-w-2xl sm:text-lg">
            Samay Këur ne vend pas seulement des fonctionnalités : la plateforme fournit l’infrastructure de paiement, GED,
            reporting, synchronisation et contrôle dont une agence a besoin pour travailler proprement.
          </p>
          <div className="relative mx-auto mt-7 grid max-w-[17.5rem] grid-cols-1 items-center justify-center gap-2 text-sm font-bold text-emerald-50 sm:flex sm:max-w-none sm:flex-wrap sm:gap-3">
            {[
              ['Orange Money', orangeMoneyLogo],
              ['Wave', waveLogo],
              ['Djamo', djamoLogo],
            ].map(([label, src]) => (
              <span key={label} className="inline-flex min-w-0 items-center justify-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-2 text-emerald-50 shadow-lg shadow-emerald-950/10 backdrop-blur">
                <img src={src} alt={label} className="h-5 w-5 rounded object-contain" />
                {label}
              </span>
            ))}
            <span className="inline-flex min-w-0 items-center justify-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-2 text-emerald-50 shadow-lg shadow-emerald-950/10 backdrop-blur">
              <Smartphone className="h-4 w-4 text-emerald-700" />
              Mobile Money local
            </span>
          </div>
        </section>
      )}

      <main className="sk-mobile-page max-w-7xl pb-12">
        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {PLANS.map((plan) => (
            <PlanCard key={plan.id} plan={plan} onCta={handleCta} />
          ))}
        </section>

        {!embedded && (
          <>
            <section className="mt-12 grid gap-4 lg:grid-cols-4">
              {TRUST_POINTS.map((item) => (
                <div key={item.title} className="rounded-[1.4rem] border border-emerald-950/10 bg-white/90 p-5 shadow-sm">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-800">
                    <item.icon className="h-5 w-5" />
                  </div>
                  <h2 className="mt-4 text-base font-black text-slate-950">{item.title}</h2>
                  <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">{item.text}</p>
                </div>
              ))}
            </section>

            <section className="mt-12 overflow-hidden rounded-[1.75rem] border border-emerald-950/10 bg-emerald-950 text-white shadow-2xl shadow-emerald-950/15">
              <div className="grid gap-0 lg:grid-cols-[1fr_1.2fr]">
                <div className="p-6 sm:p-8">
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.08] px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-emerald-100">
                    <Network className="h-3.5 w-3.5 text-orange-200" />
                    Capacité et fair usage
                  </div>
                  <h2 className="mt-5 text-2xl font-black tracking-tight sm:text-3xl">
                    Le pricing protège votre croissance et la stabilité de la plateforme.
                  </h2>
                  <p className="mt-4 text-sm font-semibold leading-7 text-emerald-50/70">
                    Les limites ne sont pas là pour bloquer : elles donnent une base saine pour dimensionner stockage, bande
                    passante, équipes, documents et support sans créer de coûts cachés.
                  </p>
                </div>
                <div className="grid gap-3 border-t border-white/10 bg-white/[0.04] p-5 sm:grid-cols-2 lg:border-l lg:border-t-0">
                  {[
                    ['Starter', '1 Go', 'Patrimoine léger'],
                    ['Pro', '20 Go', 'Gestion active'],
                    ['Business', '100 Go', 'Agence structurée'],
                    ['Enterprise', 'Sur mesure', 'Contrat fair usage'],
                  ].map(([plan, storage, note]) => (
                    <div key={plan} className="rounded-2xl border border-white/10 bg-black/15 p-4">
                      <HardDrive className="h-5 w-5 text-orange-200" />
                      <p className="mt-3 text-sm font-black text-white">{plan}</p>
                      <p className="mt-1 text-xl font-black text-emerald-100">{storage}</p>
                      <p className="mt-1 text-xs font-semibold text-emerald-50/55">{note}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="mt-10">
              <button
                type="button"
                onClick={() => setShowComparison(!showComparison)}
                className="mx-auto flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 shadow-sm transition hover:border-emerald-900/20 hover:text-emerald-950"
              >
                <ChevronDown className={`h-4 w-4 transition ${showComparison ? 'rotate-180' : ''}`} />
                {showComparison ? 'Masquer' : 'Voir'} le comparatif détaillé
              </button>

              {showComparison && (
                <div className="mt-6 overflow-hidden rounded-[1.4rem] border border-emerald-950/10 bg-white shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[820px] text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50">
                          <th className="px-5 py-4 text-left text-xs font-black uppercase tracking-[0.14em] text-slate-500">Capacité</th>
                          {PLANS.map((plan) => (
                            <th key={plan.id} className="px-4 py-4 text-left text-xs font-black uppercase tracking-[0.14em]" style={{ color: plan.accent }}>
                              {plan.name}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {COMPARISON_SECTIONS.map((section) => (
                          <FragmentRows key={section.title} title={section.title} rows={section.rows} />
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </section>

            <section className="mx-auto mt-12 max-w-3xl">
              <div className="text-center">
                <h2 className="text-2xl font-black text-slate-950">Questions clés avant de choisir</h2>
                <p className="mt-2 text-sm font-semibold text-slate-500">
                  Les réponses importantes sur stockage, sécurité, paiement local et montée en charge.
                </p>
              </div>
              <div className="mt-6 space-y-3">
                {FAQS.map((item, index) => (
                  <div key={item.q} className="overflow-hidden rounded-2xl border border-emerald-950/10 bg-white shadow-sm">
                    <button
                      type="button"
                      onClick={() => setOpenFaq(openFaq === index ? null : index)}
                      className="flex w-full items-center justify-between gap-4 p-5 text-left"
                    >
                      <span className="text-sm font-black text-slate-950">{item.q}</span>
                      <ChevronDown className={`h-5 w-5 flex-shrink-0 text-slate-400 transition ${openFaq === index ? 'rotate-180' : ''}`} />
                    </button>
                    {openFaq === index && (
                      <div className="border-t border-slate-100 px-5 pb-5 pt-4 text-sm font-semibold leading-7 text-slate-600">
                        {item.r}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>

            <section className="mt-12 rounded-[2rem] bg-slate-950 p-7 text-center text-white shadow-2xl shadow-slate-950/20 sm:p-12">
              <Globe2 className="mx-auto h-9 w-9 text-orange-300" />
              <h2 className="mx-auto mt-5 max-w-2xl text-3xl font-black tracking-tight">
                Choisissez un plan adapté à votre manière réelle de gérer l’immobilier.
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-sm font-semibold leading-7 text-slate-300">
                Démarrez petit, structurez vos workflows, puis augmentez les capacités quand votre portefeuille,
                vos documents et votre équipe grandissent.
              </p>
              <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => onNavigate?.(profile ? 'abonnement' : 'auth')}
                  className="rounded-2xl bg-orange-500 px-6 py-3 text-sm font-black text-white transition hover:bg-orange-400"
                >
                  Démarrer maintenant
                </button>
                <a
                  href={`https://wa.me/${CONTACT_WHATSAPP}?text=${encodeURIComponent('Bonjour, je veux comprendre quel plan Samay Këur choisir.')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-2xl border border-white/15 px-6 py-3 text-sm font-black text-slate-200 transition hover:bg-white/10"
                >
                  Parler à l’équipe
                </a>
              </div>
            </section>
          </>
        )}
      </main>

      {checkoutPlan && (
        <CheckoutModal
          isOpen
          onClose={() => setCheckoutPlan(null)}
          planId={checkoutPlan.id}
          planName={checkoutPlan.name}
          priceXof={checkoutPlan.price}
          onSuccess={() => {
            setCheckoutPlan(null);
            onNavigate?.('abonnement');
          }}
        />
      )}
    </div>
  );
}

function FragmentRows({ title, rows }: { title: string; rows: string[][] }) {
  return (
    <>
      <tr className="border-b border-slate-100 bg-emerald-50/60">
        <td colSpan={5} className="px-5 py-3 text-xs font-black uppercase tracking-[0.16em] text-emerald-950">
          {title}
        </td>
      </tr>
      {rows.map(([label, ...values]) => (
        <tr key={`${title}-${label}`} className="border-b border-slate-100">
          <td className="px-5 py-4 font-bold text-slate-700">{label}</td>
          {values.map((value, index) => (
            <td key={`${label}-${index}`} className="px-4 py-4 font-semibold text-slate-600">
              {value}
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
