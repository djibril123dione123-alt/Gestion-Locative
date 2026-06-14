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
  const formatScaled = (amount: number) => {
    const rounded = Math.round(amount * 10) / 10;
    return rounded.toLocaleString('fr-FR', {
      minimumFractionDigits: Number.isInteger(rounded) ? 0 : 1,
      maximumFractionDigits: Number.isInteger(rounded) ? 0 : 1,
    });
  };

  if (abs >= 1_000_000_000) {
    return `${sign}${formatScaled(abs / 1_000_000_000)} Md F CFA`;
  }

  if (abs >= 1_000_000) {
    return `${sign}${formatScaled(abs / 1_000_000)} M F CFA`;
  }

  if (abs >= 100_000) {
    return `${sign}${Math.round(abs / 1_000).toLocaleString('fr-FR', { maximumFractionDigits: 0 })} k F CFA`;
  }

  return `${sign}${abs.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} F CFA`;
}

export function MoneyText({ value, className = '', compact = false, suffix }: MoneyTextProps) {
  const numericValue = typeof value === 'number' ? value : Number(value ?? 0);
  const label = Number.isFinite(numericValue) ? formatCurrency(numericValue) : String(value ?? '0 F CFA');
  const display = Number.isFinite(numericValue) && compact ? formatCompactCfa(numericValue) : label;
  const visible = suffix ? `${display} ${suffix}` : display;

  if (Number.isFinite(numericValue) && compact) {
    const compactDisplay = formatCompactCfa(numericValue);
    const compactVisible = suffix ? `${compactDisplay} ${suffix}` : compactDisplay;
    const fullVisible = suffix ? `${label} ${suffix}` : label;

    return (
      <span className={`@container flex w-full max-w-full items-baseline whitespace-nowrap tabular-nums ${className}`} title={fullVisible}>
        <span className="@tiny:hidden">{compactVisible}</span>
        <span className="hidden @tiny:inline">{fullVisible}</span>
      </span>
    );
  }

  return (
    <span className={`inline-flex max-w-full items-baseline whitespace-nowrap tabular-nums ${className}`} title={visible}>
      {visible}
    </span>
  );
}
