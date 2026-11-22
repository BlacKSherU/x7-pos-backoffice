import React from 'react';
import type { Receipt } from '../../types/receipts';
import { formatMoney } from '../../lib/receipts-format';
import { grandTotalBalance, resolveTaxExemption } from '../../lib/receipt-fiscal';

/**
 * Badge "TAX EXEMPT" (Historia 10): el recibo está exento según fiscal_data (tax_exempt o
 * exemption_code). No se pinta nada para recibos que pagan impuestos.
 */
export const TaxExemptBadge: React.FC<{ receipt: Pick<Receipt, 'id' | 'fiscal_data'>; compact?: boolean }> = ({
  receipt,
  compact = false,
}) => {
  const exemption = resolveTaxExemption(receipt.fiscal_data);
  if (!exemption.exempt) return null;
  return (
    <span
      data-testid={`receipt-${receipt.id}-tax-exempt`}
      title={exemption.exemptionCode ? `Tax exemption ${exemption.exemptionCode}` : 'Tax exempt'}
      className={`inline-flex items-center gap-0.5 rounded border border-sky-200 bg-sky-50 text-sky-800 font-bold uppercase tracking-wider font-poppins ${
        compact ? 'px-1.5 py-0.5 text-[9.5px]' : 'px-2 py-0.5 text-[10px]'
      }`}
    >
      <span className="material-symbols-outlined text-[12px]" aria-hidden="true">
        verified_user
      </span>
      TAX EXEMPT
    </span>
  );
};

/**
 * Indicador de cuadre: grand_total = subtotal + total_tax − total_discount comprobado en
 * centavos enteros. Verde si cuadra al centavo; rojo con la diferencia si no.
 */
export const GrandTotalBalanceIndicator: React.FC<{
  receipt: Pick<Receipt, 'id' | 'subtotal' | 'total_tax' | 'total_discount' | 'grand_total' | 'currency'>;
}> = ({ receipt }) => {
  const balance = grandTotalBalance(receipt);
  const label = balance.balanced
    ? 'Balanced to the cent: subtotal + tax − discount = grand total'
    : `Out of balance by ${formatMoney(balance.differenceCents / 100, receipt.currency)}: expected ${formatMoney(
        balance.expected,
        receipt.currency,
      )}`;
  return (
    <span
      data-testid={`receipt-${receipt.id}-balance`}
      data-balanced={balance.balanced ? 'true' : 'false'}
      role="img"
      aria-label={label}
      title={label}
      className={`material-symbols-outlined text-[14px] align-middle ml-1 ${
        balance.balanced ? 'text-emerald-600' : 'text-red-600'
      }`}
    >
      {balance.balanced ? 'check_circle' : 'error'}
    </span>
  );
};

/**
 * Badge de candado del bloqueo fiscal (Historia 11): recibo (o línea / impuesto de un recibo)
 * bloqueado, sin acciones de edición ni borrado.
 */
export const FiscalLockBadge: React.FC<{ testId?: string; label?: string; title?: string }> = ({
  testId,
  label = 'Locked',
  title = 'Fiscally locked: changes go through credit / debit notes',
}) => (
  <span
    data-testid={testId}
    title={title}
    className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-bold uppercase font-poppins whitespace-nowrap"
  >
    <span className="material-symbols-outlined text-[12px]" aria-hidden="true">
      lock
    </span>
    {label}
  </span>
);
