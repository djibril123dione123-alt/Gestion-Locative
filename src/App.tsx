import React, { useState } from 'react';

import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LoginForm } from './components/auth/LoginForm';
import { Sidebar } from './components/layout/Sidebar';
import { Dashboard } from './pages/Dashboard';
import { Bailleurs } from './pages/Bailleurs';
import { Immeubles } from './pages/Immeubles';
import { Unites } from './pages/Unites';
import { Locataires } from './pages/Locataires';
import { Contrats } from './pages/Contrats';
import { Paiements } from './pages/Paiements';
import { Depenses } from './pages/Depenses';
import { Commissions } from './pages/Commissions';
import { LoyersImpayes } from './pages/LoyersImpayes';
import { FiltresAvances } from './pages/FiltresAvances';
import { TableauDeBordFinancierGlobal } from './pages/TableauDeBordFinancierGlobal';
import Welcome from './pages/Welcome';

function AppContent() {
    const { user, profile, loading } = useAuth();
    const [currentPage, setCurrentPage] = useState('dashboard');

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                Chargement...
            </div>
        );
    }

    if (!user) {
        return <LoginForm />;
    }

    if (user && profile && !profile.agency_id) {
        return <Welcome />;
    }

    const renderPage = () => {
        switch (currentPage) {
            case 'dashboard':
                return <Dashboard />;
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
            default:
                return <Dashboard />;
        }
    };

    return (
        <div className="flex h-screen overflow-hidden">
            {/* Sidebar fixée */}
            <Sidebar
                currentPage={currentPage}
                onNavigate={setCurrentPage}
                className="fixed left-0 top-0 h-full"
            />

            {/* Contenu principal défilable indépendamment */}
            <main className="flex-1 ml-1 overflow-y-auto bg-gray-50">
                {renderPage()}
            </main>
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
