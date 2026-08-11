import { supabase } from '../../lib/supabase';

export type RentalDueStatus =
  | 'DRAFT'
  | 'SCHEDULED'
  | 'TO_ISSUE'
  | 'ISSUED'
  | 'PARTIALLY_PAID'
  | 'PAID'
  | 'OVERDUE'
  | 'CANCELLED';

export type RentalDueDocumentType =
  | 'due_notice'
  | 'rent_invoice'
  | 'partial_payment_receipt'
  | 'rent_receipt'
  | 'credit_note';

export interface RentalDue {
  id: string;
  agency_id: string;
  contract_id: string;
  tenant_id: string;
  unit_id: string;
  landlord_id: string | null;
  period_start: string;
  period_end: string;
  due_date: string;
  status: RentalDueStatus;
  currency: string;
  amount_ht: number;
  tax_amount: number;
  amount_ttc: number;
  allocated_amount: number;
  outstanding_amount: number;
  prior_balance: number;
  credit_applied: number;
  reference: string | null;
  version: number;
  source: 'generated' | 'backfill' | 'manual' | 'correction';
  issuer_snapshot: Record<string, unknown>;
  parties_snapshot: Record<string, unknown>;
  legal_snapshot: Record<string, unknown>;
  fiscal_snapshot: Record<string, unknown>;
  contract_snapshot: Record<string, unknown>;
  issued_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface RentalDueLine {
  id: string;
  due_id: string;
  line_type: 'rent' | 'recoverable_charge' | 'service' | 'penalty' | 'discount' | 'adjustment' | 'other';
  label: string;
  description: string | null;
  quantity: number;
  unit_amount: number;
  price_input_mode: 'ht' | 'ttc';
  tax_treatment: 'unknown' | 'outside_scope' | 'exempt' | 'taxable';
  tax_rate: number;
  amount_ht: number;
  tax_amount: number;
  amount_ttc: number;
  display_order: number;
}

export interface RentalDueAllocation {
  id: string;
  payment_id: string;
  due_id: string;
  allocation_type: 'allocation' | 'reversal';
  amount: number;
  strategy: 'oldest_first' | 'current_period' | 'manual' | 'legacy_month' | 'credit';
  allocated_at: string;
}

export interface RentalDueDocument {
  id: string;
  due_id: string;
  document_type: RentalDueDocumentType;
  status: 'draft' | 'issued' | 'archived' | 'cancelled' | 'failed';
  reference: string | null;
  version: number;
  document_registry_id: string | null;
  data_snapshot: Record<string, unknown>;
  renderer_version: string;
  issued_at: string | null;
  created_at: string;
}

export interface RentalDueEvent {
  id: number;
  due_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  occurred_at: string;
}

export interface RentalDueDelivery {
  id: string;
  due_id: string;
  document_id: string;
  channel: 'download' | 'manual' | string;
  recipient: string | null;
  status: string;
  sent_at: string | null;
  created_at: string;
}

export interface RentalDueReminder {
  id: string;
  due_id: string;
  reminder_type: 'due' | 'overdue' | 'final' | string;
  scheduled_for: string;
  status: string;
  sent_at: string | null;
  created_at: string;
}

export interface RentalDueGenerationPreviewItem {
  contract_id: string;
  tenant_name: string;
  property_name: string;
  unit_name: string;
  rent_amount: number;
  due_day: number;
  readiness: 'ready' | 'warning' | 'blocked';
  issues: Record<string, string>;
  existing_due_id: string | null;
  existing_due_status: RentalDueStatus | null;
  existing_due_reference: string | null;
}

export interface RentalDueGenerationPreview {
  agency_id: string;
  period_start: string;
  period_end: string;
  candidate_count: number;
  ready_count: number;
  warning_count: number;
  blocked_count: number;
  existing_count: number;
  items: RentalDueGenerationPreviewItem[];
}

export interface RentalDueBulkResult {
  reused: boolean;
  run: {
    id: string;
    status: string;
    generated_count: number;
    reused_count: number;
    failed_count: number;
    errors: Array<Record<string, unknown>>;
  };
}

export interface ContractRentalDueSummaryItem {
  id: string;
  period_start: string;
  period_end: string;
  due_date: string;
  status: RentalDueStatus;
  currency: string;
  amount_ttc: number;
  allocated_amount: number;
  outstanding_amount: number;
  reference: string | null;
  issued_at: string | null;
  document_count: number;
  reminder_count: number;
}

export interface RentalDueDashboardSummary {
  as_of: string;
  currency: 'XOF' | string;
  due_count: number;
  total_billed: number;
  total_collected: number;
  total_outstanding: number;
  overdue_count: number;
  overdue_amount: number;
  paid_count: number;
  partial_count: number;
}

export interface OwnerRentalDueSummaryLine {
  due_id: string;
  contract_id: string;
  unit_id: string;
  tenant_id: string;
  period_start: string;
  period_end: string;
  due_date: string;
  status: RentalDueStatus;
  reference: string | null;
  amount_ttc: number;
  collected: number;
  outstanding: number;
}

export interface OwnerRentalDueSummary {
  agency_id: string;
  landlord_id: string;
  period: { from: string; to: string };
  currency: 'XOF' | string;
  total_billed: number;
  total_collected: number;
  total_outstanding: number;
  due_count: number;
  lines: OwnerRentalDueSummaryLine[];
}

export interface RentalDueDetail {
  due: RentalDue;
  lines: RentalDueLine[];
  allocations: RentalDueAllocation[];
  documents: RentalDueDocument[];
  deliveries: RentalDueDelivery[];
  reminders: RentalDueReminder[];
  events: RentalDueEvent[];
}

type RentalDueCommand =
  | { command: 'generate'; contract_id: string; period_start: string }
  | { command: 'generate-bulk'; period_start: string }
  | { command: 'preview-bulk'; period_start: string }
  | { command: 'prepare-document'; due_id: string; document_type: RentalDueDocumentType }
  | { command: 'backfill'; from: string; to: string }
  | { command: 'reconcile'; from: string; to: string }
  | { command: 'activate'; from: string; to: string }
  | { command: 'schedule-reminders'; due_id: string }
  | { command: 'cancel'; due_id: string; reason: string }
  | { command: 'record-delivery'; due_id: string; document_id: string; channel: 'download' | 'manual'; recipient?: string };

export class RentalDueApiError extends Error {
  readonly code: string;

  constructor(message: string, code = 'RENTAL_DUE_ERROR') {
    super(message);
    this.name = 'RentalDueApiError';
    this.code = code;
  }
}

const pendingCommands = new Map<string, Promise<unknown>>();

function commandKey(input: RentalDueCommand): string {
  return JSON.stringify(input);
}

async function invokeRentalDueCommand<T>(input: RentalDueCommand): Promise<T> {
  const key = commandKey(input);
  const existing = pendingCommands.get(key);
  if (existing) return existing as Promise<T>;

  const request = (async () => {
    const { data, error } = await supabase.functions.invoke('rental-due-command', { body: input });
    if (error) {
      const context = 'context' in error ? error.context as Response | undefined : undefined;
      const payload = context
        ? await context.clone().json().catch(() => null) as { error?: string; code?: string } | null
        : null;
      throw new RentalDueApiError(
        payload?.error ?? error.message ?? "L'opération sur l'échéance a échoué.",
        payload?.code ?? 'EDGE_FUNCTION_ERROR',
      );
    }

    const payload = data as { data?: T; error?: string; code?: string } | null;
    if (!payload || payload.error || payload.data == null) {
      throw new RentalDueApiError(
        payload?.error ?? "La réponse du moteur d'échéances est incomplète.",
        payload?.code ?? 'INVALID_RESPONSE',
      );
    }
    return payload.data;
  })();

  pendingCommands.set(key, request);
  try {
    return await request;
  } finally {
    pendingCommands.delete(key);
  }
}

export function isCanonicalRentalDueId(value: string | null | undefined): value is string {
  return Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value));
}

export async function getRentalDueDetail(dueId: string): Promise<RentalDueDetail> {
  if (!isCanonicalRentalDueId(dueId)) {
    throw new RentalDueApiError("Cette créance provient de l'historique antérieur au moteur canonique.", 'LEGACY_RECEIVABLE');
  }
  const { data, error } = await supabase.rpc('fn_rental_due_detail', { p_due_id: dueId });
  if (error) throw new RentalDueApiError(error.message, error.code ?? 'DUE_DETAIL_FAILED');
  if (!data || typeof data !== 'object') {
    throw new RentalDueApiError("Le détail de l'échéance est indisponible.", 'EMPTY_DUE_DETAIL');
  }
  const detail = data as unknown as Partial<RentalDueDetail>;
  if (!detail.due) {
    throw new RentalDueApiError("Le détail de l'échéance est incomplet.", 'INVALID_DUE_DETAIL');
  }
  return {
    due: detail.due,
    lines: Array.isArray(detail.lines) ? detail.lines : [],
    allocations: Array.isArray(detail.allocations) ? detail.allocations : [],
    documents: Array.isArray(detail.documents) ? detail.documents : [],
    deliveries: Array.isArray(detail.deliveries) ? detail.deliveries : [],
    reminders: Array.isArray(detail.reminders) ? detail.reminders : [],
    events: Array.isArray(detail.events) ? detail.events : [],
  };
}

export function generateRentalDue(contractId: string, periodStart: string) {
  return invokeRentalDueCommand<RentalDueDetail>({
    command: 'generate',
    contract_id: contractId,
    period_start: periodStart,
  });
}

export function generateRentalDuesBulk(periodStart: string) {
  return invokeRentalDueCommand<RentalDueBulkResult>({
    command: 'generate-bulk',
    period_start: periodStart,
  });
}

export function previewRentalDueGeneration(periodStart: string) {
  return invokeRentalDueCommand<RentalDueGenerationPreview>({
    command: 'preview-bulk',
    period_start: periodStart,
  });
}

export function prepareRentalDueDocument(dueId: string, documentType: RentalDueDocumentType) {
  return invokeRentalDueCommand<{ reused: boolean; document: RentalDueDocument }>({
    command: 'prepare-document',
    due_id: dueId,
    document_type: documentType,
  });
}

export function scheduleRentalDueReminders(dueId: string) {
  return invokeRentalDueCommand<number>({
    command: 'schedule-reminders',
    due_id: dueId,
  });
}

export function cancelRentalDue(dueId: string, reason: string) {
  return invokeRentalDueCommand<RentalDueDetail>({ command: 'cancel', due_id: dueId, reason });
}

export function recordRentalDueDelivery(
  dueId: string,
  documentId: string,
  channel: 'download' | 'manual',
  recipient?: string,
) {
  return invokeRentalDueCommand<RentalDueDelivery>({
    command: 'record-delivery',
    due_id: dueId,
    document_id: documentId,
    channel,
    ...(recipient ? { recipient } : {}),
  });
}

export async function getContractRentalDueSummary(contractId: string): Promise<ContractRentalDueSummaryItem[]> {
  const { data, error } = await supabase.rpc('fn_contract_rental_due_summary', { p_contract_id: contractId });
  if (error) throw new RentalDueApiError(error.message, error.code ?? 'CONTRACT_DUE_SUMMARY_FAILED');
  return Array.isArray(data) ? data as unknown as ContractRentalDueSummaryItem[] : [];
}

export async function getRentalDueDashboardSummary(
  agencyId: string,
  asOf?: string,
): Promise<RentalDueDashboardSummary> {
  const { data, error } = await supabase.rpc('fn_rental_due_dashboard_summary', {
    p_agency_id: agencyId,
    p_as_of: asOf ?? new Date().toISOString().slice(0, 10),
  });
  if (error) throw new RentalDueApiError(error.message, error.code ?? 'DUE_DASHBOARD_SUMMARY_FAILED');
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new RentalDueApiError("La synthèse des échéances est indisponible.", 'EMPTY_DUE_DASHBOARD_SUMMARY');
  }
  return data as unknown as RentalDueDashboardSummary;
}

export async function getOwnerRentalDueSummary(
  agencyId: string,
  landlordId: string,
  from: string,
  to: string,
): Promise<OwnerRentalDueSummary> {
  const { data, error } = await supabase.rpc('fn_owner_rental_due_summary', {
    p_agency_id: agencyId,
    p_landlord_id: landlordId,
    p_from: from,
    p_to: to,
  });
  if (error) throw new RentalDueApiError(error.message, error.code ?? 'OWNER_DUE_SUMMARY_FAILED');
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new RentalDueApiError("La synthèse canonique du bailleur est indisponible.", 'EMPTY_OWNER_DUE_SUMMARY');
  }
  const summary = data as unknown as OwnerRentalDueSummary;
  return { ...summary, lines: Array.isArray(summary.lines) ? summary.lines : [] };
}

export function backfillRentalDues(from: string, to: string) {
  return invokeRentalDueCommand<{
    generated_due_count: number;
    allocated_payment_count: number;
    errors: Array<Record<string, unknown>>;
  }>({ command: 'backfill', from, to });
}

export function reconcileRentalDues(from: string, to: string) {
  return invokeRentalDueCommand<Record<string, unknown>>({ command: 'reconcile', from, to });
}

export function activateRentalDueEngine(from: string, to: string) {
  return invokeRentalDueCommand<Record<string, unknown>>({ command: 'activate', from, to });
}
