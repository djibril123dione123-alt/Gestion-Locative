import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';

export interface SmartComboboxOption {
  value: string;
  label: string;
  subtitle?: string;
  keywords?: string;
}

interface SmartComboboxProps {
  value: string;
  options: SmartComboboxOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyLabel?: string;
  className?: string;
  disabled?: boolean;
}

export function SmartCombobox({
  value,
  options,
  onChange,
  placeholder = 'Sélectionner ou rechercher...',
  emptyLabel = 'Aucun résultat',
  className = '',
  disabled = false,
}: SmartComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState<number>(-1);

  const selectedOption = useMemo(() => options.find((o) => o.value === value), [options, value]);

  // Sync input value with selected option when not open
  useEffect(() => {
    if (!open) {
      setQuery(selectedOption ? selectedOption.label : '');
    } else {
      setQuery('');
      setActiveIndex(-1);
    }
  }, [open, selectedOption]);

  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return options;

    return options.filter((option) => {
      const haystack = [option.label, option.subtitle, option.keywords].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [options, query]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      setActiveIndex((prev) => (prev < filteredOptions.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => (prev > 0 ? prev - 1 : prev));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (open && activeIndex >= 0 && activeIndex < filteredOptions.length) {
        onChange(filteredOptions[activeIndex].value);
        setOpen(false);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  // Auto scroll to active item
  useEffect(() => {
    if (open && activeIndex >= 0 && listboxRef.current) {
      const activeElement = listboxRef.current.children[activeIndex] as HTMLElement;
      if (activeElement) {
        activeElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [activeIndex, open]);

  return (
    <div ref={wrapperRef} className={`relative min-w-0 ${className}`}>
      <div className="relative flex items-center">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          ref={inputRef}
          type="text"
          disabled={disabled}
          value={open ? query : (selectedOption ? selectedOption.label : query)}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!open) setOpen(true);
            setActiveIndex(0);
          }}
          onFocus={() => {
            if (!disabled) {
              setOpen(true);
              // select all text so user can just type to replace
              setTimeout(() => inputRef.current?.select(), 10);
            }
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          className="h-10 w-full min-w-0 rounded-xl border border-emerald-950/10 bg-white/95 pl-9 pr-10 text-sm font-semibold text-slate-700 shadow-sm outline-none transition placeholder:font-normal placeholder:text-slate-400 focus:border-brand-700 focus:ring-4 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-50 hover:border-emerald-200"
        />
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled}
          onClick={() => {
            setOpen(!open);
            if (!open) inputRef.current?.focus();
          }}
          className="absolute right-0 top-0 flex h-10 w-10 items-center justify-center text-slate-400 transition hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {open && (
        <div className="absolute left-0 right-0 z-50 mt-2 overflow-hidden rounded-2xl border border-emerald-950/10 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.16)] ring-1 ring-white/80">
          <div ref={listboxRef} className="max-h-64 overflow-y-auto p-1.5" role="listbox">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-4 text-center text-sm font-medium text-slate-500">
                {emptyLabel}
              </div>
            ) : (
              filteredOptions.map((option, index) => {
                const isSelected = option.value === value;
                const isActive = index === activeIndex;

                return (
                  <button
                    key={option.value}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => {
                      onChange(option.value);
                      setOpen(false);
                    }}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition ${
                      isActive ? 'bg-emerald-100/50' : ''
                    } ${
                      isSelected
                        ? 'bg-emerald-50 text-brand-900'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                    onMouseEnter={() => setActiveIndex(index)}
                  >
                    <span
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                        isSelected
                          ? 'border-brand-700 bg-brand-700 text-white'
                          : 'border-slate-200 text-transparent'
                      }`}
                    >
                      <Check className="h-3.5 w-3.5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-bold">{option.label}</span>
                      {option.subtitle && (
                        <span className="mt-0.5 block truncate text-xs font-medium text-slate-500">
                          {option.subtitle}
                        </span>
                      )}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
