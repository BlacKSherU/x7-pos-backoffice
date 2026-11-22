// Billing ↔ Financial Engine ledger sync (GET/POST /api/billing/financial-sync...).

export type LedgerAccountType = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';

export type JournalEntryStatus = 'DRAFT' | 'POSTED' | 'VOIDED';

/** POSTED: only posted entries · PENDING: has DRAFT entries · UNPOSTED: no live entries. */
export type ReceiptPostingStatus = 'POSTED' | 'PENDING' | 'UNPOSTED';

export interface FinancialSyncReceiptTax {
  id: number;
  name: string;
  rate: number;
  amount: number;
  scope: 'RECEIPT' | 'ITEM';
  receipt_item_id: number | null;
}

export interface FinancialSyncJournalEntry {
  id: number;
  entry_number: string;
  entry_date: string;
  status: JournalEntryStatus;
  total_debit: number;
  total_credit: number;
  is_balanced: boolean;
  line_count: number;
}

export interface FinancialSyncAccountMovement {
  account_id: number;
  code: string | null;
  name: string | null;
  type: LedgerAccountType | null;
  debit: number;
  credit: number;
}

/** Balance verification flags; ledger flags are null when the receipt has no live entries. */
export interface FinancialSyncVerification {
  receipt_totals_consistent: boolean;
  receipt_taxes_match_total: boolean;
  entries_balanced: boolean | null;
  grand_total_matches_assets: boolean | null;
  tax_matches_liabilities: boolean | null;
  is_balanced: boolean | null;
}

export interface FinancialSyncRow {
  receipt_id: number;
  invoice_number: string | null;
  type: string;
  currency: string;
  is_locked: boolean;
  created_at: string;
  subtotal: number;
  total_tax: number;
  total_discount: number;
  grand_total: number;
  posting_status: ReceiptPostingStatus;
  receipt_taxes: FinancialSyncReceiptTax[];
  journal_entries: FinancialSyncJournalEntry[];
  ledger_account_ids: number[];
  ledger_accounts: FinancialSyncAccountMovement[];
  ledger_total_debit: number;
  ledger_total_credit: number;
  asset_net_debit: number;
  liability_net_credit: number;
  receipt_taxes_total: number;
  verification: FinancialSyncVerification;
}

export interface FinancialSyncPage {
  data: FinancialSyncRow[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface FinancialSyncQuery {
  page?: number;
  limit?: number;
  postingStatus?: ReceiptPostingStatus | '';
  search?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface FinancialSyncLine {
  id: number;
  journal_entry_id: number;
  entry_number: string;
  entry_status: JournalEntryStatus;
  account: { id: number; code: string; name: string; type: LedgerAccountType } | null;
  debit: number;
  credit: number;
  description: string | null;
}

export interface FinancialSyncLines {
  receipt_id: number;
  invoice_number: string | null;
  currency: string;
  journal_entry_id: number | null;
  lines: FinancialSyncLine[];
  total_debit: number;
  total_credit: number;
  is_balanced: boolean;
}

// ─── Header metrics + POST BATCH TO LEDGER ─────────────────────────────────

export type LedgerBalanceStatus = 'BALANCED' | 'UNBALANCED' | 'NO_ENTRIES';

export interface FinancialSyncTaxAccount {
  account_id: number;
  code: string;
  name: string;
  /** Credit − debit over the company's POSTED entries. */
  balance: number;
}

export interface FinancialSyncMetrics {
  currency: string;
  total_receipts: number;
  posted_receipts: number;
  pending_receipts: number;
  unposted_receipts: number;
  /** unposted_receipts + pending_receipts */
  unposted_transactions: number;
  pending_ledger_entries: number;
  posted_ledger_entries: number;
  posted_revenue: number;
  posted_grand_total: number;
  tax_accounts: FinancialSyncTaxAccount[];
  tax_liability_balance: number;
  balance: {
    status: LedgerBalanceStatus;
    checked_receipts: number;
    balanced_receipts: number;
    unbalanced_receipts: number;
  };
}

export interface PostingAccount {
  id: number;
  code: string;
  name: string;
  type: LedgerAccountType;
}

export interface PostBatchPayload {
  cashAccountId: number;
  revenueAccountId: number;
  taxAccountId?: number;
  discountAccountId?: number;
  receiptIds?: number[];
}

export type PostingSkipReason =
  | 'NOT_FOUND'
  | 'ALREADY_POSTED'
  | 'UNBALANCED_DRAFT'
  | 'ZERO_AMOUNT'
  | 'NEGATIVE_AMOUNTS'
  | 'UNBALANCED_TOTALS'
  | 'MISSING_TAX_ACCOUNT'
  | 'MISSING_DISCOUNT_ACCOUNT';

export interface PostBatchResult {
  generated_entries: number;
  posted_drafts: number;
  entries: Array<{
    id: number;
    entry_number: string;
    receipt_id: number;
    status: JournalEntryStatus;
    total_debit: number;
    total_credit: number;
    generated: boolean;
  }>;
  skipped: Array<{
    receipt_id: number;
    invoice_number: string | null;
    reason: PostingSkipReason;
    detail: string;
  }>;
  /** Metrics recomputed after the batch: the header swaps them in at once. */
  metrics: FinancialSyncMetrics;
}
