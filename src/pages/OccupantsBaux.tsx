/**
 * OccupantsBaux — vue unifiée Occupants & Baux (Phase 2).
 *
 * Fusionne la lecture Locataires + Contrats en une ligne par bail actif.
 * Ne remplace pas les pages existantes Locataires et Contrats.
 *
 * Colonnes : Occupant · Téléphone · Bien / Unité · Référence · Loyer · Statut · Actions
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Building2,
  CalendarDays,
  ChevronRight,
  FileText,
  Phone,
  RefreshCw,
  Search,
  Users,
} from 'lucide-react';

import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/useToast';
import { ToastContainer } from '../components/ui/Toast';
import { PageSkeleton } from '../components/ui/Skeleton';
import { OfflineDataNotice } from '../components/ui/OfflineDataNotice';

import {
  occupantsBauxRepository,
  type ContratStatut,
  type OccupantBailRow,
} from '../repositories/occupantsBauxRepository';
import { readWithCache, invalidateOperationalCaches, notifyDataChanged } from '../services/offlineReadCache';
import { formatCurrency, formatDate, formatSenegalPhone } from '../lib/formatters';

// ─── Types locaux ────────────────────────────────────────────────────────────

type FilterTab = 'tous' | ContratStatut;

interface TabDef {
  id: FilterTab;
  label: string;
  color: string;
}

const TABS: TabDef[] = [
  { id: 'tous', label: 'Tous', color: 'text-slate-700 bg-slate-100' },
  { id: 'actif', label: 'Actifs', color: 'text-emerald-700 bg-emerald-50' },
  { id: 'expire', label: 'Expirés', color: 'text-amber-700 bg-amber-50' },
  { id: 'resilie', label: 'Résiliés', color: 'text-red-700 bg-red-50' },
];

const STATUT_BADGE: Record<ContratStatut, { label: string; cls: string }> = {
  actif: { label: 'Actif', cls: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' },
  expire: { label: 'Expiré', cls: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200' },
  resilie: { label: 'Résilié', cls: 'bg-red-50 text-red-700 ring-1 ring-red-200' },
  archive: { label: 'Archivé', cls: 'bg-slate-100 text-slate-500 ring-1 ring-slate-200' },
  en_attente: { label: 'En attente', cls: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200' },
};

const ITEMS_PER_PAGE = 15;
const CACHE_KEY = 'occupants-baux-page';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fullName(row: OccupantBailRow): string {
  return `${row.prenom} ${row.nom}`.trim();
}

// ─── Composant principal ──────────────────────────────────────────────────────

export function OccupantsBaux() {
  const { profile } = useAuth();
  const { success: notifySuccess, error: notifyError, toasts, removeToast } = useToast();

  const [rows, setRows] = useState<OccupantBailRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [cacheTimestamp, setCacheTimestamp] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<FilterTab>('tous');
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);

  // ── Chargement ────────────────────────────────────────────────────────────

  const loadData = useCallback(
    async (force = false) => {
      if (!profile?.agency_id) return;
      const agencyId = profile.agency_id;
      if (rows.length === 0) setLoading(true);
      try {
        const result = await readWithCache<OccupantBailRow[]>(
          { agencyId, userId: profile.id },
          CACHE_KEY,
          async () => {
            const { data, error } = await occupantsBauxRepository.list(agencyId);
            if (error) throw error;
            return data;
          },
          { timeoutMs: 8_000 }
        );
        if (force) {
          // Cache déjà invalidé avant l'appel
        }
        setRows(result.data);
        setCacheTimestamp(result.source === 'cache' ? result.timestamp : null);
      } catch (err) {
        console.error('[OccupantsBaux] load failed', err);
        notifyError('Données indisponibles hors connexion sans cache local.');
      } finally {
        setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [profile?.agency_id, profile?.id]
  );

  const handleRefresh = useCallback(async () => {
    if (!profile?.agency_id || !profile?.id) return;
    await invalidateOperationalCaches(
      { agencyId: profile.agency_id, userId: profile.id },
      ['locataires', 'contrats']
    );
    notifyDataChanged(['locataires', 'contrats']);
    await loadData(true);
    notifySuccess('Données actualisées');
  }, [loadData, notifySuccess, profile?.agency_id, profile?.id]);

  useEffect(() => {
    if (profile?.agency_id) loadData();
  }, [loadData, profile?.agency_id]);

  // ── Filtrage / recherche ──────────────────────────────────────────────────

  const filtered = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    return rows.filter((r) => {
      const matchTab = activeTab === 'tous' || r.statut === activeTab;
      if (!matchTab) return false;
      if (!term) return true;
      const haystack = [
        fullName(r),
        r.telephone ?? '',
        r.unite_nom,
        r.immeuble_nom ?? '',
        r.contrat_ref,
        r.destination,
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [rows, activeTab, searchTerm]);

  useEffect(() => {
    setPage(1);
  }, [searchTerm, activeTab]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  // ── Compteurs par statut ──────────────────────────────────────────────────

  const counts = useMemo(() => {
    const map: Record<string, number> = { tous: rows.length };
    for (const r of rows) {
      map[r.statut] = (map[r.statut] ?? 0) + 1;
    }
    return map;
  }, [rows]);

  // ─── Skeleton ─────────────────────────────────────────────────────────────

  if (loading) return <PageSkeleton title="Occupants & Baux" variant="table" />;

  // ─── Rendu ────────────────────────────────────────────────────────────────

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Notice hors-ligne */}
      <OfflineDataNotice
        cachedAt={cacheTimestamp}
        onRetry={() => void loadData()}
        message="Les données affichées viennent du dernier chargement réussi."
      />

      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 mb-1">
            Occupants & Baux
          </h1>
          <p className="text-slate-500 text-sm">
            Vue unifiée occupant → bail → unité ·{' '}
            <span className="font-semibold text-emerald-700">{rows.length}</span> bail
            {rows.length !== 1 ? 'x' : ''} actif{rows.length !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={() => void handleRefresh()}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 text-slate-600 bg-white hover:bg-slate-50 text-sm font-semibold transition shadow-sm"
            title="Actualiser"
          >
            <RefreshCw className="w-4 h-4" />
            <span className="hidden sm:inline">Actualiser</span>
          </button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`group flex flex-col items-start gap-1 rounded-2xl border px-4 py-3 text-left transition-all duration-200 shadow-sm
              ${activeTab === tab.id
                ? 'border-emerald-300 bg-emerald-50 ring-2 ring-emerald-300/40 shadow-emerald-100'
                : 'border-slate-200 bg-white hover:border-emerald-200 hover:bg-emerald-50/50'
              }`}
          >
            <span className={`text-2xl font-black ${activeTab === tab.id ? 'text-emerald-700' : 'text-slate-800'}`}>
              {counts[tab.id] ?? 0}
            </span>
            <span className={`text-xs font-bold uppercase tracking-wide ${activeTab === tab.id ? 'text-emerald-600' : 'text-slate-500'}`}>
              {tab.label}
            </span>
          </button>
        ))}
      </div>

      {/* Tableau principal */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Barre de recherche */}
        <div className="px-4 sm:px-6 py-4 border-b border-slate-100">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Rechercher occupant, bien, référence…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent transition"
            />
          </div>
          {searchTerm && (
            <p className="mt-2 text-xs text-slate-500">
              {filtered.length} résultat{filtered.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>

        {/* Table desktop / Cards mobile */}
        {paginated.length === 0 ? (
          <EmptyState
            hasSearch={!!searchTerm || activeTab !== 'tous'}
            onReset={() => { setSearchTerm(''); setActiveTab('tous'); }}
          />
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="text-left px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">
                      <span className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> Occupant</span>
                    </th>
                    <th className="text-left px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">
                      <span className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" /> Téléphone</span>
                    </th>
                    <th className="text-left px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">
                      <span className="flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5" /> Bien / Unité</span>
                    </th>
                    <th className="text-left px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">
                      <span className="flex items-center gap-1.5"><FileText className="w-3.5 h-3.5" /> Référence</span>
                    </th>
                    <th className="text-right px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">Loyer</th>
                    <th className="text-left px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">
                      <span className="flex items-center gap-1.5"><CalendarDays className="w-3.5 h-3.5" /> Période</span>
                    </th>
                    <th className="text-center px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {paginated.map((row) => (
                    <DesktopRow key={row.contrat_id} row={row} />
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-slate-100">
              {paginated.map((row) => (
                <MobileCard key={row.contrat_id} row={row} />
              ))}
            </div>
          </>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-5 py-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs text-slate-500">
              Page {page} / {totalPages} · {filtered.length} résultat{filtered.length !== 1 ? 's' : ''}
            </p>
            <div className="flex items-center gap-1">
              <PaginationButton onClick={() => setPage(1)} disabled={page === 1} label="«" />
              <PaginationButton onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} label="‹" />
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const start = Math.max(1, Math.min(page - 2, totalPages - 4));
                const p = start + i;
                if (p > totalPages) return null;
                return (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`w-8 h-8 text-xs rounded-lg border font-semibold transition ${
                      p === page
                        ? 'bg-emerald-700 border-emerald-700 text-white'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {p}
                  </button>
                );
              })}
              <PaginationButton onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} label="›" />
              <PaginationButton onClick={() => setPage(totalPages)} disabled={page === totalPages} label="»" />
            </div>
          </div>
        )}
      </div>

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}

// ─── Sous-composants ──────────────────────────────────────────────────────────

function StatutBadge({ statut }: { statut: ContratStatut }) {
  const { label, cls } = STATUT_BADGE[statut] ?? STATUT_BADGE.en_attente;
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${cls}`}>
      {label}
    </span>
  );
}

function DesktopRow({ row }: { row: OccupantBailRow }) {
  return (
    <tr className="group hover:bg-slate-50/70 transition-colors">
      {/* Occupant */}
      <td className="px-5 py-3.5">
        <p className="font-semibold text-slate-900">{fullName(row)}</p>
        {row.email && <p className="text-xs text-slate-400 mt-0.5 truncate max-w-[160px]">{row.email}</p>}
      </td>
      {/* Téléphone */}
      <td className="px-5 py-3.5">
        {row.telephone ? (
          <a
            href={`tel:${row.telephone}`}
            className="text-emerald-700 font-medium hover:underline"
          >
            {formatSenegalPhone(row.telephone)}
          </a>
        ) : (
          <span className="text-slate-400">—</span>
        )}
      </td>
      {/* Bien / Unité */}
      <td className="px-5 py-3.5">
        <p className="font-medium text-slate-800">{row.immeuble_nom ?? '—'}</p>
        <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
          <ChevronRight className="w-3 h-3 text-slate-300" />
          {row.unite_nom}
        </p>
      </td>
      {/* Référence */}
      <td className="px-5 py-3.5">
        <span className="font-mono text-xs bg-slate-100 text-slate-600 rounded px-1.5 py-0.5">
          {row.contrat_ref}
        </span>
      </td>
      {/* Loyer */}
      <td className="px-5 py-3.5 text-right">
        <span className="font-bold text-slate-900">{formatCurrency(row.loyer_mensuel)}</span>
        <span className="text-xs text-slate-400 ml-1">/mois</span>
      </td>
      {/* Période */}
      <td className="px-5 py-3.5">
        <p className="text-xs text-slate-600">
          {formatDate(row.date_debut)}
          {row.date_fin && <> → {formatDate(row.date_fin)}</>}
          {!row.date_fin && <span className="text-slate-400"> → ouvert</span>}
        </p>
      </td>
      {/* Statut */}
      <td className="px-5 py-3.5 text-center">
        <StatutBadge statut={row.statut} />
      </td>
    </tr>
  );
}

function MobileCard({ row }: { row: OccupantBailRow }) {
  return (
    <div className="px-4 py-4 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-bold text-slate-900 truncate">{fullName(row)}</p>
          {row.telephone && (
            <a href={`tel:${row.telephone}`} className="text-sm text-emerald-700 font-medium">
              {formatSenegalPhone(row.telephone)}
            </a>
          )}
        </div>
        <StatutBadge statut={row.statut} />
      </div>
      <div className="flex items-center gap-1.5 text-sm text-slate-600">
        <Building2 className="w-4 h-4 text-slate-400 flex-shrink-0" />
        <span>{row.immeuble_nom ?? '—'}</span>
        <ChevronRight className="w-3 h-3 text-slate-300" />
        <span className="font-medium">{row.unite_nom}</span>
      </div>
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">{row.contrat_ref}</span>
        <span className="font-bold text-slate-800">{formatCurrency(row.loyer_mensuel)}<span className="font-normal text-slate-400">/mois</span></span>
      </div>
      <p className="text-xs text-slate-500">
        {formatDate(row.date_debut)}
        {row.date_fin ? ` → ${formatDate(row.date_fin)}` : ' → ouvert'}
      </p>
    </div>
  );
}

function EmptyState({
  hasSearch,
  onReset,
}: {
  hasSearch: boolean;
  onReset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
      <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center mb-4 shadow-inner">
        <FileText className="w-8 h-8 text-emerald-400" />
      </div>
      <h3 className="text-lg font-bold text-slate-800 mb-1">
        {hasSearch ? 'Aucun résultat' : 'Aucun bail enregistré'}
      </h3>
      <p className="text-sm text-slate-500 max-w-xs mb-4">
        {hasSearch
          ? 'Aucun bail ne correspond à vos critères. Essayez de modifier la recherche ou le filtre.'
          : 'Les baux créés dans la section Contrats apparaîtront ici.'}
      </p>
      {hasSearch && (
        <button
          type="button"
          onClick={onReset}
          className="px-4 py-2 text-sm font-semibold text-emerald-700 bg-emerald-50 rounded-xl hover:bg-emerald-100 transition"
        >
          Réinitialiser les filtres
        </button>
      )}
    </div>
  );
}

function PaginationButton({
  onClick,
  disabled,
  label,
}: {
  onClick: () => void;
  disabled: boolean;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-8 h-8 text-xs rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
    >
      {label}
    </button>
  );
}
