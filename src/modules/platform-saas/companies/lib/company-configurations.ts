export const CONFIGURATION_TYPE_LABELS: Record<string, string> = {
  merchant_tax_rule: 'Tax Rules',
  merchant_tip_rule: 'Tip Rules',
  merchant_payroll_rule: 'Payroll Rules',
  merchant_overtime_rule: 'Overtime Rules',
};

export function getConfigurationTypeLabel(type: string): string {
  return (
    CONFIGURATION_TYPE_LABELS[type] ??
    type.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
  );
}

export function getConfigurationStatusClass(status: string): string {
  const normalized = status.toLowerCase();
  if (normalized === 'active') {
    return 'bg-emerald-100 text-emerald-800';
  }
  if (normalized === 'inactive' || normalized === 'deleted') {
    return 'bg-zinc-200 text-zinc-700';
  }
  return 'bg-amber-100 text-amber-800';
}
