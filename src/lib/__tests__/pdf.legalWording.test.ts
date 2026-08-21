import { beforeEach, describe, expect, it, vi } from 'vitest';

// jsPDF assigne ses méthodes (dont .text) comme propriétés propres de chaque
// instance construite (pas sur le prototype partagé) -- un vi.spyOn direct
// sur jsPDF.prototype ne voit donc jamais rien. On intercepte à la
// construction via un Proxy : chaque instance réellement créée par pdf.ts
// se voit patcher .text pour capturer tout texte réellement dessiné, quelle
// que soit la mise en page -- c'est le seul point de passage réel du texte.
const { capturedTexts } = vi.hoisted(() => {
  const capturedTexts: string[] = [];
  return { capturedTexts };
});

vi.mock('jspdf', async (importOriginal) => {
  const actual = await importOriginal<typeof import('jspdf')>();
  const RealJsPDF = actual.default;
  class PatchedJsPDF extends RealJsPDF {
    constructor(...args: unknown[]) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      super(...(args as any));
      const originalText = this.text.bind(this);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (this as any).text = (...callArgs: unknown[]) => {
        const first = callArgs[0];
        if (typeof first === 'string') capturedTexts.push(first);
        else if (Array.isArray(first)) {
          for (const item of first) if (typeof item === 'string') capturedTexts.push(item);
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (originalText as any)(...callArgs);
      };
    }
  }
  return { ...actual, default: PatchedJsPDF };
});

vi.mock('../../services/api/documentVerificationCommands', () => ({
  registerDocumentVerificationCommand: async () => ({ id: 'real-verification-id', token: 'real-token' }),
  linkDocumentVerificationRegistryCommand: async () => undefined,
  revokeDocumentVerificationCommand: async () => undefined,
}));

vi.mock('../supabase', () => ({
  supabase: {
    rpc: async () => ({ data: null, error: null }),
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
    }),
  },
}));

import { getOfficialDocumentTemplate } from '../documents/templateCatalog';
import { buildContratPreviewDocument, buildMandatPreviewDocument } from '../pdf';

// Les formulations que P0-1 devait retirer du chemin d'exécution réel
// (pdf.ts + defaults agency_settings) -- voir AUDIT_CONTRAT_MANDAT.
const FORBIDDEN_SUBSTRINGS = [
  'référés',
  'Tribunal de commerce de Dakar',
  'procédure judiciaire',
  'sera enclenchée',
  'conformément à la loi sénégalaise',
  'seront remboursés par le locataire',
  'préavis de deux mois',
  "d'un préavis de deux mois",
];

// Settings représentant le nouvel état par défaut réel d'agency_settings
// après la migration 20260821000000/...fix2 : mentions financières vides,
// mention_tribunal neutre.
const settingsAfterP0Fix = {
  nom_agence: 'Agence de test',
  adresse: 'Dakar, Sénégal',
  ninea: '000000000',
  rc: 'SN-DKR-2026-A-00000',
  representant_nom: 'Le Représentant',
  representant_fonction: 'Gérant',
  manager_id_type: 'CNI',
  manager_id_number: '0000000000000',
  city: 'Dakar',
  mention_tribunal: "En cas de litige, les parties s'en remettent aux juridictions compétentes déterminées par la réglementation applicable.",
  mention_penalites: 'Les pénalités prévues au bail restent applicables.',
  mention_frais_huissier: 'Les frais justifiés restent à la charge de la partie défaillante.',
  mention_litige: 'Les parties privilégient une résolution amiable.',
  couleur_primaire: '#0A3F30',
  couleur_secondaire: '#334155',
};

// Settings ne fournissant aucune des 4 mentions -- exerce le chemin de
// repli (?? ...) de pdf.ts directement, pas seulement la valeur explicite.
const settingsWithoutMentions = {
  nom_agence: 'Agence de test 2',
  adresse: 'Dakar, Sénégal',
  ninea: '000000000',
  rc: 'SN-DKR-2026-A-00000',
  representant_nom: 'Le Représentant',
  representant_fonction: 'Gérant',
  manager_id_type: 'CNI',
  manager_id_number: '0000000000000',
  city: 'Dakar',
};

describe('P0-1 — wording juridique réel du contrat et du mandat', () => {
  beforeEach(() => {
    capturedTexts.length = 0;
  });

  it('un contrat neuf (settings post-correctif) ne contient aucun ancien wording interdit', async () => {
    const content = getOfficialDocumentTemplate('contrat');
    await buildContratPreviewDocument(content, settingsAfterP0Fix);
    const rendered = capturedTexts.join('\n');

    for (const forbidden of FORBIDDEN_SUBSTRINGS) {
      expect(rendered, `"${forbidden}" ne devrait plus apparaître dans le contrat`).not.toContain(forbidden);
    }
  });

  it('un mandat neuf (settings post-correctif) ne contient aucun ancien wording interdit', async () => {
    const content = getOfficialDocumentTemplate('mandat');
    await buildMandatPreviewDocument(content, settingsAfterP0Fix);
    const rendered = capturedTexts.join('\n');

    for (const forbidden of FORBIDDEN_SUBSTRINGS) {
      expect(rendered, `"${forbidden}" ne devrait plus apparaître dans le mandat`).not.toContain(forbidden);
    }
  });

  it('le contrat affiche la clause de juridiction neutre quand mention_tribunal est personnalisée', async () => {
    const content = getOfficialDocumentTemplate('contrat');
    await buildContratPreviewDocument(content, settingsAfterP0Fix);
    const rendered = capturedTexts.join('\n');

    expect(rendered).toContain("les parties s'en remettent aux juridictions compétentes");
  });

  it('sans aucune mention configurée, le repli de pdf.ts est aussi neutre (contrat)', async () => {
    const content = getOfficialDocumentTemplate('contrat');
    await buildContratPreviewDocument(content, settingsWithoutMentions);
    const rendered = capturedTexts.join('\n');

    for (const forbidden of FORBIDDEN_SUBSTRINGS) {
      expect(rendered, `"${forbidden}" ne devrait pas apparaître même sans settings.mention_* fournis`).not.toContain(forbidden);
    }
    expect(rendered).toContain("les parties s'en remettent aux juridictions compétentes");
  });

  it('sans aucune mention configurée, le repli de pdf.ts est aussi neutre (mandat)', async () => {
    const content = getOfficialDocumentTemplate('mandat');
    await buildMandatPreviewDocument(content, settingsWithoutMentions);
    const rendered = capturedTexts.join('\n');

    for (const forbidden of FORBIDDEN_SUBSTRINGS) {
      expect(rendered, `"${forbidden}" ne devrait pas apparaître même sans settings.mention_* fournis`).not.toContain(forbidden);
    }
    expect(rendered).toContain("les parties s'en remettent aux juridictions compétentes");
  });
});
