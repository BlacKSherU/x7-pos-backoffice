export interface PayrollEntryCollaborator {
  id?: string | number;
  name?: string;
  first_name?: string;
  last_name?: string;
  avatar_url?: string;
  department?: string;
  role?: string;
}

export interface PayrollEntry {
  id: string | number;
  payroll_run_id?: string | number;
  collaborator_id?: string | number;
  entry_id?: string | number;
  collaborator_name?: string;
  collaborator?: PayrollEntryCollaborator;
  base_pay: number | string;
  overtime_pay: number | string;
  double_overtime_pay?: number | string;
  tips_amount?: number | string;
  tips?: number | string; // alias for tips_amount
  bonuses?: number | string;
  deductions?: number | string;
  gross_total?: number | string;
  tax_total?: number | string;
  net_total: number | string;
  regular_hours?: number;
  overtime_hours?: number;
  double_overtime_hours?: number;
  status?: string;
  pay_period_start?: string;
  pay_period_end?: string;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
  [key: string]: unknown;
}

export interface PayrollCalculationVerification {
  isValid: boolean;
  isGrossValid: boolean;
  isNetValid: boolean;
  expectedGross: number;
  actualGross: number;
  expectedNet: number;
  actualNet: number;
  discrepancyReason?: string;
}

export interface PayrollEntriesGridProps {
  /** The payroll run ID used to hydrate entries via GET /api/v1/payroll-entries?payrollRunId={id} */
  payrollRunId?: string | number;
  /** Optional pre-loaded entries (overrides or provides initial dataset) */
  entries?: PayrollEntry[];
  /** Controlled search query to filter rows */
  searchQuery?: string;
  /** Callback when an entry is selected or row is clicked (opens detail inspector) */
  onSelectEntry?: (entry: PayrollEntry) => void;
  /** Callback when edit action is clicked */
  onEditEntry?: (entry: PayrollEntry) => void;
  /** Callback when delete action is clicked (soft delete) */
  onDeleteEntry?: (entry: PayrollEntry) => Promise<void> | void;
  /** Callback when dataset changes or an entry is soft-deleted */
  onEntriesChange?: (entries: PayrollEntry[]) => void;
  /** Callback for refresh */
  onRefresh?: () => void;
  /** Optional manual loading state */
  isLoading?: boolean;
  /** Show soft-deleted records (default: false) */
  includeDeleted?: boolean;
  /** Currency code for formatting (default USD) */
  currency?: string;
  /** Optional custom class name */
  className?: string;
}

export interface PayrollMetrics {
  totalBasePay: number;
  totalOvertimePay: number;
  totalNetPay: number;
  entryCount?: number;
}

export interface PayrollEntriesHeaderProps {
  /** The active dataset of payroll entries to calculate metrics and filter */
  entries?: PayrollEntry[];
  /** Alias for entries */
  dataset?: PayrollEntry[];
  /** Optional pre-computed metrics override */
  metrics?: Partial<PayrollMetrics>;
  /** Controlled search query */
  searchQuery?: string;
  /** Callback when search input query changes */
  onSearchChange?: (query: string) => void;
  /** Live filtering callback receiving the filtered entries */
  onFilteredEntriesChange?: (filtered: PayrollEntry[]) => void;
  /** Primary action handler for + MANUAL PAYROLL ENTRY */
  onManualEntryClick?: () => void;
  /** Alias for onManualEntryClick */
  onOpenCreateModal?: () => void;
  /** Alias for onManualEntryClick */
  onAddEntry?: () => void;
  /** Navigation handler for breadcrumbs */
  onNavigate?: (route: string) => void;
  /** Optional title override (defaults to PAYROLL ENTRIES COMMAND CONTROL) */
  title?: string;
  /** Optional subtitle/description */
  description?: string;
  /** Loading state */
  isLoading?: boolean;
  /** Currency code (default USD) */
  currency?: string;
  /** If true, calculates KPI metric cards only from search-filtered entries instead of active dataset */
  scopeMetricsToSearch?: boolean;
  /** Additional custom controls or filter elements */
  children?: React.ReactNode;
}

export interface PayrollEntriesQuickLaunchProps {
  /** The current grid dataset of payroll entries */
  entries?: PayrollEntry[];
  /** Optional set or list of selected entry IDs */
  selectedRowIds?: (string | number)[];
  /** Optional list of selected entries */
  selectedEntries?: PayrollEntry[];
  /** Callback when net pay recalculation is triggered */
  onRecalculateNetPay?: (recalculatedEntries: PayrollEntry[]) => void;
  /** Callback when bulk adjustments action is clicked */
  onBulkAdjustments?: () => void;
  /** Callback when export payroll summary is triggered (receives CSV content) */
  onExportPayrollSummary?: (csvContent: string) => void;
  /** Callback when audit taxes action is clicked */
  onAuditTaxes?: () => void;
  /** Callback when entries change as a result of recalculation */
  onEntriesChange?: (updatedEntries: PayrollEntry[]) => void;
  /** Whether recalculation or export is currently processing */
  isLoading?: boolean;
  /** Custom export filename */
  exportFilename?: string;
  /** Custom class name */
  className?: string;
  /** Whether the quick launch bar is persistent above footer (default true) */
  isPersistent?: boolean;
  /** Custom children or extra actions slot */
  children?: React.ReactNode;
}

export type PayrollSubModuleId =
  | 'payroll-runs'
  | 'payroll-entries'
  | 'payroll-adjustments'
  | 'payroll-tax-detail';

export interface PayrollNavHubItem {
  id: PayrollSubModuleId;
  label: string;
  path: string;
  featureId?: string;
  icon: string;
}

export interface PayrollNavHubProps {
  /** The currently active tab ID */
  activeTab?: PayrollSubModuleId | 'adjustments' | 'entries' | 'runs' | 'tax-detail' | (string & {});
  /** Current URL route path, e.g. '/finance-hr/payrolls/entries' */
  currentRoute?: string;
  /** Callback when a navigation tab is clicked */
  onNavigate?: (tabId: PayrollSubModuleId, path: string) => void;
  /** Optional shorthand callback when active tab changes */
  onTabChange?: (tabId: PayrollSubModuleId) => void;
  /** Optional back button handler */
  onBack?: () => void;
  /** Label for back button */
  backLabel?: string;
  /** Title on the left badge */
  title?: string;
  /** Whether to show the module identity badge (default: true) */
  showBadge?: boolean;
  /** Whether the bar is persistently fixed to the bottom (default: true) */
  isPersistent?: boolean;
  /** Custom class name */
  className?: string;
  /** Custom items override */
  items?: PayrollNavHubItem[];
}

export type PayrollAdjustmentType = 'BONUS' | 'DEDUCTION';

export type PayrollAdjustmentFilterType = 'ALL' | PayrollAdjustmentType;

export interface PayrollAdjustment {
  id: string | number;
  payroll_run_id?: string | number;
  payroll_entry_id?: string | number;
  collaborator_id?: string | number;
  collaborator_name?: string;
  collaborator?: PayrollEntryCollaborator;
  adjustment_type: PayrollAdjustmentType | string;
  name?: string;
  reason?: string;
  description?: string;
  amount: number | string;
  category?: string;
  status?: 'applied' | 'pending' | 'cancelled' | string;
  effective_date?: string;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
  [key: string]: unknown;
}

export interface PayrollAdjustmentsMetrics {
  totalBonuses: number;
  totalDeductions: number;
  netAdjustmentTotal: number;
  bonusCount: number;
  deductionCount: number;
  totalCount: number;
}

export interface PayrollAdjustmentsHeaderProps {
  /** The dataset of payroll adjustments */
  adjustments?: PayrollAdjustment[];
  /** Alias for adjustments */
  dataset?: PayrollAdjustment[];
  /** Optional pre-computed metrics override */
  metrics?: Partial<PayrollAdjustmentsMetrics>;
  /** Selected adjustment type filter ('ALL' | 'BONUS' | 'DEDUCTION') */
  selectedType?: 'ALL' | PayrollAdjustmentType | string;
  /** Alias for selectedType */
  selectedFilter?: 'ALL' | PayrollAdjustmentType | string;
  /** Callback when adjustment type filter changes */
  onTypeFilterChange?: (type: 'ALL' | PayrollAdjustmentType) => void;
  /** Alias for onTypeFilterChange */
  onFilterChange?: (type: 'ALL' | PayrollAdjustmentType) => void;
  /** Controlled search query */
  searchQuery?: string;
  /** Callback when search input query changes */
  onSearchChange?: (query: string) => void;
  /** Callback with the filtered adjustments (type + search filtered) */
  onFilteredAdjustmentsChange?: (filtered: PayrollAdjustment[]) => void;
  /** Primary action handler for + NEW ADJUSTMENT */
  onNewAdjustmentClick?: () => void;
  /** Alias for onNewAdjustmentClick */
  onAddAdjustment?: () => void;
  /** Alias for onNewAdjustmentClick */
  onOpenCreateModal?: () => void;
  /** Navigation handler for breadcrumbs */
  onNavigate?: (route: string) => void;
  /** Optional title override (defaults to PAYROLL ADJUSTMENTS CONTROL) */
  title?: string;
  /** Optional subtitle/description */
  description?: string;
  /** Loading state */
  isLoading?: boolean;
  /** Currency code (default USD) */
  currency?: string;
  /** Scope metric cards calculation to current filters instead of total dataset */
  scopeMetricsToFilter?: boolean;
  /** Additional custom controls slot */
  children?: React.ReactNode;
}

export interface PayrollAdjustmentsGridProps {
  /** The payroll run ID used to hydrate adjustments via GET /api/v1/payroll-adjustments?payrollRunId={id} */
  payrollRunId?: string | number;
  /** Optional payroll entry ID to filter adjustments specifically for that entry */
  payrollEntryId?: string | number;
  /** Pre-loaded adjustments dataset (overrides or provides initial data) */
  adjustments?: PayrollAdjustment[];
  /** Associated payroll entries to recalculate when an adjustment is deleted */
  payrollEntries?: PayrollEntry[];
  /** Controlled search query to filter rows */
  searchQuery?: string;
  /** Controlled adjustment type filter ('ALL' | 'BONUS' | 'DEDUCTION') */
  selectedType?: 'ALL' | PayrollAdjustmentType | string;
  /** Alias for selectedType */
  selectedTypeFilter?: 'ALL' | PayrollAdjustmentType | string;
  /** Callback when an adjustment row is clicked/inspected */
  onSelectAdjustment?: (adjustment: PayrollAdjustment) => void;
  /** Callback when edit action is clicked */
  onEditAdjustment?: (adjustment: PayrollAdjustment) => void;
  /** Callback when soft delete is triggered */
  onDeleteAdjustment?: (adjustment: PayrollAdjustment) => Promise<void> | void;
  /** Callback when adjustments dataset changes (e.g. after soft-delete) */
  onAdjustmentsChange?: (adjustments: PayrollAdjustment[]) => void;
  /** Callback when an associated payroll entry is recalculated following an adjustment deletion */
  onPayrollEntryRecalculated?: (updatedEntry: PayrollEntry, adjustment: PayrollAdjustment) => void;
  /** Callback for refresh */
  onRefresh?: () => void;
  /** Loading state override */
  isLoading?: boolean;
  /** Whether to show soft-deleted records (default false) */
  includeDeleted?: boolean;
  /** Currency code (default USD) */
  currency?: string;
  /** Custom class name */
  className?: string;
}

export interface PayrollAdjustmentsQuickLaunchProps {
  /** The current dataset of adjustments */
  adjustments?: PayrollAdjustment[];
  /** Associated payroll entries to re-sync against */
  payrollEntries?: PayrollEntry[];
  /** Optional set or list of selected adjustment IDs */
  selectedRowIds?: (string | number)[];
  /** Optional list of selected adjustments */
  selectedAdjustments?: PayrollAdjustment[];
  /** Callback when [ APPLY BULK BONUS ] is clicked */
  onApplyBulkBonus?: () => void;
  /** Callback when [ IMPORT DEDUCTIONS CSV ] is clicked */
  onImportDeductionsCsv?: (file?: File) => void;
  /** Callback when [ RE-SYNC WITH ENTRIES ] is clicked (receives recalculated PayrollEntry[]) */
  onReSyncWithEntries?: (recalculatedEntries: PayrollEntry[]) => void;
  /** Callback when [ ADJUSTMENT REPORT ] is clicked (receives CSV content) */
  onAdjustmentReport?: (csvContent: string) => void;
  /** Callback when payroll entries change following re-sync */
  onEntriesChange?: (updatedEntries: PayrollEntry[]) => void;
  /** Loading/busy state */
  isLoading?: boolean;
  /** Custom report filename */
  reportFilename?: string;
  /** Custom class name */
  className?: string;
  /** Whether the quick launch bar is persistent above footer (default true) */
  isPersistent?: boolean;
  /** Custom children or extra actions slot */
  children?: React.ReactNode;
}






