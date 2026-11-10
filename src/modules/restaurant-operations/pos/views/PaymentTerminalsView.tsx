import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AppModal } from '@/shared/components/AppModal';
import { Toast, type ToastState } from '@/shared/components/Toast';
import { ConfirmStatusToggleDialog, StatusToggleButton } from '@/shared/components/StatusToggle';
import { getCurrentMerchantId } from '@/modules/platform-saas/users/api/users';
import {
  createTerminal,
  deleteTerminal,
  getCompanyId,
  listGatewayConfigs,
  listTerminals,
  updateTerminal,
} from '@/modules/restaurant-operations/pos/api/payments';
import {
  formatDateTime,
  ICON_BUTTON,
  INPUT_CLASS,
  LABEL_CLASS,
  PRIMARY_BUTTON,
  SECONDARY_BUTTON,
  TH_CLASS,
} from '@/modules/restaurant-operations/pos/lib/payment-format';
import {
  PROVIDER_LABELS,
  type PaymentGatewayConfig,
  type PaymentProvider,
  type PaymentTerminal,
  type PaymentTerminalPayload,
} from '@/modules/restaurant-operations/pos/types/payments';

/** Igual que DEVICE_IDENTIFIER_PATTERNS del backend */
const DEVICE_RULES: Record<PaymentProvider, { pattern: RegExp; label: string; hint: string; placeholder: string }> = {
  cardpointe: {
    pattern: /^[A-Za-z0-9]{6,30}$/,
    label: 'Hardware serial number (HSN)',
    hint: 'Printed on the back of the Bolt device: 6-30 letters or digits.',
    placeholder: 'C032UQ03960231',
  },
  stripe: {
    pattern: /^tmr_[A-Za-z0-9]{4,60}$/,
    label: 'Stripe reader ID',
    hint: "From the Stripe Dashboard → Terminal → Readers; starts with 'tmr_'.",
    placeholder: 'tmr_FDOt2wlRZEdpd7',
  },
  clover: {
    pattern: /^[A-Za-z0-9]{6,30}$/,
    label: 'Device serial number',
    hint: '6-30 letters or digits.',
    placeholder: 'C043UQ12345678',
  },
};

interface TerminalFormModalProps {
  terminal: PaymentTerminal | null;
  configs: PaymentGatewayConfig[];
  submitting: boolean;
  error: string | null;
  onCancel: () => void;
  onSubmit: (payload: PaymentTerminalPayload) => void;
}

const TerminalFormModal: React.FC<TerminalFormModalProps> = ({ terminal, configs, submitting, error, onCancel, onSubmit }) => {
  const isEdit = terminal !== null;
  const usable = configs.filter((c) => c.isActive || c.id === terminal?.paymentConfigId);
  const [configId, setConfigId] = useState<number>(terminal?.paymentConfigId ?? usable[0]?.id ?? 0);
  const [name, setName] = useState(terminal?.name ?? '');
  const [model, setModel] = useState(terminal?.model ?? '');
  const [device, setDevice] = useState(terminal?.deviceIdentifier ?? '');
  const config = usable.find((c) => c.id === configId);
  const rule = DEVICE_RULES[config?.provider ?? 'cardpointe'];
  const deviceValid = rule.pattern.test(device.trim());
  const isValid = Boolean(config) && name.trim() !== '' && deviceValid;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;
    const base = {
      paymentConfigId: configId,
      name: name.trim(),
      model: model.trim() || null,
      deviceIdentifier: device.trim(),
    };
    onSubmit(isEdit ? base : { ...base, model: model.trim() || undefined, merchantId: getCurrentMerchantId() ?? undefined });
  };

  return (
    <AppModal title={isEdit ? `Edit ${terminal.name}` : 'Register payment terminal'} onClose={onCancel} closeDisabled={submitting} size="lg">
      <form onSubmit={submit} className="flex-1 flex flex-col min-h-0" aria-label="Payment terminal">
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          {usable.length === 0 ? (
            <div role="alert" className="text-sm text-[#ae001a] font-medium">
              Create an active payment gateway first: every terminal charges through one.
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="terminal-gateway" className={LABEL_CLASS}>
                Payment gateway
              </label>
              <select
                id="terminal-gateway"
                value={configId}
                disabled={submitting}
                onChange={(e) => setConfigId(Number(e.target.value))}
                className={INPUT_CLASS}
              >
                {usable.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.displayName} · {PROVIDER_LABELS[c.provider]}
                    {c.isActive ? '' : ' (inactive)'}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="terminal-name" className={LABEL_CLASS}>
                Name
              </label>
              <input
                id="terminal-name"
                type="text"
                maxLength={100}
                value={name}
                placeholder="e.g. Front counter"
                disabled={submitting}
                onChange={(e) => setName(e.target.value)}
                className={INPUT_CLASS}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="terminal-model" className={LABEL_CLASS}>
                Model (optional)
              </label>
              <input
                id="terminal-model"
                type="text"
                maxLength={50}
                value={model}
                placeholder={config?.provider === 'stripe' ? 'BBPOS WisePOS E' : 'Ingenico Lane/3000'}
                disabled={submitting}
                onChange={(e) => setModel(e.target.value)}
                className={INPUT_CLASS}
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="terminal-device" className={LABEL_CLASS}>
              {rule.label}
            </label>
            <input
              id="terminal-device"
              type="text"
              maxLength={100}
              value={device}
              placeholder={rule.placeholder}
              disabled={submitting}
              onChange={(e) => setDevice(e.target.value)}
              className={`${INPUT_CLASS} font-mono`}
              aria-invalid={device.trim() !== '' && !deviceValid}
            />
            <div className={`text-[11px] ${device.trim() !== '' && !deviceValid ? 'text-[#ae001a] font-medium' : 'text-[#5f5e5e]'}`}>
              {rule.hint}
            </div>
          </div>
          {error && (
            <div role="alert" className="text-sm text-[#ae001a] font-medium">
              {error}
            </div>
          )}
        </div>
        <div className="p-4 border-t border-[#e8e2d8] flex justify-end gap-3 shrink-0">
          <button type="button" onClick={onCancel} disabled={submitting} className={SECONDARY_BUTTON}>
            Cancel
          </button>
          <button type="submit" disabled={!isValid || submitting} className={PRIMARY_BUTTON}>
            {submitting && <span aria-hidden="true" className="material-symbols-outlined text-base animate-spin">progress_activity</span>}
            {isEdit ? 'Save changes' : 'Register terminal'}
          </button>
        </div>
      </form>
    </AppModal>
  );
};

interface PaymentTerminalsViewProps {
  onNavigate?: (view: string) => void;
}

export const PaymentTerminalsView: React.FC<PaymentTerminalsViewProps> = ({ onNavigate }) => {
  const [companyId, setCompanyId] = useState<number | null>(null);
  const [terminals, setTerminals] = useState<PaymentTerminal[]>([]);
  const [configs, setConfigs] = useState<PaymentGatewayConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [editing, setEditing] = useState<PaymentTerminal | null | 'new'>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [toggling, setToggling] = useState<PaymentTerminal | null>(null);
  const [deleting, setDeleting] = useState<PaymentTerminal | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const id = await getCompanyId();
      setCompanyId(id);
      const [rows, gateways] = await Promise.all([listTerminals(id), listGatewayConfigs(id)]);
      setTerminals(rows);
      setConfigs(gateways);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load payment terminals');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const configName = useMemo(() => new Map(configs.map((c) => [c.id, c.displayName])), [configs]);

  const save = async (payload: PaymentTerminalPayload) => {
    if (companyId === null) return;
    setSubmitting(true);
    setFormError(null);
    try {
      if (editing === 'new') {
        await createTerminal(companyId, payload);
        setToast({ message: 'Payment terminal registered', type: 'success' });
      } else if (editing) {
        await updateTerminal(companyId, editing.id, payload);
        setToast({ message: 'Payment terminal updated', type: 'success' });
      }
      setEditing(null);
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'The payment terminal could not be saved');
    } finally {
      setSubmitting(false);
    }
  };

  const confirmToggle = async () => {
    if (companyId === null || !toggling) return;
    setSubmitting(true);
    try {
      await updateTerminal(companyId, toggling.id, { isActive: !toggling.isActive });
      setToast({ message: `${toggling.name} ${toggling.isActive ? 'deactivated' : 'activated'}`, type: 'success' });
      setToggling(null);
      await load();
    } catch (err) {
      setToast({ message: err instanceof Error ? err.message : 'Could not change the status', type: 'error' });
      setToggling(null);
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (companyId === null || !deleting) return;
    setSubmitting(true);
    setDeleteError(null);
    try {
      await deleteTerminal(companyId, deleting.id);
      setToast({ message: 'Payment terminal deleted', type: 'success' });
      setDeleting(null);
      await load();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'The payment terminal could not be deleted');
    } finally {
      setSubmitting(false);
    }
  };

  const openCreate = () => {
    setFormError(null);
    setEditing('new');
  };

  if (error) {
    return (
      <div className="border border-red-300 bg-red-50 p-8 text-center" role="alert">
        <span aria-hidden="true" className="material-symbols-outlined text-red-500 text-4xl">
          error
        </span>
        <div className="mt-3 text-red-700 font-medium">{error}</div>
        <button
          type="button"
          onClick={() => void load()}
          className="mt-4 px-4 py-2 bg-[#222222] text-white font-bold text-[11px] uppercase tracking-widest hover:bg-[#ae001a] transition-colors"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  const isEmpty = !loading && terminals.length === 0;

  return (
    <div className="flex flex-col gap-6 animate-fade-in text-left">
      <div className="bg-white border border-[#e8e2d8] p-4 rounded shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-[#5f5e5e] max-w-2xl">
          Counter readers of this branch. A terminal sale sends the amount to the device through its gateway&apos;s
          cloud API, so the customer taps, inserts or swipes the card there.
        </div>
        <div className="flex gap-3">
          {onNavigate && (
            <button type="button" onClick={() => onNavigate('payment-gateway-configs')} className={`${SECONDARY_BUTTON} flex items-center gap-1.5`}>
              <span aria-hidden="true" className="material-symbols-outlined text-base">account_balance</span>
              Gateways
            </button>
          )}
          {!isEmpty && (
            <button type="button" onClick={openCreate} className={PRIMARY_BUTTON}>
              <span aria-hidden="true" className="material-symbols-outlined text-base">add</span>
              Register Terminal
            </button>
          )}
        </div>
      </div>

      {isEmpty ? (
        <div data-testid="terminals-empty-state" className="bg-white border border-[#e8e2d8] p-16 flex flex-col items-center text-center rounded shadow-sm">
          <span aria-hidden="true" className="material-symbols-outlined text-[#d51f2c] text-6xl">contactless</span>
          <div className="text-[#5f5e5e] mt-4 max-w-md text-sm leading-relaxed">
            No payment terminal registered. Add a CardPointe Bolt device or a Stripe reader to take card-present payments.
          </div>
          <button type="button" onClick={openCreate} className={`${PRIMARY_BUTTON} mt-6`}>
            <span aria-hidden="true" className="material-symbols-outlined text-base">add</span>
            Register Terminal
          </button>
        </div>
      ) : (
        <div className="bg-white border border-[#e8e2d8] overflow-hidden rounded shadow-sm">
          <div className="p-4 bg-[#222222] flex justify-between items-center">
            <span className="text-[11px] font-bold text-white uppercase tracking-widest">Payment terminals</span>
            <span className="text-white/50 text-xs">{loading ? 'Loading...' : `${terminals.length} terminals`}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead className="bg-[#ece8e0] border-b border-[#e8e2d8]">
                <tr>
                  <th className={TH_CLASS}>Terminal</th>
                  <th className={TH_CLASS}>Device ID</th>
                  <th className={TH_CLASS}>Gateway</th>
                  <th className={TH_CLASS}>Branch</th>
                  <th className={`${TH_CLASS} text-center`}>Status</th>
                  <th className={TH_CLASS}>Registered</th>
                  <th className={`${TH_CLASS} text-center`}>Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e8e2d8]">
                {loading && terminals.length === 0
                  ? [1, 2].map((i) => (
                      <tr key={i}>
                        {Array.from({ length: 7 }, (_, j) => (
                          <td key={j} className="px-4 py-4">
                            <div className="h-4 bg-[#ece8e0] rounded animate-pulse w-20" />
                          </td>
                        ))}
                      </tr>
                    ))
                  : terminals.map((terminal) => (
                      <tr key={terminal.id} data-testid={`terminal-row-${terminal.id}`} className="hover:bg-[#f8f3eb] transition-colors">
                        <td className="px-4 py-4">
                          <div className="font-bold text-[#1d1c17]">{terminal.name}</div>
                          <div className="text-[11px] text-[#5f5e5e] mt-1">{terminal.model ?? '—'}</div>
                        </td>
                        <td className="px-4 py-4 font-mono text-[12px]">{terminal.deviceIdentifier}</td>
                        <td className="px-4 py-4">
                          {configName.get(terminal.paymentConfigId) ?? `#${terminal.paymentConfigId}`}
                          <span className="block text-[11px] text-[#5f5e5e]">{PROVIDER_LABELS[terminal.provider]}</span>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">Branch #{terminal.merchantId}</td>
                        <td className="px-4 py-4 text-center">
                          <span
                            className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                              terminal.isActive ? 'bg-green-500/10 text-green-600' : 'bg-[#5f5e5e]/20 text-[#5f5e5e]'
                            }`}
                          >
                            {terminal.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-[12px] text-[#5f5e5e] whitespace-nowrap">{formatDateTime(terminal.createdAt)}</td>
                        <td className="px-4 py-4">
                          <div className="flex justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setFormError(null);
                                setEditing(terminal);
                              }}
                              aria-label={`Edit ${terminal.name}`}
                              className={ICON_BUTTON}
                            >
                              <span aria-hidden="true" className="material-symbols-outlined text-[20px]">edit</span>
                            </button>
                            <StatusToggleButton
                              status={terminal.isActive ? 'active' : 'inactive'}
                              entityLabel={terminal.name}
                              onClick={() => setToggling(terminal)}
                            />
                            <button
                              type="button"
                              onClick={() => {
                                setDeleteError(null);
                                setDeleting(terminal);
                              }}
                              aria-label={`Delete ${terminal.name}`}
                              className={ICON_BUTTON}
                            >
                              <span aria-hidden="true" className="material-symbols-outlined text-[20px]">delete</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {editing && (
        <TerminalFormModal
          terminal={editing === 'new' ? null : editing}
          configs={configs}
          submitting={submitting}
          error={formError}
          onCancel={() => setEditing(null)}
          onSubmit={(payload) => void save(payload)}
        />
      )}
      {toggling && (
        <ConfirmStatusToggleDialog
          entityName={toggling.name}
          direction={toggling.isActive ? 'deactivate' : 'activate'}
          submitting={submitting}
          onConfirm={() => void confirmToggle()}
          onClose={() => setToggling(null)}
        />
      )}
      {deleting && (
        <AppModal title="Delete payment terminal" onClose={() => setDeleting(null)} closeDisabled={submitting} size="md">
          <div className="p-6 space-y-4">
            <div className="text-sm text-[#1d1c17] leading-relaxed">
              Delete &quot;{deleting.name}&quot; ({deleting.deviceIdentifier})? Past terminal sales keep their record; the
              device can be registered again later.
            </div>
            {deleteError && (
              <div role="alert" className="text-sm text-[#ae001a] font-medium">
                {deleteError}
              </div>
            )}
          </div>
          <div className="p-4 border-t border-[#e8e2d8] flex justify-end gap-3">
            <button type="button" onClick={() => setDeleting(null)} disabled={submitting} className={SECONDARY_BUTTON}>
              Cancel
            </button>
            <button type="button" onClick={() => void confirmDelete()} disabled={submitting} className={PRIMARY_BUTTON}>
              {submitting ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        </AppModal>
      )}
      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
};

export default PaymentTerminalsView;
