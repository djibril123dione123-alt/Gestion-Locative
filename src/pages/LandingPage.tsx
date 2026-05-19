import { useMemo, useState, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  ArrowRight,
  Bell,
  Check,
  ChevronDown,
  CreditCard,
  Database,
  FileCheck2,
  FileText,
  Fingerprint,
  HardDrive,
  Landmark,
  LockKeyhole,
  ReceiptText,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Users,
  WalletCards,
  Wifi,
} from 'lucide-react';
import { BrandLogo, BrandMark } from '../components/brand/BrandLogo';

interface LandingPageProps {
  onNavigate?: (page: string) => void;
}

const CONTACT_WHATSAPP = '221769010960';

const ease: [number, number, number, number] = [0.22, 1, 0.36, 1];
const spring = { type: 'spring', stiffness: 128, damping: 21, mass: 0.72 } as const;

const fadeUp = {
  hidden: { opacity: 0, y: 22 },
  visible: { opacity: 1, y: 0 },
};

const stagger = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.04,
    },
  },
};

const trustSignals = [
  'Paiements locaux',
  'GED securisee',
  'QR verification',
  'Offline-first',
  'RBAC equipe',
];

const transformation = [
  {
    before: 'WhatsApp, Excel et recus disperses',
    after: 'Un registre financier lisible par agence',
    icon: WalletCards,
  },
  {
    before: 'Quittances regenerees sans trace',
    after: 'Documents archives, versionnes et verifiables',
    icon: FileCheck2,
  },
  {
    before: 'Relances manuelles et retards invisibles',
    after: 'Workflows de recouvrement contextualises',
    icon: Bell,
  },
  {
    before: 'Acces equipe difficiles a controler',
    after: 'Permissions par role, page et utilisateur',
    icon: Users,
  },
];

const workflows = [
  {
    title: 'Encaissement terrain',
    text: 'Paiement partiel, reliquat, commission et quittance restent relies dans un flux clair.',
    icon: CreditCard,
    detail: 'Wave, Orange Money, Djamo, PayDunya',
  },
  {
    title: 'Documents professionnels',
    text: 'Contrats, mandats, quittances et rapports sont archives puis reutilises si les donnees ne changent pas.',
    icon: FileText,
    detail: 'Registry, hash, versioning, QR',
  },
  {
    title: 'Reporting bailleur',
    text: 'Chaque proprietaire recoit une vision structuree par immeuble, unite, locataire et periode.',
    icon: Landmark,
    detail: 'Revenus, impayes, commissions',
  },
  {
    title: 'Equipe controlee',
    text: 'Agents et comptables voient uniquement les pages, actions et donnees autorisees.',
    icon: ShieldCheck,
    detail: 'RBAC, RLS, audit trail',
  },
];

const infrastructure = [
  { label: 'Isolation agences', value: 'RLS', icon: LockKeyhole },
  { label: 'Documents prives', value: 'Signed URLs', icon: FileCheck2 },
  { label: 'Travail terrain', value: 'Offline queue', icon: Wifi },
  { label: 'Stockage maitrise', value: 'Quotas', icon: HardDrive },
];

const productMoments = [
  ['Paiement recu', 'Appartement F6', '+500 000 FCFA'],
  ['Reliquat mis a jour', 'Locataire Diouf', '60 000 FCFA'],
  ['Quittance verifiee', 'QR document', 'Authentique'],
  ['Rapport bailleur', 'Mai 2026', 'Pret'],
];

const plans = [
  {
    name: 'Starter',
    audience: 'Bailleur individuel',
    price: '5 000',
    unit: 'FCFA/mois',
    storage: '1 Go',
    promise: 'Structurer un petit patrimoine sans Excel disperse.',
    features: ['Documents locatifs professionnels', 'Suivi simple des loyers', 'Archivage documentaire leger'],
  },
  {
    name: 'Pro',
    audience: 'Gestion active',
    price: '15 000',
    unit: 'FCFA/mois',
    storage: '20 Go',
    promise: 'Piloter les encaissements et rassurer les proprietaires.',
    features: ['Reporting financier avance', 'Mobile money local', 'QR verification documentaire'],
    highlighted: true,
  },
  {
    name: 'Business',
    audience: 'Agence structuree',
    price: '35 000',
    unit: 'FCFA/mois',
    storage: '100 Go',
    promise: 'Coordonner une equipe avec permissions, workflows et audit trail.',
    features: ['Roles et permissions avances', 'GED agence complete', 'Support prioritaire'],
  },
  {
    name: 'Enterprise',
    audience: 'Groupes et reseaux',
    price: 'Sur devis',
    unit: '',
    storage: 'Fair usage',
    promise: 'Dimensionner une infrastructure multi-agence gouvernee.',
    features: ['SLA et gouvernance', 'API et integrations', 'Onboarding dedie'],
  },
];

const faqs = [
  {
    question: 'Les donnees sont-elles separees par agence ?',
    answer:
      'Oui. Le modele multi-tenant repose sur l agence, les policies RLS, les permissions serveur et des chemins Storage separes.',
  },
  {
    question: 'Les documents generes sont-ils verifies ?',
    answer:
      'Les documents critiques peuvent etre relies a un registre, a un QR de verification et a une URL publique de controle documentaire.',
  },
  {
    question: 'Comment Samay Keur limite les couts de stockage ?',
    answer:
      'La GED distingue uploads et documents generes, reutilise les fichiers identiques via hash, versionne les changements et applique des quotas par plan.',
  },
  {
    question: 'L application fonctionne-t-elle avec une mauvaise connexion ?',
    answer:
      'Oui. Les operations terrain peuvent etre mises en attente localement puis rejouees a la reconnexion avec une logique idempotente.',
  },
  {
    question: 'Peut-on migrer depuis Excel et WhatsApp ?',
    answer:
      'Oui. Le produit est pense pour reprendre les fichiers existants, structurer les donnees, puis installer des workflows plus fiables.',
  },
  {
    question: 'Pourquoi le pricing parle de stockage et d infrastructure ?',
    answer:
      'Parce que Samay Keur n est plus une simple app de gestion : la plateforme porte documents, paiements, equipe, verification, reporting et historique.',
  },
];

function whatsappHref(message: string) {
  return `https://wa.me/${CONTACT_WHATSAPP}?text=${encodeURIComponent(message)}`;
}

function Reveal({ children, className = '', delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.18 }}
      transition={{ duration: 0.62, ease, delay }}
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
  variant?: 'primary' | 'secondary' | 'ghost';
  onClick?: () => void;
  href?: string;
}) {
  const className = {
    primary:
      'bg-gradient-to-r from-emerald-300 to-amber-100 text-emerald-950 shadow-[0_22px_54px_rgba(52,211,153,0.24)] hover:from-emerald-200 hover:to-white',
    secondary:
      'border border-white/18 bg-white/[0.09] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] hover:bg-white/[0.14]',
    ghost: 'border border-emerald-900/10 bg-white text-slate-950 shadow-sm hover:bg-emerald-50',
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
        className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-black ${className}`}
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
      className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-black ${className}`}
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
      <p className={`text-xs font-black uppercase tracking-[0.18em] ${dark ? 'text-amber-200' : 'text-emerald-800'}`}>{eyebrow}</p>
      <h2 className={`mt-4 text-3xl font-black leading-[1.05] tracking-tight sm:text-5xl ${dark ? 'text-white' : 'text-slate-950'}`}>
        {title}
      </h2>
      {text && <p className={`mt-5 text-base leading-8 sm:text-lg ${dark ? 'text-emerald-50/68' : 'text-slate-600'}`}>{text}</p>}
    </Reveal>
  );
}

function TrustRail() {
  return (
    <div className="mx-auto grid max-w-5xl grid-cols-1 gap-2 sm:grid-cols-5">
      {trustSignals.map((signal) => (
        <div key={signal} className="rounded-2xl border border-white/10 bg-white/[0.075] px-4 py-3 text-center text-xs font-black uppercase tracking-[0.12em] text-emerald-50/76 backdrop-blur">
          {signal}
        </div>
      ))}
    </div>
  );
}

function ProductConsolePreview() {
  const shouldReduceMotion = useReducedMotion();

  return (
    <Reveal className="relative">
      <motion.div
        aria-hidden
        className="absolute -inset-8 rounded-[2.5rem] bg-[radial-gradient(circle_at_20%_0%,rgba(52,211,153,0.22),transparent_32%),radial-gradient(circle_at_82%_82%,rgba(245,158,11,0.16),transparent_34%)] blur-2xl"
        animate={shouldReduceMotion ? undefined : { opacity: [0.58, 0.9, 0.58], scale: [0.98, 1.02, 0.98] }}
        transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
      />
      <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[#07120f]/95 shadow-[0_34px_130px_rgba(0,0,0,0.36)] backdrop-blur">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-4">
          <div className="flex items-center gap-3">
            <BrandMark size="sm" tone="dark" animated={false} />
            <div>
              <p className="text-sm font-black text-white">Samay Keur Control</p>
              <p className="text-xs text-emerald-50/45">Portefeuille Dakar Plateau</p>
            </div>
          </div>
          <span className="rounded-full bg-emerald-300/12 px-3 py-1 text-xs font-black text-emerald-200">live</span>
        </div>

        <div className="grid gap-3 p-4 sm:grid-cols-4">
          {[
            ['Encaissements', '8,4M', 'text-emerald-200'],
            ['Recouvrement', '94%', 'text-sky-200'],
            ['Documents', '126', 'text-amber-100'],
            ['Drift ledger', '0', 'text-white'],
          ].map(([label, value, color]) => (
            <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.045] p-4">
              <p className="text-xs font-bold text-emerald-50/45">{label}</p>
              <p className={`mt-2 text-2xl font-black ${color}`}>{value}</p>
            </div>
          ))}
        </div>

        <div className="grid gap-4 px-4 pb-4 lg:grid-cols-[1.08fr_0.92fr]">
          <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-4">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-sm font-black text-white">Workflow d encaissement</p>
                <p className="text-xs text-emerald-50/45">Paiement, reliquat, quittance, rapport</p>
              </div>
              <CreditCard className="h-4 w-4 text-emerald-200" />
            </div>
            <div className="space-y-3">
              {productMoments.map(([label, place, value], index) => (
                <motion.div
                  key={label}
                  initial={{ opacity: 0, x: 18 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.45, ease, delay: index * 0.06 }}
                  className="grid grid-cols-[1fr_auto] gap-3 rounded-2xl border border-white/10 bg-slate-950/35 p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-white">{label}</p>
                    <p className="mt-1 truncate text-xs text-emerald-50/42">{place}</p>
                  </div>
                  <p className="text-sm font-black text-emerald-100">{value}</p>
                </motion.div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-4">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-sm font-black text-white">GED securisee</p>
                <p className="text-xs text-emerald-50/45">Documents reutilises, pas dupliques</p>
              </div>
              <Database className="h-4 w-4 text-amber-100" />
            </div>
            <div className="space-y-3">
              {[
                ['Contrat LOC-2026-04', 'version 2', 'hash OK'],
                ['Quittance mai 2026', 'archivee', 'QR OK'],
                ['Rapport bailleur', 'regenere', 'donnees changees'],
              ].map(([title, status, proof]) => (
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
        <div className="overflow-hidden rounded-[1.55rem] bg-[#f8faf5]">
          <div className="bg-[#09211a] px-4 pb-7 pt-5 text-white">
            <div className="flex items-center justify-between">
              <BrandMark size="sm" tone="dark" animated={false} />
              <span className="rounded-full bg-emerald-300/14 px-2.5 py-1 text-xs font-black text-emerald-200">sync</span>
            </div>
            <p className="mt-6 text-xs font-bold text-emerald-200">Solde a reverser</p>
            <p className="mt-1 text-3xl font-black">1,08M</p>
            <p className="mt-2 text-sm text-slate-300">Bailleurs notifies automatiquement</p>
          </div>
          <div className="-mt-4 space-y-3 px-4 pb-5">
            <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
              <p className="text-xs font-bold text-slate-500">Recouvrement du mois</p>
              <div className="mt-3 h-2 rounded-full bg-slate-100">
                <div className="h-2 w-[86%] rounded-full bg-emerald-500" />
              </div>
            </div>
            {[
              ['Loyer recu', 'Villa Almadies', '+420k'],
              ['Relance', 'Studio Point E', 'J+5'],
              ['Quittance', 'Appartement C12', 'PDF'],
            ].map(([label, place, value]) => (
              <div key={place} className="rounded-2xl border border-slate-200 bg-white p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-black text-slate-950">{label}</p>
                    <p className="mt-1 text-xs text-slate-500">{place}</p>
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

function BrandAssetPanel() {
  return (
    <Reveal className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
      <div className="overflow-hidden rounded-[2rem] border border-emerald-950/10 bg-white shadow-[0_30px_90px_rgba(15,23,42,0.10)]">
        <img src="/brand/presentation-premium.png" alt="Presentation premium Samay Keur" className="h-full min-h-[20rem] w-full object-cover" loading="lazy" />
      </div>
      <div className="space-y-4">
        {infrastructure.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="rounded-2xl border border-emerald-950/10 bg-white/88 p-5 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-black text-slate-950">{item.label}</p>
                  <p className="mt-1 text-sm font-semibold text-slate-500">{item.value}</p>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-800">
                  <Icon className="h-5 w-5" />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Reveal>
  );
}

export function LandingPage({ onNavigate }: LandingPageProps) {
  const [openFaq, setOpenFaq] = useState(0);
  const shouldReduceMotion = useReducedMotion();
  const year = useMemo(() => new Date().getFullYear(), []);

  const goSignup = () => onNavigate?.('auth');
  const goPricing = () => onNavigate?.('pricing');
  const goDemo = () => {
    window.location.href = whatsappHref('Bonjour, je souhaite une demo de Samay Keur pour mon agence.');
  };

  return (
    <div className="min-h-screen overflow-hidden bg-[#f5f1e7] text-slate-950">
      <motion.header
        initial={{ y: -18, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.55, ease }}
        className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-[#06110d]/90 text-white shadow-[0_12px_36px_rgba(6,17,13,0.22)] backdrop-blur-xl"
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="flex items-center gap-3">
            <BrandMark size="sm" tone="dark" animated={false} />
            <span className="text-base font-black tracking-[0.18em]">SAMAY KEUR</span>
          </button>
          <nav className="hidden items-center gap-7 text-sm font-bold text-slate-200 md:flex">
            <a href="#vision" className="hover:text-white">Vision</a>
            <a href="#workflows" className="hover:text-white">Workflows</a>
            <a href="#documents" className="hover:text-white">Documents</a>
            <a href="#pricing" className="hover:text-white">Pricing</a>
            <a href="#faq" className="hover:text-white">FAQ</a>
          </nav>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => onNavigate?.('auth')} className="hidden rounded-xl px-4 py-2 text-sm font-black text-slate-100 hover:bg-white/10 sm:block">
              Connexion
            </button>
            <button type="button" onClick={goSignup} className="rounded-xl bg-white px-4 py-2 text-sm font-black text-slate-950 hover:bg-emerald-50">
              Essai gratuit
            </button>
          </div>
        </div>
      </motion.header>

      <main>
        <section className="relative flex min-h-[92svh] items-end overflow-hidden bg-[#06110d] text-white">
          <img
            src="/brand/brand-board.png"
            alt=""
            aria-hidden="true"
            className="absolute inset-0 h-full w-full object-cover opacity-34"
          />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_20%,rgba(52,211,153,0.20),transparent_30%),radial-gradient(circle_at_86%_18%,rgba(245,158,11,0.18),transparent_28%),linear-gradient(90deg,rgba(6,17,13,0.96)_0%,rgba(6,17,13,0.78)_48%,rgba(6,17,13,0.72)_100%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.034)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.028)_1px,transparent_1px)] bg-[size:64px_64px]" />
          <motion.div
            aria-hidden
            className="absolute left-1/2 top-28 h-px w-[74vw] -translate-x-1/2 bg-gradient-to-r from-transparent via-amber-100/45 to-transparent"
            animate={shouldReduceMotion ? undefined : { opacity: [0.25, 0.72, 0.25], scaleX: [0.88, 1.02, 0.88] }}
            transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
          />

          <div className="relative mx-auto w-full max-w-7xl px-4 pb-10 pt-28 sm:px-6 sm:pb-14 lg:px-8">
            <motion.div variants={stagger} initial="hidden" animate="visible" className="max-w-5xl">
              <motion.div variants={fadeUp} transition={{ duration: 0.56, ease }} className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/14 bg-white/[0.08] px-3 py-2 text-sm font-black text-emerald-50 backdrop-blur">
                <Sparkles className="h-4 w-4 text-amber-100" />
                Infrastructure de confiance immobiliere africaine
              </motion.div>
              <motion.h1 variants={fadeUp} transition={{ duration: 0.62, ease }} className="max-w-5xl text-[2.75rem] font-black leading-[0.96] tracking-tight text-white sm:text-6xl lg:text-7xl">
                La gestion locative ne doit plus ressembler a du bricolage.
                <span className="block bg-gradient-to-r from-emerald-200 via-white to-amber-100 bg-clip-text text-transparent">
                  Elle doit inspirer confiance.
                </span>
              </motion.h1>
              <motion.p variants={fadeUp} transition={{ duration: 0.6, ease }} className="mt-6 max-w-2xl text-base font-semibold leading-8 text-emerald-50/76 sm:text-lg">
                Samay Keur rassemble paiements, reliquats, documents, GED, rapports, equipes et verification QR dans une plateforme calme, securisee et pensee pour les agences immobilieres modernes.
              </motion.p>
              <motion.div variants={fadeUp} transition={{ duration: 0.6, ease }} className="mt-8 flex flex-col gap-3 sm:flex-row">
                <PremiumButton onClick={goSignup}>Demarrer proprement</PremiumButton>
                <PremiumButton variant="secondary" onClick={goPricing}>Voir les plans</PremiumButton>
                <PremiumButton variant="secondary" href={whatsappHref('Bonjour, je souhaite parler a l equipe Samay Keur.')}>
                  WhatsApp
                </PremiumButton>
              </motion.div>
            </motion.div>

            <motion.div variants={fadeUp} initial="hidden" animate="visible" transition={{ duration: 0.7, ease, delay: 0.18 }} className="mt-10">
              <TrustRail />
            </motion.div>
          </div>
        </section>

        <section id="vision" className="border-y border-emerald-900/10 bg-[#f5f1e7] px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <SectionHeader
              eyebrow="Transformation"
              title="Du chaos operationnel vers une infrastructure immobiliere maitrisée."
              text="La vitrine ne vend pas un tableau de bord de plus. Elle raconte le passage d'une gestion fragile vers une organisation fiable, traçable et rassurante."
            />
            <motion.div variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.2 }} className="mt-12 grid gap-4 lg:grid-cols-4">
              {transformation.map((item) => {
                const Icon = item.icon;
                return (
                  <motion.div key={item.before} variants={fadeUp} whileHover={{ y: -4 }} transition={spring} className="rounded-[1.6rem] border border-emerald-950/10 bg-white/86 p-5 shadow-sm">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-800">
                      <Icon className="h-5 w-5" />
                    </div>
                    <p className="mt-5 text-sm font-semibold leading-6 text-slate-500">{item.before}</p>
                    <div className="my-4 h-px bg-gradient-to-r from-emerald-900/5 via-emerald-900/20 to-transparent" />
                    <p className="text-base font-black leading-6 text-slate-950">{item.after}</p>
                  </motion.div>
                );
              })}
            </motion.div>
          </div>
        </section>

        <section id="workflows" className="bg-[#07120f] px-4 py-20 text-white sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.82fr_1.18fr] lg:items-center">
            <div>
              <SectionHeader
                align="left"
                tone="dark"
                eyebrow="Workflows métier"
                title="Un produit vivant, pas une collection de cartes KPI."
                text="Les operations sont reliees : bailleur, immeuble, unite, locataire, contrat, paiement, document et rapport forment un vrai circuit de confiance."
              />
              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                {workflows.map((workflow) => {
                  const Icon = workflow.icon;
                  return (
                    <Reveal key={workflow.title} className="rounded-2xl border border-white/10 bg-white/[0.045] p-5">
                      <Icon className="h-5 w-5 text-amber-100" />
                      <p className="mt-4 text-base font-black text-white">{workflow.title}</p>
                      <p className="mt-2 text-sm leading-6 text-emerald-50/58">{workflow.text}</p>
                      <p className="mt-4 text-xs font-black uppercase tracking-[0.14em] text-emerald-200">{workflow.detail}</p>
                    </Reveal>
                  );
                })}
              </div>
            </div>
            <ProductConsolePreview />
          </div>
        </section>

        <section id="documents" className="bg-white px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <SectionHeader
              eyebrow="Documents et GED"
              title="Les documents ne sont plus des fichiers jetables. Ils deviennent une preuve."
              text="Contrats, mandats, quittances, factures, rapports et justificatifs sont archives, lies aux entites, signes par le contexte et retrouvables sans dupliquer le stockage."
            />
            <div className="mt-12">
              <BrandAssetPanel />
            </div>
          </div>
        </section>

        <section className="bg-[#f5f1e7] px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[1fr_0.8fr] lg:items-center">
            <div>
              <SectionHeader
                align="left"
                eyebrow="Mobile-first terrain"
                title="Pensé pour l'agence qui encaisse, relance et rassure depuis le téléphone."
                text="La plupart des operations reelles commencent sur mobile : verification d'un paiement, envoi d'une quittance, relance d'un retard ou consultation d'un bailleur."
              />
              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                {[
                  [Smartphone, 'Experience native-like', 'Actions rapides, surfaces calmes et navigation terrain.'],
                  [Wifi, 'Connexion instable', 'Queue offline et synchronisation a la reconnexion.'],
                  [ReceiptText, 'Documents mobiles', 'Ouverture, partage, impression et verification QR.'],
                  [Fingerprint, 'Controle d acces', 'Actions visibles selon role et permission.'],
                ].map(([Icon, title, text]) => {
                  const FeatureIcon = Icon as typeof Smartphone;
                  return (
                    <Reveal key={title as string} className="rounded-2xl border border-emerald-950/10 bg-white/88 p-5 shadow-sm">
                      <FeatureIcon className="h-5 w-5 text-emerald-800" />
                      <p className="mt-4 font-black text-slate-950">{title as string}</p>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{text as string}</p>
                    </Reveal>
                  );
                })}
              </div>
            </div>
            <PhonePreview />
          </div>
        </section>

        <section className="bg-[#07120f] px-4 py-20 text-white sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <SectionHeader
              tone="dark"
              eyebrow="Confiance operationnelle"
              title="La perception premium vient de la stabilité, pas du spectacle."
              text="Chaque signal doit rassurer : donnees separees, documents prives, historique, audit trail, verification QR, stockage maitrise et paiements locaux."
            />
            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {infrastructure.map((item) => {
                const Icon = item.icon;
                return (
                  <Reveal key={item.label} className="rounded-[1.6rem] border border-white/10 bg-white/[0.045] p-6">
                    <Icon className="h-6 w-6 text-amber-100" />
                    <p className="mt-5 text-3xl font-black text-white">{item.value}</p>
                    <p className="mt-2 text-sm font-semibold leading-6 text-emerald-50/55">{item.label}</p>
                  </Reveal>
                );
              })}
            </div>
          </div>
        </section>

        <section id="pricing" className="bg-[#f5f1e7] px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <SectionHeader
              eyebrow="Pricing infrastructure"
              title="Des plans qui vendent la valeur métier, pas une liste de petites fonctionnalités."
              text="Le pricing prolonge le storytelling : stockage, collaboration, documents, sécurité, reporting et support deviennent des capacités d'infrastructure."
            />
            <div className="mt-12 grid gap-4 lg:grid-cols-4">
              {plans.map((plan) => (
                <Reveal
                  key={plan.name}
                  className={`relative rounded-[1.75rem] border p-6 transition duration-300 hover:-translate-y-1 ${
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
                  <p className={`text-xs font-black uppercase tracking-[0.14em] ${plan.highlighted ? 'text-emerald-200' : 'text-emerald-800'}`}>
                    {plan.audience}
                  </p>
                  <p className="mt-2 text-2xl font-black">{plan.name}</p>
                  <p className={`mt-3 min-h-[4.5rem] text-sm leading-6 ${plan.highlighted ? 'text-emerald-50/65' : 'text-slate-600'}`}>
                    {plan.promise}
                  </p>
                  <div className="mt-6">
                    <span className="text-4xl font-black">{plan.price}</span>
                    {plan.unit && <span className={`ml-2 text-sm font-bold ${plan.highlighted ? 'text-emerald-50/58' : 'text-slate-500'}`}>{plan.unit}</span>}
                  </div>
                  <div className={`mt-4 rounded-2xl border px-3 py-2 text-sm font-black ${plan.highlighted ? 'border-white/10 bg-white/[0.07] text-amber-100' : 'border-emerald-950/10 bg-emerald-50 text-emerald-900'}`}>
                    Stockage : {plan.storage}
                  </div>
                  <button
                    type="button"
                    onClick={plan.name === 'Enterprise' ? goDemo : goSignup}
                    className={`mt-6 w-full rounded-xl px-4 py-3 text-sm font-black transition ${
                      plan.highlighted ? 'bg-emerald-300 text-emerald-950 hover:bg-emerald-200' : 'bg-slate-950 text-white hover:bg-emerald-950'
                    }`}
                  >
                    {plan.name === 'Enterprise' ? 'Parler a l equipe' : 'Commencer'}
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
          </div>
        </section>

        <section id="faq" className="bg-white px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.78fr_1.22fr]">
            <SectionHeader
              align="left"
              eyebrow="Réassurance"
              title="Les questions qu'une agence sérieuse pose avant de confier ses flux."
              text="Sécurité, stockage, mobile money, migration, offline et documents vérifiables : la vitrine doit rassurer avant même la démo."
            />
            <div className="space-y-3">
              {faqs.map((faq, index) => (
                <Reveal key={faq.question}>
                  <button
                    type="button"
                    onClick={() => setOpenFaq(openFaq === index ? -1 : index)}
                    className="w-full rounded-2xl border border-emerald-950/10 bg-[#fbfaf6] p-5 text-left shadow-sm"
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
          <Reveal className="mx-auto max-w-7xl overflow-hidden rounded-[2rem] bg-[#07120f] px-6 py-14 text-center text-white shadow-[0_35px_120px_rgba(6,17,13,0.24)] sm:px-10">
            <img src="/brand/logo-lockup-dark.png" alt="Samay Keur" className="mx-auto h-16 w-auto object-contain" loading="lazy" />
            <h2 className="mx-auto mt-7 max-w-3xl text-3xl font-black leading-tight tracking-tight sm:text-5xl">
              Installez une gestion locative qui parait aussi sérieuse que l'argent qu'elle suit.
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-emerald-50/68">
              Vos loyers, vos documents, vos équipes et vos bailleurs méritent une plateforme qui donne confiance dès le premier écran.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <PremiumButton onClick={goSignup}>Commencer gratuitement</PremiumButton>
              <PremiumButton variant="secondary" onClick={goDemo}>Parler a l equipe</PremiumButton>
            </div>
          </Reveal>
        </section>
      </main>

      <footer className="border-t border-white/10 bg-[#06110d] px-4 py-12 text-white sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1.1fr_0.9fr_0.8fr]">
          <div>
            <BrandLogo size="sm" tone="dark" showTagline />
            <p className="mt-5 max-w-md text-sm leading-7 text-emerald-50/58">
              Infrastructure immobilière pour agences, bailleurs et équipes qui veulent suivre leurs opérations avec sérieux, clarté et traçabilité.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {['Dakar', 'Abidjan', 'Mobile Money', 'Proptech africaine'].map((tag) => (
                <span key={tag} className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-xs font-black text-emerald-50/70">
                  {tag}
                </span>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 text-sm">
            <div className="space-y-3">
              <p className="font-black text-white">Produit</p>
              <a href="#vision" className="block text-emerald-50/58 hover:text-white">Vision</a>
              <a href="#workflows" className="block text-emerald-50/58 hover:text-white">Workflows</a>
              <a href="#documents" className="block text-emerald-50/58 hover:text-white">Documents</a>
              <a href="#pricing" className="block text-emerald-50/58 hover:text-white">Pricing</a>
            </div>
            <div className="space-y-3">
              <p className="font-black text-white">Confiance</p>
              <span className="block text-emerald-50/58">RLS multi-tenant</span>
              <span className="block text-emerald-50/58">QR verification</span>
              <span className="block text-emerald-50/58">Offline-first</span>
              <span className="block text-emerald-50/58">GED privee</span>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-5">
            <p className="text-sm font-black text-white">Contact</p>
            <p className="mt-3 text-sm leading-6 text-emerald-50/58">Parlez a l equipe pour une demo, une migration ou un plan agence.</p>
            <a
              href={whatsappHref('Bonjour Samay Keur, je souhaite echanger sur la plateforme.')}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-flex rounded-xl bg-emerald-300 px-4 py-3 text-sm font-black text-emerald-950 hover:bg-emerald-200"
            >
              Contacter sur WhatsApp
            </a>
          </div>
        </div>

        <div className="mx-auto mt-10 flex max-w-7xl flex-col gap-3 border-t border-white/10 pt-6 text-xs font-semibold text-emerald-50/45 sm:flex-row sm:items-center sm:justify-between">
          <p>© {year} Samay Keur. Tous droits réservés.</p>
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
