import { describe, expect, it } from 'vitest';
import {
  OFFLINE_MUTATION_POLICY,
  OFFLINE_MUTATION_BLOCKED_MESSAGE,
} from '../offlineQueue';
import { getCacheTtlMs, isOfflineError } from '../offlineReadCache';

describe('offline safety policy', () => {
  it('ne rejoue hors ligne que les ecritures locataire non destructives', () => {
    expect(Object.values(OFFLINE_MUTATION_POLICY)).toHaveLength(9);
    expect(OFFLINE_MUTATION_POLICY.locataire_create).toBe('replayable');
    expect(OFFLINE_MUTATION_POLICY.locataire_update).toBe('replayable');
    expect(OFFLINE_MUTATION_POLICY.locataire_delete).toBe('forbidden');
    expect(OFFLINE_MUTATION_POLICY.paiement_create).toBe('forbidden');
    expect(OFFLINE_MUTATION_POLICY.contrat_create).toBe('forbidden');
    expect(OFFLINE_MUTATION_BLOCKED_MESSAGE).toContain('connexion active');
  });

  it('applique un TTL plus court aux donnees financieres', () => {
    expect(getCacheTtlMs('paiements-page')).toBe(15 * 60 * 1000);
    expect(getCacheTtlMs('financial-dashboard:owner')).toBe(15 * 60 * 1000);
    expect(getCacheTtlMs('documents-page')).toBe(30 * 60 * 1000);
    expect(getCacheTtlMs('bailleurs-page')).toBe(60 * 60 * 1000);
  });

  it("ne classe pas une erreur d'autorisation comme erreur reseau", () => {
    expect(isOfflineError(new Error('permission denied for relation paiements'))).toBe(false);
    expect(isOfflineError(new Error('Failed to fetch'))).toBe(true);
  });
});
