export type PdfMetadataDocumentType =
  | 'contrat'
  | 'mandat'
  | 'quittance'
  | 'facture'
  | 'rapport_bailleur'
  | 'rapport_proprietaire'
  | 'inventaire'
  | 'commission'
  | 'document';

interface PdfMetadataTarget {
  setProperties: (properties: {
    title?: string;
    subject?: string;
    author?: string;
    keywords?: string;
    creator?: string;
  }) => unknown;
  setCreationDate?: (date: Date) => unknown;
}

export interface PdfMetadataInput {
  documentType: PdfMetadataDocumentType;
  reference?: string;
  agencyName?: string;
  subject?: string;
  createdAt?: string | Date;
  partyName?: string;
  period?: string;
  title?: string;
}

const TYPE_COPY: Record<
  PdfMetadataDocumentType,
  { title: string; subject: string; keywords: string }
> = {
  contrat: {
    title: 'Contrat de location',
    subject: 'Contrat de location',
    keywords: 'Samay Këur, contrat, location, bail',
  },
  mandat: {
    title: 'Mandat de gestion',
    subject: 'Mandat de gestion immobilière',
    keywords: 'Samay Këur, mandat, gestion immobilière, bailleur',
  },
  quittance: {
    title: 'Quittance de loyer',
    subject: 'Quittance de loyer',
    keywords: 'Samay Këur, quittance, loyer, paiement',
  },
  facture: {
    title: 'Facture',
    subject: 'Facture de gestion locative',
    keywords: 'Samay Këur, facture, gestion locative, paiement',
  },
  rapport_bailleur: {
    title: 'Rapport bailleur',
    subject: 'Rapport financier de gestion locative',
    keywords: 'Samay Këur, rapport bailleur, gestion locative, finance',
  },
  rapport_proprietaire: {
    title: 'Rapport propriétaire',
    subject: 'Rapport financier de gestion locative',
    keywords: 'Samay Këur, rapport propriétaire, gestion locative, finance',
  },
  inventaire: {
    title: 'Inventaire',
    subject: 'Inventaire immobilier',
    keywords: 'Samay Këur, inventaire, immobilier, document',
  },
  commission: {
    title: 'Rapport de commissions',
    subject: 'Rapport de commissions de gestion',
    keywords: 'Samay Këur, commissions, rapport, gestion locative',
  },
  document: {
    title: 'Document',
    subject: 'Document de gestion locative',
    keywords: 'Samay Këur, gestion locative, document',
  },
};

function joinTitle(parts: Array<string | undefined>) {
  return parts.filter((part): part is string => Boolean(part?.trim())).join(' — ');
}

export function applyPdfMetadata(
  doc: PdfMetadataTarget,
  input: PdfMetadataInput,
) {
  const copy = TYPE_COPY[input.documentType] ?? TYPE_COPY.document;
  const title =
    input.title ??
    joinTitle([
      copy.title,
      input.partyName,
      input.period,
      input.reference,
    ]);

  doc.setProperties({
    title,
    author: input.agencyName?.trim() || 'Samay Këur',
    subject: input.subject?.trim() || copy.subject,
    keywords: copy.keywords,
    creator: 'Samay Këur',
  });

  if (input.createdAt && doc.setCreationDate) {
    const creationDate =
      input.createdAt instanceof Date
        ? input.createdAt
        : new Date(input.createdAt);
    if (!Number.isNaN(creationDate.getTime())) doc.setCreationDate(creationDate);
  }
}
