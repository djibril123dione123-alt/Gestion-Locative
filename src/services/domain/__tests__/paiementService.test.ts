import { describe, it, expect } from 'vitest';
import {
  buildPaiementPayload,
  formatPaiementError,
  PaiementValidationError,
} from '../paiementService';
import { CommissionRequiredError } from '../commissionService';

const validForm = {
  contrat_id: 'contrat-001',
  montant_total: 150_000,
  mois_concerne: '2026-05-01',
  date_paiement: '2026-05-03',
  mode_paiement: 'especes' as const,
  statut: 'paye' as const,
  reference: null,
};

const validContrat = {
  id: 'contrat-001',
  commission: 8,
  loyer_mensuel: 150_000,
};

const agencyId = 'agency-123';

describe('buildPaiementPayload', () => {
  it('construit un payload valide avec les parts correctes', () => {
    const payload = buildPaiementPayload(validForm, validContrat, agencyId);
    expect(payload.contrat_id).toBe('contrat-001');
    expect(payload.montant_total).toBe(150_000);
    expect(payload.part_agence).toBe(12_000);
    expect(payload.part_bailleur).toBe(138_000);
    expect(payload.agency_id).toBe(agencyId);
    expect(payload.part_agence + payload.part_bailleur).toBe(payload.montant_total);
  });

  it('lance PaiementValidationError si contrat_id manquant', () => {
    expect(() =>
      buildPaiementPayload({ ...validForm, contrat_id: '' }, validContrat, agencyId),
    ).toThrow(PaiementValidationError);
  });

  it('lance PaiementValidationError si montant_total est 0', () => {
    expect(() =>
      buildPaiementPayload({ ...validForm, montant_total: 0 }, validContrat, agencyId),
    ).toThrow(PaiementValidationError);
  });

  it('lance PaiementValidationError si montant_total est négatif', () => {
    expect(() =>
      buildPaiementPayload({ ...validForm, montant_total: -500 }, validContrat, agencyId),
    ).toThrow(PaiementValidationError);
  });

  it('lance PaiementValidationError si mois_concerne manquant', () => {
    expect(() =>
      buildPaiementPayload({ ...validForm, mois_concerne: '' }, validContrat, agencyId),
    ).toThrow(PaiementValidationError);
  });

  it('lance PaiementValidationError si date_paiement manquante', () => {
    expect(() =>
      buildPaiementPayload({ ...validForm, date_paiement: '' }, validContrat, agencyId),
    ).toThrow(PaiementValidationError);
  });

  it('lance CommissionRequiredError si commission null sur le contrat', () => {
    expect(() =>
      buildPaiementPayload(
        validForm,
        { ...validContrat, commission: null },
        agencyId,
      ),
    ).toThrow(CommissionRequiredError);
  });

  it('inclut la référence dans le payload', () => {
    const payload = buildPaiementPayload(
      { ...validForm, reference: 'CHQ-12345' },
      validContrat,
      agencyId,
    );
    expect(payload.reference).toBe('CHQ-12345');
  });

  it('normalise reference null si absent', () => {
    const payload = buildPaiementPayload(
      { ...validForm, reference: undefined },
      validContrat,
      agencyId,
    );
    expect(payload.reference).toBeNull();
  });
});

describe('formatPaiementError', () => {
  it('formate PaiementValidationError', () => {
    const err = new PaiementValidationError('Montant invalide');
    expect(formatPaiementError(err)).toBe('Montant invalide');
  });

  it('formate CommissionRequiredError', () => {
    const err = new CommissionRequiredError('contrat-xyz');
    const msg = formatPaiementError(err);
    expect(msg).toContain('commission');
  });

  it('formate une Error générique', () => {
    expect(formatPaiementError(new Error('Connexion perdue'))).toBe('Connexion perdue');
  });

  it('retourne un message par défaut pour les erreurs inconnues', () => {
    expect(formatPaiementError('unknown')).toContain('erreur');
  });
});
