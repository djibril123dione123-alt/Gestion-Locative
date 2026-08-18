import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  Archive,
  ArrowRight,
  Bell,
  Building2,
  Check,
  ChevronDown,
  CreditCard,
  Database,
  FileCheck2,
  FileText,
  HardDrive,
  KeyRound,
  Landmark,
  LockKeyhole,
  MessageCircle,
  Search,
  Smartphone,
  Sparkles,
  Users,
  WalletCards,
  Wifi,
} from 'lucide-react';
import { BrandLogo, BrandMark } from '../components/brand/BrandLogo';
import { PRICING_PLAN_DEFINITIONS } from '../lib/pricingCatalog';
import { trackPageView, trackEvent } from '../lib/analytics';

interface LandingPageProps {
  onNavigate?: (page: string) => void;
}

const CONTACT_WHATSAPP = '221769010960';

const ease: [number, number, number, number] = [0.22, 1, 0.36, 1];
const spring = { type: 'spring', stiffness: 126, damping: 22, mass: 0.74 } as const;

const fadeUp = {
  hidden: { opacity: 0, y: 22 },
  visible: { opacity: 1, y: 0 },
};

const stagger = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.07,
      delayChildren: 0.04,
    },
  },
};

const trustSignals = [
  'Pensé pour l’Afrique francophone',
  'Documents vérifiables',
  'Paiements locaux',
  'Mode terrain',
  'Agences et bailleurs',
];

const painPoints = [
  {
    title: 'Excel ne dit pas qui relancer',
    text: 'Les paiements, reliquats et retards finissent dans plusieurs fichiers difficiles à lire.',
    icon: FileText,
  },
  {
    title: 'WhatsApp devient une archive fragile',
    text: 'Captures, reçus, promesses de paiement et quittances se perdent dans les conversations.',
    icon: MessageCircle,
  },
  {
    title: 'Les bailleurs demandent des comptes',
    text: 'Sans rapport clair, chaque appel devient une recherche manuelle dans les chiffres.',
    icon: Bell,
  },
  {
    title: 'Les documents se régénèrent trop souvent',
    text: 'Contrats, factures et quittances doivent être retrouvables, versionnés et crédibles.',
    icon: Archive,
  },
];

const outcomes = [
  ['Encaissements suivis', 'Voyez immédiatement ce qui est payé, partiel ou en retard.'],
  ['Documents maîtrisés', 'Contrats, quittances, mandats et rapports restent archivés.'],
  ['Bailleurs rassurés', 'Chaque propriétaire reçoit des chiffres clairs et professionnels.'],
  ['Équipe organisée', 'Agents et comptables travaillent avec les bons accès.'],
];

const modules = [
  { title: 'Bailleurs', text: 'Portefeuille propriétaire, soldes, rapports et historique.', icon: Landmark },
  { title: 'Patrimoine', text: 'Immeubles, unités, occupation et rentabilité lisibles.', icon: Building2 },
  { title: 'Locataires', text: 'Coordonnées, statut, contrats, paiements et relances.', icon: Users },
  { title: 'Contrats', text: 'Cycle de vie, résiliation, mandats et pièces liées.', icon: FileCheck2 },
  { title: 'Encaissements', text: 'Paiements complets, partiels, avances et reliquats.', icon: CreditCard },
  { title: 'Documents', text: 'GED, quotas, versions, QR et archivage sécurisé.', icon: Database },
];

const financeRows = [
  ['Loyer reçu', 'Appartement F6', '+500 000 F CFA', 'Payé'],
  ['Paiement partiel', 'Studio Point E', '+180 000 F CFA', 'Reliquat'],
  ['Relance prévue', 'Villa Almadies', 'J+5', 'À suivre'],
  ['Net bailleur', 'Portefeuille Diop', '1 080 000 F CFA', 'Prêt'],
];

const documentRows = [
  ['Quittance mai 2026', 'QR de vérification', 'Version actuelle'],
  ['Contrat LOC-2026-04', 'Enregistrement confirmé', 'Signatures prêtes'],
  ['Rapport bailleur', 'Données à jour', 'PDF partageable'],
];

const landlordRows = [
  ['Immeuble Liberté', '8 unités', '2,4M F CFA', '96%'],
  ['Résidence Plateau', '12 unités', '3,8M F CFA', '91%'],
  ['Villa Almadies', '1 unité', '850k F CFA', '100%'],
];

const terrainFeatures = [
  { title: 'Mobile-first', text: 'Interface responsive optimisée pour le terrain. Consultez un locataire et validez un paiement en déplacement.', icon: Smartphone },
  { title: 'Mauvais réseau', text: 'Une partie de la consultation bénéficie de cache local. Les opérations s’adaptent aux conditions réelles.', icon: Wifi },
  { title: 'Modes de règlement', text: 'Espèces, Wave, Orange Money, virement : gardez la trace de chaque moyen de paiement.', icon: WalletCards },
  { title: 'WhatsApp utile', text: 'Le canal reste pratique, mais les preuves ne restent plus enfermées dedans.', icon: MessageCircle },
];

const trustStack = [
  { label: 'Séparation agences', value: 'Multi-tenant', icon: LockKeyhole },
  { label: 'Accès équipe', value: 'Rôles', icon: KeyRound },
  { label: 'Documents', value: 'QR', icon: FileCheck2 },
  { label: 'Stockage', value: 'Quotas', icon: HardDrive },
];

const plans = PRICING_PLAN_DEFINITIONS.map((plan) => ({
  id: plan.id,
  name: plan.name,
  audience: plan.audience,
  price: plan.priceLabel,
  unit: plan.billingLabel,
  capacity: plan.capacities.unites,
  support: plan.supportLabel,
  promise: plan.positioning,
  features: plan.features.slice(0, 3),
  highlighted: plan.highlighted,
}));

const faqs = [
  {
    question: 'Puis-je essayer Samay Këur avant de m’abonner ?',
    answer:
      'Oui. Les nouveaux comptes éligibles bénéficient de 30 jours d’essai gratuit, sans engagement. Vous pouvez ainsi tester la plateforme avant de choisir l’abonnement adapté à votre activité.',
  },
  {
    question: 'Samay Këur remplace-t-il Excel et WhatsApp ?',
    answer:
      'Il ne force pas vos équipes à changer brutalement leurs habitudes. Il centralise les données critiques pour éviter que les paiements, preuves et documents restent dispersés.',
  },
  {
    question: 'Les documents générés sont-ils crédibles pour les bailleurs ?',
    answer:
      'Oui. Contrats, mandats, quittances, factures et rapports sont structurés, archivés et peuvent être associés à une vérification QR.',
  },
  {
    question: 'Que se passe-t-il si la connexion est mauvaise ?',
    answer:
      'L’expérience web est responsive et pensée pour le terrain. Bien qu’une connexion soit requise, certaines données bénéficient d’un cache local pour faciliter la consultation.',
  },
  {
    question: 'Les données d’une agence sont-elles isolées ?',
    answer:
      'Oui. L’architecture multi-tenant sépare les agences, les accès, les documents et les permissions pour éviter les mélanges de données.',
  },
  {
    question: 'Peut-on migrer une agence existante ?',
    answer:
      'Oui. Le produit est pensé pour reprendre progressivement les bailleurs, immeubles, locataires, contrats, paiements et documents existants.',
  },
  {
    question: 'Pourquoi les plans incluent-ils du stockage ?',
    answer:
      'Samay Këur gère des documents, rapports, justificatifs et archives. Le stockage est donc une vraie capacité d’infrastructure, pas un détail secondaire.',
  },
];

function whatsappHref(message: string) {
  return `https://wa.me/${CONTACT_WHATSAPP}?text=${encodeURIComponent(message)}`;
}

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function Reveal({ children, className = '', delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.18 }}
      transition={{ duration: 0.58, ease, delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function PremiumButton({
  children,
  variant = 'primary',
  onClick,
  href,
}: {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'light';
  onClick?: () => void;
  href?: string;
}) {
  const className = {
    primary:
      'bg-gradient-to-r from-emerald-300 to-amber-100 text-emerald-950 shadow-[0_22px_58px_rgba(52,211,153,0.25)] hover:from-emerald-200 hover:to-white',
    secondary:
      'border border-white/18 bg-white/[0.08] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] hover:bg-white/[0.14]',
    light:
      'border border-emerald-950/10 bg-white text-emerald-950 shadow-sm hover:border-emerald-800/20 hover:bg-emerald-50',
  }[variant];

  const content = (
    <>
      {children}
      <ArrowRight className="h-4 w-4" />
    </>
  );

  if (href) {
    return (
      <motion.a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        whileHover={{ y: -2, scale: 1.01 }}
        whileTap={{ scale: 0.985 }}
        transition={spring}
        className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-black transition ${className}`}
      >
        {content}
      </motion.a>
    );
  }

  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ y: -2, scale: 1.01 }}
      whileTap={{ scale: 0.985 }}
      transition={spring}
      className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-black transition ${className}`}
    >
      {content}
    </motion.button>
  );
}

function SectionHeader({
  eyebrow,
  title,
  text,
  align = 'center',
  tone = 'light',
}: {
  eyebrow: string;
  title: string;
  text?: string;
  align?: 'center' | 'left';
  tone?: 'light' | 'dark';
}) {
  const dark = tone === 'dark';

  return (
    <Reveal className={align === 'center' ? 'mx-auto max-w-3xl text-center' : 'max-w-2xl'}>
      <p className={`text-xs font-black uppercase tracking-[0.16em] ${dark ? 'text-amber-200' : 'text-emerald-800'}`}>{eyebrow}</p>
      <h2 className={`mt-4 text-3xl font-black leading-[1.06] tracking-normal sm:text-5xl ${dark ? 'text-white' : 'text-slate-950'}`}>
        {title}
      </h2>
      {text && <p className={`mt-5 text-base leading-8 sm:text-lg ${dark ? 'text-emerald-50/70' : 'text-slate-600'}`}>{text}</p>}
    </Reveal>
  );
}

function TrustRail() {
  return (
    <div className="scrollbar-hide flex gap-2 overflow-x-auto pb-1 sm:grid sm:grid-cols-5 sm:overflow-visible sm:pb-0">
      {trustSignals.map((signal) => (
        <div
          key={signal}
          className="shrink-0 rounded-2xl border border-white/10 bg-white/[0.075] px-4 py-3 text-center text-xs font-black uppercase tracking-[0.11em] text-emerald-50/78 backdrop-blur sm:shrink"
        >
          {signal}
        </div>
      ))}
    </div>
  );
}

function PainTimeline() {
  return (
    <Reveal className="relative rounded-[2rem] border border-emerald-950/10 bg-white/76 p-5 shadow-[0_28px_86px_rgba(6,17,13,0.09)] backdrop-blur sm:p-7">
      <div className="absolute bottom-7 left-10 top-7 hidden w-px bg-gradient-to-b from-emerald-900/10 via-emerald-900/24 to-transparent sm:block" />
      <div className="space-y-5">
        {painPoints.map((item, index) => {
          const Icon = item.icon;
          return (
            <motion.div
              key={item.title}
              variants={fadeUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.48, ease, delay: index * 0.04 }}
              className="relative grid gap-4 rounded-[1.35rem] border border-transparent p-1 sm:grid-cols-[3.1rem_1fr]"
            >
              <div className="relative z-10 flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-950/10 bg-[#f5f1e7] text-emerald-800 shadow-sm">
                <Icon className="h-5 w-5" />
              </div>
              <div className="border-b border-emerald-950/10 pb-5 last:border-b-0">
                <h3 className="text-lg font-black leading-6 text-slate-950">{item.title}</h3>
                <p className="mt-2 max-w-xl text-sm font-semibold leading-7 text-slate-600">{item.text}</p>
              </div>
            </motion.div>
          );
        })}
      </div>
    </Reveal>
  );
}

function PlatformMap() {
  return (
    <Reveal className="relative [overflow:clip] rounded-[2.25rem] border border-white/10 bg-[radial-gradient(circle_at_50%_12%,rgba(52,211,153,0.18),transparent_28rem),rgba(255,255,255,0.045)] p-5 shadow-[0_34px_120px_rgba(0,0,0,0.22)] backdrop-blur sm:p-7">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:52px_52px]" />
      <div className="relative grid gap-5 lg:grid-cols-[0.88fr_1.12fr] lg:items-center">
        <div className="rounded-[1.7rem] border border-white/10 bg-[#06110d]/76 p-6">
          <BrandLogo size="md" tone="dark" showTagline />
          <h3 className="mt-8 text-3xl font-black leading-tight text-white">
            Un système central, pas une suite de fichiers.
          </h3>
          <p className="mt-4 text-sm font-semibold leading-7 text-emerald-50/64">
            Chaque module alimente le suivant : le paiement met à jour le reliquat, la quittance, le rapport bailleur et l’historique.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {modules.map((module) => {
            const Icon = module.icon;
            return (
              <motion.div
                key={module.title}
                whileHover={{ y: -3 }}
                transition={spring}
                className="group rounded-[1.35rem] border border-white/10 bg-white/[0.065] p-4 backdrop-blur"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-amber-100/10 text-amber-100 ring-1 ring-white/10">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="font-black text-white">{module.title}</h4>
                    <p className="mt-1 text-sm leading-6 text-emerald-50/56">{module.text}</p>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </Reveal>
  );
}

function HeroProductPreview() {
  const shouldReduceMotion = useReducedMotion();

  return (
    <Reveal className="relative">
      <motion.div
        aria-hidden
        className="absolute -inset-6 rounded-[2.5rem] bg-[radial-gradient(circle_at_20%_8%,rgba(52,211,153,0.22),transparent_34%),radial-gradient(circle_at_80%_82%,rgba(245,158,11,0.18),transparent_38%)] blur-2xl"
        animate={shouldReduceMotion ? undefined : { opacity: [0.58, 0.9, 0.58], scale: [0.98, 1.02, 0.98] }}
        transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        whileHover={{ y: -4 }}
        transition={spring}
        className="relative [overflow:clip] rounded-[2rem] border border-white/12 bg-[#06110d]/92 shadow-[0_34px_130px_rgba(0,0,0,0.36)] backdrop-blur"
      >
        <div className="border-b border-white/10 px-5 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <BrandMark size="sm" tone="dark" animated={false} />
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-white">Agence Keur Patrimoine</p>
                <p className="text-xs text-emerald-50/45">Vue opérationnelle du mois</p>
              </div>
            </div>
            <span className="rounded-full bg-emerald-300/12 px-3 py-1 text-xs font-black text-emerald-200">synchro</span>
          </div>
        </div>

        <div className="px-3 pt-3">
          <div className="[overflow:clip] rounded-[1.35rem] border border-white/10 bg-white/[0.04]">
            <img
              src="/brand/screens/screen-dashboard.jpg"
              alt="Tableau de bord Samay Këur avec encaissements, impayés, occupation et statistiques"
              className="aspect-[16/9] w-full object-cover object-top"
              loading="eager"
              decoding="async"
            />
          </div>
        </div>

        <div className="hidden gap-3 p-4 md:grid md:grid-cols-3">
          {[
            ['Payé', '8,4M', 'F CFA encaissés'],
            ['À relancer', '11', 'loyers ouverts'],
            ['À reverser', '1,08M', 'net bailleurs'],
          ].map(([label, value, caption]) => (
            <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.045] p-4">
              <p className="text-xs font-bold text-emerald-50/45">{label}</p>
              <p className="mt-2 text-2xl font-black text-white">{value}</p>
              <p className="mt-1 text-xs text-emerald-50/42">{caption}</p>
            </div>
          ))}
        </div>

        <div className="px-4 pb-4 xl:hidden">
          <div className="flex flex-wrap gap-2 rounded-2xl border border-white/10 bg-white/[0.04] p-3">
            {['Paiements', 'Quittances', 'Rapports', 'GED'].map((label) => (
              <span key={label} className="rounded-full border border-white/10 bg-white/[0.055] px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.12em] text-emerald-50/72">
                {label}
              </span>
            ))}
          </div>
        </div>

        <div className="hidden gap-4 px-4 pb-4 xl:grid xl:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-4">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-black text-white">Encaissements récents</p>
                <p className="text-xs text-emerald-50/45">Paiements, reliquats et relances reliés</p>
              </div>
              <CreditCard className="h-4 w-4 text-emerald-200" />
            </div>
            <div className="space-y-3">
              {financeRows.slice(0, 3).map(([label, place, value, status], index) => (
                <motion.div
                  key={label}
                  initial={{ opacity: 0, x: 16 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.42, ease, delay: index * 0.06 }}
                  className="grid grid-cols-[1fr_auto] gap-3 rounded-2xl border border-white/10 bg-slate-950/35 p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-white">{label}</p>
                    <p className="mt-1 truncate text-xs text-emerald-50/42">{place}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-emerald-100">{value}</p>
                    <p className="mt-1 text-[11px] font-bold text-amber-100/72">{status}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-4">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-black text-white">Documents prêts</p>
                <p className="text-xs text-emerald-50/45">Archivage, version et preuve</p>
              </div>
              <FileCheck2 className="h-4 w-4 text-amber-100" />
            </div>
            <div className="space-y-3">
              {documentRows.map(([title, status, proof]) => (
                <div key={title} className="rounded-2xl border border-white/10 bg-white/[0.035] p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate text-sm font-black text-white">{title}</p>
                    <span className="rounded-full bg-amber-100/10 px-2 py-1 text-[11px] font-black text-amber-100">{status}</span>
                  </div>
                  <p className="mt-2 text-xs text-emerald-50/42">{proof}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    </Reveal>
  );
}

function EditorialImage({
  src,
  alt,
  caption,
  tone = 'light',
  imageClassName = 'h-full min-h-[18rem] w-full object-cover',
}: {
  src: string;
  alt: string;
  caption: string;
  tone?: 'light' | 'dark';
  imageClassName?: string;
}) {
  const dark = tone === 'dark';

  return (
    <Reveal className={`[overflow:clip] rounded-[2rem] border shadow-[0_28px_86px_rgba(6,17,13,0.12)] ${dark ? 'border-white/10 bg-white/[0.04]' : 'border-emerald-950/10 bg-white'}`}>
      <img src={src} alt={alt} className={imageClassName} loading="lazy" decoding="async" />
      <div className={`border-t px-5 py-4 text-sm font-bold leading-6 ${dark ? 'border-white/10 bg-white/[0.04] text-emerald-50/70' : 'border-emerald-950/10 bg-white/92 text-slate-600'}`}>
        {caption}
      </div>
    </Reveal>
  );
}

function FinancePanel() {
  return (
    <Reveal className="rounded-[2rem] border border-emerald-950/10 bg-white p-5 shadow-[0_28px_86px_rgba(6,17,13,0.1)]">
      <div className="flex flex-col gap-4 border-b border-emerald-950/10 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-800">Finance du mois</p>
          <h3 className="mt-2 text-2xl font-black text-slate-950">Ce qui est payé, en retard ou à reverser.</h3>
        </div>
        <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-right">
          <p className="text-xs font-bold text-emerald-800">Taux suivi</p>
          <p className="text-2xl font-black text-emerald-950">94%</p>
        </div>
      </div>
      <div className="mt-5 space-y-3">
        {financeRows.map(([label, place, value, status]) => (
          <div key={`${label}-${place}`} className="grid gap-3 rounded-2xl border border-emerald-950/10 bg-[#fbfaf6] p-4 sm:grid-cols-[1fr_auto_auto] sm:items-center">
            <div className="min-w-0">
              <p className="font-black text-slate-950">{label}</p>
              <p className="mt-1 text-sm text-slate-500">{place}</p>
            </div>
            <p className="font-black text-emerald-800">{value}</p>
            <span className="w-max rounded-full bg-white px-3 py-1 text-xs font-black text-slate-600 shadow-sm">{status}</span>
          </div>
        ))}
      </div>
    </Reveal>
  );
}

function PhonePreview() {
  return (
    <Reveal className="relative mx-auto max-w-[19rem]">
      <div className="absolute -inset-8 rounded-[2rem] bg-emerald-300/18 blur-2xl" />
      <motion.div
        whileHover={{ y: -4 }}
        transition={spring}
        className="relative rounded-[2rem] border border-slate-200 bg-slate-950 p-2 shadow-[0_34px_100px_rgba(15,23,42,0.28)]"
      >
        <div className="[overflow:clip] rounded-[1.55rem] bg-[#f8faf5]">
          <div className="bg-[#09211a] px-4 pb-7 pt-5 text-white">
            <div className="flex items-center justify-between">
              <BrandMark size="sm" tone="dark" animated={false} />
              <span className="rounded-full bg-emerald-300/14 px-2.5 py-1 text-xs font-black text-emerald-200">terrain</span>
            </div>
            <p className="mt-6 text-xs font-bold text-emerald-200">Solde à reverser</p>
            <p className="mt-1 text-3xl font-black">1,08M</p>
            <p className="mt-2 text-sm text-slate-300">Rapport bailleur prêt</p>
          </div>
          <div className="-mt-4 space-y-3 px-4 pb-5">
            <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
              <p className="text-xs font-bold text-slate-500">Recouvrement du mois</p>
              <div className="mt-3 h-2 rounded-full bg-slate-100">
                <div className="h-2 w-[86%] rounded-full bg-emerald-500" />
              </div>
            </div>
            {[
              ['Loyer reçu', 'Villa Almadies', '+420k'],
              ['Relance', 'Studio Point E', 'J+5'],
              ['Quittance', 'Appartement C12', 'PDF'],
            ].map(([label, place, value]) => (
              <div key={place} className="rounded-2xl border border-slate-200 bg-white p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-slate-950">{label}</p>
                    <p className="mt-1 truncate text-xs text-slate-500">{place}</p>
                  </div>
                  <p className="text-sm font-black text-emerald-700">{value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </Reveal>
  );
}

export function LandingPage({ onNavigate }: LandingPageProps) {
  const [openFaq, setOpenFaq] = useState(0);
  const shouldReduceMotion = useReducedMotion();
  const year = useMemo(() => new Date().getFullYear(), []);

  const goSignup = () => onNavigate?.('auth');
  const goDemo = () => {
    trackEvent('demo_click');
    window.location.href = whatsappHref('Bonjour, je souhaite une démo de Samay Këur pour mon agence.');
  };

  useEffect(() => {
    trackPageView('landing_view');
  }, []);

  return (
    <div className="min-h-screen [overflow-x:clip] bg-[#f5f1e7] text-slate-950 [overscroll-behavior-y:auto] [touch-action:auto]">
      <motion.header
        initial={{ y: -18, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.55, ease }}
        className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-[#06110d]/90 text-white shadow-[0_12px_36px_rgba(6,17,13,0.22)] backdrop-blur-xl"
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="flex items-center gap-3">
            <BrandMark size="sm" tone="dark" animated={false} />
            <span className="text-base font-black tracking-[0.18em]">SAMAY KËUR</span>
          </button>
          <nav className="hidden items-center gap-6 text-sm font-bold text-emerald-50/72 lg:flex">
            <button type="button" onClick={() => scrollToId('probleme')} className="transition hover:text-white">Problème</button>
            <button type="button" onClick={() => scrollToId('plateforme')} className="transition hover:text-white">Plateforme</button>
            <button type="button" onClick={() => scrollToId('finance')} className="transition hover:text-white">Finance</button>
            <button type="button" onClick={() => scrollToId('documents')} className="transition hover:text-white">Documents</button>
            <button type="button" onClick={() => scrollToId('pricing')} className="transition hover:text-white">Pricing</button>
          </nav>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => onNavigate?.('auth')} className="hidden rounded-xl px-4 py-2 text-sm font-black text-emerald-50/82 transition hover:bg-white/10 hover:text-white sm:inline-flex">
              Connexion
            </button>
            <button type="button" onClick={goDemo} className="rounded-xl bg-emerald-300 px-4 py-2 text-sm font-black text-emerald-950 transition hover:bg-emerald-200">
              Démo
            </button>
          </div>
        </div>
      </motion.header>

      <main>
        <section className="relative [overflow-x:clip] bg-[#06110d] px-4 pb-16 pt-24 text-white sm:px-6 sm:pb-20 sm:pt-28 lg:px-8">
          <img
            src="/brand/marketing/landing-hero.jpg"
            alt=""
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 h-full w-full select-none object-cover opacity-[0.42]"
            loading="eager"
            decoding="async"
          />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_16%_8%,rgba(255,138,0,0.28),transparent_24rem),linear-gradient(115deg,rgba(6,17,13,0.96),rgba(6,17,13,0.8)_48%,rgba(6,17,13,0.52))]" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#f5f1e7] via-[#f5f1e7]/10 to-transparent" />

          <div className="relative mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.92fr_1.08fr] lg:items-center">
            <motion.div variants={stagger} initial="hidden" animate="visible" className="max-w-4xl">
              <motion.div variants={fadeUp} className="mb-6 inline-flex max-w-full items-center gap-2 rounded-full border border-white/14 bg-white/[0.08] px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-emerald-50/82 backdrop-blur">
                <Sparkles className="h-4 w-4 text-amber-100" />
                Infrastructure immobilière pour agences modernes
              </motion.div>
              <motion.h1 variants={fadeUp} className="max-w-4xl text-[2.7rem] font-black leading-[0.98] tracking-normal sm:text-6xl lg:text-7xl">
                Gérez vos loyers sans chaos.
              </motion.h1>
              <motion.p variants={fadeUp} className="mt-6 max-w-2xl text-lg font-semibold leading-8 text-emerald-50/78 sm:text-xl">
                Samay Këur centralise encaissements, impayés, contrats, documents et rapports bailleurs dans une plateforme pensée pour l’immobilier africain moderne.
              </motion.p>
              <motion.div variants={fadeUp} className="mt-8 flex flex-col items-start gap-4">
                <div className="flex flex-col gap-3 sm:flex-row">
                  <PremiumButton onClick={goSignup}>Commencer gratuitement</PremiumButton>
                  <PremiumButton variant="secondary" onClick={goDemo}>Demander une démo</PremiumButton>
                </div>
                <p className="text-sm font-bold text-emerald-50/60">30 jours d'essai gratuit · Sans engagement</p>
              </motion.div>
              <motion.div variants={fadeUp} className="mt-8 grid max-w-2xl gap-3 sm:grid-cols-3">
                {[
                  ['10 sec', 'pour comprendre le statut du mois'],
                  ['1 espace', 'pour loyers, contrats et rapports'],
                  ['0 chaos', 'dans les preuves et documents'],
                ].map(([value, label]) => (
                  <div key={value} className="rounded-2xl border border-white/10 bg-white/[0.075] p-4 backdrop-blur">
                    <p className="text-2xl font-black text-white">{value}</p>
                    <p className="mt-1 text-xs font-bold leading-5 text-emerald-50/62">{label}</p>
                  </div>
                ))}
              </motion.div>
            </motion.div>

            <HeroProductPreview />
          </div>

          <div className="relative mx-auto mt-10 max-w-7xl">
            <TrustRail />
          </div>
        </section>

        <section id="probleme" className="relative border-y border-emerald-900/10 bg-[#f5f1e7] px-4 py-20 sm:px-6 lg:px-8">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-[#f5f1e7] to-transparent" />
          <div className="pointer-events-none absolute right-[-10rem] top-20 h-80 w-80 rounded-full bg-emerald-900/8 blur-3xl" />
          <div className="mx-auto max-w-7xl">
            <SectionHeader
              eyebrow="Le terrain aujourd’hui"
              title="Le problème n’est pas le manque d’effort. C’est la dispersion."
              text="Les agences travaillent déjà beaucoup. Ce qui manque, c’est une structure claire pour suivre les loyers, retrouver les preuves et répondre aux bailleurs sans stress."
            />
            <div className="mt-12 grid gap-6 lg:grid-cols-[0.95fr_1.05fr] lg:items-stretch">
              <EditorialImage
                src="/brand/marketing/landing-before-after.jpg"
                alt="Avant et après centralisation de la gestion immobilière"
                caption="Passer des cahiers, fichiers et messages dispersés à un système de gestion centralisé."
              />
              <PainTimeline />
            </div>
          </div>
        </section>

        <section id="plateforme" className="relative bg-[#07120f] px-4 py-24 text-white sm:px-6 lg:px-8">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-[#f5f1e7] to-transparent opacity-25" />
          <div className="pointer-events-none absolute left-[-12rem] top-16 h-96 w-96 rounded-full bg-amber-200/8 blur-3xl" />
          <div className="mx-auto max-w-7xl">
            <div className="grid gap-12 lg:grid-cols-[0.78fr_1.22fr] lg:items-start">
              <div>
                <SectionHeader
                  align="left"
                  tone="dark"
                  eyebrow="Transformation"
                  title="Toute votre gestion immobilière au même endroit."
                  text="Samay Këur relie le workflow réel : bailleur, immeuble, unité, locataire, contrat, paiement, document et rapport."
                />
                <div className="mt-8 space-y-3">
                  {outcomes.map(([title, text]) => (
                    <Reveal key={title} className="rounded-2xl border border-white/10 bg-white/[0.045] p-5">
                      <p className="font-black text-white">{title}</p>
                      <p className="mt-2 text-sm leading-6 text-emerald-50/58">{text}</p>
                    </Reveal>
                  ))}
                </div>
              </div>

              <PlatformMap />
            </div>
          </div>
        </section>

        <section id="finance" className="relative bg-[#f5f1e7] px-4 py-24 sm:px-6 lg:px-8">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-[#07120f]/12 to-transparent" />
          <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.92fr_1.08fr] lg:items-center">
            <div>
              <SectionHeader
                align="left"
                eyebrow="Encaissements et impayés"
                title="Ne découvrez plus les impayés trop tard."
                text="Paiements reçus, paiements partiels, avances, reliquats et retards deviennent visibles dans un flux financier clair."
              />
              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                {[
                  ['Paiements partiels', 'Le reliquat reste clair et rattaché au bon mois.'],
                  ['Historique utile', 'Chaque encaissement garde sa date, son mode et sa référence.'],
                  ['Relances mieux ciblées', 'Les retards ne se mélangent pas aux paiements reçus.'],
                  ['Bailleurs informés', 'Le net à reverser devient compréhensible.'],
                ].map(([title, text]) => (
                  <Reveal key={title} className="rounded-2xl border border-emerald-950/10 bg-white/90 p-5 shadow-sm">
                    <p className="font-black text-slate-950">{title}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
                  </Reveal>
                ))}
              </div>
            </div>
            <div className="grid gap-5">
              <EditorialImage
                src="/brand/screens/screen-payments-table.jpg"
                alt="Écran Encaissements Samay Këur avec paiements reçus, reliquats, filtres et actions"
                caption="Un vrai écran d’encaissements pour lire paiements reçus, reliquats, filtres et actions financières."
              />
              <FinancePanel />
            </div>
          </div>
        </section>

        <section id="documents" className="relative bg-white px-4 py-24 sm:px-6 lg:px-8">
          <div className="pointer-events-none absolute left-[-8rem] top-24 h-72 w-72 rounded-full bg-emerald-900/6 blur-3xl" />
          <div className="mx-auto max-w-7xl">
            <SectionHeader
              eyebrow="Documents professionnels"
              title="Des documents propres, retrouvables et prêts à envoyer."
              text="Quittances, factures, contrats, mandats et rapports bailleurs ne sont plus de simples PDF jetables. Ils deviennent des preuves utiles."
            />
            <div className="mt-12 grid gap-6 lg:grid-cols-[1.08fr_0.92fr] lg:items-stretch">
              <EditorialImage
                src="/brand/screens/screen-rent-receipt.jpg"
                alt="Quittance de loyer générée par Samay Këur avec tableau financier et QR"
                caption="Une GED légère pour retrouver les contrats, quittances, rapports et justificatifs liés aux entités métier."
                imageClassName="h-full max-h-[36rem] min-h-[24rem] w-full object-contain bg-white p-4"
              />
              <div className="grid gap-5">
                <EditorialImage
                  src="/brand/screens/screen-qr-proof.jpg"
                  alt="Zoom sur QR code de vérification documentaire Samay Këur"
                  caption="Le QR renforce la confiance : il donne un accès clair à la vérification documentaire."
                  imageClassName="h-full min-h-[14rem] w-full object-cover object-center"
                />
                <Reveal className="rounded-[2rem] border border-emerald-950/10 bg-[#fbfaf6] p-5 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-900 text-white">
                      <Search className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-black text-slate-950">Retrouver au lieu de régénérer</p>
                      <p className="mt-1 text-sm text-slate-600">Même document, mêmes données : on réouvre l’existant.</p>
                    </div>
                  </div>
                  <div className="mt-5 space-y-3">
                    {documentRows.map(([title, status, proof]) => (
                      <div key={title} className="rounded-2xl border border-emerald-950/10 bg-white p-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="truncate font-black text-slate-950">{title}</p>
                          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-800">{status}</span>
                        </div>
                        <p className="mt-2 text-sm text-slate-500">{proof}</p>
                      </div>
                    ))}
                  </div>
                </Reveal>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-[#f5f1e7] px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div>
              <SectionHeader
                align="left"
                eyebrow="Bailleurs rassurés"
                title="Vos bailleurs savent où va leur argent."
                text="Le rapport bailleur transforme les chiffres du mois en information claire : encaissé, reliquat, commission, net à reverser et situation par immeuble."
              />
              <div className="mt-8">
                <PremiumButton variant="light" onClick={goDemo}>Voir un rapport type</PremiumButton>
              </div>
            </div>
            <Reveal className="[overflow:clip] rounded-[2rem] border border-emerald-950/10 bg-white shadow-[0_28px_86px_rgba(6,17,13,0.12)]">
              <img src="/brand/screens/screen-report-page.jpg" alt="Rapport bailleur Samay Këur avec synthèse et répartition financière" className="h-64 w-full object-cover object-top sm:h-80" loading="lazy" decoding="async" />
              <div className="p-5">
                <div className="grid gap-3">
                  {landlordRows.map(([building, units, amount, rate]) => (
                    <div key={building} className="grid gap-3 rounded-2xl border border-emerald-950/10 bg-[#fbfaf6] p-4 sm:grid-cols-[1fr_auto_auto_auto] sm:items-center">
                      <p className="font-black text-slate-950">{building}</p>
                      <p className="text-sm font-bold text-slate-500">{units}</p>
                      <p className="font-black text-emerald-800">{amount}</p>
                      <p className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-900">{rate}</p>
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        <section className="bg-[#07120f] px-4 py-20 text-white sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[1fr_0.9fr] lg:items-center">
            <div>
              <SectionHeader
                align="left"
                tone="dark"
                eyebrow="Mobile et terrain"
                title="Votre gestion continue même quand l’agence bouge."
                text="Agents en déplacement, bailleurs sur WhatsApp, mobile money, réseau instable : la plateforme est pensée pour le quotidien réel de l’immobilier."
              />
              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                {terrainFeatures.map((feature) => {
                  const Icon = feature.icon;
                  return (
                    <Reveal key={feature.title} className="rounded-2xl border border-white/10 bg-white/[0.045] p-5">
                      <Icon className="h-5 w-5 text-amber-100" />
                      <p className="mt-4 font-black text-white">{feature.title}</p>
                      <p className="mt-2 text-sm leading-6 text-emerald-50/60">{feature.text}</p>
                    </Reveal>
                  );
                })}
              </div>
            </div>
            <div className="grid gap-5">
              <PhonePreview />
              <EditorialImage
                tone="dark"
                src="/brand/screens/screen-payment-workflow.jpg"
                alt="Module d’enregistrement de paiement Samay Këur"
                caption="Un workflow de paiement concret : locataire, unité, période, montant et confirmation financière."
                imageClassName="h-full min-h-[18rem] w-full object-cover object-top"
              />
            </div>
          </div>
        </section>

        <section className="bg-white px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <SectionHeader
              eyebrow="Confiance et sécurité"
              title="Une gestion immobilière plus fiable, plus traçable, plus professionnelle."
              text="La crédibilité vient des détails : séparation des agences, rôles, archivage, stockage maîtrisé, audit trail et vérification documentaire."
            />
            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {trustStack.map((item) => {
                const Icon = item.icon;
                return (
                  <Reveal key={item.label} className="rounded-[1.6rem] border border-emerald-950/10 bg-[#fbfaf6] p-6 shadow-sm">
                    <Icon className="h-6 w-6 text-emerald-800" />
                    <p className="mt-5 text-3xl font-black text-slate-950">{item.value}</p>
                    <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">{item.label}</p>
                  </Reveal>
                );
              })}
            </div>
          </div>
        </section>

        <section id="pricing" className="bg-[#f5f1e7] px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <SectionHeader
              eyebrow="Des plans lisibles"
              title="Choisissez selon votre portefeuille et votre équipe."
              text="Le socle de gestion locative reste commun. Les plans augmentent surtout la capacité, le nombre d’utilisateurs et le niveau d’accompagnement."
            />
            <div className="mt-12 grid gap-4 lg:grid-cols-4">
              {plans.map((plan) => (
                <Reveal
                  key={plan.id}
                  className={`relative rounded-lg border p-6 transition duration-300 hover:-translate-y-1 ${
                    plan.highlighted
                      ? 'border-amber-200 bg-[#07120f] text-white shadow-[0_30px_100px_rgba(6,17,13,0.24)]'
                      : 'border-emerald-950/10 bg-white/92 text-slate-950 shadow-sm'
                  }`}
                >
                  {plan.highlighted && (
                    <div className="mb-4 inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-emerald-950">
                      Recommandé
                    </div>
                  )}
                  <p className={`text-xs font-black uppercase tracking-[0.12em] ${plan.highlighted ? 'text-emerald-200' : 'text-emerald-800'}`}>
                    {plan.audience}
                  </p>
                  <h3 className="mt-2 text-2xl font-black">{plan.name}</h3>
                  <p className={`mt-3 min-h-[4.5rem] text-sm leading-6 ${plan.highlighted ? 'text-emerald-50/66' : 'text-slate-600'}`}>
                    {plan.promise}
                  </p>
                  <div className="mt-6">
                    <span className="text-4xl font-black">{plan.price}</span>
                    {plan.unit && <span className={`ml-2 text-sm font-bold ${plan.highlighted ? 'text-emerald-50/58' : 'text-slate-500'}`}>{plan.unit}</span>}
                  </div>
                  <div className="mt-5 grid gap-2">
                    {[plan.capacity, plan.support].map((item) => (
                      <div key={item} className={`rounded-lg border px-3 py-2 text-sm font-black ${plan.highlighted ? 'border-white/10 bg-white/[0.07] text-amber-100' : 'border-emerald-950/10 bg-emerald-50 text-emerald-900'}`}>
                        {item}
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={plan.id === 'enterprise' ? goDemo : goSignup}
                    className={`mt-6 w-full rounded-xl px-4 py-3 text-sm font-black transition ${
                      plan.highlighted ? 'bg-emerald-300 text-emerald-950 hover:bg-emerald-200' : 'bg-slate-950 text-white hover:bg-emerald-950'
                    }`}
                  >
                    {plan.id === 'enterprise' ? 'Parler à l’équipe' : 'Démarrer'}
                  </button>
                  <div className="mt-6 space-y-3">
                    {plan.features.map((feature) => (
                      <div key={feature} className="flex gap-3">
                        <Check className={`mt-0.5 h-4 w-4 ${plan.highlighted ? 'text-emerald-300' : 'text-emerald-700'}`} />
                        <span className={`text-sm font-semibold ${plan.highlighted ? 'text-emerald-50/76' : 'text-slate-700'}`}>{feature}</span>
                      </div>
                    ))}
                  </div>
                </Reveal>
              ))}
            </div>
            <Reveal className="mt-8 rounded-lg border border-emerald-950/10 bg-white/80 p-5 text-center text-sm font-semibold leading-7 text-slate-600 shadow-sm">
              Les prix, identifiants et limites affichés ici sont issus du même catalogue que la facturation. Les besoins hors catalogue sont confirmés uniquement sur devis.
            </Reveal>
          </div>
        </section>

        <section id="faq" className="bg-white px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.78fr_1.22fr]">
            <SectionHeader
              align="left"
              eyebrow="Questions fréquentes"
              title="Les réponses qu’une agence sérieuse veut avant de confier sa gestion."
              text="Sécurité, migration, stockage, documents, offline et paiements locaux : la page doit rassurer avant même la démo."
            />
            <div className="space-y-3">
              {faqs.map((faq, index) => (
                <Reveal key={faq.question}>
                  <button
                    type="button"
                    onClick={() => setOpenFaq(openFaq === index ? -1 : index)}
                    className="w-full rounded-2xl border border-emerald-950/10 bg-[#fbfaf6] p-5 text-left shadow-sm transition hover:border-emerald-800/20"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <span className="font-black text-slate-950">{faq.question}</span>
                      <motion.span animate={{ rotate: openFaq === index ? 180 : 0 }} transition={spring}>
                        <ChevronDown className="h-5 w-5 text-slate-500" />
                      </motion.span>
                    </div>
                    <motion.div
                      initial={false}
                      animate={{ height: openFaq === index ? 'auto' : 0, opacity: openFaq === index ? 1 : 0 }}
                      transition={{ duration: 0.28, ease }}
                      className="overflow-hidden"
                    >
                      <p className="pt-4 leading-7 text-slate-600">{faq.answer}</p>
                    </motion.div>
                  </button>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-[#f5f1e7] px-4 py-20 sm:px-6 lg:px-8">
          <Reveal className="relative mx-auto max-w-7xl [overflow:clip] rounded-[2rem] bg-[#07120f] px-6 py-14 text-center text-white shadow-[0_35px_120px_rgba(6,17,13,0.24)] sm:px-10">
            <motion.div
              aria-hidden
              className="absolute left-1/2 top-0 h-72 w-72 -translate-x-1/2 rounded-full bg-amber-200/14 blur-3xl"
              animate={shouldReduceMotion ? undefined : { opacity: [0.5, 0.9, 0.5] }}
              transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
            />
            <div className="relative">
              <img src="/brand/logo-lockup-dark.png" alt="Samay Këur" className="mx-auto h-16 w-auto object-contain" loading="lazy" decoding="async" />
              <h2 className="mx-auto mt-7 max-w-3xl text-3xl font-black leading-tight tracking-normal sm:text-5xl">
                Installez une gestion locative qui paraît aussi sérieuse que l’argent qu’elle suit.
              </h2>
              <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-emerald-50/70">
                Vos loyers, documents, équipes et bailleurs méritent une plateforme qui donne confiance dès le premier écran.
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-4">
                <div className="flex flex-col gap-3 sm:flex-row">
                  <PremiumButton onClick={goSignup}>Commencer gratuitement</PremiumButton>
                  <PremiumButton variant="secondary" onClick={goDemo}>Demander une démo</PremiumButton>
                </div>
                <p className="text-sm font-bold text-emerald-50/60">30 jours d'essai gratuit · Sans engagement</p>
              </div>
            </div>
          </Reveal>
        </section>
      </main>

      <footer className="border-t border-white/10 bg-[#06110d] px-4 py-12 text-white sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1.05fr_0.95fr_0.8fr]">
          <div>
            <BrandLogo size="sm" tone="dark" showTagline />
            <p className="mt-5 max-w-md text-sm leading-7 text-emerald-50/60">
              Infrastructure immobilière pour agences, bailleurs et équipes qui veulent suivre leurs opérations avec sérieux, clarté et traçabilité.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {['Dakar', 'Sénégal', 'Mobile Money', 'Proptech sénégalaise'].map((tag) => (
                <span key={tag} className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-xs font-black text-emerald-50/72">
                  {tag}
                </span>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 text-sm">
            <div className="space-y-3">
              <p className="font-black text-white">Produit</p>
              <a href="#probleme" className="block text-emerald-50/60 hover:text-white">Problème</a>
              <a href="#plateforme" className="block text-emerald-50/60 hover:text-white">Plateforme</a>
              <a href="#finance" className="block text-emerald-50/60 hover:text-white">Finance</a>
              <a href="#documents" className="block text-emerald-50/60 hover:text-white">Documents</a>
            </div>
            <div className="space-y-3">
              <p className="font-black text-white">Confiance</p>
              <span className="block text-emerald-50/60">QR vérification</span>
              <span className="block text-emerald-50/60">GED privée</span>
              <span className="block text-emerald-50/60">Offline-first</span>
              <span className="block text-emerald-50/60">Rôles équipe</span>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-5">
            <p className="text-sm font-black text-white">Contact</p>
            <p className="mt-3 text-sm leading-6 text-emerald-50/60">Parlez à l’équipe pour une démo, une migration ou un plan agence.</p>
            <a
              href={whatsappHref('Bonjour Samay Këur, je souhaite échanger sur la plateforme.')}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-flex rounded-xl bg-emerald-300 px-4 py-3 text-sm font-black text-emerald-950 transition hover:bg-emerald-200"
            >
              Contacter sur WhatsApp
            </a>
          </div>
        </div>

        <div className="mx-auto mt-10 flex max-w-7xl flex-col gap-3 border-t border-white/10 pt-6 text-xs font-semibold text-emerald-50/46 sm:flex-row sm:items-center sm:justify-between">
          <p>{year} Samay Këur. Tous droits réservés.</p>
          <div className="flex flex-wrap gap-5">
            <a href="#" className="hover:text-white">Confidentialité</a>
            <a href="#" className="hover:text-white">Conditions</a>
            <a href="mailto:contact@samaykeur.com" className="hover:text-white">contact@samaykeur.com</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
