import { describe, it, expect } from 'vitest';
import {
  calculateCommission,
  validateCommission,
  getCommissionOrNull,
  isCommissionMissing,
  CommissionRequiredError,
  CommissionRangeError,
} from '../commissionService';

describe('calculateCommission', () => {
  it('calcule correctement parts agence et bailleur', () => {
    const result = calculateCommission(100_000, 5);
    expect(result.partAgence).toBe(5_000);
    expect(result.partBailleur).toBe(95_000);
    expect(result.tauxCommission).toBe(5);
  });

  it('partAgence + partBailleur = montantTotal (cohérence)', () => {
    const montant = 123_456;
    const { partAgence, partBailleur } = calculateCommission(montant, 8);
    expect(partAgence + partBailleur).toBe(montant);
  });

  it('fonctionne avec 100% de commission', () => {
    const result = calculateCommission(50_000, 100);
    expect(result.partAgence).toBe(50_000);
    expect(result.partBailleur).toBe(0);
  });

  it('lance CommissionRequiredError si commission est null', () => {
    expect(() => calculateCommission(100_000, null)).toThrow(CommissionRequiredError);
  });

  it('lance CommissionRequiredError si commission est undefined', () => {
    expect(() => calculateCommission(100_000, undefined)).toThrow(CommissionRequiredError);
  });

  it('lance CommissionRangeError si commission > 100', () => {
    expect(() => calculateCommission(100_000, 101)).toThrow(CommissionRangeError);
  });

  it('lance CommissionRangeError si commission < 0', () => {
    expect(() => calculateCommission(100_000, -1)).toThrow(CommissionRangeError);
  });

  it("inclut le contratId dans le message d'erreur CommissionRequired", () => {
    try {
      calculateCommission(100_000, null, 'contrat-abc');
    } catch (e) {
      expect((e as Error).message).toContain('contrat-abc');
    }
  });
});

describe('validateCommission', () => {
  it('ne lance pas d\'erreur pour une valeur valide', () => {
    expect(() => validateCommission(10)).not.toThrow();
    expect(() => validateCommission(0.5)).not.toThrow();
    expect(() => validateCommission(100)).not.toThrow();
  });

  it('lance une erreur pour null', () => {
    expect(() => validateCommission(null)).toThrow(CommissionRequiredError);
  });

  it('lance une erreur pour undefined', () => {
    expect(() => validateCommission(undefined)).toThrow(CommissionRequiredError);
  });

  it('lance CommissionRangeError pour des valeurs hors bornes', () => {
    expect(() => validateCommission(150)).toThrow(CommissionRangeError);
    expect(() => validateCommission(-5)).toThrow(CommissionRangeError);
  });
});

describe('getCommissionOrNull', () => {
  it('retourne la valeur si valide', () => {
    expect(getCommissionOrNull(10)).toBe(10);
    expect(getCommissionOrNull(0)).toBe(0);
  });

  it('retourne null si null ou undefined', () => {
    expect(getCommissionOrNull(null)).toBeNull();
    expect(getCommissionOrNull(undefined)).toBeNull();
  });

  it('retourne null si hors bornes', () => {
    expect(getCommissionOrNull(-1)).toBeNull();
    expect(getCommissionOrNull(101)).toBeNull();
  });
});

describe('isCommissionMissing', () => {
  it('retourne true si commission manquante', () => {
    expect(isCommissionMissing(null)).toBe(true);
    expect(isCommissionMissing(undefined)).toBe(true);
  });

  it('retourne false si commission présente et valide', () => {
    expect(isCommissionMissing(5)).toBe(false);
    expect(isCommissionMissing(100)).toBe(false);
  });

  it('retourne true si commission hors bornes', () => {
    expect(isCommissionMissing(-1)).toBe(true);
    expect(isCommissionMissing(150)).toBe(true);
  });
});
