import type {
  FinancialSyncVerification,
  JournalEntryStatus,
  LedgerAccountType,
  PostingSkipReason,
  ReceiptPostingStatus,
} from '../types/financial-sync';

const AMOUNT_FORMAT = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** `1,234.50 USD`: two decimals plus the currency code. */
export function formatMoney(amount: number | string | null | undefined, currency = 'USD'): string {
  const value = Number(amount ?? 0);
  return `${AMOUNT_FORMAT.format(Number.isFinite(value) ? value : 0)} ${currency}`;
}

/** Amount without currency (table cells where the column already says it). */
export function formatAmount(amount: number | string | null | undefined): string {
  const value = Number(amount ?? 0);
  return AMOUNT_FORMAT.format(Number.isFinite(value) ? value : 0);
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit' });
}

export const POSTING_STATUS_META: Record<
  ReceiptPostingStatus,
  { label: string; icon: string; className: string; description: string }
> = {
  POSTED: {
    label: 'Posted',
    icon: 'task_alt',
    className: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    description: 'Every live journal entry of the receipt is posted.',
  },
  PENDING: {
    label: 'Pending',
    icon: 'hourglass_top',
    className: 'bg-amber-50 text-amber-800 border-amber-200',
    description: 'At least one journal entry is still in DRAFT.',
  },
  UNPOSTED: {
    label: 'Unposted',
    icon: 'pending_actions',
    className: 'bg-zinc-100 text-zinc-700 border-zinc-300',
    description: 'No journal entry has been generated for this receipt yet.',
  },
};

export const ENTRY_STATUS_CLASS: Record<JournalEntryStatus, string> = {
  POSTED: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  DRAFT: 'bg-amber-50 text-amber-800 border-amber-200',
  VOIDED: 'bg-red-50 text-red-700 border-red-200 line-through',
};

export const ACCOUNT_TYPE_CLASS: Record<LedgerAccountType, string> = {
  ASSET: 'bg-blue-50 text-blue-800 border-blue-200',
  LIABILITY: 'bg-purple-50 text-purple-800 border-purple-200',
  EQUITY: 'bg-zinc-100 text-zinc-700 border-zinc-300',
  REVENUE: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  EXPENSE: 'bg-orange-50 text-orange-800 border-orange-200',
};

export type VerificationFlagKey = Exclude<keyof FinancialSyncVerification, 'is_balanced'>;

/** Balance checks shown as badges, in display order. */
export const VERIFICATION_FLAGS: Array<{ key: VerificationFlagKey; short: string; label: string }> = [
  { key: 'entries_balanced', short: 'DR = CR', label: 'Total debits equal total credits' },
  { key: 'grand_total_matches_assets', short: 'TOTAL → ASSET', label: 'Grand total equals the net debit on ASSET accounts' },
  { key: 'tax_matches_liabilities', short: 'TAX → LIABILITY', label: 'Total tax equals the net credit on LIABILITY accounts' },
  { key: 'receipt_totals_consistent', short: 'TOTALS', label: 'Subtotal + tax − discount equals the grand total' },
  { key: 'receipt_taxes_match_total', short: 'TAX LINES', label: 'Active ReceiptTax records add up to the total tax' },
];

export type FlagState = 'pass' | 'fail' | 'na';

export function flagState(value: boolean | null | undefined): FlagState {
  if (value === true) return 'pass';
  if (value === false) return 'fail';
  return 'na';
}

export const FLAG_STATE_META: Record<FlagState, { icon: string; className: string; word: string }> = {
  pass: { icon: 'check_circle', className: 'bg-emerald-50 text-emerald-800 border-emerald-200', word: 'passes' },
  fail: { icon: 'error', className: 'bg-red-50 text-red-700 border-red-200', word: 'fails' },
  na: { icon: 'remove', className: 'bg-zinc-50 text-zinc-500 border-zinc-200', word: 'not verified' },
};

/** Why POST BATCH TO LEDGER left a receipt out. */
export const SKIP_REASON_LABEL: Record<PostingSkipReason, string> = {
  NOT_FOUND: 'Receipt not found',
  ALREADY_POSTED: 'Already posted',
  UNBALANCED_DRAFT: 'Draft entry not balanced',
  ZERO_AMOUNT: 'Nothing to post',
  NEGATIVE_AMOUNTS: 'Negative totals',
  UNBALANCED_TOTALS: 'Receipt totals do not add up',
  MISSING_TAX_ACCOUNT: 'Needs a tax account',
  MISSING_DISCOUNT_ACCOUNT: 'Needs a discount account',
};
