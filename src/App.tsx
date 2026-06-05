import { useState, lazy, Suspense, useEffect } from 'react';
import { HashRouter, useNavigate, useLocation } from 'react-router-dom';
import { Menu, RefreshCw, WifiOff } from 'lucide-react';

import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Auth } from './pages/Auth';
import { Sidebar } from './components/layout/Sidebar';
import { BottomNav } from './components/layout/BottomNav';
import { TrialBanner } from './components/ui/TrialBanner';
import { MaintenanceBanner } from './components/ui/MaintenanceBanner';
import { NetworkBanner } from './components/ui/NetworkBanner';
import { BackupIndicator } from './components/ui/BackupIndicator';
import { NotificationBell } from './components/ui/NotificationBell';
import { BrandMark, BrandedLoader } from './components/brand/BrandLogo';
import { PageSkeleton } from './components/ui/Skeleton';
import { DocumentGeneratedModal } from './components/documents/DocumentGeneratedModal';
import { OnboardingWizard } from './components/onboarding/OnboardingWizard';
import ErrorBoundary from './components/ErrorBoundary';
import { useOfflineSync } from './hooks/useOfflineSync';
import { supabase } from './lib/supabase';
import { permissionRowsToMap, type UserPermissionMap } from './lib/rbac';
import {
    canAccessAccountPage,
    getAccountPageAccessReason,
    getAccountPageLabel,
    getEffectiveRoleForAccount,
} from './lib/accountProfile';
import type { AgencySettings } from './types/agency';
import Welcome from './pages/Welcome';
import { runFullBackup, getLastBackupTimestamp } from './services/localBackup';
import { recoverStaleSyncing } from './services/offlineQueue';
import { identifyUser, trackPageView } from './lib/analytics';
import { readWithCache } from './services/offlineReadCache';
import { warmOfflineRouteCache } from './services/offlineRoutePreloader';
import { getOnboardingCompletionStatus, markOnboardingComplete } from './components/onboarding/onboardingStorage';

const Dashboard = lazy(() => import('./pages/Dashboard').then(m => ({ default: m.Dashboard })));
const Agences = lazy(() => import('./pages/Agences'));
const Bailleurs = lazy(() => import('./pages/Bailleurs').then(m => ({ default: m.Bailleurs })));
const Patrimoine = lazy(() => import('./pages/Patrimoine').then(m => ({ default: m.Patrimoine })));
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
const DocumentScanner = lazy(() => import('./pages/DocumentScanner').then(m => ({ default: m.DocumentScanner })));
const AcceptInvitation = lazy(() => import('./pages/AcceptInvitation').then(m => ({ default: m.AcceptInvitation })));
const AuditDashboard = lazy(() => import('./pages/AuditDashboard').then(m => ({ default: m.AuditDashboard })));
const Pricing = lazy(() => import('./pages/Pricing').then(m => ({ default: m.Pricing })));
const VerifyDocument = lazy(() => import('./pages/VerifyDocument').then(m => ({ default: m.VerifyDocument })));

function getExternalAuthMode(): 'login' | 'register' | null {
    const path = window.location.pathname.replace(/^\/+|\/+$/g, '').toLowerCase();
    if (path === 'login') return 'login';
    if (path === 'signup' || path === 'register') return 'register';

    const params = new URLSearchParams(window.location.search);
    const mode = params.get('mode')?.toLowerCase();
    if (mode === 'signup' || mode === 'register') return 'register';
    if (mode === 'login') return 'login';

    return null;
}

const PAGE_LABELS: Record<string, string> = {
    dashboard: 'Tableau de bord',
    agences: 'Agences',
    bailleurs: 'Bailleurs',
    patrimoine: 'Biens',
    immeubles: 'Immeubles',
    unites: 'Unités',
    locataires: 'Locataires',
    contrats: 'Contrats',
    paiements: 'Encaissements',
    'loyers-impayes': 'Impayés',
    depenses: 'Dépenses',
    commissions: 'Commissions',
    'tableau-de-bord-financier': 'Pilotage financier',
    'filtres-avances': 'Rapports',
    parametres: 'Paramètres',
    equipe: 'Équipe',
    abonnement: 'Abonnement',
    notifications: 'Notifications',
    inventaires: 'États des lieux',
    interventions: 'Maintenance',
    calendrier: 'Calendrier',
    documents: 'Documents',
    'documents/scan': 'Scanner un document',
    audit: 'Control Tower',
    pricing: 'Tarifs',
};

function AppContent() {
    const { user, profile, accountProfile, loading } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
        try {
            return localStorage.getItem('sk_sidebar_collapsed') === 'true';
        } catch {
            return false;
        }
    });
    const { pendingCount, syncing, isOnline, errorCount } = useOfflineSync();
    const [showWelcomeAnyway, setShowWelcomeAnyway] = useState(false);
    const [moduleSettings, setModuleSettings] = useState<
        Pick<
            AgencySettings,
            'module_depenses_actif' | 'module_inventaires_actif' | 'module_interventions_actif' | 'mode_avance_actif'
        > | null
    >(null);
    const [userPermissions, setUserPermissions] = useState<UserPermissionMap | null>(null);
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
    const [showOnboardingWizard, setShowOnboardingWizard] = useState(false);

    // Derive current page from URL (React Router)
    const externalAuthMode = getExternalAuthMode();
    const hashPage = location.pathname.replace(/^\//, '') || 'dashboard';
    const currentPage = externalAuthMode ? 'auth' : hashPage;
    const routeKey = `${currentPage}:${location.pathname}${location.search}`;

    // Navigation helper - compatible avec l'interface onNavigate existante
    const handleNavigate = (page: string) => {
        if (import.meta.env.DEV) {
            console.debug('[Navigation] request', {
                from: currentPage,
                to: page,
                pathname: location.pathname,
                search: location.search,
            });
        }
        navigate('/' + page);
        setSidebarOpen(false);
    };

    useEffect(() => {
        if (!import.meta.env.DEV) return;
        console.debug('[Navigation] route-change', {
            currentPage,
            pathname: location.pathname,
            search: location.search,
            key: location.key,
            routeKey,
        });
    }, [currentPage, location.key, location.pathname, location.search, routeKey]);

    useEffect(() => {
        try {
            localStorage.setItem('sk_sidebar_collapsed', sidebarCollapsed ? 'true' : 'false');
        } catch {
            /* noop */
        }
    }, [sidebarCollapsed]);

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
        if (!loading && user && !profile && isOnline) {
            const timer = setTimeout(() => {
                setShowWelcomeAnyway(true);
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [isOnline, loading, user, profile]);

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
        runFullBackup(profile.agency_id, profile.id).catch(() => {
            // Fail silencieux - le prochain démarrage réessaiera
        });
    }, [profile?.agency_id, profile?.id]);

    // Récupération des mutations bloquées en "syncing"
    useEffect(() => {
        recoverStaleSyncing().catch(() => { /* noop */ });
    }, []);

    useEffect(() => {
        if (profile?.agency_id && isOnline) {
            warmOfflineRouteCache();
        }
    }, [isOnline, profile?.agency_id]);

    useEffect(() => {
        if (!profile?.agency_id || profile.role === 'super_admin') {
            setShowOnboardingWizard(false);
            return;
        }

        const agencyId = profile.agency_id;
        let alive = true;

        void (async () => {
            const completion = await getOnboardingCompletionStatus(agencyId);
            if (!alive) return;
            setShowOnboardingWizard(!completion.completed);
        })();

        return () => {
            alive = false;
        };
    }, [profile?.agency_id, profile?.role]);

    useEffect(() => {
        if (!profile?.agency_id || profile.role === 'super_admin') {
            setModuleSettings(null);
            return;
        }

        let alive = true;
        void (async () => {
            try {
                const result = await readWithCache(
                    { agencyId: profile.agency_id, userId: profile.id },
                    'app-module-settings',
                    async () => {
                        const { data, error } = await supabase
                            .from('agency_settings')
                            .select('module_depenses_actif,module_inventaires_actif,module_interventions_actif,mode_avance_actif')
                            .eq('agency_id', profile.agency_id)
                            .maybeSingle();
                        if (error) throw error;
                        return {
                            module_depenses_actif: data?.module_depenses_actif ?? true,
                            module_inventaires_actif: data?.module_inventaires_actif ?? false,
                            module_interventions_actif: data?.module_interventions_actif ?? false,
                            mode_avance_actif: data?.mode_avance_actif ?? false,
                        };
                    },
                    { timeoutMs: 5_000 }
                );
                if (!alive) return;
                setModuleSettings(result.data);
            } catch {
                if (!alive) return;
                setModuleSettings({
                    module_depenses_actif: true,
                    module_inventaires_actif: false,
                    module_interventions_actif: false,
                    mode_avance_actif: false,
                });
            }
        })();

        return () => {
            alive = false;
        };
    }, [profile?.agency_id, profile?.id, profile?.role]);

    useEffect(() => {
        if (!profile?.agency_id || !profile.id || profile.role === 'super_admin' || profile.role === 'admin') {
            setUserPermissions(null);
            return;
        }

        let alive = true;
        void (async () => {
            try {
                const result = await readWithCache(
                    { agencyId: profile.agency_id, userId: profile.id },
                    `app-page-permissions:${profile.id}`,
                    async () => {
                        const { data, error } = await supabase
                            .from('user_page_permissions')
                            .select('page,access_level,can_create,can_update,can_delete,can_export,can_manage')
                            .eq('agency_id', profile.agency_id)
                            .eq('user_id', profile.id);
                        if (error) throw error;
                        return permissionRowsToMap(data);
                    },
                    { timeoutMs: 5_000 }
                );
                if (!alive) return;
                setUserPermissions(result.data);
            } catch (error) {
                if (!alive) return;
                console.warn('[rbac] permissions load failed', error instanceof Error ? error.message : String(error));
                setUserPermissions({});
            }
        })();

        return () => {
            alive = false;
        };
    }, [profile?.agency_id, profile?.id, profile?.role]);

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

    if (currentPage === 'verify-document') {
        return (
            <Suspense fallback={<BrandedLoader label="Vérification" />}>
                <VerifyDocument />
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
            return <Auth initialMode={externalAuthMode ?? 'login'} />;
        }
        return <Auth initialMode="login" />;
    }

    if (!profile && !showWelcomeAnyway) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-brand-paper p-4">
                <div className="max-w-md rounded-lg border border-slate-200 bg-white p-8 text-center shadow-premium">
                    <BrandMark size="lg" tone="light" animated className="mx-auto mb-4" />
                    <p className="text-lg text-slate-900 font-semibold mb-2">
                        {!isOnline ? 'Profil indisponible hors connexion' : 'Chargement de votre profil...'}
                    </p>
                    <p className="text-sm text-slate-600 mb-6">
                        {!isOnline
                            ? "Votre session est conservee. Reconnectez le reseau ou revenez apres un premier chargement complet pour utiliser le cache local."
                            : 'Cela peut prendre quelques secondes'}
                    </p>
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
        if (!canAccessAccountPage(profile.role, currentPage, accountProfile, moduleSettings, userPermissions)) {
            const reason = getAccountPageAccessReason(currentPage, accountProfile, moduleSettings, userPermissions);
            return (
                <div className="flex min-h-full items-center justify-center p-6">
                    <div className="max-w-lg rounded-3xl border border-emerald-100 bg-white p-8 text-center shadow-2xl shadow-emerald-950/10">
                        <BrandMark size="lg" tone="light" animated className="mx-auto mb-5" />
                        <p className="sk-type-caption text-orange-600">
                            Accès contrôlé
                        </p>
                        <h1 className="mt-3 text-3xl font-black text-slate-950">Page indisponible</h1>
                        <p className="mt-3 text-sm leading-6 text-slate-600">{reason}</p>
                        <button
                            type="button"
                            onClick={() => handleNavigate('dashboard')}
                            className="mt-6 inline-flex items-center justify-center rounded-xl bg-emerald-800 px-5 py-3 text-sm font-black text-white shadow-lg shadow-emerald-900/20 transition hover:-translate-y-0.5 hover:bg-emerald-900"
                        >
                            Retour au tableau de bord
                        </button>
                    </div>
                </div>
            );
        }

        switch (currentPage) {
            case 'dashboard':
                return <Dashboard onNavigate={handleNavigate} onStartSetupWizard={() => setShowOnboardingWizard(true)} />;
            case 'agences':
                return profile?.role === 'super_admin' ? <Console /> : <Agences />;
            case 'bailleurs':
                return <Bailleurs />;
            case 'patrimoine':
                return <Patrimoine />;
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
                return <Analyses initialTab="rapports" />;
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
            case 'documents/scan':
                return <DocumentScanner />;
            case 'audit':
                return <AuditDashboard />;
            case 'pricing':
                return <Pricing onNavigate={handleNavigate} />;
            default:
                return <Dashboard onNavigate={handleNavigate} onStartSetupWizard={() => setShowOnboardingWizard(true)} />;
        }
    };

    const pageLabel = getAccountPageLabel(currentPage, accountProfile) ?? PAGE_LABELS[currentPage] ?? 'Samay Këur';
    const mobileSyncLabel = !isOnline
        ? 'Hors ligne'
        : syncing
            ? 'Sync'
            : pendingCount > 0
                ? `${pendingCount} en attente`
                : errorCount > 0
                    ? `${errorCount} erreur${errorCount > 1 ? 's' : ''}`
                    : null;
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
                isCollapsed={sidebarCollapsed}
                onToggleCollapsed={() => setSidebarCollapsed((value) => !value)}
                moduleSettings={moduleSettings}
                userPermissions={userPermissions}
            />

            <div className="flex-1 flex flex-col overflow-hidden lg:ml-0">
                <NetworkBanner />
                <TrialBanner onNavigate={handleNavigate} />

                {/* Scrollable content - extra bottom padding on mobile for BottomNav */}
                <main className="flex-1 overflow-y-auto bg-[radial-gradient(circle_at_20%_0%,rgba(52,211,153,0.08),transparent_34rem)] pb-[calc(var(--sk-mobile-bottom-nav-height)+env(safe-area-inset-bottom)+1rem)] scroll-smooth lg:pb-0">
                    {/* Mobile top bar lives in the scroll flow, so content feels less pinned and more native. */}
                    <div className="sk-mobile-topbar flex items-center gap-2 border-b border-emerald-900/10 bg-white/[0.88] px-3 py-2 shadow-sm backdrop-blur-2xl lg:hidden">
                        <button
                            onClick={() => setSidebarOpen(true)}
                            className="sk-pressable flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl transition-colors hover:bg-emerald-50"
                            aria-label="Ouvrir le menu"
                        >
                            <Menu className="h-5 w-5 text-brand-800" />
                        </button>
                        <div className="min-w-0 flex-1">
                            <span className="block truncate text-base font-black leading-tight text-slate-950">
                                {pageLabel}
                            </span>
                            {mobileSyncLabel && (
                                <span className="mt-1 inline-flex max-w-full items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-black uppercase tracking-widest text-brand-800">
                                    {!isOnline ? <WifiOff className="h-3 w-3" /> : <RefreshCw className={`h-3 w-3 ${syncing ? 'animate-spin' : ''}`} />}
                                    <span className="truncate">{mobileSyncLabel}</span>
                                </span>
                            )}
                        </div>
                        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-brand-surface">
                            <NotificationBell onNavigate={handleNavigate} compact />
                        </div>
                    </div>

                    <ErrorBoundary key={`error:${routeKey}`}>
                        <Suspense key={`suspense:${routeKey}`} fallback={<PageSkeleton title={pageLabel} variant={pageSkeletonVariant} />}>
                            <div key={`page:${routeKey}`} className="min-h-full" data-route-page={currentPage}>
                                {renderPage()}
                            </div>
                        </Suspense>
                    </ErrorBoundary>
                </main>
            </div>

            {/* Bottom navigation - mobile only */}
            <BottomNav
                currentPage={currentPage}
                onNavigate={handleNavigate}
                onOpenMenu={() => setSidebarOpen(true)}
                role={getEffectiveRoleForAccount(profile.role, accountProfile)}
                accountProfile={accountProfile}
                moduleSettings={moduleSettings}
                userPermissions={userPermissions}
            />

            {/* Backup + offline status indicator - floating badge */}
            <BackupIndicator syncing={syncing} pendingCount={pendingCount} />
            <DocumentGeneratedModal onNavigate={handleNavigate} />
            <OnboardingWizard
                isOpen={showOnboardingWizard}
                onClose={() => setShowOnboardingWizard(false)}
                onComplete={() => {
                    if (profile?.agency_id) markOnboardingComplete(profile.agency_id);
                    setShowOnboardingWizard(false);
                    window.dispatchEvent(new CustomEvent('samaykeur:data-changed', { detail: { domains: [] } }));
                }}
            />
        </div>
    );
}

function App() {
    return (
        <HashRouter>
            <AuthProvider>
                <AppContent />
            </AuthProvider>
        </HashRouter>
    );
}

export default App;


