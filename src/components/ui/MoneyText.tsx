import { formatCurrency } from '../../lib/formatters';

interface MoneyTextProps {
  value: number | string | null | undefined;
  className?: string;
  compact?: boolean;
  suffix?: string;
}

function formatCompactCfa(value: number) {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  const format = (amount: number) => Number.isInteger(amount)
    ? amount.toLocaleString('fr-FR', { maximumFractionDigits: 0 })
    : amount.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

  if (abs >= 1_000_000_000) {
    return `${sign}${format(abs / 1_000_000_000)} Md F CFA`;
  }

  if (abs >= 1_000_000) {
    return `${sign}${format(abs / 1_000_000)} M F CFA`;
  }

  if (abs >= 100_000) {
    return `${sign}${format(abs / 1_000)} k F CFA`;
  }

  return `${sign}${abs.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} F CFA`;
}

export function MoneyText({ value, className = '', compact = false, suffix }: MoneyTextProps) {
  const numericValue = typeof value === 'number' ? value : Number(value ?? 0);
  const label = Number.isFinite(numericValue) ? formatCurrency(numericValue) : String(value ?? '0 F CFA');
  const display = Number.isFinite(numericValue) && compact ? formatCompactCfa(numericValue) : label;
  const visible = suffix ? `${display} ${suffix}` : display;

  return (
    <span className={`inline-flex max-w-full items-baseline whitespace-nowrap tabular-nums ${className}`} title={suffix ? `${label} ${suffix}` : label}>
      {visible}
    </span>
  );
}
