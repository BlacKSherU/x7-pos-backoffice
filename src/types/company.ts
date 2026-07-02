export interface CompanyProfileMetrics {
  activeMerchantBranches: number;
  globalCorporateCustomers: number;
  authorizedMasterSuppliers: number;
}

export interface CompanyProfile {
  id: number;
  name: string;
  rut: string;
  email: string;
  phone?: string | null;
  address: string;
  city: string;
  state: string;
  country: string;
  metrics: CompanyProfileMetrics;
}

export interface CompanyProfileResponse {
  statusCode: number;
  message: string;
  data: CompanyProfile;
}

export type CompanyProfilePayload = {
  name: string;
  rut: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  country: string;
};

export interface CompanyConfigurationItem {
  id: number;
  configurationType: string;
  configurationLabel: string;
  status: string;
  merchantId: number;
  merchantName: string;
  updatedAt: string;
}

export interface CompanyConfigurationsSummary {
  totalConfigurations: number;
  activeConfigurations: number;
  configurationTypes: number;
}

export interface CompanyConfigurationsData {
  summary: CompanyConfigurationsSummary;
  items: CompanyConfigurationItem[];
}

export interface CompanyConfigurationsResponse {
  statusCode: number;
  message: string;
  data: CompanyConfigurationsData;
}
