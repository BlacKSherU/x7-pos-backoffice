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
  activeTab?: PayrollSubModuleId;
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



