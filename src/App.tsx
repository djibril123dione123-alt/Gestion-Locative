import { useState, lazy, Suspense, useEffect } from 'react';
import { HashRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { Menu } from 'lucide-react';

import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Auth } from './pages/Auth';
import { Sidebar } from './components/layout/Sidebar';
import { BottomNav } from './components/layout/BottomNav';
import { TrialBanner } from './components/ui/TrialBanner';
import { MaintenanceBanner } from './components/ui/MaintenanceBanner';
import { NetworkBanner } from './components/ui/NetworkBanner';
import { BackupIndicator } from './components/ui/BackupIndicator';
import { BrandMark, BrandedLoader } from './components/brand/BrandLogo';
import { PageSkeleton } from './components/ui/Skeleton';
import { DocumentGeneratedModal } from './components/documents/DocumentGeneratedModal';
import { useOfflineSync } from './hooks/useOfflineSync';
import { supabase } from './lib/supabase';
import Welcome from './pages/Welcome';
import { runFullBackup, getLastBackupTimestamp } from './services/localBackup';
import { recoverStaleSyncing } from './services/offlineQueue';
import { identifyUser, trackPageView } from './lib/analytics';

const LandingPage = lazy(() => import('./pages/LandingPage').then(m => ({ default: m.LandingPage })));
const Dashboard = lazy(() => import('./pages/Dashboard').then(m => ({ default: m.Dashboard })));
const Agences = lazy(() => import('./pages/Agences'));
const Bailleurs = lazy(() => import('./pages/Bailleurs').then(m => ({ default: m.Bailleurs })));
const Immeubles = lazy(() => import('./pages/Immeubles').then(m => ({ default: m.Immeubles })));
const Unites = lazy(() => import('./pages/Unites').then(m => ({ default: m.Unites })));
const Locataires = lazy(() => import('./pages/Locataires').then(m => ({ default: m.Locataires })));
const Contrats = lazy(() => import('./pages/Contrats').then(m => ({ default: m.Contrats })));
const Encaissements = lazy(() => import('./pages/Encaissements').then(m => ({ default: m.Encaissements })));
const Depenses = lazy(() => import('./pages/Depenses').then(m => ({ default: m.Depenses })));
const Commissions = lazy(() => import('./pages/Commissions').then(m => ({ default: m.Commissions })));
const Analyses = lazy(() => import('./pages/Analyses').then(m => ({ default: m.Analyses })));
const ParametresHub = lazy(() => import('./pages/ParametresHub').then(m => ({ default: m.ParametresHub })));
const Console = lazy(() => import('./pages/Console').then(m => ({ default: m.Console })));
const Notifications = lazy(() => import('./pages/Notifications').then(m => ({ default: m.Notifications })));
const Inventaires = lazy(() => import('./pages/Inventaires').then(m => ({ default: m.Inventaires })));
const Interventions = lazy(() => import('./pages/Interventions').then(m => ({ default: m.Interventions })));
const Calendrier = lazy(() => import('./pages/Calendrier').then(m => ({ default: m.Calendrier })));
const Documents = lazy(() => import('./pages/Documents').then(m => ({ default: m.Documents })));
const AcceptInvitation = lazy(() => import('./pages/AcceptInvitation').then(m => ({ default: m.AcceptInvitation })));
const AuditDashboard = lazy(() => import('./pages/AuditDashboard').then(m => ({ default: m.AuditDashboard })));
const Pricing = lazy(() => import('./pages/Pricing').then(m => ({ default: m.Pricing })));

const PAGE_LABELS: Record<string, string> = {
    dashboard: 'Tableau de bord',
    agences: 'Agences',
    bailleurs: 'Bailleurs',
    immeubles: 'Immeubles',
    unites: 'Produits',
    locataires: 'Locataires',
    contrats: 'Contrats',
    paiements: 'Encaissements',
    'loyers-impayes': 'Impayés',
    depenses: 'Dépenses',
    commissions: 'Commissions',
    'tableau-de-bord-financier': 'Analyses',
    'filtres-avances': 'Filtres avancés',
    parametres: 'Paramètres',
    equipe: 'Équipe',
    abonnement: 'Abonnement',
    notifications: 'Notifications',
    inventaires: 'États des lieux',
    interventions: 'Maintenance',
    calendrier: 'Calendrier',
    documents: 'Documents',
    audit: 'Control Tower',
    pricing: 'Tarifs',
};

function AppContent() {
    const { user, profile, loading } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const { pendingCount, syncing } = useOfflineSync();
    const [showWelcomeAnyway, setShowWelcomeAnyway] = useState(false);
    const [invitationToken, setInvitationToken] = useState<string | null>(() => {
        const params = new URLSearchParams(window.location.search);
        const fromUrl = params.get('token');
        if (fromUrl) return fromUrl;
        try {
            return sessionStorage.getItem('invite_token');
        } catch {
            return null;
        }
    });

    // Derive current page from URL (React Router)
    const currentPage = location.pathname.replace(/^\//, '') || 'dashboard';

    // Navigation helper - compatible avec l'interface onNavigate existante
    const handleNavigate = (page: string) => {
        navigate('/' + page);
        setSidebarOpen(false);
    };

    // PostHog : suivi de page à chaque changement de route
    useEffect(() => {
        trackPageView(currentPage);
    }, [currentPage]);

    // PostHog : identification utilisateur après connexion
    useEffect(() => {
        if (profile) {
            identifyUser(profile.id, {
                email: profile.email,
                role: profile.role,
                agency_id: profile.agency_id,
            });
        }
    }, [profile]);

    useEffect(() => {
        if (!loading && user && !profile) {
            const timer = setTimeout(() => {
                setShowWelcomeAnyway(true);
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [loading, user, profile]);

    useEffect(() => {
        if (user && !invitationToken) {
            try {
                const stored = sessionStorage.getItem('invite_token');
                if (stored) setInvitationToken(stored);
            } catch {
                /* noop */
            }
        }
    }, [user, invitationToken]);

    // Backup complet quotidien depuis Supabase
    useEffect(() => {
        if (!profile?.agency_id || !navigator.onLine) return;
        const ONE_DAY_MS = 24 * 60 * 60 * 1000;
        const lastTs = getLastBackupTimestamp();
        const isDue = !lastTs || (Date.now() - lastTs) > ONE_DAY_MS;
        if (!isDue) return;
        runFullBackup(profile.agency_id).catch(() => {
            // Fail silencieux - le prochain démarrage réessaiera
        });
    }, [profile?.agency_id]);

    // Récupération des mutations bloquées en "syncing"
    useEffect(() => {
        recoverStaleSyncing().catch(() => { /* noop */ });
    }, []);

    if (invitationToken) {
        return (
            <Suspense fallback={<BrandedLoader label="Invitation" />}>
                <AcceptInvitation
                    token={invitationToken}
                    onDone={() => {
                        const url = new URL(window.location.href);
                        url.searchParams.delete('token');
                        window.history.replaceState({}, '', url.toString());
                        setInvitationToken(null);
                    }}
                />
            </Suspense>
        );
    }

    if (loading) {
        return <BrandedLoader />;
    }

    if (!user) {
        if (currentPage === 'pricing') {
            return (
                <Suspense fallback={<BrandedLoader label="Tarifs" />}>
                    <Pricing onNavigate={(p) => navigate('/' + p)} />
                </Suspense>
            );
        }
        if (currentPage === 'auth') {
            return <Auth />;
        }
        return (
            <Suspense fallback={<BrandedLoader label="Samay Këur" />}>
                <LandingPage onNavigate={(p) => navigate(p ? '/' + p : '/')} />
            </Suspense>
        );
    }

    if (!profile && !showWelcomeAnyway) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-brand-paper p-4">
                <div className="max-w-md rounded-lg border border-slate-200 bg-white p-8 text-center shadow-premium">
                    <BrandMark size="lg" tone="light" animated className="mx-auto mb-4" />
                    <p className="text-lg text-slate-900 font-semibold mb-2">Chargement de votre profil...</p>
                    <p className="text-sm text-slate-600 mb-6">Cela peut prendre quelques secondes</p>
                    <button
                        onClick={async () => {
                            try {
                                await supabase.auth.signOut();
                                window.location.reload();
                            } catch {
                                // Erreur silencieuse
                            }
                        }}
                        className="text-sm font-bold text-brand-700 underline hover:text-brand-800"
                    >
                        Problème de connexion ? Déconnectez-vous
                    </button>
                </div>
            </div>
        );
    }

    if (profile?.role === 'super_admin') {
        return (
            <div className="premium-polish min-h-screen bg-brand-950">
                <Suspense fallback={<BrandedLoader label="Control Tower" />}>
                    <Console />
                </Suspense>
                <DocumentGeneratedModal onNavigate={handleNavigate} />
            </div>
        );
    }

    if (!profile || !profile.agency_id) {
        return <Welcome />;
    }

    const renderPage = () => {
        switch (currentPage) {
            case 'dashboard':
                return <Dashboard onNavigate={handleNavigate} />;
            case 'agences':
                return profile?.role === 'super_admin' ? <Console /> : <Agences />;
            case 'bailleurs':
                return <Bailleurs />;
            case 'immeubles':
                return <Immeubles />;
            case 'unites':
                return <Unites />;
            case 'locataires':
                return <Locataires />;
            case 'contrats':
                return <Contrats />;
            case 'paiements':
                return <Encaissements initialTab="recus" />;
            case 'loyers-impayes':
                return <Encaissements initialTab="impayes" />;
            case 'depenses':
                return <Depenses />;
            case 'commissions':
                return <Commissions />;
            case 'tableau-de-bord-financier':
                return <Analyses initialTab="rapports" />;
            case 'filtres-avances':
                return <Analyses initialTab="filtres" />;
            case 'parametres':
                return <ParametresHub initialTab="agence" />;
            case 'equipe':
                return <ParametresHub initialTab="equipe" />;
            case 'abonnement':
                return <ParametresHub initialTab="abonnement" />;
            case 'notifications':
                return <Notifications />;
            case 'inventaires':
                return <Inventaires />;
            case 'interventions':
                return <Interventions />;
            case 'calendrier':
                return <Calendrier />;
            case 'documents':
                return <Documents />;
            case 'audit':
                return <AuditDashboard />;
            case 'pricing':
                return <Pricing onNavigate={handleNavigate} />;
            default:
                return <Dashboard onNavigate={handleNavigate} />;
        }
    };

    const pageLabel = PAGE_LABELS[currentPage] ?? 'Samay Këur';
    const pageSkeletonVariant =
        currentPage === 'dashboard'
            ? 'dashboard'
            : currentPage === 'tableau-de-bord-financier'
                ? 'analytics'
                : ['parametres', 'equipe', 'abonnement', 'pricing'].includes(currentPage)
                    ? 'form'
                    : 'table';

    return (
        <div className="premium-polish flex h-screen overflow-hidden bg-brand-paper">
            <MaintenanceBanner />
            <Sidebar
                currentPage={currentPage}
                onNavigate={handleNavigate}
                isOpen={sidebarOpen}
                onClose={() => setSidebarOpen(false)}
            />

            <div className="flex-1 flex flex-col overflow-hidden lg:ml-0">
                {/* Top bar - mobile only */}
                <div className="sticky top-0 z-30 flex items-center gap-3 border-b border-emerald-900/10 bg-white/[0.94] px-3 py-2.5 shadow-sm backdrop-blur-xl lg:hidden">
                    <button
                        onClick={() => setSidebarOpen(true)}
                        className="flex-shrink-0 rounded-lg p-2 transition-colors hover:bg-emerald-50"
                        aria-label="Ouvrir le menu"
                    >
                        <Menu className="h-5 w-5 text-brand-800" />
                    </button>
                    <span className="flex-1 truncate text-base font-black text-slate-950">
                        {pageLabel}
                    </span>
                    <BrandMark size="xs" tone="light" animated={false} withTile={false} />
                </div>

                <NetworkBanner />
                <TrialBanner onNavigate={handleNavigate} />

                {/* Scrollable content - extra bottom padding on mobile for BottomNav */}
                <main className="flex-1 overflow-y-auto bg-[radial-gradient(circle_at_20%_0%,rgba(52,211,153,0.08),transparent_34rem)] pb-20 lg:pb-0 scroll-smooth">
                    <Suspense fallback={<PageSkeleton title={pageLabel} variant={pageSkeletonVariant} />}>
                        <Routes>
                            <Route path="*" element={renderPage()} />
                        </Routes>
                    </Suspense>
                </main>
            </div>

            {/* Bottom navigation - mobile only */}
            <BottomNav
                currentPage={currentPage}
                onNavigate={handleNavigate}
                onOpenMenu={() => setSidebarOpen(true)}
            />

            {/* Backup + offline status indicator - floating badge */}
            <BackupIndicator syncing={syncing} pendingCount={pendingCount} />
            <DocumentGeneratedModal onNavigate={handleNavigate} />
        </div>
    );
}

function App() {
    return (
        <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <AuthProvider>
                <AppContent />
            </AuthProvider>
        </HashRouter>
    );
}

export default App;


