import type {
  MerchantSubscription,
  UpdateMerchantSubscriptionDto,
} from '@/modules/platform-saas/subscription-system/types/subscription';

export interface SubscriptionForm {
  planId: string;
  status: 'active' | 'inactive';
  startDate: string;
  endDate: string;
  renewalDate: string;
  paymentMethod: string;
}

export const toForm = (s: MerchantSubscription): SubscriptionForm => ({
  planId: String(s.plan.id),
  status: s.status,
  startDate: s.startDate ? s.startDate.split('T')[0] : '',
  endDate: s.endDate ? s.endDate.split('T')[0] : '',
  renewalDate: s.renewalDate ? s.renewalDate.split('T')[0] : '',
  paymentMethod: s.paymentMethod || '',
});

export function toUpdateMerchantDto(
  original: MerchantSubscription,
  form: SubscriptionForm,
): UpdateMerchantSubscriptionDto {
  const before = toForm(original);
  const dto: UpdateMerchantSubscriptionDto = {};
  if (form.planId !== before.planId) dto.planId = Number(form.planId);
  if (form.status !== before.status) dto.status = form.status;
  if (form.startDate !== before.startDate) dto.startDate = form.startDate;
  if (form.endDate !== before.endDate) dto.endDate = form.endDate || null;
  if (form.renewalDate !== before.renewalDate) dto.renewalDate = form.renewalDate || null;
  if (form.paymentMethod.trim() !== before.paymentMethod) {
    dto.paymentMethod = form.paymentMethod.trim();
  }
  return dto;
}
