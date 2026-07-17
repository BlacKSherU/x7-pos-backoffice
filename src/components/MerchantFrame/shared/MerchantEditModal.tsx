import React from 'react';
import type {
  MerchantFormFieldErrors,
  MerchantFormValues,
} from '../../../lib/merchant-form-validation';
import {
  AppModal,
  FormField,
  ModalFormError,
  ModalFormFooter,
} from '../shared/AppModal';

type MerchantEditModalProps = {
  mode: 'add' | 'edit';
  formValues: MerchantFormValues;
  fieldErrors: MerchantFormFieldErrors;
  formError: string | null;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onFieldChange: (field: keyof MerchantFormValues, value: string) => void;
};

export const MerchantEditModal: React.FC<MerchantEditModalProps> = ({
  mode,
  formValues,
  fieldErrors,
  formError,
  isSubmitting,
  onClose,
  onSubmit,
  onFieldChange,
}) => {
  return (
    <AppModal
      title={mode === 'add' ? 'Add Merchant Branch' : 'Edit Merchant Branch'}
      titleId="edit-merchant-branch-title"
      onClose={onClose}
      closeDisabled={isSubmitting}
      closeAriaLabel="Close merchant branch form"
    >
      <form
        onSubmit={onSubmit}
        className="p-6 space-y-4 overflow-y-auto flex-1"
      >
        {formError ? <ModalFormError message={formError} /> : null}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            id="merchant-name"
            label="Store Name"
            value={formValues.name}
            error={fieldErrors.name}
            onChange={(value) => onFieldChange('name', value)}
            placeholder="Downtown Bistro"
            required
          />
          <FormField
            id="merchant-rut"
            label="Tax Identification (RUT)"
            value={formValues.rut}
            error={fieldErrors.rut}
            onChange={(value) => onFieldChange('rut', value)}
            placeholder="12-3456789"
            required
          />
          <FormField
            id="merchant-email"
            label="Contact Email (Optional)"
            value={formValues.email}
            error={fieldErrors.email}
            onChange={(value) => onFieldChange('email', value)}
            placeholder="contact@store.com"
            type="email"
          />
          <FormField
            id="merchant-phone"
            label="Contact Phone (Optional)"
            value={formValues.phone}
            error={fieldErrors.phone}
            onChange={(value) => onFieldChange('phone', value)}
            placeholder="+1 (555) 000-0000"
            type="tel"
          />
        </div>

        <FormField
          id="merchant-address"
          label="Address"
          value={formValues.address}
          error={fieldErrors.address}
          onChange={(value) => onFieldChange('address', value)}
          placeholder="123 Main Street"
          required
        />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <FormField
            id="merchant-city"
            label="City"
            value={formValues.city}
            error={fieldErrors.city}
            onChange={(value) => onFieldChange('city', value)}
            placeholder="Miami"
            required
          />
          <FormField
            id="merchant-state"
            label="State/Prov"
            value={formValues.state}
            error={fieldErrors.state}
            onChange={(value) => onFieldChange('state', value)}
            placeholder="Florida"
            required
          />
          <FormField
            id="merchant-country"
            label="Country"
            value={formValues.country}
            error={fieldErrors.country}
            onChange={(value) => onFieldChange('country', value)}
            placeholder="USA"
            required
          />
        </div>

        <ModalFormFooter
          onCancel={onClose}
          submitLabel={
            isSubmitting
              ? 'Saving...'
              : mode === 'add'
                ? 'Create Merchant'
                : 'Save Changes'
          }
          isSubmitting={isSubmitting}
        />
      </form>
    </AppModal>
  );
};
