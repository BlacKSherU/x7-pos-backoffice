import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { getAccessToken, clearAuthSession } from '@/platform/auth/lib/auth-storage';
import { API_BASE } from '@/shared/api/http';
import {
  OnlineOrderItemDetailsDrawer,
  type OnlineOrderItemData,
} from './OnlineOrderItemDetailsDrawer';
import {
  OnlineOrderItemSetupDrawer,
  type OnlineOrderItemFormData,
  type OnlineOrderOption,
  type InventoryProductOption,
  type InventoryVariantOption,
} from './OnlineOrderItemSetupDrawer';
import {
  TableOptionsMenu,
  TablePaginationFooter,
  TableEmptyState,
  NoColumnsEmptyState,
  type TableDensity,
} from '@/shared/components/TableOptionsMenu';

interface OnlineOrderItemsViewProps {
  onNavigate?: (view: string) => void;
}

type KitchenStatusFilter = 'all' | 'PENDING' | 'IN_PREPARATION' | 'READY' | 'SERVED';
type MappingFilter = 'all' | 'mapped' | 'unmapped';

export const OnlineOrderItemsView: React.FC<OnlineOrderItemsViewProps> = ({ onNavigate }) => {
  const [items, setItems] = useState<OnlineOrderItemData[]>([]);
  const [orders, setOrders] = useState<OnlineOrderOption[]>([]);
  const [products, setProducts] = useState<InventoryProductOption[]>([]);
  const [variants, setVariants] = useState<InventoryVariantOption[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshingSilently, setIsRefreshingSilently] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Filters & Views
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedOrderFilter, setSelectedOrderFilter] = useState<string>('all');
  const [selectedProductFilter, setSelectedProductFilter] = useState<string>('all');
  const [kitchenStatusFilter, setKitchenStatusFilter] = useState<KitchenStatusFilter>('all');
  const [mappingFilter, setMappingFilter] = useState<MappingFilter>('all');
  const [selectedStageStatuses, setSelectedStageStatuses] = useState<string[]>([]);
  const [showActiveStatus, setShowActiveStatus] = useState<boolean>(true);
  const [showDeletedStatus, setShowDeletedStatus] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'split' | 'table'>('split');

  // Auto-refresh controls
  const [autoRefreshInterval, setAutoRefreshInterval] = useState<number>(10);

  // Table options & pagination
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({
    lineId: true,
    order: true,
    product: true,
    qtyPrice: true,
    modifiersNotes: true,
    kitchenStatus: true,
    timestamps: true,
    actions: true,
  });
  const [rowDensity, setRowDensity] = useState<TableDensity>('comfortable');
  const [pageSize, setPageSize] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Detail Inspector Drawer
  const [selectedItem, setSelectedItem] = useState<OnlineOrderItemData | null>(null);
  const [isDetailDrawerOpen, setIsDetailDrawerOpen] = useState<boolean>(false);

  // Setup / Add / Edit Drawer
  const [isSetupDrawerOpen, setIsSetupDrawerOpen] = useState<boolean>(false);
  const [setupMode, setSetupMode] = useState<'create' | 'edit'>('create');
  const [itemToEdit, setItemToEdit] = useState<OnlineOrderItemData | null>(null);

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Fetch initial relational auxiliary datasets (Orders, Products, Variants)
  const fetchAuxiliaryData = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;

    try {
      const headers = {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      };

      const [ordersRes, productsRes, variantsRes] = await Promise.all([
        fetch(`${API_BASE}/online-orders?limit=100`, { headers }).catch(() => null),
        fetch(`${API_BASE}/products?limit=100`, { headers }).catch(() => null),
        fetch(`${API_BASE}/variants?limit=100`, { headers }).catch(() => null),
      ]);

      if (ordersRes && ordersRes.ok) {
        const ordersJson = await ordersRes.json();
        const ordersList = ordersJson?.data || ordersJson || [];
        setOrders(
          Array.isArray(ordersList)
            ? ordersList.map((o: { id: number; customer?: { name?: string }; store?: { subdomain?: string }; fulfillmentStatus?: string }) => ({
                id: o.id,
                customerName: o.customer?.name,
                storeName: o.store?.subdomain,
                fulfillmentStatus: o.fulfillmentStatus,
              }))
            : []
        );
      }

      if (productsRes && productsRes.ok) {
        const productsJson = await productsRes.json();
        const productsList = productsJson?.data || productsJson || [];
        setProducts(
          Array.isArray(productsList)
            ? productsList.map((p: { id: number; name: string; sku?: string; basePrice?: number | string }) => ({
                id: p.id,
                name: p.name,
                sku: p.sku,
                basePrice: typeof p.basePrice === 'number' ? p.basePrice : parseFloat(String(p.basePrice || 0)),
              }))
            : []
        );
      }

      if (variantsRes && variantsRes.ok) {
        const variantsJson = await variantsRes.json();
        const variantsList = variantsJson?.data || variantsJson || [];
        setVariants(
          Array.isArray(variantsList)
            ? variantsList.map((v: { id: number; productId?: number; product_id?: number; name: string; sku?: string; price?: number | string }) => ({
                id: v.id,
                productId: v.productId ?? v.product_id ?? 0,
                name: v.name,
                sku: v.sku,
                price: typeof v.price === 'number' ? v.price : parseFloat(String(v.price || 0)),
              }))
            : []
        );
      }
    } catch (err) {
      console.warn('Failed to load auxiliary options:', err);
    }
  }, []);

  // Fetch online order items
  const fetchItems = useCallback(
    async (silent = false) => {
      const token = getAccessToken();
      if (!token) {
        clearAuthSession();
        return;
      }

      if (silent) {
        setIsRefreshingSilently(true);
      } else {
        setIsLoading(true);
      }
      setError(null);

      try {
        const queryParams = new URLSearchParams({
          limit: '100',
          page: '1',
          status: 'all',
        });

        const res = await fetch(`${API_BASE}/online-order-items?${queryParams.toString()}`, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (res.status === 401) {
          clearAuthSession();
          return;
        }

        if (!res.ok) {
          throw new Error(`Server returned HTTP ${res.status}`);
        }

        const json = await res.json();
        const dataList: OnlineOrderItemData[] = Array.isArray(json?.data)
          ? json.data
          : Array.isArray(json)
          ? json
          : [];

        setItems(dataList);

        // Update selected item in detail drawer if open
        if (selectedItem) {
          const fresh = dataList.find((x) => x.id === selectedItem.id);
          if (fresh) setSelectedItem(fresh);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Error fetching online order items';
        if (!silent) setError(msg);
      } finally {
        if (silent) {
          setIsRefreshingSilently(false);
        } else {
          setIsLoading(false);
        }
      }
    },
    [selectedItem]
  );

  useEffect(() => {
    void fetchAuxiliaryData();
  }, [fetchAuxiliaryData]);

  useEffect(() => {
    void fetchItems(false);
  }, [fetchItems]);

  // Silent auto-refresh interval
  useEffect(() => {
    if (!autoRefreshInterval || autoRefreshInterval <= 0) return;
    const interval = setInterval(() => {
      void fetchItems(true);
    }, autoRefreshInterval * 1000);
    return () => clearInterval(interval);
  }, [autoRefreshInterval, fetchItems]);

  // Real-time synchronization event listeners from KDS
  useEffect(() => {
    const handleKdsEvent = () => {
      void fetchItems(true);
    };

    window.addEventListener('x7_kds_data_reset', handleKdsEvent);
    window.addEventListener('online_orders_refresh', handleKdsEvent);
    return () => {
      window.removeEventListener('x7_kds_data_reset', handleKdsEvent);
      window.removeEventListener('online_orders_refresh', handleKdsEvent);
    };
  }, [fetchItems]);

  // Stage multi-filter checklist toggle
  const handleToggleStageStatus = (statusKey: string) => {
    if (statusKey === 'ALL') {
      setSelectedStageStatuses([]);
      setCurrentPage(1);
      return;
    }
    setSelectedStageStatuses((prev) => {
      const exists = prev.includes(statusKey);
      if (exists) {
        return prev.filter((s) => s !== statusKey);
      } else {
        return [...prev, statusKey];
      }
    });
    setCurrentPage(1);
  };

  const hasActiveFilters = Boolean(
    searchQuery.trim() ||
    selectedOrderFilter !== 'all' ||
    selectedProductFilter !== 'all' ||
    kitchenStatusFilter !== 'all' ||
    mappingFilter !== 'all' ||
    selectedStageStatuses.length > 0 ||
    !showActiveStatus ||
    showDeletedStatus
  );

  const handleResetAllFilters = () => {
    setSearchQuery('');
    setSelectedOrderFilter('all');
    setSelectedProductFilter('all');
    setKitchenStatusFilter('all');
    setMappingFilter('all');
    setSelectedStageStatuses([]);
    setShowActiveStatus(true);
    setShowDeletedStatus(false);
    setCurrentPage(1);
  };

  // Filter items in memory
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // Logical status checkboxes filter (ACTIVE / DELETED)
      const isDeleted = item.status === 'deleted';
      if (isDeleted && !showDeletedStatus) return false;
      if (!isDeleted && !showActiveStatus) return false;

      // Mapping filter
      if (mappingFilter === 'mapped' && !item.orderItemId) return false;
      if (mappingFilter === 'unmapped' && item.orderItemId) return false;

      // Online order dropdown filter
      if (selectedOrderFilter !== 'all' && String(item.onlineOrderId) !== selectedOrderFilter) {
        return false;
      }

      // Product dropdown filter
      if (selectedProductFilter !== 'all' && String(item.productId) !== selectedProductFilter) {
        return false;
      }

      // Kitchen status dropdown filter
      if (kitchenStatusFilter !== 'all') {
        const itemStatus = (item.kitchenLineStatus || 'PENDING').toUpperCase();
        if (itemStatus !== kitchenStatusFilter) return false;
      }

      // Multi-stage pills filter
      if (selectedStageStatuses.length > 0) {
        const itemStatus = (item.kitchenLineStatus || 'PENDING').toUpperCase();
        if (!selectedStageStatuses.includes(itemStatus)) return false;
      }

      // Search query fallback
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const lineId = `#ori-${item.id}`.toLowerCase();
        const orderId = `#onl-${item.onlineOrderId}`.toLowerCase();
        const posId = item.orderItemId ? `#pos-item-${item.orderItemId}`.toLowerCase() : '';
        const rawPosId = item.orderItemId ? `#pos-${item.orderItemId}`.toLowerCase() : '';
        const prodName = (item.product?.name || '').toLowerCase();
        const variantName = (item.variant?.name || '').toLowerCase();
        const notes = (item.notes || '').toLowerCase();
        const modifiersStr = JSON.stringify(item.modifiers || {}).toLowerCase();
        const customerName = (orders.find((o) => o.id === item.onlineOrderId)?.customerName || '').toLowerCase();

        const matches =
          lineId.includes(query) ||
          orderId.includes(query) ||
          posId.includes(query) ||
          rawPosId.includes(query) ||
          prodName.includes(query) ||
          variantName.includes(query) ||
          notes.includes(query) ||
          modifiersStr.includes(query) ||
          customerName.includes(query) ||
          String(item.id).includes(query) ||
          String(item.onlineOrderId).includes(query);

        if (!matches) return false;
      }

      return true;
    });
  }, [
    items,
    showActiveStatus,
    showDeletedStatus,
    mappingFilter,
    selectedOrderFilter,
    selectedProductFilter,
    kitchenStatusFilter,
    selectedStageStatuses,
    searchQuery,
    orders,
  ]);

  // Operational KPI Calculations (strictly active line items)
  const activeItems = useMemo(() => items.filter((i) => i.status !== 'deleted'), [items]);
  const kpiTotal = activeItems.length;
  const kpiPending = activeItems.filter(
    (i) => (i.kitchenLineStatus || 'PENDING').toUpperCase() === 'PENDING'
  ).length;
  const kpiCooking = activeItems.filter(
    (i) => (i.kitchenLineStatus || '').toUpperCase() === 'IN_PREPARATION'
  ).length;
  const kpiReady = activeItems.filter(
    (i) => (i.kitchenLineStatus || '').toUpperCase() === 'READY'
  ).length;
  const kpiServed = activeItems.filter(
    (i) => (i.kitchenLineStatus || '').toUpperCase() === 'SERVED'
  ).length;
  const kpiMapped = activeItems.filter((i) => Boolean(i.orderItemId)).length;
  const kpiVoided = items.filter((i) => i.status === 'deleted').length;

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [filteredItems, currentPage, pageSize]);

  const formatCurrency = (val: number | string | undefined | null) => {
    const num = Number(val) || 0;
    return `$${num.toFixed(2)}`;
  };

  const formatTimestamp = (dateStr?: string | null) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return '—';
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
    } catch {
      return '—';
    }
  };

  // Handlers for Drawer Operations
  const handleOpenDetails = (item: OnlineOrderItemData) => {
    setSelectedItem(item);
    setIsDetailDrawerOpen(true);
  };

  const handleOpenCreate = () => {
    setItemToEdit(null);
    setSetupMode('create');
    setIsSetupDrawerOpen(true);
  };

  const handleOpenEdit = (item: OnlineOrderItemData) => {
    setItemToEdit(item);
    setSetupMode('edit');
    setIsSetupDrawerOpen(true);
  };

  // Update Kitchen Status Override
  const handleUpdateKitchenStatus = async (itemId: number, newStatus: string) => {
    const token = getAccessToken();
    if (!token) return;

    const res = await fetch(`${API_BASE}/online-order-items/${itemId}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ kitchenLineStatus: newStatus }),
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => null);
      throw new Error(errJson?.message || 'Failed to update kitchen line status');
    }

    showToast(`Updated Line #ORI-${itemId} kitchen status to ${newStatus.toUpperCase()}`);
    void fetchItems(true);
  };

  // Submit Add / Edit Line Item
  const handleSetupSubmit = async (formData: OnlineOrderItemFormData) => {
    const token = getAccessToken();
    if (!token) return;

    const isEdit = setupMode === 'edit' && formData.id;
    const url = isEdit
      ? `${API_BASE}/online-order-items/${formData.id}`
      : `${API_BASE}/online-order-items`;
    const method = isEdit ? 'PATCH' : 'POST';

    const payload: Record<string, unknown> = {
      onlineOrderId: formData.onlineOrderId,
      productId: formData.productId,
      variantId: formData.variantId || null,
      quantity: formData.quantity,
      modifiers: formData.modifiers || null,
      notes: formData.notes || null,
    };
    if (formData.kitchenLineStatus) {
      payload.kitchenLineStatus = formData.kitchenLineStatus;
    }
    if (formData.status) {
      payload.status = formData.status;
    }

    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => null);
      throw new Error(errJson?.message || `Failed to ${isEdit ? 'update' : 'create'} order line item`);
    }

    showToast(`Successfully ${isEdit ? 'updated' : 'added'} order item line`);
    void fetchItems(false);
  };

  // Void / Soft-Delete Line Item
  const handleDeleteItem = async (item: OnlineOrderItemData) => {
    if (!confirm(`Are you sure you want to void line item #ORI-${item.id}? This will remove it from active KDS kitchen screens while preserving historical records.`)) return;

    const token = getAccessToken();
    if (!token) return;

    try {
      const res = await fetch(`${API_BASE}/online-order-items/${item.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.message || 'Failed to void item');
      }

      showToast(`Line item #ORI-${item.id} voided and synced to KDS`);
      setIsDetailDrawerOpen(false);
      void fetchItems(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error voiding item';
      alert(msg);
    }
  };

  // Restore Voided Line Item
  const handleRestoreItem = async (item: OnlineOrderItemData) => {
    const token = getAccessToken();
    if (!token) return;

    try {
      const res = await fetch(`${API_BASE}/online-order-items/${item.id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'active' }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.message || 'Failed to restore line item');
      }

      showToast(`Line item #ORI-${item.id} restored to active queue`);
      setIsDetailDrawerOpen(false);
      void fetchItems(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error restoring item';
      alert(msg);
    }
  };

  // Export CSV
  const handleExportCsv = () => {
    if (filteredItems.length === 0) {
      showToast('No items to export');
      return;
    }

    const headers = [
      'Line ID',
      'Online Order ID',
      'POS Item ID',
      'Product Name',
      'Variant Name',
      'Quantity',
      'Unit Price',
      'Line Subtotal',
      'Kitchen Status',
      'Modifiers JSON',
      'Notes',
      'Status',
      'Created At',
      'Updated At',
    ];

    const rows = filteredItems.map((item) => [
      `#ORI-${item.id}`,
      `#ONL-${item.onlineOrderId}`,
      item.orderItemId ? `#POS-ITEM-${item.orderItemId}` : 'Unmapped',
      `"${(item.product?.name || `Product #${item.productId}`).replace(/"/g, '""')}"`,
      `"${(item.variant?.name || '').replace(/"/g, '""')}"`,
      item.quantity,
      item.unitPrice,
      (item.quantity * item.unitPrice).toFixed(2),
      item.kitchenLineStatus || 'PENDING',
      `"${JSON.stringify(item.modifiers || {}).replace(/"/g, '""')}"`,
      `"${(item.notes || '').replace(/"/g, '""')}"`,
      item.status,
      item.createdAt,
      item.updatedAt,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `online_order_items_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Exported online order items to CSV');
  };

  // Copy Summary
  const handleCopySummary = () => {
    if (filteredItems.length === 0) return;
    const summary = filteredItems
      .map(
        (i) =>
          `#ORI-${i.id} [${i.orderItemId ? `#POS-${i.orderItemId}` : 'Web-Only'}] | Order #ONL-${i.onlineOrderId} | ${i.quantity}x ${i.product?.name || 'Product'} | Stage: ${i.kitchenLineStatus || 'PENDING'}`
      )
      .join('\n');
    navigator.clipboard.writeText(summary);
    showToast('Copied summary of order items to clipboard');
  };

  const densityPadding =
    rowDensity === 'compact'
      ? 'py-2 px-2'
      : rowDensity === 'spacious'
      ? 'py-4 px-3.5'
      : 'py-2.5 px-2.5';

  const activeColumnsCount =
    (visibleColumns.lineId ? 1 : 0) +
    (visibleColumns.order ? 1 : 0) +
    (visibleColumns.product ? 1 : 0) +
    (visibleColumns.qtyPrice ? 1 : 0) +
    (visibleColumns.modifiersNotes ? 1 : 0) +
    (visibleColumns.kitchenStatus ? 1 : 0) +
    (visibleColumns.timestamps ? 1 : 0) +
    (visibleColumns.actions ? 1 : 0);

  return (
    <div className="flex flex-col gap-6 animate-fade-in text-left font-sans pb-24">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-16 right-6 z-50 bg-[#1d1c17] text-white px-4 py-3 rounded-xl shadow-2xl border border-emerald-500/40 flex items-center gap-3 animate-fade-in font-sans">
          <span className="material-symbols-outlined text-emerald-400 text-xl">check_circle</span>
          <span className="text-xs font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* 1. Header Card Workspace (Canonical layout matching OnlineOrdersView) */}
      <div className="bg-white border border-[#e8e2d8] rounded-xl p-6 shadow-sm">
        <div className="flex items-center gap-2.5">
          <span className="material-symbols-outlined text-[#ae001a] text-2xl font-normal select-none">
            receipt_long
          </span>
          <h2 className="text-[#ae001a] font-bold text-heading-lg tracking-wider uppercase font-sans">
            ONLINE ORDER ITEMS WORKSPACE
          </h2>
        </div>
        <p className="text-[#5f5e5e] text-body-sm font-sans mt-1">
          Inspect individual order item lines, view product and variant configurations, inspect custom modifier payloads, link lines to core POS tickets, and monitor live kitchen preparation status mirroring.
        </p>
      </div>

      {/* 2. Operational KPI Summary Banner (Live digital sales metrics & milestones - Single Line / 5 Columns - Informational Only) */}
      <div className="grid grid-cols-5 gap-2 sm:gap-2.5 w-full min-w-0">
        {/* KPI 1: Total Line Items */}
        <div className="bg-white border border-[#e8e2d8] p-2.5 rounded-xl shadow-xs flex items-center justify-between min-w-0 cursor-default font-sans">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center border border-blue-200 shrink-0">
              <span className="material-symbols-outlined text-[18px]">receipt_long</span>
            </div>
            <div className="min-w-0">
              <div className="text-[9.5px] font-bold text-[#5f5e5e] uppercase tracking-wider truncate font-sans font-poppins">
                Total Line Items
              </div>
              <div className="text-lg sm:text-xl font-extrabold text-[#1d1c17] font-sans font-poppins leading-tight">
                {isLoading ? '...' : kpiTotal}
              </div>
            </div>
          </div>
          <span className="hidden xl:inline-block px-1.5 py-0.5 rounded text-[8.5px] font-bold uppercase bg-blue-100 text-blue-800 border border-blue-200 shrink-0 font-sans font-poppins">
            TOTAL
          </span>
        </div>

        {/* KPI 2: Pending Prep */}
        <div className="bg-white border border-[#e8e2d8] p-2.5 rounded-xl shadow-xs flex items-center justify-between min-w-0 cursor-default font-sans">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-700 flex items-center justify-center border border-sky-200 shrink-0">
              <span className="material-symbols-outlined text-[18px]">hourglass_top</span>
            </div>
            <div className="min-w-0">
              <div className="text-[9.5px] font-bold text-[#5f5e5e] uppercase tracking-wider truncate font-sans font-poppins">
                Pending Prep
              </div>
              <div className="text-lg sm:text-xl font-extrabold text-[#1d1c17] font-sans font-poppins leading-tight">
                {isLoading ? '...' : kpiPending}
              </div>
            </div>
          </div>
          <span className="hidden xl:inline-block px-1.5 py-0.5 rounded text-[8.5px] font-bold uppercase bg-sky-100 text-sky-800 border border-sky-200 shrink-0 font-sans font-poppins">
            PENDING
          </span>
        </div>

        {/* KPI 3: In Preparation */}
        <div className="bg-white border border-[#e8e2d8] p-2.5 rounded-xl shadow-xs flex items-center justify-between min-w-0 cursor-default font-sans">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center border border-amber-200 shrink-0">
              <span className="material-symbols-outlined text-[18px]">soup_kitchen</span>
            </div>
            <div className="min-w-0">
              <div className="text-[9.5px] font-bold text-[#5f5e5e] uppercase tracking-wider truncate font-sans font-poppins">
                In Preparation
              </div>
              <div className="text-lg sm:text-xl font-extrabold text-[#1d1c17] font-sans font-poppins leading-tight">
                {isLoading ? '...' : kpiCooking}
              </div>
            </div>
          </div>
          <span className="hidden xl:inline-block px-1.5 py-0.5 rounded text-[8.5px] font-bold uppercase bg-amber-100 text-amber-800 border border-amber-200 shrink-0 font-sans font-poppins">
            COOKING
          </span>
        </div>

        {/* KPI 4: Line Ready */}
        <div className="bg-white border border-[#e8e2d8] p-2.5 rounded-xl shadow-xs flex items-center justify-between min-w-0 cursor-default font-sans">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-200 shrink-0">
              <span className="material-symbols-outlined text-[18px]">check_circle</span>
            </div>
            <div className="min-w-0">
              <div className="text-[9.5px] font-bold text-[#5f5e5e] uppercase tracking-wider truncate font-sans font-poppins">
                Line Ready
              </div>
              <div className="text-lg sm:text-xl font-extrabold text-[#1d1c17] font-sans font-poppins leading-tight">
                {isLoading ? '...' : kpiReady}
              </div>
            </div>
          </div>
          <span className="hidden xl:inline-block px-1.5 py-0.5 rounded text-[8.5px] font-bold uppercase bg-emerald-100 text-emerald-800 border border-emerald-200 shrink-0 font-sans font-poppins">
            READY
          </span>
        </div>

        {/* KPI 5: POS Mapped Lines */}
        <div className="bg-white border border-[#e8e2d8] p-2.5 rounded-xl shadow-xs flex items-center justify-between min-w-0 cursor-default font-sans">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center border border-purple-200 shrink-0">
              <span className="material-symbols-outlined text-[18px]">point_of_sale</span>
            </div>
            <div className="min-w-0">
              <div className="text-[9.5px] font-bold text-[#5f5e5e] uppercase tracking-wider truncate font-sans font-poppins">
                POS Mapped Lines
              </div>
              <div className="text-lg sm:text-xl font-extrabold text-[#1d1c17] font-sans font-poppins leading-tight">
                {isLoading ? '...' : `${kpiMapped} / ${kpiTotal}`}
              </div>
            </div>
          </div>
          <span className="hidden xl:inline-block px-1.5 py-0.5 rounded text-[8.5px] font-bold uppercase bg-purple-100 text-purple-800 border border-purple-200 shrink-0 font-sans font-poppins">
            MAPPED
          </span>
        </div>
      </div>

      {/* 3. Canonical Unified Filter Toolbar (Search, Selectors, Multi-Select Stage Checklist) */}
      <div className="bg-white border border-[#e8e2d8] rounded-xl p-4 shadow-sm flex flex-col gap-3.5">
        {/* Apartado 1: Buscador a la izquierda | Vista ("Stage Board" / "Table View") y Auto-Refresco a la derecha */}
        <div className="flex items-center justify-between gap-3 w-full">
          {/* Universal Search Input */}
          <div className="relative flex-1 max-w-md min-w-[200px]">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[17px] text-[#76736a] select-none">
              search
            </span>
            <input
              type="text"
              placeholder="Search by #ORI, #ONL, #POS-ITEM, product, notes, modifiers..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="h-[36px] w-full pl-9 pr-8 text-xs rounded-lg border border-[#d5cfc4] focus:outline-none focus:border-[#ae001a] focus:ring-1 focus:ring-[#ae001a]/20 bg-[#fcfcfb] text-[#1d1c17] placeholder:text-[#8c857b] transition-all font-sans font-poppins"
              aria-label="Search order items"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setCurrentPage(1);
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[#5f5e5e] hover:text-[#ae001a] transition-colors cursor-pointer"
                title="Clear search"
              >
                ✕
              </button>
            )}
          </div>

          {/* Vista (Stage Board & Table View) + Auto Refresco */}
          <div className="flex items-center gap-2 shrink-0">
            {/* View Switcher Toggle */}
            <div className="flex items-center h-[36px] bg-[#f2ede5] p-0.5 rounded-lg border border-[#e8e2d8] shrink-0">
              <button
                type="button"
                onClick={() => setViewMode('split')}
                className={`h-full px-3.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer font-sans whitespace-nowrap ${
                  viewMode === 'split'
                    ? 'bg-white text-[#1d1c17] shadow-xs border border-[#e8e2d8]'
                    : 'text-[#5f5e5e] hover:text-[#ae001a]'
                }`}
                title="Kitchen Stage Board View"
              >
                <span className={`material-symbols-outlined text-[16px] ${viewMode === 'split' ? 'text-[#ae001a]' : ''}`}>
                  view_kanban
                </span>
                Stage Board
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`h-full px-3.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer font-sans whitespace-nowrap ${
                  viewMode === 'table'
                    ? 'bg-white text-[#1d1c17] shadow-xs border border-[#e8e2d8]'
                    : 'text-[#5f5e5e] hover:text-[#ae001a]'
                }`}
                title="Table View"
              >
                <span className={`material-symbols-outlined text-[16px] ${viewMode === 'table' ? 'text-[#ae001a]' : ''}`}>
                  table_rows
                </span>
                Table View
              </button>
            </div>

            {/* Canonical Auto Refresh */}
            <div className="flex items-center h-[36px] px-2.5 rounded-lg border border-[#d5cfc4] bg-[#fcfcfb] gap-1.5 text-xs text-[#5f5e5e] shrink-0 font-sans">
              <button
                type="button"
                onClick={() => void fetchItems(true)}
                disabled={isLoading || isRefreshingSilently}
                className="text-[#5f5e5e] hover:text-[#ae001a] transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center"
                title="Sync now"
              >
                <span className={`material-symbols-outlined text-sm ${isRefreshingSilently ? 'animate-spin text-[#ae001a]' : ''}`}>
                  sync
                </span>
              </button>
              <select
                value={autoRefreshInterval}
                onChange={(e) => setAutoRefreshInterval(Number(e.target.value))}
                className="bg-transparent text-[11px] font-semibold text-[#1d1c17] focus:outline-none cursor-pointer h-full font-sans"
              >
                <option value={0}>Auto: Off</option>
                <option value={5}>Auto: 5s</option>
                <option value={10}>Auto: 10s</option>
                <option value={30}>Auto: 30s</option>
                <option value={60}>Auto: 60s</option>
              </select>
            </div>
          </div>
        </div>

        {/* Apartado 2: Fila Dedicada de Selectores (Online Order, Kitchen Stage, Mapping Link, Reset) */}
        <div className="pt-3 border-t border-[#f0ede6] flex flex-wrap items-center gap-2.5 w-full">
          {/* Target Online Order Dropdown */}
          <div className="flex items-center h-[34px] px-2.5 bg-[#fcfcfb] rounded-lg border border-[#d5cfc4] hover:border-[#b8b0a2] focus-within:border-[#ae001a] transition-all shrink-0">
            <span className="material-symbols-outlined text-[16px] text-[#76736a] mr-1.5 select-none shrink-0">
              shopping_bag
            </span>
            <select
              value={selectedOrderFilter}
              onChange={(e) => {
                setSelectedOrderFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-transparent text-xs font-medium text-[#1d1c17] outline-none cursor-pointer pr-1 font-sans font-poppins"
              aria-label="Filter by target order"
            >
              <option value="all">All Orders ({orders.length})</option>
              {orders.map((o) => (
                <option key={o.id} value={String(o.id)}>
                  #ONL-{o.id} {o.customerName ? `(${o.customerName})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Product Filter Dropdown */}
          <div className="flex items-center h-[34px] px-2.5 bg-[#fcfcfb] rounded-lg border border-[#d5cfc4] hover:border-[#b8b0a2] focus-within:border-[#ae001a] transition-all shrink-0">
            <span className="material-symbols-outlined text-[16px] text-[#76736a] mr-1.5 select-none shrink-0">
              lunch_dining
            </span>
            <select
              value={selectedProductFilter}
              onChange={(e) => {
                setSelectedProductFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-transparent text-xs font-medium text-[#1d1c17] outline-none cursor-pointer pr-1 font-sans font-poppins max-w-[180px]"
              aria-label="Filter by product"
            >
              <option value="all">All Products ({products.length})</option>
              {products.map((p) => (
                <option key={p.id} value={String(p.id)}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Kitchen Line Status Dropdown */}
          <div className="flex items-center h-[34px] px-2.5 bg-[#fcfcfb] rounded-lg border border-[#d5cfc4] hover:border-[#b8b0a2] focus-within:border-[#ae001a] transition-all shrink-0">
            <span className="material-symbols-outlined text-[16px] text-[#76736a] mr-1.5 select-none shrink-0">
              soup_kitchen
            </span>
            <select
              value={kitchenStatusFilter}
              onChange={(e) => {
                setKitchenStatusFilter(e.target.value as KitchenStatusFilter);
                setCurrentPage(1);
              }}
              className="bg-transparent text-xs font-medium text-[#1d1c17] outline-none cursor-pointer pr-1 font-sans font-poppins"
              aria-label="Filter by kitchen stage"
            >
              <option value="all">All Kitchen Stages</option>
              <option value="PENDING">PENDING (Pending Prep)</option>
              <option value="IN_PREPARATION">IN PREPARATION (Cooking)</option>
              <option value="READY">READY (Line Ready)</option>
              <option value="SERVED">SERVED (Delivered)</option>
            </select>
          </div>

          {/* POS Link Mapping Dropdown */}
          <div className="flex items-center h-[34px] px-2.5 bg-[#fcfcfb] rounded-lg border border-[#d5cfc4] hover:border-[#b8b0a2] focus-within:border-[#ae001a] transition-all shrink-0">
            <span className="material-symbols-outlined text-[16px] text-[#76736a] mr-1.5 select-none shrink-0">
              point_of_sale
            </span>
            <select
              value={mappingFilter}
              onChange={(e) => {
                setMappingFilter(e.target.value as MappingFilter);
                setCurrentPage(1);
              }}
              className="bg-transparent text-xs font-medium text-[#1d1c17] outline-none cursor-pointer pr-1 font-sans font-poppins"
              aria-label="Filter by POS mapping"
            >
              <option value="all">All POS Link States</option>
              <option value="mapped">POS Mapped Lines</option>
              <option value="unmapped">Web-Only Lines</option>
            </select>
          </div>

          {/* Logical Status Checkboxes (ACTIVE / DELETED) */}
          <div className="flex items-center gap-3 h-[34px] px-3 bg-[#fcfcfb] rounded-lg border border-[#d5cfc4] shrink-0">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#76736a] font-poppins">
              Status:
            </span>
            <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1d1c17] cursor-pointer select-none font-poppins hover:text-[#ae001a] transition-colors duration-200">
              <input
                type="checkbox"
                checked={showActiveStatus}
                onChange={(e) => {
                  setShowActiveStatus(e.target.checked);
                  setCurrentPage(1);
                }}
                className="w-3.5 h-3.5 rounded border-[#d5cfc4] text-[#ae001a] focus:ring-[#ae001a] accent-[#ae001a] cursor-pointer"
              />
              <span>ACTIVE</span>
            </label>
            <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1d1c17] cursor-pointer select-none font-poppins hover:text-[#ae001a] transition-colors duration-200">
              <input
                type="checkbox"
                checked={showDeletedStatus}
                onChange={(e) => {
                  setShowDeletedStatus(e.target.checked);
                  setCurrentPage(1);
                }}
                className="w-3.5 h-3.5 rounded border-[#d5cfc4] text-[#ae001a] focus:ring-[#ae001a] accent-[#ae001a] cursor-pointer"
              />
              <span>DELETED</span>
            </label>
          </div>

          {/* Reset All Filters Button */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleResetAllFilters}
              className="h-[34px] px-2.5 rounded-lg text-xs font-semibold text-[#ae001a] hover:bg-red-50 border border-red-200 transition-colors flex items-center gap-1 cursor-pointer font-sans shrink-0 font-poppins"
              title="Reset all filters"
            >
              <span className="material-symbols-outlined text-[15px]">filter_alt_off</span>
              <span>Reset</span>
            </button>
          )}
        </div>

        {/* Apartado 3: Los Status (Checklist Multi-Select Pills Strip + Actions) */}
        <div className="pt-3 border-t border-[#f0ede6] w-full flex items-center justify-between min-w-0">
          {/* Left: STAGE Multi-Filter Checklist Pills Strip */}
          <div className="flex-1 min-w-0 flex items-center gap-1.5 overflow-x-auto scrollbar-none [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] py-0.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#76736a] shrink-0 mr-1 font-sans font-poppins">
              STAGE:
            </span>

            {/* All Pill */}
            <button
              type="button"
              onClick={() => handleToggleStageStatus('ALL')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all duration-200 cursor-pointer whitespace-nowrap shrink-0 border font-poppins ${
                selectedStageStatuses.length === 0
                  ? 'bg-[#1d1c17] text-white border-[#1d1c17] shadow-xs'
                  : 'bg-white text-[#5f5e5e] border-[#d5cfc4] hover:bg-[#fcfcfb] hover:text-[#ae001a]'
              }`}
            >
              <span className="material-symbols-outlined text-[14px]">done_all</span>
              <span>All</span>
              <span
                className={`ml-1 px-1.5 py-0.2 rounded-full text-[9px] font-bold ${
                  selectedStageStatuses.length === 0 ? 'bg-white/20 text-white' : 'bg-[#e8e2d8] text-[#5f5e5e]'
                }`}
              >
                {kpiTotal}
              </span>
            </button>

            {/* Pending Pill */}
            <button
              type="button"
              onClick={() => handleToggleStageStatus('PENDING')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all duration-200 cursor-pointer whitespace-nowrap shrink-0 border font-poppins ${
                selectedStageStatuses.includes('PENDING')
                  ? 'bg-sky-700 text-white border-sky-700 shadow-xs'
                  : 'bg-white text-sky-800 border-sky-200 hover:bg-sky-50'
              }`}
            >
              <span className="material-symbols-outlined text-[13px]">hourglass_top</span>
              <span>Pending</span>
              <span
                className={`ml-1 px-1.5 py-0.2 rounded-full text-[9px] font-bold ${
                  selectedStageStatuses.includes('PENDING') ? 'bg-white/20 text-white' : 'bg-sky-100 text-sky-800'
                }`}
              >
                {kpiPending}
              </span>
            </button>

            {/* Cooking Pill */}
            <button
              type="button"
              onClick={() => handleToggleStageStatus('IN_PREPARATION')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all duration-200 cursor-pointer whitespace-nowrap shrink-0 border font-poppins ${
                selectedStageStatuses.includes('IN_PREPARATION')
                  ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                  : 'bg-white text-amber-800 border-amber-200 hover:bg-amber-50'
              }`}
            >
              <span className="material-symbols-outlined text-[13px]">soup_kitchen</span>
              <span>Cooking</span>
              <span
                className={`ml-1 px-1.5 py-0.2 rounded-full text-[9px] font-bold ${
                  selectedStageStatuses.includes('IN_PREPARATION') ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-800'
                }`}
              >
                {kpiCooking}
              </span>
            </button>

            {/* Ready Pill */}
            <button
              type="button"
              onClick={() => handleToggleStageStatus('READY')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all duration-200 cursor-pointer whitespace-nowrap shrink-0 border font-poppins ${
                selectedStageStatuses.includes('READY')
                  ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                  : 'bg-white text-emerald-800 border-emerald-200 hover:bg-emerald-50'
              }`}
            >
              <span className="material-symbols-outlined text-[13px]">check_circle</span>
              <span>Ready</span>
              <span
                className={`ml-1 px-1.5 py-0.2 rounded-full text-[9px] font-bold ${
                  selectedStageStatuses.includes('READY') ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-800'
                }`}
              >
                {kpiReady}
              </span>
            </button>

            {/* Served Pill */}
            <button
              type="button"
              onClick={() => handleToggleStageStatus('SERVED')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all duration-200 cursor-pointer whitespace-nowrap shrink-0 border font-poppins ${
                selectedStageStatuses.includes('SERVED')
                  ? 'bg-purple-700 text-white border-purple-700 shadow-xs'
                  : 'bg-white text-purple-800 border-purple-200 hover:bg-purple-50'
              }`}
            >
              <span className="material-symbols-outlined text-[13px]">dinner_dining</span>
              <span>Served</span>
              <span
                className={`ml-1 px-1.5 py-0.2 rounded-full text-[9px] font-bold ${
                  selectedStageStatuses.includes('SERVED') ? 'bg-white/20 text-white' : 'bg-purple-100 text-purple-800'
                }`}
              >
                {kpiServed}
              </span>
            </button>
          </div>

          {/* Right of status bar: Cancelled / Voided Archive Button + New Item Button */}
          <div className="flex items-center gap-2 pl-2 shrink-0 font-sans">
            <button
              type="button"
              onClick={() => {
                setShowDeletedStatus((prev) => !prev);
                setCurrentPage(1);
              }}
              className={`h-[30px] px-2.5 text-[11px] font-bold rounded-lg transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer shrink-0 font-sans font-poppins whitespace-nowrap border ${
                kpiVoided > 0 || showDeletedStatus
                  ? 'bg-red-50 hover:bg-red-100 text-red-700 border-red-200'
                  : 'bg-white hover:bg-zinc-50 text-zinc-600 border-zinc-200'
              }`}
              title="Toggle archived / voided lines"
            >
              <span className={`material-symbols-outlined text-[15px] ${kpiVoided > 0 || showDeletedStatus ? 'text-red-600' : 'text-zinc-400'}`}>
                archive
              </span>
              <span>Voided</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[9px] font-bold ${
                  kpiVoided > 0 || showDeletedStatus ? 'bg-red-200 text-red-900' : 'bg-zinc-100 text-zinc-600'
                }`}
              >
                {kpiVoided}
              </span>
            </button>

            <button
              type="button"
              onClick={handleOpenCreate}
              className="h-[30px] px-3 bg-[#ae001a] hover:bg-[#d2272f] text-white text-[11px] font-bold rounded-lg transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer shrink-0 font-sans font-poppins whitespace-nowrap"
              title="Create new online order item"
            >
              <span className="material-symbols-outlined text-[15px]">add</span>
              <span>New Item</span>
            </button>
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-xs text-red-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-red-600 text-lg">error</span>
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-red-700 hover:text-red-900 font-bold text-xs cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* 4. Main Views: Stage Board (Kanban Columns) vs Table View */}
      {viewMode === 'split' ? (
        <div className="w-full overflow-x-auto pb-2">
          <div className="grid grid-cols-4 min-w-[780px] gap-2.5 sm:gap-3.5 items-start lg:min-w-0 w-full">
            {/* Column 1: PENDING PREP */}
            <div className="bg-[#f7f5f0] border border-[#e8e2d8] rounded-xl overflow-hidden flex flex-col min-w-0">
              <div className="bg-[#e8e2d8] px-2.5 sm:px-3 py-2 flex items-center justify-between border-b border-[#d5cfc4] gap-1">
                <div className="flex items-center gap-1.5 text-[11px] sm:text-xs font-bold text-[#1d1c17] uppercase tracking-wider truncate min-w-0 font-sans">
                  <span className="material-symbols-outlined text-sky-700 text-base shrink-0">hourglass_top</span>
                  <span className="truncate">PENDING PREP</span>
                </div>
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-white text-sky-800 border border-sky-200 shrink-0">
                  {filteredItems.filter((i) => (i.kitchenLineStatus || 'PENDING').toUpperCase() === 'PENDING').length}
                </span>
              </div>

              <div className="p-2 sm:p-2.5 space-y-2.5 min-h-[400px] overflow-y-auto max-h-[calc(100vh-320px)]">
                {filteredItems
                  .filter((i) => (i.kitchenLineStatus || 'PENDING').toUpperCase() === 'PENDING')
                  .map((item) => (
                    <KanbanItemCard
                      key={item.id}
                      item={item}
                      orders={orders}
                      onOpenInspector={handleOpenDetails}
                      onEdit={handleOpenEdit}
                      onVoid={handleDeleteItem}
                      onRestore={handleRestoreItem}
                      onAdvanceStatus={handleUpdateKitchenStatus}
                      onSelectOrder={(ordId) => setSelectedOrderFilter(String(ordId))}
                      formatCurrency={formatCurrency}
                      formatTimestamp={formatTimestamp}
                    />
                  ))}

                {filteredItems.filter((i) => (i.kitchenLineStatus || 'PENDING').toUpperCase() === 'PENDING').length === 0 && (
                  <div className="py-12 text-center text-xs text-[#8c857b] italic font-sans">
                    No lines pending preparation
                  </div>
                )}
              </div>
            </div>

            {/* Column 2: IN PREPARATION (COOKING) */}
            <div className="bg-[#f7f5f0] border border-[#e8e2d8] rounded-xl overflow-hidden flex flex-col min-w-0">
              <div className="bg-[#e8e2d8] px-2.5 sm:px-3 py-2 flex items-center justify-between border-b border-[#d5cfc4] gap-1">
                <div className="flex items-center gap-1.5 text-[11px] sm:text-xs font-bold text-[#1d1c17] uppercase tracking-wider truncate min-w-0 font-sans">
                  <span className="material-symbols-outlined text-amber-700 text-base shrink-0">soup_kitchen</span>
                  <span className="truncate">COOKING</span>
                </div>
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-white text-amber-800 border border-amber-200 shrink-0">
                  {filteredItems.filter((i) => (i.kitchenLineStatus || '').toUpperCase() === 'IN_PREPARATION').length}
                </span>
              </div>

              <div className="p-2 sm:p-2.5 space-y-2.5 min-h-[400px] overflow-y-auto max-h-[calc(100vh-320px)]">
                {filteredItems
                  .filter((i) => (i.kitchenLineStatus || '').toUpperCase() === 'IN_PREPARATION')
                  .map((item) => (
                    <KanbanItemCard
                      key={item.id}
                      item={item}
                      orders={orders}
                      onOpenInspector={handleOpenDetails}
                      onEdit={handleOpenEdit}
                      onVoid={handleDeleteItem}
                      onRestore={handleRestoreItem}
                      onAdvanceStatus={handleUpdateKitchenStatus}
                      onSelectOrder={(ordId) => setSelectedOrderFilter(String(ordId))}
                      formatCurrency={formatCurrency}
                      formatTimestamp={formatTimestamp}
                    />
                  ))}

                {filteredItems.filter((i) => (i.kitchenLineStatus || '').toUpperCase() === 'IN_PREPARATION').length === 0 && (
                  <div className="py-12 text-center text-xs text-[#8c857b] italic font-sans">
                    No lines currently cooking
                  </div>
                )}
              </div>
            </div>

            {/* Column 3: READY */}
            <div className="bg-[#f7f5f0] border border-[#e8e2d8] rounded-xl overflow-hidden flex flex-col min-w-0">
              <div className="bg-[#e8e2d8] px-2.5 sm:px-3 py-2 flex items-center justify-between border-b border-[#d5cfc4] gap-1">
                <div className="flex items-center gap-1.5 text-[11px] sm:text-xs font-bold text-[#1d1c17] uppercase tracking-wider truncate min-w-0 font-sans">
                  <span className="material-symbols-outlined text-emerald-700 text-base shrink-0">check_circle</span>
                  <span className="truncate">LINE READY</span>
                </div>
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-white text-emerald-800 border border-emerald-200 shrink-0">
                  {filteredItems.filter((i) => (i.kitchenLineStatus || '').toUpperCase() === 'READY').length}
                </span>
              </div>

              <div className="p-2 sm:p-2.5 space-y-2.5 min-h-[400px] overflow-y-auto max-h-[calc(100vh-320px)]">
                {filteredItems
                  .filter((i) => (i.kitchenLineStatus || '').toUpperCase() === 'READY')
                  .map((item) => (
                    <KanbanItemCard
                      key={item.id}
                      item={item}
                      orders={orders}
                      onOpenInspector={handleOpenDetails}
                      onEdit={handleOpenEdit}
                      onVoid={handleDeleteItem}
                      onRestore={handleRestoreItem}
                      onAdvanceStatus={handleUpdateKitchenStatus}
                      onSelectOrder={(ordId) => setSelectedOrderFilter(String(ordId))}
                      formatCurrency={formatCurrency}
                      formatTimestamp={formatTimestamp}
                    />
                  ))}

                {filteredItems.filter((i) => (i.kitchenLineStatus || '').toUpperCase() === 'READY').length === 0 && (
                  <div className="py-12 text-center text-xs text-[#8c857b] italic font-sans">
                    No lines waiting for dispatch
                  </div>
                )}
              </div>
            </div>

            {/* Column 4: SERVED */}
            <div className="bg-[#f7f5f0] border border-[#e8e2d8] rounded-xl overflow-hidden flex flex-col min-w-0">
              <div className="bg-[#e8e2d8] px-2.5 sm:px-3 py-2 flex items-center justify-between border-b border-[#d5cfc4] gap-1">
                <div className="flex items-center gap-1.5 text-[11px] sm:text-xs font-bold text-[#1d1c17] uppercase tracking-wider truncate min-w-0 font-sans">
                  <span className="material-symbols-outlined text-purple-700 text-base shrink-0">dinner_dining</span>
                  <span className="truncate">SERVED</span>
                </div>
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-white text-purple-800 border border-purple-200 shrink-0">
                  {filteredItems.filter((i) => (i.kitchenLineStatus || '').toUpperCase() === 'SERVED').length}
                </span>
              </div>

              <div className="p-2 sm:p-2.5 space-y-2.5 min-h-[400px] overflow-y-auto max-h-[calc(100vh-320px)]">
                {filteredItems
                  .filter((i) => (i.kitchenLineStatus || '').toUpperCase() === 'SERVED')
                  .map((item) => (
                    <KanbanItemCard
                      key={item.id}
                      item={item}
                      orders={orders}
                      onOpenInspector={handleOpenDetails}
                      onEdit={handleOpenEdit}
                      onVoid={handleDeleteItem}
                      onRestore={handleRestoreItem}
                      onAdvanceStatus={handleUpdateKitchenStatus}
                      onSelectOrder={(ordId) => setSelectedOrderFilter(String(ordId))}
                      formatCurrency={formatCurrency}
                      formatTimestamp={formatTimestamp}
                    />
                  ))}

                {filteredItems.filter((i) => (i.kitchenLineStatus || '').toUpperCase() === 'SERVED').length === 0 && (
                  <div className="py-12 text-center text-xs text-[#8c857b] italic font-sans">
                    No served order lines
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* TABLE DIRECTORY VIEW (Canonical standard matching OnlineOrdersView) */
        <div className="bg-white rounded-xl border border-[#e8e2d8] shadow-xs overflow-hidden">
          {/* Table Header Bar (#222222) with Options Menu */}
          <div className="bg-[#222222] px-6 py-4 flex items-center justify-between border-b border-[#333333]">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-[#ae001a] text-xl select-none">
                receipt_long
              </span>
              <span className="text-label-caps font-bold text-white uppercase tracking-wider font-sans">
                ONLINE ORDER ITEMS DIRECTORY
              </span>
              <span className="text-[10px] font-mono font-bold bg-[#333333] text-zinc-300 px-2 py-0.5 rounded border border-[#444444]">
                {filteredItems.length === items.length
                  ? `${items.length} item${items.length === 1 ? '' : 's'}`
                  : `${filteredItems.length} / ${items.length} items`}
              </span>
            </div>

            <TableOptionsMenu
              onExportCSV={handleExportCsv}
              onPrint={window.print}
              onCopySummary={handleCopySummary}
              onReload={() => void fetchItems(true)}
              columns={[
                { key: 'lineId', label: 'Line ID & POS Link' },
                { key: 'order', label: 'Order Context' },
                { key: 'product', label: 'Product & Variant' },
                { key: 'qtyPrice', label: 'Quantity & Subtotal' },
                { key: 'modifiersNotes', label: 'Modifiers & Notes' },
                { key: 'kitchenStatus', label: 'Kitchen Prep Stage' },
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
              totalItems={filteredItems.length}
              pageSize={pageSize}
              onChangePageSize={(size) => {
                setPageSize(size);
                setCurrentPage(1);
              }}
              currentPage={currentPage}
              onPageChange={setCurrentPage}
              totalPages={totalPages}
            />
          </div>

          {activeColumnsCount === 0 ? (
            <NoColumnsEmptyState
              onReset={() =>
                setVisibleColumns({
                  lineId: true,
                  order: true,
                  product: true,
                  qtyPrice: true,
                  modifiersNotes: true,
                  kitchenStatus: true,
                  timestamps: true,
                  actions: true,
                })
              }
            />
          ) : (
            <>
              <div className="w-full overflow-hidden">
                <table className="w-full border-collapse font-sans text-xs">
                  <thead className="bg-[#ece8e0] border-b border-[#e8e2d8]">
                    <tr>
                      {visibleColumns.lineId && (
                        <th className={`text-left text-label-caps font-semibold text-[#5f5e5e] font-sans text-xs ${densityPadding} whitespace-nowrap`}>
                          Line & POS Link
                        </th>
                      )}
                      {visibleColumns.order && (
                        <th className={`text-left text-label-caps font-semibold text-[#5f5e5e] font-sans text-xs ${densityPadding} whitespace-nowrap`}>
                          Order Context
                        </th>
                      )}
                      {visibleColumns.product && (
                        <th className={`text-left text-label-caps font-semibold text-[#5f5e5e] font-sans text-xs ${densityPadding} whitespace-nowrap`}>
                          Product & Variant
                        </th>
                      )}
                      {visibleColumns.qtyPrice && (
                        <th className={`text-right text-label-caps font-semibold text-[#5f5e5e] font-sans text-xs ${densityPadding} whitespace-nowrap`}>
                          Qty & Subtotal
                        </th>
                      )}
                      {visibleColumns.modifiersNotes && (
                        <th className={`text-left text-label-caps font-semibold text-[#5f5e5e] font-sans text-xs ${densityPadding} whitespace-nowrap`}>
                          Modifiers & Notes
                        </th>
                      )}
                      {visibleColumns.kitchenStatus && (
                        <th className={`text-center text-label-caps font-semibold text-[#5f5e5e] font-sans text-xs ${densityPadding} whitespace-nowrap`}>
                          Kitchen Prep Stage
                        </th>
                      )}
                      {visibleColumns.timestamps && (
                        <th className={`text-left text-label-caps font-semibold text-[#5f5e5e] font-sans text-xs ${densityPadding} whitespace-nowrap`}>
                          Timestamps
                        </th>
                      )}
                      {visibleColumns.actions && (
                        <th className={`text-center text-label-caps font-semibold text-[#5f5e5e] font-sans text-xs ${densityPadding} whitespace-nowrap`}>
                          Actions
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e8e2d8] text-xs text-[#1d1c17]">
                    {isLoading ? (
                      <tr>
                        <td
                          colSpan={activeColumnsCount}
                          className="px-6 py-12 text-center text-secondary font-sans bg-white"
                        >
                          <span className="material-symbols-outlined animate-spin text-[#ae001a] text-4xl block mb-2 mx-auto select-none">
                            sync
                          </span>
                          <p className="text-secondary text-body-md mt-2 font-sans">
                            Loading order line items...
                          </p>
                        </td>
                      </tr>
                    ) : filteredItems.length === 0 ? (
                      <TableEmptyState
                        colSpan={activeColumnsCount}
                        icon="receipt_long"
                        title="No order items found"
                        description={
                          searchQuery
                            ? `No lines matching "${searchQuery}". Clear your search query or reset filters.`
                            : 'There are currently no online order line items matching the selected parameters.'
                        }
                      />
                    ) : (
                      paginatedItems.map((item) => {
                        const currentStatus = (item.kitchenLineStatus || 'PENDING').toUpperCase();
                        const lineSubtotal = (item.quantity || 1) * (item.unitPrice || 0);

                        const modEntries =
                          item.modifiers && typeof item.modifiers === 'object' && !Array.isArray(item.modifiers)
                            ? Object.entries(item.modifiers)
                            : [];

                        return (
                          <tr
                            key={item.id}
                            className="hover:bg-[#f8f3eb] transition-colors cursor-pointer group bg-white"
                            onClick={() => handleOpenDetails(item)}
                          >
                            {/* Line & POS Link */}
                            {visibleColumns.lineId && (
                              <td className={`${densityPadding} whitespace-nowrap`}>
                                <div className="flex flex-col gap-1 items-start">
                                  <span className="font-poppins font-bold text-xs bg-[#222222] text-white px-2 py-0.5 rounded group-hover:bg-[#ae001a] transition-colors duration-200">
                                    #ORI-{item.id}
                                  </span>
                                  {item.orderItemId ? (
                                    <span className="font-mono font-bold text-[10px] text-emerald-800 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200 flex items-center gap-0.5">
                                      <span className="material-symbols-outlined text-[11px]">hub</span>
                                      #POS-{item.orderItemId}
                                    </span>
                                  ) : (
                                    <span className="font-mono text-[9px] text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200">
                                      Web-Only
                                    </span>
                                  )}
                                  {item.status === 'deleted' && (
                                    <span className="font-mono text-[9px] font-bold text-red-700 bg-red-100 px-1.5 py-0.2 rounded border border-red-200">
                                      VOIDED
                                    </span>
                                  )}
                                </div>
                              </td>
                            )}

                            {/* Order Context */}
                            {visibleColumns.order && (
                              <td className={`${densityPadding} whitespace-nowrap`}>
                                <div className="flex flex-col gap-0.5">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedOrderFilter(String(item.onlineOrderId));
                                    }}
                                    className="font-mono font-bold text-xs text-[#ae001a] hover:underline text-left cursor-pointer flex items-center gap-1"
                                    title="Filter by this order"
                                  >
                                    <span className="material-symbols-outlined text-[13px]">shopping_bag</span>
                                    #ONL-{item.onlineOrderId}
                                  </button>
                                  <span className="text-[11px] text-[#5f5e5e] truncate max-w-[130px]">
                                    {orders.find((o) => o.id === item.onlineOrderId)?.customerName || 'Online Order'}
                                  </span>
                                </div>
                              </td>
                            )}

                            {/* Product & Variant */}
                            {visibleColumns.product && (
                              <td className={densityPadding}>
                                <div className="flex flex-col min-w-[140px]">
                                  <span className="font-poppins font-bold text-[#1d1c17] truncate group-hover:text-[#ae001a] transition-colors duration-200">
                                    {item.product?.name || `Product #${item.productId}`}
                                  </span>
                                  {item.variant ? (
                                    <span className="font-poppins text-[11px] font-semibold text-purple-700">
                                      Option: {item.variant.name}
                                    </span>
                                  ) : item.product?.sku ? (
                                    <span className="text-[10px] font-mono text-[#8c857b]">
                                      SKU: {item.product.sku}
                                    </span>
                                  ) : null}
                                </div>
                              </td>
                            )}

                            {/* Quantity & Subtotal */}
                            {visibleColumns.qtyPrice && (
                              <td className={`${densityPadding} text-right whitespace-nowrap`}>
                                <div className="flex flex-col items-end">
                                  <span className="inline-flex items-center px-2 py-0.5 rounded bg-[#222222] text-white font-poppins font-bold text-[11px]">
                                    Qty: {item.quantity}
                                  </span>
                                  <span className="font-mono text-xs font-bold text-[#ae001a] mt-0.5">
                                    {formatCurrency(lineSubtotal)}
                                  </span>
                                </div>
                              </td>
                            )}

                            {/* Modifiers & Notes */}
                            {visibleColumns.modifiersNotes && (
                              <td className={densityPadding}>
                                <div className="flex flex-col gap-1 max-w-xs">
                                  {modEntries.length > 0 ? (
                                    <div className="flex flex-wrap gap-1">
                                      {modEntries.slice(0, 3).map(([k, v], idx) => (
                                        <span
                                          key={idx}
                                          className="inline-flex items-center gap-0.5 text-[10px] font-semibold bg-[#f4efe6] border border-[#d5cfc4] text-[#1d1c17] px-1.5 py-0.2 rounded hover:border-[#ae001a] hover:text-[#ae001a] transition-colors duration-200 font-poppins"
                                        >
                                          <span className="text-[#ae001a]">{k}:</span>
                                          <span>{String(v)}</span>
                                        </span>
                                      ))}
                                      {modEntries.length > 3 && (
                                        <span className="text-[10px] text-[#8c857b] font-medium">
                                          +{modEntries.length - 3} more
                                        </span>
                                      )}
                                    </div>
                                  ) : null}

                                  {item.notes ? (
                                    <div className="text-[11px] text-[#8c857b] italic flex items-center gap-1 truncate max-w-[200px]">
                                      <span className="material-symbols-outlined text-[13px] text-amber-700">speaker_notes</span>
                                      <span className="truncate">{item.notes}</span>
                                    </div>
                                  ) : null}

                                  {modEntries.length === 0 && !item.notes && (
                                    <span className="text-[#8c857b] text-xs">—</span>
                                  )}
                                </div>
                              </td>
                            )}

                            {/* Kitchen Line Status Mirroring Pill */}
                            {visibleColumns.kitchenStatus && (
                              <td className={`${densityPadding} text-center whitespace-nowrap`}>
                                {currentStatus === 'PENDING' && (
                                  <span className="bg-[#3b82f6]/15 text-[#3b82f6] border border-[#3b82f6]/30 text-[11px] font-bold px-2.5 py-0.5 rounded font-poppins inline-flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-[#3b82f6]" />
                                    <span>Pending Prep</span>
                                  </span>
                                )}
                                {currentStatus === 'IN_PREPARATION' && (
                                  <span className="bg-[#f59e0b]/15 text-[#f59e0b] border border-[#f59e0b]/30 text-[11px] font-bold px-2.5 py-0.5 rounded font-poppins inline-flex items-center gap-1 animate-pulse">
                                    <span className="w-1.5 h-1.5 rounded-full bg-[#f59e0b]" />
                                    <span>Cooking</span>
                                  </span>
                                )}
                                {currentStatus === 'READY' && (
                                  <span className="bg-[#10b981]/15 text-[#10b981] border border-[#10b981]/30 text-[11px] font-bold px-2.5 py-0.5 rounded font-poppins inline-flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-[#10b981]" />
                                    <span>Line Ready</span>
                                  </span>
                                )}
                                {currentStatus === 'SERVED' && (
                                  <span className="bg-purple-100 text-purple-800 border border-purple-300 text-[11px] font-bold px-2.5 py-0.5 rounded font-poppins inline-flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-purple-700" />
                                    <span>Served</span>
                                  </span>
                                )}
                              </td>
                            )}

                            {/* Timestamps */}
                            {visibleColumns.timestamps && (
                              <td className={`${densityPadding} font-mono text-[11px] text-[#5f5e5e] whitespace-nowrap`}>
                                <div>{item.createdAt ? new Date(item.createdAt).toLocaleDateString() : '—'}</div>
                                <div className="text-[10px] text-[#8c857b]">
                                  {item.createdAt ? new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                </div>
                              </td>
                            )}

                            {/* Actions */}
                            {visibleColumns.actions && (
                              <td
                                className={`${densityPadding} text-center whitespace-nowrap`}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleOpenDetails(item)}
                                    className="w-7 h-7 rounded flex items-center justify-center text-[#8c857b] hover:text-[#1d1c17] hover:bg-[#f2ede5] transition-colors cursor-pointer"
                                    title="Inspect line details"
                                  >
                                    <span className="material-symbols-outlined text-[17px]">visibility</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleOpenEdit(item)}
                                    className="w-7 h-7 rounded flex items-center justify-center text-[#8c857b] hover:text-[#ae001a] hover:bg-[#f2ede5] transition-colors cursor-pointer"
                                    title="Configure line parameters"
                                  >
                                    <span className="material-symbols-outlined text-[17px]">edit</span>
                                  </button>

                                  {item.status === 'active' ? (
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteItem(item)}
                                      className="w-7 h-7 rounded flex items-center justify-center text-red-500 hover:text-red-700 hover:bg-red-50 transition-colors cursor-pointer"
                                      title="Void line item"
                                    >
                                      <span className="material-symbols-outlined text-[17px]">delete</span>
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => handleRestoreItem(item)}
                                      className="w-7 h-7 rounded flex items-center justify-center text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 transition-colors cursor-pointer"
                                      title="Restore line item"
                                    >
                                      <span className="material-symbols-outlined text-[17px]">restore_from_trash</span>
                                    </button>
                                  )}

                                  {/* Quick Stage Transitions */}
                                  {currentStatus === 'PENDING' && (
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateKitchenStatus(item.id, 'in_preparation')}
                                      className="w-7 h-7 rounded flex items-center justify-center bg-amber-600 hover:bg-amber-700 text-white transition-colors shadow-xs cursor-pointer"
                                      title="Start cooking"
                                    >
                                      <span className="material-symbols-outlined text-[16px]">skillet</span>
                                    </button>
                                  )}
                                  {currentStatus === 'IN_PREPARATION' && (
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateKitchenStatus(item.id, 'ready')}
                                      className="w-7 h-7 rounded flex items-center justify-center bg-emerald-600 hover:bg-emerald-700 text-white transition-colors shadow-xs cursor-pointer"
                                      title="Mark ready"
                                    >
                                      <span className="material-symbols-outlined text-[16px]">check_circle</span>
                                    </button>
                                  )}
                                  {currentStatus === 'READY' && (
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateKitchenStatus(item.id, 'served')}
                                      className="w-7 h-7 rounded flex items-center justify-center bg-purple-600 hover:bg-purple-700 text-white transition-colors shadow-xs cursor-pointer"
                                      title="Mark served"
                                    >
                                      <span className="material-symbols-outlined text-[16px]">dinner_dining</span>
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

              {/* Pagination Footer */}
              {filteredItems.length > 0 && (
                <TablePaginationFooter
                  currentPage={currentPage}
                  totalPages={totalPages}
                  pageSize={pageSize}
                  totalItems={filteredItems.length}
                  onPageChange={setCurrentPage}
                  onPageSizeChange={(newSize) => {
                    setPageSize(newSize);
                    setCurrentPage(1);
                  }}
                  startItem={(currentPage - 1) * pageSize + 1}
                  endItem={Math.min(currentPage * pageSize, filteredItems.length)}
                />
              )}
            </>
          )}
        </div>
      )}

      {/* Detail Inspection Drawer */}
      <OnlineOrderItemDetailsDrawer
        isOpen={isDetailDrawerOpen}
        item={selectedItem}
        onClose={() => {
          setIsDetailDrawerOpen(false);
          setSelectedItem(null);
        }}
        onUpdateKitchenStatus={handleUpdateKitchenStatus}
        onEditItem={(item) => {
          setIsDetailDrawerOpen(false);
          handleOpenEdit(item);
        }}
        onDeleteItem={handleDeleteItem}
        onRestoreItem={handleRestoreItem}
        onNavigateToOrder={(orderId) => {
          setIsDetailDrawerOpen(false);
          onNavigate?.('online-orders');
          setSelectedOrderFilter(String(orderId));
        }}
      />

      {/* Setup / Add / Edit Drawer */}
      <OnlineOrderItemSetupDrawer
        isOpen={isSetupDrawerOpen}
        mode={setupMode}
        initialData={itemToEdit}
        orders={orders}
        products={products}
        variants={variants}
        onClose={() => {
          setIsSetupDrawerOpen(false);
          setItemToEdit(null);
        }}
        onSubmit={handleSetupSubmit}
      />
    </div>
  );
};

interface KanbanItemCardProps {
  item: OnlineOrderItemData;
  orders: OnlineOrderOption[];
  onOpenInspector: (item: OnlineOrderItemData) => void;
  onEdit: (item: OnlineOrderItemData) => void;
  onVoid: (item: OnlineOrderItemData) => void;
  onRestore: (item: OnlineOrderItemData) => void;
  onAdvanceStatus: (itemId: number, nextStatus: string) => void;
  onSelectOrder: (orderId: number) => void;
  formatCurrency: (val: number | string | undefined | null) => string;
  formatTimestamp: (dateStr?: string | null) => string;
}

const KanbanItemCard: React.FC<KanbanItemCardProps> = ({
  item,
  orders,
  onOpenInspector,
  onEdit,
  onVoid,
  onRestore,
  onAdvanceStatus,
  onSelectOrder,
  formatCurrency,
  formatTimestamp,
}) => {
  const currentStatus = (item.kitchenLineStatus || 'PENDING').toUpperCase();
  const lineSubtotal = (item.quantity || 1) * (item.unitPrice || 0);
  const parentOrder = orders.find((o) => o.id === item.onlineOrderId);

  // Formatted modifiers preview
  const modEntries =
    item.modifiers && typeof item.modifiers === 'object' && !Array.isArray(item.modifiers)
      ? Object.entries(item.modifiers)
      : [];

  return (
    <div
      onClick={() => onOpenInspector(item)}
      className="bg-white border border-[#e8e2d8] rounded-xl p-2.5 sm:p-3 shadow-xs hover:shadow-md hover:border-[#ae001a] transition-all cursor-pointer group flex flex-col justify-between gap-2 sm:gap-2.5 font-sans min-w-0 overflow-hidden"
    >
      {/* Top Row: #ORI & POS Link */}
      <div className="flex items-center justify-between gap-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-poppins font-bold text-xs bg-[#222222] text-white px-2 py-0.5 rounded group-hover:bg-[#ae001a] transition-colors duration-200">
            #ORI-{item.id}
          </span>
          {item.orderItemId ? (
            <span className="font-mono font-bold text-[10px] text-emerald-800 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200 flex items-center gap-0.5">
              <span className="material-symbols-outlined text-[11px]">hub</span>
              #POS-{item.orderItemId}
            </span>
          ) : (
            <span className="font-mono text-[9px] text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200">
              Web-Only
            </span>
          )}
          {item.status === 'deleted' && (
            <span className="font-mono text-[9px] font-bold text-red-700 bg-red-100 px-1.5 py-0.2 rounded border border-red-200">
              VOIDED
            </span>
          )}
        </div>

        <span className="text-[11px] font-mono text-[#8c857b]">
          {formatTimestamp(item.createdAt)}
        </span>
      </div>

      {/* Target Order & Product Details */}
      <div>
        <div className="flex items-center justify-between gap-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelectOrder(item.onlineOrderId);
            }}
            className="text-[11px] font-mono font-bold text-[#ae001a] hover:underline cursor-pointer flex items-center gap-1"
            title="Filter by this online order"
          >
            <span className="material-symbols-outlined text-[13px]">shopping_bag</span>
            #ONL-{item.onlineOrderId}
          </button>
          {parentOrder?.customerName && (
            <span className="text-[10px] text-[#5f5e5e] truncate max-w-[120px]">
              {parentOrder.customerName}
            </span>
          )}
        </div>

        <div className="font-poppins font-bold text-[#1d1c17] text-xs group-hover:text-[#ae001a] transition-colors duration-200 truncate mt-1">
          {item.product?.name || `Product #${item.productId}`}
        </div>

        {item.variant ? (
          <div className="font-poppins text-[10px] font-semibold text-purple-700 truncate">
            Option: {item.variant.name}
          </div>
        ) : item.product?.sku ? (
          <div className="text-[10px] font-mono text-[#8c857b] truncate">
            SKU: {item.product.sku}
          </div>
        ) : null}
      </div>

      {/* Quantity & Subtotal Pill */}
      <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-[#f2ede5]">
        <span className="px-2 py-0.5 rounded bg-[#222222] text-white font-poppins font-bold text-[10px]">
          Qty: {item.quantity}
        </span>

        {item.unitPrice ? (
          <span className="text-[10px] text-[#5f5e5e] font-mono">
            @ {formatCurrency(item.unitPrice)}
          </span>
        ) : null}

        <span className="ml-auto font-mono font-bold text-xs text-[#ae001a]">
          {formatCurrency(lineSubtotal)}
        </span>
      </div>

      {/* Modifiers Chips Preview */}
      {modEntries.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {modEntries.slice(0, 2).map(([k, v], idx) => (
            <span
              key={idx}
              className="inline-flex items-center gap-0.5 text-[9.5px] font-semibold bg-[#f4efe6] border border-[#d5cfc4] text-[#1d1c17] px-1.5 py-0.2 rounded truncate max-w-[140px] hover:border-[#ae001a] hover:text-[#ae001a] transition-colors duration-200 font-poppins"
            >
              <span className="text-[#ae001a]">{k}:</span>
              <span className="truncate">{String(v)}</span>
            </span>
          ))}
          {modEntries.length > 2 && (
            <span className="text-[9px] text-[#8c857b] font-medium self-center">
              +{modEntries.length - 2} more
            </span>
          )}
        </div>
      )}

      {/* Customer Prep Notes */}
      {item.notes && (
        <div className="text-[10px] text-amber-900 bg-amber-50/80 px-2 py-1 rounded border border-amber-200/60 truncate italic flex items-center gap-1">
          <span className="material-symbols-outlined text-[12px] shrink-0 text-amber-700">speaker_notes</span>
          <span className="truncate">{item.notes}</span>
        </div>
      )}

      {/* Action Footer */}
      <div
        className="pt-2 border-t border-[#f2ede5] flex items-center justify-between gap-1 min-w-0 h-9"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-1 shrink-0 h-7">
          <button
            type="button"
            onClick={() => onOpenInspector(item)}
            className="w-7 h-7 rounded flex items-center justify-center text-[#8c857b] hover:text-[#1d1c17] hover:bg-[#f2ede5] transition-colors cursor-pointer"
            title="Inspect line details"
          >
            <span className="material-symbols-outlined text-[18px] leading-none">visibility</span>
          </button>

          <button
            type="button"
            onClick={() => onEdit(item)}
            className="w-7 h-7 rounded flex items-center justify-center text-[#8c857b] hover:text-[#ae001a] hover:bg-[#f2ede5] transition-colors cursor-pointer"
            title="Edit line configuration"
          >
            <span className="material-symbols-outlined text-[18px] leading-none">edit</span>
          </button>

          {item.status === 'active' ? (
            <button
              type="button"
              onClick={() => onVoid(item)}
              className="w-7 h-7 rounded flex items-center justify-center text-red-500 hover:text-red-700 hover:bg-red-50 transition-colors cursor-pointer"
              title="Void line (soft-delete)"
            >
              <span className="material-symbols-outlined text-[18px] leading-none">delete</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onRestore(item)}
              className="w-7 h-7 rounded flex items-center justify-center text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 transition-colors cursor-pointer"
              title="Restore line item"
            >
              <span className="material-symbols-outlined text-[18px] leading-none">restore_from_trash</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0 h-7">
          {currentStatus === 'PENDING' && (
            <button
              type="button"
              onClick={() => onAdvanceStatus(item.id, 'in_preparation')}
              className="w-7 h-7 rounded flex items-center justify-center bg-amber-600 hover:bg-amber-700 text-white transition-colors shadow-xs cursor-pointer shrink-0"
              title="Start cooking on line"
            >
              <span className="material-symbols-outlined text-[18px] leading-none">skillet</span>
            </button>
          )}

          {currentStatus === 'IN_PREPARATION' && (
            <button
              type="button"
              onClick={() => onAdvanceStatus(item.id, 'ready')}
              className="w-7 h-7 rounded flex items-center justify-center bg-emerald-600 hover:bg-emerald-700 text-white transition-colors shadow-xs cursor-pointer shrink-0"
              title="Mark line ready"
            >
              <span className="material-symbols-outlined text-[18px] leading-none">check_circle</span>
            </button>
          )}

          {currentStatus === 'READY' && (
            <button
              type="button"
              onClick={() => onAdvanceStatus(item.id, 'served')}
              className="w-7 h-7 rounded flex items-center justify-center bg-purple-600 hover:bg-purple-700 text-white transition-colors shadow-xs cursor-pointer shrink-0"
              title="Mark served"
            >
              <span className="material-symbols-outlined text-[18px] leading-none">dinner_dining</span>
            </button>
          )}

          {currentStatus === 'SERVED' && (
            <span
              className="w-7 h-7 rounded flex items-center justify-center text-green-700 bg-green-50 border border-green-200"
              title="Line served and delivered"
            >
              <span className="material-symbols-outlined text-[16px] leading-none">verified</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
