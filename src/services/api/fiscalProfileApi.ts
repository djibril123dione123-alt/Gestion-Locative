import { supabase } from '../../lib/supabase';

export type LegalForm =
  | 'unknown'
  | 'individual'
  | 'sole_proprietorship'
  | 'sarl'
  | 'sa'
  | 'sas'
  | 'snc'
  | 'scs'
  | 'gie'
  | 'association'
  | 'public_entity'
  | 'other';

export type DocumentRole = 'unknown' | 'principal' | 'agent' | 'representative' | 'manager_on_behalf';
export type TaxStatus = 'unknown' | 'not_subject' | 'subject' | 'exempt' | 'mixed';
export type VatRegistrationStatus = 'unknown' | 'not_registered' | 'registered' | 'exempt';
export type TaxTreatment = 'unknown' | 'outside_scope' | 'exempt' | 'taxable' | 'mixed';
export type PriceInputMode = 'ht' | 'ttc';
export type ProfessionalValidationStatus = 'to_validate' | 'validated' | 'not_applicable';
export type LandlordPartyType = 'unknown' | 'individual' | 'legal_entity' | 'joint_ownership' | 'estate' | 'other';
export type LandlordDocumentRole = 'principal' | 'represented' | 'co_owner' | 'beneficiary' | 'other';
export type LeaseDestination = 'unknown' | 'residential' | 'professional' | 'commercial' | 'mixed' | 'other';
export type DocumentIssuer = 'unknown' | 'agency' | 'landlord' | 'agency_on_behalf_of_landlord';
export type LeaseRegistrationStatus = 'unknown' | 'to_register' | 'registered' | 'not_applicable';
export type BillingDocumentPolicy = 'notice' | 'invoice' | 'automatic';
export type AllocationStrategy = 'oldest_first' | 'current_period' | 'manual';

export interface OrganizationLegalProfile {
  agency_id: string;
  legal_form: LegalForm;
  business_activities: string[];
  trade_name: string | null;
  legal_name: string | null;
  ninea: string | null;
  rccm: string | null;
  registered_office: string | null;
  representative_name: string | null;
  representative_capacity: string | null;
  document_role: DocumentRole;
  mandate_reference: string | null;
  professional_validation_status: ProfessionalValidationStatus;
  notes: string | null;
  updated_at?: string;
}

export interface OrganizationFiscalProfile {
  agency_id: string;
  tax_status: TaxStatus;
  vat_registration_status: VatRegistrationStatus;
  vat_number: string | null;
  rent_tax_treatment: TaxTreatment;
  commission_tax_treatment: Exclude<TaxTreatment, 'mixed'>;
  price_input_mode: PriceInputMode;
  professional_validation_status: ProfessionalValidationStatus;
  effective_from: string;
  notes: string | null;
  updated_at?: string;
}

export interface OrganizationComplianceProfile {
  legal: OrganizationLegalProfile;
  fiscal: OrganizationFiscalProfile;
}

export interface LandlordLegalProfile {
  bailleur_id: string;
  agency_id: string;
  party_type: LandlordPartyType;
  legal_form: LegalForm;
  legal_name: string | null;
  trade_name: string | null;
  ninea: string | null;
  rccm: string | null;
  representative_name: string | null;
  representative_capacity: string | null;
  document_role: LandlordDocumentRole;
  professional_validation_status: ProfessionalValidationStatus;
  notes: string | null;
  updated_at?: string;
}

export interface LandlordFiscalProfile {
  bailleur_id: string;
  agency_id: string;
  tax_status: TaxStatus;
  vat_registration_status: VatRegistrationStatus;
  vat_number: string | null;
  default_rent_tax_treatment: TaxTreatment;
  professional_validation_status: ProfessionalValidationStatus;
  effective_from: string;
  notes: string | null;
  updated_at?: string;
}

export interface LandlordComplianceProfile {
  legal: LandlordLegalProfile;
  fiscal: LandlordFiscalProfile;
}

export interface ContractBillingSettings {
  contract_id: string;
  agency_id: string;
  due_day: number | null;
  generation_lead_days: number | null;
  document_policy: BillingDocumentPolicy;
  allocation_strategy: AllocationStrategy;
  auto_issue: boolean;
  delivery_channels: string[];
  updated_at?: string;
}

export interface ContractFiscalSettings {
  contract_id: string;
  agency_id: string;
  bailleur_id: string | null;
  lease_destination: LeaseDestination;
  invoice_required: boolean | null;
  rent_tax_treatment: Exclude<TaxTreatment, 'mixed'>;
  rent_tax_rate_id: string | null;
  rent_price_input_mode: PriceInputMode;
  commission_tax_treatment: Exclude<TaxTreatment, 'mixed'>;
  commission_tax_rate_id: string | null;
  commission_price_input_mode: PriceInputMode;
  document_issuer: DocumentIssuer;
  lease_registration_status: LeaseRegistrationStatus;
  lease_registration_reference: string | null;
  lease_registration_date: string | null;
  professional_validation_status: ProfessionalValidationStatus;
  effective_from: string;
  updated_at?: string;
}

export interface ContractBillingComplianceSettings {
  billing: ContractBillingSettings;
  fiscal: ContractFiscalSettings;
}

export interface TaxRateVersion {
  id: string;
  jurisdiction: string;
  tax_code: string;
  label: string;
  rate: number;
  effective_from: string;
  effective_to: string | null;
  validation_status: 'to_validate' | 'validated' | 'retired';
}

export class FiscalProfileApiError extends Error {
  readonly code: string;

  constructor(message: string, code = 'FISCAL_PROFILE_ERROR') {
    super(message);
    this.name = 'FiscalProfileApiError';
    this.code = code;
  }
}

function emptyLegalProfile(agencyId: string): OrganizationLegalProfile {
  return {
    agency_id: agencyId,
    legal_form: 'unknown',
    business_activities: [],
    trade_name: null,
    legal_name: null,
    ninea: null,
    rccm: null,
    registered_office: null,
    representative_name: null,
    representative_capacity: null,
    document_role: 'unknown',
    mandate_reference: null,
    professional_validation_status: 'to_validate',
    notes: null,
  };
}

function emptyFiscalProfile(agencyId: string): OrganizationFiscalProfile {
  return {
    agency_id: agencyId,
    tax_status: 'unknown',
    vat_registration_status: 'unknown',
    vat_number: null,
    rent_tax_treatment: 'unknown',
    commission_tax_treatment: 'unknown',
    price_input_mode: 'ttc',
    professional_validation_status: 'to_validate',
    effective_from: new Date().toISOString().slice(0, 10),
    notes: null,
  };
}

function emptyLandlordLegalProfile(bailleurId: string, agencyId = ''): LandlordLegalProfile {
  return {
    bailleur_id: bailleurId,
    agency_id: agencyId,
    party_type: 'unknown',
    legal_form: 'unknown',
    legal_name: null,
    trade_name: null,
    ninea: null,
    rccm: null,
    representative_name: null,
    representative_capacity: null,
    document_role: 'principal',
    professional_validation_status: 'to_validate',
    notes: null,
  };
}

function emptyLandlordFiscalProfile(bailleurId: string, agencyId = ''): LandlordFiscalProfile {
  return {
    bailleur_id: bailleurId,
    agency_id: agencyId,
    tax_status: 'unknown',
    vat_registration_status: 'unknown',
    vat_number: null,
    default_rent_tax_treatment: 'unknown',
    professional_validation_status: 'to_validate',
    effective_from: new Date().toISOString().slice(0, 10),
    notes: null,
  };
}

function emptyContractBillingSettings(contractId: string, agencyId = ''): ContractBillingSettings {
  return {
    contract_id: contractId,
    agency_id: agencyId,
    due_day: null,
    generation_lead_days: null,
    document_policy: 'notice',
    allocation_strategy: 'oldest_first',
    auto_issue: false,
    delivery_channels: [],
  };
}

function emptyContractFiscalSettings(contractId: string, agencyId = ''): ContractFiscalSettings {
  return {
    contract_id: contractId,
    agency_id: agencyId,
    bailleur_id: null,
    lease_destination: 'unknown',
    invoice_required: null,
    rent_tax_treatment: 'unknown',
    rent_tax_rate_id: null,
    rent_price_input_mode: 'ttc',
    commission_tax_treatment: 'unknown',
    commission_tax_rate_id: null,
    commission_price_input_mode: 'ttc',
    document_issuer: 'unknown',
    lease_registration_status: 'unknown',
    lease_registration_reference: null,
    lease_registration_date: null,
    professional_validation_status: 'to_validate',
    effective_from: new Date().toISOString().slice(0, 10),
  };
}

function profileError(error: { message?: string; code?: string } | null, fallback: string): never {
  const unavailable = error?.code === '42P01' || error?.code === 'PGRST205';
  throw new FiscalProfileApiError(
    unavailable
      ? 'Le profil juridique et fiscal doit encore être activé par une mise à jour administrateur.'
      : error?.message || fallback,
    error?.code || 'FISCAL_PROFILE_ERROR',
  );
}

export async function getOrganizationComplianceProfile(agencyId: string): Promise<OrganizationComplianceProfile> {
  const [legalResult, fiscalResult] = await Promise.all([
    supabase.from('organization_legal_profiles').select('*').eq('agency_id', agencyId).maybeSingle(),
    supabase.from('organization_fiscal_profiles').select('*').eq('agency_id', agencyId).maybeSingle(),
  ]);

  if (legalResult.error) profileError(legalResult.error, 'Le profil juridique n’a pas pu être chargé.');
  if (fiscalResult.error) profileError(fiscalResult.error, 'Le profil fiscal n’a pas pu être chargé.');

  return {
    legal: (legalResult.data as OrganizationLegalProfile | null) ?? emptyLegalProfile(agencyId),
    fiscal: (fiscalResult.data as OrganizationFiscalProfile | null) ?? emptyFiscalProfile(agencyId),
  };
}

function trimNullable(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export async function saveOrganizationComplianceProfile(
  profile: OrganizationComplianceProfile,
): Promise<OrganizationComplianceProfile> {
  const legal: OrganizationLegalProfile = {
    ...profile.legal,
    business_activities: [...new Set(profile.legal.business_activities.filter(Boolean))],
    trade_name: trimNullable(profile.legal.trade_name),
    legal_name: trimNullable(profile.legal.legal_name),
    ninea: trimNullable(profile.legal.ninea)?.toUpperCase() ?? null,
    rccm: trimNullable(profile.legal.rccm)?.toUpperCase() ?? null,
    registered_office: trimNullable(profile.legal.registered_office),
    representative_name: trimNullable(profile.legal.representative_name),
    representative_capacity: trimNullable(profile.legal.representative_capacity),
    mandate_reference: trimNullable(profile.legal.mandate_reference),
    notes: trimNullable(profile.legal.notes),
  };
  const fiscal: OrganizationFiscalProfile = {
    ...profile.fiscal,
    vat_number: trimNullable(profile.fiscal.vat_number)?.toUpperCase() ?? null,
    notes: trimNullable(profile.fiscal.notes),
  };

  const { data, error } = await supabase.rpc('fn_upsert_organization_compliance_profile', {
    p_legal: legal,
    p_fiscal: fiscal,
  });

  if (error) profileError(error, 'Le profil juridique et fiscal n’a pas pu être enregistré.');

  const saved = data as OrganizationComplianceProfile | null;
  if (!saved?.legal || !saved?.fiscal) {
    throw new FiscalProfileApiError('La sauvegarde n’a pas retourné un profil complet.');
  }

  return saved;
}

export async function getLandlordComplianceProfile(bailleurId: string): Promise<LandlordComplianceProfile> {
  const [legalResult, fiscalResult] = await Promise.all([
    supabase.from('bailleur_legal_profiles').select('*').eq('bailleur_id', bailleurId).maybeSingle(),
    supabase.from('bailleur_fiscal_profiles').select('*').eq('bailleur_id', bailleurId).maybeSingle(),
  ]);

  if (legalResult.error) profileError(legalResult.error, 'Le profil juridique du bailleur n’a pas pu être chargé.');
  if (fiscalResult.error) profileError(fiscalResult.error, 'Le profil fiscal du bailleur n’a pas pu être chargé.');

  const agencyId = String(legalResult.data?.agency_id ?? fiscalResult.data?.agency_id ?? '');
  return {
    legal: (legalResult.data as LandlordLegalProfile | null) ?? emptyLandlordLegalProfile(bailleurId, agencyId),
    fiscal: (fiscalResult.data as LandlordFiscalProfile | null) ?? emptyLandlordFiscalProfile(bailleurId, agencyId),
  };
}

export async function saveLandlordComplianceProfile(
  profile: LandlordComplianceProfile,
): Promise<LandlordComplianceProfile> {
  const legal: LandlordLegalProfile = {
    ...profile.legal,
    legal_name: trimNullable(profile.legal.legal_name),
    trade_name: trimNullable(profile.legal.trade_name),
    ninea: trimNullable(profile.legal.ninea)?.toUpperCase() ?? null,
    rccm: trimNullable(profile.legal.rccm)?.toUpperCase() ?? null,
    representative_name: trimNullable(profile.legal.representative_name),
    representative_capacity: trimNullable(profile.legal.representative_capacity),
    notes: trimNullable(profile.legal.notes),
  };
  const fiscal: LandlordFiscalProfile = {
    ...profile.fiscal,
    vat_number: trimNullable(profile.fiscal.vat_number)?.toUpperCase() ?? null,
    notes: trimNullable(profile.fiscal.notes),
  };

  const { data, error } = await supabase.rpc('fn_upsert_bailleur_compliance_profile', {
    p_bailleur_id: profile.legal.bailleur_id,
    p_legal: legal,
    p_fiscal: fiscal,
  });

  if (error) profileError(error, 'Le profil juridique et fiscal du bailleur n’a pas pu être enregistré.');
  const saved = data as LandlordComplianceProfile | null;
  if (!saved?.legal || !saved?.fiscal) {
    throw new FiscalProfileApiError('La sauvegarde n’a pas retourné un profil bailleur complet.');
  }
  return saved;
}

export async function getContractBillingComplianceSettings(
  contractId: string,
): Promise<ContractBillingComplianceSettings> {
  const [billingResult, fiscalResult] = await Promise.all([
    supabase.from('contract_billing_settings').select('*').eq('contract_id', contractId).maybeSingle(),
    supabase.from('contract_fiscal_settings').select('*').eq('contract_id', contractId).maybeSingle(),
  ]);

  if (billingResult.error) profileError(billingResult.error, 'Les règles de facturation du bail n’ont pas pu être chargées.');
  if (fiscalResult.error) profileError(fiscalResult.error, 'Le profil fiscal du bail n’a pas pu être chargé.');

  const agencyId = String(billingResult.data?.agency_id ?? fiscalResult.data?.agency_id ?? '');
  return {
    billing: (billingResult.data as ContractBillingSettings | null) ?? emptyContractBillingSettings(contractId, agencyId),
    fiscal: (fiscalResult.data as ContractFiscalSettings | null) ?? emptyContractFiscalSettings(contractId, agencyId),
  };
}

export async function saveContractBillingComplianceSettings(
  settings: ContractBillingComplianceSettings,
): Promise<ContractBillingComplianceSettings> {
  const billing: ContractBillingSettings = {
    ...settings.billing,
    delivery_channels: [...new Set(settings.billing.delivery_channels.filter(Boolean))],
  };
  const fiscal: ContractFiscalSettings = {
    ...settings.fiscal,
    lease_registration_reference: trimNullable(settings.fiscal.lease_registration_reference),
  };

  const { data, error } = await supabase.rpc('fn_upsert_contract_billing_fiscal_settings', {
    p_contract_id: settings.billing.contract_id,
    p_billing: billing,
    p_fiscal: fiscal,
  });

  if (error) profileError(error, 'Les règles de facturation et de conformité du bail n’ont pas pu être enregistrées.');
  const saved = data as ContractBillingComplianceSettings | null;
  if (!saved?.billing || !saved?.fiscal) {
    throw new FiscalProfileApiError('La sauvegarde n’a pas retourné les réglages complets du bail.');
  }
  return saved;
}

export async function listTaxRateVersions(): Promise<TaxRateVersion[]> {
  const { data, error } = await supabase
    .from('tax_rate_versions')
    .select('id,jurisdiction,tax_code,label,rate,effective_from,effective_to,validation_status')
    .neq('validation_status', 'retired')
    .order('effective_from', { ascending: false });

  if (error) profileError(error, 'Le catalogue fiscal n’a pas pu être chargé.');
  return (data ?? []) as TaxRateVersion[];
}
