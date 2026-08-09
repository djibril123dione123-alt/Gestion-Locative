import { supabase } from '../lib/supabase';
import type { AgencySettings } from '../types/agency';

const BUCKET = 'agency-assets';
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

export type AgencyIdentityAssetKind = 'logo' | 'signature' | 'stamp';

export interface AgencyIdentityAssetResult {
  path: string | null;
  signedUrl: string | null;
  settings: AgencySettings;
}

export function validateAgencyIdentityFile(file: File): string | null {
  if (!ALLOWED_TYPES.has(file.type)) return 'Formats acceptés : PNG, JPG ou WebP.';
  if (file.size <= 0 || file.size > MAX_FILE_SIZE) return "L'image ne doit pas dépasser 5 Mo.";
  return null;
}

export function extractAgencyAssetPath(value: string | null | undefined): string | null {
  if (!value) return null;
  if (!/^https?:/i.test(value)) return value.replace(/^\/+/, '');
  try {
    const decoded = decodeURIComponent(new URL(value).pathname);
    const markers = [
      `/storage/v1/object/public/${BUCKET}/`,
      `/storage/v1/object/sign/${BUCKET}/`,
      `/storage/v1/object/${BUCKET}/`,
    ];
    const marker = markers.find((candidate) => decoded.includes(candidate));
    return marker ? decoded.slice(decoded.indexOf(marker) + marker.length) : null;
  } catch {
    return null;
  }
}

export async function resolveAgencyAssetUrl(value: string | null | undefined): Promise<string | null> {
  if (!value) return null;
  if (/^(data:|blob:)/i.test(value)) return value;
  const path = extractAgencyAssetPath(value);
  if (!path) return value;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
  if (error) throw new Error("L'aperçu de l'identité documentaire est indisponible.");
  return data.signedUrl;
}

export async function resolveAgencySettingsAssets<T extends Partial<AgencySettings>>(settings: T): Promise<T> {
  const [logo, signature, stamp] = await Promise.all([
    resolveAgencyAssetUrl(settings.logo_url),
    resolveAgencyAssetUrl(settings.signature_url),
    resolveAgencyAssetUrl(settings.stamp_url),
  ]);
  return { ...settings, logo_url: logo, signature_url: signature, stamp_url: stamp };
}

export async function uploadAgencyIdentityAsset(input: {
  agencyId: string;
  kind: AgencyIdentityAssetKind;
  file: File;
}): Promise<AgencyIdentityAssetResult> {
  const validationError = validateAgencyIdentityFile(input.file);
  if (validationError) throw new Error(validationError);
  const form = new FormData();
  form.set('agencyId', input.agencyId);
  form.set('kind', input.kind);
  form.set('file', input.file);
  const { data, error } = await supabase.functions.invoke('manage-agency-identity-asset', { body: form });
  if (error) throw new Error(error.message || "Le fichier n'a pas pu être enregistré.");
  if (!data?.data?.settings) throw new Error("La réponse d'enregistrement est incomplète.");
  return data.data as AgencyIdentityAssetResult;
}

export async function deleteAgencyIdentityAsset(input: {
  agencyId: string;
  kind: AgencyIdentityAssetKind;
}): Promise<AgencyIdentityAssetResult> {
  const { data, error } = await supabase.functions.invoke('manage-agency-identity-asset', {
    method: 'DELETE',
    body: input,
  });
  if (error) throw new Error(error.message || "Le fichier n'a pas pu être retiré.");
  if (!data?.data?.settings) throw new Error("La réponse de suppression est incomplète.");
  return data.data as AgencyIdentityAssetResult;
}
