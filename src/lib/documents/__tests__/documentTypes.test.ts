import { describe, expect, it } from 'vitest';
import { getDocumentTypeLabel, RENTAL_DUE_DOCUMENT_TYPES } from '../documentTypes';

describe('getDocumentTypeLabel', () => {
  it('resolves known types to their canonical label regardless of fallback mode', () => {
    expect(getDocumentTypeLabel('quittance', { fallback: 'humanize' })).toBe('Quittance');
    expect(getDocumentTypeLabel('quittance', { fallback: 'raw' })).toBe('Quittance');
    expect(getDocumentTypeLabel('quittance', { fallback: 'generic' })).toBe('Quittance');
  });

  it('resolves every rental-due document type', () => {
    for (const type of RENTAL_DUE_DOCUMENT_TYPES) {
      expect(getDocumentTypeLabel(type)).not.toBe('Document');
    }
    expect(getDocumentTypeLabel('rent_invoice')).toBe('Facture de loyer');
    expect(getDocumentTypeLabel('due_notice')).toBe("Avis d'échéance de loyer");
  });

  it('is case-insensitive on the type key', () => {
    expect(getDocumentTypeLabel('QUITTANCE')).toBe('Quittance');
  });

  it.each(['humanize', 'raw', 'generic'] as const)('fallback=%s handles empty/undefined input', (fallback) => {
    expect(getDocumentTypeLabel(undefined, { fallback })).toBe('Document');
    expect(getDocumentTypeLabel(null, { fallback })).toBe('Document');
  });

  it('fallback=humanize replaces underscores for unknown types', () => {
    expect(getDocumentTypeLabel('custom_type_doc', { fallback: 'humanize' })).toBe('custom type doc');
  });

  it('fallback=raw returns the type string itself for unknown types', () => {
    expect(getDocumentTypeLabel('some_weird_type', { fallback: 'raw' })).toBe('some_weird_type');
  });

  it('fallback=generic always returns Document for unknown types', () => {
    expect(getDocumentTypeLabel('some_weird_type', { fallback: 'generic' })).toBe('Document');
  });
});
