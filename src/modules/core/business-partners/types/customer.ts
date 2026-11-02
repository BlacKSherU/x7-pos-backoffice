export interface CustomerOrderRef {
  id: number | string;
  orderNumber?: string;
  total?: number;
  status?: string;
  createdAt?: string;
  [key: string]: unknown;
}

export interface LoyaltyCustomerRef {
  id: number | string;
  tier?: string;
  points?: number;
  cardNumber?: string;
  [key: string]: unknown;
}

export interface Customer {
  id: number;
  name: string;
  rut?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  companyId?: number | string;
  company_id?: number | string;
  merchantId?: number | string;
  merchant_id?: number | string;
  isActive?: boolean;
  status?: string;
  orders?: CustomerOrderRef[] | number;
  loyaltyCustomers?: LoyaltyCustomerRef[] | number;
  ordersCount?: number;
  loyaltyCustomersCount?: number;
  createdAt?: string;
  updatedAt?: string;
  created_at?: string;
  updated_at?: string;
  deletedAt?: string | null;
  deleted_at?: string | null;
}

export interface CustomersListResponse {
  statusCode?: number;
  message?: string;
  data?: Customer[];
}

export interface CustomerMutationResponse {
  statusCode?: number;
  message?: string;
  data?: Customer;
}

export interface CreateCustomerPayload {
  name: string;
  rut?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  companyId?: number | string;
  merchantId?: number | string;
  created_at?: string;
  updated_at?: string;
}

export interface UpdateCustomerPayload extends Partial<CreateCustomerPayload> {
  isActive?: boolean;
  status?: string;
  deleted_at?: string | null;
}

