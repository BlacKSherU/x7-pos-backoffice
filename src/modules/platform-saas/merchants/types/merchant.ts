export type MerchantOperationalStatus = 'active' | 'inactive' | 'suspended';

export interface CompanyMerchant {
  id: number;
  name: string;
  rut?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  status: MerchantOperationalStatus;
  companyId: number;
}

export interface CompanyMerchantsMeta {
  companyId: number;
}

export interface CompanyMerchantsResponse {
  statusCode: number;
  message: string;
  data: CompanyMerchant[];
  meta: CompanyMerchantsMeta;
}

export interface MerchantMutationResponse {
  statusCode: number;
  message: string;
  data: CompanyMerchant;
}

export type MerchantFormPayload = {
  name: string;
  rut: string;
  email?: string;
  phone?: string;
  address: string;
  city: string;
  state: string;
  country: string;
};

export interface MerchantAdminSummary {
  id: number;
  name: string;
  totalActiveTeamMembers: number;
  operationalFloorAssets: number;
  activeStockHubs: number;
}

export interface MerchantAdminSummaryResponse {
  statusCode: number;
  message: string;
  data: MerchantAdminSummary;
}
