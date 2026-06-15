export const CFA_SETTLEMENT_TOLERANCE = 3;

export function applyCfaSettlementTolerance(value: number) {
  return Math.abs(value) <= CFA_SETTLEMENT_TOLERANCE ? 0 : value;
}
