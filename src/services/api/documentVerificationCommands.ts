import { supabase } from '../../lib/supabase';

type VerificationCommandInput = {
  agencyId: string;
  documentRef: string;
  documentType: string;
  agencyName: string;
  issuedAt: string;
  amountXof: number | null;
  paymentStatus: string | null;
  payloadHash: string;
  metadata?: Record<string, unknown>;
};

export async function registerDocumentVerificationCommand(input: VerificationCommandInput) {
  const { data, error } = await supabase.rpc('register_document_verification_command', {
    p_agency_id: input.agencyId,
    p_document_ref: input.documentRef,
    p_document_type: input.documentType,
    p_agency_name: input.agencyName,
    p_issued_at: input.issuedAt,
    p_amount_xof: input.amountXof,
    p_payment_status: input.paymentStatus,
    p_payload_hash: input.payloadHash,
    p_metadata: input.metadata ?? {},
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.id || !row?.token) throw new Error('La preuve documentaire n’a pas été créée.');
  return row as { id: string; token: string };
}

export async function linkDocumentVerificationRegistryCommand(input: {
  verificationId: string;
  registryId: string;
  registryVersion: number;
  templateChecksum?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const { error } = await supabase.rpc('link_document_verification_registry_command', {
    p_verification_id: input.verificationId,
    p_registry_id: input.registryId,
    p_registry_version: input.registryVersion,
    p_template_checksum: input.templateChecksum ?? null,
    p_metadata: input.metadata ?? {},
  });
  if (error) throw error;
}

export async function revokeDocumentVerificationCommand(verificationId: string, reason: string) {
  const { error } = await supabase.rpc('revoke_document_verification_command', {
    p_verification_id: verificationId,
    p_reason: reason,
  });
  if (error) throw error;
}

