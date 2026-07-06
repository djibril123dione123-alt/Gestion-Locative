import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  Clock,
  Mail,
  Phone,
  MapPin,
  Hash,
  RefreshCw,
  Filter,
  Loader2,
  ShieldCheck,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { formatSenegalPhone } from '../../lib/formatters';
import { formatDate } from '../../lib/formatters';

type RequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

interface AgencyRequestRow {
  id: string;
  requester_id: string;
  requester_email: string;
  requester_phone: string | null;
  agency_name: string;
  agency_phone: string | null;
  agency_email: string | null;
  agency_address: string | null;
  agency_ninea: string | null;
  agency_devise: string | null;
  is_bailleur_account: boolean;
  status: RequestStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  created_agency_id: string | null;
  created_at: string;
}

const STATUS_BADGE: Record<RequestStatus, { label: string; classes: string; Icon: React.ElementType }> = {
  pending:   { label: 'En attente', classes: 'bg-orange-500/15 text-orange-300 border-orange-500/30', Icon: Clock },
  approved:  { label: 'Approuvée',  classes: 'bg-green-500/15  text-green-300  border-green-500/30',  Icon: CheckCircle2 },
  rejected:  { label: 'Rejetée',    classes: 'bg-red-500/15    text-red-300    border-red-500/30',    Icon: XCircle },
  cancelled: { label: 'Annulée',    classes: 'bg-gray-500/15   text-gray-300   border-gray-500/30',   Icon: XCircle },
};

// Les RPC `approve_agency_request` / `reject_agency_request` sont SECURITY
// DEFINER et utilisent `auth.uid()` côté serveur ; pas besoin de transmettre
// l'identité de l'acteur depuis le front.
export function AgencyRequestsPanel() {
  const [rows, setRows] = useState<AgencyRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<RequestStatus | 'all'>('pending');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const [rejectTarget, setRejectTarget] = useState<AgencyRequestRow | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectBusy, setRejectBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('agency_creation_requests')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) {
        setFeedback({ kind: 'error', text: error.message });
      } else {
        setRows((data as AgencyRequestRow[]) ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // auto-refresh toutes les 30s tant qu'on est sur l'onglet
  useEffect(() => {
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, [load]);

  const visible = useMemo(() => {
    if (filter === 'all') return rows;
    return rows.filter(r => r.status === filter);
  }, [rows, filter]);

  const counts = useMemo(() => {
    const c = { all: rows.length, pending: 0, approved: 0, rejected: 0, cancelled: 0 };
    rows.forEach(r => { c[r.status] += 1; });
    return c;
  }, [rows]);

  const approve = async (req: AgencyRequestRow) => {
    setBusyId(req.id);
    setFeedback(null);
    try {
      const { data, error } = await supabase.rpc('approve_agency_request', { p_request_id: req.id });
      if (error) throw error;
      const result = (data ?? {}) as { agency_id?: string; agency_name?: string; role?: string };
      setFeedback({
        kind: 'success',
        text: `Demande approuvée — ${result.agency_name ?? req.agency_name} (rôle : ${result.role ?? '?'}).`,
      });
      await load();
    } catch (e: unknown) {
      setFeedback({ kind: 'error', text: e instanceof Error ? e.message : 'Erreur d\'approbation' });
    } finally {
      setBusyId(null);
    }
  };

  const openReject = (req: AgencyRequestRow) => {
    setRejectTarget(req);
    setRejectReason('');
  };

  const confirmReject = async () => {
    if (!rejectTarget) return;
    if (!rejectReason.trim()) {
      setFeedback({ kind: 'error', text: 'Veuillez préciser un motif de rejet.' });
      return;
    }
    setRejectBusy(true);
    try {
      const { error } = await supabase.rpc('reject_agency_request', {
        p_request_id: rejectTarget.id,
        p_reason: rejectReason.trim(),
      });
      if (error) throw error;
      setFeedback({ kind: 'success', text: `Demande rejetée pour « ${rejectTarget.agency_name} ».` });
      setRejectTarget(null);
      setRejectReason('');
      await load();
    } catch (e: unknown) {
      setFeedback({ kind: 'error', text: e instanceof Error ? e.message : 'Erreur de rejet' });
    } finally {
      setRejectBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* En-tête + filtres */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2 text-gray-300">
          <ShieldCheck className="h-4 w-4 text-orange-400" />
          <h2 className="text-sm font-semibold">Demandes de création d'agence</h2>
          <span className="text-[0.68rem] text-gray-500">({counts.pending} en attente, {rows.length} total)</span>
        </div>

        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-1 rounded-lg border border-gray-800 bg-gray-900 p-1">
            <Filter className="ml-1.5 mr-0.5 h-3.5 w-3.5 text-gray-500" />
            {(['pending', 'all', 'approved', 'rejected', 'cancelled'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded px-2 py-1 text-[0.68rem] font-bold transition-colors ${
                  filter === f
                    ? 'bg-orange-500/20 text-orange-300'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
                data-testid={`filter-requests-${f}`}
              >
                {f === 'all' ? `Toutes (${counts.all})`
                  : f === 'pending'   ? `En attente (${counts.pending})`
                  : f === 'approved'  ? `Approuvées (${counts.approved})`
                  : f === 'rejected'  ? `Rejetées (${counts.rejected})`
                  : `Annulées (${counts.cancelled})`}
              </button>
            ))}
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-lg bg-gray-800 px-2.5 py-1.5 text-[0.68rem] font-bold text-gray-300 transition-colors hover:bg-gray-700 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </button>
        </div>
      </div>

      {/* Feedback */}
      {feedback && (
        <div className={`rounded-lg border px-3 py-2 text-xs ${
          feedback.kind === 'success'
            ? 'bg-green-500/10 border-green-500/30 text-green-300'
            : 'bg-red-500/10 border-red-500/30 text-red-300'
        }`}>
          {feedback.text}
        </div>
      )}

      {/* Liste */}
      {loading && rows.length === 0 ? (
        <div className="flex items-center justify-center py-12 text-sm text-gray-500">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Chargement…
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-6 text-center text-gray-500">
          <Clock className="mx-auto mb-2 h-8 w-8 text-gray-600" />
          <p className="text-xs">Aucune demande {filter !== 'all' ? STATUS_BADGE[filter].label.toLowerCase() : ''} pour le moment.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {visible.map((req) => {
            const badge = STATUS_BADGE[req.status];
            const Icon = badge.Icon;
            return (
              <div
                key={req.id}
                className="rounded-xl border border-gray-800 bg-gray-900 p-3.5 transition-colors hover:border-gray-700"
                data-testid={`row-request-${req.id}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-[240px] flex-1">
                    <div className="mb-1.5 flex items-center gap-1.5">
                      <h3 className="text-sm font-semibold text-white">{req.agency_name}</h3>
                      <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[0.65rem] font-bold ${badge.classes}`}>
                        <Icon className="h-3 w-3" />{badge.label}
                      </span>
                      {req.is_bailleur_account && (
                        <span className="inline-flex items-center rounded-full border border-blue-500/30 bg-blue-500/15 px-2 py-0.5 text-[0.65rem] font-bold text-blue-300">
                          Bailleur individuel
                        </span>
                      )}
                    </div>
                    <p className="mb-2 text-[0.68rem] text-gray-500">
                      Demande reçue le {formatDate(req.created_at)}
                      {req.reviewed_at && (
                        <>
                          {' '}· Traitée le {formatDate(req.reviewed_at)}
                        </>
                      )}
                    </p>

                    <div className="grid grid-cols-1 gap-1.5 text-xs md:grid-cols-2">
                      <InfoLine icon={Mail}   label="Email"     value={req.requester_email} />
                      {req.requester_phone && <InfoLine icon={Phone}  label="Téléphone" value={formatSenegalPhone(req.requester_phone)} />}
                      {req.agency_address && <InfoLine icon={MapPin} label="Adresse"   value={req.agency_address} />}
                      {req.agency_ninea   && <InfoLine icon={Hash}   label="NINEA"     value={req.agency_ninea} />}
                    </div>

                    {req.status === 'rejected' && req.rejection_reason && (
                      <div className="mt-2 rounded-lg border border-red-500/20 bg-red-500/10 px-2.5 py-1.5 text-xs text-red-300">
                        <span className="font-semibold">Motif :</span> {req.rejection_reason}
                      </div>
                    )}
                  </div>

                  {req.status === 'pending' && (
                    <div className="flex min-w-[150px] flex-col gap-1.5">
                      <button
                        onClick={() => approve(req)}
                        disabled={busyId === req.id}
                        className="flex items-center justify-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-green-500 disabled:opacity-60"
                        data-testid={`button-approve-${req.id}`}
                      >
                        {busyId === req.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                        Approuver
                      </button>
                      <button
                        onClick={() => openReject(req)}
                        disabled={busyId === req.id}
                        className="flex items-center justify-center gap-1.5 rounded-lg bg-gray-800 px-3 py-1.5 text-xs font-bold text-gray-300 transition-colors hover:bg-red-900/40 hover:text-red-300 disabled:opacity-60"
                        data-testid={`button-reject-${req.id}`}
                      >
                        <XCircle className="h-3.5 w-3.5" />Rejeter
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modale de rejet (motif obligatoire) */}
      {rejectTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-xl border border-gray-800 bg-gray-900 shadow-2xl">
            <div className="flex items-center gap-2.5 border-b border-gray-800 px-4 py-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-red-500/30 bg-red-500/15">
                <XCircle className="h-4 w-4 text-red-400" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Rejeter cette demande</h3>
                <p className="text-xs text-gray-500">« {rejectTarget.agency_name} »</p>
              </div>
            </div>
            <div className="space-y-3 px-4 py-3">
              <p className="text-xs leading-5 text-gray-300">
                Le motif sera visible par le demandeur. Soyez explicite et professionnel.
              </p>
              <div>
                <label className="mb-1 block text-[0.68rem] font-bold text-gray-400">Motif du rejet *</label>
                <textarea
                  autoFocus
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  disabled={rejectBusy}
                  rows={3}
                  maxLength={500}
                  placeholder="Ex : NINEA invalide, agence en doublon, dossier incomplet…"
                  className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-xs text-white focus:border-orange-500 focus:ring-1 focus:ring-orange-500 disabled:opacity-50"
                  data-testid="textarea-reject-reason"
                />
                <p className="mt-1 text-[10px] text-gray-500 text-right">{rejectReason.length}/500</p>
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-gray-800 px-4 py-3">
              <button
                type="button"
                disabled={rejectBusy}
                onClick={() => { setRejectTarget(null); setRejectReason(''); }}
                className="rounded-lg bg-gray-800 px-3 py-2 text-xs font-bold text-gray-300 transition-colors hover:bg-gray-700 disabled:opacity-60"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={rejectBusy || !rejectReason.trim()}
                onClick={confirmReject}
                className="flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-red-500 disabled:opacity-60"
                data-testid="button-confirm-reject"
              >
                {rejectBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
                Confirmer le rejet
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoLine({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-start gap-1.5 text-gray-300">
      <Icon className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-gray-500" />
      <span className="text-gray-500">{label} :</span>
      <span className="text-gray-200 break-all">{value}</span>
    </div>
  );
}
