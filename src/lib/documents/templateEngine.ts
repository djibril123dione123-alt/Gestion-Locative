import {
  getTemplateTags,
} from './templateCatalog';
import type {
  DocumentTemplateContent,
  RenderedDocumentTemplate,
  TemplateValidationIssue,
} from '../../types/documentStudio';

const TAG_PATTERN = /\{\{\s*([a-z0-9_]+)\s*\}\}/gi;
const REQUIRED_BLOCK_CODES: Partial<Record<DocumentTemplateContent['documentType'], string[]>> = {
  contrat: ['parties', 'signature'],
  mandat: ['parties', 'signature'],
  quittance: ['summary'],
  rapport_bailleur: ['owner'],
  rapport_proprietaire: ['owner'],
};

export function extractTemplateTags(value: string): string[] {
  const tags = new Set<string>();
  for (const match of value.matchAll(TAG_PATTERN)) {
    tags.add(match[1].toLowerCase());
  }
  return [...tags];
}

export function validateDocumentTemplate(content: DocumentTemplateContent): TemplateValidationIssue[] {
  const issues: TemplateValidationIssue[] = [];
  const allowedTags = new Set(getTemplateTags(content.documentType).map((tag) => tag.key));
  const enabledBlocks = content.blocks.filter((block) => block.enabled);
  const codes = new Set<string>();

  if (!content.title.trim()) {
    issues.push({ code: 'empty_title', message: 'Le titre du document est requis.' });
  }

  for (const block of content.blocks) {
    const normalizedCode = block.code.trim().toLowerCase();
    if (codes.has(normalizedCode)) {
      issues.push({
        code: 'duplicate_code',
        blockId: block.id,
        message: `Le code « ${block.code} » est utilisé plusieurs fois.`,
      });
    }
    codes.add(normalizedCode);

    if (block.enabled && block.kind !== 'system' && !block.content.trim()) {
      issues.push({
        code: 'empty_block',
        blockId: block.id,
        message: `La section « ${block.title || block.code} » ne peut pas être vide.`,
      });
    }

    for (const tag of extractTemplateTags(block.content)) {
      if (!allowedTags.has(tag)) {
        issues.push({
          code: 'unknown_tag',
          blockId: block.id,
          tag,
          message: `La variable {{${tag}}} n'existe pas pour ce document.`,
        });
      }
    }
  }

  for (const required of content.blocks.filter((block) => block.required)) {
    if (!enabledBlocks.some((block) => block.id === required.id)) {
      issues.push({
        code: 'missing_required_block',
        blockId: required.id,
        message: `La section obligatoire « ${required.title} » doit rester active.`,
      });
    }
  }

  for (const requiredCode of REQUIRED_BLOCK_CODES[content.documentType] ?? []) {
    const requiredBlock = content.blocks.find(
      (block) => block.code.trim().toLowerCase() === requiredCode,
    );
    if (!requiredBlock || !requiredBlock.enabled) {
      issues.push({
        code: 'missing_required_block',
        blockId: requiredBlock?.id,
        message: `La section système « ${requiredCode} » est obligatoire pour ce document.`,
      });
    }
  }

  return issues;
}

export function resolveTemplateText(
  text: string,
  variables: Record<string, string | number | null | undefined>,
): string {
  return text.replace(TAG_PATTERN, (_match, rawKey: string) => {
    const key = rawKey.toLowerCase();
    const value = variables[key];
    if (value === null || value === undefined || String(value).trim() === '') {
      throw new Error(`VARIABLE_REQUIRED:${key}`);
    }
    return String(value);
  });
}

export function renderDocumentTemplate(
  content: DocumentTemplateContent,
  variables: Record<string, string | number | null | undefined>,
): RenderedDocumentTemplate {
  const issues = validateDocumentTemplate(content);
  if (issues.length > 0) {
    throw new Error(`TEMPLATE_INVALID:${issues.map((issue) => issue.message).join('|')}`);
  }

  let articleNumber = 0;
  const blocks = content.blocks
    .filter((block) => block.enabled)
    .sort((left, right) => left.order - right.order)
    .map((block) => {
      const isArticle = block.kind === 'article';
      if (isArticle) articleNumber += 1;
      return {
        id: block.id,
        kind: block.kind,
        code: block.code,
        title: isArticle ? `Article ${articleNumber} — ${block.title}` : block.title,
        content: block.kind === 'system' ? '' : resolveTemplateText(block.content, variables),
        order: block.order,
        systemKey: block.systemKey,
      };
    });

  return { title: content.title, blocks };
}

export function getSampleTemplateVariables(documentType: DocumentTemplateContent['documentType']) {
  return Object.fromEntries(
    getTemplateTags(documentType).map((tag) => [tag.key, tag.example]),
  );
}

export function stableTemplateStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableTemplateStringify).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableTemplateStringify(record[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

export async function checksumDocumentTemplate(content: DocumentTemplateContent): Promise<string> {
  const bytes = new TextEncoder().encode(stableTemplateStringify(content));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}
