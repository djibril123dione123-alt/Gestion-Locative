import { supabase } from '../lib/supabase';
import type { AccountProfile } from '../lib/accountProfile';
import type { Agency, UserProfile } from '../types/database';

export interface OwnerBailleur {
  id: string;
  nom: string;
  prenom: string;
  telephone?: string | null;
  email?: string | null;
  adresse?: string | null;
  commission?: number | null;
  is_account_owner?: boolean | null;
}

interface OwnerBailleurInput {
  profile: Pick<UserProfile, 'id' | 'agency_id' | 'nom' | 'prenom' | 'telephone' | 'email'> | null | undefined;
  agency: Pick<Agency, 'id' | 'name' | 'phone' | 'email' | 'address' | 'is_bailleur_account'> | null | undefined;
  accountProfile: Pick<AccountProfile, 'isIndividualOwner'>;
}

function clean(value?: string | null): string {
  return value?.trim() ?? '';
}

function splitAgencyName(name?: string | null): { prenom: string; nom: string } {
  const parts = clean(name).split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return { prenom: parts[0], nom: parts.slice(1).join(' ') };
  }
  return { prenom: 'Proprietaire', nom: parts[0] || 'Principal' };
}

function buildOwnerPayload({
  profile,
  agency,
}: OwnerBailleurInput): Omit<OwnerBailleur, 'id'> & {
  agency_id: string;
  created_by?: string;
  account_user_id?: string;
  is_account_owner: boolean;
  actif: boolean;
  notes: string;
} {
  const fallback = splitAgencyName(agency?.name);
  const prenom = clean(profile?.prenom) || fallback.prenom;
  const nom = clean(profile?.nom) || fallback.nom;

  return {
    agency_id: profile?.agency_id ?? agency?.id ?? '',
    created_by: profile?.id,
    account_user_id: profile?.id,
    is_account_owner: true,
    nom,
    prenom,
    telephone: clean(profile?.telephone) || clean(agency?.phone) || '000000000',
    email: clean(profile?.email) || clean(agency?.email) || null,
    adresse: clean(agency?.address) || null,
    commission: 0,
    actif: true,
    notes: 'Proprietaire principal du compte bailleur individuel.',
  };
}

export async function getOrCreateIndividualOwnerBailleur(input: OwnerBailleurInput): Promise<OwnerBailleur> {
  const agencyId = input.profile?.agency_id ?? input.agency?.id;

  if (!input.accountProfile.isIndividualOwner) {
    throw new Error("Ce compte n'est pas configure comme bailleur individuel.");
  }

  if (!agencyId) {
    throw new Error('Aucun espace proprietaire associe au compte.');
  }

  const ownerQuery = await supabase
    .from('bailleurs')
    .select('id, nom, prenom, telephone, email, adresse, commission, is_account_owner')
    .eq('agency_id', agencyId)
    .eq('is_account_owner', true)
    .eq('actif', true)
    .order('created_at', { ascending: true })
    .limit(1);

  if (ownerQuery.error) {
    const message = ownerQuery.error.message?.toLowerCase() ?? '';
    const missingOwnerColumn =
      ownerQuery.error.code === '42703'
      || message.includes('is_account_owner')
      || message.includes('column');

    if (!missingOwnerColumn) throw ownerQuery.error;
  } else if (ownerQuery.data?.[0]) {
    return ownerQuery.data[0] as OwnerBailleur;
  }

  const { data: existing, error: selectFallbackError } = await supabase
    .from('bailleurs')
    .select('id, nom, prenom, telephone, email, adresse, commission')
    .eq('agency_id', agencyId)
    .eq('actif', true)
    .order('created_at', { ascending: true })
    .limit(1);

  if (selectFallbackError) {
    throw selectFallbackError;
  }

  if (existing?.[0]) {
    const selected = existing[0] as OwnerBailleur;
    await supabase
      .from('bailleurs')
      .update({ is_account_owner: true, account_user_id: input.profile?.id ?? null, commission: 0 })
      .eq('id', selected.id)
      .eq('agency_id', agencyId);
    return { ...selected, commission: 0, is_account_owner: true };
  }

  const payload = buildOwnerPayload(input);

  let { data: created, error: insertError } = await supabase
    .from('bailleurs')
    .insert(payload)
    .select('id, nom, prenom, telephone, email, adresse, commission, is_account_owner')
    .single();

  if (insertError) {
    const message = insertError.message?.toLowerCase() ?? '';
    const missingOwnerColumns =
      insertError.code === '42703'
      || message.includes('is_account_owner')
      || message.includes('account_user_id')
      || message.includes('column');

    if (missingOwnerColumns) {
      const legacyPayload = {
        agency_id: payload.agency_id,
        created_by: payload.created_by,
        nom: payload.nom,
        prenom: payload.prenom,
        telephone: payload.telephone,
        email: payload.email,
        adresse: payload.adresse,
        commission: payload.commission,
        actif: payload.actif,
        notes: payload.notes,
      };
      const legacyInsert = await supabase
        .from('bailleurs')
        .insert(legacyPayload)
        .select('id, nom, prenom, telephone, email, adresse, commission')
        .single();
      created = legacyInsert.data as typeof created;
      insertError = legacyInsert.error;
    }
  }

  if (insertError) {
    throw insertError;
  }

  if (!created) {
    throw new Error('Profil proprietaire indisponible.');
  }

  return created as OwnerBailleur;
}
