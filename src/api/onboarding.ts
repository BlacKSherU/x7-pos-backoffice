import { getJson, postJson } from './http';
import type {
  AdminIdentity,
  BusinessProfile,
  BusinessProfilePayload,
  MerchantProfile,
  MerchantProfilePayload,
  OnboardingDraftPayload,
  ProvisionAccountPayload,
  ProvisionAccountResponse,
  SelectSubscriptionResponse,
  SubscriptionTier,
} from '../types/onboarding';

export function getSubscriptionTiers(): Promise<SubscriptionTier[]> {
  return getJson<SubscriptionTier[]>(
    '/onboarding/subscription-tiers',
    'Failed to load subscription plans. Please try again.',
  );
}

export function selectSubscription(
  tierId: string,
): Promise<SelectSubscriptionResponse> {
  return postJson<SelectSubscriptionResponse>(
    '/onboarding/select-subscription',
    { tierId },
    'Failed to save subscription selection. Please try again.',
  );
}

export function getBusinessProfile(
  sessionId: string,
): Promise<BusinessProfile> {
  return getJson<BusinessProfile>(
    `/onboarding/business-profile/${sessionId}`,
    'Failed to load business profile. Please try again.',
  );
}

export function saveBusinessProfile(
  payload: BusinessProfilePayload,
): Promise<void> {
  return postJson<void>(
    '/onboarding/business-profile',
    payload,
    'Failed to save business profile. Please try again.',
  );
}

export function getMerchantProfile(
  sessionId: string,
): Promise<MerchantProfile> {
  return getJson<MerchantProfile>(
    `/onboarding/merchant-profile/${sessionId}`,
    'Failed to load merchant profile. Please try again.',
  );
}

export function saveMerchantProfile(
  payload: MerchantProfilePayload,
): Promise<void> {
  return postJson<void>(
    '/onboarding/merchant-profile',
    payload,
    'Failed to save merchant profile. Please try again.',
  );
}

export function getAdminIdentity(sessionId: string): Promise<AdminIdentity> {
  return getJson<AdminIdentity>(
    `/onboarding/admin-identity/${sessionId}`,
    'Failed to load admin identity. Please try again.',
  );
}

export function provisionAccount(
  payload: ProvisionAccountPayload,
): Promise<ProvisionAccountResponse> {
  return postJson<ProvisionAccountResponse>(
    '/onboarding/provision-account',
    payload,
    'Failed to complete account setup. Please try again.',
  );
}

export function saveOnboardingDraft(
  payload: OnboardingDraftPayload,
): Promise<void> {
  return postJson<void>(
    '/onboarding/draft',
    payload,
    'Failed to save draft. Please try again.',
  );
}
