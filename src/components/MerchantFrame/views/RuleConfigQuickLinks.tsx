import React from 'react';

interface RuleConfigQuickLinksProps {
  activeRule: 'tax' | 'payroll' | 'overtime' | 'tips';
  onNavigate?: (view: string) => void;
}

const RULE_CONFIG_ANCHORS: Array<{
  key: 'tax' | 'payroll' | 'overtime' | 'tips';
  label: string;
  icon: string;
  featureId: string | null;
}> = [
  { key: 'tax', label: 'TAX RULES', icon: 'percent', featureId: 'merchant-tax-rules' },
  { key: 'payroll', label: 'PAYROLL RULES', icon: 'payments', featureId: 'merchant-payroll-rules' },
  { key: 'overtime', label: 'OVERTIME RULES', icon: 'alarm_add', featureId: 'merchant-overtime-rules' },
  { key: 'tips', label: 'TIPS MANAGEMENT', icon: 'volunteer_activism', featureId: 'merchant-tips-rules' },
];

export const RuleConfigQuickLinks: React.FC<RuleConfigQuickLinksProps> = ({ activeRule, onNavigate }) => {
  return (
    <nav
      aria-label="Related configuration shortcuts"
      className="bg-white border border-[#e8e2d8] rounded shadow-sm px-6 py-4 flex flex-wrap items-center gap-6"
    >
      {RULE_CONFIG_ANCHORS.map((anchor) => {
        const isActive = anchor.key === activeRule;
        if (isActive) {
          return (
            <span
              key={anchor.key}
              aria-current="page"
              className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-[#ae001a] underline underline-offset-4"
            >
              <span className="material-symbols-outlined text-base">{anchor.icon}</span>
              {anchor.label}
            </span>
          );
        }
        return (
          <button
            key={anchor.key}
            type="button"
            onClick={() => onNavigate?.(anchor.featureId!)}
            className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-[#5f5e5e] hover:text-[#ae001a] transition-colors duration-200"
          >
            <span className="material-symbols-outlined text-base">{anchor.icon}</span>
            {anchor.label}
          </button>
        );
      })}
    </nav>
  );
};

export default RuleConfigQuickLinks;
