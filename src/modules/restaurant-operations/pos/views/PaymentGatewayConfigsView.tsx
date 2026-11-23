import React, { useCallback, useEffect, useState } from 'react';
import { AppModal } from '@/shared/components/AppModal';
import { Toast, type ToastState } from '@/shared/components/Toast';
import { ConfirmStatusToggleDialog, StatusToggleButton } from '@/shared/components/StatusToggle';
import { getCurrentMerchantId } from '@/modules/platform-saas/users/api/users';
import {
  createGatewayConfig,
  deleteGatewayConfig,
  getCompanyId,
  listGatewayConfigs,
  updateGatewayConfig,
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
  PROVIDER_CREDENTIAL_FIELDS,
  PROVIDER_LABELS,
  type PaymentEnvironment,
  type PaymentGatewayConfig,
  type PaymentGatewayConfigPayload,
} from '@/modules/restaurant-operations/pos/types/payments';

type EditableProvider = 'stripe' | 'cardpointe';

/** Credenciales en el orden del formulario (el backend no garantiza ninguno) */
function credentialEntries(config: PaymentGatewayConfig): Array<[string, string]> {
  const order = (PROVIDER_CREDENTIAL_FIELDS[config.provider as EditableProvider] ?? []).map((f) => f.key);
  const rank = (key: string) => (order.indexOf(key) === -1 ? order.length : order.indexOf(key));
  return Object.entries(config.credentials).sort(([a], [b]) => rank(a) - rank(b));
}

interface ConfigFormModalProps {
  config: PaymentGatewayConfig | null;
  submitting: boolean;
  error: string | null;
  onCancel: () => void;
  onSubmit: (payload: PaymentGatewayConfigPayload) => void;
}

const ConfigFormModal: React.FC<ConfigFormModalProps> = ({ config, submitting, error, onCancel, onSubmit }) => {
  const isEdit = config !== null;
  const [provider, setProvider] = useState<EditableProvider>(
    (config?.provider as EditableProvider | undefined) ?? 'stripe',
  );
  const [environment, setEnvironment] = useState<PaymentEnvironment>(config?.environment ?? 'sandbox');
  const [displayName, setDisplayName] = useState(config?.displayName ?? '');
  const [branchOnly, setBranchOnly] = useState(config ? config.merchantId !== null : false);
  const [isDefault, setIsDefault] = useState(config?.isDefault ?? false);
  const fields = PROVIDER_CREDENTIAL_FIELDS[provider];
  // Al editar, los secretos vienen enmascarados: vacío = se conservan
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      fields.map((f) => [f.key, config && !f.secret ? (config.credentials[f.key] ?? '') : '']),
    ),
  );

  const missing = fields.filter((f) => {
    if (!f.required) return false;
    const filled = (values[f.key] ?? '').trim() !== '';
    return isEdit && f.secret ? !filled && !config?.credentials[f.key] : !filled;
  });
  const isValid = displayName.trim() !== '' && missing.length === 0;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;
    const credentials: Record<string, string | null> = {};
    for (const field of fields) {
      const value = (values[field.key] ?? '').trim();
      if (value) credentials[field.key] = value;
      else if (isEdit && !field.secret && config?.credentials[field.key]) credentials[field.key] = null;
    }
    const merchantId = branchOnly ? getCurrentMerchantId() : null;
    onSubmit(
      isEdit
        ? {
            environment,
            displayName: displayName.trim(),
            merchantId,
            ...(Object.keys(credentials).length ? { credentials } : {}),
            ...(isDefault !== config.isDefault ? { isDefault } : {}),
          }
        : {
            provider,
            environment,
            displayName: displayName.trim(),
            ...(merchantId ? { merchantId } : {}),
            credentials: credentials as Record<string, string>,
            isDefault,
          },
    );
  };

  return (
    <AppModal title={isEdit ? `Edit ${config.displayName}` : 'New payment gateway'} onClose={onCancel} closeDisabled={submitting} size="2xl">
      <form onSubmit={submit} className="flex-1 flex flex-col min-h-0" aria-label="Payment gateway config">
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="gateway-provider" className={LABEL_CLASS}>
                Provider
              </label>
              <select
                id="gateway-provider"
                value={provider}
                disabled={isEdit || submitting}
                onChange={(e) => {
                  const next = e.target.value as EditableProvider;
                  setProvider(next);
                  setValues(Object.fromEntries(PROVIDER_CREDENTIAL_FIELDS[next].map((f) => [f.key, ''])));
                }}
                className={INPUT_CLASS}
              >
                <option value="stripe">Stripe</option>
                <option value="cardpointe">CardPointe</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="gateway-environment" className={LABEL_CLASS}>
                Environment
              </label>
              <select
                id="gateway-environment"
                value={environment}
                disabled={submitting}
                onChange={(e) => setEnvironment(e.target.value as PaymentEnvironment)}
                className={INPUT_CLASS}
              >
                <option value="sandbox">Sandbox (test)</option>
                <option value="production">Production (live)</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="gateway-name" className={LABEL_CLASS}>
                Display name
              </label>
              <input
                id="gateway-name"
                type="text"
                maxLength={100}
                value={displayName}
                placeholder="e.g. Stripe main account"
                disabled={submitting}
                onChange={(e) => setDisplayName(e.target.value)}
                className={INPUT_CLASS}
              />
            </div>
          </div>

          <fieldset className="border border-[#e8e2d8] rounded p-4 space-y-4">
            <legend className={`${LABEL_CLASS} px-1`}>{PROVIDER_LABELS[provider]} credentials</legend>
            <div className="text-[12px] text-[#5f5e5e] flex items-center gap-1">
              <span aria-hidden="true" className="material-symbols-outlined text-sm">lock</span>
              Stored encrypted.{isEdit ? ' Leave a secret empty to keep the saved value.' : ''}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {fields.map((field) => (
                <div key={field.key} className="flex flex-col gap-1.5 min-w-0">
                  <label htmlFor={`cred-${field.key}`} className={LABEL_CLASS}>
                    {field.label}
                    {field.required ? ' *' : ''}
                  </label>
                  <input
                    id={`cred-${field.key}`}
                    type={field.secret ? 'password' : 'text'}
                    autoComplete="off"
                    value={values[field.key] ?? ''}
                    placeholder={isEdit && field.secret && config?.credentials[field.key] ? config.credentials[field.key] : field.placeholder}
                    disabled={submitting}
                    onChange={(e) => setValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
                    className={INPUT_CLASS}
                  />
                  {field.hint && <div className="text-[11px] text-[#5f5e5e]">{field.hint}</div>}
                </div>
              ))}
            </div>
          </fieldset>

          <div className="flex flex-col gap-3">
            <label className="flex items-center gap-2 text-sm text-[#1d1c17] cursor-pointer">
              <input
                type="checkbox"
                checked={branchOnly}
                disabled={submitting}
                onChange={(e) => setBranchOnly(e.target.checked)}
                className="accent-[#ae001a] w-4 h-4"
              />
              Only for this branch (otherwise every branch of the company can use it)
            </label>
            <label className="flex items-center gap-2 text-sm text-[#1d1c17] cursor-pointer">
              <input
                type="checkbox"
                checked={isDefault}
                disabled={submitting || (isEdit && config.isDefault)}
                onChange={(e) => setIsDefault(e.target.checked)}
                className="accent-[#ae001a] w-4 h-4"
              />
              Default gateway (used when a charge does not choose one)
            </label>
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
            {isEdit ? 'Save changes' : 'Create gateway'}
          </button>
        </div>
      </form>
    </AppModal>
  );
};

interface DeleteDialogProps {
  config: PaymentGatewayConfig;
  submitting: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}

const DeleteDialog: React.FC<DeleteDialogProps> = ({ config, submitting, error, onCancel, onConfirm }) => (
  <AppModal title="Delete payment gateway" onClose={onCancel} closeDisabled={submitting} size="md">
    <div className="p-6 space-y-4">
      <div className="text-sm text-[#1d1c17] leading-relaxed">
        Delete &quot;{config.displayName}&quot;? Its encrypted credentials are erased. A gateway with registered
        terminals or past payments cannot be deleted; deactivate it instead.
      </div>
      {error && (
        <div role="alert" className="text-sm text-[#ae001a] font-medium">
          {error}
        </div>
      )}
    </div>
    <div className="p-4 border-t border-[#e8e2d8] flex justify-end gap-3">
      <button type="button" onClick={onCancel} disabled={submitting} className={SECONDARY_BUTTON}>
        Cancel
      </button>
      <button type="button" onClick={onConfirm} disabled={submitting} className={PRIMARY_BUTTON}>
        {submitting ? 'Deleting…' : 'Delete'}
      </button>
    </div>
  </AppModal>
);

interface PaymentGatewayConfigsViewProps {
  onNavigate?: (view: string) => void;
}

export const PaymentGatewayConfigsView: React.FC<PaymentGatewayConfigsViewProps> = ({ onNavigate }) => {
  const [companyId, setCompanyId] = useState<number | null>(null);
  const [configs, setConfigs] = useState<PaymentGatewayConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [editing, setEditing] = useState<PaymentGatewayConfig | null | 'new'>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState<PaymentGatewayConfig | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [toggling, setToggling] = useState<PaymentGatewayConfig | null>(null);

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
      setConfigs(await listGatewayConfigs(id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load payment gateway configs');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async (payload: PaymentGatewayConfigPayload) => {
    if (companyId === null) return;
    setSubmitting(true);
    setFormError(null);
    try {
      if (editing === 'new') {
        await createGatewayConfig(companyId, payload);
        setToast({ message: 'Payment gateway created', type: 'success' });
      } else if (editing) {
        await updateGatewayConfig(companyId, editing.id, payload);
        setToast({ message: 'Payment gateway updated', type: 'success' });
      }
      setEditing(null);
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'The payment gateway could not be saved');
    } finally {
      setSubmitting(false);
    }
  };

  const makeDefault = async (config: PaymentGatewayConfig) => {
    if (companyId === null) return;
    try {
      await updateGatewayConfig(companyId, config.id, { isDefault: true });
      setToast({ message: `${config.displayName} is now the default gateway`, type: 'success' });
      await load();
    } catch (err) {
      setToast({ message: err instanceof Error ? err.message : 'Could not change the default gateway', type: 'error' });
    }
  };

  const confirmToggle = async () => {
    if (companyId === null || !toggling) return;
    setSubmitting(true);
    try {
      await updateGatewayConfig(companyId, toggling.id, { isActive: !toggling.isActive });
      setToast({ message: `${toggling.displayName} ${toggling.isActive ? 'deactivated' : 'activated'}`, type: 'success' });
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
      await deleteGatewayConfig(companyId, deleting.id);
      setToast({ message: 'Payment gateway deleted', type: 'success' });
      setDeleting(null);
      await load();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'The payment gateway could not be deleted');
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

  const isEmpty = !loading && configs.length === 0;

  return (
    <div className="flex flex-col gap-6 animate-fade-in text-left">
      <div className="bg-white border border-[#e8e2d8] p-4 rounded shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-[#5f5e5e] max-w-2xl">
          Gateways the company charges cards through. The default one is used by card charges that do not pick a
          provider; terminals are bound to a gateway when you register them.
        </div>
        <div className="flex gap-3">
          {onNavigate && (
            <button type="button" onClick={() => onNavigate('payment-terminals')} className={`${SECONDARY_BUTTON} flex items-center gap-1.5`}>
              <span aria-hidden="true" className="material-symbols-outlined text-base">contactless</span>
              Terminals
            </button>
          )}
          {!isEmpty && (
            <button type="button" onClick={openCreate} className={PRIMARY_BUTTON}>
              <span aria-hidden="true" className="material-symbols-outlined text-base">add</span>
              New Gateway
            </button>
          )}
        </div>
      </div>

      {isEmpty ? (
        <div data-testid="gateways-empty-state" className="bg-white border border-[#e8e2d8] p-16 flex flex-col items-center text-center rounded shadow-sm">
          <span aria-hidden="true" className="material-symbols-outlined text-[#d51f2c] text-6xl">account_balance</span>
          <div className="text-[#5f5e5e] mt-4 max-w-md text-sm leading-relaxed">
            No payment gateway yet. Connect a Stripe or CardPointe account to start charging cards.
          </div>
          <button type="button" onClick={openCreate} className={`${PRIMARY_BUTTON} mt-6`}>
            <span aria-hidden="true" className="material-symbols-outlined text-base">add</span>
            New Gateway
          </button>
        </div>
      ) : (
        <div className="bg-white border border-[#e8e2d8] overflow-hidden rounded shadow-sm">
          <div className="p-4 bg-[#222222] flex justify-between items-center">
            <span className="text-[11px] font-bold text-white uppercase tracking-widest">Payment gateways</span>
            <span className="text-white/50 text-xs">{loading ? 'Loading...' : `${configs.length} gateways`}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead className="bg-[#ece8e0] border-b border-[#e8e2d8]">
                <tr>
                  <th className={TH_CLASS}>Gateway</th>
                  <th className={TH_CLASS}>Environment</th>
                  <th className={TH_CLASS}>Scope</th>
                  <th className={TH_CLASS}>Credentials</th>
                  <th className={`${TH_CLASS} text-center`}>Status</th>
                  <th className={TH_CLASS}>Updated</th>
                  <th className={`${TH_CLASS} text-center`}>Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e8e2d8]">
                {loading && configs.length === 0
                  ? [1, 2].map((i) => (
                      <tr key={i}>
                        {Array.from({ length: 7 }, (_, j) => (
                          <td key={j} className="px-4 py-4">
                            <div className="h-4 bg-[#ece8e0] rounded animate-pulse w-20" />
                          </td>
                        ))}
                      </tr>
                    ))
                  : configs.map((config) => (
                      <tr key={config.id} data-testid={`gateway-row-${config.id}`} className="hover:bg-[#f8f3eb] transition-colors">
                        <td className="px-4 py-4 min-w-[190px]">
                          <div className="font-bold text-[#1d1c17] flex items-center gap-2 flex-wrap">
                            {config.displayName}
                            {config.isDefault && (
                              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-[#ae001a]/10 text-[#ae001a]">
                                Default
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-[#5f5e5e] mt-1">{PROVIDER_LABELS[config.provider]}</div>
                        </td>
                        <td className="px-4 py-4">
                          <span
                            className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                              config.environment === 'production' ? 'bg-green-500/10 text-green-700' : 'bg-amber-500/10 text-amber-700'
                            }`}
                          >
                            {config.environment === 'production' ? 'Production' : 'Sandbox'}
                          </span>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">{config.merchantId ? `Branch #${config.merchantId}` : 'All branches'}</td>
                        <td className="px-4 py-4">
                          <dl className="text-[12px] space-y-0.5 font-mono">
                            {credentialEntries(config).map(([key, value]) => (
                              <div key={key} className="flex gap-2 min-w-0">
                                <dt className="text-[#5f5e5e] shrink-0">{key}</dt>
                                <dd className="text-[#1d1c17] truncate max-w-[180px]" title={value}>
                                  {value}
                                </dd>
                              </div>
                            ))}
                          </dl>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span
                            className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                              config.isActive ? 'bg-green-500/10 text-green-600' : 'bg-[#5f5e5e]/20 text-[#5f5e5e]'
                            }`}
                          >
                            {config.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-[12px] text-[#5f5e5e] whitespace-nowrap">{formatDateTime(config.updatedAt)}</td>
                        <td className="px-4 py-4">
                          <div className="flex justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setFormError(null);
                                setEditing(config);
                              }}
                              aria-label={`Edit ${config.displayName}`}
                              className={ICON_BUTTON}
                            >
                              <span aria-hidden="true" className="material-symbols-outlined text-[20px]">edit</span>
                            </button>
                            {!config.isDefault && config.isActive && (
                              <button
                                type="button"
                                onClick={() => void makeDefault(config)}
                                aria-label={`Make ${config.displayName} the default gateway`}
                                className={ICON_BUTTON}
                              >
                                <span aria-hidden="true" className="material-symbols-outlined text-[20px]">star</span>
                              </button>
                            )}
                            <StatusToggleButton
                              status={config.isActive ? 'active' : 'inactive'}
                              entityLabel={config.displayName}
                              onClick={() => setToggling(config)}
                            />
                            <button
                              type="button"
                              onClick={() => {
                                setDeleteError(null);
                                setDeleting(config);
                              }}
                              aria-label={`Delete ${config.displayName}`}
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
        <ConfigFormModal
          config={editing === 'new' ? null : editing}
          submitting={submitting}
          error={formError}
          onCancel={() => setEditing(null)}
          onSubmit={(payload) => void save(payload)}
        />
      )}
      {deleting && (
        <DeleteDialog
          config={deleting}
          submitting={submitting}
          error={deleteError}
          onCancel={() => setDeleting(null)}
          onConfirm={() => void confirmDelete()}
        />
      )}
      {toggling && (
        <ConfirmStatusToggleDialog
          entityName={toggling.displayName}
          direction={toggling.isActive ? 'deactivate' : 'activate'}
          submitting={submitting}
          onConfirm={() => void confirmToggle()}
          onClose={() => setToggling(null)}
          description={
            toggling.isActive
              ? `Deactivating "${toggling.displayName}" stops new charges and terminal sales through it. Past payments can still be refunded only while it is active.`
              : undefined
          }
        />
      )}
      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
};

export default PaymentGatewayConfigsView;
