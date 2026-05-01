import React, { useState, lazy, Suspense } from 'react';
import { Menu } from 'lucide-react';

import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Auth } from './pages/Auth';
import { Sidebar } from './components/layout/Sidebar';
import { BottomNav } from './components/layout/BottomNav';
import { TrialBanner } from './components/ui/TrialBanner';
import { MaintenanceBanner } from './components/ui/MaintenanceBanner';
import { supabase } from './lib/supabase';
import Welcome from './pages/Welcome';

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
};

function AppContent() {
    const { user, profile, loading } = useAuth();
    const [currentPage, setCurrentPage] = useState('dashboard');
    const [sidebarOpen, setSidebarOpen] = useState(false);
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

    if (invitationToken) {
        return (
            <Suspense fallback={
                <div className="flex items-center justify-center min-h-screen">
                    <div className="animate-spin rounded-full h-12 w-12 border-4 border-orange-200 border-t-orange-600"></div>
                </div>
            }>
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

    React.useEffect(() => {
        if (!loading && user && !profile) {
            const timer = setTimeout(() => {
                setShowWelcomeAnyway(true);
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [loading, user, profile]);

    React.useEffect(() => {
        if (user && !invitationToken) {
            try {
                const stored = sessionStorage.getItem('invite_token');
                if (stored) setInvitationToken(stored);
            } catch {
                /* noop */
            }
        }
    }, [user, invitationToken]);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-orange-200 border-t-orange-600 mb-4"></div>
                    <p className="text-slate-600">Chargement...</p>
                </div>
            </div>
        );
    }

    if (!user) {
        return <Auth />;
    }

    if (!profile && !showWelcomeAnyway) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-orange-50 to-orange-100 p-4">
                <div className="text-center max-w-md bg-white rounded-2xl shadow-xl p-8">
                    <div className="inline-block animate-spin rounded-full h-16 w-16 border-4 border-orange-200 border-t-orange-600 mb-4"></div>
                    <p className="text-lg text-slate-900 font-semibold mb-2">Chargement de votre profil...</p>
                    <p className="text-sm text-slate-600 mb-6">Cela peut prendre quelques secondes</p>
                    <button
                        onClick={async () => {
                            try {
                                await supabase.auth.signOut();
                                window.location.reload();
                            } catch (error) {
                                // Erreur silencieuse
                            }
                        }}
                        className="text-sm text-orange-600 hover:text-orange-700 underline"
                    >
                        Problème de connexion ? Déconnectez-vous
                    </button>
                </div>
            </div>
        );
    }

    if (profile?.role === 'super_admin') {
        return (
            <div className="min-h-screen bg-gray-950">
                <Suspense fallback={
                    <div className="flex items-center justify-center min-h-screen">
                        <div className="animate-spin rounded-full h-12 w-12 border-4 border-orange-200 border-t-orange-600"></div>
                    </div>
                }>
                    <Console />
                </Suspense>
            </div>
        );
    }

    if (!profile || !profile.agency_id) {
        return <Welcome />;
    }

    const renderPage = () => {
        switch (currentPage) {
            case 'dashboard':
                return <Dashboard onNavigate={setCurrentPage} />;
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
            default:
                return <Dashboard />;
        }
    };

    const pageLabel = PAGE_LABELS[currentPage] ?? 'Samay Këur';

    return (
        <div className="flex h-screen overflow-hidden bg-gray-50">
            <MaintenanceBanner />
            <Sidebar
                currentPage={currentPage}
                onNavigate={setCurrentPage}
                isOpen={sidebarOpen}
                onClose={() => setSidebarOpen(false)}
            />

            <div className="flex-1 flex flex-col overflow-hidden lg:ml-0">
                {/* Top bar — mobile only */}
                <div className="lg:hidden bg-white border-b border-slate-200 px-3 py-2.5 flex items-center gap-3 sticky top-0 z-30 shadow-sm">
                    <button
                        onClick={() => setSidebarOpen(true)}
                        className="p-2 rounded-lg hover:bg-slate-100 transition-colors flex-shrink-0"
                        aria-label="Ouvrir le menu"
                    >
                        <Menu className="w-5 h-5 text-slate-700" />
                    </button>
                    <span className="text-base font-bold text-slate-900 truncate flex-1">
                        {pageLabel}
                    </span>
                    <img
                        src="/logo-icon.png"
                        alt="Samay Këur"
                        className="h-8 w-auto object-contain flex-shrink-0 opacity-70"
                    />
                </div>

                <TrialBanner onNavigate={setCurrentPage} />

                {/* Scrollable content — extra bottom padding on mobile for BottomNav */}
                <main className="flex-1 overflow-y-auto pb-16 lg:pb-0">
                    <Suspense fallback={
                        <div className="flex items-center justify-center h-full p-8">
                            <div className="text-center">
                                <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-orange-200 border-t-orange-600 mb-4"></div>
                                <p className="text-slate-600">Chargement...</p>
                            </div>
                        </div>
                    }>
                        {renderPage()}
                    </Suspense>
                </main>
            </div>

            {/* Bottom navigation — mobile only */}
            <BottomNav
                currentPage={currentPage}
                onNavigate={(page) => {
                    setCurrentPage(page);
                    setSidebarOpen(false);
                }}
                onOpenMenu={() => setSidebarOpen(true)}
            />
        </div>
    );
}

function App() {
    return (
        <AuthProvider>
            <AppContent />
        </AuthProvider>
    );
}

export default App;
