import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/useToast';
import { ToastContainer } from '../components/ui/Toast';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { EmptyState } from '../components/ui/EmptyState';
import { Bell, Check, Trash2 } from 'lucide-react';
import type { NotificationItem } from '../components/ui/NotificationBell';

export function Notifications() {
  const { user } = useAuth();
  const toast = useToast();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterRead, setFilterRead] = useState<'all' | 'unread' | 'read'>('all');
  const [filterType, setFilterType] = useState<string>('all');
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

  const types = useMemo(() => Array.from(new Set(items.map((n) => n.type))), [items]);

  const filtered = items.filter((n) => {
    if (filterRead === 'unread' && n.read) return false;
    if (filterRead === 'read' && !n.read) return false;
    if (filterType !== 'all' && n.type !== filterType) return false;
    return true;
  });

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
    toast.success('Toutes les notifications marquées comme lues');
    load();
  };

  const deleteAll = async () => {
    if (!user?.id) return;
    await supabase.from('notifications').delete().eq('user_id', user.id);
    toast.success('Notifications supprimées');
    setConfirmDeleteAll(false);
    load();
  };

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Notifications</h1>
          <p className="text-sm text-slate-600 mt-1">{items.length} notification{items.length > 1 ? 's' : ''}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={markAllRead}
            data-testid="button-mark-all-read-page"
            className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-slate-300 hover:bg-slate-50"
          >
            <Check className="w-4 h-4" /> Tout marquer comme lu
          </button>
          <button
            type="button"
            onClick={() => setConfirmDeleteAll(true)}
            data-testid="button-delete-all"
            className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-red-200 text-red-600 hover:bg-red-50"
          >
            <Trash2 className="w-4 h-4" /> Tout supprimer
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <select
          value={filterRead}
          onChange={(e) => setFilterRead(e.target.value as 'all' | 'unread' | 'read')}
          data-testid="select-filter-read"
          className="px-3 py-2 text-sm border border-slate-300 rounded-lg"
        >
          <option value="all">Toutes</option>
          <option value="unread">Non lues</option>
          <option value="read">Lues</option>
        </select>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          data-testid="select-filter-type"
          className="px-3 py-2 text-sm border border-slate-300 rounded-lg"
        >
          <option value="all">Tous types</option>
          {types.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        {loading ? (
          <div className="p-12 text-center text-slate-500">Chargement…</div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={Bell} title="Aucune notification" description="Vous êtes à jour." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {filtered.map((n) => (
              <li
                key={n.id}
                data-testid={`row-notification-${n.id}`}
                className={`px-4 sm:px-6 py-4 flex items-start gap-4 ${!n.read ? 'bg-orange-50/40' : ''}`}
              >
                <div className="flex-shrink-0 mt-1">
                  {n.read ? (
                    <Check className="w-5 h-5 text-slate-400" />
                  ) : (
                    <span className="w-2.5 h-2.5 rounded-full block" style={{ backgroundColor: '#F58220' }} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-slate-900">{n.title}</p>
                    <span className="text-xs text-slate-400 whitespace-nowrap">
                      {new Date(n.created_at).toLocaleString('fr-FR')}
                    </span>
                  </div>
                  {n.message && <p className="text-sm text-slate-600 mt-1">{n.message}</p>}
                  <span className="inline-block mt-2 px-2 py-0.5 text-xs rounded bg-slate-100 text-slate-600">{n.type}</span>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  {!n.read && (
                    <button
                      type="button"
                      onClick={() => markRead(n.id)}
                      data-testid={`button-mark-read-${n.id}`}
                      className="text-xs text-orange-600 hover:text-orange-700 font-medium whitespace-nowrap"
                    >
                      Marquer lu
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => remove(n.id)}
                    data-testid={`button-delete-${n.id}`}
                    className="text-xs text-red-600 hover:text-red-700 font-medium whitespace-nowrap"
                  >
                    Supprimer
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <ConfirmModal
        isOpen={confirmDeleteAll}
        onClose={() => setConfirmDeleteAll(false)}
        onConfirm={deleteAll}
        title="Supprimer toutes les notifications ?"
        message="Cette action est irréversible."
        confirmLabel="Tout supprimer"
        cancelLabel="Annuler"
        isDestructive
      />
      <ToastContainer toasts={toast.toasts} onRemove={toast.removeToast} />
    </div>
  );
}
