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
} from 'lucide-react';

import { useAuth } from '../../contexts/AuthContext';

interface SidebarProps {
  currentPage: string;
  onNavigate: (page: string) => void;
}

export function Sidebar({ currentPage, onNavigate }: SidebarProps) {
  const { profile, signOut } = useAuth();

  const menuItems = [
    { id: 'dashboard', label: 'Tableau de bord', icon: LayoutDashboard, roles: ['admin'] },
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
    <div className="w-64 h-screen flex flex-col text-white" style={{ backgroundColor: '#2D2D2D' }}>
      {/* En-tête avec logo centré */}
      <div className="p-3 border-b flex justify-center" style={{ borderColor: '#3A3A3A' }}>
        <img
          src="/templates/Logo confort immo archi neutre.png"
          alt="Logo Confort Immo Archi"
          className="h-22 w-auto object-contain"
        />
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
                  onClick={() => onNavigate(item.id)}
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
              className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
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
          className="w-full flex items-center gap-3 px-4 py-3 rounded-lg transition"
          style={{
            backgroundColor: 'transparent',
            color: '#B0B0B0',
          }}
        >
          <LogOut className="w-5 h-5" />
          <span className="font-medium">Déconnexion</span>
        </button>
      </div>
    </div>
  );
}
