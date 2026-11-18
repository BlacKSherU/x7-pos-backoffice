import { apiRequest } from '@/shared/api/http';
import { ApiError } from '@/shared/lib/api-error';
import type {
  Customer,
  CreateCustomerPayload,
  UpdateCustomerPayload,
} from '../types/customer';

function unwrapAndNormalizeCustomerList(json: unknown): Customer[] {
  let list: unknown[] = [];
  if (Array.isArray(json)) {
    list = json;
  } else if (typeof json === 'object' && json !== null) {
    const obj = json as Record<string, unknown>;
    if (Array.isArray(obj.data)) {
      list = obj.data;
    } else if (Array.isArray(obj.rows)) {
      list = obj.rows;
    } else if (Array.isArray(obj.items)) {
      list = obj.items;
    }
  }

  return list.map((item) => {
    const raw = item as Record<string, unknown>;
    return {
      ...(raw as unknown as Customer),
      rut: (raw.rut as string) ?? (raw.document_id as string) ?? null,
      orders: (raw.orders as Customer['orders']) ?? (raw.ordersCount as number) ?? 0,
      loyaltyCustomers:
        (raw.loyaltyCustomers as Customer['loyaltyCustomers']) ??
        (raw.loyaltyCustomersCount as number) ??
        0,
    };
  });
}

/**
 * Fetches active enterprise customer records scoped by company ID.
 * Targets endpoint GET /api/v1/core/customers?companyId={id}.
 * If the endpoint returns 404 (no configurations established yet), gracefully returns empty array [].
 */
export async function fetchCustomers(
  companyId: number | string,
): Promise<Customer[]> {
  try {
    const json = await apiRequest<unknown>(
      `/v1/core/customers?companyId=${companyId}`,
      { method: 'GET' },
      'Failed to load customers from server.',
    );
    return unwrapAndNormalizeCustomerList(json);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      // Endpoint indicates 0 records / not yet configured for this company profile
      return [];
    }
    throw err;
  }
}

/**
 * Strips client-only or non-whitelisted fields before sending to the backend.
 * The backend Core Customers controller rejects merchantId, created_at, and updated_at.
 */
function sanitizeCustomerPayload<T extends Record<string, unknown>>(payload: T): T {
  const clean = { ...payload };
  delete clean.merchantId;
  delete clean.merchant_id;
  delete clean.created_at;
  delete clean.updated_at;
  delete clean.createdAt;
  delete clean.updatedAt;
  return clean as T;
}

/**
 * Creates a new customer record.
 */
export async function createCustomer(
  payload: CreateCustomerPayload,
): Promise<Customer> {
  const cleanPayload = sanitizeCustomerPayload(payload as unknown as Record<string, unknown>);
  const json = await apiRequest<{ data?: Customer } | Customer>(
    '/v1/core/customers',
    {
      method: 'POST',
      body: JSON.stringify(cleanPayload),
    },
    'Failed to create customer record.',
  );
  const raw = ((json as { data?: Customer }).data ?? json) as Record<string, unknown>;
  return {
    ...(raw as unknown as Customer),
    rut: (raw.rut as string) ?? (raw.document_id as string) ?? null,
  };
}

/**
 * Updates an existing customer profile.
 */
export async function updateCustomer(
  id: number | string,
  payload: UpdateCustomerPayload,
): Promise<Customer> {
  const cleanPayload = sanitizeCustomerPayload(payload as unknown as Record<string, unknown>);
  const json = await apiRequest<{ data?: Customer } | Customer>(
    `/v1/core/customers/${id}`,
    {
      method: 'PATCH',
      body: JSON.stringify(cleanPayload),
    },
    'Failed to update customer record.',
  );
  const raw = ((json as { data?: Customer }).data ?? json) as Record<string, unknown>;
  return {
    ...(raw as unknown as Customer),
    rut: (raw.rut as string) ?? (raw.document_id as string) ?? null,
  };
}

/**
 * Soft-deletes a customer record.
 * Dispatches DELETE /v1/core/customers/{id} or PATCH status mutation to preserve relational transaction history.
 */
export async function deleteCustomer(
  id: number | string,
): Promise<{ success: boolean } | Customer> {
  try {
    const json = await apiRequest<{ success: boolean; data?: Customer } | Customer>(
      `/v1/core/customers/${id}`,
      {
        method: 'DELETE',
      },
      'Failed to delete customer record.',
    );
    return json;
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      throw err;
    }
    // Fallback status mutation if backend accepts PATCH for soft-delete
    return await updateCustomer(id, {
      status: 'deleted',
      isActive: false,
      deleted_at: new Date().toISOString(),
    });
  }
}

