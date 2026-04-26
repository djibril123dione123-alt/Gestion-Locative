import { useEffect, useRef, useState, useCallback } from 'react';
import { Bell, Check, X as XIcon } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string | null;
  link: string | null;
  read: boolean;
  created_at: string;
}

function formatRelative(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'à l\'instant';
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `il y a ${days}j`;
  return new Date(dateStr).toLocaleDateString('fr-FR');
}

interface Props {
  onNavigate?: (page: string) => void;
}

export function NotificationBell({ onNavigate }: Props) {
  const { user } = useAuth();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    if (!user?.id) return;
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10);
    if (data) {
      setItems(data as NotificationItem[]);
      setUnread((data as NotificationItem[]).filter((n) => !n.read).length);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    load();
    const channel = supabase
      .channel(`notifications-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, load]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const markAllRead = async () => {
    if (!user?.id) return;
    await supabase.from('notifications').update({ read: true }).eq('user_id', user.id).eq('read', false);
    load();
  };

  const markOneRead = async (id: string) => {
    await supabase.from('notifications').update({ read: true }).eq('id', id);
    load();
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        data-testid="button-notifications-toggle"
        className="relative w-full flex items-center gap-3 px-4 py-3 rounded-lg transition hover:bg-slate-700"
        style={{ color: '#B0B0B0' }}
      >
        <Bell className="w-5 h-5" />
        <span className="font-medium text-sm">Notifications</span>
        {unread > 0 && (
          <span
            className="ml-auto inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-bold text-white rounded-full"
            data-testid="badge-notifications-count"
            style={{ backgroundColor: '#F58220' }}
          >
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute bottom-full left-0 mb-2 w-80 max-w-[calc(100vw-2rem)] bg-white rounded-xl shadow-2xl border border-slate-200 z-50 max-h-[70vh] flex flex-col">
          <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
            <h3 className="font-semibold text-slate-900 text-sm">Notifications</h3>
            <div className="flex items-center gap-2">
              {unread > 0 && (
                <button
                  type="button"
                  onClick={markAllRead}
                  data-testid="button-mark-all-read"
                  className="text-xs text-orange-600 hover:text-orange-700 font-medium"
                >
                  Tout marquer comme lu
                </button>
              )}
              <button type="button" onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600">
                <XIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {items.length === 0 ? (
              <div className="p-6 text-center text-sm text-slate-500">Aucune notification</div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {items.map((n) => (
                  <li
                    key={n.id}
                    data-testid={`notification-${n.id}`}
                    className={`px-4 py-3 hover:bg-slate-50 cursor-pointer ${!n.read ? 'bg-orange-50/50' : ''}`}
                    onClick={() => {
                      if (!n.read) markOneRead(n.id);
                      if (n.link && onNavigate) onNavigate(n.link);
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 mt-1">
                        {n.read ? (
                          <Check className="w-4 h-4 text-slate-400" />
                        ) : (
                          <span className="w-2 h-2 rounded-full block" style={{ backgroundColor: '#F58220' }} />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900">{n.title}</p>
                        {n.message && <p className="text-xs text-slate-600 mt-0.5">{n.message}</p>}
                        <p className="text-xs text-slate-400 mt-1">{formatRelative(n.created_at)}</p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {onNavigate && (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onNavigate('notifications');
              }}
              data-testid="button-view-all-notifications"
              className="px-4 py-3 border-t border-slate-200 text-sm text-orange-600 hover:bg-orange-50 font-medium"
            >
              Voir toutes les notifications
            </button>
          )}
        </div>
      )}
    </div>
  );
}
