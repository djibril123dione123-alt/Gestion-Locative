import React, { useState, lazy, Suspense } from 'react';
import { Menu } from 'lucide-react';

import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Auth } from './pages/Auth';
import { Sidebar } from './components/layout/Sidebar';
import { TrialBanner } from './components/ui/TrialBanner';
import { supabase } from './lib/supabase';
import Welcome from './pages/Welcome';

const Dashboard = lazy(() => import('./pages/Dashboard').then(m => ({ default: m.Dashboard })));
const Agences = lazy(() => import('./pages/Agences'));
const Bailleurs = lazy(() => import('./pages/Bailleurs').then(m => ({ default: m.Bailleurs })));
const Immeubles = lazy(() => import('./pages/Immeubles').then(m => ({ default: m.Immeubles })));
const Unites = lazy(() => import('./pages/Unites').then(m => ({ default: m.Unites })));
const Locataires = lazy(() => import('./pages/Locataires').then(m => ({ default: m.Locataires })));
const Contrats = lazy(() => import('./pages/Contrats').then(m => ({ default: m.Contrats })));
const Paiements = lazy(() => import('./pages/Paiements').then(m => ({ default: m.Paiements })));
const Depenses = lazy(() => import('./pages/Depenses').then(m => ({ default: m.Depenses })));
const Commissions = lazy(() => import('./pages/Commissions').then(m => ({ default: m.Commissions })));
const LoyersImpayes = lazy(() => import('./pages/LoyersImpayes').then(m => ({ default: m.LoyersImpayes })));
const FiltresAvances = lazy(() => import('./pages/FiltresAvances').then(m => ({ default: m.FiltresAvances })));
const TableauDeBordFinancierGlobal = lazy(() => import('./pages/TableauDeBordFinancierGlobal').then(m => ({ default: m.TableauDeBordFinancierGlobal })));
const Parametres = lazy(() => import('./pages/Parametres').then(m => ({ default: m.Parametres })));

function AppContent() {
    const { user, profile, loading } = useAuth();
    const [currentPage, setCurrentPage] = useState('dashboard');
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [showWelcomeAnyway, setShowWelcomeAnyway] = useState(false);

    React.useEffect(() => {
        if (!loading && user && !profile) {
            const timer = setTimeout(() => {
                setShowWelcomeAnyway(true);
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [loading, user, profile]);

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

    // If profile not loaded yet and timeout not reached, show loading
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

    // If no profile or no agency_id, show Welcome page
    if (!profile || !profile.agency_id) {
        return <Welcome />;
    }

    const renderPage = () => {
        switch (currentPage) {
            case 'dashboard':
                return <Dashboard onNavigate={setCurrentPage} />;
            case 'agences':
                return <Agences />;
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
                return <Paiements />;
            case 'depenses':
                return <Depenses />;
            case 'commissions':
                return <Commissions />;
            case 'loyers-impayes':
                return <LoyersImpayes />;
            case 'tableau-de-bord-financier':
                return <TableauDeBordFinancierGlobal />;
            case 'filtres-avances':
                return <FiltresAvances />;
            case 'parametres':
                return <Parametres />;
            default:
                return <Dashboard />;
        }
    };

    return (
        <div className="flex h-screen overflow-hidden bg-gray-50">
            {/* Sidebar */}
            <Sidebar
                currentPage={currentPage}
                onNavigate={setCurrentPage}
                isOpen={sidebarOpen}
                onClose={() => setSidebarOpen(false)}
            />

            {/* Contenu principal */}
            <div className="flex-1 flex flex-col overflow-hidden lg:ml-0">
                {/* Top bar pour mobile */}
                <div className="lg:hidden bg-white border-b border-slate-200 p-4 flex items-center gap-4 sticky top-0 z-30">
                    <button
                        onClick={() => setSidebarOpen(true)}
                        className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
                    >
                        <Menu className="w-6 h-6 text-slate-700" />
                    </button>
                    <span className="text-xl font-bold bg-gradient-to-r from-orange-600 to-orange-800 bg-clip-text text-transparent">
                        Gestion Locative
                    </span>
                </div>

                {/* Trial Banner */}
                <TrialBanner />

                {/* Contenu défilable */}
                <main className="flex-1 overflow-y-auto">
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
