import type { AuthUser } from './auth';

export type OnboardingStep = 1 | 2 | 3 | 4;

export interface SubscriptionTier {
  id: string;
  name: string;
  badge: string;
  price: string;
  priceLabel?: string;
  recommended?: boolean;
  isCustom?: boolean;
  imageUrl?: string;
  features: string[];
}

export interface SelectSubscriptionResponse {
  sessionId: string;
}

export interface BusinessProfile {
  legalBusinessName?: string;
  taxId?: string;
  primaryIndustry?: string;
  registeredAddress?: string;
  city?: string;
  state?: string;
  zipCode?: string;
}

export interface BusinessProfilePayload extends BusinessProfile {
  sessionId: string;
}

export interface MerchantProfile {
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
}

export interface MerchantProfilePayload extends MerchantProfile {
  sessionId: string;
}

export interface AdminIdentity {
  firstName?: string;
  lastName?: string;
  jobTitle?: string;
  workEmail?: string;
}

export interface ProvisionAccountPayload extends AdminIdentity {
  sessionId: string;
  password: string;
  termsAccepted: boolean;
}

export interface ProvisionAccountResponse {
  access_token?: string;
  refresh_token?: string;
  user?: AuthUser;
}

export interface OnboardingDraftPayload {
  sessionId?: string;
  step: OnboardingStep;
  selectedTierId?: string;
  businessProfile?: BusinessProfile;
  merchantProfile?: MerchantProfile;
  adminIdentity?: AdminIdentity;
}

export const PRIMARY_INDUSTRY_OPTIONS = [
  'Full Service Restaurant',
  'Quick Service / Cafe',
  'Bar / Nightclub',
  'Bakery',
  'Multi-Unit Enterprise',
] as const;

export type PrimaryIndustry = (typeof PRIMARY_INDUSTRY_OPTIONS)[number];
