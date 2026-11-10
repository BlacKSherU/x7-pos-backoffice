/**
 * ISO 4217: lista completa de códigos alfabéticos vigentes (List One de la agencia de
 * mantenimiento ISO 4217, 2025) salvo XTS (pruebas) y XXX (sin moneda). Es la misma lista que
 * `SUPPORTED_CURRENCIES` del backend (src/platform-saas/saas-admin/constants/supported-currencies.ts):
 * el PATCH del perfil de company rechaza cualquier otro código.
 *
 * Lista estática y no `Intl.supportedValuesOf('currency')`: la de Intl depende del navegador y
 * todavía trae códigos retirados (HRK, CUC, ZWL...) que el backend no acepta.
 */
export const ISO_4217_CODES: ReadonlyArray<string> = [
  'AED', 'AFN', 'ALL', 'AMD', 'AOA', 'ARS', 'AUD', 'AWG', 'AZN', 'BAM',
  'BBD', 'BDT', 'BHD', 'BIF', 'BMD', 'BND', 'BOB', 'BOV', 'BRL', 'BSD',
  'BTN', 'BWP', 'BYN', 'BZD', 'CAD', 'CDF', 'CHE', 'CHF', 'CHW', 'CLF',
  'CLP', 'CNY', 'COP', 'COU', 'CRC', 'CUP', 'CVE', 'CZK', 'DJF', 'DKK',
  'DOP', 'DZD', 'EGP', 'ERN', 'ETB', 'EUR', 'FJD', 'FKP', 'GBP', 'GEL',
  'GHS', 'GIP', 'GMD', 'GNF', 'GTQ', 'GYD', 'HKD', 'HNL', 'HTG', 'HUF',
  'IDR', 'ILS', 'INR', 'IQD', 'IRR', 'ISK', 'JMD', 'JOD', 'JPY', 'KES',
  'KGS', 'KHR', 'KMF', 'KPW', 'KRW', 'KWD', 'KYD', 'KZT', 'LAK', 'LBP',
  'LKR', 'LRD', 'LSL', 'LYD', 'MAD', 'MDL', 'MGA', 'MKD', 'MMK', 'MNT',
  'MOP', 'MRU', 'MUR', 'MVR', 'MWK', 'MXN', 'MXV', 'MYR', 'MZN', 'NAD',
  'NGN', 'NIO', 'NOK', 'NPR', 'NZD', 'OMR', 'PAB', 'PEN', 'PGK', 'PHP',
  'PKR', 'PLN', 'PYG', 'QAR', 'RON', 'RSD', 'RUB', 'RWF', 'SAR', 'SBD',
  'SCR', 'SDG', 'SEK', 'SGD', 'SHP', 'SLE', 'SOS', 'SRD', 'SSP', 'STN',
  'SVC', 'SYP', 'SZL', 'THB', 'TJS', 'TMT', 'TND', 'TOP', 'TRY', 'TTD',
  'TWD', 'TZS', 'UAH', 'UGX', 'USD', 'USN', 'UYI', 'UYU', 'UYW', 'UZS',
  'VED', 'VES', 'VND', 'VUV', 'WST', 'XAF', 'XAG', 'XAU', 'XBA', 'XBB',
  'XBC', 'XBD', 'XCD', 'XCG', 'XDR', 'XOF', 'XPD', 'XPF', 'XPT', 'XSU',
  'XUA', 'YER', 'ZAR', 'ZMW', 'ZWG',
];

let displayNames: Intl.DisplayNames | null | undefined;

function currencyDisplayNames(): Intl.DisplayNames | null {
  if (displayNames === undefined) {
    try {
      displayNames = new Intl.DisplayNames(['en'], { type: 'currency', fallback: 'code' });
    } catch {
      // Navegador sin Intl.DisplayNames: solo los códigos.
      displayNames = null;
    }
  }
  return displayNames;
}

/** Nombre en inglés de una moneda ISO 4217 (`JPY` → `Japanese Yen`), o null si no lo hay. */
export function currencyName(code: string): string | null {
  try {
    const name = currencyDisplayNames()?.of(code);
    return name && name.toUpperCase() !== code.toUpperCase() ? name : null;
  } catch {
    return null;
  }
}

/** Texto de la opción del selector: `JPY — Japanese Yen` (o solo el código si no tiene nombre). */
export function currencyOptionLabel(code: string): string {
  const name = currencyName(code);
  return name ? `${code} — ${name}` : code;
}
