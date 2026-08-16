import { describe, expect, it, vi } from 'vitest';

const {
  registerDocumentVerificationCommand,
  linkDocumentVerificationRegistryCommand,
  revokeDocumentVerificationCommand,
  allocateDocumentReferenceRpc,
  supabaseRpc,
} = vi.hoisted(() => {
  const allocateDocumentReferenceRpc = vi.fn();
  const supabaseRpc = vi.fn(async (name: string) => {
    if (name === 'allocate_document_reference') {
      allocateDocumentReferenceRpc();
      return { data: 'SHOULD-NEVER-BE-USED-IN-PREVIEW', error: null };
    }
    return { data: null, error: null };
  });
  return {
    registerDocumentVerificationCommand: vi.fn(),
    linkDocumentVerificationRegistryCommand: vi.fn(),
    revokeDocumentVerificationCommand: vi.fn(),
    allocateDocumentReferenceRpc,
    supabaseRpc,
  };
});

vi.mock('../../services/api/documentVerificationCommands', () => ({
  registerDocumentVerificationCommand: (...args: unknown[]) => {
    registerDocumentVerificationCommand(...args);
    return Promise.resolve({ id: 'real-verification-id', token: 'real-token' });
  },
  linkDocumentVerificationRegistryCommand: (...args: unknown[]) => {
    linkDocumentVerificationRegistryCommand(...args);
    return Promise.resolve();
  },
  revokeDocumentVerificationCommand: (...args: unknown[]) => {
    revokeDocumentVerificationCommand(...args);
    return Promise.resolve();
  },
}));

vi.mock('../supabase', () => ({
  supabase: {
    rpc: supabaseRpc,
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
    }),
  },
}));

import { getOfficialDocumentTemplate } from '../documents/templateCatalog';
import {
  buildContratPreviewDocument,
  buildMandatPreviewDocument,
  buildPaiementReceiptPreviewDocument,
} from '../pdf';

// Modèle officiel réaliste : les clauses du contrat/mandat référencent des
// mentions légales ({{mention_penalites}}, {{agency_address}}, ...) qui
// doivent être non vides — comme le serait une vraie ligne agency_settings.
const minimalSettings = {
  nom_agence: 'Agence de test',
  adresse: 'Dakar, Sénégal',
  ninea: '000000000',
  rc: 'SN-DKR-2026-A-00000',
  representant_nom: 'Le Représentant',
  representant_fonction: 'Gérant',
  manager_id_type: 'CNI',
  manager_id_number: '0000000000000',
  city: 'Dakar',
  mention_penalites: 'Pénalités de retard applicables selon le bail.',
  mention_frais_huissier: 'Frais réels à la charge du débiteur.',
  mention_litige: 'Tout litige relève des juridictions compétentes de Dakar.',
  couleur_primaire: '#0A3F30',
  couleur_secondaire: '#334155',
};

describe('aperçu de documents (buildXxxPreviewDocument)', () => {
  it('génère un contrat sans écrire de preuve de vérification en base', async () => {
    const content = getOfficialDocumentTemplate('contrat');
    const doc = await buildContratPreviewDocument(content, minimalSettings);

    expect(doc.output('blob')).toBeInstanceOf(Blob);
    expect(registerDocumentVerificationCommand).not.toHaveBeenCalled();
    expect(allocateDocumentReferenceRpc).not.toHaveBeenCalled();
  });

  it('génère une quittance (paiement soldé) sans écrire de preuve en base', async () => {
    const content = getOfficialDocumentTemplate('quittance');
    const doc = await buildPaiementReceiptPreviewDocument(content, minimalSettings, 0);

    expect(doc.output('blob')).toBeInstanceOf(Blob);
    expect(registerDocumentVerificationCommand).not.toHaveBeenCalled();
  });

  it('génère un reçu de paiement partiel (reliquat > 0) sans écrire de preuve en base', async () => {
    const content = getOfficialDocumentTemplate('quittance');
    const doc = await buildPaiementReceiptPreviewDocument(content, minimalSettings, 45_000);

    expect(doc.output('blob')).toBeInstanceOf(Blob);
    expect(registerDocumentVerificationCommand).not.toHaveBeenCalled();
  });

  it('génère un mandat sans écrire de preuve en base', async () => {
    const content = getOfficialDocumentTemplate('mandat');
    const doc = await buildMandatPreviewDocument(content, minimalSettings);

    expect(doc.output('blob')).toBeInstanceOf(Blob);
    expect(registerDocumentVerificationCommand).not.toHaveBeenCalled();
  });

  it("n'appelle jamais allocate_document_reference pour un aperçu", async () => {
    allocateDocumentReferenceRpc.mockClear();
    await buildContratPreviewDocument(getOfficialDocumentTemplate('contrat'), minimalSettings);
    await buildPaiementReceiptPreviewDocument(getOfficialDocumentTemplate('quittance'), minimalSettings, 0);
    await buildMandatPreviewDocument(getOfficialDocumentTemplate('mandat'), minimalSettings);
    expect(allocateDocumentReferenceRpc).not.toHaveBeenCalled();
  });
});
