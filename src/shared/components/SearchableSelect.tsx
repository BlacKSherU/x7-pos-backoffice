import React, { useEffect, useId, useRef, useState } from 'react';

export interface SearchableSelectOption {
  value: string;
  label: string;
  /** Segunda línea en gris (cliente, total, estado…). */
  description?: string;
  disabled?: boolean;
}

interface SearchableSelectProps {
  id: string;
  label: string;
  value: string;
  options: SearchableSelectOption[];
  onChange: (value: string) => void;
  /**
   * Búsqueda remota: recibe el texto escrito y el componente muestra `options` tal cual.
   * Sin ella, filtra `options` en local por etiqueta, descripción y valor.
   */
  onSearch?: (query: string) => void;
  /** Etiqueta del valor elegido cuando no está entre `options` (p. ej. la orden de un recibo en edición). */
  selectedLabel?: string;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  loading?: boolean;
  disabled?: boolean;
  error?: string;
  hint?: string;
}

const normalize = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

/**
 * Coincidencias de la búsqueda local, de más a menos relevante (el orden original desempata):
 * valor exacto, valor que empieza por lo escrito, un tramo de la etiqueta ("EUR — Euro") que
 * empieza por lo escrito, una palabra que empieza por lo escrito y, por último, el texto contenido.
 */
function rankOptions(options: SearchableSelectOption[], query: string): SearchableSelectOption[] {
  const q = normalize(query.trim());
  if (!q) return options;
  const score = (option: SearchableSelectOption): number => {
    const value = normalize(option.value);
    const label = normalize(option.label);
    const haystack = `${label} ${normalize(option.description ?? '')} ${value}`;
    if (value === q) return 0;
    if (value.startsWith(q)) return 1;
    if (label.split(/\s+[—·-]\s+/).some((part) => part.startsWith(q))) return 2;
    if (haystack.split(/[^a-z0-9#]+/).some((word) => word.startsWith(q))) return 3;
    return haystack.includes(q) ? 4 : -1;
  };
  return options
    .map((option, index) => ({ option, index, rank: score(option) }))
    .filter((entry) => entry.rank >= 0)
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map((entry) => entry.option);
}

/**
 * Select con buscador: un botón muestra la opción elegida y abre un panel con un campo de
 * búsqueda (role="combobox") y la lista (role="listbox"). Teclado: ↑/↓ recorren, Enter elige,
 * Escape cierra. Filtra en local o delega la búsqueda al llamador (`onSearch`).
 */
export const SearchableSelect: React.FC<SearchableSelectProps> = ({
  id,
  label,
  value,
  options,
  onChange,
  onSearch,
  selectedLabel,
  placeholder = 'Select…',
  searchPlaceholder = 'Search…',
  emptyMessage = 'No matches.',
  loading = false,
  disabled = false,
  error,
  hint,
}) => {
  const listboxId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const visible = onSearch ? options : rankOptions(options, query);

  const selected = options.find((option) => option.value === value);
  const buttonText = selected?.label ?? (value ? selectedLabel ?? value : '');

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  useEffect(() => {
    if (open) searchRef.current?.focus();
  }, [open]);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView?.({ block: 'nearest' });
  }, [active]);

  const openPanel = () => {
    if (disabled) return;
    setQuery('');
    onSearch?.('');
    const index = options.findIndex((option) => option.value === value);
    setActive(index >= 0 ? index : 0);
    setOpen(true);
  };

  const choose = (option: SearchableSelectOption | undefined) => {
    if (!option || option.disabled) return;
    onChange(option.value);
    setOpen(false);
  };

  const move = (step: 1 | -1) => {
    if (visible.length === 0) return;
    let next = active;
    for (let i = 0; i < visible.length; i += 1) {
      next = (next + step + visible.length) % visible.length;
      if (!visible[next].disabled) break;
    }
    setActive(next);
  };

  const onSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      move(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      move(-1);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      choose(visible[active]);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
    }
  };

  const borderClass = error
    ? 'border-error focus:ring-1 focus:ring-error'
    : 'border-[#e8e2d8] focus:border-[#ae001a] focus:ring-1 focus:ring-[#ae001a]';

  return (
    <div ref={rootRef} className="relative flex flex-col gap-1.5 min-w-0">
      <label htmlFor={id} className="text-[11px] font-bold text-[#5f5e5e] uppercase">
        {label}
      </label>
      <button
        id={id}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-invalid={Boolean(error)}
        onClick={() => (open ? setOpen(false) : openPanel())}
        onKeyDown={(event) => {
          if (!open && (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ')) {
            event.preventDefault();
            openPanel();
          }
        }}
        className={`flex items-center justify-between gap-2 w-full min-w-0 bg-white text-left px-3 py-2 border rounded outline-none disabled:opacity-60 disabled:cursor-not-allowed ${borderClass}`}
      >
        <span className={`truncate ${buttonText ? 'text-[#1d1c17]' : 'text-[#a8a29a]'}`}>
          {buttonText || placeholder}
        </span>
        <span className="material-symbols-outlined text-[18px] text-[#5f5e5e] shrink-0" aria-hidden="true">
          {open ? 'expand_less' : 'expand_more'}
        </span>
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 w-full min-w-[min(22rem,calc(100vw-3rem))] bg-white border border-[#e8e2d8] rounded-lg shadow-lg overflow-hidden">
          <div className="p-2 border-b border-[#f2ede5]">
            <div className="relative">
              <span
                className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-[16px] text-[#8c857b]"
                aria-hidden="true"
              >
                search
              </span>
              <input
                ref={searchRef}
                type="text"
                role="combobox"
                aria-label={`Search ${label.replace(/\s*\*$/, '').toLowerCase()}`}
                aria-expanded="true"
                aria-controls={listboxId}
                aria-autocomplete="list"
                aria-activedescendant={visible[active] ? `${listboxId}-${active}` : undefined}
                autoComplete="off"
                value={query}
                placeholder={searchPlaceholder}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setActive(0);
                  onSearch?.(event.target.value);
                }}
                onKeyDown={onSearchKeyDown}
                className="w-full pl-8 pr-3 py-1.5 text-sm bg-[#fcfcfb] border border-[#e8e2d8] rounded outline-none focus:border-[#ae001a]"
              />
            </div>
          </div>
          <ul
            ref={listRef}
            id={listboxId}
            role="listbox"
            aria-label={label.replace(/\s*\*$/, '')}
            className="max-h-60 overflow-y-auto divide-y divide-[#f2ede5]"
          >
            {loading && visible.length === 0 ? (
              <li className="px-3 py-2.5 text-sm text-[#5f5e5e] italic">Loading…</li>
            ) : visible.length === 0 ? (
              <li className="px-3 py-2.5 text-sm text-[#5f5e5e] italic">{emptyMessage}</li>
            ) : (
              visible.map((option, index) => {
                const isSelected = option.value === value;
                return (
                  <li
                    key={option.value}
                    id={`${listboxId}-${index}`}
                    data-index={index}
                    role="option"
                    aria-selected={isSelected}
                    aria-disabled={option.disabled || undefined}
                    onMouseEnter={() => setActive(index)}
                    onMouseDown={(event) => {
                      event.preventDefault();
                      choose(option);
                    }}
                    className={`px-3 py-2 text-sm flex items-start justify-between gap-2 ${
                      option.disabled
                        ? 'text-[#b5ada3] cursor-not-allowed'
                        : `cursor-pointer text-[#1d1c17] ${index === active ? 'bg-[#f8f3eb]' : ''}`
                    }`}
                  >
                    <span className="min-w-0">
                      <span className={`block truncate ${isSelected ? 'font-semibold' : ''}`}>{option.label}</span>
                      {option.description && (
                        <span className="block truncate text-[11px] text-[#8c857b]">{option.description}</span>
                      )}
                    </span>
                    {isSelected && (
                      <span className="material-symbols-outlined text-[16px] text-[#ae001a] shrink-0" aria-hidden="true">
                        check
                      </span>
                    )}
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}

      {error ? (
        <p className="text-body-sm text-error" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-[11px] text-[#8c857b]">{hint}</p>
      ) : null}
    </div>
  );
};

export default SearchableSelect;
