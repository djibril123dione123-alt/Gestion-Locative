import { supabase } from '../lib/supabase';

function commandKey(command: string, target: string): string {
  const nonce = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${command}:${target}:${nonce}`;
}

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('La commande serveur a renvoyé une réponse invalide.');
  }
  return value as Record<string, unknown>;
}

function optionalString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

export interface CompleteOnboardingCommand {
  agencyName: string;
  logoUrl?: string | null;
  phone?: string | null;
  address?: string | null;
  representativeName?: string | null;
  currency: string;
  city: string;
  completedAt?: string;
}

export async function completeTenantOnboarding(input: CompleteOnboardingCommand): Promise<string> {
  const completedAt = input.completedAt ?? new Date().toISOString();
  const { data, error } = await supabase.rpc('tenant_complete_onboarding', {
    p_agency_name: input.agencyName.trim(),
    p_logo_url: input.logoUrl?.trim() || null,
    p_phone: input.phone?.trim() || null,
    p_address: input.address?.trim() || null,
    p_representative_name: input.representativeName?.trim() || null,
    p_currency: input.currency.trim().toUpperCase(),
    p_city: input.city.trim(),
    p_completed_at: completedAt,
    p_idempotency_key: commandKey('onboarding-complete', completedAt),
  });
  if (error) throw error;

  const result = asObject(data);
  return optionalString(result, 'completed_at') ?? completedAt;
}

export async function markTenantOnboardingComplete(completedAt = new Date().toISOString()): Promise<string> {
  const { data, error } = await supabase.rpc('tenant_mark_onboarding_complete', {
    p_completed_at: completedAt,
    p_idempotency_key: commandKey('onboarding-deferred', completedAt),
  });
  if (error) throw error;

  const result = asObject(data);
  return optionalString(result, 'completed_at') ?? completedAt;
}

export interface UpdateOwnerProfileCommand {
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  logoUrl?: string | null;
  ownerBailleurId?: string | null;
}

export interface UpdatedOwnerProfile {
  firstName: string;
  lastName: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  logoUrl: string | null;
  ownerBailleurId: string | null;
}

export async function updateTenantOwnerProfile(input: UpdateOwnerProfileCommand): Promise<UpdatedOwnerProfile> {
  const { data, error } = await supabase.rpc('tenant_update_owner_profile', {
    p_first_name: input.firstName?.trim() || null,
    p_last_name: input.lastName?.trim() || null,
    p_phone: input.phone?.trim() || null,
    p_email: input.email?.trim().toLowerCase() || null,
    p_address: input.address?.trim() || null,
    p_logo_url: input.logoUrl?.trim() || null,
    p_owner_bailleur_id: input.ownerBailleurId ?? null,
    p_idempotency_key: commandKey('owner-profile', input.ownerBailleurId ?? 'current'),
  });
  if (error) throw error;

  const result = asObject(data);
  const firstName = optionalString(result, 'first_name');
  const lastName = optionalString(result, 'last_name');
  const fullName = optionalString(result, 'full_name');
  if (!firstName || !lastName || !fullName) {
    throw new Error('Le profil enregistré est absent de la réponse serveur.');
  }
  return {
    firstName,
    lastName,
    fullName,
    phone: optionalString(result, 'phone'),
    email: optionalString(result, 'email'),
    address: optionalString(result, 'address'),
    logoUrl: optionalString(result, 'logo_url'),
    ownerBailleurId: optionalString(result, 'owner_bailleur_id'),
  };
}

export interface LegalTermsAcceptance {
  acceptedTermsAt: string;
  acceptedPrivacyAt: string;
  termsVersion: string | null;
  privacyVersion: string | null;
}

export async function acceptTenantLegalTerms(input: LegalTermsAcceptance): Promise<LegalTermsAcceptance> {
  const { data, error } = await supabase.rpc('tenant_accept_legal_terms', {
    p_accepted_terms_at: input.acceptedTermsAt,
    p_accepted_privacy_at: input.acceptedPrivacyAt,
    p_terms_version: input.termsVersion,
    p_privacy_version: input.privacyVersion,
  });
  if (error) throw error;

  const result = asObject(data);
  return {
    acceptedTermsAt: optionalString(result, 'accepted_terms_at') ?? input.acceptedTermsAt,
    acceptedPrivacyAt: optionalString(result, 'accepted_privacy_at') ?? input.acceptedPrivacyAt,
    termsVersion: optionalString(result, 'terms_version'),
    privacyVersion: optionalString(result, 'privacy_version'),
  };
}

export async function markTenantDemoDataLoaded(): Promise<void> {
  const { error } = await supabase.rpc('tenant_mark_demo_data_loaded', {
    p_idempotency_key: commandKey('demo-data-loaded', 'current-agency'),
  });
  if (error) throw error;
}
