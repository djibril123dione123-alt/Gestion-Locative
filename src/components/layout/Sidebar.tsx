import React from 'react';
import {
  LayoutDashboard,
  Building2,
  Home,
  Users,
  FileText,
  CreditCard,
  Calculator,
  LogOut,
  UserCircle,
  DoorOpen,
  AlertCircle,
  BarChart3,
  FileBarChart,
  Filter,
  TrendingDown,
  ChevronRight,
  X,
} from 'lucide-react';

import { useAuth } from '../../contexts/AuthContext';

interface SidebarProps {
  currentPage: string;
  onNavigate: (page: string) => void;
  isOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({ currentPage, onNavigate, isOpen = true, onClose }: SidebarProps) {
  const { profile, signOut } = useAuth();

  const handleNavigate = (page: string) => {
    onNavigate(page);
    if (onClose) onClose();
  };

  const menuItems = [
    { id: 'dashboard', label: 'Tableau de bord', icon: LayoutDashboard, roles: ['admin'] },
    { id: 'agences', label: 'Agences', icon: Home, roles: ['admin'] },
    { id: 'bailleurs', label: 'Bailleurs', icon: UserCircle, roles: ['admin'] },
    { id: 'immeubles', label: 'Immeubles', icon: Building2, roles: ['admin'] },
    { id: 'unites', label: 'Produits', icon: DoorOpen, roles: ['admin'] },
    { id: 'locataires', label: 'Locataires', icon: Users, roles: ['admin', 'agent', 'comptable'] },
    { id: 'contrats', label: 'Contrats', icon: FileText, roles: ['admin', 'agent', 'comptable', 'bailleur'] },
    { id: 'paiements', label: 'Paiements', icon: CreditCard, roles: ['admin', 'agent', 'comptable', 'bailleur'] },
    { id: 'depenses', label: 'Dépenses', icon: TrendingDown, roles: ['admin'] },
    { id: 'loyers-impayes', label: 'Loyers impayés', icon: AlertCircle, roles: ['admin', 'agent', 'comptable'] },
    { id: 'tableau-de-bord-financier', label: 'Rapports Financiers', icon: Calculator, roles: ['admin'] },
    { id: 'filtres-avances', label: 'Filtres avancés', icon: Filter, roles: ['admin', 'agent', 'comptable'] },
  ];

  const filteredItems = menuItems.filter(
    (item) => profile && item.roles.includes(profile.role)
  );

  return (
    <>
      {/* Backdrop pour mobile */}
      {isOpen && onClose && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden animate-fadeIn"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <div
        className={`
          fixed lg:static inset-y-0 left-0 z-50
          w-64 h-screen flex flex-col text-white
          transform transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
        style={{ backgroundColor: '#2D2D2D' }}
      >
        {/* En-tête avec logo centré et bouton fermer sur mobile */}
        <div className="p-3 border-b flex items-center justify-between" style={{ borderColor: '#3A3A3A' }}>
          <img
            src="/templates/Logo confort immo archi neutre.png"
            alt="Logo Confort Immo Archi"
            className="h-16 w-auto object-contain mx-auto"
          />
          {onClose && (
            <button
              onClick={onClose}
              className="lg:hidden absolute right-3 top-3 p-2 rounded-lg hover:bg-slate-700 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4">
          <ul className="space-y-1 px-3">
            {filteredItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentPage === item.id;

              return (
                <li key={item.id}>
                  <button
                    onClick={() => handleNavigate(item.id)}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-300 group relative hover:translate-x-1"
                    style={{
                      backgroundColor: isActive ? 'rgba(245, 130, 32, 0.15)' : 'transparent',
                      color: isActive ? '#FFA64D' : '#B0B0B0',
                    }}
                  >
                    {isActive && (
                      <div
                        className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 rounded-r"
                        style={{ backgroundColor: '#F58220' }}
                      />
                    )}
                    <Icon
                      className="w-5 h-5 transition"
                      style={{ color: isActive ? '#F58220' : '#707070' }}
                    />
                    <span className="font-medium text-sm">{item.label}</span>
                    {isActive && (
                      <ChevronRight
                        className="w-4 h-4 ml-auto"
                        style={{ color: '#F58220' }}
                      />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Profil utilisateur */}
        <div className="p-4 border-t" style={{ borderColor: '#3A3A3A' }}>
          <div className="mb-3 px-3 py-3 rounded-lg" style={{ backgroundColor: '#3A3A3A' }}>
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm"
                style={{
                  background: 'linear-gradient(135deg, #F58220 0%, #C0392B 100%)',
                }}
              >
                {profile?.prenom?.[0] ?? 'A'}
                {profile?.nom?.[0] ?? 'S'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {profile?.prenom} {profile?.nom}
                </p>
                <p className="text-xs capitalize" style={{ color: '#FFA64D' }}>
                  {profile?.role}
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={() => signOut()}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg transition hover:bg-slate-700"
            style={{
              backgroundColor: 'transparent',
              color: '#B0B0B0',
            }}
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium text-sm">Déconnexion</span>
          </button>
        </div>
      </div>
    </>
  );
}
