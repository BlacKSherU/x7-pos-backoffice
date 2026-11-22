import { API_BASE, apiRequest, authHeaders } from '@/shared/api/http';
import { ApiError, getApiErrorDetails } from '@/shared/lib/api-error';
import { redirectToLogin } from '@/platform/auth/lib/auth-storage';
import type {
  BillingReportKind,
  DiscountAuditFilters,
  DiscountAuditReport,
  DiscountAuditRow,
  DiscountAuditSummary,
  TaxLiabilityFilters,
  TaxLiabilityReport,
} from '../types/billing-reports';

/**
 * Reportes de facturación (Historia 8).
 * - GET /billing/reports/tax-liability   → pasivo de impuestos agrupado por tasa y scope.
 * - GET /billing/reports/discount-audit  → auditoría de descuentos y anulaciones (paginada).
 * Ambos aceptan `format=csv` para descargar el mismo reporte como CSV.
 */
const REPORT_PATHS: Record<BillingReportKind, string> = {
  'tax-liability': '/billing/reports/tax-liability',
  'discount-audit': '/billing/reports/discount-audit',
};

/** Máximo de filas por página que acepta el back-end en la auditoría. */
export const DISCOUNT_AUDIT_MAX_LIMIT = 500;
/** Tope de páginas al reunir la auditoría completa para imprimir (500 × 20 = 10 000 filas). */
export const DISCOUNT_AUDIT_MAX_PAGES = 20;

function setIfPresent(params: URLSearchParams, key: string, value: unknown): void {
  if (value === undefined || value === null) return;
  const text = String(value).trim();
  if (text) params.set(key, text);
}

export function buildTaxLiabilityParams(filters: TaxLiabilityFilters): URLSearchParams {
  const params = new URLSearchParams();
  setIfPresent(params, 'from', filters.from);
  setIfPresent(params, 'to', filters.to);
  setIfPresent(params, 'rate', filters.rate);
  setIfPresent(params, 'scope', filters.scope);
  setIfPresent(params, 'name', filters.name);
  setIfPresent(params, 'currency', filters.currency);
  return params;
}

export function buildDiscountAuditParams(filters: DiscountAuditFilters): URLSearchParams {
  const params = new URLSearchParams();
  setIfPresent(params, 'from', filters.from);
  setIfPresent(params, 'to', filters.to);
  if (filters.eventType && filters.eventType !== 'all') params.set('eventType', filters.eventType);
  setIfPresent(params, 'userId', filters.userId);
  setIfPresent(params, 'receiptType', filters.receiptType);
  setIfPresent(params, 'currency', filters.currency);
  setIfPresent(params, 'page', filters.page);
  setIfPresent(params, 'limit', filters.limit);
  return params;
}

function withQuery(path: string, params: URLSearchParams): string {
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

export async function fetchTaxLiabilityReport(
  filters: TaxLiabilityFilters,
): Promise<TaxLiabilityReport> {
  const json = await apiRequest<{ data: TaxLiabilityReport }>(
    withQuery(REPORT_PATHS['tax-liability'], buildTaxLiabilityParams(filters)),
    { method: 'GET' },
    'Failed to load the tax liability report.',
  );
  return json.data;
}

export async function fetchDiscountAuditReport(
  filters: DiscountAuditFilters,
): Promise<DiscountAuditReport> {
  return apiRequest<DiscountAuditReport>(
    withQuery(REPORT_PATHS['discount-audit'], buildDiscountAuditParams(filters)),
    { method: 'GET' },
    'Failed to load the discount audit report.',
  );
}

export interface AllDiscountAuditRows {
  rows: DiscountAuditRow[];
  summary: DiscountAuditSummary;
  total: number;
  /** true si se alcanzó el tope de páginas y faltan filas (exporta CSV para todas). */
  truncated: boolean;
}

/** Reúne todas las páginas de la auditoría (para la vista imprimible). */
export async function fetchAllDiscountAuditRows(
  filters: DiscountAuditFilters,
  maxPages = DISCOUNT_AUDIT_MAX_PAGES,
): Promise<AllDiscountAuditRows> {
  const rows: DiscountAuditRow[] = [];
  let page = 1;
  let report: DiscountAuditReport;
  do {
    report = await fetchDiscountAuditReport({ ...filters, page, limit: DISCOUNT_AUDIT_MAX_LIMIT });
    rows.push(...report.data);
    page += 1;
  } while (report.hasNext && page <= maxPages);

  return {
    rows,
    summary: report.summary,
    total: report.total,
    truncated: rows.length < report.total,
  };
}

/**
 * Descarga el reporte como CSV generado por el back-end (`format=csv`): todas las filas, BOM UTF-8,
 * CRLF y filas TOTAL. Devuelve el texto; la vista lo guarda como .csv o lo convierte a .xls.
 */
export async function fetchBillingReportCsv(
  kind: BillingReportKind,
  filters: TaxLiabilityFilters | DiscountAuditFilters,
): Promise<string> {
  const params =
    kind === 'tax-liability'
      ? buildTaxLiabilityParams(filters as TaxLiabilityFilters)
      : buildDiscountAuditParams({ ...(filters as DiscountAuditFilters), page: undefined, limit: undefined });
  params.set('format', 'csv');

  const response = await fetch(`${API_BASE}${withQuery(REPORT_PATHS[kind], params)}`, {
    method: 'GET',
    headers: { ...authHeaders(), Accept: 'text/csv' },
  });

  if (response.status === 401) {
    redirectToLogin();
    throw new ApiError('Unauthorized', 401);
  }
  if (!response.ok) {
    const { message, code } = await getApiErrorDetails(response, 'Failed to export the report.');
    throw new ApiError(message, response.status, code);
  }
  return response.text();
}
