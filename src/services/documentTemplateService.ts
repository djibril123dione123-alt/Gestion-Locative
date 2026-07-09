import { supabase } from '../lib/supabase';
import {
  DOCUMENT_RENDERER_VERSION,
  DOCUMENT_TEMPLATE_CATALOG_VERSION,
  getOfficialDocumentTemplate,
} from '../lib/documents/templateCatalog';
import {
  checksumDocumentTemplate,
  validateDocumentTemplate,
} from '../lib/documents/templateEngine';
import type {
  AgencyDocumentTemplateRow,
  DocumentTemplateContent,
  DocumentTemplateRevision,
  DocumentTemplateType,
  ResolvedDocumentTemplate,
} from '../types/documentStudio';

const publishedCache = new Map<string, { value: ResolvedDocumentTemplate; expiresAt: number }>();
const PUBLISHED_CACHE_MS = 60_000;

async function getCurrentContext() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('AUTH_REQUIRED');

  const { data: profile, error } = await supabase
    .from('user_profiles')
    .select('agency_id, role')
    .eq('id', user.id)
    .maybeSingle();

  if (error) throw error;
  if (!profile?.agency_id) throw new Error('AGENCY_REQUIRED');
  return { userId: user.id, agencyId: String(profile.agency_id), role: String(profile.role ?? '') };
}

export async function loadDocumentTemplateWorkspace(documentType: DocumentTemplateType) {
  const context = await getCurrentContext();
  const { data, error } = await supabase
    .from('agency_document_templates')
    .select('*')
    .eq('agency_id', context.agencyId)
    .eq('document_type', documentType)
    .eq('variant', 'default')
    .maybeSingle();

  if (error && error.code !== '42P01') throw error;

  const row = data as AgencyDocumentTemplateRow | null;
  let history: DocumentTemplateRevision[] = [];
  if (row) {
    const result = await supabase
      .from('document_template_revisions')
      .select('*')
      .eq('template_id', row.id)
      .order('revision', { ascending: false })
      .limit(12);
    if (result.error) throw result.error;
    history = (result.data ?? []) as DocumentTemplateRevision[];
  }

  return {
    context,
    row,
    draft: row?.draft_content ?? getOfficialDocumentTemplate(documentType),
    history,
  };
}

export async function saveDocumentTemplateDraft(
  documentType: DocumentTemplateType,
  content: DocumentTemplateContent,
  current?: AgencyDocumentTemplateRow | null,
): Promise<AgencyDocumentTemplateRow> {
  const context = await getCurrentContext();
  if (context.role !== 'admin') throw new Error('ADMIN_REQUIRED');
  if (content.documentType !== documentType) throw new Error('DOCUMENT_TYPE_MISMATCH');

  const issues = validateDocumentTemplate(content);
  if (issues.length > 0) throw new Error(issues[0].message);

  if (current) {
    const { data, error } = await supabase
      .from('agency_document_templates')
      .update({
        draft_content: content,
        name: content.title,
        updated_by: context.userId,
      })
      .eq('id', current.id)
      .eq('agency_id', context.agencyId)
      .eq('lock_version', current.lock_version)
      .select('*')
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('TEMPLATE_CONFLICT');
    return data as AgencyDocumentTemplateRow;
  }

  const { data, error } = await supabase
    .from('agency_document_templates')
    .insert({
      agency_id: context.agencyId,
      document_type: documentType,
      variant: 'default',
      name: content.title,
      draft_content: content,
      created_by: context.userId,
      updated_by: context.userId,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as AgencyDocumentTemplateRow;
}

export async function publishDocumentTemplate(
  row: AgencyDocumentTemplateRow,
  content: DocumentTemplateContent,
  changeNote: string,
): Promise<DocumentTemplateRevision> {
  const issues = validateDocumentTemplate(content);
  if (issues.length > 0) throw new Error(issues[0].message);
  const checksum = await checksumDocumentTemplate(content);

  const { data, error } = await supabase.rpc('publish_agency_document_template', {
    p_template_id: row.id,
    p_expected_lock_version: row.lock_version,
    p_content: content,
    p_checksum: checksum,
    p_catalog_version: DOCUMENT_TEMPLATE_CATALOG_VERSION,
    p_renderer_version: DOCUMENT_RENDERER_VERSION,
    p_change_note: changeNote.trim() || null,
  });
  if (error) throw error;
  publishedCache.clear();
  return data as DocumentTemplateRevision;
}

export async function restoreDocumentTemplateRevision(
  revision: DocumentTemplateRevision,
  current: AgencyDocumentTemplateRow,
) {
  return saveDocumentTemplateDraft(revision.content.documentType, revision.content, current);
}

export async function resolvePublishedDocumentTemplate(
  documentType: DocumentTemplateType,
  agencyId?: string | null,
): Promise<ResolvedDocumentTemplate> {
  const official = getOfficialDocumentTemplate(documentType);
  const officialChecksum = await checksumDocumentTemplate(official);
  if (!agencyId) {
    return {
      content: official,
      source: 'official',
      revisionId: null,
      revision: null,
      checksum: officialChecksum,
      catalogVersion: DOCUMENT_TEMPLATE_CATALOG_VERSION,
      rendererVersion: DOCUMENT_RENDERER_VERSION,
    };
  }

  const cacheKey = `${agencyId}:${documentType}`;
  const cached = publishedCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const { data: template, error } = await supabase
    .from('agency_document_templates')
    .select('published_revision_id')
    .eq('agency_id', agencyId)
    .eq('document_type', documentType)
    .eq('variant', 'default')
    .maybeSingle();
  if (error && error.code !== '42P01') throw error;

  if (template?.published_revision_id) {
    const result = await supabase
      .from('document_template_revisions')
      .select('*')
      .eq('id', template.published_revision_id)
      .eq('agency_id', agencyId)
      .single();
    if (result.error) throw result.error;
    const revision = result.data as DocumentTemplateRevision;
    const issues = validateDocumentTemplate(revision.content);
    if (issues.length > 0) {
      throw new Error(`PUBLISHED_TEMPLATE_INVALID:${issues[0].message}`);
    }
    const resolved: ResolvedDocumentTemplate = {
      content: revision.content,
      source: 'agency',
      revisionId: revision.id,
      revision: revision.revision,
      checksum: revision.checksum,
      catalogVersion: revision.catalog_version,
      rendererVersion: revision.renderer_version,
    };
    publishedCache.set(cacheKey, { value: resolved, expiresAt: Date.now() + PUBLISHED_CACHE_MS });
    return resolved;
  }

  const fallback: ResolvedDocumentTemplate = {
    content: official,
    source: 'official',
    revisionId: null,
    revision: null,
    checksum: officialChecksum,
    catalogVersion: DOCUMENT_TEMPLATE_CATALOG_VERSION,
    rendererVersion: DOCUMENT_RENDERER_VERSION,
  };
  publishedCache.set(cacheKey, { value: fallback, expiresAt: Date.now() + PUBLISHED_CACHE_MS });
  return fallback;
}

export async function allocateDocumentReference(input: {
  documentType: DocumentTemplateType;
  entityId: string;
  periodKey?: string | null;
  format?: string | null;
  prefix: string;
  fallback: string;
}) {
  try {
    const { data, error } = await supabase.rpc('allocate_document_reference', {
      p_document_type: input.documentType,
      p_entity_id: input.entityId,
      p_period_key: input.periodKey ?? '',
      p_format: input.format ?? 'Q-YYYY-0001',
      p_prefix: input.prefix,
    });
    if (error) throw error;
    return typeof data === 'string' && data ? data : input.fallback;
  } catch (error) {
    console.warn('[DocumentStudio] Numérotation serveur indisponible, référence stable historique conservée.', error);
    return input.fallback;
  }
}
