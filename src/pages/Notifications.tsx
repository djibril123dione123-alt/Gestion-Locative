import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Bell,
  Check,
  CheckCircle2,
  CreditCard,
  FileText,
  Megaphone,
  Search,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';

import { ConfirmModal } from '../components/ui/ConfirmModal';
import { EmptyState } from '../components/ui/EmptyState';
import { MetricCard } from '../components/ui/MetricCard';
import type { NotificationItem } from '../components/ui/NotificationBell';
import { PageShell } from '../components/ui/PageShell';
import { PremiumFilterSelect } from '../components/ui/PremiumFilterSelect';
import { PremiumKpiGrid } from '../components/ui/PremiumKpiGrid';
import { PremiumPageHeader } from '../components/ui/PremiumPageHeader';
import { PremiumTableSurface } from '../components/ui/PremiumTableSurface';
import { PremiumToolbar, type QuickChip } from '../components/ui/PremiumToolbar';
import { PageSkeleton, SkeletonTable } from '../components/ui/Skeleton';
import { ToastContainer } from '../components/ui/Toast';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/useToast';
import { supabase } from '../lib/supabase';

function formatNotificationBadge(type: string): {
  label: string;
  badgeClass: string;
  icon: typeof Bell;
} {
  const normalized = (type || '').toLowerCase();
  if (normalized.includes('admin') || normalized.includes('announcement')) {
    return {
      label: 'Annonce administration',
      badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      icon: Megaphone,
    };
  }
  if (normalized.includes('paiement') || normalized.includes('encaissement') || normalized.includes('finance')) {
    return {
      label: 'Finances & Encaissement',
      badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      icon: CreditCard,
    };
  }
  if (normalized.includes('impaye') || normalized.includes('alerte') || normalized.includes('urgent')) {
    return {
      label: 'Alerte & Créance',
      badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
      icon: AlertTriangle,
    };
  }
  if (normalized.includes('document') || normalized.includes('contrat') || normalized.includes('bail')) {
    return {
      label: 'Document & GED',
      badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
      icon: FileText,
    };
  }
  return {
    label: type ? type.replace(/_/g, ' ') : 'Information',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
    icon: Bell,
  };
}

export function Notifications() {
  const { user } = useAuth();
  const toast = useToast();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterRead, setFilterRead] = useState<'all' | 'unread' | 'read'>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setItems((data ?? []) as NotificationItem[]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [user?.id, toast]);

  useEffect(() => {
    if (user?.id) load();
  }, [user?.id, load]);

  const types = useMemo(() => Array.from(new Set(items.map((n) => n.type))).filter(Boolean), [items]);

  const unreadCount = useMemo(() => items.filter((n) => !n.read).length, [items]);
  const readCount = useMemo(() => items.filter((n) => n.read).length, [items]);
  const treatmentRate = useMemo(() => {
    if (items.length === 0) return 100;
    return Math.round((readCount / items.length) * 100);
  }, [items.length, readCount]);

  const filtered = useMemo(() => {
    return items.filter((n) => {
      if (filterRead === 'unread' && n.read) return false;
      if (filterRead === 'read' && !n.read) return false;
      if (filterType !== 'all' && n.type !== filterType) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = n.title?.toLowerCase().includes(q) ?? false;
        const matchMsg = n.message?.toLowerCase().includes(q) ?? false;
        const matchType = n.type?.toLowerCase().includes(q) ?? false;
        if (!matchTitle && !matchMsg && !matchType) return false;
      }
      return true;
    });
  }, [items, filterRead, filterType, searchQuery]);

  const markRead = async (id: string) => {
    await supabase.from('notifications').update({ read: true }).eq('id', id);
    load();
  };

  const remove = async (id: string) => {
    await supabase.from('notifications').delete().eq('id', id);
    toast.success('Notification supprimée');
    load();
  };

  const markAllRead = async () => {
    if (!user?.id) return;
    await supabase.from('notifications').update({ read: true }).eq('user_id', user.id).eq('read', false);
    toast.success('Toutes les notifications ont été marquées comme lues');
    load();
  };

  const deleteAll = async () => {
    if (!user?.id) return;
    await supabase.from('notifications').delete().eq('user_id', user.id);
    toast.success('Toutes les notifications ont été supprimées');
    setConfirmDeleteAll(false);
    load();
  };

  const quickChips: QuickChip[] = [
    {
      id: 'all',
      label: 'Toutes',
      count: items.length,
      isActive: filterRead === 'all',
      onClick: () => setFilterRead('all'),
    },
    {
      id: 'unread',
      label: 'À traiter',
      count: unreadCount,
      isActive: filterRead === 'unread',
      onClick: () => setFilterRead('unread'),
    },
    {
      id: 'read',
      label: 'Archivées',
      count: readCount,
      isActive: filterRead === 'read',
      onClick: () => setFilterRead('read'),
    },
  ];

  if (loading && items.length === 0) {
    return <PageSkeleton title="Notifications" variant="table" />;
  }

  return (
    <PageShell className="pb-12 w-full flex-1 min-w-0">
      <div className="w-full flex-1 min-w-0 space-y-4">
        {/* EN-TÊTE PREMIUM COMPACT CONNECTÉ AUX AUTRES PAGES */}
        <PremiumPageHeader
          density="compact"
          eyebrow="PILOTAGE AGENCE"
          title="Notifications"
          description="Suivi des alertes agence, validations et échéances."
          mobileDescription="Alertes et notifications agence."
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={markAllRead}
                disabled={unreadCount === 0}
                data-testid="button-mark-all-read-page"
                className="inline-flex h-8 items-center gap-1.5 rounded-[0.6rem] border border-emerald-300 bg-emerald-50/80 px-3 py-1 text-xs font-bold text-emerald-800 shadow-sm transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                Tout marquer lu
              </button>
              <button
                type="button"
                onClick={() => setConfirmDeleteAll(true)}
                disabled={items.length === 0}
                data-testid="button-delete-all"
                className="inline-flex h-8 items-center gap-1.5 rounded-[0.6rem] border border-red-200 bg-white px-3 py-1 text-xs font-bold text-red-600 shadow-sm transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Vider l'inbox
              </button>
            </div>
          }
        />

        {/* GRILLE KPI COMMUNE (PremiumKpiGrid density="compact" + MetricCard density="compact") */}
        <PremiumKpiGrid density="compact">
          <MetricCard
            density="compact"
            title="TOTAL NOTIFICATIONS"
            icon={Bell}
            value={items.length.toString()}
            helper="Historique agence"
            tone="neutral"
          />
          <MetricCard
            density="compact"
            title="À TRAITER / NON LUES"
            icon={AlertCircle}
            value={unreadCount.toString()}
            helper="Nécessite attention"
            tone="danger"
          />
          <MetricCard
            density="compact"
            title="ARCHIVÉES / LUES"
            icon={CheckCircle2}
            value={readCount.toString()}
            helper="Alertes consultées"
            tone="emerald"
          />
          <MetricCard
            density="compact"
            title="TAUX TRAITEMENT"
            icon={Sparkles}
            value={`${treatmentRate}%`}
            helper="Progression lecture"
            tone="financial"
          />
        </PremiumKpiGrid>

        {/* TOOLBAR COMMUN (PremiumToolbar density="compact") */}
        <PremiumToolbar
          density="compact"
          search={
            <div className="relative min-w-0 flex-1">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-800" />
              <input
                type="text"
                placeholder="Rechercher une alerte ou annonce..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="!min-h-8 !h-8 w-full rounded-[0.6rem] border border-emerald-950/10 bg-white/95 pl-8 pr-7 py-0 text-xs font-medium text-slate-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] outline-none focus:border-brand-700 focus:ring-4 focus:ring-emerald-100"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:text-slate-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          }
          secondaryActions={
            types.length > 0 ? (
              <PremiumFilterSelect
                value={filterType === 'all' ? '' : filterType}
                placeholder="Toutes catégories"
                options={types.map((t) => ({
                  value: t,
                  label: formatNotificationBadge(t).label,
                }))}
                onChange={(val) => setFilterType(val || 'all')}
                className="w-[12rem]"
              />
            ) : null
          }
          quickChips={quickChips}
        />

        {/* SURFACE DE TABLEAU / LISTE EXECUTIVE COMMUNE (PremiumTableSurface) */}
        <PremiumTableSurface>
          {loading ? (
            <div className="p-6">
              <SkeletonTable rows={5} cols={3} />
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              bare
              icon={Bell}
              title={searchQuery ? 'Aucun résultat' : 'Aucune notification'}
              description={
                searchQuery
                  ? `Aucune alerte ne correspond à "${searchQuery}".`
                  : 'Votre espace de notification est à jour.'
              }
            />
          ) : (
            <div className="divide-y divide-slate-100/80">
              {filtered.map((n) => {
                const badge = formatNotificationBadge(n.type);
                const IconComponent = badge.icon;

                return (
                  <div
                    key={n.id}
                    data-testid={`row-notification-${n.id}`}
                    className={`group flex flex-col justify-between gap-3 px-4 py-3 transition-colors duration-150 sm:flex-row sm:items-center ${
                      !n.read
                        ? 'bg-emerald-50/40 hover:bg-emerald-50/70 border-l-2 border-l-brand-600'
                        : 'bg-white hover:bg-slate-50/60'
                    }`}
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <div
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-xs ${
                          !n.read
                            ? 'border-orange-200 bg-orange-100 text-orange-600'
                            : 'border-slate-200 bg-slate-50 text-slate-500'
                        }`}
                      >
                        <IconComponent className="h-4 w-4" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider ${badge.badgeClass}`}
                          >
                            {badge.label}
                          </span>

                          {!n.read && (
                            <span className="inline-flex items-center gap-1 rounded bg-orange-500/15 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-orange-600">
                              Nouveau
                            </span>
                          )}

                          <span className="text-[11px] font-medium text-slate-400">
                            {new Date(n.created_at).toLocaleString('fr-FR', {
                              dateStyle: 'short',
                              timeStyle: 'short',
                            })}
                          </span>
                        </div>

                        <p
                          className={`mt-0.5 truncate text-[0.8rem] leading-snug font-semibold ${
                            !n.read ? 'text-slate-950' : 'text-slate-700'
                          }`}
                        >
                          {n.title}
                        </p>

                        {n.message && (
                          <p className="mt-0.5 truncate text-[0.73rem] leading-snug text-slate-500">
                            {n.message}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center justify-end gap-1.5">
                      {!n.read && (
                        <button
                          type="button"
                          onClick={() => markRead(n.id)}
                          data-testid={`button-mark-read-${n.id}`}
                          className="inline-flex h-7 items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 text-[11px] font-bold text-emerald-800 transition hover:bg-emerald-100"
                        >
                          <Check className="h-3 w-3" />
                          Marquer lu
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => remove(n.id)}
                        data-testid={`button-delete-${n.id}`}
                        title="Supprimer"
                        className="inline-flex h-7 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="h-3 w-3" />
                        <span className="sm:hidden">Supprimer</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </PremiumTableSurface>

        <ConfirmModal
          isOpen={confirmDeleteAll}
          onClose={() => setConfirmDeleteAll(false)}
          onConfirm={deleteAll}
          title="Vider l'historique de notifications ?"
          message="Toutes vos alertes et notifications agence seront définitivement supprimées."
          confirmLabel="Tout supprimer"
          cancelLabel="Annuler"
          isDestructive
        />
        <ToastContainer toasts={toast.toasts} onRemove={toast.removeToast} />
      </div>
    </PageShell>
  );
}
