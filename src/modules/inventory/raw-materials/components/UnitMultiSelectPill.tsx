import React, { useState, useRef, useEffect } from 'react';

export interface UnitMultiSelectPillProps {
  label: string;
  icon: string;
  selectedUnits: string[];
  onChange: (units: string[]) => void;
  options: string[];
  counts: Record<string, number>;
  totalCount: number;
  theme?: 'blue' | 'amber';
}

export const UnitMultiSelectPill: React.FC<UnitMultiSelectPillProps> = ({
  label,
  icon,
  selectedUnits,
  onChange,
  options,
  counts,
  totalCount,
  theme = 'blue',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside or escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const hasSelection = selectedUnits.length > 0;

  // Compute display label
  const getDisplayText = (): string => {
    if (!hasSelection) {
      return `All Units (${totalCount})`;
    }
    if (selectedUnits.length === 1) {
      const unit = selectedUnits[0];
      const count = counts[unit] || 0;
      return `${unit} (${count})`;
    }
    const totalSelected = selectedUnits.reduce((acc, u) => acc + (counts[u] || 0), 0);
    const joined = selectedUnits.join(', ');
    if (joined.length <= 16) {
      return `${joined} (${totalSelected})`;
    }
    return `${selectedUnits.length} Selected (${totalSelected})`;
  };

  const toggleUnit = (unit: string) => {
    const isSelected = selectedUnits.includes(unit);
    if (isSelected) {
      onChange(selectedUnits.filter((u) => u !== unit));
    } else {
      onChange([...selectedUnits, unit]);
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange([]);
  };

  // Color styling based on theme and active state
  const pillStyle = hasSelection
    ? theme === 'blue'
      ? 'bg-blue-50 text-blue-900 border-blue-300 shadow-xs'
      : 'bg-amber-50 text-amber-900 border-amber-300 shadow-xs'
    : 'bg-white text-[#1d1c17] border-[#d5cfc4] hover:border-[#ae001a] shadow-xs';

  const iconColor = hasSelection
    ? theme === 'blue'
      ? 'text-blue-700'
      : 'text-amber-700'
    : 'text-[#ae001a]';

  const checkboxAccent =
    theme === 'blue'
      ? 'text-blue-600 focus:ring-blue-500'
      : 'text-amber-600 focus:ring-amber-500';

  const activeBadgeColor =
    theme === 'blue'
      ? 'bg-blue-100 text-blue-800'
      : 'bg-amber-100 text-amber-800';

  return (
    <div ref={containerRef} className="relative shrink-0 select-none">
      {/* Pill Trigger Button */}
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((prev) => !prev)}
        className={`flex items-center gap-1.5 h-[32px] px-3 rounded-full text-xs font-semibold transition-all duration-200 border cursor-pointer ${pillStyle}`}
      >
        <span className={`material-symbols-outlined text-[15px] shrink-0 ${iconColor}`}>
          {icon}
        </span>
        <span className="text-[10px] uppercase font-bold text-[#5f5e5e] shrink-0">
          {label}
        </span>
        <span className="font-bold whitespace-nowrap">
          {getDisplayText()}
        </span>
        <span
          className={`material-symbols-outlined text-[16px] text-[#5f5e5e] shrink-0 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        >
          expand_more
        </span>
        {hasSelection && (
          <span
            role="button"
            tabIndex={0}
            onClick={handleClear}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleClear(e as unknown as React.MouseEvent);
              }
            }}
            className="ml-0.5 p-0.5 text-[#5f5e5e] hover:text-[#ae001a] rounded-full hover:bg-black/5 font-bold text-[11px] leading-none transition-colors cursor-pointer"
            title="Clear unit filter"
            aria-label="Clear unit filter"
          >
            ✕
          </span>
        )}
      </button>

      {/* Floating Popover Dropdown */}
      {isOpen && (
        <div
          role="listbox"
          aria-multiselectable="true"
          className="absolute top-full left-0 mt-1.5 z-40 w-64 bg-white rounded-xl shadow-xl border border-[#e8e2d8] p-2 flex flex-col gap-1"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-[#5f5e5e] border-b border-[#f0ede6] pb-1.5">
            <span>Filter {label.replace(':', '')}</span>
            {hasSelection ? (
              <button
                type="button"
                onClick={() => onChange([])}
                className="text-[10px] text-[#ae001a] hover:underline font-bold cursor-pointer"
              >
                Clear all
              </button>
            ) : (
              <span className="text-[10px] text-[#8c857b] font-normal lowercase">all active</span>
            )}
          </div>

          {/* Option: All Units */}
          <button
            type="button"
            onClick={() => onChange([])}
            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors text-left ${
              !hasSelection ? 'bg-[#f4efe6] text-[#1d1c17]' : 'hover:bg-[#f8f3eb] text-[#5f5e5e]'
            }`}
          >
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                readOnly
                checked={!hasSelection}
                className={`w-3.5 h-3.5 rounded border-[#d5cfc4] cursor-pointer ${checkboxAccent}`}
              />
              <span className="font-bold text-[#1d1c17]">All Units</span>
            </div>
            <span className="text-[11px] font-bold px-1.5 py-0.2 rounded-full bg-[#e8e2d8] text-[#5f5e5e]">
              {totalCount}
            </span>
          </button>

          <div className="border-t border-[#f0ede6] my-0.5" />

          {/* Scrollable Units Options */}
          <div className="max-h-56 overflow-y-auto space-y-0.5 pr-0.5">
            {options.length === 0 ? (
              <div className="p-3 text-center text-xs text-[#8c857b] italic">
                No units found
              </div>
            ) : (
              options.map((unit) => {
                const isSelected = selectedUnits.includes(unit);
                const count = counts[unit] || 0;
                return (
                  <button
                    key={unit}
                    type="button"
                    onClick={() => toggleUnit(unit)}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors text-left ${
                      isSelected ? 'bg-blue-50/50 text-[#1d1c17]' : 'hover:bg-[#f8f3eb] text-[#1d1c17]'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <input
                        type="checkbox"
                        readOnly
                        checked={isSelected}
                        className={`w-3.5 h-3.5 rounded border-[#d5cfc4] cursor-pointer ${checkboxAccent}`}
                      />
                      <span className="truncate font-semibold text-[#1d1c17]">{unit}</span>
                    </div>
                    <span
                      className={`text-[11px] font-bold px-1.5 py-0.2 rounded-full shrink-0 ml-2 ${
                        isSelected ? activeBadgeColor : 'bg-[#f2ede5] text-[#5f5e5e]'
                      }`}
                    >
                      {count}
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
};
