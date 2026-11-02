import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { CatalogQuickLinks } from '@/modules/inventory/products-inventory/views/CatalogQuickLinks';
import { InventoryNavHubBar } from '@/modules/inventory/shared/InventoryNavHubBar';
import { EmergencySupportModal } from '@/shared/components/QuickActionModals';
import { TableOptionsMenu, TablePaginationFooter, NoColumnsEmptyState, TableEmptyState, type TableDensity } from '@/shared/components/TableOptionsMenu';
import { getDensityPadding } from '@/shared/components/tableOptionsHelpers';
import { apiRequest, type MaybeEnvelopedList } from '@/shared/api/http';

interface Product {
  id: number;
  name: string;
}

interface Modifier {
  id: number;
  name: string;
  priceDelta: number | string;
  isActive: boolean;
  product: Product | null;
}

interface ModifiersViewProps {
  onNavigate?: (view: string) => void;
}

export const ModifiersView: React.FC<ModifiersViewProps> = ({ onNavigate }) => {
  const [modifiers, setModifiers] = useState<Modifier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Filtros locales
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [productFilter, setProductFilter] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<string>('All Status');

  // Canonical Unified Toolbar State
  const [autoRefreshInterval, setAutoRefreshInterval] = useState<number>(10);

  // Table options state
  const [rowDensity, setRowDensity] = useState<TableDensity>('comfortable');
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({
    name: true,
    product: true,
    priceDelta: true,
    status: true,
    actions: true,
  });
  const [pageSize, setPageSize] = useState<number>(5);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [editingModifierId, setEditingModifierId] = useState<number | null>(null);

  // Modal Form Fields
  const [formName, setFormName] = useState<string>('');
  const [formPriceDelta, setFormPriceDelta] = useState<string>('');
  const [formProduct, setFormProduct] = useState<string>('NULL');
  const [formIsActive, setFormIsActive] = useState<boolean>(true);
  const [isSupportOpen, setIsSupportOpen] = useState<boolean>(false);
  // State for activation/deactivation confirmation modal
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState<boolean>(false);
  const [confirmTargetModifier, setConfirmTargetModifier] = useState<Modifier | null>(null);
  const [isToggling, setIsToggling] = useState<boolean>(false);
  const [toggleError, setToggleError] = useState<string | null>(null);

  const topRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll at startup when mounting view
  useEffect(() => {
    if (topRef.current) {
      topRef.current.scrollIntoView({ behavior: 'instant' });
    }
  }, []);
  const fetchAllData = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    setIsRefreshing(true);
    setError(null);
    try {
      const [modifiersJson, productsJson] = await Promise.all([
        apiRequest<MaybeEnvelopedList<{ id: number; name: string; priceDelta: number | string; isActive?: boolean; product?: { id: number; name: string } | null }>>('/modifiers?limit=100', { method: 'GET' }, 'Error loading data from server'),
        apiRequest<MaybeEnvelopedList<{ id: number; name: string }>>('/products?limit=100', { method: 'GET' }, 'Error loading data from server'),
      ]);

      const modifiersData = Array.isArray(modifiersJson)
        ? modifiersJson
        : (modifiersJson.data || modifiersJson.items || []);
      const productsData = Array.isArray(productsJson)
        ? productsJson
        : (productsJson.data || productsJson.items || []);

      // Map modifiers
      const mappedModifiers = modifiersData.map((m: { id: number; name: string; priceDelta: number | string; isActive?: boolean; product?: { id: number; name: string } | null }) => ({
        id: m.id,
        name: m.name,
        priceDelta: m.priceDelta,
        isActive: m.isActive !== undefined ? m.isActive : true,
        product: m.product ? { id: m.product.id, name: m.product.name } : null
      }));

      // Mapear productos
      const mappedProducts = productsData.map((p: { id: number; name: string }) => ({
        id: p.id,
        name: p.name
      }));

      setModifiers(mappedModifiers);
      setProducts(mappedProducts);
    } catch (err: unknown) {
      console.error('Error fetching modifiers data:', err);
      if (!silent) {
        setError('Failed to load modifiers. Please check if the backend is running.');
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(() => {
      fetchAllData(false);
    });
  }, [fetchAllData]);

  // Periodic Auto Refresh Effect (Silent background sync)
  useEffect(() => {
    if (autoRefreshInterval <= 0) return;
    const timer = setInterval(() => {
      void fetchAllData(true);
    }, autoRefreshInterval * 1000);
    return () => clearInterval(timer);
  }, [autoRefreshInterval, fetchAllData]);

  // Status Counts for Pill Strip
  const modifierStatusCounts = useMemo(() => {
    const all = modifiers.length;
    const active = modifiers.filter((m) => m.isActive).length;
    const inactive = modifiers.filter((m) => !m.isActive).length;
    return { all, active, inactive };
  }, [modifiers]);

  const handleExportCSV = () => {
    if (filteredModifiers.length === 0) return;
    const headers = ['ID', 'Name', 'Price Delta', 'Associated Product', 'Status'];
    const rows = filteredModifiers.map(m => [m.id, `"${m.name.replace(/"/g, '""')}"`, m.priceDelta, `"${m.product?.name || 'None'}"`, m.isActive ? 'Active' : 'Inactive']);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', `modifiers_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  const handlePrintTable = () => { window.print(); };

  const handleCopySummary = () => {
    const active = filteredModifiers.filter(m => m.isActive).length;
    navigator.clipboard.writeText(`Modifiers & Toppings: ${filteredModifiers.length} total, ${active} active, ${filteredModifiers.length - active} inactive.`);
  };

  const filteredModifiers = useMemo(() => {
    return modifiers.filter((m) => {
      const matchesSearch =
        m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (m.product?.name || '').toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus =
        statusFilter === 'All' ||
        statusFilter === 'All Status' ||
        (statusFilter === 'Active' && m.isActive) ||
        (statusFilter === 'Inactive' && !m.isActive);

      const matchesProduct =
        productFilter === 'All' ||
        productFilter === 'All Products' ||
        (m.product && String(m.product.id) === productFilter) ||
        (!m.product && productFilter === 'None');

      return matchesSearch && matchesStatus && matchesProduct;
    });
  }, [modifiers, searchQuery, statusFilter, productFilter]);

  const totalPages = Math.ceil(filteredModifiers.length / pageSize) || 1;
  const paginatedModifiers = pageSize === 9999
    ? filteredModifiers
    : filteredModifiers.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const formatPrice = (price: number | string) => {
    const num = typeof price === 'number' ? price : parseFloat(price);
    if (isNaN(num)) return '$0.00';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(num);
  };

  const handleOpenAddModal = () => {
    setModalMode('add');
    setEditingModifierId(null);
    setFormName('');
    setFormPriceDelta('');
    setFormProduct(products.length > 0 ? String(products[0].id) : 'NULL');
    setFormIsActive(true);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (m: Modifier) => {
    setModalMode('edit');
    setEditingModifierId(m.id);
    setFormName(m.name);
    setFormPriceDelta(String(m.priceDelta));
    setFormProduct(m.product ? String(m.product.id) : 'NULL');
    setFormIsActive(m.isActive);
    setIsModalOpen(true);
  };

  // Toggle modifier active/inactive quickly
  const handleToggleActive = (m: Modifier) => {
    setConfirmTargetModifier(m);
    setToggleError(null);
    setIsConfirmModalOpen(true);
  };

  const executeToggleActive = async () => {
    if (!confirmTargetModifier) return;
    setIsToggling(true);
    setToggleError(null);
    try {
      await apiRequest<void>(
        `/modifiers/${confirmTargetModifier.id}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ isActive: !confirmTargetModifier.isActive })
        },
        'Error updating modifier status.',
      );
      setModifiers((prevModifiers) =>
        prevModifiers.map((mod) =>
          mod.id === confirmTargetModifier.id ? { ...mod, isActive: !confirmTargetModifier.isActive } : mod
        )
      );
      setIsConfirmModalOpen(false);
      setConfirmTargetModifier(null);
    } catch (err: unknown) {
      console.error(err);
      const msg = err instanceof Error ? err.message : 'Error updating modifier status';
      setToggleError(msg);
    } finally {
      setIsToggling(false);
    }
  };

  const handleSaveModifier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formPriceDelta.trim() || formProduct === 'NULL') {
      alert('Please fill in all required fields.');
      return;
    }

    const deltaNum = parseFloat(formPriceDelta);
    if (isNaN(deltaNum) || deltaNum < 0) {
      alert('Delta price must be a non-negative number.');
      return;
    }

    try {
      const bodyData: { name: string; priceDelta: number; isActive: boolean; productId?: number } = {
        name: formName,
        priceDelta: deltaNum,
        isActive: formIsActive
      };

      if (modalMode === 'add') {
        bodyData.productId = parseInt(formProduct);
        await apiRequest<void>(
          '/modifiers',
          { method: 'POST', body: JSON.stringify(bodyData) },
          'Error creating modifier.',
        );
      } else if (modalMode === 'edit' && editingModifierId) {
        await apiRequest<void>(
          `/modifiers/${editingModifierId}`,
          { method: 'PATCH', body: JSON.stringify(bodyData) },
          'Error updating modifier.',
        );
      }

      setIsModalOpen(false);
      fetchAllData();
    } catch (err: unknown) {
      console.error(err);
      const msg = err instanceof Error ? err.message : 'Error saving modifier';
      alert(msg);
    }
  };

  // Calculate visible columns for colSpan
  const visibleColumnsCount = Object.values(visibleColumns).filter(Boolean).length;
  const densityPadding = getDensityPadding(rowDensity);

  return (
    <div className="flex flex-col gap-6 animate-fade-in text-left font-sans">
      <div ref={topRef} />

      {/* Section Title */}
      <div className="bg-white border border-[#e8e2d8] p-6 rounded shadow-sm">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-[#ae001a] text-2xl">
            tune
          </span>
          <div>
            <h2 className="text-[#ae001a] font-bold text-heading-lg tracking-wider uppercase font-sans">
              Product Modifiers & Extra Add-ons
            </h2>
            <p className="text-[#5f5e5e] text-body-sm font-sans mt-1">
              Configure custom options, extra ingredients, and price modifiers linked directly to master catalog products.
            </p>
          </div>
        </div>
      </div>

      {/* 2. Canonical Unified Filter Toolbar */}
      <div className="bg-white border border-[#e8e2d8] rounded-xl p-4 sm:p-5 shadow-sm flex flex-col gap-4">
        {/* Row 1: Search and Product selector on left, Auto Refresh on right */}
        <div className="flex flex-wrap lg:flex-nowrap items-center justify-between gap-2.5 w-full">
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 flex-1 min-w-0">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[170px] max-w-sm">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-lg text-[#5f5e5e]">
                search
              </span>
              <input
                type="text"
                placeholder="Search modifiers by name or product..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="h-[34px] w-full pl-9 pr-8 text-xs rounded-lg border border-[#d5cfc4] focus:outline-none focus:border-[#ae001a] bg-[#fcfcfb] text-[#1d1c17] placeholder:text-[#8c857b] transition-colors duration-200"
                aria-label="Search modifiers"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[#5f5e5e] hover:text-[#ae001a] transition-colors duration-200 cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Product Dropdown Selector */}
            <div className="flex items-center gap-1.5 text-xs text-[#5f5e5e] shrink-0">
              <span className="material-symbols-outlined text-base">inventory_2</span>
              <select
                aria-label="Filter by product"
                value={productFilter}
                onChange={(e) => {
                  setProductFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="h-[34px] px-3 bg-[#fcfcfb] rounded-lg border border-[#d5cfc4] text-xs focus:border-[#ae001a] outline-none font-sans text-[#1d1c17] cursor-pointer max-w-[180px] transition-colors duration-200"
              >
                <option value="All">All Products</option>
                {products.map((p) => (
                  <option key={p.id} value={String(p.id)}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Canonical Auto Refresh */}
            <div className="flex items-center h-[34px] px-2.5 rounded-lg border border-[#d5cfc4] bg-[#fcfcfb] gap-1.5 text-xs text-[#5f5e5e] shrink-0">
              <button
                type="button"
                onClick={() => void fetchAllData(false)}
                disabled={isLoading || isRefreshing}
                className="text-[#5f5e5e] hover:text-[#ae001a] transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center"
                title="Refresh modifiers now"
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
          </div>
        </div>

        {/* Row 2: STATUS Pills Strip on left, Primary Add Button on right (NO reload button) */}
        <div className="flex items-center justify-between gap-3 pt-3 border-t border-[#f0ede6] min-w-0">
          {/* Left: STATUS Pills Strip */}
          <div className="flex-1 min-w-0 flex items-center gap-1 overflow-x-auto scrollbar-none [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            <span className="text-[9.5px] font-bold uppercase tracking-wider text-[#5f5e5e] shrink-0 mr-0.5">
              Status:
            </span>

            {/* All Pill */}
            <button
              type="button"
              onClick={() => {
                setStatusFilter('All Status');
                setCurrentPage(1);
              }}
              className={`flex items-center gap-0.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold transition-all duration-200 cursor-pointer whitespace-nowrap shrink-0 border ${
                statusFilter === 'All Status' || statusFilter === 'All'
                  ? 'bg-[#1d1c17] text-white border-[#1d1c17] shadow-xs'
                  : 'bg-white text-[#5f5e5e] border-[#d5cfc4] hover:bg-[#fcfcfb] hover:text-[#ae001a]'
              }`}
            >
              <span>All</span>
              <span
                className={`text-[8.5px] px-1 py-0 rounded-full font-bold ${
                  statusFilter === 'All Status' || statusFilter === 'All' ? 'bg-white/20 text-white' : 'bg-zinc-100 text-[#5f5e5e]'
                }`}
              >
                {modifierStatusCounts.all}
              </span>
            </button>

            {/* Active Pill */}
            <button
              type="button"
              onClick={() => {
                setStatusFilter(statusFilter === 'Active' ? 'All Status' : 'Active');
                setCurrentPage(1);
              }}
              className={`flex items-center gap-0.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold transition-all duration-200 cursor-pointer whitespace-nowrap shrink-0 border ${
                statusFilter === 'Active'
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                  : 'bg-white text-emerald-800 border-emerald-200 hover:bg-emerald-50'
              }`}
            >
              <span className="material-symbols-outlined text-[12px]">check_circle</span>
              <span>ACTIVE</span>
              <span
                className={`text-[8.5px] px-1 py-0 rounded-full font-bold ${
                  statusFilter === 'Active' ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-800'
                }`}
              >
                {modifierStatusCounts.active}
              </span>
            </button>

            {/* Inactive Pill */}
            <button
              type="button"
              onClick={() => {
                setStatusFilter(statusFilter === 'Inactive' ? 'All Status' : 'Inactive');
                setCurrentPage(1);
              }}
              className={`flex items-center gap-0.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold transition-all duration-200 cursor-pointer whitespace-nowrap shrink-0 border ${
                statusFilter === 'Inactive'
                  ? 'bg-zinc-700 text-white border-zinc-700 shadow-xs'
                  : 'bg-white text-zinc-700 border-zinc-300 hover:bg-zinc-50'
              }`}
            >
              <span className="material-symbols-outlined text-[12px]">block</span>
              <span>INACTIVE</span>
              <span
                className={`text-[8.5px] px-1 py-0 rounded-full font-bold ${
                  statusFilter === 'Inactive' ? 'bg-white/20 text-white' : 'bg-zinc-100 text-zinc-700'
                }`}
              >
                {modifierStatusCounts.inactive}
              </span>
            </button>
          </div>

          {/* Right: Primary Add Button */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleOpenAddModal}
              className="h-[34px] px-4 rounded-lg bg-[#ae001a] text-white font-bold text-xs hover:bg-[#d2272f] transition-colors flex items-center gap-1.5 font-sans cursor-pointer shadow-xs whitespace-nowrap shrink-0"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              ADD MODIFIER
            </button>
          </div>
        </div>
      </div>

      {/* Modifiers Directory Table */}
      <div className="bg-white border border-[#e8e2d8] overflow-hidden rounded shadow-sm">
        {/* Header Oscuro #222222 */}
        <div className="p-4 bg-[#222222] flex justify-between items-center relative">
          <div className="flex items-center gap-3">
            <span className="text-label-caps font-bold text-white uppercase tracking-wider font-sans">
              MODIFIERS DIRECTORY
            </span>
            <span className="text-[10px] font-mono font-bold bg-[#333333] text-zinc-300 px-2 py-0.5 rounded border border-[#444444]">
              {filteredModifiers.length} {filteredModifiers.length === 1 ? 'modifier' : 'modifiers'}
            </span>
          </div>

          <TableOptionsMenu
            onExportCSV={handleExportCSV}
            onPrint={handlePrintTable}
            onCopySummary={handleCopySummary}
            onReload={() => void fetchAllData(false)}
            columns={[
              { key: 'name', label: 'Modifier Name' },
              { key: 'product', label: 'Associated Product' },
              { key: 'priceDelta', label: 'Delta Price' },
              { key: 'status', label: 'Status' },
              { key: 'actions', label: 'Actions' },
            ]}
            visibleColumns={visibleColumns}
            onToggleColumn={(key) =>
              setVisibleColumns((prev) => ({
                ...prev,
                [key]: !prev[key as keyof typeof visibleColumns],
              }))
            }
            rowDensity={rowDensity}
            onChangeDensity={setRowDensity}
            totalItems={filteredModifiers.length}
            pageSize={pageSize}
            onChangePageSize={(size) => {
              setPageSize(size);
              setCurrentPage(1);
            }}
            currentPage={currentPage}
            onPageChange={setCurrentPage}
          />
        </div>
        <div className="overflow-x-auto scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          <table className="w-full table-fixed border-collapse">
            <thead className="bg-[#ece8e0] border-b border-[#e8e2d8]">
              <tr>
                {visibleColumns.name && (
                  <th className={`${densityPadding} text-left text-label-caps font-semibold text-[#5f5e5e] font-sans text-xs w-auto min-w-[180px]`}>
                    Modifier Name
                  </th>
                )}
                {visibleColumns.product && (
                  <th className={`${densityPadding} text-left text-label-caps font-semibold text-[#5f5e5e] font-sans text-xs w-44 min-w-[130px]`}>
                    Associated Product
                  </th>
                )}
                {visibleColumns.priceDelta && (
                  <th className={`${densityPadding} text-right text-label-caps font-semibold text-[#5f5e5e] font-sans text-xs w-36 min-w-[110px]`}>
                    Delta Price
                  </th>
                )}
                {visibleColumns.status && (
                  <th className={`${densityPadding} text-center text-label-caps font-semibold text-[#5f5e5e] font-sans text-xs w-28 min-w-[90px]`}>
                    Status
                  </th>
                )}
                {visibleColumns.actions && (
                  <th className={`${densityPadding} text-center text-label-caps font-semibold text-[#5f5e5e] font-sans text-xs w-28 min-w-[90px]`}>
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e8e2d8] text-xs font-sans">
              {visibleColumnsCount === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <NoColumnsEmptyState />
                  </td>
                </tr>
              ) : isLoading ? (
                <tr>
                  <td colSpan={visibleColumnsCount} className="px-6 py-12 text-center text-secondary font-sans bg-white">
                    <span className="material-symbols-outlined animate-spin text-[#ae001a] text-4xl block mb-2 mx-auto select-none">
                      sync
                    </span>
                    <p className="text-secondary text-body-md mt-2 font-sans">Loading modifiers catalog...</p>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={visibleColumnsCount} className="px-6 py-12 text-center text-[#ba1a1a] font-sans bg-white">
                    <span className="material-symbols-outlined text-[#ba1a1a] text-4xl block mb-2 mx-auto select-none">
                      error
                    </span>
                    <p className="font-bold">{error}</p>
                    <button
                      onClick={() => void fetchAllData(false)}
                      className="mt-4 px-4 py-2 bg-[#222222] text-white font-bold text-label-caps hover:bg-[#ae001a] transition-all font-sans cursor-pointer"
                    >
                      Retry Connection
                    </button>
                  </td>
                </tr>
              ) : modifiers.length === 0 ? (
                <TableEmptyState
                  colSpan={visibleColumnsCount}
                  icon="tune"
                  title="No modifiers found"
                  description="Click 'Add Modifier' to start building your modifiers catalog."
                />
              ) : filteredModifiers.length === 0 ? (
                <TableEmptyState
                  colSpan={visibleColumnsCount}
                  icon="tune"
                  title="No modifiers found"
                  description="No modifiers match the selected filter criteria."
                />
              ) : (
                paginatedModifiers.map((modifier) => {
                  const isInactive = !modifier.isActive;
                  return (
                    <tr
                      key={modifier.id}
                      className={`category-row group transition-colors ${
                        isInactive ? 'bg-[#f8f3eb]/40 opacity-75' : 'hover:bg-[#f8f3eb]'
                      }`}
                    >
                      {visibleColumns.name && (
                        <td className={`${densityPadding} truncate`}>
                          <p className={`font-bold text-[#1d1c17] font-sans text-sm truncate ${isInactive ? 'line-through opacity-75' : ''}`} title={modifier.name}>{modifier.name}</p>
                        </td>
                      )}
                      {visibleColumns.product && (
                        <td className={`${densityPadding} text-xs font-normal text-[#5f5e5e] font-sans truncate`}>
                          <span title={modifier.product ? modifier.product.name : 'No Product'}>
                            {modifier.product ? modifier.product.name : 'No Product'}
                          </span>
                        </td>
                      )}
                      {visibleColumns.priceDelta && (
                        <td className={`${densityPadding} text-right font-mono font-normal text-xs text-emerald-700 whitespace-nowrap`}>
                          +{formatPrice(modifier.priceDelta)}
                        </td>
                      )}
                      {visibleColumns.status && (
                        <td className={`${densityPadding} text-center whitespace-nowrap`}>
                          <span
                            className={`text-[10px] px-2.5 py-0.5 font-bold rounded uppercase font-sans whitespace-nowrap ${
                              modifier.isActive
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-zinc-200 text-[#5f5e5e]'
                            }`}
                          >
                            {modifier.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                      )}
                      {visibleColumns.actions && (
                        <td className={`${densityPadding} text-center whitespace-nowrap`}>
                          <div className="flex justify-center gap-3">
                            {modifier.isActive ? (
                              <>
                                <button
                                  onClick={() => handleOpenEditModal(modifier)}
                                  className="p-1 text-[#5f5e5e] hover:text-[#ae001a] transition-colors cursor-pointer"
                                  title="Edit modifier"
                                >
                                  <span className="material-symbols-outlined text-[20px]">edit</span>
                                </button>
                                <button
                                  onClick={() => void handleToggleActive(modifier)}
                                  className="p-1 text-[#5f5e5e] hover:text-[#ae001a] transition-colors cursor-pointer"
                                  title="Deactivate modifier"
                                >
                                  <span className="material-symbols-outlined text-[20px]">block</span>
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={() => void handleToggleActive(modifier)}
                                className="p-1 text-[#5f5e5e] hover:text-emerald-600 transition-colors cursor-pointer"
                                title="Activate modifier"
                              >
                                <span className="material-symbols-outlined text-[20px]">check_circle_outline</span>
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
        <TablePaginationFooter
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          totalItems={filteredModifiers.length}
          onPageChange={setCurrentPage}
          onPageSizeChange={(size: number) => {
            setPageSize(size);
            setCurrentPage(1);
          }}
        />
      </div>

      {/* Interactive Add / Edit Modifier Modal */}
      {isModalOpen && createPortal(
        <div className="fixed inset-0 bg-black/60 z-[9999] flex justify-center items-start overflow-y-auto p-2 md:pt-4 md:pb-12 backdrop-blur-sm">
          <div className="bg-white border border-[#e8e2d8] rounded shadow-2xl w-full max-w-md overflow-hidden animate-fade-in text-left max-h-[90vh] flex flex-col">
            <div className="bg-[#222222] p-4 text-white flex justify-between items-center shrink-0">
              <span className="font-bold text-label-caps uppercase tracking-wider font-sans">
                {modalMode === 'add' ? 'Add Modifier' : 'Edit Modifier'}
              </span>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-white/70 hover:text-white transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <form onSubmit={handleSaveModifier} className="flex-1 flex flex-col min-h-0">
              <div className="p-6 space-y-4 overflow-y-auto flex-1">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold text-[#5f5e5e] uppercase font-sans">
                    Modifier Name
                  </label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="bg-white text-[#1d1c17] px-3 py-2 border border-[#e8e2d8] rounded text-body-md focus:border-[#ae001a] focus:ring-1 focus:ring-[#ae001a] outline-none w-full font-sans"
                    placeholder="e.g., Extra Cheese, No Onions, Gluten Free"
                    required
                  />
                </div>

                {modalMode === 'add' && (
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold text-[#5f5e5e] uppercase font-sans">
                      Associated Product
                    </label>
                    <select
                      value={formProduct}
                      onChange={(e) => setFormProduct(e.target.value)}
                      className="bg-white text-[#1d1c17] px-3 py-2 border border-[#e8e2d8] rounded text-body-md focus:border-[#ae001a] focus:ring-1 focus:ring-[#ae001a] outline-none w-full font-sans"
                    >
                      <option value="NULL" disabled>Select a product...</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold text-[#5f5e5e] uppercase font-sans">
                    Price Delta ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formPriceDelta}
                    onChange={(e) => setFormPriceDelta(e.target.value)}
                    className="bg-white text-[#1d1c17] px-3 py-2 border border-[#e8e2d8] rounded text-body-md focus:border-[#ae001a] focus:ring-1 focus:ring-[#ae001a] outline-none w-full font-mono"
                    placeholder="e.g., 1.50"
                    required
                    min="0"
                  />
                </div>
              </div>
              <div className="p-6 pt-4 border-t border-[#e8e2d8] flex justify-end gap-3 shrink-0 bg-[#fefbf6]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-[#222222] text-[#222222] font-bold text-label-caps hover:bg-zinc-100 transition-colors font-sans cursor-pointer"
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#ae001a] text-white font-bold text-label-caps hover:bg-[#d2272f] transition-colors font-sans cursor-pointer"
                >
                  SAVE MODIFIER
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      <EmergencySupportModal
        isOpen={isSupportOpen}
        onClose={() => setIsSupportOpen(false)}
      />

      {/* Activation/deactivation confirmation modal */}
      {isConfirmModalOpen && confirmTargetModifier && (
        <div className="fixed inset-0 z-[10000] overflow-y-auto flex items-center justify-center p-4 font-sans">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-300"
            onClick={() => setIsConfirmModalOpen(false)}
          />

          {/* Modal Box */}
          <div className="relative bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-zinc-200 animate-scale-in">
            <div className="flex items-start gap-4">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${
                confirmTargetModifier.isActive 
                  ? 'bg-red-50 border border-red-100 text-[#ae001a]'
                  : 'bg-emerald-50 border border-emerald-100 text-emerald-600'
              }`}>
                <span className="material-symbols-outlined text-2xl block">
                  {confirmTargetModifier.isActive ? 'power_settings_new' : 'check_circle'}
                </span>
              </div>
              <div className="space-y-2">
                <h3 className="text-body-md font-bold text-zinc-900 font-sans">
                  {confirmTargetModifier.isActive ? 'Confirm Deactivation' : 'Confirm Activation'}
                </h3>
                <p className="text-body-xs text-zinc-500 leading-relaxed font-sans">
                  Are you sure you want to {confirmTargetModifier.isActive ? 'deactivate' : 'activate'} this modifier? This action will set the status to {confirmTargetModifier.isActive ? 'inactive' : 'active'}.
                </p>
              </div>
            </div>

            {toggleError && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-800 rounded-lg text-body-xs font-bold flex items-center gap-2">
                <span className="material-symbols-outlined text-sm block">error</span>
                <span>{toggleError}</span>
              </div>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsConfirmModalOpen(false)}
                className="px-4 py-2 text-body-xs font-bold border border-zinc-200 rounded-lg text-zinc-700 hover:bg-zinc-50 transition-all duration-200 cursor-pointer font-sans"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeToggleActive}
                disabled={isToggling}
                className={`px-4 py-2 text-white text-body-xs font-bold rounded-lg transition-all duration-200 disabled:opacity-50 cursor-pointer flex items-center gap-1.5 font-sans ${
                  confirmTargetModifier.isActive
                    ? 'bg-red-600 hover:bg-[#ae001a]'
                    : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {isToggling ? (
                  <>
                    <span className="material-symbols-outlined text-sm animate-spin block">sync</span>
                    <span>Processing...</span>
                  </>
                ) : (
                  <span>{confirmTargetModifier.isActive ? 'Deactivate' : 'Activate'}</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Persistent Quick Links Hub */}
      <CatalogQuickLinks current="modifiers" onNavigate={onNavigate} />

      {/* Persistent Inventory Navigation Hub Bar */}
      <InventoryNavHubBar activeModuleId="modifiers" onNavigate={onNavigate} />
    </div>
  );
};

export default ModifiersView;
