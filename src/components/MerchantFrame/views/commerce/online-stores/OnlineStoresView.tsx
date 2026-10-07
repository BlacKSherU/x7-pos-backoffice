import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { getAccessToken, clearAuthSession } from '../../../../../lib/auth-storage';
import { OnlineStoreModal, type OnlineStoreFormData } from './OnlineStoreModal';
import { AppModal, ModalFormFooter } from '../../../shared/AppModal';
import {
  TableOptionsMenu,
  TablePaginationFooter,
  TableEmptyState,
  NoColumnsEmptyState,
  type TableDensity,
} from '../../../../shared/TableOptionsMenu';
import { getDensityPadding } from '../../../../shared/tableOptionsHelpers';

export interface OnlineStoreItem {
  id: number;
  merchant_id: number;
  merchantId?: number;
  subdomain: string;
  is_active: boolean;
  isActive?: boolean;
  theme: string;
  currency: string;
  timezone: string;
  status: 'active' | 'deleted';
  created_at: string;
  createdAt?: string;
  updated_at: string;
  updatedAt?: string;
  merchant?: {
    id: number;
    name: string;
    rut?: string;
  };
}

interface OnlineStoresViewProps {
  onNavigate?: (view: string) => void;
}

export const OnlineStoresView: React.FC<OnlineStoresViewProps> = () => {
  const [stores, setStores] = useState<OnlineStoreItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Views
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');

  // Table options & pagination
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({
    storeId: true,
    subdomain: true,
    merchant: true,
    theme: true,
    localization: true,
    status: true,
    timestamps: true,
    actions: true,
  });
  const [rowDensity, setRowDensity] = useState<TableDensity>('comfortable');
  const [pageSize, setPageSize] = useState<number>(5);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editingStore, setEditingStore] = useState<OnlineStoreFormData | null>(null);

  // Delete Confirmation Modal
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState<boolean>(false);
  const [storeToDelete, setStoreToDelete] = useState<OnlineStoreItem | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Quick feedback toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Auto-refresh state (identical to Event Log)
  const [autoRefreshInterval, setAutoRefreshInterval] = useState<number>(10);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(() => new Date());

  const API_BASE = import.meta.env.VITE_API_URL ?? '/api';

  const fetchStores = useCallback(async (silent: boolean = false) => {
    try {
      if (!silent) setIsLoading(true);
      setIsRefreshing(true);
      setError(null);
      const token = getAccessToken();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };

      const res = await fetch(`${API_BASE}/online-stores?limit=100`, { headers });

      if (res.status === 401) {
        clearAuthSession();
        window.location.assign('/login');
        return;
      }

      if (!res.ok) {
        throw new Error(`Failed to load online stores (${res.status})`);
      }

      const json = await res.json();
      const rawList: Record<string, unknown>[] = Array.isArray(json)
        ? json
        : (json.data || json.items || []);
      const list: OnlineStoreItem[] = rawList.map((item) => ({
        id: Number(item.id),
        merchant_id: Number(item.merchant_id ?? item.merchantId ?? (item.merchant as { id?: number })?.id ?? 0),
        merchantId: Number(item.merchantId ?? item.merchant_id ?? 0),
        subdomain: String(item.subdomain || ''),
        is_active: item.is_active !== undefined ? Boolean(item.is_active) : (item.isActive !== undefined ? Boolean(item.isActive) : true),
        isActive: item.isActive !== undefined ? Boolean(item.isActive) : (item.is_active !== undefined ? Boolean(item.is_active) : true),
        theme: String(item.theme || 'default'),
        currency: String(item.currency || 'USD'),
        timezone: String(item.timezone || 'America/New_York'),
        status: (item.status as 'active' | 'deleted') || 'active',
        created_at: String(item.created_at || item.createdAt || ''),
        createdAt: String(item.createdAt || item.created_at || ''),
        updated_at: String(item.updated_at || item.updatedAt || ''),
        updatedAt: String(item.updatedAt || item.updated_at || ''),
        merchant: item.merchant as OnlineStoreItem['merchant'],
      }));
      setStores(list);
      setLastUpdated(new Date());
    } catch (err: unknown) {
      console.warn('Error fetching online stores:', err);
      const msg = err instanceof Error ? err.message : 'Error fetching online stores';
      setError(msg);
      if (!silent) showToast(msg);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [API_BASE]);

  useEffect(() => {
    void Promise.resolve().then(() => {
      void fetchStores();
    });
  }, [fetchStores]);

  // Auto-refresh timer (Event Log pattern)
  useEffect(() => {
    if (autoRefreshInterval <= 0) return;
    const interval = setInterval(() => {
      void fetchStores(true);
    }, autoRefreshInterval * 1000);
    return () => clearInterval(interval);
  }, [autoRefreshInterval, fetchStores]);

  // Handle Save (Create or Edit)
  const handleSaveStore = async (formData: OnlineStoreFormData) => {
    const token = getAccessToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };

    if (modalMode === 'create') {
      const res = await fetch(`${API_BASE}/online-stores`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          subdomain: formData.subdomain,
          theme: formData.theme,
          currency: formData.currency,
          timezone: formData.timezone,
          is_active: formData.is_active,
        }),
      });

      if (!res.ok) {
        const errorJson = await res.json().catch(() => ({}));
        const msg = errorJson.message || `Failed to create online store (${res.status})`;
        throw new Error(Array.isArray(msg) ? msg.join(', ') : msg);
      }

      showToast(`Storefront '${formData.subdomain}' provisioned successfully!`);
    } else if (modalMode === 'edit' && formData.id) {
      const res = await fetch(`${API_BASE}/online-stores/${formData.id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          subdomain: formData.subdomain,
          theme: formData.theme,
          currency: formData.currency,
          timezone: formData.timezone,
          isActive: formData.is_active,
        }),
      });

      if (!res.ok) {
        const errorJson = await res.json().catch(() => ({}));
        const msg = errorJson.message || `Failed to update online store (${res.status})`;
        throw new Error(Array.isArray(msg) ? msg.join(', ') : msg);
      }

      showToast(`Storefront #${formData.id} updated successfully!`);
    }

    await fetchStores();
  };

  // Toggle active availability
  const handleToggleActive = async (store: OnlineStoreItem) => {
    try {
      const token = getAccessToken();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };

      const newActive = !store.is_active;
      const res = await fetch(`${API_BASE}/online-stores/${store.id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ isActive: newActive }),
      });

      if (!res.ok) {
        throw new Error('Failed to toggle status');
      }

      // Optimistic state update
      setStores((prev) =>
        prev.map((s) => (s.id === store.id ? { ...s, is_active: newActive } : s))
      );

      showToast(
        newActive
          ? `Store #${store.id} is now Published (Live)`
          : `Store #${store.id} set to Maintenance mode`
      );
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Error updating store status');
      void fetchStores();
    }
  };

  // Delete / Archive Store
  const handleConfirmDelete = async () => {
    if (!storeToDelete) return;
    try {
      setIsDeleting(true);
      const token = getAccessToken();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };

      const res = await fetch(`${API_BASE}/online-stores/${storeToDelete.id}`, {
        method: 'DELETE',
        headers,
      });

      if (!res.ok) {
        throw new Error('Failed to archive online store');
      }

      showToast(`Store #${storeToDelete.id} archived successfully`);
      setIsDeleteModalOpen(false);
      setStoreToDelete(null);
      await fetchStores();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Error deleting store');
    } finally {
      setIsDeleting(false);
    }
  };

  // Copy live URL to clipboard
  const handleCopyUrl = (subdomain: string) => {
    const url = `https://${subdomain}.x7pos.com`;
    navigator.clipboard.writeText(url);
    showToast(`Copied ${url} to clipboard!`);
  };

  // Filtered store list
  const filteredStores = useMemo(() => {
    return stores.filter((st) => {
      // Query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchSubdomain = st.subdomain.toLowerCase().includes(q);
        const matchTheme = st.theme.toLowerCase().includes(q);
        const matchMerchant = st.merchant?.name?.toLowerCase().includes(q) || false;
        const matchId = String(st.id).includes(q);
        if (!matchSubdomain && !matchTheme && !matchMerchant && !matchId) {
          return false;
        }
      }

      // Status filter
      if (statusFilter === 'Published') {
        return st.is_active && st.status === 'active';
      }
      if (statusFilter === 'Maintenance') {
        return !st.is_active && st.status === 'active';
      }
      if (statusFilter === 'Archived') {
        return st.status === 'deleted';
      }

      return true;
    });
  }, [stores, searchQuery, statusFilter]);

  // Paginated list
  const totalItems = filteredStores.length;
  const paginatedStores = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredStores.slice(start, start + pageSize);
  }, [filteredStores, currentPage, pageSize]);

  // KPI Computations
  const totalProvisioned = stores.length;
  const publishedCount = stores.filter((s) => s.is_active && s.status === 'active').length;
  const maintenanceCount = stores.filter((s) => !s.is_active && s.status === 'active').length;
  const archivedCount = stores.filter((s) => s.status === 'deleted').length;

  // Action menu handlers for TableOptionsMenu
  const handleExportCSV = () => {
    if (!filteredStores || filteredStores.length === 0) return;
    const headers = ['ID', 'Subdomain', 'Live URL', 'Merchant', 'Theme', 'Currency', 'Timezone', 'Status'];
    const rows = filteredStores.map((s) => [
      s.id,
      `"${(s.subdomain || '').replace(/"/g, '""')}"`,
      `"https://${s.subdomain}.x7pos.com"`,
      `"${(s.merchant?.name || `Merchant #${s.merchant_id}`).replace(/"/g, '""')}"`,
      `"${(s.theme || '').replace(/"/g, '""')}"`,
      s.currency,
      s.timezone,
      s.status === 'deleted' ? 'Archived' : s.is_active ? 'Published' : 'Maintenance',
    ]);
    const csvContent =
      'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `online_stores_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrintTable = () => {
    window.print();
  };

  const handleCopySummary = () => {
    if (!filteredStores || filteredStores.length === 0) return;
    const text = filteredStores
      .map(
        (s) =>
          `#${s.id} ${s.subdomain}.x7pos.com (${s.theme}) - [${
            s.status === 'deleted' ? 'ARCHIVED' : s.is_active ? 'PUBLISHED' : 'MAINTENANCE'
          }]`
      )
      .join('\n');
    navigator.clipboard.writeText(text);
    showToast('Storefront directory list copied to clipboard!');
  };

  const densityPadding = getDensityPadding(rowDensity);
  const dataColumnsCount =
    (visibleColumns.storeId ? 1 : 0) +
    (visibleColumns.subdomain ? 1 : 0) +
    (visibleColumns.merchant ? 1 : 0) +
    (visibleColumns.theme ? 1 : 0) +
    (visibleColumns.localization ? 1 : 0) +
    (visibleColumns.status ? 1 : 0) +
    (visibleColumns.timestamps ? 1 : 0) +
    (visibleColumns.actions ? 1 : 0);
  const activeColSpan = Math.max(1, dataColumnsCount);

  return (
    <div className="flex flex-col gap-6 animate-fade-in text-left font-sans">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-3 bg-[#1d1c17] text-white rounded-xl shadow-2xl border border-zinc-700 flex items-center gap-3 text-xs font-semibold animate-slide-in">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 1. Header Card Workspace */}
      <div className="bg-white border border-[#e8e2d8] p-6 shadow-xs rounded">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-[#ae001a] tracking-wider uppercase mb-1">
            <span className="material-symbols-outlined text-lg">storefront</span>
            <span>Commerce / Online Ordering / Online Stores</span>
          </div>
          <h1 className="text-2xl font-black text-[#1d1c17] tracking-tight uppercase">
            Online Stores Workspace
          </h1>
          <p className="text-body-sm text-[#5f5e5e] mt-1 max-w-3xl">
            Provision storefront tenants, map custom subdomains, configure visual themes, and manage regional localization.
          </p>
        </div>
      </div>

      {/* 2. Hero KPIs Strip (4 Cards strictly in 1 single horizontal row) */}
      <div className="grid grid-cols-4 gap-3 w-full">
        {/* KPI 1: Total Storefronts */}
        <div className="bg-[#222222] hover:bg-[#2c2b25] text-white p-3.5 rounded-lg border-t-4 border-t-blue-500 shadow-xs flex flex-col justify-between h-28 group transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 group-hover:text-white transition-colors">
              Total Storefronts
            </span>
            <div className="w-7 h-7 rounded bg-blue-500/20 text-blue-400 flex items-center justify-center">
              <span className="material-symbols-outlined text-base">storefront</span>
            </div>
          </div>
          <div>
            <p className="text-2xl sm:text-3xl font-black text-white leading-none">
              {isLoading ? '...' : totalProvisioned}
            </p>
            <p className="text-[10px] text-zinc-400 mt-1 font-medium truncate">
              Multi-tenant ordering channels
            </p>
          </div>
        </div>

        {/* KPI 2: Live & Published */}
        <div className="bg-[#222222] hover:bg-[#2c2b25] text-white p-3.5 rounded-lg border-t-4 border-t-emerald-500 shadow-xs flex flex-col justify-between h-28 group transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 group-hover:text-white transition-colors">
              Published & Live
            </span>
            <div className="w-7 h-7 rounded bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <span className="material-symbols-outlined text-base">check_circle</span>
            </div>
          </div>
          <div>
            <p className="text-2xl sm:text-3xl font-black text-emerald-400 leading-none">
              {isLoading ? '...' : publishedCount}
            </p>
            <p className="text-[10px] text-zinc-400 mt-1 font-medium truncate">
              Publicly taking live orders
            </p>
          </div>
        </div>

        {/* KPI 3: Store Maintenance */}
        <div className="bg-[#222222] hover:bg-[#2c2b25] text-white p-3.5 rounded-lg border-t-4 border-t-amber-500 shadow-xs flex flex-col justify-between h-28 group transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 group-hover:text-white transition-colors">
              Store Maintenance
            </span>
            <div className="w-7 h-7 rounded bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <span className="material-symbols-outlined text-base">construction</span>
            </div>
          </div>
          <div>
            <p className="text-2xl sm:text-3xl font-black text-amber-400 leading-none">
              {isLoading ? '...' : maintenanceCount}
            </p>
            <p className="text-[10px] text-zinc-400 mt-1 font-medium truncate">
              Private / Under review
            </p>
          </div>
        </div>

        {/* KPI 4: Infrastructure & Archival */}
        <div className="bg-[#222222] hover:bg-[#2c2b25] text-white p-3.5 rounded-lg border-t-4 border-t-purple-500 shadow-xs flex flex-col justify-between h-28 group transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 group-hover:text-white transition-colors">
              DNS Routing
            </span>
            <div className="w-7 h-7 rounded bg-purple-500/20 text-purple-400 flex items-center justify-center">
              <span className="material-symbols-outlined text-base">dns</span>
            </div>
          </div>
          <div>
            <p className="text-2xl sm:text-3xl font-black text-white leading-none">
              *.x7pos.com
            </p>
            <p className="text-[10px] text-zinc-400 mt-1 font-medium truncate">
              {archivedCount > 0 ? `${archivedCount} archived tenants` : 'Tenant isolation active'}
            </p>
          </div>
        </div>
      </div>

      {/* 3. Unified Multi-Dimensional Filter Bar Controls (Event Log Standard Pattern) */}
      <div className="bg-white border border-[#e8e2d8] rounded-xl p-4 sm:p-5 shadow-sm flex flex-col gap-3.5">
        {/* ROW 1: Search, View Mode Switcher, Auto-Refresh & Updated Timestamp */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
            {/* Search Input con estilo canónico Event Log */}
            <div className="relative flex-1 min-w-[240px] max-w-md">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-lg text-[#5f5e5e]">
                search
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search by subdomain, merchant name, theme or #STR-ID..."
                className="h-[34px] w-full pl-9 pr-8 text-xs rounded-lg border border-[#d5cfc4] focus:outline-none focus:border-[#ae001a] bg-[#fcfcfb] text-[#1d1c17] placeholder:text-[#8c857b] transition-colors duration-200"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setCurrentPage(1);
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[#5f5e5e] hover:text-[#ae001a] transition-colors duration-200 cursor-pointer"
                  title="Clear search"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Right Toolbar: View Mode Switcher, Auto-Refresh Widget & Updated */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* View Switcher Toggle (Exact KDS Canonical Pattern) */}
            <div className="flex items-center h-[34px] bg-[#f2ede5] p-0.5 rounded-lg border border-[#e8e2d8] shrink-0">
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`h-full px-3 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  viewMode === 'table'
                    ? 'bg-white text-[#1d1c17] shadow-xs border border-[#e8e2d8]'
                    : 'text-[#5f5e5e] hover:text-[#ae001a]'
                }`}
                title="Storefront Table View"
              >
                <span className={`material-symbols-outlined text-[16px] ${viewMode === 'table' ? 'text-[#ae001a]' : ''}`}>table_rows</span>
                Table
              </button>
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                className={`h-full px-3 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  viewMode === 'cards'
                    ? 'bg-white text-[#1d1c17] shadow-xs border border-[#e8e2d8]'
                    : 'text-[#5f5e5e] hover:text-[#ae001a]'
                }`}
                title="Storefront Card Grid View"
              >
                <span className={`material-symbols-outlined text-[16px] ${viewMode === 'cards' ? 'text-[#ae001a]' : ''}`}>grid_view</span>
                Cards
              </button>
            </div>

            {/* Widget Canónico de Auto-Refresh ("el auto") */}
            <div className="flex items-center h-[34px] px-2.5 rounded-lg border border-[#d5cfc4] bg-[#fcfcfb] gap-1.5 text-xs text-[#5f5e5e] shrink-0">
              <button
                type="button"
                onClick={() => void fetchStores(false)}
                disabled={isLoading || isRefreshing}
                className="text-[#5f5e5e] hover:text-[#ae001a] transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center"
                title="Sync now"
              >
                <span className={`material-symbols-outlined text-sm ${isRefreshing ? 'animate-spin text-[#ae001a]' : ''}`}>
                  sync
                </span>
              </button>
              <select
                value={autoRefreshInterval}
                onChange={(e) => setAutoRefreshInterval(Number(e.target.value))}
                className="bg-transparent text-[11px] font-semibold text-[#1d1c17] focus:outline-none cursor-pointer h-full"
              >
                <option value={0}>Auto: Off</option>
                <option value={5}>Auto: 5s</option>
                <option value={10}>Auto: 10s</option>
                <option value={30}>Auto: 30s</option>
                <option value={60}>Auto: 60s</option>
              </select>
            </div>

            {/* Timestamp de última actualización */}
            <div className="hidden sm:flex items-center h-[34px] gap-1 text-[11px] text-[#5f5e5e] pl-1 shrink-0">
              <span className="material-symbols-outlined text-sm">schedule</span>
              <span>Updated:</span>
              <span className="font-mono font-bold text-[#1d1c17]">{lastUpdated.toLocaleTimeString()}</span>
            </div>

          </div>
        </div>

        {/* ROW 2: STATUS Multi-Select Pills & Provision Storefront Action */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2.5 border-t border-[#f0ede6]">
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-none [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            <span className="text-[9.5px] font-bold uppercase tracking-wider text-[#5f5e5e] shrink-0 mr-0.5">
            Status:
          </span>

          {/* All Pill */}
          <button
            type="button"
            onClick={() => {
              setStatusFilter('All');
              setCurrentPage(1);
            }}
            className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold transition-all duration-200 cursor-pointer whitespace-nowrap shrink-0 border ${
              statusFilter === 'All'
                ? 'bg-[#1d1c17] text-white border-[#1d1c17] shadow-xs'
                : 'bg-white text-[#5f5e5e] border-[#d5cfc4] hover:bg-[#fcfcfb] hover:text-[#ae001a]'
            }`}
          >
            <span>All</span>
            <span
              className={`text-[8.5px] px-1 py-0 rounded-full font-bold ${
                statusFilter === 'All' ? 'bg-white/20 text-white' : 'bg-zinc-100 text-[#5f5e5e]'
              }`}
            >
              {totalProvisioned}
            </span>
          </button>

          {/* Published Pill (Icon: check_circle) */}
          <button
            type="button"
            onClick={() => {
              setStatusFilter(statusFilter === 'Published' ? 'All' : 'Published');
              setCurrentPage(1);
            }}
            className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold transition-all duration-200 cursor-pointer whitespace-nowrap shrink-0 border ${
              statusFilter === 'Published'
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                : 'bg-emerald-50/50 text-emerald-800 border-emerald-200 hover:bg-emerald-100/50 hover:text-emerald-900'
            }`}
          >
            <span className="material-symbols-outlined text-[12px]">check_circle</span>
            <span>PUBLISHED</span>
            <span
              className={`text-[8.5px] px-1 py-0 rounded-full font-bold ${
                statusFilter === 'Published' ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-800'
              }`}
            >
              {publishedCount}
            </span>
          </button>

          {/* Maintenance Pill (Icon: construction) */}
          <button
            type="button"
            onClick={() => {
              setStatusFilter(statusFilter === 'Maintenance' ? 'All' : 'Maintenance');
              setCurrentPage(1);
            }}
            className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold transition-all duration-200 cursor-pointer whitespace-nowrap shrink-0 border ${
              statusFilter === 'Maintenance'
                ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                : 'bg-amber-50/50 text-amber-800 border-amber-200 hover:bg-amber-100/50 hover:text-amber-900'
            }`}
          >
            <span className="material-symbols-outlined text-[12px]">construction</span>
            <span>MAINTENANCE</span>
            <span
              className={`text-[8.5px] px-1 py-0 rounded-full font-bold ${
                statusFilter === 'Maintenance' ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-800'
              }`}
            >
              {maintenanceCount}
            </span>
          </button>

          {/* Archived Pill (Icon: cancel) */}
          <button
            type="button"
            onClick={() => {
              setStatusFilter(statusFilter === 'Archived' ? 'All' : 'Archived');
              setCurrentPage(1);
            }}
            className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold transition-all duration-200 cursor-pointer whitespace-nowrap shrink-0 border ${
              statusFilter === 'Archived'
                ? 'bg-[#ae001a] text-white border-[#ae001a] shadow-xs'
                : 'bg-red-50 text-[#ae001a] border-red-200 hover:bg-red-100/60 hover:text-[#900015]'
            }`}
          >
            <span className="material-symbols-outlined text-[12px]">cancel</span>
            <span>ARCHIVED</span>
            <span
              className={`text-[8.5px] px-1 py-0 rounded-full font-bold ${
                statusFilter === 'Archived' ? 'bg-white/20 text-white' : 'bg-red-100 text-[#ae001a]'
              }`}
            >
              {archivedCount}
            </span>
          </button>

          {/* Clear Filter / Reset */}
          {(statusFilter !== 'All' || searchQuery) && (
            <button
              type="button"
              onClick={() => {
                setStatusFilter('All');
                setSearchQuery('');
                setCurrentPage(1);
              }}
              className="text-[9.5px] font-bold text-[#5f5e5e] hover:text-[#ae001a] transition-colors ml-1 shrink-0 cursor-pointer flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-[12px]">filter_alt_off</span>
              <span>Clear</span>
            </button>
          )}
          </div>

          {/* Primary Action Button: Provision Storefront (al nivel de status, exact ProductsView design) */}
          <button
            type="button"
            onClick={() => {
              setModalMode('create');
              setEditingStore(null);
              setIsModalOpen(true);
            }}
            className="bg-[#ae001a] text-white font-bold text-label-caps px-6 py-2.5 rounded hover:bg-[#d2272f] transition-colors flex items-center gap-2 font-sans cursor-pointer shrink-0 ml-auto"
            title="Provision new storefront tenant"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            PROVISION STOREFRONT
          </button>
        </div>
      </div>

      {/* Main Content Area (Table View vs Cards Grid View) */}
      {viewMode === 'table' ? (
        /* TABLE VIEW (Standard layout based on ProductsView) */
        <div className="bg-white border border-[#e8e2d8] overflow-hidden rounded shadow-sm">
          {/* Dark Header #222222 with Full Options Dropdown Menu */}
          <div className="p-4 bg-[#222222] flex justify-between items-center relative">
            <div className="flex items-center gap-3">
              <span className="text-label-caps font-bold text-white uppercase tracking-wider font-sans">
                ONLINE STORE DIRECTORY
              </span>
              <span className="text-[10px] font-mono font-bold bg-[#333333] text-zinc-300 px-2 py-0.5 rounded border border-[#444444]">
                {paginatedStores.length === filteredStores.length
                  ? `${filteredStores.length} store${filteredStores.length === 1 ? '' : 's'}`
                  : `${paginatedStores.length} / ${filteredStores.length} stores`}
              </span>
            </div>

            <TableOptionsMenu
              onExportCSV={handleExportCSV}
              onPrint={handlePrintTable}
              onCopySummary={handleCopySummary}
              onReload={() => void fetchStores()}
              columns={[
                { key: 'storeId', label: 'Store Badge' },
                { key: 'subdomain', label: 'Subdomain & Live URL' },
                { key: 'merchant', label: 'Merchant Context' },
                { key: 'theme', label: 'Visual Theme' },
                { key: 'localization', label: 'Regional Settings' },
                { key: 'status', label: 'Store Status' },
                { key: 'timestamps', label: 'Timestamps' },
                { key: 'actions', label: 'Actions' },
              ]}
              visibleColumns={visibleColumns}
              onToggleColumn={(key) =>
                setVisibleColumns((prev) => ({
                  ...prev,
                  [key]: !prev[key],
                }))
              }
              rowDensity={rowDensity}
              onChangeDensity={setRowDensity}
              totalItems={filteredStores.length}
              pageSize={pageSize}
              onChangePageSize={(size) => {
                setPageSize(size);
                setCurrentPage(1);
              }}
              currentPage={currentPage}
              onPageChange={setCurrentPage}
            />
          </div>

          {dataColumnsCount === 0 ? (
            <NoColumnsEmptyState />
          ) : (
            <div className="overflow-x-auto scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
              <table className="w-full table-fixed border-collapse font-sans text-xs">
                <thead className="bg-[#ece8e0] border-b border-[#e8e2d8]">
                  <tr>
                    {visibleColumns.storeId && (
                      <th className={`text-left text-label-caps font-semibold text-[#5f5e5e] font-sans text-xs ${densityPadding} whitespace-nowrap w-28 min-w-[95px]`}>
                        Store Badge
                      </th>
                    )}
                    {visibleColumns.subdomain && (
                      <th className={`text-left text-label-caps font-semibold text-[#5f5e5e] font-sans text-xs ${densityPadding} whitespace-nowrap w-auto min-w-[200px]`}>
                        Subdomain & Live URL
                      </th>
                    )}
                    {visibleColumns.merchant && (
                      <th className={`text-left text-label-caps font-semibold text-[#5f5e5e] font-sans text-xs ${densityPadding} whitespace-nowrap w-36 min-w-[125px]`}>
                        Merchant Context
                      </th>
                    )}
                    {visibleColumns.theme && (
                      <th className={`text-left text-label-caps font-semibold text-[#5f5e5e] font-sans text-xs ${densityPadding} whitespace-nowrap w-28 min-w-[95px]`}>
                        Visual Theme
                      </th>
                    )}
                    {visibleColumns.localization && (
                      <th className={`text-left text-label-caps font-semibold text-[#5f5e5e] font-sans text-xs ${densityPadding} whitespace-nowrap w-36 min-w-[125px]`}>
                        Regional Settings
                      </th>
                    )}
                    {visibleColumns.status && (
                      <th className={`text-center text-label-caps font-semibold text-[#5f5e5e] font-sans text-xs ${densityPadding} whitespace-nowrap w-28 min-w-[95px]`}>
                        Store Status
                      </th>
                    )}
                    {visibleColumns.timestamps && (
                      <th className={`text-left text-label-caps font-semibold text-[#5f5e5e] font-sans text-xs ${densityPadding} whitespace-nowrap w-32 min-w-[110px]`}>
                        Timestamps
                      </th>
                    )}
                    {visibleColumns.actions && (
                      <th className={`text-center text-label-caps font-semibold text-[#5f5e5e] font-sans text-xs ${densityPadding} whitespace-nowrap w-20 min-w-[70px]`}>
                        Actions
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e8e2d8] text-xs text-[#1d1c17]">
                  {isLoading ? (
                    <tr>
                      <td colSpan={activeColSpan} className="px-6 py-12 text-center text-secondary font-sans bg-white">
                        <span className="material-symbols-outlined animate-spin text-[#ae001a] text-4xl block mb-2 mx-auto select-none">
                          sync
                        </span>
                        <p className="text-secondary text-body-md mt-2 font-sans">Loading online storefronts...</p>
                      </td>
                    </tr>
                  ) : error ? (
                    <tr>
                      <td colSpan={activeColSpan} className="px-6 py-12 text-center text-[#ba1a1a] font-sans bg-white">
                        <span className="material-symbols-outlined text-[#ba1a1a] text-4xl block mb-2 mx-auto select-none">
                          error
                        </span>
                        <p className="font-bold">{error}</p>
                        <button
                          type="button"
                          onClick={() => void fetchStores()}
                          className="mt-4 px-4 py-2 bg-[#222222] text-white font-bold text-label-caps hover:bg-[#ae001a] transition-all font-sans cursor-pointer"
                        >
                          Retry Connection
                        </button>
                      </td>
                    </tr>
                  ) : stores.length === 0 ? (
                    <TableEmptyState
                      colSpan={activeColSpan}
                      icon="storefront"
                      title="No online stores found"
                      description="Click 'Provision Storefront' to deploy your first store tenant."
                    />
                  ) : filteredStores.length === 0 ? (
                    <TableEmptyState
                      colSpan={activeColSpan}
                      icon="storefront"
                      title="No online stores found"
                      description="No storefronts match your selected filter criteria."
                    />
                  ) : (
                    paginatedStores.map((store) => {
                      const isPublished = store.is_active && store.status === 'active';
                      const isMaintenance = !store.is_active && store.status === 'active';
                      const isArchived = store.status === 'deleted';

                      return (
                        <tr
                          key={store.id}
                          className="hover:bg-zinc-50/70 transition-colors group"
                        >
                          {/* Store Badge */}
                          {visibleColumns.storeId && (
                            <td className={`${densityPadding} whitespace-nowrap`}>
                              <span className="font-mono font-bold text-xs bg-zinc-100 text-zinc-800 border border-zinc-200 px-2 py-0.5 rounded shadow-2xs">
                                #STR-{store.id}
                              </span>
                            </td>
                          )}

                          {/* Subdomain & Live URL */}
                          {visibleColumns.subdomain && (
                            <td className={`${densityPadding} truncate`}>
                              <div className="flex flex-col min-w-0">
                                <span className="font-bold text-sm text-[#1d1c17] truncate block" title={store.subdomain}>
                                  {store.subdomain}
                                </span>
                                <div className="flex items-center gap-1.5 mt-0.5 text-zinc-500 font-mono text-[11px] whitespace-nowrap">
                                  <a
                                    href={`https://${store.subdomain}.x7pos.com`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-zinc-600 hover:text-[#ae001a] hover:underline flex items-center gap-1 truncate max-w-full"
                                    title={`https://${store.subdomain}.x7pos.com`}
                                  >
                                    <span className="truncate">https://{store.subdomain}.x7pos.com</span>
                                    <span className="material-symbols-outlined text-[13px] text-zinc-400 shrink-0">
                                      open_in_new
                                    </span>
                                  </a>
                                  <button
                                    type="button"
                                    onClick={() => handleCopyUrl(store.subdomain)}
                                    className="text-zinc-400 hover:text-zinc-700 cursor-pointer p-0.5 shrink-0"
                                    title="Copy live URL"
                                  >
                                    <span className="material-symbols-outlined text-[13px]">
                                      content_copy
                                    </span>
                                  </button>
                                </div>
                              </div>
                            </td>
                          )}

                          {/* Merchant Context */}
                          {visibleColumns.merchant && (
                            <td className={`${densityPadding} whitespace-nowrap`}>
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className="material-symbols-outlined text-zinc-400 text-sm shrink-0">
                                  business
                                </span>
                                <span className="font-medium text-xs text-zinc-800 truncate" title={store.merchant?.name || `Merchant #${store.merchant_id}`}>
                                  {store.merchant?.name || `Merchant #${store.merchant_id}`}
                                </span>
                              </div>
                            </td>
                          )}

                          {/* Theme Pill */}
                          {visibleColumns.theme && (
                            <td className={`${densityPadding} whitespace-nowrap`}>
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 capitalize">
                                <span className="material-symbols-outlined text-xs">palette</span>
                                <span>{store.theme || 'default'}</span>
                              </span>
                            </td>
                          )}

                          {/* Regional Settings: Currency & Timezone */}
                          {visibleColumns.localization && (
                            <td className={`${densityPadding} whitespace-nowrap`}>
                              <div className="flex flex-col gap-0.5">
                                <div className="flex items-center gap-1 text-[11px]">
                                  <span className="font-bold px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-800 border border-zinc-200 font-mono">
                                    {store.currency || 'USD'}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1 text-[10px] text-zinc-500 font-medium whitespace-nowrap" title={store.timezone || 'America/New_York'}>
                                  <span className="material-symbols-outlined text-[12px] text-zinc-400 shrink-0">
                                    schedule
                                  </span>
                                  <span className="truncate">{store.timezone || 'America/New_York'}</span>
                                </div>
                              </div>
                            </td>
                          )}

                          {/* Store Status Pills */}
                          {visibleColumns.status && (
                            <td className={`${densityPadding} text-center whitespace-nowrap`}>
                              {isPublished && (
                                <button
                                  type="button"
                                  onClick={() => void handleToggleActive(store)}
                                  className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-[#10b981]/15 text-[#065f46] border border-[#10b981]/30 hover:bg-[#10b981]/25 transition-all cursor-pointer"
                                  title="Published & live. Click to set Maintenance mode"
                                >
                                  <span className="w-1.5 h-1.5 rounded-full bg-[#10b981] animate-pulse shrink-0" />
                                  <span>Published</span>
                                </button>
                              )}
                              {isMaintenance && (
                                <button
                                  type="button"
                                  onClick={() => void handleToggleActive(store)}
                                  className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-[#f59e0b]/15 text-[#92400e] border border-[#f59e0b]/30 hover:bg-[#f59e0b]/25 transition-all cursor-pointer"
                                  title="Under maintenance. Click to publish live"
                                >
                                  <span className="w-1.5 h-1.5 rounded-full bg-[#f59e0b] shrink-0" />
                                  <span>Maintenance</span>
                                </button>
                              )}
                              {isArchived && (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-[#ef4444]/15 text-[#991b1b] border border-[#ef4444]/30">
                                  <span className="w-1.5 h-1.5 rounded-full bg-[#ef4444] shrink-0" />
                                  <span>Archived</span>
                                </span>
                              )}
                            </td>
                          )}

                          {/* Timestamps */}
                          {visibleColumns.timestamps && (
                            <td className={`${densityPadding} text-xs text-zinc-600 font-medium whitespace-nowrap`}>
                              <div className="flex flex-col gap-0.5 leading-tight">
                                <div className="text-[11px] text-zinc-800 font-medium flex items-center gap-1.5">
                                  <span className="text-zinc-400 font-normal text-[10px]">Created:</span>
                                  <span className="font-mono text-[10.5px]">
                                    {store.created_at || store.createdAt
                                      ? new Date(store.created_at || store.createdAt!).toLocaleDateString()
                                      : '—'}
                                  </span>
                                </div>
                                <div className="text-[10px] text-zinc-500 flex items-center gap-1.5">
                                  <span className="text-zinc-400 font-normal text-[10px]">Updated:</span>
                                  <span className="font-mono text-[10px]">
                                    {store.updated_at || store.updatedAt
                                      ? new Date(store.updated_at || store.updatedAt!).toLocaleDateString()
                                      : '—'}
                                  </span>
                                </div>
                              </div>
                            </td>
                          )}

                          {/* Actions */}
                          {visibleColumns.actions && (
                            <td className={`text-center whitespace-nowrap ${densityPadding}`}>
                              <div className="flex justify-center gap-2">

                                {/* Edit Button */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setModalMode('edit');
                                    setEditingStore({
                                      id: store.id,
                                      subdomain: store.subdomain,
                                      theme: store.theme,
                                      currency: store.currency,
                                      timezone: store.timezone,
                                      is_active: store.is_active,
                                    });
                                    setIsModalOpen(true);
                                  }}
                                  className="p-1 text-[#5f5e5e] hover:text-[#ae001a] transition-colors cursor-pointer"
                                  title="Edit storefront"
                                >
                                  <span className="material-symbols-outlined text-[20px]">edit</span>
                                </button>

                                {/* Delete / Archive Button */}
                                {!isArchived && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setStoreToDelete(store);
                                      setIsDeleteModalOpen(true);
                                    }}
                                    className="p-1 text-[#5f5e5e] hover:text-[#ae001a] transition-colors cursor-pointer"
                                    title="Archive storefront"
                                  >
                                    <span className="material-symbols-outlined text-[20px]">delete</span>
                                  </button>
                                )}
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })
              )}
            </tbody>
            </table>
          </div>
        )}

          {/* Pagination Footer */}
          <TablePaginationFooter
            totalItems={totalItems}
            currentPage={currentPage}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={(newSize) => {
              setPageSize(newSize);
              setCurrentPage(1);
            }}
          />
        </div>
      ) : (
        /* CARDS / GRID VIEW */
        isLoading ? (
          <div className="bg-white rounded border border-[#e8e2d8] p-12 text-center shadow-sm">
            <span className="material-symbols-outlined animate-spin text-[#ae001a] text-4xl block mb-2 mx-auto">
              sync
            </span>
            <p className="text-secondary text-body-md mt-2 font-sans">Loading online storefronts...</p>
          </div>
        ) : error ? (
          <div className="bg-white border border-[#e8e2d8] p-12 text-center rounded shadow-sm">
            <span className="material-symbols-outlined text-[#ba1a1a] text-4xl block mb-2 mx-auto">error</span>
            <p className="font-bold text-[#ba1a1a]">{error}</p>
            <button
              type="button"
              onClick={() => void fetchStores()}
              className="mt-4 px-4 py-2 bg-[#222222] text-white font-bold text-label-caps hover:bg-[#ae001a] transition-all font-sans cursor-pointer"
            >
              Retry Connection
            </button>
          </div>
        ) : filteredStores.length === 0 ? (
          <div className="bg-white rounded border border-[#e8e2d8] p-12 text-center shadow-sm">
            <div className="w-12 h-12 rounded-2xl bg-zinc-100 border border-zinc-200 text-zinc-400 flex items-center justify-center mx-auto mb-3">
              <span className="material-symbols-outlined text-2xl">storefront</span>
            </div>
            <h3 className="text-sm font-bold text-[#1d1c17] uppercase tracking-wide">
              No Online Stores Found
            </h3>
            <p className="text-xs text-[#5f5e5e] max-w-md mx-auto mt-1 mb-4">
              {searchQuery || statusFilter !== 'All'
                ? 'No storefronts match your current filter criteria. Clear filters to see all tenants.'
                : 'Provision your first storefront tenant to enable online ordering channels, custom subdomain routing, and visual themes.'}
            </p>
            {searchQuery || statusFilter !== 'All' ? (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('All');
                }}
                className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs font-bold rounded transition-colors cursor-pointer"
              >
                Clear Filters
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setModalMode('create');
                  setEditingStore(null);
                  setIsModalOpen(true);
                }}
                className="px-5 py-2.5 bg-[#ae001a] hover:bg-[#930015] text-white text-xs font-bold uppercase tracking-wider rounded shadow-md transition-colors cursor-pointer"
              >
                + Provision First Store
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {paginatedStores.map((store) => {
              const isPublished = store.is_active && store.status === 'active';
              const isMaintenance = !store.is_active && store.status === 'active';
              const isArchived = store.status === 'deleted';

              return (
                <div
                  key={store.id}
                  className="bg-white rounded-xl border border-[#e8e2d8] p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between group hover:border-[#ae001a]"
                >
                  <div>
                    {/* Card Header: Badge & Status */}
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-mono font-bold text-xs bg-zinc-100 text-zinc-800 border border-zinc-200 px-2 py-0.5 rounded shadow-2xs">
                        #STR-{store.id}
                      </span>

                      {/* Status Pill */}
                      {isPublished && (
                        <button
                          type="button"
                          onClick={() => void handleToggleActive(store)}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#10b981]/15 text-[#065f46] border border-[#10b981]/30 hover:bg-[#10b981]/25 transition-all cursor-pointer"
                          title="Published & live. Click to set Maintenance mode"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-[#10b981] animate-pulse" />
                          <span>Published</span>
                        </button>
                      )}
                      {isMaintenance && (
                        <button
                          type="button"
                          onClick={() => void handleToggleActive(store)}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#f59e0b]/15 text-[#92400e] border border-[#f59e0b]/30 hover:bg-[#f59e0b]/25 transition-all cursor-pointer"
                          title="Under maintenance. Click to publish live"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-[#f59e0b]" />
                          <span>Maintenance</span>
                        </button>
                      )}
                      {isArchived && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#ef4444]/15 text-[#991b1b] border border-[#ef4444]/30">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#ef4444]" />
                          <span>Archived</span>
                        </span>
                      )}
                    </div>

                    {/* Subdomain & URL Context */}
                    <h3 className="text-base font-black text-[#1d1c17] group-hover:text-[#ae001a] transition-colors flex items-center justify-between">
                      <span>{store.subdomain}</span>
                    </h3>

                    <div className="mt-1 p-2 rounded-lg bg-zinc-50 border border-zinc-200 text-xs font-mono text-zinc-600 flex items-center justify-between">
                      <a
                        href={`https://${store.subdomain}.x7pos.com`}
                        target="_blank"
                        rel="noreferrer"
                        className="truncate text-[#1d1c17] hover:text-[#ae001a] flex items-center gap-1"
                      >
                        <span className="truncate">https://{store.subdomain}.x7pos.com</span>
                        <span className="material-symbols-outlined text-xs text-zinc-400">open_in_new</span>
                      </a>
                      <button
                        type="button"
                        onClick={() => handleCopyUrl(store.subdomain)}
                        className="text-zinc-400 hover:text-zinc-700 cursor-pointer p-0.5 shrink-0"
                        title="Copy live URL"
                      >
                        <span className="material-symbols-outlined text-xs">content_copy</span>
                      </button>
                    </div>

                    {/* Meta Properties */}
                    <div className="mt-3.5 space-y-2 text-xs">
                      {/* Merchant */}
                      <div className="flex items-center justify-between text-zinc-600">
                        <span className="text-[11px] font-semibold text-zinc-400 uppercase">Merchant</span>
                        <span className="font-bold text-[#1d1c17]">
                          {store.merchant?.name || `Merchant #${store.merchant_id}`}
                        </span>
                      </div>

                      {/* Theme */}
                      <div className="flex items-center justify-between text-zinc-600">
                        <span className="text-[11px] font-semibold text-zinc-400 uppercase">Theme</span>
                        <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold capitalize text-[11px]">
                          {store.theme || 'default'}
                        </span>
                      </div>

                      {/* Currency & Timezone */}
                      <div className="flex items-center justify-between text-zinc-600">
                        <span className="text-[11px] font-semibold text-zinc-400 uppercase">Region</span>
                        <span className="font-mono text-xs font-bold text-zinc-800">
                          {store.currency || 'USD'} • {store.timezone || 'America/New_York'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Card Bottom Actions */}
                  <div className="mt-4 pt-3 border-t border-[#e8e2d8] flex items-center justify-between">
                    <span className="text-[10px] text-zinc-400 font-medium">
                      {store.created_at || store.createdAt
                        ? new Date(store.created_at || store.createdAt!).toLocaleDateString()
                        : '—'}
                    </span>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setModalMode('edit');
                          setEditingStore({
                            id: store.id,
                            subdomain: store.subdomain,
                            theme: store.theme,
                            currency: store.currency,
                            timezone: store.timezone,
                            is_active: store.is_active,
                          });
                          setIsModalOpen(true);
                        }}
                        className="p-1 rounded-md text-zinc-500 hover:text-[#ae001a] hover:bg-zinc-100 transition-colors cursor-pointer"
                        title="Edit storefront"
                      >
                        <span className="material-symbols-outlined text-base">edit</span>
                      </button>

                      {!isArchived && (
                        <button
                          type="button"
                          onClick={() => {
                            setStoreToDelete(store);
                            setIsDeleteModalOpen(true);
                          }}
                          className="p-1 rounded-md text-zinc-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                          title="Archive storefront"
                        >
                          <span className="material-symbols-outlined text-base">delete</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Cards Pagination */}
          <div className="bg-white rounded-xl border border-[#e8e2d8] p-3 shadow-xs">
            <TablePaginationFooter
              totalItems={totalItems}
              currentPage={currentPage}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={(newSize) => {
                setPageSize(newSize);
                setCurrentPage(1);
              }}
            />
          </div>
        </div>
      ))}

      {/* Creation and Edit Modal */}
      <OnlineStoreModal
        isOpen={isModalOpen}
        mode={modalMode}
        initialData={editingStore}
        onClose={() => {
          setIsModalOpen(false);
          setEditingStore(null);
        }}
        onSubmit={handleSaveStore}
      />

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && storeToDelete && (
        <AppModal
          title="Archive Online Storefront"
          subtitle={`#STR-${storeToDelete.id}`}
          size="md"
          onClose={() => {
            setIsDeleteModalOpen(false);
            setStoreToDelete(null);
          }}
          closeDisabled={isDeleting}
        >
          <div className="p-6 text-left space-y-4">
            <div className="w-12 h-12 rounded bg-red-50 text-red-600 flex items-center justify-center mx-auto">
              <span className="material-symbols-outlined text-2xl">delete_forever</span>
            </div>
            <p className="text-sm text-zinc-700 text-center leading-relaxed font-sans">
              Are you sure you want to archive storefront{' '}
              <strong className="text-[#1d1c17]">https://{storeToDelete.subdomain}.x7pos.com</strong> (#STR-
              {storeToDelete.id})? This will take the store offline and set its logical status to Archived.
            </p>
            <ModalFormFooter
              onCancel={() => {
                setIsDeleteModalOpen(false);
                setStoreToDelete(null);
              }}
              submitLabel={isDeleting ? 'Archiving...' : 'Confirm Archive'}
              isSubmitting={isDeleting}
              destructive
              onSubmit={handleConfirmDelete}
            />
          </div>
        </AppModal>
      )}
    </div>
  );
};

export default OnlineStoresView;
