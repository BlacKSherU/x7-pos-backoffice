import type {
  PayrollCalculationVerification,
  PayrollEntry,
  PayrollMetrics,
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

