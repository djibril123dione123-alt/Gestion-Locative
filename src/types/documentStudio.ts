export const DOCUMENT_TEMPLATE_TYPES = [
  'contrat',
  'mandat',
  'quittance',
  'facture',
  'rapport_bailleur',
  'rapport_proprietaire',
] as const;

export type DocumentTemplateType = (typeof DOCUMENT_TEMPLATE_TYPES)[number];

export type DocumentTemplateBlockKind =
  | 'paragraph'
  | 'article'
  | 'system'
  | 'signature'
  | 'footer';

export type DocumentSystemBlockKey =
  | 'payment_summary'
  | 'tenant_identity'
  | 'property_identity'
  | 'payment_breakdown'
  | 'owner_summary'
  | 'occupancy'
  | 'collections'
  | 'expenses'
  | 'commissions'
  | 'arrears'
  | 'documents'
  | 'qr_verification';

export interface DocumentTemplateBlock {
  id: string;
  kind: DocumentTemplateBlockKind;
  code: string;
  title: string;
  content: string;
  enabled: boolean;
  order: number;
  custom?: boolean;
  locked?: boolean;
  required?: boolean;
  systemKey?: DocumentSystemBlockKey;
}

export interface DocumentTemplateStyle {
  density: 'compact' | 'standard';
  header: 'sobriete' | 'institutionnel' | 'moderne';
  showLogo: boolean;
  showQr: boolean;
  showDocumentNumber: boolean;
  showSignature: boolean;
  showStamp: boolean;
}

export interface DocumentTemplateContent {
  schemaVersion: 1;
  documentType: DocumentTemplateType;
  title: string;
  description: string;
  style: DocumentTemplateStyle;
  blocks: DocumentTemplateBlock[];
}

export interface DocumentTemplateRevision {
  id: string;
  template_id: string;
  agency_id: string;
  revision: number;
  content: DocumentTemplateContent;
  checksum: string;
  catalog_version: string;
  renderer_version: string;
  change_note: string | null;
  published_by: string | null;
  published_at: string;
}

export interface AgencyDocumentTemplateRow {
  id: string;
  agency_id: string;
  document_type: DocumentTemplateType;
  variant: string;
  name: string;
  draft_content: DocumentTemplateContent;
  published_revision_id: string | null;
  lock_version: number;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ResolvedDocumentTemplate {
  content: DocumentTemplateContent;
  source: 'official' | 'agency';
  revisionId: string | null;
  revision: number | null;
  checksum: string;
  catalogVersion: string;
  rendererVersion: string;
}

export interface TemplateTagDefinition {
  key: string;
  label: string;
  category: 'organisation' | 'bailleur' | 'locataire' | 'bien' | 'contrat' | 'finance' | 'date';
  example: string;
  documentTypes: DocumentTemplateType[];
}

export interface TemplateValidationIssue {
  code: 'empty_title' | 'empty_block' | 'unknown_tag' | 'duplicate_code' | 'missing_required_block';
  message: string;
  blockId?: string;
  tag?: string;
}

export interface RenderedTemplateBlock {
  id: string;
  kind: DocumentTemplateBlockKind;
  code: string;
  title: string;
  content: string;
  order: number;
  systemKey?: DocumentSystemBlockKey;
}

export interface RenderedDocumentTemplate {
  title: string;
  blocks: RenderedTemplateBlock[];
}

