import type { ReactNode } from 'react';
import type { UserProfile } from '@/modules/platform-saas/client-backoffice/api/restaurant-service';
import type { SubscriptionPlan } from '@/modules/platform-saas/subscription-system/types/subscription';
import type { JournalEntry } from '@/modules/core/financial-engine/types/accounting';
import type { SupplierCreditNote, SupplierPayment } from '@/modules/finance-hr/accounts-payable/types/accounts-payable';
import { getCurrentMerchantId } from '@/modules/platform-saas/users/api/users';

import { SubscriptionPlansView } from '@/modules/platform-saas/subscription-system/views/SubscriptionPlansView';
import { PlatformApplicationsView } from '@/modules/platform-saas/subscription-system/views/PlatformApplicationsView';
import { PlatformFeatureCatalogView } from '@/modules/platform-saas/subscription-system/views/PlatformFeatureCatalogView';
import { PlanApplicationsView } from '@/modules/platform-saas/subscription-system/views/PlanApplicationsView';
import { PlanFeaturesView } from '@/modules/platform-saas/subscription-system/views/PlanFeaturesView';
import { SaasDashboardView } from '@/modules/platform-saas/central-backoffice/views/SaasDashboardView';
import { ComingSoonView, PlanFeaturesPickPlanView } from '@/shared/components/PlaceholderViews';

import { CategoriesView } from '@/modules/inventory/products-inventory/views/CategoriesView';
import { ProductsView } from '@/modules/inventory/products-inventory/views/ProductsView';
import { VariantsView } from '@/modules/inventory/products-inventory/views/VariantsView';
import { ModifiersView } from '@/modules/inventory/products-inventory/views/ModifiersView';
import { LocationsView } from '@/modules/inventory/raw-materials/views/stocks/locations/LocationsView';
import { PurchaseOrdersView } from '@/modules/inventory/raw-materials/views/PurchaseOrdersView';
import { StockInventoryView } from '@/modules/inventory/raw-materials/views/stocks/items/StockInventoryView';
import { MovementsView } from '@/modules/inventory/raw-materials/views/stocks/movements/MovementsView';
import { RawMaterialsView } from '@/modules/inventory/raw-materials/views/RawMaterialsView';
import { RawMaterialCategoriesView } from '@/modules/inventory/raw-materials/views/RawMaterialCategoriesView';
import { RecipesView } from '@/modules/inventory/food-costing/views/RecipesView';
import { ProductsInventoryHubView } from '@/modules/inventory/products-inventory/views/ProductsInventoryHubView';
import { RawMaterialsHubView } from '@/modules/inventory/raw-materials/views/RawMaterialsHubView';

import { TaxRulesView } from '@/modules/core/configuration/views/TaxRulesView';
import { TipRulesView } from '@/modules/core/configuration/views/TipRulesView';
import { OvertimeRulesView } from '@/modules/core/configuration/views/OvertimeRulesView';
import { PayrollRulesView } from '@/modules/core/configuration/views/PayrollRulesView';

import { CashDrawersView } from '@/modules/restaurant-operations/cash-drawers/views/CashDrawersView';
import { CashShiftsView } from '@/modules/restaurant-operations/cash-drawers/views/CashShiftsView';
import { CashTransactionsView } from '@/modules/restaurant-operations/cash-drawers/views/CashTransactionsView';
import { CashMovementsView } from '@/modules/restaurant-operations/cash-drawers/views/CashMovementsView';
import { CashDrawerHistoryView } from '@/modules/restaurant-operations/cash-drawers/views/CashDrawerHistoryView';
import { CollaboratorPersonalScheduleView } from '@/modules/restaurant-operations/shifts/views/CollaboratorPersonalScheduleView';
import { ShiftAssignmentView } from '@/modules/restaurant-operations/shifts/views/ShiftAssignmentView';
import { TimeClockKioskView } from '@/modules/restaurant-operations/shifts/views/TimeClockKioskView';
import { TimeEntriesView as RestaurantTimeEntriesView } from '@/modules/restaurant-operations/shifts/views/TimeEntriesView';
import { TipsLedgerView } from '@/modules/restaurant-operations/tips/views/TipsLedgerView';
import { TipPoolsView } from '@/modules/restaurant-operations/tips/views/TipPoolsView';
import { TipPoolMembersView } from '@/modules/restaurant-operations/tips/views/TipPoolMembersView';
import { TipAllocationsView } from '@/modules/restaurant-operations/tips/views/TipAllocationsView';
import { TipSettlementsView } from '@/modules/restaurant-operations/tips/views/TipSettlementsView';
import { CashTipMovementsView } from '@/modules/restaurant-operations/tips/views/CashTipMovementsView';
import { OpenShiftsMarketplaceView } from '@/modules/restaurant-operations/shifts/views/OpenShiftsMarketplaceView';
import { LaborCostForecastingView } from '@/modules/restaurant-operations/shifts/views/LaborCostForecastingView';

import { KitchenStationsView } from '@/modules/restaurant-operations/kitchen-display-system/views/KitchenStationsView';
import { KitchenKDSHubView } from '@/modules/restaurant-operations/kitchen-display-system/views/KitchenKDSHubView';
import { KitchenDisplayDevicesView } from '@/modules/restaurant-operations/kitchen-display-system/views/KitchenDisplayDevicesView';
import { KitchenOrdersView } from '@/modules/restaurant-operations/kitchen-display-system/views/KitchenOrdersView';
import { KitchenOrderItemsView } from '@/modules/restaurant-operations/kitchen-display-system/views/KitchenOrderItemsView';
import { KitchenEventLogView } from '@/modules/restaurant-operations/kitchen-display-system/views/KitchenEventLogView';
import { KitchenAnalyticsView } from '@/modules/restaurant-operations/kitchen-display-system/views/KitchenAnalyticsView';

import { LedgerAccountsView } from '@/modules/core/financial-engine/views/LedgerAccountsView';
import { JournalEntriesView } from '@/modules/core/financial-engine/views/JournalEntriesView';
import { JournalEntryLinesView } from '@/modules/core/financial-engine/views/JournalEntryLinesView';

import { SuppliersView } from '@/modules/core/business-partners/views/SuppliersView';
import { SupplierInvoicesView } from '@/modules/finance-hr/accounts-payable/views/SupplierInvoicesView';
import { SupplierInvoiceItemsView } from '@/modules/finance-hr/accounts-payable/views/SupplierInvoiceItemsView';
import { SupplierCreditNotesView } from '@/modules/finance-hr/accounts-payable/views/SupplierCreditNotesView';
import { SupplierPaymentsView } from '@/modules/finance-hr/accounts-payable/views/SupplierPaymentsView';
import { SupplierPaymentItemsView } from '@/modules/finance-hr/accounts-payable/views/SupplierPaymentItemsView';
import { SupplierPaymentAllocationsView } from '@/modules/finance-hr/accounts-payable/views/SupplierPaymentAllocationsView';

import { MerchantDirectoryView } from '@/modules/platform-saas/merchants/views/MerchantDirectoryView';
import { UserManagementView } from '@/modules/platform-saas/users/views/UserManagementView';
import { CompanyProfileView } from '@/modules/platform-saas/companies/views/CompanyProfileView';
import { CompanyConfigurationsView } from '@/modules/platform-saas/companies/views/CompanyConfigurationsView';

import { FloorPlansView } from '@/modules/restaurant-operations/dining-system/views/FloorPlansView';
import { FloorZonesView } from '@/modules/restaurant-operations/dining-system/views/FloorZonesView';
import { DiningTablesView } from '@/modules/restaurant-operations/dining-system/views/DiningTablesView';
import { TableAssignmentsView } from '@/modules/restaurant-operations/dining-system/views/TableAssignmentsView';
import { CollaboratorsView } from '@/modules/finance-hr/hr/views/CollaboratorsView';
import { TimeEntriesView as HrTimeEntriesView } from '@/modules/finance-hr/hr/views/TimeEntriesView';
import { ContractsView } from '@/modules/finance-hr/hr/views/ContractsView';
import { ReservationsView } from '@/modules/restaurant-operations/reservations/views/ReservationsView';
import { ReservationTablesView } from '@/modules/restaurant-operations/reservations/views/ReservationTablesView';
import { ReservationNotesView } from '@/modules/restaurant-operations/reservations/views/ReservationNotesView';
import { ReservationGuestsView } from '@/modules/restaurant-operations/reservations/views/ReservationGuestsView';
import { ReservationStatusHistoryView } from '@/modules/restaurant-operations/reservations/views/ReservationStatusHistoryView';
import { DeliveryZonesView } from '@/modules/commerce/delivery-management/views/DeliveryZonesView';
import { DeliveryFeesView } from '@/modules/commerce/delivery-management/views/DeliveryFeesView';
import { DeliveryDriversView } from '@/modules/commerce/delivery-management/views/DeliveryDriversView';
import { DeliveryTrackingView } from '@/modules/commerce/delivery-management/views/DeliveryTrackingView';
import { DeliveryAssignmentsView } from '@/modules/commerce/delivery-management/views/DeliveryAssignmentsView';
import { QRLocationsView } from '@/modules/commerce/qr-code/views/QRLocationsView';
import { QRMenusView } from '@/modules/commerce/qr-code/views/QRMenusView';
import { QRMenuSectionsView } from '@/modules/commerce/qr-code/views/QRMenuSectionsView';
import { QRMenuItemsView } from '@/modules/commerce/qr-code/views/QRMenuItemsView';
import { QROrdersView } from '@/modules/commerce/qr-code/views/QROrdersView';
import { QROrderItemsView } from '@/modules/commerce/qr-code/views/QROrderItemsView';
import { QRDeploymentsView } from '@/modules/commerce/qr-code/views/QRDeploymentsView';
import { OnlineOrderingHubView } from '@/modules/commerce/online-ordering/views/OnlineOrderingHubView';
import { OnlineStoresView } from '@/modules/commerce/online-ordering/views/online-stores/OnlineStoresView';
import { OnlineMenusView } from '@/modules/commerce/online-ordering/views/online-menus/OnlineMenusView';
import { OnlineMenuCategoriesView } from '@/modules/commerce/online-ordering/views/online-menu-categories/OnlineMenuCategoriesView';
import { OnlineMenuItemsView } from '@/modules/commerce/online-ordering/views/online-menu-items/OnlineMenuItemsView';
import { OnlineOrdersView } from '@/modules/commerce/online-ordering/views/online-orders/OnlineOrdersView';

export interface AllocationsContext {
  payment?: SupplierPayment | null;
  creditNote?: SupplierCreditNote | null;
}

/** Lo que una vista del registro necesita de MerchantFrame. */
export interface MerchantViewContext {
  activeCategory: string;
  profile: UserProfile | null;
  selectedPlan: SubscriptionPlan | null;
  refreshTrigger: number;
  /** Cambia de pestaña sin tocar la URL. */
  onNavigate: (view: string) => void;
  /** Navegación de las vistas de personal y propinas (también actualiza la URL). */
  onStaffNavigate: (target: string) => void;
  /** Navegación de las vistas de suscripciones (puede llevar el plan elegido). */
  onSaasNavigate: (view: string, plan?: SubscriptionPlan) => void;
  /** Cambia de pestaña limpiando los filtros de drill-down. */
  navigateToFeature: (featureId: string) => void;
  setActiveTab: (tab: string) => void;
  goToDashboard: () => void;
  openLiveMonitor: () => void;
  linesEntryFilter: JournalEntry | null;
  setLinesEntryFilter: (entry: JournalEntry | null) => void;
  itemsPaymentFilter: SupplierPayment | null;
  setItemsPaymentFilter: (payment: SupplierPayment | null) => void;
  allocationsContext: AllocationsContext | null;
  setAllocationsContext: (context: AllocationsContext | null) => void;
}

type ViewRenderer = (ctx: MerchantViewContext) => ReactNode;

const VIEWS = new Map<string, ViewRenderer>();

/** Registra una vista para una o varias pestañas (ids, alias y URLs heredadas). */
function view(tabs: string | string[], render: ViewRenderer) {
  for (const tab of Array.isArray(tabs) ? tabs : [tabs]) {
    if (VIEWS.has(tab)) throw new Error(`Duplicate merchant view: ${tab}`);
    VIEWS.set(tab, render);
  }
}

const merchantId = () => getCurrentMerchantId() ?? undefined;

// ---- Legales y soporte (aún sin contenido) ----
view('privacy-policy', (ctx) => (
  <ComingSoonView title="Privacy Policy" route="/legal/privacy-policy" icon="gavel" onBack={ctx.goToDashboard} />
));
view('terms-of-service', (ctx) => (
  <ComingSoonView title="Terms of Service" route="/legal/terms-of-service" icon="gavel" onBack={ctx.goToDashboard} />
));
view('help-center', (ctx) => (
  <ComingSoonView title="Help Center" route="/support/help-center" icon="help" onBack={ctx.goToDashboard} />
));

// ---- Platform SaaS ----
view('saas-dashboard', (ctx) => (
  <SaasDashboardView refreshTrigger={ctx.refreshTrigger} onNavigateToView={ctx.onNavigate} />
));
view('sub-plans-core', (ctx) => <SubscriptionPlansView onNavigate={ctx.onSaasNavigate} />);
view('apps-config', (ctx) => <PlatformApplicationsView onNavigate={ctx.onSaasNavigate} />);
view('features-control', (ctx) => <PlatformFeatureCatalogView onNavigate={ctx.onSaasNavigate} />);
view('plan-apps-rules', (ctx) => (
  <PlanApplicationsView plan={ctx.selectedPlan ?? undefined} onNavigate={ctx.onSaasNavigate} />
));
view('plan-features-mapping', (ctx) =>
  ctx.selectedPlan ? (
    <PlanFeaturesView plan={ctx.selectedPlan} onNavigate={ctx.onSaasNavigate} />
  ) : (
    <PlanFeaturesPickPlanView onChoosePlan={() => ctx.navigateToFeature('sub-plans-core')} />
  ),
);
view('merchant-directory', () => <MerchantDirectoryView />);
view('user-management', () => <UserManagementView />);
view('company-profile', () => <CompanyProfileView />);
view('company-configurations', () => <CompanyConfigurationsView />);

// ---- Productos e inventario ----
view('categories', (ctx) => <CategoriesView onNavigate={ctx.onNavigate} />);
view('products', (ctx) => <ProductsView onNavigate={ctx.onNavigate} />);
view('modifiers', (ctx) => <ModifiersView onNavigate={ctx.onNavigate} />);
view('variants', (ctx) => <VariantsView onNavigate={ctx.onNavigate} />);
view('locations', (ctx) => <LocationsView onNavigate={ctx.onNavigate} />);
view('purchase-orders', (ctx) => <PurchaseOrdersView onNavigate={ctx.onNavigate} />);
view('stock-movements', (ctx) => <StockInventoryView onNavigate={ctx.onNavigate} />);
view('movements', (ctx) => <MovementsView onNavigate={ctx.onNavigate} />);
view('raw-materials', (ctx) => <RawMaterialsView onNavigate={ctx.onNavigate} />);
view('raw-material-categories', (ctx) => <RawMaterialCategoriesView onNavigate={ctx.onNavigate} />);
view('recipes', (ctx) => <RecipesView onNavigate={ctx.onNavigate} />);
view(['inventory-dashboard', 'products-inventory-hub'], (ctx) => <ProductsInventoryHubView onNavigate={ctx.onNavigate} />);
view(['raw-materials-dashboard', 'raw-materials-hub'], (ctx) => <RawMaterialsHubView onNavigate={ctx.onNavigate} />);

// ---- Reglas ----
view('merchant-tax-rules', (ctx) => <TaxRulesView onNavigate={ctx.onNavigate} />);
view('merchant-tips-rules', (ctx) => <TipRulesView onNavigate={ctx.onNavigate} />);
view('merchant-overtime-rules', (ctx) => <OvertimeRulesView onNavigate={ctx.onNavigate} />);
view('merchant-payroll-rules', (ctx) => <PayrollRulesView onNavigate={ctx.onNavigate} />);

// ---- Caja ----
view('cash-drawers', (ctx) => <CashDrawersView onNavigate={ctx.onNavigate} />);
view('cash-shifts', (ctx) => <CashShiftsView onNavigate={ctx.onNavigate} />);
view('cash-transactions', (ctx) => <CashTransactionsView onNavigate={ctx.onNavigate} />);
view('cash-movements', (ctx) => <CashMovementsView onNavigate={ctx.onNavigate} />);
view('cash-drawer-history', (ctx) => <CashDrawerHistoryView onNavigate={ctx.onNavigate} />);

// ---- Personal: turnos y asistencia ----
view(['my-schedule', 'personal-schedule', '/staff-management/schedule/me'], (ctx) => (
  <CollaboratorPersonalScheduleView onNavigate={ctx.onStaffNavigate} />
));
view(['shifts', 'daily-timeline', 'daily', '/staff-management/schedule/daily'], (ctx) => (
  <ShiftAssignmentView initialViewMode="daily" onNavigate={ctx.onStaffNavigate} />
));
view(['shift-assignment', 'assignments', 'scheduler'], (ctx) => (
  <ShiftAssignmentView initialViewMode="weekly" onNavigate={ctx.onStaffNavigate} />
));
view(['staff-roster', 'roster'], (ctx) => (
  <ShiftAssignmentView initialViewMode="monthly" onNavigate={ctx.onStaffNavigate} />
));
view(['staff-swaps', 'swaps'], (ctx) => (
  <ShiftAssignmentView initialViewMode="swaps" onNavigate={ctx.onStaffNavigate} />
));
view(
  ['open-shifts', 'marketplace', '/staff-management/schedule/marketplace', '/staff-management/schedule/open-shifts'],
  (ctx) => <OpenShiftsMarketplaceView onNavigate={ctx.onStaffNavigate} />,
);
view(['labor-forecasting', 'forecasting', '/staff-management/schedule/labor-forecasting'], (ctx) => (
  <LaborCostForecastingView onNavigate={ctx.onStaffNavigate} />
));
view(['attendance-ledger', 'ledger'], (ctx) => <RestaurantTimeEntriesView onNavigate={ctx.onStaffNavigate} />);
// Misma pestaña en dos módulos: el registro de asistencia de operaciones y los fichajes de RR. HH.
view(['collaborators-time-entries', 'time-entries'], (ctx) =>
  ctx.activeCategory === 'restaurant-operations' ? (
    <RestaurantTimeEntriesView onNavigate={ctx.onStaffNavigate} />
  ) : (
    <HrTimeEntriesView onNavigate={ctx.onNavigate} merchantId={merchantId()} />
  ),
);
view(['time-clock', 'time-clock-kiosk', 'kiosk'], (ctx) => (
  <TimeClockKioskView onClose={() => ctx.setActiveTab('dashboard')} onNavigate={ctx.onStaffNavigate} />
));

// ---- Propinas ----
view(['tips-ledger', 'tips', '/store-operations/tips-ledger'], (ctx) => <TipsLedgerView onNavigate={ctx.onStaffNavigate} />);
view(
  ['tips-pools', 'tip-pools', '/tips/pools', '/store-operations/tips-pools', '/store-operations/tip-pools'],
  (ctx) => <TipPoolsView onNavigate={ctx.onStaffNavigate} />,
);
view(
  ['tips-pool-members', 'tip-pool-members', 'pool-members', '/tips/pool-members', '/store-operations/tips-pool-members', '/store-operations/tip-pool-members'],
  (ctx) => <TipPoolMembersView onNavigate={ctx.onStaffNavigate} />,
);
view(
  ['tips-allocations', 'tip-allocations', '/tips/allocations', '/store-operations/tips-allocations'],
  (ctx) => <TipAllocationsView onNavigate={ctx.onStaffNavigate} />,
);
view(
  ['tips-settlements', 'tip-settlements', '/tips/settlements', '/store-operations/tips-settlements'],
  (ctx) => <TipSettlementsView onNavigate={ctx.onStaffNavigate} />,
);
view(
  ['tips-cash-movements', 'cash-tip-movements', 'tip-movements', '/tips/cash-movements'],
  (ctx) => <CashTipMovementsView onNavigate={ctx.onStaffNavigate} />,
);

// ---- Contabilidad ----
view('ledger-accounts', (ctx) => <LedgerAccountsView onNavigate={ctx.onNavigate} />);
view('journal-entries', (ctx) => (
  <JournalEntriesView
    onNavigate={ctx.onNavigate}
    onViewLines={(entry) => {
      ctx.setLinesEntryFilter(entry);
      ctx.setActiveTab('journal-entries-lines');
    }}
  />
));
view('journal-entries-lines', (ctx) => (
  <JournalEntryLinesView
    entry={ctx.linesEntryFilter}
    onClearEntry={() => ctx.setLinesEntryFilter(null)}
    onNavigate={(next: string) => {
      ctx.setLinesEntryFilter(null);
      ctx.setActiveTab(next);
    }}
  />
));

// ---- Cuentas por pagar ----
view('suppliers', (ctx) => <SuppliersView onNavigate={ctx.onNavigate} companyId={ctx.profile?.company_id} />);
view('supplier-invoices', (ctx) => (
  <SupplierInvoicesView onNavigate={ctx.onNavigate} companyId={ctx.profile?.company_id} />
));
view('supplier-invoice-items', (ctx) => (
  <SupplierInvoiceItemsView onNavigate={ctx.onNavigate} companyId={ctx.profile?.company_id} />
));
view('supplier-credit-notes', (ctx) => (
  <SupplierCreditNotesView
    onNavigate={ctx.onNavigate}
    companyId={ctx.profile?.company_id}
    onViewAllocations={(creditNote) => {
      ctx.setAllocationsContext({ creditNote });
      ctx.setActiveTab('supplier-payments-allocation');
    }}
  />
));
view('supplier-payments', (ctx) => (
  <SupplierPaymentsView
    onNavigate={ctx.onNavigate}
    companyId={ctx.profile?.company_id}
    onViewItems={(payment) => {
      ctx.setItemsPaymentFilter(payment);
      ctx.setActiveTab('supplier-payment-items');
    }}
    onViewAllocations={(payment) => {
      ctx.setAllocationsContext({ payment });
      ctx.setActiveTab('supplier-payments-allocation');
    }}
  />
));
view('supplier-payment-items', (ctx) => (
  <SupplierPaymentItemsView
    payment={ctx.itemsPaymentFilter}
    onClearPayment={() => ctx.setItemsPaymentFilter(null)}
    onNavigate={(next: string) => {
      ctx.setItemsPaymentFilter(null);
      ctx.setActiveTab(next);
    }}
    companyId={ctx.profile?.company_id}
  />
));
view('supplier-payments-allocation', (ctx) => (
  <SupplierPaymentAllocationsView
    payment={ctx.allocationsContext?.payment ?? null}
    creditNote={ctx.allocationsContext?.creditNote ?? null}
    onClearContext={() => ctx.setAllocationsContext(null)}
    onNavigate={(next: string) => {
      ctx.setAllocationsContext(null);
      ctx.setActiveTab(next);
    }}
    companyId={ctx.profile?.company_id}
  />
));

// ---- Vistas por sucursal (merchantId de la sesión) ----
view('floor-plans', (ctx) => <FloorPlansView onNavigate={ctx.onNavigate} merchantId={merchantId()} />);
view('table-zones', (ctx) => <FloorZonesView onNavigate={ctx.onNavigate} merchantId={merchantId()} />);
view('tables', (ctx) => <DiningTablesView onNavigate={ctx.onNavigate} merchantId={merchantId()} />);
view('table-assignments', (ctx) => <TableAssignmentsView onNavigate={ctx.onNavigate} merchantId={merchantId()} />);
view('collaborators', (ctx) => <CollaboratorsView onNavigate={ctx.onNavigate} merchantId={merchantId()} />);
view('collaborators-contracts', (ctx) => <ContractsView onNavigate={ctx.onNavigate} merchantId={merchantId()} />);
view('reservations', (ctx) => <ReservationsView onNavigate={ctx.onNavigate} merchantId={merchantId()} />);
view('reservation-tables', (ctx) => <ReservationTablesView onNavigate={ctx.onNavigate} merchantId={merchantId()} />);
view('reservation-notes', (ctx) => <ReservationNotesView onNavigate={ctx.onNavigate} merchantId={merchantId()} />);
view('reservation-guests', (ctx) => <ReservationGuestsView onNavigate={ctx.onNavigate} merchantId={merchantId()} />);
view('reservation-status-history', (ctx) => (
  <ReservationStatusHistoryView onNavigate={ctx.onNavigate} merchantId={merchantId()} />
));
view('delivery-zones', (ctx) => <DeliveryZonesView onNavigate={ctx.onNavigate} merchantId={merchantId()} />);
view('delivery-fees', (ctx) => <DeliveryFeesView onNavigate={ctx.onNavigate} merchantId={merchantId()} />);
view('delivery-drivers', (ctx) => <DeliveryDriversView onNavigate={ctx.onNavigate} merchantId={merchantId()} />);
view('delivery-assignments', (ctx) => <DeliveryAssignmentsView onNavigate={ctx.onNavigate} merchantId={merchantId()} />);
view('delivery-tracking', (ctx) => <DeliveryTrackingView onNavigate={ctx.onNavigate} merchantId={merchantId()} />);
view('qr-code-locations', (ctx) => <QRLocationsView onNavigate={ctx.onNavigate} merchantId={merchantId()} />);
view('qr-code-menus', (ctx) => <QRMenusView onNavigate={ctx.onNavigate} merchantId={merchantId()} />);
view('qr-code-menu-sections', (ctx) => <QRMenuSectionsView onNavigate={ctx.onNavigate} merchantId={merchantId()} />);
view('qr-code-menu-items', (ctx) => <QRMenuItemsView onNavigate={ctx.onNavigate} merchantId={merchantId()} />);
view('qr-code-orders', (ctx) => <QROrdersView onNavigate={ctx.onNavigate} merchantId={merchantId()} />);
view('qr-order-items', (ctx) => <QROrderItemsView onNavigate={ctx.onNavigate} merchantId={merchantId()} />);
view('qr-code-deployments', (ctx) => <QRDeploymentsView onNavigate={ctx.onNavigate} merchantId={merchantId()} />);

// ---- Commerce ----
view(['online-ordering-hub', 'online-ordering-dashboard'], (ctx) => <OnlineOrderingHubView onNavigate={ctx.onNavigate} />);
view('online-stores', (ctx) => <OnlineStoresView onNavigate={ctx.onNavigate} />);
view('online-menus', (ctx) => <OnlineMenusView onNavigate={ctx.onNavigate} />);
view('online-menu-categories', (ctx) => <OnlineMenuCategoriesView onNavigate={ctx.onNavigate} />);
view('online-menu-items', (ctx) => <OnlineMenuItemsView onNavigate={ctx.onNavigate} />);
view('online-orders', (ctx) => <OnlineOrdersView onNavigate={ctx.onNavigate} />);

// ---- Cocina (KDS) ----
view(['kds-dashboard', 'kitchen-kds-hub'], (ctx) => (
  <KitchenKDSHubView onNavigate={ctx.onNavigate} onOpenLiveMonitor={ctx.openLiveMonitor} />
));
view('kitchen-stations', (ctx) => <KitchenStationsView onNavigate={ctx.onNavigate} />);
view('kitchen-display-devices', (ctx) => <KitchenDisplayDevicesView onNavigate={ctx.onNavigate} />);
view('kitchen-orders', (ctx) => <KitchenOrdersView onNavigate={ctx.onNavigate} />);
view('kitchen-order-items', (ctx) => <KitchenOrderItemsView onNavigate={ctx.onNavigate} />);
view('kitchen-event-log', (ctx) => <KitchenEventLogView onNavigate={ctx.onNavigate} />);
view('kitchen-analytics', (ctx) => <KitchenAnalyticsView onNavigate={ctx.onNavigate} />);

/** Pestañas con vista propia (para tests y para saber si una pestaña está implementada). */
export const REGISTERED_VIEW_TABS: readonly string[] = [...VIEWS.keys()];

/** Vista de la pestaña, o `undefined` si no tiene una registrada. */
export function renderMerchantView(tab: string, ctx: MerchantViewContext): ReactNode | undefined {
  return VIEWS.get(tab)?.(ctx);
}
