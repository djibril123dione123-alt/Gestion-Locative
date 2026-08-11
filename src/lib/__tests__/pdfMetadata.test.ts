import { describe, expect, it, vi } from 'vitest';
import {
  applyPdfMetadata,
  type PdfMetadataDocumentType,
} from '../pdfMetadata';

const documentTypes: Array<{
  type: PdfMetadataDocumentType;
  title: string;
  subject: string;
}> = [
  {
    type: 'contrat',
    title: 'Contrat de location',
    subject: 'Contrat de location',
  },
  {
    type: 'mandat',
    title: 'Mandat de gestion',
    subject: 'Mandat de gestion immobilière',
  },
  {
    type: 'quittance',
    title: 'Quittance de loyer',
    subject: 'Quittance de loyer',
  },
  { type: 'facture', title: 'Facture', subject: 'Facture de gestion locative' },
  {
    type: 'rapport_bailleur',
    title: 'Rapport bailleur',
    subject: 'Rapport financier de gestion locative',
  },
  {
    type: 'rapport_proprietaire',
    title: 'Rapport propriétaire',
    subject: 'Rapport financier de gestion locative',
  },
  {
    type: 'due_notice',
    title: "Avis d'échéance",
    subject: "Avis d'échéance de loyer",
  },
  {
    type: 'rent_invoice',
    title: 'Facture de loyer',
    subject: 'Facture de loyer',
  },
  {
    type: 'partial_payment_receipt',
    title: 'Reçu de paiement partiel',
    subject: 'Reçu de paiement partiel de loyer',
  },
  {
    type: 'rent_receipt',
    title: 'Quittance de loyer',
    subject: 'Quittance de loyer acquittée',
  },
  {
    type: 'credit_note',
    title: 'Avoir locatif',
    subject: 'Avoir sur échéance locative',
  },
  {
    type: 'inventaire',
    title: 'Inventaire',
    subject: 'Inventaire immobilier',
  },
  {
    type: 'commission',
    title: 'Rapport de commissions',
    subject: 'Rapport de commissions de gestion',
  },
];

describe('applyPdfMetadata', () => {
  it.each(documentTypes)(
    'applique les métadonnées publiques au document $type',
    ({ type, title, subject }) => {
      const setProperties = vi.fn();
      const setCreationDate = vi.fn();
      applyPdfMetadata(
        { setProperties, setCreationDate },
        {
          documentType: type,
          reference: 'REF-001',
          agencyName: 'Agence Démo',
          createdAt: '2026-07-20T10:00:00.000Z',
        },
      );

      expect(setProperties).toHaveBeenCalledWith(
        expect.objectContaining({
          title: expect.stringContaining(title),
          author: 'Agence Démo',
          subject,
          keywords: expect.stringContaining('Samay Këur'),
          creator: 'Samay Këur',
        }),
      );
      expect(setCreationDate).toHaveBeenCalledWith(
        new Date('2026-07-20T10:00:00.000Z'),
      );
    },
  );

  it('utilise un titre et un sujet explicites lorsqu’ils sont fournis', () => {
    const setProperties = vi.fn();
    applyPdfMetadata(
      { setProperties },
      {
        documentType: 'facture',
        title: 'Facture FAC-002',
        subject: 'Facture acquittée',
      },
    );

    expect(setProperties).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Facture FAC-002',
        subject: 'Facture acquittée',
      }),
    );
  });
});
