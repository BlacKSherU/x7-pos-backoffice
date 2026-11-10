/**
 * Destinos de la barra inferior (NavHubBar) de las vistas Platform SaaS de companies / merchants /
 * users. Cada nivel muestra sus vistas hermanas; la flecha atrás de cada vista va a su padre lógico.
 */
import { platformSaasPaths } from '@/modules/platform-saas/companies/lib/platform-saas-routes';

export interface SaasNavDestination {
  /** Identificador estable del destino. */
  id: string;
  label: string;
  icon: string;
  /** URL de destino; sin ella el botón no se muestra (p. ej. falta un id todavía). */
  to?: string | null;
  active?: boolean;
}

export type CompaniesNavId = 'companies-hub' | 'companies-directory' | 'company-profile' | 'company-configuration' | 'company-merchants';
export type CompanyNavId = 'company-hub' | 'company-profile' | 'company-configuration' | 'company-merchants';
export type MerchantNavId = 'merchant-hub' | 'merchant-profile' | 'merchant-users' | 'merchant-terminals';

const mark = <T extends string>(items: Array<SaasNavDestination & { id: T }>, active?: T) =>
  items.map((item) => ({ ...item, active: item.id === active }));

/** Companies Hub y Companies Directory: los módulos de company apuntan a la company de contexto. */
export function companiesNav(active: CompaniesNavId, contextCompanyId: number | null): SaasNavDestination[] {
  const ctx = contextCompanyId;
  return mark<CompaniesNavId>(
    [
      { id: 'companies-hub', label: 'Companies Hub', icon: 'hub', to: platformSaasPaths.companiesHub() },
      { id: 'companies-directory', label: 'Companies Directory', icon: 'domain', to: platformSaasPaths.companiesDirectory() },
      { id: 'company-profile', label: 'Company Profile', icon: 'business', to: ctx ? platformSaasPaths.companyProfile(ctx) : null },
      {
        id: 'company-configuration',
        label: 'Company Configuration',
        icon: 'settings',
        to: ctx ? platformSaasPaths.companyConfiguration(ctx) : null,
      },
      { id: 'company-merchants', label: 'Company Merchants', icon: 'storefront', to: ctx ? platformSaasPaths.companyMerchants(ctx) : null },
    ],
    active,
  );
}

/** Vistas de una company concreta: su hub, perfil, configuración y directorio de merchants. */
export function companyNav(companyId: number, active: CompanyNavId): SaasNavDestination[] {
  return mark<CompanyNavId>(
    [
      { id: 'company-hub', label: 'Company Hub', icon: 'hub', to: platformSaasPaths.companyHub(companyId) },
      { id: 'company-profile', label: 'Company Profile', icon: 'business', to: platformSaasPaths.companyProfile(companyId) },
      {
        id: 'company-configuration',
        label: 'Company Configuration',
        icon: 'settings',
        to: platformSaasPaths.companyConfiguration(companyId),
      },
      { id: 'company-merchants', label: 'Company Merchants', icon: 'storefront', to: platformSaasPaths.companyMerchants(companyId) },
    ],
    active,
  );
}

/**
 * Vistas de una sucursal: su hub, perfil, usuarios y terminales POS. Sin `companyId` (aún no se
 * conoce la company de la sucursal) solo queda el directorio de usuarios, que no la necesita.
 */
export function merchantNav(companyId: number | null | undefined, merchantId: number, active?: MerchantNavId): SaasNavDestination[] {
  const cid = companyId ?? null;
  return mark<MerchantNavId>(
    [
      { id: 'merchant-hub', label: 'Merchant Hub', icon: 'storefront', to: cid ? platformSaasPaths.merchantHub(cid, merchantId) : null },
      {
        id: 'merchant-profile',
        label: 'Merchant Profile',
        icon: 'edit_note',
        to: cid ? platformSaasPaths.merchantProfile(cid, merchantId) : null,
      },
      { id: 'merchant-users', label: 'Users', icon: 'group', to: platformSaasPaths.merchantUsers(merchantId) },
      {
        id: 'merchant-terminals',
        label: 'POS Terminals',
        icon: 'point_of_sale',
        to: cid ? platformSaasPaths.merchantTerminals(cid, merchantId) : null,
      },
    ],
    active,
  );
}
