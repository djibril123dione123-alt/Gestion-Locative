import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/useToast';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Database,
  TrendingDown,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react';

interface HealthMetric {
  name: string;
  status: 'healthy' | 'warning' | 'critical';
  value: string | number;
  icon: React.ElementType;
}

/**
 * Super-Admin Dashboard
 * KPIs for investors: MRR, ARR, churn, active agencies, processed payments
 */
export function SuperAdminDashboard() {
  const { profile } = useAuth();
  const { error: showError } = useToast();

  // Check authorization
  if (profile?.role !== 'super_admin') {
    return (
      <div className="p-8 text-center">
        <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Accès refusé</h2>
        <p className="text-slate-600">Seuls les super-administrateurs peuvent accéder à ce tableau de bord.</p>
      </div>
    );
  }

  // Health metrics
  const metrics: HealthMetric[] = [
    {
      name: 'Agences actives',
      status: 'healthy',
      value: 12,
      icon: Users,
    },
    {
      name: 'MRR global',
      status: 'healthy',
      value: '2.3M XOF',
      icon: TrendingUp,
    },
    {
      name: 'ARR global',
      status: 'healthy',
      value: '27.6M XOF',
      icon: TrendingUp,
    },
    {
      name: 'Churn rate',
      status: 'warning',
      value: '3.2%',
      icon: TrendingDown,
    },
    {
      name: 'Paiements traités',
      status: 'healthy',
      value: 543,
      icon: CheckCircle2,
    },
    {
      name: 'Tâches en attente',
      status: 'warning',
      value: 12,
      icon: Clock,
    },
    {
      name: 'Erreurs système',
      status: 'critical',
      value: 3,
      icon: AlertTriangle,
    },
    {
      name: 'Uptime',
      status: 'healthy',
      value: '99.9%',
      icon: Activity,
    },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 lg:space-y-8 animate-fadeIn bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="animate-slideInLeft">
        <h1 className="text-3xl lg:text-4xl font-bold bg-gradient-to-r from-orange-600 to-orange-800 bg-clip-text text-transparent mb-2">
          Tableau de bord super-admin
        </h1>
        <p className="text-slate-600">Vue d'ensemble pour les investisseurs et propriétaires</p>
      </div>

      {/* Top KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="MRR Global"
          value="2.3M XOF"
          change={12.5}
          icon={TrendingUp}
          color="emerald"
        />
        <MetricCard
          title="ARR Global"
          value="27.6M XOF"
          change={12.5}
          icon={TrendingUp}
          color="blue"
        />
        <MetricCard
          title="Churn Rate"
          value="3.2%"
          change={-0.8}
          icon={TrendingDown}
          color="orange"
        />
        <MetricCard
          title="Agences actives"
          value="12"
          icon={Users}
          color="purple"
        />
      </div>

      {/* Health Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          const statusColors = {
            healthy: 'bg-emerald-50 border-emerald-200',
            warning: 'bg-yellow-50 border-yellow-200',
            critical: 'bg-red-50 border-red-200',
          };
          const statusIcons = {
            healthy: 'text-emerald-600',
            warning: 'text-yellow-600',
            critical: 'text-red-600',
          };

          return (
            <div
              key={metric.name}
              className={`p-4 rounded-xl border-2 ${statusColors[metric.status]} transition-all hover:shadow-lg`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className={`p-2 rounded-lg ${statusIcons[metric.status]} bg-white`}>
                  <Icon className="w-5 h-5" />
                </div>
                <span
                  className={`text-xs font-bold uppercase px-2 py-1 rounded-full ${
                    metric.status === 'healthy'
                      ? 'bg-emerald-100 text-emerald-700'
                      : metric.status === 'warning'
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-red-100 text-red-700'
                  }`}
                >
                  {metric.status}
                </span>
              </div>
              <p className="text-sm text-slate-600 mb-1">{metric.name}</p>
              <p className="text-2xl font-bold text-slate-900">{metric.value}</p>
            </div>
          );
        })}
      </div>

      {/* System Status */}
      <div className="bg-white p-6 rounded-2xl shadow-lg border border-slate-200">
        <h2 className="text-lg font-semibold text-slate-900 mb-6">État du système</h2>
        <div className="space-y-4">
          <StatusRow label="Base de données" status="healthy" uptime="99.9%" />
          <StatusRow label="API Supabase" status="healthy" uptime="99.95%" />
          <StatusRow label="Storage" status="healthy" uptime="99.8%" />
          <StatusRow label="Edge Functions" status="warning" uptime="98.5%" />
          <StatusRow label="Notifications" status="healthy" uptime="99.7%" />
        </div>
      </div>

      {/* Recent Alerts */}
      <div className="bg-white p-6 rounded-2xl shadow-lg border border-slate-200">
        <h2 className="text-lg font-semibold text-slate-900 mb-6">Alertes récentes</h2>
        <div className="space-y-3">
          <AlertItem
            severity="critical"
            title="Erreur Edge Function"
            description="La fonction 'create-paiement' a échoué 3 fois dans la dernière heure"
            time="Il y a 15 min"
          />
          <AlertItem
            severity="warning"
            title="Performance dégradée"
            description="Temps de réponse API > 500ms sur l'endpoint /paiements"
            time="Il y a 42 min"
          />
          <AlertItem
            severity="warning"
            title="Quota approchant"
            description="Une agence approche de sa limite de contrats actifs"
            time="Il y a 2h"
          />
        </div>
      </div>

      {/* Agencies Overview */}
      <div className="bg-white p-6 rounded-2xl shadow-lg border border-slate-200">
        <h2 className="text-lg font-semibold text-slate-900 mb-6">Agences</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-slate-200">
                <th className="text-left py-3 px-4 font-semibold text-slate-600">Nom</th>
                <th className="text-right py-3 px-4 font-semibold text-slate-600">MRR</th>
                <th className="text-right py-3 px-4 font-semibold text-slate-600">Contrats</th>
                <th className="text-right py-3 px-4 font-semibold text-slate-600">Utilisateurs</th>
                <th className="text-center py-3 px-4 font-semibold text-slate-600">Plan</th>
              </tr>
            </thead>
            <tbody>
              {[
                { name: 'Agence Dakar', mrr: '450K', contracts: 128, users: 8, plan: 'Enterprise' },
                { name: 'Immobili Sénégal', mrr: '320K', contracts: 92, users: 5, plan: 'Pro' },
                { name: 'Bailleur Plus', mrr: '280K', contracts: 76, users: 3, plan: 'Pro' },
                { name: 'Real Estate Africa', mrr: '210K', contracts: 45, users: 2, plan: 'Basic' },
              ].map((agency) => (
                <tr key={agency.name} className="border-b border-slate-100 hover:bg-slate-50 transition">
                  <td className="py-3 px-4 font-medium text-slate-900">{agency.name}</td>
                  <td className="text-right py-3 px-4 text-emerald-600 font-semibold">{agency.mrr}</td>
                  <td className="text-right py-3 px-4 text-slate-600">{agency.contracts}</td>
                  <td className="text-right py-3 px-4 text-slate-600">{agency.users}</td>
                  <td className="text-center py-3 px-4">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-700">
                      {agency.plan}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Components ────────────────────────────────────────────────────────────────

interface MetricCardProps {
  title: string;
  value: string | number;
  change?: number;
  icon: React.ElementType;
  color: 'emerald' | 'blue' | 'orange' | 'purple';
}

function MetricCard({ title, value, change, icon: Icon, color }: MetricCardProps) {
  const colors = {
    emerald: 'from-emerald-50 to-emerald-100 border-emerald-200',
    blue: 'from-blue-50 to-blue-100 border-blue-200',
    orange: 'from-orange-50 to-orange-100 border-orange-200',
    purple: 'from-purple-50 to-purple-100 border-purple-200',
  };
  const iconColors = {
    emerald: 'text-emerald-600 bg-emerald-100',
    blue: 'text-blue-600 bg-blue-100',
    orange: 'text-orange-600 bg-orange-100',
    purple: 'text-purple-600 bg-purple-100',
  };

  return (
    <div className={`bg-gradient-to-br ${colors[color]} border-2 rounded-xl p-4 sm:p-6 transition-all hover:shadow-lg`}>
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2.5 rounded-lg ${iconColors[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
        {change !== undefined && (
          <span className={`text-xs font-bold px-2 py-1 rounded-full ${
            change >= 0
              ? 'bg-emerald-100 text-emerald-700'
              : 'bg-red-100 text-red-700'
          }`}>
            {change >= 0 ? '+' : ''}{change.toFixed(1)}%
          </span>
        )}
      </div>
      <p className="text-sm text-slate-600 mb-1">{title}</p>
      <p className="text-2xl sm:text-3xl font-bold text-slate-900">{value}</p>
    </div>
  );
}

interface StatusRowProps {
  label: string;
  status: 'healthy' | 'warning' | 'critical';
  uptime: string;
}

function StatusRow({ label, status, uptime }: StatusRowProps) {
  const statusColors = {
    healthy: 'bg-emerald-100 text-emerald-700',
    warning: 'bg-yellow-100 text-yellow-700',
    critical: 'bg-red-100 text-red-700',
  };

  return (
    <div className="flex items-center justify-between py-3 border-b border-slate-100 last:border-0">
      <span className="text-sm font-medium text-slate-600">{label}</span>
      <div className="flex items-center gap-3">
        <span className="text-sm text-slate-500">{uptime}</span>
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${statusColors[status]}`}>
          {status}
        </span>
      </div>
    </div>
  );
}

interface AlertItemProps {
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  time: string;
}

function AlertItem({ severity, title, description, time }: AlertItemProps) {
  const severityColors = {
    critical: 'bg-red-50 border-red-200 text-red-700',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-700',
    info: 'bg-blue-50 border-blue-200 text-blue-700',
  };
  const severityIcons = {
    critical: AlertTriangle,
    warning: AlertTriangle,
    info: Activity,
  };
  const Icon = severityIcons[severity];

  return (
    <div className={`p-4 border-l-4 rounded-lg ${severityColors[severity]}`}>
      <div className="flex items-start gap-3">
        <Icon className="w-5 h-5 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm">{title}</p>
          <p className="text-sm opacity-75 mt-1">{description}</p>
          <p className="text-xs opacity-60 mt-2">{time}</p>
        </div>
      </div>
    </div>
  );
}
