import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppModal } from '@/shared/components/AppModal';
import { Toast, type ToastState } from '@/shared/components/Toast';
import {
  chargeCard,
  getCheckoutOptions,
  getPayableOrders,
  getTransaction,
  listTransactions,
  refundTransaction,
  startTerminalSale,
  voidTransaction,
  type TransactionsPage,
} from '@/modules/restaurant-operations/pos/api/payments';
import { CardField, type CardFieldHandle } from '@/modules/restaurant-operations/pos/lib/card-fields';
import {
  canRefund,
  canReversePayments,
  canVoid,
  cardLabel,
  formatDateTime,
  formatMoney,
  splitDateTime,
  ICON_BUTTON,
  INPUT_CLASS,
  LABEL_CLASS,
  PRIMARY_BUTTON,
  SECONDARY_BUTTON,
  STATUS_BADGE_CLASSES,
  STATUS_LABELS,
  TH_CLASS,
  TYPE_BADGE_CLASSES,
  TYPE_LABELS,
} from '@/modules/restaurant-operations/pos/lib/payment-format';
import {
  PROVIDER_LABELS,
  type CheckoutOptions,
  type PayableOrder,
  type PaymentTransaction,
  type PaymentTransactionStatus,
  type PaymentTransactionType,
} from '@/modules/restaurant-operations/pos/types/payments';

const TERMINAL_POLL_MS = 2000;

const orderLabel = (order: Pick<PayableOrder, 'id' | 'orderNumber' | 'displayId'>) =>
  order.displayId || order.orderNumber ? `#${order.displayId || order.orderNumber}` : `#${order.id}`;

const parseMoney = (value: string): number => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN;
};

function StatusBadge({ status }: { status: PaymentTransactionStatus }) {
  return (
    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded whitespace-nowrap ${STATUS_BADGE_CLASSES[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}

function TypeBadge({ type }: { type: PaymentTransactionType }) {
  return (
    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${TYPE_BADGE_CLASSES[type]}`}>
      {TYPE_LABELS[type]}
    </span>
  );
}

function Field({ label, htmlFor, children, hint }: { label: string; htmlFor: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="flex flex-col gap-1.5 min-w-0">
      <label htmlFor={htmlFor} className={LABEL_CLASS}>
        {label}
      </label>
      {children}
      {hint && <div className="text-[11px] text-[#5f5e5e]">{hint}</div>}
    </div>
  );
}

function ModalFooter({ children }: { children: React.ReactNode }) {
  return <div className="p-4 border-t border-[#e8e2d8] flex justify-end gap-3 shrink-0">{children}</div>;
}

function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div role="alert" className="text-sm text-[#ae001a] font-medium">
      {message}
    </div>
  );
}

// ------------------------------------------------------------ cobro con token

interface ChargeCardModalProps {
  order: PayableOrder;
  options: CheckoutOptions;
  onClose: () => void;
  onDone: (tx: PaymentTransaction) => void;
}

const ChargeCardModal: React.FC<ChargeCardModalProps> = ({ order, options, onClose, onDone }) => {
  const usable = options.configs;
  const [configId, setConfigId] = useState<number>(
    (usable.find((c) => c.isDefault) ?? usable[0])?.id ?? 0,
  );
  const [amount, setAmount] = useState(order.balanceDue.toFixed(2));
  const [tip, setTip] = useState('');
  const [cardComplete, setCardComplete] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cardRef = useRef<CardFieldHandle>(null);

  const config = usable.find((c) => c.id === configId);
  const amountNum = parseMoney(amount);
  const tipNum = tip.trim() === '' ? 0 : parseMoney(tip);
  const amountValid = amountNum > 0 && amountNum <= order.balanceDue + 0.001;
  const tipValid = !Number.isNaN(tipNum) && tipNum >= 0;
  const total = (amountValid ? amountNum : 0) + (tipValid ? tipNum : 0);
  const canSubmit =
    Boolean(config) && config?.tokenization.method !== 'unavailable' && amountValid && tipValid && cardComplete && !submitting;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !config) return;
    setSubmitting(true);
    setError(null);
    try {
      const card = await cardRef.current!.tokenize();
      const { data } = await chargeCard({
        orderId: order.id,
        amount: amountNum,
        ...(tipNum > 0 ? { tipAmount: tipNum } : {}),
        currency: options.defaultCurrency,
        paymentMethodToken: card.token,
        ...(card.expiry ? { cardExpiry: card.expiry } : {}),
        // Sin proveedor el backend usa la configuración por defecto
        ...(config.isDefault ? {} : { paymentProvider: config.provider }),
      });
      if (data.status === 'failed') {
        setError(`Payment declined: ${data.message ?? 'no reason given'}`);
        return;
      }
      onDone(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The card could not be charged');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppModal title={`Charge card · Order ${orderLabel(order)}`} onClose={onClose} closeDisabled={submitting} size="lg">
      <form onSubmit={submit} className="flex-1 flex flex-col min-h-0" aria-label="Charge card">
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div>
              <div className={LABEL_CLASS}>Order total</div>
              <div className="font-bold text-[#1d1c17]">{formatMoney(order.total, options.defaultCurrency)}</div>
            </div>
            <div>
              <div className={LABEL_CLASS}>Paid</div>
              <div className="text-[#1d1c17]">{formatMoney(order.paidTotal, options.defaultCurrency)}</div>
            </div>
            <div>
              <div className={LABEL_CLASS}>Balance due</div>
              <div className="font-bold text-[#ae001a]">{formatMoney(order.balanceDue, options.defaultCurrency)}</div>
            </div>
          </div>
          {usable.length === 0 ? (
            <div role="alert" className="text-sm text-[#ae001a] font-medium">
              No active payment gateway for this branch. Add one in Payment Gateway Configs.
            </div>
          ) : (
            <Field label="Payment gateway" htmlFor="charge-gateway">
              <select
                id="charge-gateway"
                value={configId}
                onChange={(e) => {
                  setConfigId(Number(e.target.value));
                  setCardComplete(false);
                  setError(null);
                }}
                className={INPUT_CLASS}
                disabled={submitting}
              >
                {usable.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.displayName} · {PROVIDER_LABELS[c.provider]}
                    {c.environment === 'sandbox' ? ' (sandbox)' : ''}
                    {c.isDefault ? ' · default' : ''}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Amount"
              htmlFor="charge-amount"
              hint={!amountValid && amount.trim() !== '' ? `Between 0.01 and ${order.balanceDue.toFixed(2)}` : undefined}
            >
              <input
                id="charge-amount"
                type="number"
                step="0.01"
                min="0.01"
                max={order.balanceDue}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className={INPUT_CLASS}
                disabled={submitting}
              />
            </Field>
            <Field label="Tip (optional)" htmlFor="charge-tip">
              <input
                id="charge-tip"
                type="number"
                step="0.01"
                min="0"
                value={tip}
                placeholder="0.00"
                onChange={(e) => setTip(e.target.value)}
                className={INPUT_CLASS}
                disabled={submitting}
              />
            </Field>
          </div>
          {config && (
            <div className="flex flex-col gap-1.5">
              <span className={LABEL_CLASS}>Card</span>
              <CardField key={config.id} ref={cardRef} tokenization={config.tokenization} onCompleteChange={setCardComplete} />
              <div className="text-[11px] text-[#5f5e5e] flex items-center gap-1">
                <span aria-hidden="true" className="material-symbols-outlined text-sm">verified_user</span>
                The card is tokenized by {PROVIDER_LABELS[config.provider]}; it never reaches X7 POS.
              </div>
            </div>
          )}
          <FormError message={error} />
        </div>
        <ModalFooter>
          <button type="button" onClick={onClose} disabled={submitting} className={SECONDARY_BUTTON}>
            Cancel
          </button>
          <button type="submit" disabled={!canSubmit} className={PRIMARY_BUTTON}>
            {submitting && <span aria-hidden="true" className="material-symbols-outlined text-base animate-spin">progress_activity</span>}
            {submitting ? 'Charging…' : `Charge ${formatMoney(total, options.defaultCurrency)}`}
          </button>
        </ModalFooter>
      </form>
    </AppModal>
  );
};

// ------------------------------------------------------------ venta en terminal

interface TerminalSaleModalProps {
  order: PayableOrder;
  options: CheckoutOptions;
  onClose: (changed: boolean) => void;
  onPaid: (tx: PaymentTransaction) => void;
}

const TerminalSaleModal: React.FC<TerminalSaleModalProps> = ({ order, options, onClose, onPaid }) => {
  const [terminalId, setTerminalId] = useState<number>(options.terminals[0]?.id ?? 0);
  const [amount, setAmount] = useState(order.balanceDue.toFixed(2));
  const [tip, setTip] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sale, setSale] = useState<PaymentTransaction | null>(null);

  const terminal = options.terminals.find((t) => t.id === terminalId);
  const amountNum = parseMoney(amount);
  const tipNum = tip.trim() === '' ? 0 : parseMoney(tip);
  const amountValid = amountNum > 0 && amountNum <= order.balanceDue + 0.001;
  const tipValid = !Number.isNaN(tipNum) && tipNum >= 0;
  const total = (amountValid ? amountNum : 0) + (tipValid ? tipNum : 0);

  // Sigue la venta hasta que el proveedor da el resultado final
  useEffect(() => {
    if (!sale || sale.status !== 'pending') return undefined;
    const timer = setTimeout(async () => {
      try {
        const next = await getTransaction(sale.id);
        setSale(next);
        if (next.status === 'paid') onPaid(next);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not check the terminal');
        setSale({ ...sale });
      }
    }, TERMINAL_POLL_MS);
    return () => clearTimeout(timer);
  }, [sale, onPaid]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!terminal || !amountValid || !tipValid) return;
    setSubmitting(true);
    setError(null);
    try {
      const started = await startTerminalSale({
        orderId: order.id,
        terminalId: terminal.id,
        amount: amountNum,
        ...(tipNum > 0 ? { tipAmount: tipNum } : {}),
        currency: options.defaultCurrency,
      });
      setSale(started);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The sale could not be sent to the terminal');
    } finally {
      setSubmitting(false);
    }
  };

  const waiting = sale?.status === 'pending';
  return (
    <AppModal
      title={`Terminal sale · Order ${orderLabel(order)}`}
      onClose={() => onClose(Boolean(sale))}
      closeDisabled={submitting}
      size="lg"
    >
      {!sale ? (
        <form onSubmit={send} className="flex-1 flex flex-col min-h-0" aria-label="Terminal sale">
          <div className="p-6 space-y-4 overflow-y-auto flex-1">
            {options.terminals.length === 0 ? (
              <div role="alert" className="text-sm text-[#ae001a] font-medium">
                No active payment terminal in this branch. Register one in Payment Terminals.
              </div>
            ) : (
              <Field label="Terminal" htmlFor="terminal-select">
                <select
                  id="terminal-select"
                  value={terminalId}
                  onChange={(e) => setTerminalId(Number(e.target.value))}
                  className={INPUT_CLASS}
                  disabled={submitting}
                >
                  {options.terminals.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                      {t.model ? ` · ${t.model}` : ''} · {PROVIDER_LABELS[t.provider]}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Amount" htmlFor="terminal-amount" hint={`Balance due ${formatMoney(order.balanceDue, options.defaultCurrency)}`}>
                <input
                  id="terminal-amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={order.balanceDue}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className={INPUT_CLASS}
                  disabled={submitting}
                />
              </Field>
              <Field label="Tip (optional)" htmlFor="terminal-tip">
                <input
                  id="terminal-tip"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={tip}
                  onChange={(e) => setTip(e.target.value)}
                  className={INPUT_CLASS}
                  disabled={submitting}
                />
              </Field>
            </div>
            <FormError message={error} />
          </div>
          <ModalFooter>
            <button type="button" onClick={() => onClose(false)} disabled={submitting} className={SECONDARY_BUTTON}>
              Cancel
            </button>
            <button type="submit" disabled={!terminal || !amountValid || !tipValid || submitting} className={PRIMARY_BUTTON}>
              {submitting ? (
                <span aria-hidden="true" className="material-symbols-outlined text-base animate-spin">progress_activity</span>
              ) : (
                <span aria-hidden="true" className="material-symbols-outlined text-base">contactless</span>
              )}
              Send {formatMoney(total, options.defaultCurrency)} to terminal
            </button>
          </ModalFooter>
        </form>
      ) : (
        <div className="flex-1 flex flex-col min-h-0">
          <div className="p-8 flex flex-col items-center text-center gap-3" aria-live="polite" data-testid="terminal-sale-status">
            {waiting && (
              <>
                <span aria-hidden="true" className="material-symbols-outlined text-6xl text-[#ae001a] animate-pulse">contactless</span>
                <div className="font-bold text-[#1d1c17]">Waiting for the customer card</div>
                <div className="text-sm text-[#5f5e5e] max-w-sm">
                  {formatMoney(sale.amount, sale.currency)} is on {terminal?.name ?? 'the terminal'}. The customer can tap,
                  insert or swipe the card. This screen updates by itself.
                </div>
              </>
            )}
            {sale.status === 'paid' && (
              <>
                <span aria-hidden="true" className="material-symbols-outlined text-6xl text-green-600">check_circle</span>
                <div className="font-bold text-[#1d1c17]">Payment approved</div>
                <div className="text-sm text-[#5f5e5e]">
                  {formatMoney(sale.amount, sale.currency)} · {cardLabel(sale)}
                  {sale.authorizationCode ? ` · Auth ${sale.authorizationCode}` : ''}
                </div>
              </>
            )}
            {sale.status === 'failed' && (
              <>
                <span aria-hidden="true" className="material-symbols-outlined text-6xl text-red-600">cancel</span>
                <div className="font-bold text-[#1d1c17]">Payment failed</div>
                <div className="text-sm text-[#ae001a] font-medium">{sale.message ?? 'The terminal did not approve the card'}</div>
              </>
            )}
            <div className="mt-1">
              <StatusBadge status={sale.status} />
            </div>
            <FormError message={error} />
          </div>
          <ModalFooter>
            {sale.status === 'failed' && (
              <button
                type="button"
                onClick={() => {
                  setSale(null);
                  setError(null);
                }}
                className={SECONDARY_BUTTON}
              >
                Try again
              </button>
            )}
            <button type="button" onClick={() => onClose(true)} className={waiting ? SECONDARY_BUTTON : PRIMARY_BUTTON}>
              {waiting ? 'Close (keeps waiting)' : 'Done'}
            </button>
          </ModalFooter>
        </div>
      )}
    </AppModal>
  );
};

// --------------------------------------------------- devolución y anulación

interface RefundModalProps {
  sale: PaymentTransaction;
  onClose: () => void;
  onDone: (message: string, ok: boolean) => void;
}

const RefundModal: React.FC<RefundModalProps> = ({ sale, onClose, onDone }) => {
  const [amount, setAmount] = useState(sale.refundableAmount.toFixed(2));
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const amountNum = parseMoney(amount);
  const valid = amountNum > 0 && amountNum <= sale.refundableAmount + 0.001;
  const isFull = valid && Math.abs(amountNum - sale.refundableAmount) < 0.001;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await refundTransaction(sale.id, {
        ...(isFull ? {} : { amount: amountNum }),
        ...(reason.trim() ? { reason: reason.trim() } : {}),
      });
      if (result.data.status === 'failed') {
        setError(result.message || `The gateway did not refund: ${result.data.message ?? ''}`);
        return;
      }
      onDone(`Refunded ${formatMoney(result.data.amount, result.data.currency)} · ${cardLabel(result.sale)}`, true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The refund could not be processed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppModal title={`Refund payment #PT-${sale.id}`} onClose={onClose} closeDisabled={submitting} size="md">
      <form onSubmit={submit} className="flex-1 flex flex-col min-h-0" aria-label="Refund payment">
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div>
              <div className={LABEL_CLASS}>Charged</div>
              <div className="font-bold">{formatMoney(sale.amount, sale.currency)}</div>
            </div>
            <div>
              <div className={LABEL_CLASS}>Refunded</div>
              <div>{formatMoney(sale.refundedAmount, sale.currency)}</div>
            </div>
            <div>
              <div className={LABEL_CLASS}>Refundable</div>
              <div className="font-bold text-[#ae001a]">{formatMoney(sale.refundableAmount, sale.currency)}</div>
            </div>
          </div>
          <Field label="Refund amount" htmlFor="refund-amount" hint={isFull ? 'Full refund of the remaining balance' : 'Partial refund'}>
            <div className="flex gap-2">
              <input
                id="refund-amount"
                type="number"
                step="0.01"
                min="0.01"
                max={sale.refundableAmount}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className={INPUT_CLASS}
                disabled={submitting}
              />
              <button
                type="button"
                onClick={() => setAmount(sale.refundableAmount.toFixed(2))}
                className={SECONDARY_BUTTON}
                disabled={submitting}
              >
                Max
              </button>
            </div>
          </Field>
          <Field label="Reason (optional)" htmlFor="refund-reason">
            <input
              id="refund-reason"
              type="text"
              maxLength={255}
              value={reason}
              placeholder="e.g. Customer returned the dish"
              onChange={(e) => setReason(e.target.value)}
              className={INPUT_CLASS}
              disabled={submitting}
            />
          </Field>
          <FormError message={error} />
        </div>
        <ModalFooter>
          <button type="button" onClick={onClose} disabled={submitting} className={SECONDARY_BUTTON}>
            Cancel
          </button>
          <button type="submit" disabled={!valid || submitting} className={PRIMARY_BUTTON}>
            {submitting && <span aria-hidden="true" className="material-symbols-outlined text-base animate-spin">progress_activity</span>}
            {submitting ? 'Refunding…' : `Refund ${formatMoney(valid ? amountNum : 0, sale.currency)}`}
          </button>
        </ModalFooter>
      </form>
    </AppModal>
  );
};

interface VoidModalProps {
  sale: PaymentTransaction;
  onClose: () => void;
  onDone: (message: string, ok: boolean) => void;
}

const VoidModal: React.FC<VoidModalProps> = ({ sale, onClose, onDone }) => {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const result = await voidTransaction(sale.id, reason.trim() ? { reason: reason.trim() } : {});
      if (result.data.status === 'failed') {
        setError(
          `${result.message || 'The gateway did not void the payment'}. If the batch is already closed, refund it instead.`,
        );
        return;
      }
      onDone(result.message || 'Payment voided', true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The void could not be processed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppModal title={`Void payment #PT-${sale.id}?`} onClose={onClose} closeDisabled={submitting} size="md">
      <form onSubmit={submit} className="flex-1 flex flex-col min-h-0" aria-label="Void payment">
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          <div className="text-sm text-[#1d1c17] leading-relaxed">
            Voiding reverses the whole {formatMoney(sale.amount, sale.currency)} charge ({cardLabel(sale)}) before the
            batch closes. The order goes back to unpaid and the payment can no longer be refunded or voided.
          </div>
          <Field label="Reason (optional)" htmlFor="void-reason">
            <input
              id="void-reason"
              type="text"
              maxLength={255}
              value={reason}
              placeholder="e.g. Charged the wrong table"
              onChange={(e) => setReason(e.target.value)}
              className={INPUT_CLASS}
              disabled={submitting}
            />
          </Field>
          <FormError message={error} />
        </div>
        <ModalFooter>
          <button type="button" onClick={onClose} disabled={submitting} className={SECONDARY_BUTTON}>
            Cancel
          </button>
          <button type="submit" disabled={submitting} className={PRIMARY_BUTTON}>
            {submitting && <span aria-hidden="true" className="material-symbols-outlined text-base animate-spin">progress_activity</span>}
            {submitting ? 'Voiding…' : 'Void payment'}
          </button>
        </ModalFooter>
      </form>
    </AppModal>
  );
};

// ------------------------------------------------------------------ detalle

interface DetailModalProps {
  tx: PaymentTransaction;
  related: PaymentTransaction[];
  allowReverse: boolean;
  onClose: () => void;
  onRefund: (tx: PaymentTransaction) => void;
  onVoid: (tx: PaymentTransaction) => void;
}

const DetailModal: React.FC<DetailModalProps> = ({ tx, related, allowReverse, onClose, onRefund, onVoid }) => {
  const rows: Array<[string, React.ReactNode]> = [
    ['Type', <TypeBadge key="t" type={tx.type} />],
    ['Status', <StatusBadge key="s" status={tx.status} />],
    ['Gateway', `${PROVIDER_LABELS[tx.provider]} · ${tx.channel === 'terminal' ? `Terminal #${tx.terminalId}` : 'Card token'}`],
    ['Order ID', tx.orderId ? String(tx.orderId) : '—'],
    ['Amount', formatMoney(tx.amount, tx.currency)],
    ['Tip', formatMoney(tx.tipAmount, tx.currency)],
    ['Card', cardLabel(tx)],
    ['Authorization', tx.authorizationCode || '—'],
    ['Gateway reference', tx.providerTransactionId || '—'],
    ['Gateway message', tx.message || '—'],
    ['Reason', tx.reason || '—'],
    ['Created', formatDateTime(tx.createdAt)],
    ['Completed', formatDateTime(tx.completedAt)],
  ];
  if (tx.type === 'sale') {
    rows.splice(6, 0, ['Refunded', formatMoney(tx.refundedAmount, tx.currency)], [
      'Refundable',
      formatMoney(tx.refundableAmount, tx.currency),
    ]);
  }
  return (
    <AppModal title={`Payment #PT-${tx.id}`} onClose={onClose} size="2xl" closeOnBackdrop>
      <div className="p-6 overflow-y-auto flex-1 space-y-6 text-sm">
        <dl className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-4">
          {rows.map(([label, value]) => (
            <div key={label} className="min-w-0">
              <dt className={LABEL_CLASS}>{label}</dt>
              <dd className="text-[#1d1c17] break-words mt-0.5">{value}</dd>
            </div>
          ))}
        </dl>
        {related.length > 0 && (
          <div>
            <div className={`${LABEL_CLASS} mb-2`}>Refunds and voids</div>
            <ul className="divide-y divide-[#e8e2d8] border border-[#e8e2d8] rounded">
              {related.map((r) => (
                <li key={r.id} className="px-4 py-2 flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2">
                    <TypeBadge type={r.type} /> #PT-{r.id}
                  </span>
                  <span>{formatMoney(r.amount, r.currency)}</span>
                  <StatusBadge status={r.status} />
                  <span className="text-[11px] text-[#5f5e5e]">{formatDateTime(r.createdAt)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      {allowReverse && (canRefund(tx) || canVoid(tx)) && (
        <ModalFooter>
          {canVoid(tx) && (
            <button type="button" onClick={() => onVoid(tx)} className={SECONDARY_BUTTON}>
              Void
            </button>
          )}
          {canRefund(tx) && (
            <button type="button" onClick={() => onRefund(tx)} className={PRIMARY_BUTTON}>
              Refund
            </button>
          )}
        </ModalFooter>
      )}
    </AppModal>
  );
};

// --------------------------------------------------------------------- vista

const TX_STATUSES: PaymentTransactionStatus[] = ['pending', 'paid', 'failed', 'partially_refunded', 'refunded', 'voided', 'succeeded'];
const PAGE_SIZE = 10;

interface OrderPaymentsViewProps {
  onNavigate?: (view: string) => void;
}

export const OrderPaymentsView: React.FC<OrderPaymentsViewProps> = ({ onNavigate }) => {
  const [options, setOptions] = useState<CheckoutOptions | null>(null);
  const [orders, setOrders] = useState<PayableOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [page, setPage] = useState<TransactionsPage | null>(null);
  const [txLoading, setTxLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<PaymentTransactionType | ''>('');
  const [statusFilter, setStatusFilter] = useState<PaymentTransactionStatus | ''>('');
  const [orderFilter, setOrderFilter] = useState('');
  const [pageNumber, setPageNumber] = useState(1);
  const [toast, setToast] = useState<ToastState | null>(null);

  const [charging, setCharging] = useState<PayableOrder | null>(null);
  const [terminalOrder, setTerminalOrder] = useState<PayableOrder | null>(null);
  const [detail, setDetail] = useState<PaymentTransaction | null>(null);
  const [related, setRelated] = useState<PaymentTransaction[]>([]);
  const [refunding, setRefunding] = useState<PaymentTransaction | null>(null);
  const [voiding, setVoiding] = useState<PaymentTransaction | null>(null);
  const allowReverse = useMemo(() => canReversePayments(), []);
  const txRequest = useRef(0);

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const loadOrders = useCallback(async () => {
    setOrdersLoading(true);
    try {
      setOrders(await getPayableOrders());
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load orders');
    } finally {
      setOrdersLoading(false);
    }
  }, []);

  const loadTransactions = useCallback(async () => {
    const id = ++txRequest.current;
    setTxLoading(true);
    try {
      const orderId = Number(orderFilter);
      const result = await listTransactions({
        type: typeFilter,
        status: statusFilter,
        orderId: Number.isInteger(orderId) && orderId > 0 ? orderId : undefined,
        page: pageNumber,
        limit: PAGE_SIZE,
      });
      if (id === txRequest.current) setPage(result);
    } catch (err) {
      if (id === txRequest.current) setLoadError(err instanceof Error ? err.message : 'Failed to load payment transactions');
    } finally {
      if (id === txRequest.current) setTxLoading(false);
    }
  }, [typeFilter, statusFilter, orderFilter, pageNumber]);

  const loadOptions = useCallback(async () => {
    try {
      setOptions(await getCheckoutOptions());
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load payment options');
    }
  }, []);

  useEffect(() => {
    void loadOptions();
    void loadOrders();
  }, [loadOptions, loadOrders]);

  useEffect(() => {
    const t = setTimeout(() => void loadTransactions(), orderFilter ? 300 : 0);
    return () => clearTimeout(t);
  }, [loadTransactions, orderFilter]);

  const refreshAll = useCallback(async () => {
    await Promise.all([loadOrders(), loadTransactions()]);
  }, [loadOrders, loadTransactions]);

  const openDetail = async (tx: PaymentTransaction) => {
    setDetail(tx);
    setRelated([]);
    try {
      const [fresh, history] = await Promise.all([
        getTransaction(tx.id),
        tx.orderId ? listTransactions({ orderId: tx.orderId, limit: 100 }) : Promise.resolve(null),
      ]);
      setDetail(fresh);
      setRelated((history?.data ?? []).filter((r) => r.parentTransactionId === tx.id));
    } catch (err) {
      setToast({ message: err instanceof Error ? err.message : 'Failed to load the payment', type: 'error' });
    }
  };

  const afterReverse = async (message: string, ok: boolean) => {
    setRefunding(null);
    setVoiding(null);
    setDetail(null);
    setToast({ message, type: ok ? 'success' : 'error' });
    await refreshAll();
  };

  const clearFilters = () => {
    setTypeFilter('');
    setStatusFilter('');
    setOrderFilter('');
    setPageNumber(1);
  };

  const transactions = page?.data ?? [];
  const hasFilters = Boolean(typeFilter || statusFilter || orderFilter);
  const totalPages = page?.paginationMeta.totalPages ?? 1;
  const currency = options?.defaultCurrency ?? 'USD';
  const noGateway = options !== null && options.configs.length === 0;

  if (loadError && !options && !page) {
    return (
      <div className="border border-red-300 bg-red-50 p-8 text-center" role="alert">
        <span aria-hidden="true" className="material-symbols-outlined text-red-500 text-4xl">
          error
        </span>
        <div className="mt-3 text-red-700 font-medium">{loadError}</div>
        <button
          type="button"
          onClick={() => {
            setLoadError(null);
            void loadOptions();
            void refreshAll();
          }}
          className="mt-4 px-4 py-2 bg-[#222222] text-white font-bold text-[11px] uppercase tracking-widest hover:bg-[#ae001a] transition-colors"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 animate-fade-in text-left">
      {noGateway && (
        <div className="bg-amber-50 border border-amber-300 p-4 rounded flex flex-wrap items-center justify-between gap-3" role="status">
          <div className="text-sm text-amber-800">
            This branch has no active payment gateway yet. Card charges and terminal sales are disabled until one is configured.
          </div>
          {onNavigate && (
            <button type="button" onClick={() => onNavigate('payment-gateway-configs')} className={PRIMARY_BUTTON}>
              <span aria-hidden="true" className="material-symbols-outlined text-base">account_balance</span>
              Configure gateway
            </button>
          )}
        </div>
      )}

      {/* Pedidos por cobrar */}
      <section className="bg-white border border-[#e8e2d8] overflow-hidden rounded shadow-sm" aria-label="Orders awaiting payment">
        <div className="p-4 bg-[#222222] flex justify-between items-center gap-3">
          <span className="text-[11px] font-bold text-white uppercase tracking-widest">Orders awaiting payment</span>
          <div className="flex items-center gap-3">
            <span className="text-white/50 text-xs">{ordersLoading ? 'Loading...' : `${orders.length} orders`}</span>
            <button
              type="button"
              onClick={() => void loadOrders()}
              aria-label="Refresh orders"
              className="text-white/70 hover:text-white transition-colors"
            >
              <span aria-hidden="true" className="material-symbols-outlined text-[20px]">refresh</span>
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-[#ece8e0] border-b border-[#e8e2d8]">
              <tr>
                <th className={TH_CLASS}>Order</th>
                <th className={TH_CLASS}>Type</th>
                <th className={TH_CLASS}>Total</th>
                <th className={TH_CLASS}>Paid</th>
                <th className={TH_CLASS}>Balance due</th>
                <th className={`${TH_CLASS} text-right`}>Collect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e8e2d8]">
              {ordersLoading && orders.length === 0 ? (
                [1, 2].map((i) => (
                  <tr key={i}>
                    {[24, 16, 16, 16, 20, 40].map((w, j) => (
                      <td key={j} className="px-4 py-4">
                        <div className="h-4 bg-[#ece8e0] rounded animate-pulse" style={{ width: `${w * 4}px` }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center">
                    <div className="flex flex-col items-center gap-2" data-testid="orders-empty-state">
                      <span aria-hidden="true" className="material-symbols-outlined text-[#d51f2c] text-4xl">task_alt</span>
                      <div className="text-sm text-[#5f5e5e]">No orders with a balance due. Everything is collected.</div>
                    </div>
                  </td>
                </tr>
              ) : (
                orders.map((order) => (
                  <tr key={order.id} data-testid={`payable-order-${order.id}`} className="hover:bg-[#f8f3eb] transition-colors">
                    <td className="px-4 py-4">
                      <span className="block font-bold text-[#1d1c17]">{orderLabel(order)}</span>
                      <span className="block text-[11px] text-[#5f5e5e]">Order ID {order.id}</span>
                    </td>
                    <td className="px-4 py-4 capitalize">{order.type.replace('_', ' ')}</td>
                    <td className="px-4 py-4">{formatMoney(order.total, currency)}</td>
                    <td className="px-4 py-4">{formatMoney(order.paidTotal, currency)}</td>
                    <td className="px-4 py-4 font-bold text-[#ae001a]">{formatMoney(order.balanceDue, currency)}</td>
                    <td className="px-4 py-4">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setCharging(order)}
                          disabled={!options || noGateway}
                          aria-label={`Charge card for order ${orderLabel(order)}`}
                          className={`${SECONDARY_BUTTON} flex items-center gap-1.5 hover:text-[#ae001a]`}
                        >
                          <span aria-hidden="true" className="material-symbols-outlined text-base">credit_card</span>
                          Charge card
                        </button>
                        <button
                          type="button"
                          onClick={() => setTerminalOrder(order)}
                          disabled={!options || options.terminals.length === 0}
                          title={options && options.terminals.length === 0 ? 'No active terminal in this branch' : undefined}
                          aria-label={`Send order ${orderLabel(order)} to a terminal`}
                          className={`${SECONDARY_BUTTON} flex items-center gap-1.5 hover:text-[#ae001a]`}
                        >
                          <span aria-hidden="true" className="material-symbols-outlined text-base">contactless</span>
                          Terminal
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Historial */}
      <section className="flex flex-col gap-4" aria-label="Payment transactions">
        <div className="bg-white border border-[#e8e2d8] p-4 rounded shadow-sm flex flex-wrap items-center gap-3">
          <select
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value as PaymentTransactionType | '');
              setPageNumber(1);
            }}
            aria-label="Filter by type"
            className="px-3 py-2 bg-[#fef9f1] border border-[#e8e2d8] rounded text-sm focus:border-[#ae001a] outline-none"
          >
            <option value="">All types</option>
            <option value="sale">Sales</option>
            <option value="refund">Refunds</option>
            <option value="void">Voids</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as PaymentTransactionStatus | '');
              setPageNumber(1);
            }}
            aria-label="Filter by status"
            className="px-3 py-2 bg-[#fef9f1] border border-[#e8e2d8] rounded text-sm focus:border-[#ae001a] outline-none"
          >
            <option value="">All statuses</option>
            {TX_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
          <input
            type="number"
            min="1"
            value={orderFilter}
            onChange={(e) => {
              setOrderFilter(e.target.value);
              setPageNumber(1);
            }}
            placeholder="Order ID"
            aria-label="Filter by order ID"
            className="w-32 px-3 py-2 bg-[#fef9f1] border border-[#e8e2d8] rounded text-sm focus:border-[#ae001a] outline-none"
          />
          {hasFilters && (
            <button type="button" onClick={clearFilters} className={SECONDARY_BUTTON}>
              Clear Filters
            </button>
          )}
          <button type="button" onClick={() => void refreshAll()} className={`${SECONDARY_BUTTON} ml-auto flex items-center gap-1.5`}>
            <span aria-hidden="true" className="material-symbols-outlined text-base">refresh</span>
            Refresh
          </button>
        </div>

        <div className="bg-white border border-[#e8e2d8] overflow-hidden rounded shadow-sm">
          <div className="p-4 bg-[#222222] flex justify-between items-center">
            <span className="text-[11px] font-bold text-white uppercase tracking-widest">Card payment transactions</span>
            <span className="text-white/50 text-xs">
              {txLoading ? 'Loading...' : `${page?.paginationMeta.total ?? 0} transactions`}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead className="bg-[#ece8e0] border-b border-[#e8e2d8]">
                <tr>
                  <th className={TH_CLASS}>Payment</th>
                  <th className={TH_CLASS}>Order ID</th>
                  <th className={TH_CLASS}>Amount</th>
                  <th className={TH_CLASS}>Card</th>
                  <th className={TH_CLASS}>Gateway</th>
                  <th className={`${TH_CLASS} text-center`}>Status</th>
                  <th className={TH_CLASS}>Date</th>
                  <th className={`${TH_CLASS} text-center`}>Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e8e2d8]">
                {txLoading && transactions.length === 0 ? (
                  [1, 2, 3].map((i) => (
                    <tr key={i}>
                      {Array.from({ length: 8 }, (_, j) => (
                        <td key={j} className="px-4 py-4">
                          <div className="h-4 bg-[#ece8e0] rounded animate-pulse w-16" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : transactions.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-10 text-center">
                      <div className="flex flex-col items-center gap-3" data-testid="transactions-empty-state">
                        <span aria-hidden="true" className="material-symbols-outlined text-[#5f5e5e] text-4xl">
                          {hasFilters ? 'search_off' : 'receipt_long'}
                        </span>
                        <div className="text-sm text-[#5f5e5e]">
                          {hasFilters ? 'No payments match your filters' : 'No card payments yet. Charge an order to see it here.'}
                        </div>
                        {hasFilters && (
                          <button type="button" onClick={clearFilters} className="text-[#ae001a] text-sm font-semibold hover:underline">
                            Clear filters
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  transactions.map((tx) => (
                    <tr key={tx.id} data-testid={`payment-row-${tx.id}`} className="hover:bg-[#f8f3eb] transition-colors">
                      <td className="px-4 py-4">
                        <div className="font-bold text-[#1d1c17] flex items-center gap-2 whitespace-nowrap">
                          #PT-{tx.id} <TypeBadge type={tx.type} />
                        </div>
                        {tx.parentTransactionId && (
                          <div className="text-[11px] text-[#5f5e5e] mt-1">of #PT-{tx.parentTransactionId}</div>
                        )}
                      </td>
                      <td className="px-4 py-4">{tx.orderId ?? '—'}</td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className="block font-semibold">{formatMoney(tx.amount, tx.currency)}</span>
                        {tx.type === 'sale' && tx.refundedAmount > 0 && (
                          <span className="block text-[11px] text-blue-700">
                            −{formatMoney(tx.refundedAmount, tx.currency)} refunded
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">{cardLabel(tx)}</td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        {PROVIDER_LABELS[tx.provider]}
                        <span className="block text-[11px] text-[#5f5e5e]">{tx.channel === 'terminal' ? 'Terminal' : 'Card token'}</span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <StatusBadge status={tx.status} />
                      </td>
                      <td className="px-4 py-4 text-[12px] text-[#5f5e5e] whitespace-nowrap">
                        <span className="block">{splitDateTime(tx.createdAt).date}</span>
                        <span className="block">{splitDateTime(tx.createdAt).time}</span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => void openDetail(tx)}
                            aria-label={`View payment ${tx.id}`}
                            className={ICON_BUTTON}
                          >
                            <span aria-hidden="true" className="material-symbols-outlined text-[20px]">visibility</span>
                          </button>
                          {allowReverse && canRefund(tx) && (
                            <button
                              type="button"
                              onClick={() => setRefunding(tx)}
                              aria-label={`Refund payment ${tx.id}`}
                              className={ICON_BUTTON}
                            >
                              <span aria-hidden="true" className="material-symbols-outlined text-[20px]">currency_exchange</span>
                            </button>
                          )}
                          {allowReverse && canVoid(tx) && (
                            <button
                              type="button"
                              onClick={() => setVoiding(tx)}
                              aria-label={`Void payment ${tx.id}`}
                              className={ICON_BUTTON}
                            >
                              <span aria-hidden="true" className="material-symbols-outlined text-[20px]">block</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="p-4 border-t border-[#e8e2d8] flex items-center justify-between text-sm">
              <span className="text-[#5f5e5e]">
                Page {pageNumber} of {totalPages}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPageNumber((p) => Math.max(1, p - 1))}
                  disabled={pageNumber <= 1 || txLoading}
                  className={SECONDARY_BUTTON}
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() => setPageNumber((p) => Math.min(totalPages, p + 1))}
                  disabled={pageNumber >= totalPages || txLoading}
                  className={SECONDARY_BUTTON}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {charging && options && (
        <ChargeCardModal
          order={charging}
          options={options}
          onClose={() => setCharging(null)}
          onDone={(tx) => {
            setCharging(null);
            setToast({ message: `Payment approved: ${formatMoney(tx.amount, tx.currency)} · ${cardLabel(tx)}`, type: 'success' });
            void refreshAll();
          }}
        />
      )}
      {terminalOrder && options && (
        <TerminalSaleModal
          order={terminalOrder}
          options={options}
          onClose={(changed) => {
            setTerminalOrder(null);
            if (changed) void refreshAll();
          }}
          onPaid={(tx) => {
            setToast({ message: `Terminal payment approved: ${formatMoney(tx.amount, tx.currency)}`, type: 'success' });
            void refreshAll();
          }}
        />
      )}
      {detail && !refunding && !voiding && (
        <DetailModal
          tx={detail}
          related={related}
          allowReverse={allowReverse}
          onClose={() => setDetail(null)}
          onRefund={setRefunding}
          onVoid={setVoiding}
        />
      )}
      {refunding && <RefundModal sale={refunding} onClose={() => setRefunding(null)} onDone={afterReverse} />}
      {voiding && <VoidModal sale={voiding} onClose={() => setVoiding(null)} onDone={afterReverse} />}
      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
};

export default OrderPaymentsView;
