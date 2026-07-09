import { describe, expect, it } from 'vitest';
import {
  checksumDocumentTemplate,
  getSampleTemplateVariables,
  renderDocumentTemplate,
  validateDocumentTemplate,
} from '../templateEngine';
import {
  getOfficialDocumentTemplate,
} from '../templateCatalog';
import { DOCUMENT_TEMPLATE_TYPES } from '../../../types/documentStudio';

describe('document template engine', () => {
  it('validates and renders every official catalog template', () => {
    for (const documentType of DOCUMENT_TEMPLATE_TYPES) {
      const template = getOfficialDocumentTemplate(documentType);
      expect(validateDocumentTemplate(template)).toEqual([]);
      const rendered = renderDocumentTemplate(template, getSampleTemplateVariables(documentType));
      expect(rendered.blocks.length).toBeGreaterThan(0);
      expect(rendered.title).toBe(template.title);
    }
  });

  it('numbers only enabled article blocks in display order', () => {
    const template = getOfficialDocumentTemplate('contrat');
    template.blocks = template.blocks
      .map((block) => block.code === 'conge' ? { ...block, enabled: false } : block)
      .reverse()
      .map((block, index) => ({ ...block, order: index }));

    const rendered = renderDocumentTemplate(template, getSampleTemplateVariables('contrat'));
    const articleTitles = rendered.blocks
      .filter((block) => block.kind === 'article')
      .map((block) => block.title);

    expect(articleTitles[0]).toMatch(/^Article 1/);
    expect(articleTitles[1]).toMatch(/^Article 2/);
    expect(articleTitles.some((title) => title.includes('Congé'))).toBe(false);
  });

  it('rejects unknown variables before publication', () => {
    const template = getOfficialDocumentTemplate('mandat');
    template.blocks[1] = {
      ...template.blocks[1],
      content: 'Valeur {{variable_inconnue}}',
    };

    expect(validateDocumentTemplate(template)).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'unknown_tag', tag: 'variable_inconnue' }),
    ]));
  });

  it('rejects disabling a required block', () => {
    const template = getOfficialDocumentTemplate('contrat');
    template.blocks[0] = { ...template.blocks[0], enabled: false };
    expect(validateDocumentTemplate(template)).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'missing_required_block' }),
    ]));
  });

  it('rejects removing a required system block', () => {
    const template = getOfficialDocumentTemplate('quittance');
    template.blocks = template.blocks.filter((block) => block.code !== 'summary');

    expect(validateDocumentTemplate(template)).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'missing_required_block' }),
    ]));
  });

  it('produces a stable checksum independently of object key order', async () => {
    const template = getOfficialDocumentTemplate('quittance');
    const reordered = {
      ...template,
      style: {
        showStamp: template.style.showStamp,
        showSignature: template.style.showSignature,
        showDocumentNumber: template.style.showDocumentNumber,
        showQr: template.style.showQr,
        showLogo: template.style.showLogo,
        header: template.style.header,
        density: template.style.density,
      },
    };
    expect(await checksumDocumentTemplate(template)).toBe(await checksumDocumentTemplate(reordered));
  });
});
