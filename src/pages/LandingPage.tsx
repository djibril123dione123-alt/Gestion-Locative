import { useMemo, useState, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  ArrowRight,
  BarChart3,
  Bell,
  Check,
  ChevronDown,
  CreditCard,
  FileText,
  Globe2,
  Landmark,
  LayoutDashboard,
  Lock,
  ReceiptText,
  ShieldCheck,
  Smartphone,
  Sparkles,
  TrendingDown,
  Users,
  WalletCards,
  WifiOff,
  Zap,
} from 'lucide-react';
import { BrandLogo, BrandMark } from '../components/brand/BrandLogo';

interface LandingPageProps {
  onNavigate?: (page: string) => void;
}

const CONTACT_WHATSAPP = '221769010960';

const ease: [number, number, number, number] = [0.22, 1, 0.36, 1];
const spring = { type: 'spring', stiffness: 130, damping: 20, mass: 0.72 } as const;

const fadeUp = {
  hidden: { opacity: 0.82, y: 18 },
  visible: { opacity: 1, y: 0 },
};

const heroFade = {
  hidden: { opacity: 0.84, y: 14 },
  visible: { opacity: 1, y: 0 },
};

const stagger = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.07,
      delayChildren: 0.05,
    },
  },
};

const trustLogos = ['Teranga Homes', 'Keur Invest', 'Dakar Gestion', 'Abidjan Locatif', 'Afrique Patrimoine'];

const problems = [
  {
    title: 'Paiements dispersés',
    text: 'Les virements, mobile money, reçus et captures WhatsApp vivent dans des endroits différents.',
    metric: '42%',
    caption: 'des retards mal suivis',
    icon: WalletCards,
  },
  {
    title: 'Impayés invisibles',
    text: 'Une agence découvre trop tard les retards, puis relance dans l’urgence sans preuve fiable.',
    metric: '+9j',
    caption: 'avant relance moyenne',
    icon: TrendingDown,
  },
  {
    title: 'Reporting fragile',
    text: 'Le bailleur attend des chiffres clairs, mais reçoit des fichiers manuels impossibles à auditer.',
    metric: '3h',
    caption: 'perdues chaque semaine',
    icon: FileText,
  },
];

const features = [
  { title: 'Suivi des loyers', text: 'Statuts clairs par unité, locataire, mois et bailleur.', icon: Landmark },
  { title: 'Historique paiements', text: 'Chaque encaissement garde son origine, sa preuve et son état.', icon: ReceiptText },
  { title: 'Gestion des impayés', text: 'Retards détectés, priorisés et reliés aux relances.', icon: Bell },
  { title: 'Quittances', text: 'Documents PDF propres, numérotés et prêts à envoyer.', icon: FileText },
  { title: 'Multi-utilisateurs', text: 'Rôles, accès et actions d’équipe par agence.', icon: Users },
  { title: 'Dashboard intelligent', text: 'Revenus, recouvrement, commissions et risques visibles.', icon: LayoutDashboard },
  { title: 'Encaissements mobiles', text: 'Wave, Orange Money, Djamo, PayDunya et cartes.', icon: CreditCard },
  { title: 'Offline-first', text: 'Le terrain continue même quand la connexion devient instable.', icon: WifiOff },
];

const businessBenefits = [
  ['94%', 'taux de recouvrement suivi'],
  ['-3h', 'sur les rapports hebdo'],
  ['126', 'quittances générées'],
  ['840k', 'commissions contrôlées'],
];

const plans = [
  {
    name: 'Starter',
    price: '5 000',
    unit: 'FCFA/mois',
    description: 'Pour bailleurs individuels et petits portefeuilles.',
    features: ['Essai gratuit', '10 unités', 'Quittances PDF', 'Import assisté'],
    highlighted: false,
  },
  {
    name: 'Pro',
    price: '15 000',
    unit: 'FCFA/mois',
    description: 'Pour agences qui veulent vendre une gestion plus professionnelle.',
    features: ['Essai gratuit', '100 unités', 'Support WhatsApp', 'Onboarding inclus', 'Alertes impayés'],
    highlighted: true,
  },
  {
    name: 'Business',
    price: '35 000',
    unit: 'FCFA/mois',
    description: 'Pour agences structurées avec plusieurs agents et bailleurs.',
    features: ['500 unités', 'Multi-utilisateurs', 'Rapports bailleurs', 'Accompagnement'],
    highlighted: false,
  },
  {
    name: 'Enterprise',
    price: 'Sur devis',
    unit: '',
    description: 'Pour groupes immobiliers, promoteurs et réseaux multi-pays.',
    features: ['SLA', 'Migration dédiée', 'Support prioritaire', 'Plan sur mesure'],
    highlighted: false,
  },
];

const testimonials = [
  {
    quote:
      'Le produit donne enfin une lecture propre des paiements, des retards et des rapports bailleurs. Cela change la conversation avec les clients.',
    name: 'Aminata Diop',
    role: 'Directrice, agence à Dakar',
  },
  {
    quote:
      'Nous avons remplacé les fichiers dispersés par un tableau de bord unique. L’équipe sait quoi relancer et le bailleur reçoit des chiffres nets.',
    name: 'Moussa Koné',
    role: 'Administrateur de biens, Abidjan',
  },
  {
    quote:
      'Le suivi est plus sérieux, plus calme. Je peux comprendre mes loyers sans demander un message WhatsApp chaque semaine.',
    name: 'Fatou Ndiaye',
    role: 'Bailleure indépendante',
  },
];

const faqs = [
  {
    question: 'Samay Këur convient-il aux petites agences ?',
    answer:
      'Oui. Une agence peut commencer avec peu de biens, puis évoluer vers une gestion multi-utilisateurs, multi-bailleurs et multi-portefeuilles.',
  },
  {
    question: 'Les paiements mobile money sont-ils intégrés ?',
    answer:
      'La landing présente les parcours Wave, Orange Money, Djamo et PayDunya. Les flux sensibles restent traités côté serveur pour garder une logique fiable.',
  },
  {
    question: 'Peut-on importer des données existantes ?',
    answer:
      'Oui. Les plans mettent en avant l’import assisté, l’onboarding et l’accompagnement pour migrer depuis Excel, cahiers ou fichiers existants.',
  },
  {
    question: 'Les bailleurs reçoivent-ils des documents propres ?',
    answer:
      'Oui. Le produit met l’accent sur les quittances, rapports, preuves de paiement et exports nécessaires pour inspirer confiance.',
  },
  {
    question: 'Comment demander une démo ?',
    answer:
      'Le visiteur peut demander une démo directement depuis la landing ou passer par WhatsApp pour parler à l’équipe Samay Këur.',
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
      'bg-emerald-400 text-emerald-950 shadow-[0_18px_46px_rgba(52,211,153,0.28)] hover:bg-emerald-300',
    secondary:
      'border border-white/25 bg-white/[0.12] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] hover:bg-white/[0.18]',
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
        className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-lg px-5 py-3 text-sm font-black ${className}`}
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
      className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-lg px-5 py-3 text-sm font-black ${className}`}
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
  const isDark = tone === 'dark';

  return (
    <Reveal className={align === 'center' ? 'mx-auto max-w-3xl text-center' : 'max-w-2xl'}>
      <p className={`text-xs font-black uppercase ${isDark ? 'text-emerald-300' : 'text-emerald-700'}`}>{eyebrow}</p>
      <h2 className={`mt-4 text-3xl font-black leading-tight sm:text-5xl ${isDark ? 'text-white' : 'text-slate-950'}`}>
        {title}
      </h2>
      {text && <p className={`mt-5 text-base leading-8 sm:text-lg ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{text}</p>}
    </Reveal>
  );
}

function MetricTile({ label, value, tone }: { label: string; value: string; tone: 'emerald' | 'amber' | 'blue' }) {
  const toneClass = {
    emerald: 'text-emerald-300 bg-emerald-300/10 border-emerald-300/15',
    amber: 'text-amber-200 bg-amber-300/10 border-amber-300/15',
    blue: 'text-sky-200 bg-sky-300/10 border-sky-300/15',
  }[tone];

  return (
    <motion.div
      variants={fadeUp}
      whileHover={{ y: -3 }}
      transition={spring}
      className={`rounded-lg border p-4 ${toneClass}`}
    >
      <p className="text-xs font-bold opacity-80">{label}</p>
      <p className="mt-2 text-2xl font-black text-white">{value}</p>
    </motion.div>
  );
}

function DashboardMockup() {
  const shouldReduceMotion = useReducedMotion();
  const bars = [46, 72, 58, 86, 64, 92, 78, 96, 69, 84];
  const payments = [
    ['Wave', '+250 000 FCFA', 'Quittance générée', 'text-sky-200'],
    ['Orange Money', '+180 000 FCFA', 'Bailleur notifié', 'text-emerald-200'],
    ['PayDunya', '+75 000 FCFA', 'Commission calculée', 'text-violet-200'],
    ['Retard détecté', 'J+7', 'Relance prête', 'text-amber-200'],
  ];

  return (
    <motion.div
      initial={{ opacity: 0.9, y: 20, rotateX: 6 }}
      animate={{ opacity: 1, y: 0, rotateX: 0 }}
      transition={{ duration: 0.9, ease }}
      className="relative mx-auto w-full max-w-3xl"
    >
      <motion.div
        aria-hidden
        className="absolute -inset-8 rounded-lg bg-[radial-gradient(circle_at_30%_20%,rgba(52,211,153,0.22),transparent_34%),radial-gradient(circle_at_80%_65%,rgba(245,158,11,0.14),transparent_30%)] blur-2xl"
        animate={shouldReduceMotion ? undefined : { opacity: [0.65, 0.95, 0.65], scale: [0.98, 1.02, 0.98] }}
        transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
      />

      <motion.div
        className="absolute -left-2 top-10 z-20 hidden rounded-lg border border-emerald-200/60 bg-white/[0.94] px-3 py-2 shadow-2xl backdrop-blur sm:flex"
        animate={shouldReduceMotion ? undefined : { y: [0, -8, 0], x: [0, 3, 0] }}
        transition={{ duration: 5.5, repeat: Infinity, ease: 'easeInOut' }}
      >
        <div className="mr-3 flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
          <Check className="h-4 w-4" />
        </div>
        <div>
          <p className="text-sm font-black text-slate-950">Paiement reçu</p>
          <p className="text-xs font-semibold text-slate-500">250 000 FCFA</p>
        </div>
      </motion.div>

      <motion.div
        className="absolute -right-2 top-44 z-20 hidden rounded-lg border border-amber-200/70 bg-white/[0.94] px-3 py-2 shadow-2xl backdrop-blur md:flex"
        animate={shouldReduceMotion ? undefined : { y: [0, 9, 0], x: [0, -3, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut', delay: 0.3 }}
      >
        <div className="mr-3 flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
          <Bell className="h-4 w-4" />
        </div>
        <div>
          <p className="text-sm font-black text-slate-950">Bailleur notifié</p>
          <p className="text-xs font-semibold text-slate-500">Rapport mensuel prêt</p>
        </div>
      </motion.div>

      <div className="relative overflow-hidden rounded-lg border border-white/10 bg-[rgba(7,18,15,0.92)] shadow-[0_35px_130px_rgba(0,0,0,0.35)] backdrop-blur">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <div className="flex items-center gap-3">
            <BrandMark size="sm" tone="dark" animated={false} />
            <div>
              <p className="text-sm font-black text-white">Samay Këur OS</p>
              <p className="text-xs text-slate-400">Portefeuille Dakar Plateau</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-emerald-400/12 px-2 py-1 text-xs font-black text-emerald-300">live</span>
            <span className="rounded-md bg-white/[0.08] px-2 py-1 text-xs font-bold text-slate-300">Mai 2026</span>
          </div>
        </div>

        <div className="grid gap-3 p-3 sm:grid-cols-3">
          <MetricTile label="Revenus encaissés" value="8,4M" tone="emerald" />
          <MetricTile label="Recouvrement" value="94%" tone="blue" />
          <MetricTile label="Risque impayé" value="-12%" tone="amber" />
        </div>

        <div className="grid gap-3 px-3 pb-3 lg:grid-cols-[1.25fr_0.75fr]">
          <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-sm font-black text-white">Encaissements intelligents</p>
                <p className="text-xs text-slate-400">Wave, Orange Money, PayDunya</p>
              </div>
              <BarChart3 className="h-4 w-4 text-emerald-300" />
            </div>
            <div className="flex h-40 items-end gap-2">
              {bars.map((height, index) => (
                <div key={index} className="flex h-full flex-1 items-end rounded-md bg-white/[0.09] p-0.5">
                  <motion.div
                    className="w-full origin-bottom rounded-md bg-gradient-to-t from-emerald-600 via-emerald-300 to-white shadow-[0_0_20px_rgba(52,211,153,0.28)]"
                    style={{ height: `${height}%` }}
                    initial={{ scaleY: 0.18, opacity: 0.72 }}
                    animate={{ scaleY: 1, opacity: 1 }}
                    transition={{ duration: 0.9, ease, delay: index * 0.04 }}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm font-black text-white">Activité temps réel</p>
              <SignalIcon />
            </div>
            <div className="space-y-3">
              {payments.map(([name, value, note, color], index) => (
                <motion.div
                  key={name}
                  initial={{ opacity: 0, x: 16 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.46, ease, delay: 0.18 + index * 0.07 }}
                  className="rounded-lg border border-white/10 bg-slate-950/38 p-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate text-xs font-black text-white">{name}</p>
                    <p className={`text-xs font-black ${color}`}>{value}</p>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">{note}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 border-t border-white/10 p-3">
          {[
            ['Unités louées', '78/93', 'bg-emerald-300'],
            ['Quittances', '126', 'bg-sky-300'],
            ['Commissions', '840k', 'bg-amber-300'],
          ].map(([label, value, dot]) => (
            <div key={label} className="flex items-center justify-between rounded-lg bg-white/[0.05] px-3 py-2">
              <span className="flex min-w-0 items-center gap-2 text-xs font-semibold text-slate-400">
                <span className={`h-2 w-2 rounded-full ${dot}`} />
                <span className="truncate">{label}</span>
              </span>
              <span className="text-sm font-black text-white">{value}</span>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

function SignalIcon() {
  return (
    <div className="flex h-4 items-end gap-0.5">
      {[5, 8, 11, 14].map((height) => (
        <span key={height} className="w-0.5 rounded-full bg-emerald-300" style={{ height }} />
      ))}
    </div>
  );
}

function PhonePreview() {
  const rows = [
    ['Loyer reçu', 'Villa Almadies', '+420k'],
    ['Relance', 'Studio Point E', 'J+5'],
    ['Quittance', 'Appartement C12', 'PDF'],
  ];

  return (
    <Reveal className="relative mx-auto max-w-xs">
      <div className="absolute -inset-8 rounded-lg bg-emerald-300/18 blur-2xl" />
      <motion.div
        whileHover={{ y: -4 }}
        transition={spring}
        className="relative rounded-[28px] border border-slate-200 bg-slate-950 p-2 shadow-[0_34px_100px_rgba(15,23,42,0.28)]"
      >
        <div className="overflow-hidden rounded-[22px] bg-[#f8faf5]">
          <div className="bg-[#09211a] px-4 pb-7 pt-5 text-white">
            <div className="flex items-center justify-between">
              <BrandMark size="sm" tone="dark" animated={false} />
              <span className="rounded-md bg-emerald-300/14 px-2 py-1 text-xs font-black text-emerald-200">online</span>
            </div>
            <p className="mt-6 text-xs font-bold text-emerald-200">Solde à reverser</p>
            <p className="mt-1 text-3xl font-black">1,08M</p>
            <p className="mt-2 text-sm text-slate-300">Bailleurs notifiés automatiquement</p>
          </div>
          <div className="-mt-4 space-y-3 px-4 pb-5">
            <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
              <p className="text-xs font-bold text-slate-500">Recouvrement du mois</p>
              <div className="mt-3 h-2 rounded-full bg-slate-100">
                <div className="h-2 w-[86%] rounded-full bg-emerald-500" />
              </div>
            </div>
            {rows.map(([label, place, value]) => (
              <div key={place} className="rounded-lg border border-slate-200 bg-white p-3">
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

export function LandingPage({ onNavigate }: LandingPageProps) {
  const [openFaq, setOpenFaq] = useState(0);
  const shouldReduceMotion = useReducedMotion();
  const year = useMemo(() => new Date().getFullYear(), []);

  const goSignup = () => onNavigate?.('auth');
  const goDemo = () => {
    window.location.href = whatsappHref('Bonjour, je souhaite une démo de Samay Këur pour mon agence.');
  };

  return (
    <div className="min-h-screen overflow-hidden bg-[#f6f3ea] text-slate-950">
      <motion.header
        initial={{ y: -18, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.55, ease }}
        className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-[#06110d] text-white shadow-[0_12px_36px_rgba(6,17,13,0.22)]"
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="flex items-center gap-3">
            <BrandMark size="sm" tone="dark" animated={false} />
            <span className="text-base font-black tracking-[0.18em]">SAMAY KEUR</span>
          </button>
          <nav className="hidden items-center gap-7 text-sm font-bold text-slate-200 md:flex">
            <a href="#solution" className="hover:text-white">Solution</a>
            <a href="#dashboard" className="hover:text-white">Dashboard</a>
            <a href="#mobile" className="hover:text-white">Mobile</a>
            <a href="#tarifs" className="hover:text-white">Tarifs</a>
            <a href="#faq" className="hover:text-white">FAQ</a>
          </nav>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => onNavigate?.('auth')} className="hidden rounded-lg px-4 py-2 text-sm font-black text-slate-100 hover:bg-white/10 sm:block">
              Connexion
            </button>
            <button type="button" onClick={goSignup} className="rounded-lg bg-white px-4 py-2 text-sm font-black text-slate-950 hover:bg-emerald-50">
              Essai gratuit
            </button>
          </div>
        </div>
      </motion.header>

      <main>
        <section className="relative overflow-hidden bg-[#06110d] pt-20 text-white">
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:58px_58px]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_20%,rgba(52,211,153,0.18),transparent_30%),radial-gradient(circle_at_82%_18%,rgba(245,158,11,0.12),transparent_28%),linear-gradient(180deg,transparent_0%,#06110d_88%)]" />
          <motion.div
            aria-hidden
            className="absolute left-1/2 top-28 h-px w-[70vw] -translate-x-1/2 bg-gradient-to-r from-transparent via-emerald-200/50 to-transparent"
            animate={shouldReduceMotion ? undefined : { opacity: [0.25, 0.8, 0.25], scaleX: [0.9, 1.02, 0.9] }}
            transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
          />

          <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[0.85fr_1.15fr] lg:px-8 lg:py-24">
            <motion.div variants={stagger} initial="hidden" animate="visible">
              <motion.div variants={heroFade} transition={{ duration: 0.56, ease }} className="mb-6 inline-flex items-center gap-2 rounded-lg border border-emerald-200/14 bg-white/[0.06] px-3 py-2 text-sm font-black text-emerald-100 backdrop-blur">
                <Sparkles className="h-4 w-4 text-emerald-300" />
                SaaS immobilier premium pour agences africaines
              </motion.div>
              <motion.h1 variants={heroFade} transition={{ duration: 0.62, ease }} className="max-w-4xl text-5xl font-black leading-[0.96] text-white sm:text-6xl lg:text-7xl">
                Gérez vos loyers sans chaos.
                <span className="block bg-gradient-to-r from-emerald-200 via-white to-amber-100 bg-clip-text text-transparent">
                  Pilotez chaque franc avec clarté.
                </span>
              </motion.h1>
              <motion.p variants={heroFade} transition={{ duration: 0.6, ease }} className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
                Samay Këur centralise paiements, impayés, quittances, rapports bailleurs et mobile money dans une expérience simple, fiable et pensée pour les agences immobilières du Sénégal et d’Afrique francophone.
              </motion.p>
              <motion.div variants={heroFade} transition={{ duration: 0.6, ease }} className="mt-8 flex flex-col gap-3 sm:flex-row">
                <PremiumButton onClick={goSignup}>Essayer gratuitement</PremiumButton>
                <PremiumButton variant="secondary" onClick={goDemo}>Voir une démo</PremiumButton>
                <PremiumButton variant="secondary" href={whatsappHref('Bonjour, je souhaite parler à l’équipe Samay Këur.')}>
                  WhatsApp
                </PremiumButton>
              </motion.div>
              <motion.div variants={stagger} className="mt-8 grid grid-cols-3 gap-3 border-t border-white/10 pt-6">
                {businessBenefits.slice(0, 3).map(([value, label]) => (
                  <motion.div key={label} variants={heroFade}>
                    <p className="text-2xl font-black text-white">{value}</p>
                    <p className="mt-1 text-xs font-bold text-slate-400">{label}</p>
                  </motion.div>
                ))}
              </motion.div>
            </motion.div>
            <DashboardMockup />
          </div>
        </section>

        <section className="border-y border-emerald-900/10 bg-[#f6f3ea] px-4 py-8 sm:px-6 lg:px-8">
          <Reveal className="mx-auto max-w-7xl">
            <p className="text-center text-xs font-black uppercase text-slate-500">Pensé pour les agences qui veulent inspirer confiance</p>
            <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-5">
              {trustLogos.map((logo) => (
                <div key={logo} className="rounded-lg border border-emerald-900/10 bg-white/70 px-4 py-4 text-center text-sm font-black text-slate-700 shadow-sm">
                  {logo}
                </div>
              ))}
            </div>
          </Reveal>
        </section>

        <section className="bg-white px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <SectionHeader
              eyebrow="Le vrai problème"
              title="Les agences ne perdent pas seulement du temps. Elles perdent de la confiance."
              text="Quand le suivi des loyers repose sur Excel, WhatsApp et des cahiers, les erreurs financières deviennent invisibles jusqu’au moment où elles coûtent cher."
            />
            <motion.div variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.2 }} className="mt-12 grid gap-4 lg:grid-cols-3">
              {problems.map((problem) => {
                const Icon = problem.icon;
                return (
                  <motion.div key={problem.title} variants={fadeUp} whileHover={{ y: -5 }} transition={spring} className="rounded-lg border border-slate-200 bg-[#fbfaf6] p-6">
                    <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                      <Icon className="h-5 w-5" />
                    </div>
                    <p className="mt-6 text-xl font-black text-slate-950">{problem.title}</p>
                    <p className="mt-3 leading-7 text-slate-600">{problem.text}</p>
                    <div className="mt-6 border-t border-slate-200 pt-5">
                      <p className="text-3xl font-black text-slate-950">{problem.metric}</p>
                      <p className="mt-1 text-sm font-bold text-slate-500">{problem.caption}</p>
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          </div>
        </section>

        <section id="solution" className="bg-[#07120f] px-4 py-20 text-white sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.82fr_1.18fr] lg:items-center">
            <SectionHeader
              align="left"
              tone="dark"
              eyebrow="Solution"
              title="Une console unique pour encaisser, suivre, prouver et rassurer."
              text="Samay Këur transforme la gestion locative en workflow clair : paiement reçu, quittance générée, impayé détecté, bailleur informé, rapport prêt."
            />
            <motion.div variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.2 }} className="grid gap-3 sm:grid-cols-2">
              {features.map((feature) => {
                const Icon = feature.icon;
                return (
                  <motion.div key={feature.title} variants={fadeUp} whileHover={{ y: -4, backgroundColor: 'rgba(255,255,255,0.075)' }} transition={spring} className="rounded-lg border border-white/10 bg-white/[0.045] p-5">
                    <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-300/12 text-emerald-200">
                      <Icon className="h-5 w-5" />
                    </div>
                    <p className="text-base font-black text-white">{feature.title}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-400">{feature.text}</p>
                  </motion.div>
                );
              })}
            </motion.div>
          </div>
        </section>

        <section id="dashboard" className="bg-[#f6f3ea] px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <SectionHeader
              eyebrow="Dashboard preview"
              title="Un pilotage financier qui ressemble enfin à un vrai logiciel."
              text="KPIs, revenus, impayés, historique, mobile money et rapports apparaissent dans une interface lisible, calme et exploitable."
            />
            <div className="mt-12">
              <DashboardMockup />
            </div>
          </div>
        </section>

        <section id="mobile" className="bg-white px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[1fr_0.8fr] lg:items-center">
            <div>
              <SectionHeader
                align="left"
                eyebrow="Mobile-first"
                title="Sur le terrain, l’expérience doit rester simple."
                text="Un agent peut vérifier un paiement, repérer un retard, générer une quittance ou rassurer un bailleur depuis un écran compact, sans perdre le fil."
              />
              <motion.div variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.2 }} className="mt-8 grid gap-3 sm:grid-cols-2">
                {[
                  [Smartphone, 'Expérience app-like', 'Des actions lisibles, rapides et adaptées au mobile.'],
                  [Lock, 'Confiance financière', 'Chaque action sensible garde une logique structurée.'],
                  [Globe2, 'Marché local', 'Pensé pour mobile money, WhatsApp et agences africaines.'],
                  [ShieldCheck, 'Données maîtrisées', 'Rôles, accès et séparation par agence.'],
                ].map(([Icon, title, text]) => {
                  const FeatureIcon = Icon as typeof Smartphone;
                  return (
                    <motion.div key={title as string} variants={fadeUp} className="rounded-lg border border-slate-200 bg-[#fbfaf6] p-5">
                      <FeatureIcon className="h-5 w-5 text-emerald-700" />
                      <p className="mt-4 font-black text-slate-950">{title as string}</p>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{text as string}</p>
                    </motion.div>
                  );
                })}
              </motion.div>
            </div>
            <PhonePreview />
          </div>
        </section>

        <section className="bg-[#07120f] px-4 py-20 text-white sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <SectionHeader
              tone="dark"
              eyebrow="Avantages business"
              title="Moins de friction. Plus de recouvrement. Plus de crédibilité."
              text="Le produit donne à l’agence une image plus sérieuse et réduit les moments flous qui abîment la relation avec les bailleurs."
            />
            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {businessBenefits.map(([value, label]) => (
                <Reveal key={label} className="rounded-lg border border-white/10 bg-white/[0.045] p-6">
                  <p className="text-4xl font-black text-white">{value}</p>
                  <p className="mt-3 text-sm font-bold leading-6 text-slate-400">{label}</p>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-white px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <SectionHeader
              eyebrow="Preuve sociale"
              title="Une expérience pensée pour des utilisateurs réels, pas pour une démo vide."
              text="Les agences veulent gagner du temps, mais surtout prouver que l’argent est bien suivi."
            />
            <div className="mt-12 grid gap-4 lg:grid-cols-3">
              {testimonials.map((testimonial) => (
                <Reveal key={testimonial.name} className="rounded-lg border border-slate-200 bg-[#fbfaf6] p-6">
                  <p className="text-lg font-bold leading-8 text-slate-900">“{testimonial.quote}”</p>
                  <div className="mt-6 flex items-center gap-3 border-t border-slate-200 pt-5">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-sm font-black text-emerald-800">
                      {testimonial.name.slice(0, 1)}
                    </div>
                    <div>
                      <p className="font-black text-slate-950">{testimonial.name}</p>
                      <p className="text-sm font-semibold text-slate-500">{testimonial.role}</p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section id="tarifs" className="bg-[#f6f3ea] px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <SectionHeader
              eyebrow="Pricing"
              title="Des plans simples, avec onboarding et accompagnement."
              text="Chaque plan est conçu pour réduire la friction de départ : essai gratuit, import des données, support WhatsApp et montée en charge progressive."
            />
            <div className="mt-12 grid gap-4 lg:grid-cols-4">
              {plans.map((plan) => (
                <Reveal
                  key={plan.name}
                  className={`relative rounded-lg border p-6 ${
                    plan.highlighted
                      ? 'border-emerald-500 bg-[#07120f] text-white shadow-[0_30px_100px_rgba(6,17,13,0.24)]'
                      : 'border-emerald-900/10 bg-white text-slate-950'
                  }`}
                >
                  {plan.highlighted && (
                    <div className="mb-4 inline-flex rounded-md bg-emerald-300 px-2 py-1 text-xs font-black text-emerald-950">
                      Recommandé
                    </div>
                  )}
                  <p className="text-xl font-black">{plan.name}</p>
                  <p className={`mt-3 text-sm leading-6 ${plan.highlighted ? 'text-slate-300' : 'text-slate-600'}`}>
                    {plan.description}
                  </p>
                  <div className="mt-6">
                    <span className="text-4xl font-black">{plan.price}</span>
                    {plan.unit && <span className={`ml-2 text-sm font-bold ${plan.highlighted ? 'text-slate-300' : 'text-slate-500'}`}>{plan.unit}</span>}
                  </div>
                  <button
                    type="button"
                    onClick={plan.name === 'Enterprise' ? goDemo : goSignup}
                    className={`mt-6 w-full rounded-lg px-4 py-3 text-sm font-black ${
                      plan.highlighted ? 'bg-emerald-300 text-emerald-950 hover:bg-emerald-200' : 'bg-slate-950 text-white hover:bg-emerald-950'
                    }`}
                  >
                    {plan.name === 'Enterprise' ? 'Parler à l’équipe' : 'Commencer'}
                  </button>
                  <div className="mt-6 space-y-3">
                    {plan.features.map((feature) => (
                      <div key={feature} className="flex gap-3">
                        <Check className={`mt-0.5 h-4 w-4 ${plan.highlighted ? 'text-emerald-300' : 'text-emerald-700'}`} />
                        <span className={`text-sm font-semibold ${plan.highlighted ? 'text-slate-200' : 'text-slate-700'}`}>{feature}</span>
                      </div>
                    ))}
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section id="faq" className="bg-white px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.8fr_1.2fr]">
            <SectionHeader
              align="left"
              eyebrow="FAQ"
              title="Les questions que posent les agences sérieuses."
              text="Une landing premium doit aussi rassurer vite : paiements, import, documents, démo et montée en charge."
            />
            <div className="space-y-3">
              {faqs.map((faq, index) => (
                <Reveal key={faq.question}>
                  <button
                    type="button"
                    onClick={() => setOpenFaq(openFaq === index ? -1 : index)}
                    className="w-full rounded-lg border border-slate-200 bg-[#fbfaf6] p-5 text-left"
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

        <section className="bg-[#f6f3ea] px-4 py-20 sm:px-6 lg:px-8">
          <Reveal className="mx-auto max-w-7xl overflow-hidden rounded-lg bg-[#07120f] px-6 py-14 text-center text-white shadow-[0_35px_120px_rgba(6,17,13,0.24)] sm:px-10">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-300 text-emerald-950">
              <Zap className="h-6 w-6" />
            </div>
            <h2 className="mx-auto mt-6 max-w-3xl text-3xl font-black leading-tight sm:text-5xl">
              Passez à une gestion locative qui inspire confiance.
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-slate-300">
              Vos loyers, vos impayés, vos quittances et vos rapports méritent une expérience claire, moderne et crédible.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <PremiumButton onClick={goSignup}>Commencer gratuitement</PremiumButton>
              <PremiumButton variant="secondary" onClick={goDemo}>Parler à l’équipe</PremiumButton>
            </div>
          </Reveal>
        </section>
      </main>

      <footer className="border-t border-emerald-900/10 bg-[#f6f3ea] px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-8 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <BrandLogo size="sm" tone="light" showTagline />
            </div>
            <p className="mt-3 max-w-md text-sm leading-6 text-slate-600">
              SaaS de gestion locative pour agences immobilières, bailleurs et équipes qui veulent suivre leur argent avec sérieux.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-8 text-sm font-bold text-slate-600 sm:grid-cols-4">
            <a href="#solution" className="hover:text-emerald-800">Solution</a>
            <a href="#dashboard" className="hover:text-emerald-800">Dashboard</a>
            <a href="#tarifs" className="hover:text-emerald-800">Tarifs</a>
            <a href={whatsappHref('Bonjour Samay Këur.')} target="_blank" rel="noopener noreferrer" className="hover:text-emerald-800">
              WhatsApp
            </a>
          </div>
        </div>
        <div className="mx-auto mt-8 flex max-w-7xl flex-col gap-3 border-t border-emerald-900/10 pt-6 text-xs font-semibold text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>© {year} Samay Këur. Tous droits réservés.</p>
          <div className="flex gap-5">
            <a href="#" className="hover:text-emerald-800">Confidentialité</a>
            <a href="#" className="hover:text-emerald-800">Conditions</a>
            <a href="mailto:contact@samaykeur.com" className="hover:text-emerald-800">contact@samaykeur.com</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
