import React from 'react';
import { AppModal, ModalFormFooter } from '@/shared/components/AppModal';
import type { Receipt } from '../../types/receipts';
import { formatMoney, receiptLabel } from '../../lib/receipts-format';

interface ConfirmLockReceiptDialogProps {
  receipt: Receipt;
  submitting: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

/**
 * Confirmación de LOCK RECEIPT (Historia 11). El bloqueo es irreversible: desde entonces el
 * recibo, sus líneas y sus impuestos no se editan ni se borran, y el back-end registra el
 * usuario y el rol que lo bloquean.
 */
export const ConfirmLockReceiptDialog: React.FC<ConfirmLockReceiptDialogProps> = ({
  receipt,
  submitting,
  onConfirm,
  onClose,
}) => (
  <AppModal title="Lock receipt" subtitle="FISCAL LOCK" onClose={onClose} closeDisabled={submitting} size="md">
    <div className="p-6 space-y-4 font-poppins">
      <div className="flex items-start gap-3">
        <span className="material-symbols-outlined text-amber-700 text-[28px]" aria-hidden="true">
          lock
        </span>
        <div className="space-y-2 text-sm text-[#1d1c17]">
          <p>
            Lock <strong>{receiptLabel(receipt)}</strong> for{' '}
            <strong>{formatMoney(receipt.grand_total, receipt.currency)}</strong>?
          </p>
          <p className="text-[12.5px] text-[#5f5e5e]">
            A locked receipt is immutable: its amounts, line items and taxes can no longer be edited or deleted, and it
            cannot be deactivated. Corrections must be issued as credit or debit notes. Your user and role are recorded
            as the processor of the receipt.
          </p>
        </div>
      </div>
      <ModalFormFooter
        onCancel={onClose}
        submitType="button"
        onSubmit={onConfirm}
        isSubmitting={submitting}
        submitLabel={submitting ? 'Locking…' : 'LOCK RECEIPT'}
      />
    </div>
  </AppModal>
);

export default ConfirmLockReceiptDialog;
