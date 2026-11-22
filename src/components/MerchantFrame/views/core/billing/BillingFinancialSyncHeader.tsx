import React, { useEffect, useState } from 'react';
import {
  fetchFinancialSyncMetrics,
  fetchPostingAccounts,
  postBatchToLedger,
} from '@/modules/core/billing-transactions/api/financial-sync-api';
import type {
  FinancialSyncMetrics,
  LedgerAccountType,
  PostBatchPayload,
  PostBatchResult,
  PostingAccount,
} from '@/modules/core/billing-transactions/types/financial-sync';
import { SKIP_REASON_LABEL, formatMoney } from '@/modules/core/billing-transactions/lib/financial-sync-format';
import { AppModal } from '@/shared/components/AppModal';

export interface BillingFinancialSyncHeaderProps {
  /** Bump it to reload the metrics from the server. */
  refreshKey?: number;
  /** Called after a batch runs, with the server result (e.g. to reload the grid). */
  onBatchPosted?: (result: PostBatchResult) => void;
}

type AccountRole = 'cashAccountId' | 'revenueAccountId' | 'taxAccountId' | 'discountAccountId';

const ACCOUNT_ROLES: Array<{
  role: AccountRole;
  label: string;
  hint: string;
  types: LedgerAccountType[];
  required: boolean;
}> = [
  { role: 'cashAccountId', label: 'Cash / receivable account', hint: 'ASSET · debited with each grand total', types: ['ASSET'], required: true },
  { role: 'revenueAccountId', label: 'Sales revenue account', hint: 'REVENUE · credited with each subtotal', types: ['REVENUE'], required: true },
  { role: 'taxAccountId', label: 'Tax liability account', hint: 'LIABILITY · credited with each total tax', types: ['LIABILITY'], required: false },
  { role: 'discountAccountId', label: 'Sales discounts account', hint: 'EXPENSE or contra-REVENUE · debited with each discount', types: ['EXPENSE', 'REVENUE'], required: false },
];

type AccountSelection = Record<AccountRole, string>;

const EMPTY_SELECTION: AccountSelection = {
  cashAccountId: '',
  revenueAccountId: '',
  taxAccountId: '',
  discountAccountId: '',
};

// ─── KPI card ──────────────────────────────────────────────────────────────

interface KpiCardProps {
  icon: string;
  label: string;
  value: React.ReactNode;
  detail?: React.ReactNode;
  tone: 'blue' | 'emerald' | 'amber' | 'purple' | 'red' | 'zinc';
  testId: string;
}

const TONE_CLASS: Record<KpiCardProps['tone'], string> = {
  blue: 'bg-blue-50 text-blue-700 border-blue-200',
  emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  amber: 'bg-amber-50 text-amber-700 border-amber-200',
  purple: 'bg-purple-50 text-purple-700 border-purple-200',
  red: 'bg-red-50 text-red-700 border-red-200',
  zinc: 'bg-zinc-50 text-zinc-600 border-zinc-200',
};

const KpiCard: React.FC<KpiCardProps> = ({ icon, label, value, detail, tone, testId }) => (
  <div
    className="bg-white border border-[#e8e2d8] p-2.5 rounded-xl shadow-xs flex items-start gap-2 min-w-0 font-sans"
    data-testid={testId}
  >
    <div className={`w-8 h-8 rounded-lg flex items-center justify-center border shrink-0 ${TONE_CLASS[tone]}`}>
      <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
        {icon}
      </span>
    </div>
    <div className="min-w-0">
      <div className="text-[9.5px] font-bold text-[#5f5e5e] uppercase tracking-wider leading-tight font-poppins">{label}</div>
      <div className="text-lg font-extrabold text-[#1d1c17] font-poppins leading-tight truncate" data-testid={`${testId}-value`}>
        {value}
      </div>
      {detail ? <div className="text-[10px] text-[#76736a] leading-snug">{detail}</div> : null}
    </div>
  </div>
);

// ─── Batch modal ───────────────────────────────────────────────────────────

interface PostBatchModalProps {
  pending: number;
  onClose: () => void;
  onPosted: (result: PostBatchResult) => void;
}

const PostBatchModal: React.FC<PostBatchModalProps> = ({ pending, onClose, onPosted }) => {
  const [accounts, setAccounts] = useState<PostingAccount[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [selection, setSelection] = useState<AccountSelection>(EMPTY_SELECTION);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchPostingAccounts()
      .then((list) => {
        if (cancelled) return;
        setAccounts(list);
        // A role with a single candidate account is preselected.
        setSelection((current) => {
          const next = { ...current };
          for (const role of ACCOUNT_ROLES) {
            const options = list.filter((acc) => role.types.includes(acc.type));
            if (!next[role.role] && options.length === 1 && role.required) next[role.role] = String(options[0].id);
          }
          return next;
        });
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load the ledger accounts.');
      })
      .finally(() => {
        if (!cancelled) setLoadingAccounts(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const missingRequired = ACCOUNT_ROLES.some((role) => role.required && !selection[role.role]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (missingRequired || submitting) return;
    const payload: PostBatchPayload = {
      cashAccountId: Number(selection.cashAccountId),
      revenueAccountId: Number(selection.revenueAccountId),
      ...(selection.taxAccountId ? { taxAccountId: Number(selection.taxAccountId) } : {}),
      ...(selection.discountAccountId ? { discountAccountId: Number(selection.discountAccountId) } : {}),
    };
    setSubmitting(true);
    setError(null);
    try {
      onPosted(await postBatchToLedger(payload));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to post the batch to the ledger.');
      setSubmitting(false);
    }
  };

  return (
    <AppModal
      title="Post batch to ledger"
      subtitle="FINANCIAL ENGINE LEDGER SYNC"
      onClose={onClose}
      closeDisabled={submitting}
      size="lg"
    >
      <form onSubmit={submit} className="p-5 flex flex-col gap-4 overflow-y-auto font-sans" aria-label="Post batch to ledger">
        <p className="text-xs text-[#5f5e5e]">
          Generates and posts the sales journal entry of every unposted receipt (Dr cash, Dr discounts, Cr revenue,
          Cr tax) and posts the balanced draft entries of pending receipts.{' '}
          <span className="font-bold text-[#1d1c17]">
            {pending} transaction{pending === 1 ? '' : 's'} waiting.
          </span>
        </p>

        {loadingAccounts ? (
          <p className="text-xs text-[#76736a]">Loading ledger accounts...</p>
        ) : (
          ACCOUNT_ROLES.map((role) => {
            const options = accounts.filter((acc) => role.types.includes(acc.type));
            const id = `post-batch-${role.role}`;
            return (
              <div key={role.role} className="flex flex-col gap-1">
                <label htmlFor={id} className="text-[11px] font-bold text-[#5f5e5e] uppercase">
                  {role.label}
                  {role.required ? <span className="text-[#ae001a]"> *</span> : <span className="normal-case font-semibold"> (optional)</span>}
                </label>
                <select
                  id={id}
                  value={selection[role.role]}
                  required={role.required}
                  onChange={(e) => setSelection((current) => ({ ...current, [role.role]: e.target.value }))}
                  className="bg-white text-[#1d1c17] px-3 py-2 border border-[#e8e2d8] rounded text-xs outline-none focus:border-[#ae001a]"
                >
                  <option value="">{role.required ? 'Select an account' : 'None'}</option>
                  {options.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.code} · {acc.name} ({acc.type})
                    </option>
                  ))}
                </select>
                <span className="text-[10px] text-[#76736a]">
                  {options.length === 0 ? `No active ${role.types.join(' / ')} accounts in the chart of accounts.` : role.hint}
                </span>
              </div>
            );
          })
        )}

        {!loadingAccounts && (!selection.taxAccountId || !selection.discountAccountId) && (
          <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded px-3 py-2">
            Receipts that carry {!selection.taxAccountId ? 'tax' : ''}
            {!selection.taxAccountId && !selection.discountAccountId ? ' or ' : ''}
            {!selection.discountAccountId ? 'discounts' : ''} are skipped until that account is selected.
          </p>
        )}

        {error && (
          <p role="alert" className="text-xs text-red-800 bg-red-50 border border-red-200 rounded px-3 py-2 font-semibold">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 rounded border border-[#e8e2d8] text-xs font-bold uppercase text-[#5f5e5e] hover:bg-[#fef9f1] disabled:opacity-50 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={missingRequired || submitting || loadingAccounts}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded bg-[#ae001a] hover:bg-[#900015] text-white text-xs font-bold uppercase tracking-wide disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
              book
            </span>
            {submitting ? 'Posting...' : 'Confirm & post'}
          </button>
        </div>
      </form>
    </AppModal>
  );
};

// ─── Header ────────────────────────────────────────────────────────────────

export const BillingFinancialSyncHeader: React.FC<BillingFinancialSyncHeaderProps> = ({
  refreshKey = 0,
  onBatchPosted,
}) => {
  const [metrics, setMetrics] = useState<FinancialSyncMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [lastResult, setLastResult] = useState<PostBatchResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchFinancialSyncMetrics()
      .then((next) => {
        if (!cancelled) setMetrics(next);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load the ledger posting metrics.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const handlePosted = (result: PostBatchResult) => {
    // The batch response carries the recomputed metrics: swap them in without another request.
    setMetrics(result.metrics);
    setError(null);
    setLastResult(result);
    setModalOpen(false);
    onBatchPosted?.(result);
  };

  const currency = metrics?.currency ?? 'USD';
  const placeholder = loading && !metrics ? '...' : '—';
  const nothingToPost = metrics !== null && metrics.unposted_transactions === 0;
  const balanceStatus = metrics?.balance.status;
  const postedCount = lastResult ? lastResult.entries.length : 0;

  return (
    <div className="flex flex-col gap-3">
      <div className="bg-white border border-[#e8e2d8] rounded-xl p-6 shadow-sm flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-[#ae001a] text-2xl select-none" aria-hidden="true">
              account_balance
            </span>
            <h2 className="text-[#ae001a] font-bold text-heading-lg tracking-wider uppercase font-sans">
              FINANCIAL ENGINE LEDGER SYNC
            </h2>
          </div>
          <p className="text-[#5f5e5e] text-body-sm font-sans mt-1 max-w-3xl">
            Verify that billing revenue and tax liabilities were transferred to the general ledger, and force the
            posting of the receipts that are still pending.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          disabled={nothingToPost}
          title={nothingToPost ? 'Every receipt is already posted to the ledger' : undefined}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#ae001a] hover:bg-[#900015] text-white text-xs font-bold uppercase tracking-wider font-poppins shadow-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shrink-0"
        >
          <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
            book
          </span>
          POST BATCH TO LEDGER
        </button>
      </div>

      {error && (
        <div role="alert" className="px-4 py-2.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800 font-semibold">
          {error}
        </div>
      )}

      {lastResult && (
        <div
          role="status"
          className="px-4 py-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex flex-col gap-1"
        >
          <div className="flex items-center gap-2 font-semibold">
            <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
              task_alt
            </span>
            {postedCount > 0
              ? `Posted ${postedCount} journal entr${postedCount === 1 ? 'y' : 'ies'} to the ledger (${lastResult.generated_entries} generated, ${lastResult.posted_drafts} draft${lastResult.posted_drafts === 1 ? '' : 's'} posted).`
              : 'No receipts were posted to the ledger.'}
            {lastResult.skipped.length > 0 && ` ${lastResult.skipped.length} skipped.`}
            <button
              type="button"
              onClick={() => setLastResult(null)}
              aria-label="Dismiss batch result"
              className="ml-auto text-emerald-800/70 hover:text-emerald-900 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
                close
              </span>
            </button>
          </div>
          {lastResult.skipped.length > 0 && (
            <ul className="pl-6 list-disc text-[11px] text-[#5f5e5e]" aria-label="Skipped receipts">
              {lastResult.skipped.slice(0, 5).map((item) => (
                <li key={`${item.receipt_id}-${item.reason}-${item.detail}`}>
                  <span className="font-semibold">{item.invoice_number || `#${item.receipt_id}`}</span>:{' '}
                  {SKIP_REASON_LABEL[item.reason]}
                </li>
              ))}
              {lastResult.skipped.length > 5 && <li>…and {lastResult.skipped.length - 5} more</li>}
            </ul>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 sm:gap-2.5 w-full min-w-0">
        <KpiCard
          testId="kpi-posted-receipts"
          icon="receipt_long"
          tone="blue"
          label="Total Posted Receipts"
          value={metrics ? `${metrics.posted_receipts} / ${metrics.total_receipts}` : placeholder}
          detail={metrics ? `${formatMoney(metrics.posted_grand_total, currency)} billed` : undefined}
        />
        <KpiCard
          testId="kpi-posted-revenue"
          icon="trending_up"
          tone="emerald"
          label="Posted Revenue"
          value={metrics ? formatMoney(metrics.posted_revenue, currency) : placeholder}
          detail={metrics ? `${metrics.posted_ledger_entries} posted entries` : undefined}
        />
        <KpiCard
          testId="kpi-unposted-transactions"
          icon="pending_actions"
          tone={metrics && metrics.unposted_transactions > 0 ? 'amber' : 'zinc'}
          label="Unposted Transactions"
          value={metrics ? metrics.unposted_transactions : placeholder}
          detail={metrics ? `${metrics.unposted_receipts} unposted · ${metrics.pending_receipts} pending` : undefined}
        />
        <KpiCard
          testId="kpi-pending-entries"
          icon="book"
          tone={metrics && metrics.pending_ledger_entries > 0 ? 'amber' : 'zinc'}
          label="Pending Ledger Entries"
          value={metrics ? metrics.pending_ledger_entries : placeholder}
          detail="Draft journal entries"
        />
        <KpiCard
          testId="kpi-tax-balances"
          icon="account_balance"
          tone="purple"
          label="Tax Account Balances"
          value={metrics ? formatMoney(metrics.tax_liability_balance, currency) : placeholder}
          detail={
            metrics
              ? metrics.tax_accounts.length > 0
                ? metrics.tax_accounts.map((acc) => `${acc.code} ${formatMoney(acc.balance, currency)}`).join(' · ')
                : 'No tax postings yet'
              : undefined
          }
        />
        <KpiCard
          testId="kpi-balance-status"
          icon={balanceStatus === 'UNBALANCED' ? 'report' : 'verified'}
          tone={balanceStatus === 'BALANCED' ? 'emerald' : balanceStatus === 'UNBALANCED' ? 'red' : 'zinc'}
          label="Balanced Ledger Status"
          value={
            metrics
              ? balanceStatus === 'BALANCED'
                ? 'Balanced'
                : balanceStatus === 'UNBALANCED'
                  ? 'Unbalanced'
                  : 'No entries'
              : placeholder
          }
          detail={
            metrics && metrics.balance.checked_receipts > 0
              ? `${metrics.balance.balanced_receipts} of ${metrics.balance.checked_receipts} receipts balanced`
              : undefined
          }
        />
      </div>

      {modalOpen && (
        <PostBatchModal
          pending={metrics?.unposted_transactions ?? 0}
          onClose={() => setModalOpen(false)}
          onPosted={handlePosted}
        />
      )}
    </div>
  );
};

export default BillingFinancialSyncHeader;
