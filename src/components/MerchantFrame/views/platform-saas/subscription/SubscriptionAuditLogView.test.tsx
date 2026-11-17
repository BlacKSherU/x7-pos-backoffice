import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SubscriptionAuditLogView } from './SubscriptionAuditLogView';
import { saasService } from '@/modules/platform-saas/central-backoffice/api/saas-service';
import type { SubscriptionAuditLog } from '@/modules/platform-saas/subscription-system/types/subscription';
import * as authStorage from '@/platform/auth/lib/auth-storage';
import {
  recordSubscriptionAuditLog,
  getStoredAuditLogs,
  resetAuditLogsStorageForTesting,
} from '@/modules/platform-saas/subscription-system/lib/subscription-audit-logger';

vi.mock('@/modules/platform-saas/central-backoffice/api/saas-service', () => ({
  saasService: {
    getSubscriptionAuditLogs: vi.fn(),
    recordSubscriptionAuditLog: vi.fn(),
    listCompanies: vi.fn(),
  },
}));

const MOCK_AUDIT_LOGS: SubscriptionAuditLog[] = [
  {
    id: 'log_sub_1092',
    timestamp: '2026-11-13T14:45:00.000Z',
    actor_user_id: 1,
    actor_name: 'Rafael Cordero (SuperAdmin)',
    actor_email: 'superadmin@x7pos.com',
    actor_role: 'superadmin',
    action_type: 'PLAN_MAPPING_UPDATED',
    target_type: 'PLAN_APPLICATION',
    target_id: 103,
    target_name: 'Delivery Fleet Tracking',
    company_id: null,
    previous_value: { linked: false, plan_id: 2 },
    new_value: { linked: true, plan_id: 2 },
    reason_notes: 'Updated Professional plan bundle with Q4 fleet tracking capabilities.',
    ledger_hash: '0x8f2d61a9bc3451e0f84a3219ef891c01e3895ac712bf',
  },
  {
    id: 'log_sub_1091',
    timestamp: '2026-11-12T16:20:00.000Z',
    actor_user_id: 42,
    actor_name: 'Elena Morales (SaaS Compliance)',
    actor_email: 'compliance@x7platform.com',
    actor_role: 'saasadmin',
    action_type: 'SUBSCRIPTION_STATUS_CHANGED',
    target_type: 'COMPANY_SUBSCRIPTION',
    target_id: 101,
    target_name: 'Bella Vista Gourmet - Professional Tier',
    company_id: 10,
    company_name: 'Bella Vista Gourmet',
    previous_value: { status: 'ACTIVE' },
    new_value: { status: 'SUSPENDED', immediate: true },
    reason_notes: 'Delinquent subscription invoice over 45 days. Tenant write access suspended as per SLA.',
    ledger_hash: '0x5c3e72b1aa9046f1e29811c0ab845d02fa741cb834de',
  },
  {
    id: 'log_sub_1090',
    timestamp: '2026-11-10T11:05:00.000Z',
    actor_user_id: 1,
    actor_name: 'Rafael Cordero (SuperAdmin)',
    actor_email: 'superadmin@x7pos.com',
    actor_role: 'superadmin',
    action_type: 'PLAN_MAPPING_UPDATED',
    target_type: 'PLAN_FEATURE',
    target_id: 205,
    target_name: 'Advanced Cost Analytics',
    company_id: null,
    previous_value: { linked: true, limit_value: 5 },
    new_value: { linked: false, limit_value: 0 },
    reason_notes: 'Repackaged advanced forecasting to Enterprise tier.',
    ledger_hash: '0x4a1b99cf021387d89ab55e123fc76e1098bc52a198de',
  },
];

const MOCK_COMPANIES = [
  { id: 10, name: 'Bella Vista Gourmet', status: 'active', country: 'DOM', merchantsCount: 3 },
  { id: 20, name: 'Sabor Criollo Corp', status: 'active', country: 'DOM', merchantsCount: 1 },
];

describe('SubscriptionAuditLogView', () => {
  const onNavigateMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    resetAuditLogsStorageForTesting();

    vi.spyOn(authStorage, 'getEffectiveUserRole').mockReturnValue('super_admin');
    vi.spyOn(authStorage, 'getStoredUser').mockReturnValue({
      id: 1,
      email: 'superadmin@x7pos.com',
      role: 'super_admin',
      scope: 'global',
      merchant: { id: 1 },
      authorizedFeatureIds: [1, 2, 3],
    });

    vi.mocked(saasService.getSubscriptionAuditLogs).mockResolvedValue(MOCK_AUDIT_LOGS);
    vi.mocked(saasService.listCompanies).mockResolvedValue(MOCK_COMPANIES);
  });

  afterEach(() => {
    cleanup();
  });

  describe('RBAC & Role Protection', () => {
    it('restricts access and displays permission boundary when role is not authorized', async () => {
      vi.spyOn(authStorage, 'getEffectiveUserRole').mockReturnValue('cashier');
      vi.spyOn(authStorage, 'getStoredUser').mockReturnValue({
        id: 99,
        email: 'cashier@bistro.com',
        role: 'cashier',
        scope: 'store',
        merchant: { id: 1 },
        authorizedFeatureIds: [],
      });

      render(<SubscriptionAuditLogView userRole="cashier" onNavigate={onNavigateMock} />);

      expect(screen.getByTestId('audit-log-permission-boundary')).toBeInTheDocument();
      expect(screen.getByText(/Access Restricted: Administrative Ledger/i)).toBeInTheDocument();
      expect(screen.queryByTestId('audit-log-table')).not.toBeInTheDocument();

      const backBtn = screen.getByRole('button', { name: /Return to Subscription Hub/i });
      fireEvent.click(backBtn);
      expect(onNavigateMock).toHaveBeenCalledWith('subscription-system-hub');
    });

    it('grants access when user is superadmin', async () => {
      render(<SubscriptionAuditLogView userRole="superadmin" onNavigate={onNavigateMock} />);

      await waitFor(() => {
        expect(screen.getByTestId('subscription-audit-log-view')).toBeInTheDocument();
      });

      expect(screen.getByText('Subscription Audit Log Ledger')).toBeInTheDocument();
      expect(screen.getByTestId('audit-log-table')).toBeInTheDocument();
    });

    it('grants access when user is saasadmin', async () => {
      vi.spyOn(authStorage, 'getEffectiveUserRole').mockReturnValue('saasadmin');
      vi.spyOn(authStorage, 'getStoredUser').mockReturnValue({
        id: 42,
        email: 'admin@x7platform.com',
        role: 'saasadmin',
        scope: 'global',
        merchant: { id: 1 },
        authorizedFeatureIds: [1],
      });

      render(<SubscriptionAuditLogView userRole="saasadmin" onNavigate={onNavigateMock} />);

      await waitFor(() => {
        expect(screen.getByTestId('subscription-audit-log-view')).toBeInTheDocument();
      });

      expect(screen.getByTestId('audit-log-table')).toBeInTheDocument();
    });
  });

  describe('Audit Trail Grid & Metrics Rendering', () => {
    it('renders metric cards with correct computed values', async () => {
      render(<SubscriptionAuditLogView onNavigate={onNavigateMock} />);

      await waitFor(() => {
        expect(screen.getByTestId('metric-total-events')).toHaveTextContent('3');
      });

      expect(screen.getByTestId('metric-status-changes')).toHaveTextContent('1');
      expect(screen.getByTestId('metric-matrix-updates')).toHaveTextContent('2');
      expect(screen.getByTestId('metric-unique-actors')).toHaveTextContent('2');
    });

    it('renders audit rows displaying actor identity, timestamp, action type, diffs, and reason notes', async () => {
      render(<SubscriptionAuditLogView onNavigate={onNavigateMock} />);

      await waitFor(() => {
        expect(screen.getByTestId('audit-row-log_sub_1092')).toBeInTheDocument();
      });

      // Verify row content for log_sub_1092
      const row1 = screen.getByTestId('audit-row-log_sub_1092');
      expect(row1).toHaveTextContent('Rafael Cordero (SuperAdmin)');
      expect(row1).toHaveTextContent('superadmin@x7pos.com');
      expect(row1).toHaveTextContent('PLAN_MAPPING_UPDATED');
      expect(row1).toHaveTextContent('Delivery Fleet Tracking');
      expect(row1).toHaveTextContent('Updated Professional plan bundle with Q4 fleet tracking capabilities.');

      // Verify row content for log_sub_1091 (status change with mandatory reason)
      const row2 = screen.getByTestId('audit-row-log_sub_1091');
      expect(row2).toHaveTextContent('Elena Morales (SaaS Compliance)');
      expect(row2).toHaveTextContent('SUBSCRIPTION_STATUS_CHANGED');
      expect(row2).toHaveTextContent('Bella Vista Gourmet');
      expect(row2).toHaveTextContent('Delinquent subscription invoice over 45 days');
    });

    it('switches between Grid and Timeline view modes', async () => {
      render(<SubscriptionAuditLogView onNavigate={onNavigateMock} />);

      await waitFor(() => {
        expect(screen.getByTestId('audit-log-table')).toBeInTheDocument();
      });

      // Toggle to Timeline view
      const timelineBtn = screen.getByRole('button', { name: /Timeline/i });
      fireEvent.click(timelineBtn);

      expect(screen.getByTestId('audit-log-timeline')).toBeInTheDocument();
      expect(screen.getByTestId('timeline-entry-log_sub_1092')).toBeInTheDocument();
      expect(screen.queryByTestId('audit-log-table')).not.toBeInTheDocument();

      // Switch back to Grid
      const gridBtn = screen.getByRole('button', { name: /Grid Ledger/i });
      fireEvent.click(gridBtn);

      expect(screen.getByTestId('audit-log-table')).toBeInTheDocument();
    });
  });

  describe('Filtering and Search', () => {
    it('filters logs by search query keyword', async () => {
      render(<SubscriptionAuditLogView onNavigate={onNavigateMock} />);

      await waitFor(() => {
        expect(screen.getByTestId('audit-row-log_sub_1092')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/Search by actor ID, name, email/i);
      fireEvent.change(searchInput, { target: { value: 'Bella Vista' } });

      expect(screen.queryByTestId('audit-row-log_sub_1092')).not.toBeInTheDocument();
      expect(screen.getByTestId('audit-row-log_sub_1091')).toBeInTheDocument();
      expect(screen.queryByTestId('audit-row-log_sub_1090')).not.toBeInTheDocument();
    });

    it('filters logs by action type dropdown', async () => {
      render(<SubscriptionAuditLogView onNavigate={onNavigateMock} />);

      await waitFor(() => {
        expect(screen.getByTestId('audit-row-log_sub_1092')).toBeInTheDocument();
      });

      const actionSelect = screen.getByLabelText(/Filter by action type/i);
      fireEvent.change(actionSelect, { target: { value: 'SUBSCRIPTION_STATUS_CHANGED' } });

      expect(screen.queryByTestId('audit-row-log_sub_1092')).not.toBeInTheDocument();
      expect(screen.getByTestId('audit-row-log_sub_1091')).toBeInTheDocument();
      expect(screen.queryByTestId('audit-row-log_sub_1090')).not.toBeInTheDocument();
    });

    it('filters logs by target entity dropdown', async () => {
      render(<SubscriptionAuditLogView onNavigate={onNavigateMock} />);

      await waitFor(() => {
        expect(screen.getByTestId('audit-row-log_sub_1092')).toBeInTheDocument();
      });

      const targetSelect = screen.getByLabelText(/Filter by target type/i);
      fireEvent.change(targetSelect, { target: { value: 'PLAN_FEATURE' } });

      expect(screen.queryByTestId('audit-row-log_sub_1092')).not.toBeInTheDocument();
      expect(screen.queryByTestId('audit-row-log_sub_1091')).not.toBeInTheDocument();
      expect(screen.getByTestId('audit-row-log_sub_1090')).toBeInTheDocument();
    });

    it('filters logs by company scope', async () => {
      render(<SubscriptionAuditLogView onNavigate={onNavigateMock} />);

      await waitFor(() => {
        expect(screen.getByTestId('audit-row-log_sub_1092')).toBeInTheDocument();
      });

      const companySelect = screen.getByLabelText(/Filter by company/i);
      fireEvent.change(companySelect, { target: { value: '10' } });

      expect(saasService.getSubscriptionAuditLogs).toHaveBeenCalledWith(10);
    });

    it('displays empty state when no logs match filters', async () => {
      render(<SubscriptionAuditLogView onNavigate={onNavigateMock} />);

      await waitFor(() => {
        expect(screen.getByTestId('audit-row-log_sub_1092')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/Search by actor ID, name, email/i);
      fireEvent.change(searchInput, { target: { value: 'NonExistentSearchMatchXYZ123' } });

      expect(screen.getByTestId('empty-audit-logs')).toBeInTheDocument();
      expect(screen.getByText(/No Audit Records Found/i)).toBeInTheDocument();
    });
  });

  describe('Diff Inspector Modal', () => {
    it('opens and closes metadata diff inspector modal when clicking Inspect Diff button', async () => {
      render(<SubscriptionAuditLogView onNavigate={onNavigateMock} />);

      await waitFor(() => {
        expect(screen.getByTestId('audit-row-log_sub_1092')).toBeInTheDocument();
      });

      const inspectBtn = screen.getByLabelText('Inspect diff for event log_sub_1092');
      fireEvent.click(inspectBtn);

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Immutable Audit Trail Record')).toBeInTheDocument();
      expect(screen.getByText(/Previous State \(Before\)/i)).toBeInTheDocument();
      expect(screen.getByText(/New State \(After\)/i)).toBeInTheDocument();

      // Close modal
      const closeBtn = screen.getByRole('button', { name: /Close Inspector/i });
      fireEvent.click(closeBtn);

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  describe('Export Functionality', () => {
    it('navigates back to the subscription command hub when clicking the Command Hub header button', async () => {
      const handleNavigate = vi.fn();
      render(
        <SubscriptionAuditLogView
          userRole="super_admin"
          onNavigate={handleNavigate}
        />,
      );

      await waitFor(() => {
        expect(screen.getByTestId('subscription-audit-log-view')).toBeInTheDocument();
      });

      const backBtn = screen.getByTestId('back-to-hub-btn');
      expect(backBtn).toBeInTheDocument();
      fireEvent.click(backBtn);

      expect(handleNavigate).toHaveBeenCalledWith('subscription-system-hub');
    });

    it('exports audit logs as JSON and CSV', async () => {
      const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

      render(<SubscriptionAuditLogView onNavigate={onNavigateMock} />);

      await waitFor(() => {
        expect(screen.getByTestId('audit-row-log_sub_1092')).toBeInTheDocument();
      });

      // JSON Export
      const jsonBtn = screen.getByRole('button', { name: /JSON/i });
      fireEvent.click(jsonBtn);
      expect(clickSpy).toHaveBeenCalled();
      expect(screen.getByText(/Audit ledger exported to JSON/i)).toBeInTheDocument();

      // CSV Export
      const csvBtn = screen.getByRole('button', { name: /Export CSV/i });
      fireEvent.click(csvBtn);
      expect(clickSpy).toHaveBeenCalledTimes(2);

      clickSpy.mockRestore();
    });
  });

  describe('Immutable Logging Mechanism', () => {
    it('records an immutable entry upon status modification with mandatory reason notes', async () => {
      const recorded = await recordSubscriptionAuditLog({
        action_type: 'SUBSCRIPTION_STATUS_CHANGED',
        target_type: 'COMPANY_SUBSCRIPTION',
        target_id: 10,
        company_id: 10,
        company_name: 'Bella Vista Gourmet',
        actor_role: 'saasadmin',
        actor_user_id: 42,
        previous_value: { status: 'ACTIVE' },
        new_value: { status: 'SUSPENDED' },
        reason_notes: 'Administrative test suspension for compliance review.',
      });

      expect(recorded.id).toBeDefined();
      expect(recorded.ledger_hash).toBeDefined();
      expect(recorded.action_type).toBe('SUBSCRIPTION_STATUS_CHANGED');
      expect(recorded.reason_notes).toBe('Administrative test suspension for compliance review.');

      const stored = getStoredAuditLogs();
      expect(stored[0].id).toBe(recorded.id);
    });

    it('records an immutable entry upon plan-application matrix update', async () => {
      const recorded = await recordSubscriptionAuditLog({
        action_type: 'PLAN_MAPPING_UPDATED',
        target_type: 'PLAN_APPLICATION',
        target_id: 101,
        actor_role: 'superadmin',
        actor_user_id: 1,
        previous_value: { linked: false },
        new_value: { linked: true },
        reason_notes: 'Associated POS Core application to tier 1.',
      });

      expect(recorded.action_type).toBe('PLAN_MAPPING_UPDATED');
      expect(recorded.target_type).toBe('PLAN_APPLICATION');
      expect(recorded.new_value).toEqual({ linked: true });
    });
  });
});

