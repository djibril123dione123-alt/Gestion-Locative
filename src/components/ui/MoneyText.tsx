import { formatCurrency } from '../../lib/formatters';

interface MoneyTextProps {
  value: number | string | null | undefined;
  className?: string;
  compact?: boolean;
}

export function MoneyText({ value, className = '', compact = false }: MoneyTextProps) {
  const numericValue = typeof value === 'number' ? value : Number(value ?? 0);
  const label = Number.isFinite(numericValue) ? formatCurrency(numericValue) : String(value ?? '0 F CFA');
  const display = compact ? label.replace(/\sF CFA$/, '\u00a0F') : label;

  return (
    <span className={`inline-block whitespace-nowrap tabular-nums ${className}`} title={label}>
      {display}
    </span>
  );
}
