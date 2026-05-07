type BrandTone = 'dark' | 'light' | 'mono';
type BrandSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

interface BrandMarkProps {
  size?: BrandSize;
  tone?: BrandTone;
  animated?: boolean;
  className?: string;
  withTile?: boolean;
}

interface BrandLogoProps extends BrandMarkProps {
  showTagline?: boolean;
  stacked?: boolean;
}

const MARK_SIZE: Record<BrandSize, string> = {
  xs: 'h-7 w-7',
  sm: 'h-9 w-9',
  md: 'h-11 w-11',
  lg: 'h-14 w-14',
  xl: 'h-20 w-20',
};

const TEXT_SIZE: Record<BrandSize, string> = {
  xs: 'text-sm',
  sm: 'text-base',
  md: 'text-lg',
  lg: 'text-2xl',
  xl: 'text-4xl',
};

export function BrandMark({
  size = 'md',
  tone = 'dark',
  animated = false,
  className = '',
  withTile = true,
}: BrandMarkProps) {
  const isLight = tone === 'light';
  const tileClass = withTile
    ? isLight
      ? 'bg-[#F2EDE3] shadow-[0_18px_42px_rgba(13,27,22,0.18)] ring-1 ring-[#DED6C8]'
      : 'bg-[radial-gradient(circle_at_35%_12%,rgba(31,59,46,0.92),rgba(13,27,22,0.98)_58%)] shadow-[0_20px_70px_rgba(8,17,14,0.42)] ring-1 ring-[#BEE7B8]/18'
    : '';
  const monoClass = tone === 'mono' ? 'grayscale contrast-125' : '';

  return (
    <span
      className={`sk-brand-mark ${animated ? 'sk-brand-mark-animated' : ''} ${MARK_SIZE[size]} ${withTile ? 'rounded-lg p-[18%]' : ''} ${tileClass} ${className}`}
      aria-hidden="true"
    >
      <img
        src="/brand-mark.png"
        alt=""
        decoding="async"
        className={`sk-brand-image h-full w-full object-contain ${monoClass}`}
      />
    </span>
  );
}

export function BrandLogo({
  size = 'md',
  tone = 'dark',
  animated = false,
  className = '',
  showTagline = false,
  stacked = false,
  withTile = true,
}: BrandLogoProps) {
  const isDark = tone === 'dark';

  return (
    <div className={`flex ${stacked ? 'flex-col text-center' : 'items-center'} gap-3 ${className}`}>
      <BrandMark size={size} tone={tone} animated={animated} withTile={withTile} />
      <div className={stacked ? 'mt-1' : 'min-w-0'}>
        <p className={`${TEXT_SIZE[size]} font-black tracking-[0.24em] ${isDark ? 'text-white' : 'text-brand-950'}`}>
          SAMAY KEUR
        </p>
        {showTagline && (
          <p className={`mt-1 text-[0.62rem] font-black uppercase tracking-[0.34em] ${isDark ? 'text-action-500' : 'text-action-600'}`}>
            Manage. Grow. Prosper.
          </p>
        )}
      </div>
    </div>
  );
}

export function BrandedLoader({ label = 'Chargement...' }: { label?: string }) {
  return (
    <div className="sk-brand-board-surface sk-brand-protection flex min-h-screen items-center justify-center p-6">
      <div className="text-center">
        <div className="relative mx-auto mb-5 flex h-24 w-24 items-center justify-center">
          <div className="absolute inset-0 rounded-[2rem] bg-action-500/18 blur-2xl sk-logo-breathe" />
          <BrandMark size="xl" tone="dark" animated />
        </div>
        <p className="text-sm font-black uppercase tracking-[0.28em] text-brand-paper">{label}</p>
      </div>
    </div>
  );
}
