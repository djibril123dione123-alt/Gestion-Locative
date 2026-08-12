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

const MARK_SRC: Record<BrandTone, string> = {
  dark: '/brand/app-icon-primary.png',
  light: '/brand/app-icon-light.png',
  mono: '/brand/app-icon-monochrome.png',
};

const LOCKUP_SRC: Record<BrandTone, string> = {
  dark: '/brand/logo-lockup-dark.png',
  light: '/brand/presentation-light.png',
  mono: '/brand/logo-monochrome-lockup.png',
};

export function BrandMark({
  size = 'md',
  tone = 'dark',
  animated = false,
  className = '',
  withTile = true,
}: BrandMarkProps) {
  const isLight = tone === 'light';
  const src = withTile ? MARK_SRC[tone] : '/brand/mark-transparent.png';
  const tileClass = withTile
    ? isLight
      ? 'bg-[#F2EDE3] shadow-[0_18px_42px_rgba(13,27,22,0.18)] ring-1 ring-[#DED6C8]'
      : 'bg-[radial-gradient(circle_at_35%_12%,rgba(31,59,46,0.92),rgba(13,27,22,0.98)_58%)] shadow-[0_20px_70px_rgba(8,17,14,0.42)] ring-1 ring-[#BEE7B8]/18'
    : '';

  return (
    <span
      className={`sk-brand-mark ${animated ? 'sk-brand-mark-animated' : ''} ${MARK_SIZE[size]} ${withTile ? 'rounded-lg p-0' : ''} ${tileClass} ${className}`}
      aria-hidden="true"
    >
      <img
        src={src}
        alt=""
        decoding="async"
        className="sk-brand-image h-full w-full object-contain"
      />
    </span>
  );
}

export function BrandLockup({
  tone = 'dark',
  animated = false,
  className = '',
}: {
  tone?: BrandTone;
  animated?: boolean;
  className?: string;
}) {
  return (
    <img
      src={LOCKUP_SRC[tone]}
      alt="Samay Këur - Centralisez. Gérez. Maîtrisez."
      decoding="async"
      className={`sk-brand-lockup ${animated ? 'sk-brand-lockup-animated' : ''} ${className}`}
    />
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
          SAMAY KËUR
        </p>
        {showTagline && (
          <p className={`mt-1 text-[0.62rem] font-black uppercase tracking-[0.34em] ${isDark ? 'text-champagne-100' : 'text-champagne-700'}`}>
            Centralisez. Gérez. Maîtrisez.
          </p>
        )}
      </div>
    </div>
  );
}

export function BrandedLoader({ label = 'Chargement...' }: { label?: string }) {
  return (
    <div className="sk-splash-screen sk-brand-board-surface sk-brand-protection flex min-h-screen items-center justify-center p-6">
      <div className="sk-splash-card text-center">
        <div className="relative mx-auto mb-6 flex h-28 w-28 items-center justify-center rounded-lg">
          <div className="absolute inset-0 rounded-lg bg-champagne/18 blur-2xl sk-logo-breathe" />
          <BrandMark size="xl" tone="dark" animated className="relative z-10" />
        </div>
        <p className="text-sm font-black uppercase tracking-[0.28em] text-brand-paper">{label}</p>
        <p className="mt-2 text-[0.62rem] font-black uppercase tracking-[0.34em] text-champagne-100">Centralisez. Gérez. Maîtrisez.</p>
      </div>
    </div>
  );
}
