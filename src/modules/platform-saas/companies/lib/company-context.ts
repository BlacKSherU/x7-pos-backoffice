/**
 * Company de contexto del Companies Hub: la última que el usuario abrió desde el directorio o
 * desde su Company Hub. Vive en sessionStorage (por pestaña del navegador); si el almacenamiento
 * no está disponible (modo privado, bloqueado) se comporta como si no hubiera ninguna.
 */

export const COMPANY_CONTEXT_STORAGE_KEY = 'x7:saas-company-context';

function isValidId(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

export function rememberCompanyContext(companyId: number): void {
  if (!isValidId(companyId)) return;
  try {
    sessionStorage.setItem(COMPANY_CONTEXT_STORAGE_KEY, String(companyId));
  } catch {
    // Sin almacenamiento: el hub vuelve a la company propia o al directorio.
  }
}

export function getRememberedCompanyContext(): number | null {
  try {
    const raw = sessionStorage.getItem(COMPANY_CONTEXT_STORAGE_KEY);
    if (!raw) return null;
    const id = Number(raw);
    return isValidId(id) ? id : null;
  } catch {
    return null;
  }
}

export function clearCompanyContext(): void {
  try {
    sessionStorage.removeItem(COMPANY_CONTEXT_STORAGE_KEY);
  } catch {
    // Nada que limpiar si no hay almacenamiento.
  }
}

export interface CompanyContextOption {
  id: number;
  status?: string | null;
}

/**
 * Company de contexto por defecto del Companies Hub (a la que llevan las tarjetas y botones
 * Company Profile / Company Configuration / Company Merchants):
 *   1. la recordada (la última abierta o elegida en el selector), si está entre las opciones;
 *   2. la propia del usuario (Company/Merchant Administrator);
 *   3. la primera company activa de la lista (en su orden, por nombre);
 *   4. la primera de la lista.
 * `companies === null`: la lista no se pudo cargar; vale la recordada o la propia.
 */
export function pickCompanyContext({
  remembered,
  ownCompanyId,
  companies,
}: {
  remembered: number | null;
  ownCompanyId: number | null | undefined;
  companies: ReadonlyArray<CompanyContextOption> | null;
}): number | null {
  const own = isValidId(ownCompanyId) ? ownCompanyId : null;
  if (companies === null) return (isValidId(remembered) ? remembered : null) ?? own;
  const ids = new Set(companies.map((company) => company.id));
  if (isValidId(remembered) && ids.has(remembered)) return remembered;
  if (own !== null && ids.has(own)) return own;
  const active = companies.find((company) => (company.status ?? '').toLowerCase() === 'active');
  return active?.id ?? companies[0]?.id ?? null;
}
