import React from 'react';
import type { MerchantAdminSummary } from '../../../types/merchant';
import type { CompanyMerchant } from '../../../types/merchant';
import { AppModal, ModalFormError } from '../shared/AppModal';

type MerchantBranchSummaryModalProps = {
  merchant: CompanyMerchant;
  summary: MerchantAdminSummary | null;
  isLoading: boolean;
  error: string | null;
  onClose: () => void;
  onManageBranchStaff: () => void;
  onManageStoreLocations: () => void;
};

export const MerchantBranchSummaryModal: React.FC<
  MerchantBranchSummaryModalProps
> = ({
  merchant,
  summary,
  isLoading,
  error,
  onClose,
  onManageBranchStaff,
  onManageStoreLocations,
}) => {
  return (
    <AppModal
      title={merchant.name}
      subtitle="Branch Administrative Summary"
      titleId="branch-summary-title"
      size="lg"
      onClose={onClose}
      closeAriaLabel="Close summary"
      closeOnBackdrop
    >
      <div className="p-6 space-y-6">
        {isLoading ? (
          <p className="text-body-md text-secondary text-center py-4">
            Loading branch metrics…
          </p>
        ) : null}

        {error ? <ModalFormError message={error} /> : null}

        {!isLoading && !error && summary ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <MetricCard
                label="Total Active Team"
                value={summary.totalActiveTeamMembers}
                icon="groups"
              />
              <MetricCard
                label="Operational Floor Assets"
                value={summary.operationalFloorAssets}
                icon="table_restaurant"
              />
              <MetricCard
                label="Active Stock Hubs"
                value={summary.activeStockHubs}
                icon="warehouse"
              />
            </div>

            <p className="text-body-sm text-secondary">
              Branch ID {merchant.id} · {merchant.city?.trim() || '—'},{' '}
              {merchant.state?.trim() || '—'}
            </p>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="button"
                onClick={onManageBranchStaff}
                className="flex-1 quick-launch-btn px-4 py-3 bg-white text-[#1d1c17] font-bold text-label-caps border border-[#e8e2d8]"
              >
                Manage Branch Staff
              </button>
              <button
                type="button"
                onClick={onManageStoreLocations}
                className="flex-1 quick-launch-btn px-4 py-3 bg-white text-[#1d1c17] font-bold text-label-caps border border-[#e8e2d8]"
              >
                Manage Store Locations
              </button>
            </div>
          </>
        ) : null}
      </div>
    </AppModal>
  );
};

function MetricCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: string;
}) {
  return (
    <div className="border border-[#e8e2d8] rounded p-4 text-center bg-[#f9f7f4]">
      <span className="material-symbols-outlined text-[#ae001a] text-2xl">
        {icon}
      </span>
      <p className="text-2xl font-black text-[#1d1c17] mt-2">{value}</p>
      <p className="text-[10px] font-bold uppercase tracking-widest text-secondary mt-1">
        {label}
      </p>
    </div>
  );
}
