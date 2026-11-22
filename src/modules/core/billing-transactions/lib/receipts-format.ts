import type { Receipt, ReceiptType } from '../types/receipts';

/** Monto con 2 decimales y separador de miles: 1234.5 → "1,234.50". */
export function formatAmount(value: number | string | null | undefined): string {
  const n = typeof value === 'number' ? value : Number.parseFloat(String(value ?? 0));
  const safe = Number.isFinite(n) ? n : 0;
  return safe.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Monto con 2 decimales + código de moneda ISO: "1,234.50 USD". */
export function formatMoney(value: number | string | null | undefined, currency?: string | null): string {
  return `${formatAmount(value)} ${(currency || 'USD').toUpperCase()}`;
}

export const RECEIPT_TYPE_LABELS: Record<ReceiptType, string> = {
  INVOICE: 'Invoice',
  RECEIPT: 'Receipt',
};

export const RECEIPT_TYPE_BADGE: Record<ReceiptType, string> = {
  INVOICE: 'bg-[#ae001a]/10 text-[#ae001a] border-[#ae001a]/20',
  RECEIPT: 'bg-zinc-100 text-zinc-700 border-zinc-200',
};

/** fiscal_data (texto JSON) → pares clave/valor; texto no-JSON → una entrada "raw". */
export function parseFiscalData(raw: string | null | undefined): Array<[string, string]> {
  if (!raw || !raw.trim()) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return Object.entries(parsed as Record<string, unknown>).map(([key, value]) => [
        key,
        value !== null && typeof value === 'object' ? JSON.stringify(value) : String(value ?? ''),
      ]);
    }
  } catch {
    // no es JSON: se muestra tal cual
  }
  return [['raw', raw]];
}

/** Resumen corto de fiscal_data para la tabla ("tax_id: 123 · fiscal_number: ABC"). */
export function summarizeFiscalData(raw: string | null | undefined, maxLength = 60): string {
  const pairs = parseFiscalData(raw);
  if (pairs.length === 0) return '';
  const text = pairs.map(([k, v]) => (k === 'raw' ? v : `${k}: ${v}`)).join(' · ');
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

/** Fecha corta legible; la cadena original si no se puede interpretar. */
export function formatReceiptDate(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Etiqueta visible del recibo: número de factura o "#id" si aún no tiene. */
export function receiptLabel(receipt: Pick<Receipt, 'id' | 'invoice_number'>): string {
  return receipt.invoice_number || `Receipt #${receipt.id}`;
}

/** Valida el texto de fiscal_data del formulario: vacío o un objeto JSON. */
export function validateFiscalDataInput(text: string): string | null {
  if (!text.trim()) return null;
  try {
    const parsed: unknown = JSON.parse(text);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return 'Fiscal data must be a JSON object, e.g. {"tax_id": "123"}.';
    }
    return null;
  } catch {
    return 'Fiscal data must be valid JSON.';
  }
}

/** Tasa de impuesto en porcentaje sin ceros sobrantes: 19 → "19%", 8.5 → "8.5%". */
export function formatRate(rate: number | string | null | undefined): string {
  const n = typeof rate === 'number' ? rate : Number.parseFloat(String(rate ?? 0));
  const safe = Number.isFinite(n) ? n : 0;
  return `${safe.toLocaleString('en-US', { maximumFractionDigits: 2 })}%`;
}

/** "VAT 19%"; si el nombre ya trae la tasa ("IVA 19%") no la repite. */
export function taxLabel(name: string, rate: number): string {
  const rateText = formatRate(rate);
  const compact = name.replace(/\s+/g, '');
  return compact.includes(rateText) ? name : `${name} ${rateText}`;
}

/** Cantidad sin decimales sobrantes: 2 → "2", 1.5 → "1.5". */
export function formatQuantity(value: number | string | null | undefined): string {
  const n = typeof value === 'number' ? value : Number.parseFloat(String(value ?? 0));
  const safe = Number.isFinite(n) ? n : 0;
  return safe.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

/** YYYY-MM-DD → "Nov 1, 2026" (sin desfase de zona horaria). */
function formatDateOnly(value: string): string {
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return value;
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/** Texto del rango de fechas activo: "All dates", "Since …", "Until …" o "… – …". */
export function describeDateRange(dateFrom?: string | null, dateTo?: string | null): string {
  if (dateFrom && dateTo) {
    return dateFrom === dateTo ? formatDateOnly(dateFrom) : `${formatDateOnly(dateFrom)} – ${formatDateOnly(dateTo)}`;
  }
  if (dateFrom) return `Since ${formatDateOnly(dateFrom)}`;
  if (dateTo) return `Until ${formatDateOnly(dateTo)}`;
  return 'All dates';
}
