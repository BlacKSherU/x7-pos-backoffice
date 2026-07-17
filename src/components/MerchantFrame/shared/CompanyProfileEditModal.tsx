import React from 'react';
import type {
  CompanyFormFieldErrors,
  CompanyFormValues,
} from '../../../lib/company-form-validation';
import {
  AppModal,
  FormField,
  ModalFormError,
  ModalFormFooter,
} from '../shared/AppModal';

type CompanyProfileEditModalProps = {
  formValues: CompanyFormValues;
  fieldErrors: CompanyFormFieldErrors;
  formError: string | null;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onFieldChange: (field: keyof CompanyFormValues, value: string) => void;
};

export const CompanyProfileEditModal: React.FC<CompanyProfileEditModalProps> = ({
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
      title="Edit Company Profile"
      titleId="edit-company-profile-title"
      onClose={onClose}
      closeDisabled={isSubmitting}
      closeAriaLabel="Close edit company profile"
    >
      <form
        onSubmit={onSubmit}
        className="p-6 space-y-4 overflow-y-auto flex-1"
      >
        {formError ? <ModalFormError message={formError} /> : null}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            id="company-name"
            label="Corporate Name"
            value={formValues.name}
            error={fieldErrors.name}
            onChange={(value) => onFieldChange('name', value)}
            placeholder="Acme Holdings"
            required
          />
          <FormField
            id="company-rut"
            label="Tax Registration (RUT)"
            value={formValues.rut}
            error={fieldErrors.rut}
            onChange={(value) => onFieldChange('rut', value)}
            placeholder="12.345.678-9"
            required
          />
          <FormField
            id="company-email"
            label="Business Email"
            value={formValues.email}
            error={fieldErrors.email}
            onChange={(value) => onFieldChange('email', value)}
            placeholder="contact@company.com"
            type="email"
            required
          />
          <FormField
            id="company-phone"
            label="Business Phone"
            value={formValues.phone}
            error={fieldErrors.phone}
            onChange={(value) => onFieldChange('phone', value)}
            placeholder="+1 (555) 123-4567"
            type="tel"
            required
          />
        </div>

        <FormField
          id="company-address"
          label="Headquarters Address"
          value={formValues.address}
          error={fieldErrors.address}
          onChange={(value) => onFieldChange('address', value)}
          placeholder="123 Main Street, Suite 100"
          required
        />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <FormField
            id="company-city"
            label="City"
            value={formValues.city}
            error={fieldErrors.city}
            onChange={(value) => onFieldChange('city', value)}
            placeholder="Miami"
            required
          />
          <FormField
            id="company-state"
            label="State/Prov"
            value={formValues.state}
            error={fieldErrors.state}
            onChange={(value) => onFieldChange('state', value)}
            placeholder="Florida"
            required
          />
          <FormField
            id="company-country"
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
          submitLabel={isSubmitting ? 'Saving...' : 'Save Changes'}
          isSubmitting={isSubmitting}
        />
      </form>
    </AppModal>
  );
};
