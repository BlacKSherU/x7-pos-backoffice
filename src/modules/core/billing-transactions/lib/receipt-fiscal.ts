import type { Receipt } from '../types/receipts';

/**
 * fiscal_data de un recibo (Historia 10). Espejo de las reglas del back-end
 * (src/core/billing-transactions/receipts/utils/receipt-fiscal-data.util.ts):
 *
 *   { "tax_id": "J-12345678-9", "exemption_code": "EX-2026-001", "tax_exempt": true, ...otros }
 *
 * EXENCIÓN (resolveTaxExemption):
 *   1. fiscal_data que no es un objeto JSON → NO exento.
 *   2. `tax_exempt` booleano decide: true → exento; false → NO exento aunque haya exemption_code.
 *   3. Sin `tax_exempt` booleano → exento si y sólo si exemption_code es un string no vacío.
 *
 * VALIDACIÓN (validateFiscalDataPayload, mismos mensajes que el 400 del back-end): objeto JSON;
 * tax_id y exemption_code strings no vacíos de hasta 64 caracteres; tax_exempt booleano; y
 * tax_exempt: true exige exemption_code.
 *
 * Un recibo exento tiene total_tax = 0 y sus impuestos activos en 0.00 (lo aplica el back-end).
 */
export const FISCAL_DATA_MAX_FIELD_LENGTH = 64;

/** Claves que el formulario edita con campos propios. */
export const FISCAL_STRUCTURED_KEYS = ['tax_id', 'exemption_code', 'tax_exempt'] as const;

export interface ReceiptTaxExemption {
  exempt: boolean;
  exemptionCode: string | null;
  taxId: string | null;
}

/** Estado del formulario de datos fiscales: campos estructurados + resto de claves en JSON. */
export interface FiscalFormState {
  taxId: string;
  exemptionCode: string;
  taxExempt: boolean;
  /** Otras claves de fiscal_data (objeto JSON con sangría) o el texto original si no era JSON. */
  extra: string;
}

export interface FiscalFormErrors {
  taxId?: string;
  exemptionCode?: string;
  extra?: string;
}

/** Resultado de comprobar grand_total = subtotal + total_tax − total_discount en centavos. */
export interface GrandTotalBalance {
  expected: number;
  actual: number;
  /** actual − expected, en centavos enteros (0 = cuadra al centavo). */
  differenceCents: number;
  balanced: boolean;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function trimmedString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

/** Parseo tolerante: el objeto JSON o null (texto vacío, no-JSON o no-objeto). Nunca lanza. */
export function parseFiscalObject(raw: string | null | undefined): Record<string, unknown> | null {
  if (typeof raw !== 'string' || raw.trim() === '') return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isPlainObject(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** Regla de exención del back-end aplicada al texto de fiscal_data. */
export function resolveTaxExemption(raw: string | null | undefined): ReceiptTaxExemption {
  const data = parseFiscalObject(raw);
  if (!data) return { exempt: false, exemptionCode: null, taxId: null };
  const exemptionCode = trimmedString(data.exemption_code);
  const taxId = trimmedString(data.tax_id);
  const exempt = typeof data.tax_exempt === 'boolean' ? data.tax_exempt : exemptionCode !== null;
  return { exempt, exemptionCode, taxId };
}

/**
 * Bloqueo fiscal (Historia 11): un recibo solo admite cambios (editar, bloquear, dar de baja,
 * líneas e impuestos) si está activo y no bloqueado. Misma regla que el FiscalLockGuard.
 */
export function isReceiptMutable(receipt: Pick<Receipt, 'is_active' | 'is_locked'>): boolean {
  return receipt.is_active && !receipt.is_locked;
}

export function isTaxExempt(receipt: Pick<Receipt, 'fiscal_data'>): boolean {
  return resolveTaxExemption(receipt.fiscal_data).exempt;
}

function codeError(data: Record<string, unknown>, key: string): string | null {
  const value = data[key];
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string' || value.trim() === '' || value.length > FISCAL_DATA_MAX_FIELD_LENGTH) {
    return `fiscalData.${key} must be a non-empty string of at most ${FISCAL_DATA_MAX_FIELD_LENGTH} characters`;
  }
  return null;
}

/**
 * Validación del payload completo (texto JSON) con los mismos mensajes que el back-end.
 * Texto vacío = sin datos fiscales (válido). Devuelve el primer error o null.
 */
export function validateFiscalDataPayload(raw: string): string | null {
  if (!raw.trim()) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return 'fiscalData must be valid JSON';
  }
  if (!isPlainObject(parsed)) return 'fiscalData must be a valid JSON object';
  const taxIdError = codeError(parsed, 'tax_id');
  if (taxIdError) return taxIdError;
  const codeErr = codeError(parsed, 'exemption_code');
  if (codeErr) return codeErr;
  if (parsed.tax_exempt !== undefined && parsed.tax_exempt !== null && typeof parsed.tax_exempt !== 'boolean') {
    return 'fiscalData.tax_exempt must be a boolean';
  }
  if (parsed.tax_exempt === true && trimmedString(parsed.exemption_code) === null) {
    return 'fiscalData.exemption_code is required when tax_exempt is true';
  }
  return null;
}

/** fiscal_data → estado del formulario (tax_id, exemption_code, tax_exempt + resto en JSON). */
export function splitFiscalData(raw: string | null | undefined): FiscalFormState {
  const data = parseFiscalObject(raw);
  if (!data) {
    // Texto heredado que no es un objeto JSON: se deja tal cual para que el usuario lo corrija.
    return { taxId: '', exemptionCode: '', taxExempt: false, extra: raw?.trim() ? raw : '' };
  }
  const rest: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (!(FISCAL_STRUCTURED_KEYS as readonly string[]).includes(key)) rest[key] = value;
  }
  return {
    taxId: typeof data.tax_id === 'string' ? data.tax_id : '',
    exemptionCode: typeof data.exemption_code === 'string' ? data.exemption_code : '',
    taxExempt: resolveTaxExemption(raw).exempt,
    extra: Object.keys(rest).length > 0 ? JSON.stringify(rest, null, 2) : '',
  };
}

function fieldError(label: string, value: string): string | undefined {
  if (value.trim().length > FISCAL_DATA_MAX_FIELD_LENGTH) {
    return `${label} is limited to ${FISCAL_DATA_MAX_FIELD_LENGTH} characters.`;
  }
  return undefined;
}

/** Valida el formulario con las mismas reglas que el back-end, con un error por campo. */
export function validateFiscalForm(state: FiscalFormState): FiscalFormErrors {
  const errors: FiscalFormErrors = {};
  const taxIdError = fieldError('Tax ID', state.taxId);
  if (taxIdError) errors.taxId = taxIdError;
  const codeErr = fieldError('Exemption code', state.exemptionCode);
  if (codeErr) errors.exemptionCode = codeErr;
  if (!errors.exemptionCode && state.taxExempt && !state.exemptionCode.trim()) {
    errors.exemptionCode = 'An exemption code is required for tax-exempt receipts.';
  }

  if (state.extra.trim()) {
    const extra = parseFiscalObject(state.extra);
    if (!extra) {
      errors.extra = isJson(state.extra)
        ? 'Additional fiscal data must be a JSON object, e.g. {"fiscal_number": "F001-1"}.'
        : 'Additional fiscal data must be valid JSON.';
    } else {
      const duplicated = FISCAL_STRUCTURED_KEYS.find((key) => key in extra);
      if (duplicated) errors.extra = `Set "${duplicated}" with its own field above.`;
    }
  }
  return errors;
}

function isJson(text: string): boolean {
  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * Estado del formulario → texto JSON compacto para fiscalData ('' si no queda ningún dato).
 * `tax_exempt` sólo se escribe si ya existía en el original o si el valor elegido difiere de
 * la regla implícita (exento ⇔ hay exemption_code); así no se generan cambios espurios y
 * desmarcar la casilla con un código registrado suspende la exención sin perder el certificado.
 */
export function buildFiscalData(state: FiscalFormState, originalRaw?: string | null): string {
  const extra = parseFiscalObject(state.extra) ?? {};
  const taxId = state.taxId.trim();
  const exemptionCode = state.exemptionCode.trim();
  const result: Record<string, unknown> = {};
  if (taxId) result.tax_id = taxId;
  if (exemptionCode) result.exemption_code = exemptionCode;
  const original = parseFiscalObject(originalRaw);
  const hadFlag = typeof original?.tax_exempt === 'boolean';
  const implicit = exemptionCode !== '';
  if (hadFlag || state.taxExempt !== implicit) result.tax_exempt = state.taxExempt;
  for (const [key, value] of Object.entries(extra)) {
    if (!(FISCAL_STRUCTURED_KEYS as readonly string[]).includes(key)) result[key] = value;
  }
  return Object.keys(result).length > 0 ? JSON.stringify(result) : '';
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (isPlainObject(value)) {
    return Object.keys(value)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = canonical(value[key]);
        return acc;
      }, {});
  }
  return value;
}

/** Mismo contenido fiscal aunque cambien el orden de las claves, espacios o sangría. */
export function sameFiscalData(a: string | null | undefined, b: string | null | undefined): boolean {
  const left = (a ?? '').trim();
  const right = (b ?? '').trim();
  if (!left || !right) return left === right;
  try {
    return JSON.stringify(canonical(JSON.parse(left))) === JSON.stringify(canonical(JSON.parse(right)));
  } catch {
    return left === right;
  }
}

/** Importe decimal → centavos enteros (sin errores de coma flotante). */
export function toCents(value: number | string | null | undefined): number {
  const n = typeof value === 'number' ? value : Number.parseFloat(String(value ?? 0));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

/** Comprueba en centavos enteros que grand_total = subtotal + total_tax − total_discount. */
export function grandTotalBalance(
  receipt: Pick<Receipt, 'subtotal' | 'total_tax' | 'total_discount' | 'grand_total'>,
): GrandTotalBalance {
  const expectedCents = toCents(receipt.subtotal) + toCents(receipt.total_tax) - toCents(receipt.total_discount);
  const actualCents = toCents(receipt.grand_total);
  return {
    expected: expectedCents / 100,
    actual: actualCents / 100,
    differenceCents: actualCents - expectedCents,
    balanced: actualCents === expectedCents,
  };
}
