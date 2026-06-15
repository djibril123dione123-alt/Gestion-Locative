import type { ContratRow, PaiementRow } from '../../components/paiements/paiementTypes';
import { applyCfaSettlementTolerance } from '../../lib/cfaSettlement';

export interface PaymentMonthOption {
  value: string;
  label: string;
  paidAmount: number;
  remainingAmount: number;
  isPartial: boolean;
  isSold: boolean;
  isFuture: boolean;
}

function monthStart(value: string): Date | null {
  const date = new Date(`${value.slice(0, 7)}-01T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function addMonths(date: Date, count: number) {
  return new Date(date.getFullYear(), date.getMonth() + count, 1);
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function getPaidAmountForMonth(
  paiements: PaiementRow[],
  contratId: string,
  month: string,
  excludePaymentId?: string | null,
) {
  return paiements
    .filter((paiement) => {
      if (paiement.id === excludePaymentId) return false;
      if (paiement.contrat_id !== contratId) return false;
      if ((paiement.mois_concerne || '').slice(0, 7) !== month) return false;
      if (paiement.deleted_at) return false;
      return paiement.statut === 'paye' || paiement.statut === 'partiel';
    })
    .reduce((sum, paiement) => sum + Number(paiement.montant_total || 0), 0);
}

export function buildPaymentMonthOptions(
  contrat: ContratRow | undefined,
  paiements: PaiementRow[],
  options: { monthsAhead?: number; excludePaymentId?: string | null; selectedMonth?: string } = {},
): PaymentMonthOption[] {
  if (!contrat) return [];

  const now = new Date();
  const todayMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const start = monthStart(contrat.date_debut || '') ?? todayMonth;
  const contractEnd = contrat.date_fin ? monthStart(contrat.date_fin) : null;
  const futureEnd = addMonths(todayMonth, options.monthsAhead ?? 12);
  const end = contractEnd && contractEnd < futureEnd ? contractEnd : futureEnd;
  const selectedMonth = options.selectedMonth?.slice(0, 7);
  const loyer = Number(contrat.loyer_mensuel || 0);
  const result: PaymentMonthOption[] = [];

  if (end < start) return result;

  for (let cursor = new Date(start.getFullYear(), start.getMonth(), 1); cursor <= end; cursor = addMonths(cursor, 1)) {
    const value = monthKey(cursor);
    const paidAmount = getPaidAmountForMonth(paiements, contrat.id, value, options.excludePaymentId);
    const remainingAmount = applyCfaSettlementTolerance(Math.max(loyer - paidAmount, 0));
    const isSold = remainingAmount <= 0 && loyer > 0;
    const isSelectedMonth = selectedMonth === value;

    if (isSold && !isSelectedMonth) continue;

    result.push({
      value,
      label: cursor.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
      paidAmount,
      remainingAmount,
      isPartial: paidAmount > 0 && remainingAmount > 0,
      isSold,
      isFuture: cursor > todayMonth,
    });
  }

  return result;
}

export function getPaymentMonthState(
  contrat: ContratRow | undefined,
  paiements: PaiementRow[],
  month: string,
  excludePaymentId?: string | null,
) {
  if (!contrat || !month) return null;
  const paidAmount = getPaidAmountForMonth(paiements, contrat.id, month.slice(0, 7), excludePaymentId);
  const loyer = Number(contrat.loyer_mensuel || 0);
  const remainingAmount = applyCfaSettlementTolerance(Math.max(loyer - paidAmount, 0));
  return {
    paidAmount,
    remainingAmount,
    isSold: remainingAmount <= 0 && loyer > 0,
    isPartial: paidAmount > 0 && remainingAmount > 0,
  };
}
