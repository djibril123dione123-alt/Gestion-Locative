import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CalendarRange, CheckCircle2, Clock3, Loader2, ReceiptText } from 'lucide-react';
import { formatCurrency, formatDate } from '../../lib/formatters';
import {
  getContractRentalDueSummary,
  type ContractRentalDueSummaryItem,
  type RentalDueStatus,
} from '../../services/api/rentalDueApi';

interface ContractRentalDuePanelProps {
  contractId: string;
}

const statusMeta: Record<RentalDueStatus, { label: string; classes: string }> = {
  DRAFT: { label: 'Brouillon', classes: 'border-slate-200 bg-slate-50 text-slate-700' },
  SCHEDULED: { label: 'Planifiée', classes: 'border-blue-200 bg-blue-50 text-blue-800' },
  TO_ISSUE: { label: 'À émettre', classes: 'border-amber-200 bg-amber-50 text-amber-800' },
  ISSUED: { label: 'Émise', classes: 'border-blue-200 bg-blue-50 text-blue-800' },
  PARTIALLY_PAID: { label: 'Partielle', classes: 'border-orange-200 bg-orange-50 text-orange-800' },
  PAID: { label: 'Soldée', classes: 'border-emerald-200 bg-emerald-50 text-emerald-800' },
  OVERDUE: { label: 'En retard', classes: 'border-red-200 bg-red-50 text-red-800' },
  CANCELLED: { label: 'Annulée', classes: 'border-slate-200 bg-slate-100 text-slate-500' },
};

function periodLabel(item: ContractRentalDueSummaryItem) {
  return new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(
    new Date(`${item.period_start.slice(0, 10)}T12:00:00`),
  );
}

export function ContractRentalDuePanel({ contractId }: ContractRentalDuePanelProps) {
  const [items, setItems] = useState<ContractRentalDueSummaryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    void getContractRentalDueSummary(contractId)
      .then((rows) => {
        if (active) setItems(rows);
      })
      .catch((reason) => {
        if (active) setError(reason instanceof Error ? reason.message : 'Les échéances du bail sont indisponibles.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [contractId]);

  const summary = useMemo(() => items.reduce((result, item) => ({
    billed: result.billed + Number(item.amount_ttc || 0),
    paid: result.paid + Number(item.allocated_amount || 0),
    outstanding: result.outstanding + Number(item.outstanding_amount || 0),
    overdue: result.overdue + (item.status === 'OVERDUE' ? 1 : 0),
  }), { billed: 0, paid: 0, outstanding: 0, overdue: 0 }), [items]);

  return (
    <section className="rounded-xl border border-emerald-950/10 bg-white p-2.5 shadow-sm">
      <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
            <CalendarRange className="h-3.5 w-3.5" />
          </span>
          <div>
            <p className="text-[0.48rem] font-black uppercase tracking-[0.13em] text-emerald-700">Chronologie financière</p>
            <h3 className="text-[0.75rem] font-extrabold text-slate-950">Échéances du bail</h3>
          </div>
        </div>
        {!loading && !error && (
          <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[0.48rem] font-black uppercase text-slate-600">
            {items.length} période{items.length > 1 ? 's' : ''}
          </span>
        )}
      </div>

      {loading ? (
        <div className="flex min-h-20 items-center justify-center"><Loader2 className="h-4 w-4 animate-spin text-emerald-700" /></div>
      ) : error ? (
        <div className="mt-2 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2 text-[0.6rem] font-semibold text-amber-950">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{error}
        </div>
      ) : items.length === 0 ? (
        <div className="mt-2 flex items-start gap-2 rounded-lg border border-dashed border-slate-200 bg-slate-50/70 p-2.5">
          <Clock3 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
          <div><p className="text-[0.63rem] font-bold text-slate-800">Aucune échéance émise</p><p className="text-[0.56rem] text-slate-500">La chronologie apparaîtra après activation du moteur d’échéances pour ce bail.</p></div>
        </div>
      ) : (
        <>
          <div className="mt-2 grid grid-cols-3 gap-1.5">
            <div className="rounded-lg border border-slate-200 bg-slate-50/70 px-2 py-1.5"><p className="text-[0.46rem] font-black uppercase tracking-[0.1em] text-slate-400">Émis</p><p className="mt-0.5 truncate text-[0.63rem] font-bold text-slate-800">{formatCurrency(summary.billed)}</p></div>
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 px-2 py-1.5"><p className="text-[0.46rem] font-black uppercase tracking-[0.1em] text-emerald-700">Encaissé</p><p className="mt-0.5 truncate text-[0.63rem] font-bold text-emerald-900">{formatCurrency(summary.paid)}</p></div>
            <div className={`rounded-lg border px-2 py-1.5 ${summary.outstanding > 0 ? 'border-orange-200 bg-orange-50/70' : 'border-emerald-200 bg-emerald-50/70'}`}><p className="text-[0.46rem] font-black uppercase tracking-[0.1em] text-slate-500">Solde</p><p className="mt-0.5 truncate text-[0.63rem] font-bold text-slate-900">{formatCurrency(summary.outstanding)}</p></div>
          </div>
          <div className="mt-2 divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200">
            {items.slice(0, 8).map((item) => {
              const meta = statusMeta[item.status] ?? statusMeta.ISSUED;
              return (
                <div key={item.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-2 py-1.5">
                  <div className="flex min-w-0 items-center gap-2">
                    <ReceiptText className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    <div className="min-w-0"><p className="truncate text-[0.61rem] font-bold capitalize text-slate-900">{periodLabel(item)}</p><p className="truncate text-[0.52rem] text-slate-500">{item.reference || `Échéance du ${formatDate(item.due_date)}`} · {item.document_count} document{item.document_count > 1 ? 's' : ''}</p></div>
                  </div>
                  <div className="text-right"><p className="text-[0.61rem] font-bold text-slate-900">{formatCurrency(item.outstanding_amount)}</p><span className={`inline-flex rounded-full border px-1.5 py-0.5 text-[0.44rem] font-black uppercase ${meta.classes}`}>{meta.label}</span></div>
                </div>
              );
            })}
          </div>
          {summary.overdue > 0 && <p className="mt-2 flex items-start gap-1.5 text-[0.56rem] font-semibold text-red-700"><AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />{summary.overdue} échéance{summary.overdue > 1 ? 's' : ''} en retard sur ce bail.</p>}
          {summary.outstanding === 0 && <p className="mt-2 flex items-start gap-1.5 text-[0.56rem] font-semibold text-emerald-700"><CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0" />Aucun solde restant sur les échéances émises.</p>}
        </>
      )}
    </section>
  );
}
