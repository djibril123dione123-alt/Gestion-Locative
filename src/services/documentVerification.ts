export type VerificationState =
  | 'loading'
  | 'authentic'
  | 'not_found'
  | 'revoked'
  | 'superseded'
  | 'network_error'
  | 'invalid';

export interface VerifiedDocumentDetails {
  reference: string;
  type: string;
  issuer: string;
  issuedAt: string | null;
  amountXof: number | null;
  paymentStatus: string | null;
  period: string | null;
  registeredAt: string | null;
  lastCheckedAt: string;
}

export interface DocumentVerificationResult {
  state: VerificationState;
  details?: VerifiedDocumentDetails;
  message: string;
}

interface PublicVerificationResponse {
  valid: boolean;
  status?: 'authentic' | 'revoked' | 'superseded';
  error?: string;
  document?: {
    reference: string;
    type: string;
    agency: string;
    issued_at: string | null;
    amount_xof?: number | null;
    payment_status?: string | null;
    period?: string | null;
    registered_at?: string | null;
  };
}

interface VerificationRow {
  document_ref: string;
  document_type: string;
  agency_name: string;
  issued_at: string | null;
  amount_xof: number | string | null;
  payment_status: string | null;
  document_status: 'authentic' | 'revoked' | 'superseded';
  metadata?: { period?: string | null; [key: string]: unknown } | null;
  created_at: string | null;
}

export function extractVerificationInput(rawValue: string): { token: string | null; reference: string | null } {
  const value = rawValue.trim();
  if (!value) return { token: null, reference: null };

  const parseParams = (params: URLSearchParams) => ({
    token: params.get('token'),
    reference: params.get('ref') ?? params.get('reference'),
  });

  try {
    const url = new URL(value);
    const hashQuery = url.hash.includes('?') ? url.hash.slice(url.hash.indexOf('?') + 1) : '';
    const fromHash = hashQuery ? parseParams(new URLSearchParams(hashQuery)) : { token: null, reference: null };
    const fromSearch = parseParams(url.searchParams);
    return {
      token: fromHash.token ?? fromSearch.token,
      reference: fromHash.reference ?? fromSearch.reference,
    };
  } catch {
    // Not a URL: continue with plain token/reference detection.
  }

  const hashQuery = value.includes('#') && value.includes('?')
    ? value.slice(value.indexOf('?') + 1)
    : value.includes('?')
      ? value.slice(value.indexOf('?') + 1)
      : '';
  if (hashQuery) {
    const parsed = parseParams(new URLSearchParams(hashQuery));
    if (parsed.token || parsed.reference) return parsed;
  }

  if (/^[a-f0-9]{64}$/i.test(value)) return { token: value, reference: null };
  return { token: null, reference: value };
}

export function getVerificationQueryParams() {
  const hashQuery = window.location.hash.includes('?')
    ? window.location.hash.slice(window.location.hash.indexOf('?') + 1)
    : '';
  const params = new URLSearchParams(hashQuery || window.location.search);
  return {
    token: params.get('token') ?? '',
    ref: params.get('ref') ?? '',
    type: params.get('type') ?? '',
  };
}

export function getDocumentTypeLabel(type?: string | null) {
  const normalized = String(type ?? '').trim().toLowerCase();
  const labels: Record<string, string> = {
    quittance: 'Quittance',
    facture: 'Facture',
    contrat: 'Contrat de location',
    mandat: 'Mandat de gérance',
    rapport: 'Rapport bailleur',
    rapport_bailleur: 'Rapport bailleur',
    export: 'Export',
    document: 'Document',
  };
  return labels[normalized] ?? (normalized ? normalized.replace(/_/g, ' ') : 'Document');
}

export function getPaymentStatusLabel(status?: string | null) {
  const normalized = String(status ?? '').trim().toLowerCase();
  if (!normalized) return null;
  const labels: Record<string, string> = {
    paye: 'Soldé',
    payé: 'Soldé',
    solde: 'Soldé',
    soldé: 'Soldé',
    partiel: 'Partiel',
    impaye: 'Impayé',
    impayé: 'Impayé',
    authentic: 'Authentique',
  };
  return labels[normalized] ?? status;
}

export function getVerificationCopy(state: VerificationState) {
  if (state === 'authentic') {
    return {
      title: 'Document authentique',
      message:
        "Cette page confirme l'authenticité du document enregistré dans le registre documentaire Samay Këur. Les informations affichées doivent correspondre au document scanné.",
    };
  }
  if (state === 'revoked' || state === 'superseded') {
    return {
      title: state === 'revoked' ? 'Document révoqué' : 'Document remplacé',
      message: "Ce document a été annulé ou remplacé. Contactez l'émetteur pour obtenir la version valide.",
    };
  }
  if (state === 'network_error') {
    return {
      title: 'Impossible de vérifier le document pour le moment',
      message: 'La connexion au registre documentaire a échoué. Vérifiez le réseau puis réessayez.',
    };
  }
  if (state === 'invalid') {
    return {
      title: 'Référence invalide',
      message: 'Le QR code ou la référence saisis ne sont pas exploitables.',
    };
  }
  return {
    title: 'Document introuvable',
    message:
      "Cette référence ne correspond à aucun document enregistré dans le registre Samay Këur. Ne vous fiez pas à ce document tant que son authenticité n'a pas été confirmée par l'émetteur.",
  };
}

function normalizePublicResponse(data: PublicVerificationResponse): DocumentVerificationResult {
  if (!data.document) {
    return {
      state: 'not_found',
      message: data.error ?? getVerificationCopy('not_found').message,
    };
  }

  const state: VerificationState =
    data.status === 'revoked'
      ? 'revoked'
      : data.status === 'superseded'
        ? 'superseded'
        : data.valid
          ? 'authentic'
          : 'not_found';

  return {
    state,
    message: getVerificationCopy(state).message,
    details: {
      reference: data.document.reference,
      type: data.document.type,
      issuer: data.document.agency,
      issuedAt: data.document.issued_at,
      amountXof: data.document.amount_xof == null ? null : Number(data.document.amount_xof),
      paymentStatus: data.document.payment_status ?? null,
      period: data.document.period ?? null,
      registeredAt: data.document.registered_at ?? null,
      lastCheckedAt: new Date().toISOString(),
    },
  };
}

function normalizeRow(row: VerificationRow): DocumentVerificationResult {
  const state: VerificationState =
    row.document_status === 'revoked'
      ? 'revoked'
      : row.document_status === 'superseded'
        ? 'superseded'
        : 'authentic';

  return {
    state,
    message: getVerificationCopy(state).message,
    details: {
      reference: row.document_ref,
      type: row.document_type,
      issuer: row.agency_name,
      issuedAt: row.issued_at,
      amountXof: row.amount_xof == null ? null : Number(row.amount_xof),
      paymentStatus: row.payment_status,
      period: typeof row.metadata?.period === 'string' ? row.metadata.period : null,
      registeredAt: row.created_at,
      lastCheckedAt: new Date().toISOString(),
    },
  };
}

export async function verifyDocumentToken(
  token: string,
  options?: { reference?: string | null; type?: string | null }
): Promise<DocumentVerificationResult> {
  if (!/^[a-f0-9]{64}$/i.test(token.trim())) {
    return { state: 'invalid', message: getVerificationCopy('invalid').message };
  }

  try {
    const baseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
    if (!baseUrl || !anonKey) {
      return { state: 'network_error', message: 'Configuration de vérification absente.' };
    }

    const params = new URLSearchParams({ token: token.trim() });
    if (options?.reference) params.set('ref', options.reference);
    if (options?.type) params.set('type', options.type);

    const response = await fetch(`${baseUrl}/functions/v1/verify-document?${params.toString()}`, {
      method: 'GET',
      headers: { apikey: anonKey },
    });
    const data = (await response.json()) as PublicVerificationResponse;
    if (!response.ok && response.status >= 500) {
      return { state: 'network_error', message: data.error ?? getVerificationCopy('network_error').message };
    }
    return normalizePublicResponse(data);
  } catch {
    return { state: 'network_error', message: getVerificationCopy('network_error').message };
  }
}

export async function verifyDocumentReference(reference: string, agencyId: string | null | undefined): Promise<DocumentVerificationResult> {
  const cleanRef = reference.trim();
  if (!cleanRef || !agencyId) {
    return { state: 'invalid', message: getVerificationCopy('invalid').message };
  }

  try {
    const { supabase } = await import('../lib/supabase');
    const { data, error } = await supabase
      .from('document_verifications')
      .select('document_ref, document_type, agency_name, issued_at, amount_xof, payment_status, document_status, metadata, created_at')
      .eq('agency_id', agencyId)
      .eq('document_ref', cleanRef)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return { state: 'not_found', message: getVerificationCopy('not_found').message };
    }
    return normalizeRow(data as VerificationRow);
  } catch {
    return { state: 'network_error', message: getVerificationCopy('network_error').message };
  }
}
