import React, {
  type CSSProperties,
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Search } from 'lucide-react';

export interface SmartComboboxOption {
  value: string;
  label: string;
  subtitle?: string;
  keywords?: string;
  badge?: string;
  rightLabel?: ReactNode;
  initials?: string;
  disabled?: boolean;
}

interface SmartComboboxProps {
  value: string;
  options: SmartComboboxOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyLabel?: string;
  emptyActionLabel?: string;
  onEmptyAction?: () => void;
  className?: string;
  disabled?: boolean;
  density?: 'default' | 'compact' | 'dense' | 'wizard';
}

type MenuPlacement = {
  mobile: boolean;
  left: number;
  width: number;
  maxHeight: number;
  top?: number;
  bottom?: number;
};

export function SmartCombobox({
  value,
  options,
  onChange,
  placeholder = 'Sélectionner ou rechercher...',
  searchPlaceholder,
  emptyLabel = 'Aucun résultat',
  emptyActionLabel,
  onEmptyAction,
  className = '',
  disabled = false,
  density = 'default',
}: SmartComboboxProps) {
  const isWizard = density === 'wizard';
  const isCompact = density === 'compact' || density === 'dense';
  const isDense = density === 'dense';
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const [menuPlacement, setMenuPlacement] = useState<MenuPlacement | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const listboxRef = useRef<HTMLDivElement>(null);

  const selectedOption = useMemo(() => options.find((option) => option.value === value), [options, value]);

  const updateMenuPlacement = useCallback(() => {
    if (!wrapperRef.current || typeof window === 'undefined') return;

    const rect = wrapperRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const gap = 8;

    if (viewportWidth < 640) {
      setMenuPlacement({
        mobile: true,
        left: 0,
        width: viewportWidth,
        bottom: 0,
        maxHeight: Math.min(viewportHeight * (isCompact ? 0.68 : 0.85), isCompact ? 380 : 500),
      });
      return;
    }

    const minWidth = isDense ? 200 : isCompact ? 220 : 260;
    const maxWidth = isDense ? 280 : isCompact ? 300 : viewportWidth - 24;
    const width = Math.min(Math.max(rect.width, minWidth), Math.min(maxWidth, viewportWidth - 24));
    const left = Math.min(Math.max(12, rect.left), viewportWidth - width - 12);
    const spaceBelow = viewportHeight - rect.bottom - gap;
    const spaceAbove = rect.top - gap;
    const shouldOpenAbove = spaceBelow < (isCompact ? 190 : 240) && spaceAbove > spaceBelow;
    const availableSpace = shouldOpenAbove ? spaceAbove : spaceBelow;
    const maxHeight = Math.max(isCompact ? 140 : 180, Math.min(isCompact ? 260 : 340, availableSpace - 8));

    setMenuPlacement({
      mobile: false,
      left,
      width,
      maxHeight,
      top: shouldOpenAbove ? Math.max(12, rect.top - gap - maxHeight) : rect.bottom + gap,
    });
  }, [isCompact, isDense]);

  useEffect(() => {
    if (!open) {
      setQuery(selectedOption ? selectedOption.label : '');
      return;
    }

    setQuery('');
    setActiveIndex(options.length > 0 ? 0 : -1);
  }, [open, options.length, selectedOption]);

  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return options.slice(0, 80);

    return options
      .map((option) => {
        const label = option.label.toLowerCase();
        const subtitle = option.subtitle?.toLowerCase() ?? '';
        const keywords = option.keywords?.toLowerCase() ?? '';
        const haystack = [label, subtitle, keywords].join(' ');
        if (!haystack.includes(normalizedQuery)) return null;
        const startsWithScore = label.startsWith(normalizedQuery)
          || subtitle.startsWith(normalizedQuery)
          || keywords.split(' ').some((part) => part.startsWith(normalizedQuery))
          ? 0
          : 1;
        return { option, startsWithScore, indexScore: Math.max(0, haystack.indexOf(normalizedQuery)) };
      })
      .filter((entry): entry is { option: SmartComboboxOption; startsWithScore: number; indexScore: number } => entry !== null)
      .sort((a, b) => a.startsWithScore - b.startsWithScore || a.indexScore - b.indexScore || a.option.label.localeCompare(b.option.label))
      .slice(0, 80)
      .map((entry) => entry.option);
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    setActiveIndex(filteredOptions.length > 0 ? 0 : -1);
  }, [filteredOptions.length, open]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (wrapperRef.current?.contains(target) || menuRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    updateMenuPlacement();
    const handlePositionChange = () => updateMenuPlacement();
    window.addEventListener('resize', handlePositionChange);
    window.addEventListener('scroll', handlePositionChange, true);
    return () => {
      window.removeEventListener('resize', handlePositionChange);
      window.removeEventListener('scroll', handlePositionChange, true);
    };
  }, [filteredOptions.length, open, updateMenuPlacement]);

  useEffect(() => {
    if (open && activeIndex >= 0 && listboxRef.current) {
      const activeElement = listboxRef.current.children[activeIndex] as HTMLElement | undefined;
      activeElement?.scrollIntoView({ block: 'nearest' });
    }
  }, [activeIndex, open]);

  const selectOption = (option: SmartComboboxOption) => {
    if (option.disabled) return;
    onChange(option.value);
    setOpen(false);
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (disabled) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      setActiveIndex((previous) => (previous < filteredOptions.length - 1 ? previous + 1 : previous));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((previous) => (previous > 0 ? previous - 1 : previous));
    } else if (event.key === 'Home' && open) {
      event.preventDefault();
      setActiveIndex(0);
    } else if (event.key === 'End' && open) {
      event.preventDefault();
      setActiveIndex(Math.max(0, filteredOptions.length - 1));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (open && activeIndex >= 0 && activeIndex < filteredOptions.length) {
        selectOption(filteredOptions[activeIndex]);
      }
    } else if (event.key === 'Escape' || event.key === 'Tab') {
      setOpen(false);
    }
  };

  const menuStyle: CSSProperties | undefined = menuPlacement
    ? {
      left: menuPlacement.left,
      width: menuPlacement.width,
      maxHeight: menuPlacement.maxHeight,
      ...(menuPlacement.mobile
        ? { bottom: menuPlacement.bottom }
        : { top: menuPlacement.top }),
    }
    : undefined;

  const menu = open && menuPlacement && typeof document !== 'undefined'
    ? createPortal(
      <>
        {menuPlacement.mobile && (
          <div className="fixed inset-0 z-[9990] bg-slate-900/40 backdrop-blur-sm transition-opacity" aria-hidden="true" onClick={() => setOpen(false)} />
        )}
        <div
          ref={menuRef}
          style={menuPlacement.mobile ? { bottom: 0, left: 0, right: 0, maxHeight: menuPlacement.maxHeight } : menuStyle}
          className={`fixed z-[10000] overflow-hidden bg-[#fffdf8] shadow-[0_24px_70px_rgba(15,23,42,0.18)] ${
            menuPlacement.mobile ? `${isCompact ? 'w-full rounded-t-2xl border-t border-emerald-950/10 pb-3' : 'w-full rounded-t-3xl border-t border-emerald-950/10 pb-4'}` : `${isCompact ? 'rounded-xl border border-emerald-950/10 ring-1 ring-white/80' : 'rounded-2xl border border-emerald-950/10 ring-1 ring-white/80'}`
          }`}
        >
          <div className={`border-b border-emerald-950/10 bg-[#fff6df]/75 font-bold uppercase tracking-[0.12em] text-slate-500 ${isDense ? 'px-2 py-1 text-[0.5rem]' : isCompact ? 'px-2.5 py-1.5 text-[0.56rem]' : 'px-3 py-2 text-[0.68rem]'}`}>
            {searchPlaceholder || 'Choisir dans la liste'}
          </div>
          {filteredOptions.length === 0 ? (
            <div
              className={`overflow-y-auto overscroll-contain touch-pan-y ${isDense ? 'p-0.5' : isCompact ? 'p-1' : 'p-1.5'}`}
              style={{ maxHeight: Math.max(isCompact ? 128 : 160, menuPlacement.maxHeight - (isCompact ? 32 : 42)) }}
            >
              <div className={`${isCompact ? 'px-2 py-3 text-xs' : 'px-3 py-4 text-sm'} text-center font-medium text-slate-500`}>
                <p>{emptyLabel}</p>
                {emptyActionLabel && onEmptyAction && (
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      onEmptyAction();
                    }}
                    className="mt-3 rounded-xl border border-emerald-200 bg-white px-3 py-2 text-xs font-black text-emerald-800 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50"
                  >
                    {emptyActionLabel}
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div
              id="smart-combobox-listbox"
              ref={listboxRef}
              className={`overflow-y-auto overscroll-contain touch-pan-y ${isDense ? 'p-0.5' : isCompact ? 'p-1' : 'p-1.5'}`}
              style={{ maxHeight: Math.max(isCompact ? 128 : 160, menuPlacement.maxHeight - (isCompact ? 32 : 42)) }}
              role="listbox"
              aria-label={placeholder || 'Options'}
            >
              {filteredOptions.map((option, index) => {
                const isSelected = option.value === value;
                const isActive = index === activeIndex;
                const isDisabled = option.disabled;

                return (
                  <div
                    key={option.value}
                    role="option"
                    aria-selected={isSelected}
                    aria-disabled={isDisabled || undefined}
                  onClick={() => {
                    if (!isDisabled) selectOption(option);
                  }}
                  onMouseEnter={() => {
                    if (!isDisabled) setActiveIndex(index);
                  }}
                  className={`flex w-full items-center text-left transition cursor-pointer ${
                    isDense ? 'min-h-7 gap-1.5 rounded-[0.4rem] px-1.5 py-1 text-[0.68rem]' : isCompact ? 'min-h-8 gap-2 rounded-lg px-2 py-1.5 text-[0.72rem]' : 'min-h-12 gap-3 rounded-xl px-3 py-3 text-sm'
                  } ${
                    isActive && !isDisabled ? 'bg-emerald-100/45' : ''
                  } ${
                    isDisabled
                      ? 'cursor-not-allowed text-slate-400 opacity-55'
                      : isSelected
                        ? 'bg-emerald-50 text-brand-900'
                        : 'text-slate-700 hover:bg-[#fff6df]'
                  }`}
                >
                  {option.initials ? (
                    <span className={`flex shrink-0 items-center justify-center font-black ring-1 ${isDense ? 'h-5 w-5 rounded-[0.4rem] text-[0.5rem]' : isCompact ? 'h-6 w-6 rounded-lg text-[0.58rem]' : 'h-9 w-9 rounded-xl text-xs'} ${
                      isSelected
                        ? 'bg-brand-800 text-white ring-brand-800'
                        : 'bg-emerald-50 text-brand-800 ring-emerald-100'
                    }`}>
                      {option.initials}
                    </span>
                  ) : (
                    <span
                      className={`flex shrink-0 items-center justify-center rounded-full border ${isDense ? 'h-3.5 w-3.5' : isCompact ? 'h-4 w-4' : 'h-5 w-5'} ${
                        isSelected
                          ? 'border-brand-700 bg-brand-700 text-white'
                          : 'border-slate-200 text-transparent'
                      }`}
                    >
                      <Check className={isDense ? 'h-[0.6rem] w-[0.6rem]' : isCompact ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold">{option.label}</span>
                    {option.subtitle && (
                      <span className={`${isDense ? 'text-[0.58rem]' : isCompact ? 'text-[0.62rem]' : 'text-xs'} mt-0.5 block truncate font-medium text-slate-500`}>
                        {option.subtitle}
                      </span>
                    )}
                  </span>
                  {(option.badge || option.rightLabel) && (
                    <span className={`${isDense ? 'ml-1 gap-0.5' : isCompact ? 'ml-1.5 gap-0.5' : 'ml-2 gap-1'} flex shrink-0 flex-col items-end text-right`}>
                      {option.badge && (
                        <span className={`rounded-full bg-emerald-50 font-black uppercase tracking-[0.08em] text-emerald-700 ring-1 ring-emerald-100 ${isDense ? 'px-1 py-0 text-[0.5rem]' : isCompact ? 'px-1.5 py-0 text-[0.55rem]' : 'px-2 py-0.5 text-[0.65rem]'}`}>
                          {option.badge}
                        </span>
                      )}
                      {option.rightLabel && <span className={`${isDense ? 'text-[0.58rem]' : isCompact ? 'text-[0.62rem]' : 'text-xs'} font-black text-slate-700`}>{option.rightLabel}</span>}
                    </span>
                  )}
                </div>
              );
            })}
            </div>
          )}
        </div>
      </>,
      document.body,
    )
    : null;

  return (
    <div ref={wrapperRef} className={`relative min-w-0 ${className}`}>
      <div className="relative flex items-center">
        <Search className={`pointer-events-none absolute top-1/2 -translate-y-1/2 text-emerald-800/60 ${isDense ? 'left-2.5 h-3 w-3' : isCompact ? 'left-3 h-3.5 w-3.5' : isWizard ? 'left-3.5 h-4 w-4' : 'left-3.5 h-4 w-4'}`} />
        <input
          ref={inputRef}
          type="text"
          disabled={disabled}
          value={open ? query : (selectedOption ? selectedOption.label : query)}
          onChange={(event) => {
            setQuery(event.target.value);
            if (!open) setOpen(true);
            setActiveIndex(0);
            requestAnimationFrame(updateMenuPlacement);
          }}
          onClick={() => {
            if (!disabled) setOpen(true);
          }}
          onFocus={() => {
            if (!disabled) {
              setOpen(true);
              setTimeout(() => inputRef.current?.select(), 10);
            }
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          role="combobox"
          aria-expanded={open}
          aria-controls="smart-combobox-listbox"
          aria-autocomplete="list"
          className={`${isDense ? '!h-8 !min-h-8 py-0 rounded-lg pl-8 pr-7 text-xs leading-4 shadow-sm focus:ring-1' : isCompact ? '!h-11 !min-h-11 py-0 rounded-xl pl-9 pr-8 text-xs leading-4 shadow-sm focus:ring-2' : isWizard ? '!h-11 !min-h-11 py-0 rounded-xl pl-10 pr-9 text-xs leading-4 shadow-sm focus:ring-2' : 'h-12 rounded-2xl pl-10 pr-11 text-sm leading-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.78),0_8px_20px_rgba(15,23,42,0.035)] focus:ring-4'} w-full min-w-0 border border-emerald-950/15 bg-[#fffdf8]/95 font-bold text-slate-800 outline-none transition placeholder:font-medium placeholder:text-slate-400 focus:border-emerald-600 focus:bg-white focus:ring-emerald-600/15 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-50 hover:border-emerald-300`}
        />
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled}
          onClick={() => {
            setOpen((current) => !current);
            if (!open) inputRef.current?.focus();
          }}
          aria-label={open ? 'Fermer la liste' : 'Ouvrir la liste'}
          className={`absolute right-0 top-0 flex items-center justify-center text-slate-400 transition hover:bg-[#fff6df] hover:text-emerald-800 disabled:cursor-not-allowed disabled:opacity-50 ${isDense ? 'h-8 w-7 rounded-r-lg' : isCompact ? '!h-11 !min-h-11 w-8 rounded-r-xl' : isWizard ? '!h-11 !min-h-11 w-8 rounded-r-xl' : 'h-12 w-11 rounded-r-2xl'}`}
        >
          <ChevronDown className={`${isDense ? 'h-3 w-3' : isCompact ? 'h-3.5 w-3.5' : 'h-4 w-4'} transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
        </button>
      </div>
      {menu}
    </div>
  );
}
