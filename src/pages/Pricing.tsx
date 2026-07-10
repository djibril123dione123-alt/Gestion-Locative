import { useState, type ReactNode } from 'react';
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
import { CONTACT_WHATSAPP, PRICING_PLAN_DEFINITIONS, type PlanId, type PricingPlanDefinition } from '../lib/pricingCatalog';

interface PlanDef extends PricingPlanDefinition {
  icon: typeof Zap;
  price: number;
}

const PLAN_ICONS: Record<PlanId, typeof Zap> = {
  starter: Zap,
  pro: Building2,
  business: BarChart3,
  enterprise: Crown,
};

const PLANS: PlanDef[] = PRICING_PLAN_DEFINITIONS.map((plan) => ({
  ...plan,
  icon: PLAN_ICONS[plan.id],
  price: plan.price_xof,
}));

function SafeImage({
  src,
  alt,
  className,
  fallback,
  decorative = false,
}: {
  src: string;
  alt: string;
  className: string;
  fallback?: ReactNode;
  decorative?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) return fallback ? <>{fallback}</> : null;
  return (
    <img
      src={src}
      alt={decorative ? '' : alt}
      aria-hidden={decorative ? true : undefined}
      className={className}
      onError={() => setFailed(true)}
    />
  );
}

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
      className={`relative flex h-full w-full min-w-0 flex-col overflow-hidden rounded-2xl border bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${
        plan.highlighted
          ? 'border-orange-400 ring-2 ring-orange-400/30 shadow-orange-500/10'
          : 'border-slate-200/90 hover:border-emerald-700/30'
      }`}
    >
      <div
        className="h-1.5 w-full"
        style={{
          background: plan.highlighted
            ? 'linear-gradient(90deg, #F97316, #F59E0B)'
            : `linear-gradient(90deg, ${plan.accent}, #0F766E)`,
        }}
      />

      {plan.badge && (
        <div className="absolute right-3.5 top-3.5 z-10 rounded-full bg-slate-900 px-2.5 py-0.5 text-[0.65rem] font-black uppercase tracking-[0.12em] text-white shadow-sm">
          {plan.badge}
        </div>
      )}

      <div className="p-4 sm:p-5" style={{ background: `linear-gradient(145deg, ${plan.surface}, #FFFFFF 85%)` }}>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-xs ring-1 ring-slate-900/10">
            <Icon className="h-5 w-5" style={{ color: plan.accent }} />
          </div>
          <div>
            <p className="text-[0.62rem] font-black uppercase tracking-[0.14em] text-slate-500">{plan.audience}</p>
            <h3 className="text-xl font-black tracking-tight text-slate-950">{plan.name}</h3>
          </div>
        </div>
        <p className="mt-2.5 min-h-[36px] text-xs font-semibold leading-5 text-slate-600">{plan.positioning}</p>
        <div className="mt-4 flex items-baseline rounded-xl bg-white/80 px-3.5 py-2.5 border border-slate-150">
          <span className="text-2xl font-black text-slate-950">{plan.priceLabel}</span>
          <span className="ml-1.5 text-xs font-bold text-slate-500">{plan.billingLabel}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 border-y border-slate-100 bg-slate-50/70 p-3">
        {Object.entries(plan.capacities).map(([key, value]) => (
          <div key={key} className="rounded-xl border border-slate-200/70 bg-white px-3 py-2 shadow-2xs">
            <p className="text-[9px] font-black uppercase tracking-[0.12em] text-slate-400">
              {key === 'unites' ? 'unités' : key}
            </p>
            <p className="mt-0.5 text-xs font-black text-slate-900">{value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-1 flex-col justify-between gap-4 bg-white p-4 sm:p-5">
        <div className="space-y-4">
          <div>
            <p className="text-xs font-black uppercase tracking-wider text-slate-900">Valeur métier incluse</p>
            <ul className="mt-2.5 space-y-2">
              {plan.value.map((item) => (
                <li key={item} className="flex items-start gap-2 text-xs font-bold leading-5 text-slate-700">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0" style={{ color: plan.accent }} />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 shadow-2xs">
            <p className="text-[0.64rem] font-black uppercase tracking-[0.12em] text-slate-800">
              Infrastructure & support
            </p>
            <ul className="mt-2 space-y-1.5">
              {plan.infrastructure.map((item) => (
                <li key={item} className="flex items-center gap-2 text-xs font-bold text-slate-700">
                  <Database className="h-3.5 w-3.5 flex-shrink-0 text-emerald-700" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <p className="text-[0.72rem] font-semibold leading-5 text-slate-500 italic">{plan.outcome}</p>
        </div>

        <button
          type="button"
          onClick={() => onCta(plan)}
          className={`mt-2 flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-xs font-black shadow-sm transition active:scale-[0.98] ${
            plan.ctaStyle === 'outline'
              ? 'border-2 border-slate-300 bg-white text-slate-900 hover:border-slate-400 hover:bg-slate-50'
              : plan.ctaStyle === 'contact'
                ? 'bg-slate-900 text-white hover:bg-slate-800'
                : 'text-white shadow-md hover:opacity-95'
          }`}
          style={
            plan.ctaStyle === 'primary' || plan.ctaStyle === 'secondary'
              ? { background: `linear-gradient(135deg, ${plan.accent}, #0F766E)` }
              : undefined
          }
        >
          <span>{plan.cta}</span>
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
        <section className="relative mx-auto max-w-6xl overflow-hidden rounded-b-3xl px-4 pb-6 pt-6 text-center sm:pb-8 sm:pt-8">
          <SafeImage
            src="/brand/marketing/landing-documents.jpg"
            alt=""
            decorative
            className="absolute inset-0 h-full w-full object-cover opacity-[0.24]"
          />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(245,130,32,0.18),transparent_18rem),linear-gradient(180deg,rgba(6,18,15,0.86),rgba(11,27,22,0.95))]" />
          <div className="pointer-events-none absolute left-1/2 top-4 h-48 w-48 -translate-x-1/2 rounded-full bg-orange-300/10 blur-3xl" />
          <div className="relative mb-3 flex justify-center">
            <BrandLogo size="sm" tone="dark" showTagline />
          </div>
          <div className="relative mx-auto inline-flex max-w-full items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.08] px-3 py-1 text-[0.68rem] font-extrabold uppercase tracking-[0.14em] text-emerald-50 shadow-xs backdrop-blur">
            <ShieldCheck className="h-3.5 w-3.5 text-orange-500" />
            <span className="truncate sm:hidden">Pricing SaaS</span>
            <span className="hidden sm:inline">Pricing infrastructure immobilière</span>
          </div>
          <h1 className="relative mx-auto mt-3 max-w-3xl text-2xl font-black leading-tight tracking-tight text-white sm:text-3xl lg:text-4xl">
            Des plans pensés pour faire grandir une gestion locative sérieuse.
          </h1>
          <p className="relative mx-auto mt-2 max-w-2xl text-xs font-semibold leading-5 text-emerald-50/80 sm:text-sm">
            Samay Këur ne vend pas seulement des fonctionnalités : la plateforme fournit l’infrastructure de paiement, GED,
            reporting, synchronisation et contrôle dont une agence a besoin pour travailler proprement.
          </p>
          <div className="relative mx-auto mt-4 flex flex-wrap items-center justify-center gap-2 text-xs font-bold text-emerald-50">
            {[
              ['Orange Money', orangeMoneyLogo],
              ['Wave', waveLogo],
              ['Djamo', djamoLogo],
            ].map(([label, src]) => (
              <span key={label} className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-xs text-emerald-50 shadow-sm backdrop-blur">
                <SafeImage
                  src={src}
                  alt={label}
                  className="h-4 w-4 rounded object-contain"
                  fallback={
                    <span className="flex h-4 w-4 items-center justify-center rounded bg-white/15 text-[0.5rem] font-black text-emerald-50">
                      {label.slice(0, 2).toUpperCase()}
                    </span>
                  }
                />
                {label}
              </span>
            ))}
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-xs text-emerald-50 shadow-sm backdrop-blur">
              <Smartphone className="h-3.5 w-3.5 text-emerald-400" />
              Mobile Money local
            </span>
          </div>
        </section>
      )}

      <main className="sk-mobile-page max-w-7xl pt-4 pb-12">
        <section className="grid grid-cols-1 gap-3.5 md:grid-cols-2 lg:grid-cols-4">
          {PLANS.map((plan) => (
            <PlanCard key={plan.id} plan={plan} onCta={handleCta} />
          ))}
        </section>

        {!embedded && (
          <>
            <section className="mt-8 grid gap-3 lg:grid-cols-4">
              {TRUST_POINTS.map((item) => (
                <div key={item.title} className="rounded-xl border border-emerald-950/10 bg-white/90 p-4 shadow-sm">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-800">
                    <item.icon className="h-4 w-4" />
                  </div>
                  <h2 className="mt-3 text-sm font-black text-slate-950">{item.title}</h2>
                  <p className="mt-1 text-xs font-semibold leading-5 text-slate-600">{item.text}</p>
                </div>
              ))}
            </section>

            <section className="mt-10 overflow-hidden rounded-2xl border border-emerald-950/10 bg-emerald-950 text-white shadow-xl">
              <div className="grid gap-0 lg:grid-cols-[1fr_1.2fr]">
                <div className="p-5 sm:p-6">
                  <div className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.08] px-2.5 py-0.5 text-[0.68rem] font-black uppercase tracking-[0.14em] text-emerald-100">
                    <Network className="h-3 w-3 text-orange-200" />
                    Capacité et fair usage
                  </div>
                  <h2 className="mt-3 text-lg font-black tracking-tight sm:text-xl">
                    Le pricing protège votre croissance et la stabilité de la plateforme.
                  </h2>
                  <p className="mt-2 text-xs font-semibold leading-5 text-emerald-50/70">
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
                  className="rounded-2xl bg-orange-500 px-8 py-4 text-sm font-black text-white shadow-lg shadow-orange-500/30 transition hover:bg-orange-400 active:scale-95"
                >
                  Démarrer maintenant
                </button>
                <a
                  href={`https://wa.me/${CONTACT_WHATSAPP}?text=${encodeURIComponent('Bonjour, je veux comprendre quel plan Samay Këur choisir.')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-2xl border border-white/20 bg-white/5 px-8 py-4 text-sm font-black text-white transition hover:bg-white/10 active:scale-95"
                >
                  Parler à l’équipe WhatsApp
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
      <tr className="border-b border-slate-200 bg-slate-100/80">
        <td colSpan={5} className="px-6 py-3.5 text-xs font-black uppercase tracking-[0.16em] text-slate-800">
          {title}
        </td>
      </tr>
      {rows.map(([label, ...values]) => (
        <tr key={`${title}-${label}`} className="border-b border-slate-100 hover:bg-slate-50/90 transition-colors">
          <td className="w-1/4 px-6 py-4 font-bold text-slate-900">{label}</td>
          {values.map((value, index) => {
            const isPro = index === 1;
            return (
              <td
                key={`${label}-${index}`}
                className={`px-5 py-4 font-semibold ${
                  isPro
                    ? 'bg-orange-50/50 text-slate-900 font-bold border-x border-orange-200/50'
                    : 'text-slate-600'
                }`}
              >
                <div className="flex items-center gap-2">
                  {value === 'Inclus' || value.includes('Avancé') || value.includes('Prioritaire') ? (
                    <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100/80 px-2 py-0.5 text-xs font-bold text-emerald-900">
                      ✓ {value}
                    </span>
                  ) : value === 'Non inclus' ? (
                    <span className="text-slate-400 font-normal">—</span>
                  ) : (
                    <span>{value}</span>
                  )}
                </div>
              </td>
            );
          })}
        </tr>
      ))}
    </>
  );
}
