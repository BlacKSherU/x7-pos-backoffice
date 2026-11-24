import type {
  PayrollAdjustment,
  PayrollAdjustmentType,
  PayrollAdjustmentsMetrics,
  PayrollCalculationVerification,
  PayrollEntry,
  PayrollMetrics,
  PayrollNavHubItem,
  PayrollSubModuleId,
} from './types';

/**
 * Parses numeric or string values safely into numbers.
 */
export const parseMonetaryValue = (val: unknown): number => {
  if (typeof val === 'number') {
    return isNaN(val) ? 0 : val;
  }
  if (typeof val === 'string') {
    const cleaned = val.replace(/[^0-9.-]+/g, '');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  }
  return 0;
};

/**
 * Computes top-level summary metrics derived from the active PayrollEntry dataset:
 * - Total Base Pay: SUM(base_pay)
 * - Overtime Pay: SUM(overtime_pay + double_overtime_pay)
 * - Net Total: SUM(net_total)
 */
export const calculatePayrollMetrics = (entries: PayrollEntry[]): PayrollMetrics => {
  let totalBasePay = 0;
  let totalOvertimePay = 0;
  let totalNetPay = 0;

  for (const entry of entries) {
    const base = parseMonetaryValue(entry.base_pay);
    const ot = parseMonetaryValue(entry.overtime_pay);
    const dot = parseMonetaryValue(entry.double_overtime_pay);
    const net = parseMonetaryValue(entry.net_total);

    totalBasePay += base;
    totalOvertimePay += (ot + dot);
    totalNetPay += net;
  }

  return {
    totalBasePay,
    totalOvertimePay,
    totalNetPay,
    entryCount: entries.length,
  };
};

/**
 * Formats a numeric value into a localized currency string with 2-decimal precision.
 */
export const formatCurrency = (amount: number | string | undefined | null, currency = 'USD'): string => {
  const num = parseMonetaryValue(amount);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
};

/**
 * Extracts the collaborator name from a payroll entry across supported schemas.
 */
export const getPayrollCollaboratorName = (entry: PayrollEntry): string => {
  if (entry.collaborator_name && String(entry.collaborator_name).trim()) {
    return String(entry.collaborator_name).trim();
  }
  if (entry.collaborator?.name && String(entry.collaborator.name).trim()) {
    return String(entry.collaborator.name).trim();
  }
  if (entry.collaborator?.first_name || entry.collaborator?.last_name) {
    return `${entry.collaborator.first_name ?? ''} ${entry.collaborator.last_name ?? ''}`.trim();
  }
  return '';
};

/**
 * Extracts the entry ID from a payroll entry across supported schemas.
 */
export const getPayrollEntryIdentifier = (entry: PayrollEntry): string => {
  if (entry.entry_id !== undefined && entry.entry_id !== null) {
    return String(entry.entry_id).trim();
  }
  if (entry.id !== undefined && entry.id !== null) {
    return String(entry.id).trim();
  }
  return '';
};

/**
 * Filters payroll entries live across collaborator names and entry IDs.
 */
export const filterPayrollEntries = (
  entries: PayrollEntry[],
  searchQuery: string,
): PayrollEntry[] => {
  const normalizedTerm = searchQuery.trim().toLowerCase();
  if (!normalizedTerm) {
    return entries;
  }

  return entries.filter((entry) => {
    const collaboratorName = getPayrollCollaboratorName(entry).toLowerCase();
    const entryId = getPayrollEntryIdentifier(entry).toLowerCase();

    return collaboratorName.includes(normalizedTerm) || entryId.includes(normalizedTerm);
  });
};

/**
 * Validates the mathematical consistency of payroll entry calculations:
 * 1. gross_total === (base_pay + overtime_pay + double_overtime_pay + tips_amount + bonuses - deductions)
 * 2. net_total === (gross_total - tax_total)
 */
export const verifyPayrollEntryCalculations = (
  entry: PayrollEntry,
): PayrollCalculationVerification => {
  const base = parseMonetaryValue(entry.base_pay);
  const ot = parseMonetaryValue(entry.overtime_pay);
  const dot = parseMonetaryValue(entry.double_overtime_pay);
  const tips = parseMonetaryValue(entry.tips_amount ?? entry.tips);
  const bonuses = parseMonetaryValue(entry.bonuses);
  const deductions = parseMonetaryValue(entry.deductions);
  const tax = parseMonetaryValue(entry.tax_total);
  const actualGross = parseMonetaryValue(entry.gross_total);
  const actualNet = parseMonetaryValue(entry.net_total);

  const expectedGross = base + ot + dot + tips + bonuses - deductions;
  const expectedNet = actualGross - tax;

  const isClose = (a: number, b: number) => Math.abs(a - b) < 0.005;
  const isGrossValid = isClose(expectedGross, actualGross);
  const isNetValid = isClose(expectedNet, actualNet);
  const isValid = isGrossValid && isNetValid;

  let discrepancyReason: string | undefined;
  if (!isValid) {
    const reasons: string[] = [];
    if (!isGrossValid) {
      reasons.push(
        `Gross total mismatch (Expected ${formatCurrency(expectedGross)} vs Actual ${formatCurrency(
          actualGross,
        )})`,
      );
    }
    if (!isNetValid) {
      reasons.push(
        `Net total mismatch (Expected ${formatCurrency(expectedNet)} vs Actual ${formatCurrency(
          actualNet,
        )})`,
      );
    }
    discrepancyReason = reasons.join('; ');
  }

  return {
    isValid,
    isGrossValid,
    isNetValid,
    expectedGross,
    actualGross,
    expectedNet,
    actualNet,
    discrepancyReason,
  };
};

/**
 * Checks whether a record has been logically soft-deleted (deleted_at !== null).
 */
export const isPayrollEntrySoftDeleted = (entry: PayrollEntry): boolean => {
  return entry.deleted_at !== null && entry.deleted_at !== undefined && entry.deleted_at !== '';
};

/**
 * Re-computes gross_total and net_total formulas for a single payroll entry:
 * - gross_total = (base_pay + overtime_pay + double_overtime_pay + tips_amount + bonuses) - deductions
 * - net_total = gross_total - tax_total
 */
export const recalculatePayrollEntryCalculations = (entry: PayrollEntry): PayrollEntry => {
  const base = parseMonetaryValue(entry.base_pay);
  const ot = parseMonetaryValue(entry.overtime_pay);
  const dot = parseMonetaryValue(entry.double_overtime_pay);
  const tips = parseMonetaryValue(entry.tips_amount ?? entry.tips);
  const bonuses = parseMonetaryValue(entry.bonuses);
  const deductions = parseMonetaryValue(entry.deductions);
  const tax = parseMonetaryValue(entry.tax_total);

  const grossTotal = Number((base + ot + dot + tips + bonuses - deductions).toFixed(2));
  const netTotal = Number((grossTotal - tax).toFixed(2));

  return {
    ...entry,
    gross_total: grossTotal,
    net_total: netTotal,
  };
};

/**
 * Re-computes gross/net formulas across a list of entries, optionally targeting selected entry IDs.
 * If no specific selection is provided, recalculates all entries.
 */
export const recalculatePayrollEntries = (
  entries: PayrollEntry[],
  selectedIds?: (string | number)[],
): PayrollEntry[] => {
  const hasSelection = selectedIds !== undefined && selectedIds.length > 0;
  const idSet = hasSelection ? new Set(selectedIds.map(String)) : null;

  return entries.map((entry) => {
    const isSelected =
      !idSet ||
      idSet.has(String(entry.id)) ||
      (entry.entry_id !== undefined && idSet.has(String(entry.entry_id)));

    if (isSelected) {
      return recalculatePayrollEntryCalculations(entry);
    }
    return entry;
  });
};

/**
 * Generates an escape-safe CSV string containing the collaborator breakdown from a dataset.
 */
export const generatePayrollSummaryCsv = (entries: PayrollEntry[]): string => {
  const headers = [
    'Collaborator Name',
    'Collaborator ID',
    'Entry ID',
    'Payroll Run ID',
    'Base Pay',
    'Overtime Pay',
    'Double Overtime Pay',
    'Tips Amount',
    'Bonuses',
    'Deductions',
    'Gross Total',
    'Tax Total',
    'Net Total',
    'Status',
    'Created At',
  ];

  const escapeCsv = (val: unknown): string => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const rows = entries.map((entry) => {
    const name = getPayrollCollaboratorName(entry);
    const colId = entry.collaborator_id ?? entry.collaborator?.id ?? '';
    const entryId = getPayrollEntryIdentifier(entry);
    const runId = entry.payroll_run_id ?? '';
    const base = formatCurrency(entry.base_pay);
    const ot = formatCurrency(entry.overtime_pay);
    const dot = formatCurrency(entry.double_overtime_pay ?? 0);
    const tips = formatCurrency(entry.tips_amount ?? entry.tips ?? 0);
    const bonuses = formatCurrency(entry.bonuses ?? 0);
    const deductions = formatCurrency(entry.deductions ?? 0);
    const gross = formatCurrency(entry.gross_total ?? 0);
    const tax = formatCurrency(entry.tax_total ?? 0);
    const net = formatCurrency(entry.net_total);
    const status = entry.status ?? (entry.deleted_at ? 'DELETED' : 'ACTIVE');
    const created = entry.created_at ?? '';

    return [
      escapeCsv(name),
      escapeCsv(colId),
      escapeCsv(entryId),
      escapeCsv(runId),
      escapeCsv(base),
      escapeCsv(ot),
      escapeCsv(dot),
      escapeCsv(tips),
      escapeCsv(bonuses),
      escapeCsv(deductions),
      escapeCsv(gross),
      escapeCsv(tax),
      escapeCsv(net),
      escapeCsv(status),
      escapeCsv(created),
    ].join(',');
  });

  return [headers.join(','), ...rows].join('\n');
};

/**
 * Triggers a browser download of the payroll summary CSV/Excel export.
 */
export const downloadPayrollSummaryCsv = (
  entries: PayrollEntry[],
  filename = `payroll_summary_${new Date().toISOString().slice(0, 10)}.csv`,
): string => {
  const csvContent = generatePayrollSummaryCsv(entries);
  if (typeof document !== 'undefined') {
    const encodedUri = 'data:text/csv;charset=utf-8,\uFEFF' + encodeURIComponent(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', filename);
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
  return csvContent;
};

/**
 * Default persistent navigation hub items for the Payroll module.
 */
export const DEFAULT_PAYROLL_NAV_ITEMS: PayrollNavHubItem[] = [
  {
    id: 'payroll-runs',
    label: 'PAYROLL RUNS',
    path: '/finance-hr/payrolls/runs',
    featureId: 'payroll-runs',
    icon: 'view_list',
  },
  {
    id: 'payroll-entries',
    label: 'PAYROLL ENTRIES',
    path: '/finance-hr/payrolls/entries',
    featureId: 'payroll-entries',
    icon: 'payments',
  },
  {
    id: 'payroll-adjustments',
    label: 'PAYROLL ADJUSTMENTS',
    path: '/finance-hr/payrolls/adjustments',
    featureId: 'payroll-adjustments',
    icon: 'tune',
  },
  {
    id: 'payroll-tax-detail',
    label: 'PAYROLL TAX DETAIL',
    path: '/finance-hr/payrolls/tax-detail',
    featureId: 'payroll-tax-detail',
    icon: 'receipt_long',
  },
];

/**
 * Determines which tab is active based on explicit activeTab or route string.
 */
export const resolveActivePayrollTab = (
  activeTab?: PayrollSubModuleId | string,
  currentRoute?: string,
): PayrollSubModuleId => {
  if (activeTab) {
    const tabLower = activeTab.toLowerCase();
    if (tabLower.includes('adjustment')) return 'payroll-adjustments';
    if (tabLower.includes('tax')) return 'payroll-tax-detail';
    if (tabLower.includes('run')) return 'payroll-runs';
    if (tabLower.includes('entri')) return 'payroll-entries';
    return activeTab as PayrollSubModuleId;
  }

  if (currentRoute) {
    const routeLower = currentRoute.toLowerCase();
    if (
      routeLower.includes('adjustment') ||
      routeLower.includes('/payrolls/adjustments') ||
      routeLower.endsWith('/adjustments')
    ) {
      return 'payroll-adjustments';
    }
    if (
      routeLower.includes('tax-detail') ||
      routeLower.includes('/payrolls/tax') ||
      routeLower.endsWith('/tax-detail') ||
      routeLower.endsWith('/taxes')
    ) {
      return 'payroll-tax-detail';
    }
    if (
      routeLower.includes('payroll-run') ||
      routeLower.includes('/payrolls/runs') ||
      routeLower.endsWith('/runs')
    ) {
      return 'payroll-runs';
    }
    if (
      routeLower.includes('payroll-entri') ||
      routeLower.includes('/payrolls/entries') ||
      routeLower.endsWith('/entries')
    ) {
      return 'payroll-entries';
    }
  }

  return 'payroll-entries';
};

/**
 * Calculates summary metrics for Payroll Adjustments:
 * - Total Bonuses: SUM(amount) where adjustment_type === 'BONUS'
 * - Total Deductions: SUM(amount) where adjustment_type === 'DEDUCTION'
 * - Net Adjustment Impact: Total Bonuses - Total Deductions
 */
export const calculatePayrollAdjustmentsMetrics = (
  adjustments: PayrollAdjustment[],
): PayrollAdjustmentsMetrics => {
  let totalBonuses = 0;
  let totalDeductions = 0;
  let bonusCount = 0;
  let deductionCount = 0;

  for (const adj of adjustments) {
    if (adj.deleted_at) continue;

    const amt = parseMonetaryValue(adj.amount);
    const typeUpper = String(adj.adjustment_type || '').toUpperCase().trim();

    if (typeUpper === 'BONUS') {
      totalBonuses += amt;
      bonusCount++;
    } else if (typeUpper === 'DEDUCTION') {
      totalDeductions += amt;
      deductionCount++;
    }
  }

  const netAdjustmentTotal = totalBonuses - totalDeductions;

  return {
    totalBonuses,
    totalDeductions,
    netAdjustmentTotal,
    bonusCount,
    deductionCount,
    totalCount: adjustments.length,
  };
};

/**
 * Filters adjustments by search term and adjustment type ('ALL' | 'BONUS' | 'DEDUCTION').
 */
export const filterPayrollAdjustments = (
  adjustments: PayrollAdjustment[],
  searchQuery = '',
  selectedType: 'ALL' | PayrollAdjustmentType | string = 'ALL',
): PayrollAdjustment[] => {
  const term = searchQuery.trim().toLowerCase();
  const typeFilter = String(selectedType).toUpperCase().trim();

  return adjustments.filter((adj) => {
    // 1. Adjustment Type Filter
    if (typeFilter !== 'ALL') {
      const adjType = String(adj.adjustment_type || '').toUpperCase().trim();
      if (adjType !== typeFilter) return false;
    }

    // 2. Search Query Filter
    if (!term) return true;

    const id = String(adj.id || '').toLowerCase();
    const name = String(adj.name || '').toLowerCase();
    const reason = String(adj.reason || '').toLowerCase();
    const desc = String(adj.description || '').toLowerCase();
    const category = String(adj.category || '').toLowerCase();
    const colName = String(
      adj.collaborator_name ||
        adj.collaborator?.name ||
        `${adj.collaborator?.first_name || ''} ${adj.collaborator?.last_name || ''}`,
    ).toLowerCase();

    return (
      id.includes(term) ||
      name.includes(term) ||
      reason.includes(term) ||
      desc.includes(term) ||
      category.includes(term) ||
      colName.includes(term)
    );
  });
};

/**
 * Checks if a PayrollAdjustment is soft-deleted.
 */
export const isPayrollAdjustmentSoftDeleted = (adjustment: PayrollAdjustment): boolean => {
  return (
    adjustment.deleted_at !== null &&
    adjustment.deleted_at !== undefined &&
    adjustment.deleted_at !== ''
  );
};

/**
 * Formats an adjustment amount:
 * - BONUS: +$amount
 * - DEDUCTION: -$amount
 */
export const formatAdjustmentAmount = (
  amount: unknown,
  type: PayrollAdjustmentType | string,
  currency = 'USD',
): { formatted: string; isBonus: boolean; isDeduction: boolean } => {
  const num = parseMonetaryValue(amount);
  const typeUpper = String(type || '').toUpperCase().trim();
  const isBonus = typeUpper === 'BONUS';
  const isDeduction = typeUpper === 'DEDUCTION';

  const baseFormatted = formatCurrency(Math.abs(num), currency);
  const formatted = isBonus ? `+${baseFormatted}` : isDeduction ? `-${baseFormatted}` : baseFormatted;

  return { formatted, isBonus, isDeduction };
};

/**
 * Recalculates associated PayrollEntry totals when an adjustment is soft-deleted or restored.
 * - BONUS soft-deleted: decreases bonuses, which decreases gross_total and net_total.
 * - DEDUCTION soft-deleted: decreases deductions, which increases gross_total and net_total.
 */
export const recalculatePayrollEntryFromAdjustmentDeletion = (
  entry: PayrollEntry,
  adjustment: PayrollAdjustment,
  isSoftDeleting = true,
): PayrollEntry => {
  const amount = parseMonetaryValue(adjustment.amount);
  const type = String(adjustment.adjustment_type || '').toUpperCase().trim();

  let currentBonuses = parseMonetaryValue(entry.bonuses);
  let currentDeductions = parseMonetaryValue(entry.deductions);
  const basePay = parseMonetaryValue(entry.base_pay);
  const ot = parseMonetaryValue(entry.overtime_pay);
  const dot = parseMonetaryValue(entry.double_overtime_pay);
  const tips = parseMonetaryValue(entry.tips_amount ?? entry.tips);
  const tax = parseMonetaryValue(entry.tax_total);

  if (type === 'BONUS') {
    if (isSoftDeleting) {
      currentBonuses = Math.max(0, currentBonuses - amount);
    } else {
      currentBonuses += amount;
    }
  } else if (type === 'DEDUCTION') {
    if (isSoftDeleting) {
      currentDeductions = Math.max(0, currentDeductions - amount);
    } else {
      currentDeductions += amount;
    }
  }

  const grossTotal = basePay + ot + dot + tips + currentBonuses - currentDeductions;
  const netTotal = grossTotal - tax;

  return {
    ...entry,
    bonuses: currentBonuses,
    deductions: currentDeductions,
    gross_total: grossTotal,
    net_total: netTotal,
  };
};

/**
 * Re-syncs an array of PayrollEntry records with active (non-soft-deleted) PayrollAdjustment records.
 * Forces recalculation of entry.bonuses and entry.deductions fields along with gross_total and net_total.
 */
export const resyncPayrollEntriesWithAdjustments = (
  entries: PayrollEntry[],
  adjustments: PayrollAdjustment[],
): PayrollEntry[] => {
  return entries.map((entry) => {
    // Find all active adjustments associated with this entry
    const entryAdjustments = adjustments.filter(
      (adj) =>
        !isPayrollAdjustmentSoftDeleted(adj) &&
        String(adj.payroll_entry_id) === String(entry.id),
    );

    let totalBonuses = 0;
    let totalDeductions = 0;

    for (const adj of entryAdjustments) {
      const amt = parseMonetaryValue(adj.amount);
      const type = String(adj.adjustment_type || '').toUpperCase().trim();
      if (type === 'BONUS') {
        totalBonuses += amt;
      } else if (type === 'DEDUCTION') {
        totalDeductions += amt;
      }
    }

    const basePay = parseMonetaryValue(entry.base_pay);
    const ot = parseMonetaryValue(entry.overtime_pay);
    const dot = parseMonetaryValue(entry.double_overtime_pay);
    const tips = parseMonetaryValue(entry.tips_amount ?? entry.tips);
    const tax = parseMonetaryValue(entry.tax_total);

    const grossTotal = basePay + ot + dot + tips + totalBonuses - totalDeductions;
    const netTotal = grossTotal - tax;

    return {
      ...entry,
      bonuses: totalBonuses,
      deductions: totalDeductions,
      gross_total: grossTotal,
      net_total: netTotal,
    };
  });
};

/**
 * Generates CSV content for a Payroll Adjustment report.
 */
export const generateAdjustmentsReportCsv = (
  adjustments: PayrollAdjustment[],
): string => {
  const headers = [
    'Adjustment ID',
    'Payroll Entry ID',
    'Collaborator Name',
    'Type',
    'Reason / Description',
    'Amount',
    'Status',
    'Created At',
  ];

  const escapeCsv = (str: unknown): string => {
    const val = str === null || str === undefined ? '' : String(str);
    if (val.includes(',') || val.includes('"') || val.includes('\n')) {
      return `"${val.replace(/"/g, '""')}"`;
    }
    return val;
  };

  const rows = adjustments.map((adj) => {
    const colName =
      adj.collaborator_name ||
      adj.collaborator?.name ||
      (adj.collaborator_id ? `Collaborator #${adj.collaborator_id}` : '');

    return [
      escapeCsv(adj.id),
      escapeCsv(adj.payroll_entry_id || ''),
      escapeCsv(colName),
      escapeCsv(adj.adjustment_type),
      escapeCsv(adj.description || adj.reason || adj.name || ''),
      escapeCsv(parseMonetaryValue(adj.amount).toFixed(2)),
      escapeCsv(isPayrollAdjustmentSoftDeleted(adj) ? 'DELETED' : adj.status || 'ACTIVE'),
      escapeCsv(adj.created_at || ''),
    ].join(',');
  });

  return [headers.join(','), ...rows].join('\n');
};

/**
 * Triggers a browser download of the adjustments report CSV.
 */
export const downloadAdjustmentsReportCsv = (
  adjustments: PayrollAdjustment[],
  filename = `payroll_adjustments_report_${new Date().toISOString().slice(0, 10)}.csv`,
): string => {
  const csvContent = generateAdjustmentsReportCsv(adjustments);
  if (typeof document !== 'undefined') {
    const encodedUri = 'data:text/csv;charset=utf-8,\uFEFF' + encodeURIComponent(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', filename);
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
  return csvContent;
};





