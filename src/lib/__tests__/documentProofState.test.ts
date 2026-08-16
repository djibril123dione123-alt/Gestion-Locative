import { describe, expect, it } from 'vitest';
import { getDocumentProofState } from '../../components/documents/documentProofState';

const generatedDocument = {
  source: 'generated' as const,
  lifecycleStatus: 'active',
  documentType: 'quittance',
};

describe('getDocumentProofState', () => {
  it('marks an authentic registered proof as QR verifiable', () => {
    expect(getDocumentProofState({ ...generatedDocument, verification: { status: 'authentic' } }).kind).toBe('verifiable');
  });

  it('requires review when a QR-capable generated document has no proof row', () => {
    expect(getDocumentProofState(generatedDocument)).toMatchObject({ kind: 'review', label: 'À vérifier' });
  });

  it('does not advertise an uploaded document as verifiable', () => {
    expect(getDocumentProofState({ source: 'uploaded', lifecycleStatus: 'active', documentType: 'quittance' }).kind).toBe('non_verifiable');
  });

  it.each([['revoked', 'revoked'], ['superseded', 'superseded']] as const)(
    'preserves the %s server proof state',
    (status, expected) => {
      expect(getDocumentProofState({ ...generatedDocument, verification: { status } }).kind).toBe(expected);
    }
  );

  it('shows an archived lifecycle before an otherwise authentic proof', () => {
    expect(getDocumentProofState({ ...generatedDocument, lifecycleStatus: 'archived', verification: { status: 'authentic' } }).kind).toBe('archived');
  });

  it('keeps generated non-QR document types non-verifiable', () => {
    expect(getDocumentProofState({ ...generatedDocument, documentType: 'document' }).kind).toBe('non_verifiable');
  });

  it.each([
    'due_notice',
    'rent_invoice',
    'partial_payment_receipt',
    'rent_receipt',
    'credit_note',
  ] as const)('requires review for rental-due document type %s with no proof row yet', (documentType) => {
    expect(getDocumentProofState({ ...generatedDocument, documentType })).toMatchObject({ kind: 'review', label: 'À vérifier' });
  });

  it.each([
    'due_notice',
    'rent_invoice',
    'partial_payment_receipt',
    'rent_receipt',
    'credit_note',
  ] as const)('marks rental-due document type %s as QR verifiable once authentic', (documentType) => {
    expect(getDocumentProofState({ ...generatedDocument, documentType, verification: { status: 'authentic' } }).kind).toBe('verifiable');
  });
});
