import { describe, expect, it } from 'vitest';
import {
  formatSenegalCniInput,
  SENEGAL_CNI_MESSAGES,
  validateSenegalCni,
} from '../senegalIdentity';

describe('Senegal biometric CNI', () => {
  it('formats 17 useful digits with the official visual grouping', () => {
    expect(formatSenegalCniInput('10119950825001234')).toBe('1 01 19950825 00123 4');
  });

  it('filters non-digits and caps the useful value at 17 digits', () => {
    expect(formatSenegalCniInput('1a01-19950825 00123 499')).toBe('1 01 19950825 00123 4');
  });

  it('rejects a first digit other than 1 or 2 immediately', () => {
    expect(validateSenegalCni('3')).toBe(SENEGAL_CNI_MESSAGES.gender);
  });

  it('reports an incomplete CNI during strict form validation', () => {
    expect(validateSenegalCni('1 01 1995', false)).toBe(SENEGAL_CNI_MESSAGES.length);
  });

  it('rejects an invalid Senegal region code', () => {
    expect(validateSenegalCni('1 15 19950825 00123 4', false)).toBe(SENEGAL_CNI_MESSAGES.region);
  });

  it('rejects impossible and future birth dates', () => {
    expect(validateSenegalCni('1 01 19950230 00123 4', false)).toBe(SENEGAL_CNI_MESSAGES.birthDate);
    expect(validateSenegalCni('2 14 29990101 99999 9', false)).toBe(SENEGAL_CNI_MESSAGES.birthDate);
  });

  it('accepts valid male and female biometric CNI structures', () => {
    expect(validateSenegalCni('1 01 19950825 00123 4', false)).toBeNull();
    expect(validateSenegalCni('2 14 20001231 99999 0', false)).toBeNull();
  });
});
