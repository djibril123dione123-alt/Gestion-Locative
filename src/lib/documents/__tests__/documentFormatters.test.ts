/* eslint-disable @typescript-eslint/no-explicit-any */
import './setup';
import { describe, expect, it } from 'vitest';
import {
  documentTypeTitle,
  registryCategory,
  documentTypeBadge,
  lifecycleLabel,
  matchesTypeFilter,
  formatPersonName,
  formatDocumentPeriod,
} from '../documentFormatters';

describe('Documents Logic', () => {
  describe('documentTypeTitle', () => {
    it('returns human readable title for known types', () => {
      expect(documentTypeTitle('quittance')).toBe('Quittance');
      expect(documentTypeTitle('contrat')).toBe('Contrat de bail');
      expect(documentTypeTitle('rapport_bailleur')).toBe('Rapport bailleur');
    });

    it('returns a fallback title replacing underscores for unknown types', () => {
      expect(documentTypeTitle('custom_type_doc')).toBe('custom type doc');
      expect(documentTypeTitle('')).toBe('Document');
      expect(documentTypeTitle(undefined)).toBe('Document');
    });
  });

  describe('registryCategory', () => {
    it('maps document types to categories correctly', () => {
      expect(registryCategory('contrat')).toBe('contrats');
      expect(registryCategory('mandat')).toBe('contrats');
      expect(registryCategory('quittance')).toBe('administratif');
      expect(registryCategory('rapport_bailleur')).toBe('exports');
      expect(registryCategory('pdf')).toBe('exports');
      expect(registryCategory('unknown_type')).toBe('archives');
    });
  });

  describe('documentTypeBadge', () => {
    it('maps items to appropriate badges', () => {
      expect(documentTypeBadge({ documentType: 'quittance' } as any)).toBe('QUITTANCES');
      expect(documentTypeBadge({ documentType: 'contrat' } as any)).toBe('CONTRATS');
      expect(documentTypeBadge({ documentType: 'rapport_bailleur' } as any)).toBe('RAPPORTS');
      
      // Uploaded without subject
      expect(documentTypeBadge({ source: 'uploaded', businessContext: {} } as any)).toBe('DOCUMENT LIBRE');
      
      // Uploaded with justificatif category
      expect(documentTypeBadge({ source: 'uploaded', category: 'locataires', businessContext: { subject: 'test' } } as any)).toBe('JUSTIFICATIFS');
      
      // Fallback
      expect(documentTypeBadge({ source: 'uploaded', category: 'autre', businessContext: { subject: 'test' } } as any)).toBe('ADMINISTRATIF');
    });
  });

  describe('lifecycleLabel', () => {
    it('returns proper labels for lifecycles', () => {
      expect(lifecycleLabel({ lifecycleStatus: 'archived' } as any)).toBe('Archivé');
      expect(lifecycleLabel({ lifecycleStatus: 'temporary' } as any)).toBe('À revoir');
      expect(lifecycleLabel({ lifecycleStatus: 'orphaned' } as any)).toBe('À classer');
      // active
      expect(lifecycleLabel({ lifecycleStatus: 'active' } as any)).toBe('Actif');
    });
  });

  describe('matchesTypeFilter', () => {
    it('filters correctly for unclassified', () => {
      expect(matchesTypeFilter({ lifecycleStatus: 'orphaned' } as any, 'unclassified')).toBe(true);
      expect(matchesTypeFilter({ lifecycleStatus: 'active' } as any, 'unclassified')).toBe(false);
    });

    it('filters correctly for noqr', () => {
      const generatedNoQr = { source: 'generated', lifecycleStatus: 'active', documentType: 'unknown' };
      // should return true because getDocumentProofState('unknown') kind !== 'verifiable'
      expect(matchesTypeFilter(generatedNoQr as any, 'noqr')).toBe(true);
      
      const uploadedDoc = { source: 'uploaded', lifecycleStatus: 'active' };
      // source is uploaded, so it's not a generated document missing QR, should be false
      expect(matchesTypeFilter(uploadedDoc as any, 'noqr')).toBe(false);
    });

    it('filters by strict document type', () => {
      expect(matchesTypeFilter({ documentType: 'quittance' } as any, 'quittance')).toBe(true);
      expect(matchesTypeFilter({ documentType: 'contrat' } as any, 'quittance')).toBe(false);
    });
  });

  describe('formatPersonName', () => {
    it('formats first and last name correctly', () => {
      expect(formatPersonName({ prenom: 'John', nom: 'Doe' })).toBe('John Doe');
      expect(formatPersonName({ prenom: null, nom: 'Doe' })).toBe('Doe');
      expect(formatPersonName(null)).toBe('');
    });
  });

  describe('formatDocumentPeriod', () => {
    it('formats YYYY-MM correctly', () => {
      expect(formatDocumentPeriod('2024-01')).toMatch(/janvier 2024/i);
    });

    it('handles empty or invalid values', () => {
      expect(formatDocumentPeriod(null)).toBe('');
      expect(formatDocumentPeriod('invalid_period')).toBe('invalid_period');
    });
  });
});
