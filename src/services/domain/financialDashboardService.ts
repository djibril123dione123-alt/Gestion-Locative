import { supabase } from '../../lib/supabase';

/**
 * Financial Dashboard Service
 * 
 * Handles all financial calculations, exports, and DGID compliance
 * for Samay Këur SaaS
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface FinancialKPIs {
  mrr: number; // Monthly Recurring Revenue
  arr: number; // Annual Recurring Revenue
  monthlyCommissions: number;
  commissionRate: number; // %
  occupancyRate: number; // %
  churnRate: number; // %
  collectionRate: number; // %
  averagePaymentValue: number;
}

export interface BailleurRevenue {
  bailleursId: string;
  bailleurNom: string;
  revenus: number;
  commissions: number;
  impaye: number;
  tauxRecouvrement: number; // %
}

export interface MonthlyLedger {
  month: string; // YYYY-MM
  loyersPerceives: number;
  commissionsAgence: number;
  commissionsBailleurs: number;
  impayesMois: number;
  nbContrats: number;
}

export interface CommissionBreakdown {
  category: string; // Building name
  montant: number;
  percentage: number; // %
}

export interface CertifiedLedgerRow {
  lineNumber: number;
  dateOperation: Date;
  typeOperation: 'PAIEMENT' | 'DEPENSE';
  description: string;
  montantDebit: number;
  montantCredit: number;
  soldeCourant: number;
  hashSha256: string;
  signatureNumerique: string;
}

export interface LedgerValidation {
  isValid: boolean;
  totalCredits: number;
  totalDebits: number;
  anomalies: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Financial KPIs
// ─────────────────────────────────────────────────────────────────────────────

export async function getFinancialKPIs(agencyId: string): Promise<FinancialKPIs | null> {
  try {
    const { data, error } = await supabase.rpc('get_financial_kpis', {
      p_agency_id: agencyId,
    });

    if (error) throw error;
    if (!data || data.length === 0) return null;

    const kpi = data[0] as Record<string, unknown>;
    return {
      mrr: Number(kpi.mrr ?? 0),
      arr: Number(kpi.arr ?? 0),
      monthlyCommissions: Number(kpi.monthly_commissions ?? 0),
      commissionRate: Number(kpi.commission_rate ?? 0),
      occupancyRate: Number(kpi.occupancy_rate ?? 0),
      churnRate: Number(kpi.churn_rate ?? 0),
      collectionRate: Number(kpi.collection_rate ?? 0),
      averagePaymentValue: Number(kpi.average_payment_value ?? 0),
    };
  } catch (err: unknown) {
    console.error('Error fetching financial KPIs:', err);
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Baileur Revenue Breakdown
// ─────────────────────────────────────────────────────────────────────────────

export async function getBailleurRevenueBreakdown(
  agencyId: string
): Promise<BailleurRevenue[]> {
  try {
    const { data, error } = await supabase.rpc(
      'get_baileur_revenue_breakdown',
      { p_agency_id: agencyId }
    );

    if (error) throw error;
    if (!data) return [];

    return (data as Record<string, unknown>[]).map((row) => ({
      bailleursId: String(row.bailleur_id ?? ''),
      bailleurNom: String(row.bailleur_nom ?? ''),
      revenus: Number(row.revenus ?? 0),
      commissions: Number(row.commissions ?? 0),
      impaye: Number(row.impaye ?? 0),
      tauxRecouvrement: Number(row.taux_recouvrement ?? 0),
    }));
  } catch (err: unknown) {
    console.error('Error fetching baileur revenue breakdown:', err);
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Monthly Ledger
// ─────────────────────────────────────────────────────────────────────────────

export async function getMonthlyLedger(
  agencyId: string,
  year: number
): Promise<MonthlyLedger[]> {
  try {
    const { data, error } = await supabase.rpc('get_monthly_ledger', {
      p_agency_id: agencyId,
      p_year: year,
    });

    if (error) throw error;
    if (!data) return [];

    return (data as Record<string, unknown>[]).map((row) => ({
      month: String(row.month ?? ''),
      loyersPerceives: Number(row.loyers_perceives ?? 0),
      commissionsAgence: Number(row.commissions_agence ?? 0),
      commissionsBailleurs: Number(row.commissions_bailleurs ?? 0),
      impayesMois: Number(row.impayes_mois ?? 0),
      nbContrats: Number(row.nb_contrats ?? 0),
    }));
  } catch (err: unknown) {
    console.error('Error fetching monthly ledger:', err);
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Commission Breakdown
// ─────────────────────────────────────────────────────────────────────────────

export async function getCommissionBreakdown(
  agencyId: string,
  yearMonth: string // Format: YYYY-MM
): Promise<CommissionBreakdown[]> {
  try {
    const { data, error } = await supabase.rpc('get_commission_breakdown', {
      p_agency_id: agencyId,
      p_year_month: yearMonth,
    });

    if (error) throw error;
    if (!data) return [];

    return (data as Record<string, unknown>[]).map((row) => ({
      category: String(row.category ?? ''),
      montant: Number(row.montant ?? 0),
      percentage: Number(row.percentage ?? 0),
    }));
  } catch (err: unknown) {
    console.error('Error fetching commission breakdown:', err);
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Certified Ledger Export (SHA-256 signed)
// ─────────────────────────────────────────────────────────────────────────────

export async function exportCertifiedLedger(
  agencyId: string,
  yearMonth: string // Format: YYYY-MM
): Promise<CertifiedLedgerRow[]> {
  try {
    const { data, error } = await supabase.rpc('export_certified_ledger', {
      p_agency_id: agencyId,
      p_year_month: yearMonth,
    });

    if (error) throw error;
    if (!data) return [];

    return (data as Record<string, unknown>[]).map((row) => ({
      lineNumber: Number(row.line_number ?? 0),
      dateOperation: new Date(String(row.date_operation ?? '')),
      typeOperation: String(row.type_operation ?? '') as 'PAIEMENT' | 'DEPENSE',
      description: String(row.description ?? ''),
      montantDebit: Number(row.montant_debit ?? 0),
      montantCredit: Number(row.montant_credit ?? 0),
      soldeCourant: Number(row.solde_courant ?? 0),
      hashSha256: String(row.hash_sha256 ?? ''),
      signatureNumerique: String(row.signature_numerique ?? ''),
    }));
  } catch (err: unknown) {
    console.error('Error exporting certified ledger:', err);
    throw err;
  }
}

/**
 * Convert certified ledger to CSV format
 * Format: compliant with Senegal DGID requirements
 */
export function convertLedgerToCSV(ledger: CertifiedLedgerRow[]): string {
  const headers = [
    'Numéro ligne',
    'Date opération',
    'Type opération',
    'Description',
    'Montant débit (XOF)',
    'Montant crédit (XOF)',
    'Solde courant (XOF)',
    'Hash SHA-256',
    'Signature numérique',
  ];

  const rows = ledger.map((row) => [
    row.lineNumber,
    row.dateOperation.toISOString().split('T')[0],
    row.typeOperation,
    `"${row.description}"`, // Escape descriptions with commas
    row.montantDebit.toFixed(0),
    row.montantCredit.toFixed(0),
    row.soldeCourant.toFixed(0),
    row.hashSha256,
    row.signatureNumerique,
  ]);

  const csvContent = [headers, ...rows.map((r) => r.join(','))].join('\n');
  return csvContent;
}

/**
 * Upload certified ledger to Supabase Storage
 * Archived for 10 years per Senegal tax law
 */
export async function uploadCertifiedLedger(
  agencyId: string,
  yearMonth: string,
  csvContent: string
): Promise<string | null> {
  try {
    const fileName = `ledger/${yearMonth}/livre-comptes-${yearMonth}-CERTIFIE.csv`;

    const { error } = await supabase.storage
      .from('agency-exports')
      .upload(fileName, new Blob([csvContent], { type: 'text/csv' }), {
        cacheControl: '0', // Don't cache
        upsert: true,
        metadata: {
          agency_id: agencyId,
          year_month: yearMonth,
          certified: 'true',
          created_at: new Date().toISOString(),
        },
      });

    if (error) throw error;

    // Generate signed URL (expires in 10 years)
    const { data: signedUrl } = await supabase.storage
      .from('agency-exports')
      .createSignedUrl(fileName, 60 * 60 * 24 * 365 * 10); // 10 years in seconds

    return signedUrl?.signedUrl ?? null;
  } catch (err: unknown) {
    console.error('Error uploading certified ledger:', err);
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Ledger Integrity Validation
// ─────────────────────────────────────────────────────────────────────────────

export async function validateLedgerIntegrity(
  agencyId: string,
  yearMonth: string
): Promise<LedgerValidation | null> {
  try {
    const { data, error } = await supabase.rpc('validate_ledger_integrity', {
      p_agency_id: agencyId,
      p_year_month: yearMonth,
    });

    if (error) throw error;
    if (!data || data.length === 0) return null;

    const validation = data[0] as Record<string, unknown>;
    return {
      isValid: Boolean(validation.is_valid ?? false),
      totalCredits: Number(validation.total_credits ?? 0),
      totalDebits: Number(validation.total_debits ?? 0),
      anomalies: (validation.anomalies as string[]) ?? [],
    };
  } catch (err: unknown) {
    console.error('Error validating ledger integrity:', err);
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Senegal-compliant Receipt Generation
// ─────────────────────────────────────────────────────────────────────────────

export interface SenesegalReceipt {
  numero: string; // Format: QIT-YYYYMM-{id}{rand}
  dateEmission: Date;
  bailleur: string;
  locataire: string;
  montant: number;
  montantTVA: number;
  commissionAgence: number;
  periodePaiement: string;
  signature: string;
}

/**
 * Generate Senegal-compliant receipt number
 * Format: QIT-YYYYMM-{id}{3-digit-random}
 */
export function generateSenegalCompliantReceiptNumber(
  paymentId: string,
  yearMonth: string
): string {
  const randomSuffix = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, '0');
  return `QIT-${yearMonth}-${paymentId.slice(0, 8).toUpperCase()}${randomSuffix}`;
}

/**
 * Calculate TVA (VAT) for Senegal
 * Standard rate: 18% (applies to services like property management)
 */
export function calculateSenegalVAT(
  baseAmount: number,
  rate: number = 0.18
): number {
  return baseAmount * rate;
}

/**
 * Generate receipt PDF with all Senegal compliance requirements
 */
export async function generateSenesegalCompliantReceipt(
  receipt: SenesegalReceipt
): Promise<Blob> {
  // This would integrate with jsPDF library
  // For now, returning a placeholder implementation
  const pdfContent = `
    QUITTANCE DE LOYER - SENEGAL
    
    Numéro: ${receipt.numero}
    Date: ${receipt.dateEmission.toLocaleDateString('fr-SN')}
    
    Bailleur: ${receipt.bailleur}
    Locataire: ${receipt.locataire}
    
    Montant principal: ${receipt.montant.toFixed(0)} XOF
    TVA (18%): ${receipt.montantTVA.toFixed(0)} XOF
    Commission agence: ${receipt.commissionAgence.toFixed(0)} XOF
    
    Période: ${receipt.periodePaiement}
    
    Signature: ${receipt.signature}
    
    Certifié par Samay Këur
    ${new Date().toISOString()}
  `;

  return new Blob([pdfContent], { type: 'application/pdf' });
}

// ─────────────────────────────────────────────────────────────────────────────
// Error Handling
// ─────────────────────────────────────────────────────────────────────────────

export class FinancialError extends Error {
  constructor(
    message: string,
    public code: string = 'FINANCIAL_ERROR'
  ) {
    super(message);
    this.name = 'FinancialError';
  }
}

export function formatFinancialError(error: unknown): string {
  if (error instanceof FinancialError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Une erreur financière est survenue';
}
