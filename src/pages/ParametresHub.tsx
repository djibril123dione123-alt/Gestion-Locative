import { lazy, Suspense, useEffect, useMemo, useState, type ComponentType, type ReactNode } from 'react';
import {
  ArrowRight,
  AlertTriangle,
  BadgeCheck,
  Building2,
  CheckCircle2,
  CreditCard,
  FileText,
  HardDrive,
  LayoutDashboard,
  LifeBuoy,
  LockKeyhole,
  Mail,
  ShieldCheck,
  SlidersHorizontal,
  Users,
} from 'lucide-react';

import { PageShell } from '../components/ui/PageShell';
import { PremiumButton } from '../components/ui/PremiumButton';
import { PremiumPageHeader } from '../components/ui/PremiumPageHeader';
import { PageSkeleton } from '../components/ui/Skeleton';
import { useAuth } from '../contexts/AuthContext';

const Parametres = lazy(() => import('./Parametres').then((m) => ({ default: m.Parametres })));
const Equipe = lazy(() => import('./Equipe').then((m) => ({ default: m.Equipe })));
const Abonnement = lazy(() => import('./Abonnement').then((m) => ({ default: m.Abonnement })));

type LegacyInitialTab = 'agence' | 'equipe' | 'abonnement';
type ControlSection =
  | 'overview'
  | 'organization'
  | 'documentsIdentity'
  | 'modules'
  | 'teamAccess'
  | 'billing'
  | 'securitySupport';

interface ParametresHubProps {
  initialTab?: LegacyInitialTab;
}

interface SectionConfig {
  id: ControlSection;
  label: string;
  title?: string;
  eyebrow: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  hiddenForOwner?: boolean;
}

const SECTIONS: SectionConfig[] = [
  {
    id: 'overview',
    label: "Vue d'ensemble",
    eyebrow: 'CONTROL CENTER',
    description: 'Synthèse de votre organisation, de vos modules et de vos accès.',
    icon: LayoutDashboard,
  },
  {
    id: 'organization',
    label: 'Organisation',
    eyebrow: 'IDENTITÉ',
    description: 'Informations légales utilisées dans les contrats, mandats et documents.',
    icon: Building2,
  },
  {
    id: 'documentsIdentity',
    label: 'Documents',
    title: 'Documents & identité',
    eyebrow: 'REGISTRE DOCUMENTAIRE',
    description: 'Modèles, QR Verify, logo et rendu des documents émis.',
    icon: FileText,
  },
  {
    id: 'modules',
    label: 'Modules',
    title: 'Modules & navigation',
    eyebrow: 'WORKSPACE',
    description: 'Pages visibles, modules actifs et capacités de navigation.',
    icon: SlidersHorizontal,
  },
  {
    id: 'teamAccess',
    label: 'Équipe & accès',
    eyebrow: 'COLLABORATEURS',
    description: 'Collaborateurs, rôles, invitations et pages visibles.',
    icon: Users,
    hiddenForOwner: true,
  },
  {
    id: 'billing',
    label: 'Facturation',
    title: 'Abonnement & paiements',
    eyebrow: 'FACTURATION',
    description: 'Plan, limites, renouvellement, paiement en ligne et support manuel.',
    icon: CreditCard,
  },
  {
    id: 'securitySupport',
    label: 'Sécurité',
    title: 'Sécurité & support',
    eyebrow: 'SÉCURITÉ',
    description: 'Accès, audit, statut système et canaux de support.',
    icon: LockKeyhole,
  },
];

const initialSectionMap: Record<LegacyInitialTab, ControlSection> = {
  agence: 'overview',
  equipe: 'teamAccess',
  abonnement: 'billing',
};

const PageLoader = () => <PageSkeleton title="Paramètres" variant="form" className="p-4 sm:p-6" />;

export function ParametresHub({ initialTab = 'agence' }: ParametresHubProps) {
  const { profile, agency, accountProfile } = useAuth();
  const isIndividualOwner = accountProfile.isIndividualOwner;
  const [activeSection, setActiveSection] = useState<ControlSection>(initialSectionMap[initialTab]);

  const sections = useMemo(
    () => SECTIONS.filter((section) => !(isIndividualOwner && section.hiddenForOwner)),
    [isIndividualOwner],
  );

  useEffect(() => {
    const nextSection = initialSectionMap[initialTab];
    setActiveSection(isIndividualOwner && nextSection === 'teamAccess' ? 'overview' : nextSection);
  }, [initialTab, isIndividualOwner]);

  const activeConfig = sections.find((section) => section.id === activeSection) ?? sections[0];
  const agencyName = agency?.name ?? (isIndividualOwner ? 'Compte propriétaire' : 'Organisation');
  const accountKind = isIndividualOwner ? 'Bailleur individuel' : 'Agence immobilière';
  const planLabel = agency?.plan ? agency.plan : 'Starter';
  const statusLabel = agency?.status ? agency.status : 'Actif';

  const openPricing = () => {
    window.location.hash = '#/pricing';
  };

  return (
    <PageShell spacing="compact" variant="dataDense" tone="paper" verticalInset="compact" ariaLabel="Paramètres control center">
      <PremiumPageHeader
        density="ultraCompact"
        className="!rounded-2xl"
        eyebrow={isIndividualOwner ? 'COMPTE PROPRIÉTAIRE' : 'ADMINISTRATION AGENCE'}
        title="Paramètres"
        description={isIndividualOwner
          ? 'Pilotez votre profil propriétaire, vos documents, votre abonnement et votre support.'
          : "Pilotez l'organisation, les droits, les modules et l'abonnement depuis un seul espace."}
        mobileDescription="Control Center."
        sideContent={
          <div className="grid min-w-0 gap-1 sm:grid-cols-4">
            <StatusPill label="Compte" value={accountKind} />
            <StatusPill label="Statut" value={statusLabel} />
            <StatusPill label="Plan" value={planLabel} />
            <StatusPill label="Contrôle" value="Prêt" />
          </div>
        }
      />

      <div className="lg:hidden">
        <div className="flex gap-1 overflow-x-auto rounded-xl border border-emerald-950/10 bg-white/82 p-1 shadow-sm scrollbar-hide">
          {sections.map((section) => {
            const Icon = section.icon;
            const active = section.id === activeSection;
            return (
              <button
                key={section.id}
                type="button"
                onClick={() => setActiveSection(section.id)}
                className={[
                  'inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1.5 text-[0.68rem] font-extrabold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700/20',
                  active ? 'bg-emerald-950 text-white shadow-sm' : 'text-slate-600 hover:bg-emerald-50',
                ].join(' ')}
              >
                <Icon className="h-3 w-3" />
                {section.label}
              </button>
            );
          })}
        </div>
      </div>

      <section className="grid gap-2 lg:grid-cols-[11.5rem_minmax(0,1fr)]">
        <aside className="hidden h-fit rounded-2xl border border-emerald-950/10 bg-gradient-to-b from-emerald-950 via-[#073b2f] to-[#041b16] p-1.5 text-white shadow-[0_14px_38px_rgba(6,38,29,0.1)] lg:sticky lg:top-3 lg:block">
          <div className="rounded-xl border border-white/10 bg-white/8 px-1.5 py-1.5">
            <p className="text-[0.5rem] font-black uppercase tracking-[0.18em] text-emerald-200">Source unique</p>
            <h2 className="mt-0.5 text-[0.74rem] font-extrabold text-white">Control Center</h2>
            <p className="mt-0.5 truncate text-[0.62rem] leading-3 text-emerald-50/70">
              {agencyName}
            </p>
            <div className="mt-1.5 flex items-center gap-1 rounded-lg bg-emerald-200/10 px-1.5 py-0.5 text-[0.52rem] font-extrabold text-emerald-50">
              <CheckCircle2 className="h-2.5 w-2.5 text-emerald-200" />
              Prêt
            </div>
          </div>
          <nav className="mt-1 grid gap-0.5" aria-label="Sections paramètres">
            {sections.map((section) => {
              const Icon = section.icon;
              const active = section.id === activeSection;
              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => setActiveSection(section.id)}
                  className={[
                    'flex min-w-0 items-center gap-1.5 rounded-lg px-1.5 py-1 text-left text-[0.62rem] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200/50',
                    active
                      ? 'bg-white/14 text-white ring-1 ring-white/16'
                      : 'text-emerald-50/72 hover:bg-white/8 hover:text-white',
                  ].join(' ')}
                >
                  <span className={active ? 'h-3 w-0.5 rounded-full bg-orange-300' : 'h-3 w-0.5 rounded-full bg-transparent'} />
                  <Icon className={active ? 'h-3 w-3 text-emerald-100' : 'h-3 w-3 text-emerald-100/64'} />
                  <span className="min-w-0 flex-1 whitespace-nowrap font-semibold">{section.label}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        <main className="min-w-0 space-y-1.5 text-[0.76rem]">
          <section className="rounded-2xl border border-emerald-950/10 bg-[#fffdf8]/92 p-2 shadow-sm ring-1 ring-white/70">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="text-[0.5rem] font-black uppercase tracking-[0.16em] text-[#a45d12]">{activeConfig.eyebrow}</p>
                <h1 className="mt-0.5 font-serif text-[0.95rem] font-extrabold leading-tight text-slate-950 sm:text-[1rem]">
                  {activeConfig.title ?? activeConfig.label}
                </h1>
                <p className="mt-0.5 max-w-3xl text-[0.66rem] font-medium leading-[0.86rem] text-slate-600">{activeConfig.description}</p>
              </div>
              {activeSection === 'billing' ? (
                <PremiumButton variant="secondary" size="sm" onClick={openPricing} icon={<ArrowRight className="h-3.5 w-3.5" />}>
                  Voir les tarifs
                </PremiumButton>
              ) : null}
            </div>
          </section>

          <Suspense fallback={<PageLoader />}>
            {activeSection === 'overview' && (
              <OverviewSection
                isIndividualOwner={isIndividualOwner}
                agencyName={agencyName}
                role={profile?.role ?? 'admin'}
                onOpen={setActiveSection}
              />
            )}
            {activeSection === 'organization' && <Parametres embedded initialTab="general" />}
            {activeSection === 'documentsIdentity' && <Parametres embedded initialTab="documents" embeddedMode="documentsIdentity" />}
            {activeSection === 'modules' && <Parametres embedded initialTab="modules" />}
            {activeSection === 'teamAccess' && <Equipe embedded sectionMode="access" />}
            {activeSection === 'billing' && <Abonnement embedded />}
            {activeSection === 'securitySupport' && <SecuritySupportSection role={profile?.role ?? 'admin'} isIndividualOwner={isIndividualOwner} />}
          </Suspense>
        </main>
      </section>
    </PageShell>
  );
}

function StatusPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-emerald-950/10 bg-white/70 px-1.5 py-1 shadow-sm">
      <p className="text-[0.44rem] font-black uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="truncate text-[0.58rem] font-extrabold text-slate-950" title={value}>{value}</p>
    </div>
  );
}

function OverviewSection({
  isIndividualOwner,
  agencyName,
  role,
  onOpen,
}: {
  isIndividualOwner: boolean;
  agencyName: string;
  role: string;
  onOpen: (section: ControlSection) => void;
}) {
  const cards: Array<{
    title: string;
    label: string;
    value: string;
    description: string;
    icon: ComponentType<{ className?: string }>;
    target: ControlSection;
    tone?: 'emerald' | 'amber' | 'slate';
    hidden?: boolean;
  }> = [
    {
      title: 'Organisation',
      label: 'Identité',
      value: agencyName,
      description: isIndividualOwner ? 'Profil propriétaire et informations légales.' : 'Agence, représentant, NINEA et documents.',
      icon: Building2,
      target: 'organization',
      tone: 'emerald',
    },
    {
      title: 'Documents',
      label: 'GED / QR',
      value: 'Configuré',
      description: 'Mentions, QR Verify, logo et rendu documentaire.',
      icon: FileText,
      target: 'documentsIdentity',
      tone: 'slate',
    },
    {
      title: 'Modules',
      label: 'Workspace',
      value: 'Pages visibles',
      description: 'Modules actifs, navigation et disponibilité par espace.',
      icon: SlidersHorizontal,
      target: 'modules',
      tone: 'amber',
    },
    {
      title: 'Équipe & accès',
      label: 'Collaborateurs',
      value: isIndividualOwner ? 'Simplifié' : 'Actif',
      description: isIndividualOwner ? 'Mode propriétaire sans équipe avancée.' : 'Membres, rôles, invitations et permissions.',
      icon: Users,
      target: 'teamAccess',
      tone: 'emerald',
      hidden: isIndividualOwner,
    },
    {
      title: 'Facturation',
      label: 'Facturation',
      value: 'Plan actuel',
      description: 'Usage, plans, renouvellement et paiement manuel.',
      icon: CreditCard,
      target: 'billing',
      tone: 'amber',
    },
    {
      title: 'Sécurité',
      label: 'RBAC',
      value: role,
      description: 'Accès, audit, statut système et assistance.',
      icon: ShieldCheck,
      target: 'securitySupport',
      tone: 'slate',
    },
  ];

  return (
    <div className="space-y-2">
      <section className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <div className="rounded-xl border border-emerald-950/10 bg-gradient-to-br from-[#fffdf8] via-white to-emerald-50/45 p-2 shadow-sm">
          <p className="text-[0.5rem] font-black uppercase tracking-[0.16em] text-[#a45d12]">Prêt pour exploitation</p>
          <h2 className="mt-0.5 font-serif text-[0.95rem] font-extrabold text-slate-950">Administration centralisée.</h2>
          <p className="mt-0.5 max-w-2xl text-[0.66rem] font-medium leading-[0.9rem] text-slate-600">
            Contrôlez l'identité, les modules, les droits, les documents et la facturation depuis une source unique.
          </p>
          <div className="mt-2 grid gap-1 sm:grid-cols-3">
            <MiniHealth icon={BadgeCheck} label="Compte" value={isIndividualOwner ? 'Propriétaire' : 'Agence'} />
            <MiniHealth icon={ShieldCheck} label="Accès" value={role} />
            <MiniHealth icon={FileText} label="Documents" value="QR prêt" />
          </div>
        </div>
        <div className="rounded-xl border border-orange-200/70 bg-orange-50/65 p-2 shadow-sm">
          <div className="flex items-start gap-2">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-white text-orange-700 shadow-sm">
              <AlertTriangle className="h-3 w-3" />
            </div>
            <div className="min-w-0">
              <p className="text-[0.5rem] font-black uppercase tracking-[0.15em] text-orange-700">À vérifier</p>
              <h3 className="mt-0.5 text-[0.76rem] font-extrabold text-slate-950">Avant démonstration</h3>
              <ul className="mt-1 space-y-0.5 text-[0.62rem] font-semibold leading-[0.85rem] text-slate-600">
                <li>Infos légales agence.</li>
                <li>Logo et couleurs documentaires.</li>
                <li>Droits agent et comptable.</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {cards.filter((card) => !card.hidden).map((card) => (
          <ControlCard key={card.title} {...card} onOpen={() => onOpen(card.target)} />
        ))}
      </div>
    </div>
  );
}

function MiniHealth({ icon: Icon, label, value }: { icon: ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-center gap-1.5 rounded-lg border border-emerald-950/10 bg-white/82 px-1.5 py-1 shadow-sm">
      <Icon className="h-2.5 w-2.5 shrink-0 text-emerald-800" />
      <div className="min-w-0">
        <p className="text-[0.46rem] font-black uppercase tracking-[0.14em] text-slate-500">{label}</p>
        <p className="truncate text-[0.64rem] font-extrabold text-slate-900">{value}</p>
      </div>
    </div>
  );
}

function ControlCard({
  title,
  label,
  value,
  description,
  icon: Icon,
  tone = 'slate',
  onOpen,
}: {
  title: string;
  label: string;
  value: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  tone?: 'emerald' | 'amber' | 'slate';
  onOpen: () => void;
}) {
  const toneClass =
    tone === 'emerald'
      ? 'bg-emerald-50 text-emerald-800'
      : tone === 'amber'
        ? 'bg-orange-50 text-orange-700'
        : 'bg-slate-100 text-slate-700';

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group min-w-0 rounded-xl border border-emerald-950/10 bg-white/88 p-2 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700/20"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[0.46rem] font-black uppercase tracking-[0.14em] text-slate-500">{label}</p>
          <h3 className="mt-0.5 truncate text-[0.76rem] font-extrabold text-slate-950">{title}</h3>
        </div>
        <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg ${toneClass}`}>
          <Icon className="h-2.5 w-2.5" />
        </div>
      </div>
      <p className="mt-1 truncate text-[0.66rem] font-extrabold text-slate-800">{value}</p>
      <p className="mt-0.5 line-clamp-2 text-[0.6rem] leading-[0.82rem] text-slate-500">{description}</p>
      <span className="mt-1.5 inline-flex items-center gap-1 text-[0.62rem] font-extrabold text-emerald-800">
        Ouvrir <ArrowRight className="h-3 w-3 transition group-hover:translate-x-0.5" />
      </span>
    </button>
  );
}

function PanelCard({ title, eyebrow, children, icon }: { title: string; eyebrow: string; children: ReactNode; icon: ComponentType<{ className?: string }> }) {
  const Icon = icon;
  return (
    <section className="rounded-xl border border-emerald-950/10 bg-white/88 p-2 shadow-sm">
      <div className="flex items-start gap-2">
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-800">
          <Icon className="h-2.5 w-2.5" />
        </div>
        <div className="min-w-0">
          <p className="text-[0.46rem] font-black uppercase tracking-[0.14em] text-emerald-700">{eyebrow}</p>
          <h3 className="mt-0.5 text-[0.76rem] font-extrabold text-slate-950">{title}</h3>
          <div className="mt-1 text-[0.64rem] font-medium leading-[0.88rem] text-slate-600">{children}</div>
        </div>
      </div>
    </section>
  );
}

function SecuritySupportSection({ role, isIndividualOwner }: { role: string; isIndividualOwner: boolean }) {
  const statuses: Array<{ label: string; value: string; icon: ComponentType<{ className?: string }> }> = [
    { label: 'Application', value: 'Opérationnelle', icon: CheckCircle2 },
    { label: 'Documents', value: 'Disponible', icon: FileText },
    { label: 'QR Verify', value: 'Actif', icon: ShieldCheck },
    { label: 'Stockage', value: 'Contrôlé', icon: HardDrive },
  ];

  return (
    <div className="space-y-2">
      <div className="grid gap-2 lg:grid-cols-3">
        <PanelCard title="RBAC actif" eyebrow="ACCÈS" icon={ShieldCheck}>
          <p>Rôle courant : <span className="font-black text-slate-900">{role}</span>. Les pages restent contrôlées par RBAC et permissions par page.</p>
        </PanelCard>
        <PanelCard title="Profil de compte protégé" eyebrow="MULTI-TENANT" icon={BadgeCheck}>
          <p>
            {isIndividualOwner
              ? 'Le compte propriétaire garde une navigation simplifiée et le fallback is_bailleur_account.'
              : "Le compte agence garde équipe, permissions, modules avancés et abonnement d'agence."}
          </p>
        </PanelCard>
        <PanelCard title="Journal & audit" eyebrow="TRACE" icon={LockKeyhole}>
          <p>Les événements sensibles restent dans le journal réservé aux administrateurs autorisés.</p>
          <a href="#/audit" className="mt-2 inline-flex text-[0.68rem] font-extrabold text-emerald-800 underline-offset-2 hover:underline">
            Ouvrir le journal d'audit
          </a>
        </PanelCard>
      </div>

      <section className="rounded-xl border border-emerald-950/10 bg-white/88 p-2 shadow-sm">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="text-[0.46rem] font-black uppercase tracking-[0.14em] text-emerald-700">SYSTÈME</p>
            <h3 className="mt-0.5 text-[0.78rem] font-extrabold text-slate-950">État opérationnel</h3>
            <p className="mt-0.5 text-[0.64rem] leading-[0.88rem] text-slate-600">Statuts lisibles sans exposer de secret technique.</p>
          </div>
          <div className="grid min-w-0 flex-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-4">
            {statuses.map(({ label, value, icon: Icon }) => (
              <div key={label} className="rounded-lg border border-emerald-950/10 bg-[#fffdf8] px-1.5 py-1 shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[0.46rem] font-black uppercase tracking-[0.14em] text-slate-500">{label}</p>
                    <p className="truncate text-[0.62rem] font-extrabold text-slate-950">{value}</p>
                  </div>
                  <Icon className="h-3 w-3 shrink-0 text-emerald-800" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="grid gap-2 lg:grid-cols-2">
        <PanelCard title="Support WhatsApp" eyebrow="ASSISTANCE" icon={LifeBuoy}>
          <p>Canal rapide pour abonnement, incident bloquant ou accompagnement commercial.</p>
          <a href="https://wa.me/221769010960" target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex text-[0.68rem] font-extrabold text-emerald-800 underline-offset-2 hover:underline">
            Contacter WhatsApp
          </a>
        </PanelCard>
        <PanelCard title="Email support" eyebrow="CONTACT" icon={Mail}>
          <p>Canal de suivi administratif, preuve de paiement manuel et demande non urgente.</p>
          <a href="mailto:samaykeur@gmail.com" className="mt-2 inline-flex text-[0.68rem] font-extrabold text-emerald-800 underline-offset-2 hover:underline">
            samaykeur@gmail.com
          </a>
        </PanelCard>
      </div>
    </div>
  );
}

export default ParametresHub;
