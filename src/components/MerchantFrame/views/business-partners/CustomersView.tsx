import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import type { Customer, CreateCustomerPayload, UpdateCustomerPayload } from '../../../../types/customer';
import { fetchCustomers, createCustomer, updateCustomer, deleteCustomer } from '../../../../api/customers';
import { getCurrentMerchantId } from '../../../../api/users';
import {
  filterCustomers,
  getUniqueCities,
  getUniqueStates,
  getUniqueCountries,
  resolveOrdersCount,
  resolveLoyaltyCount,
  hasRutAssigned,
} from '../../../../lib/customers';
import { BusinessPartnersQuickLinks } from './BusinessPartnersQuickLinks';
import { SideDrawer } from '../../shared/SideDrawer';
import {
  TableOptionsMenu,
  TablePaginationFooter,
  NoColumnsEmptyState,
  type TableDensity,
} from '../../../shared/TableOptionsMenu';
import { getDensityPadding } from '../../../shared/tableOptionsHelpers';

export interface CustomersViewProps {
  onNavigate?: (view: string) => void;
  companyId?: number | string;
  merchantId?: number | string;
}

export const CustomersView: React.FC<CustomersViewProps> = ({
  onNavigate,
  companyId,
  merchantId,
}) => {
  const topRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll to top on view mount
  useEffect(() => {
    if (topRef.current && typeof topRef.current.scrollIntoView === 'function') {
      topRef.current.scrollIntoView({ behavior: 'instant' });
    }
  }, []);

  const activeCompanyId = companyId ?? 1;
  const activeMerchantId = merchantId ?? getCurrentMerchantId() ?? 1;

  // Master Data State
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Search & Filter State
  const [searchInput, setSearchInput] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [selectedCity, setSelectedCity] = useState<string>('');
  const [selectedState, setSelectedState] = useState<string>('');
  const [selectedCountry, setSelectedCountry] = useState<string>('');

  // Table Configuration & Pagination State
  const [rowDensity, setRowDensity] = useState<TableDensity>('comfortable');
  const [pageSize, setPageSize] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({
    identity: true,
    contact: true,
    rut: true,
    location: true,
    activity: true,
    actions: true,
  });

  // Drawer & Modal State
  const [isFormDrawerOpen, setIsFormDrawerOpen] = useState<boolean>(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isDetailDrawerOpen, setIsDetailDrawerOpen] = useState<boolean>(false);

  // Soft-Delete Dialog State
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Form Fields
  const [formName, setFormName] = useState<string>('');
  const [formRut, setFormRut] = useState<string>('');
  const [formEmail, setFormEmail] = useState<string>('');
  const [formPhone, setFormPhone] = useState<string>('');
  const [formAddress, setFormAddress] = useState<string>('');
  const [formCity, setFormCity] = useState<string>('');
  const [formState, setFormState] = useState<string>('');
  const [formCountry, setFormCountry] = useState<string>('');
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Toast Notification
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Keyboard accessibility: Close modals/drawers on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isDeleteDialogOpen) {
          setIsDeleteDialogOpen(false);
        } else if (isFormDrawerOpen) {
          setIsFormDrawerOpen(false);
        } else if (isDetailDrawerOpen) {
          setIsDetailDrawerOpen(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDeleteDialogOpen, isFormDrawerOpen, isDetailDrawerOpen]);

  // Real-time debounced lookup against name, email, or rut
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput);
      setCurrentPage(1);
    }, 200);

    return () => clearTimeout(timer);
  }, [searchInput]);

  // Dynamic Dataset Hydration & Tenant Scoping
  const loadCustomers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchCustomers(activeCompanyId);
      setCustomers(data);
    } catch (err: unknown) {
      console.error('Error fetching customers:', err);
      setError('Failed to load enterprise customer records. Please verify backend connection.');
    } finally {
      setIsLoading(false);
    }
  }, [activeCompanyId]);

  useEffect(() => {
    void loadCustomers();
  }, [loadCustomers]);

  // Dynamic extraction of unique geographic filter options
  const uniqueCities = useMemo(() => getUniqueCities(customers), [customers]);
  const uniqueStates = useMemo(() => getUniqueStates(customers), [customers]);
  const uniqueCountries = useMemo(() => getUniqueCountries(customers), [customers]);

  // Real-time search and multi-criteria filtered dataset
  const filteredCustomers = useMemo(() => {
    return filterCustomers(customers, {
      searchQuery: debouncedSearch,
      city: selectedCity,
      state: selectedState,
      country: selectedCountry,
    });
  }, [customers, debouncedSearch, selectedCity, selectedState, selectedCountry]);

  // Pagination calculation
  const totalItems = filteredCustomers.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  const paginatedCustomers = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredCustomers.slice(start, start + pageSize);
  }, [filteredCustomers, currentPage, pageSize]);

  const hasActiveFilters = Boolean(
    searchInput.trim() || selectedCity || selectedState || selectedCountry,
  );

  const clearFilters = () => {
    setSearchInput('');
    setDebouncedSearch('');
    setSelectedCity('');
    setSelectedState('');
    setSelectedCountry('');
    setCurrentPage(1);
  };

  // Empty state evaluations
  const isTrueEmpty = !isLoading && !error && customers.length === 0;
  const isFilteredEmpty = !isLoading && !error && customers.length > 0 && filteredCustomers.length === 0;

  // Form Handlers
  const handleOpenAdd = () => {
    setFormMode('create');
    setSelectedCustomer(null);
    setFormName('');
    setFormRut('');
    setFormEmail('');
    setFormPhone('');
    setFormAddress('');
    setFormCity('');
    setFormState('');
    setFormCountry('');
    setFormErrors({});
    setIsFormDrawerOpen(true);
  };

  const handleOpenEdit = (customer: Customer, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setFormMode('edit');
    setSelectedCustomer(customer);
    setFormName(customer.name || '');
    setFormRut(customer.rut || '');
    setFormEmail(customer.email || '');
    setFormPhone(customer.phone || '');
    setFormAddress(customer.address || '');
    setFormCity(customer.city || '');
    setFormState(customer.state || '');
    setFormCountry(customer.country || '');
    setFormErrors({});
    setIsFormDrawerOpen(true);
  };

  const handleOpenDetail = (customer: Customer) => {
    setSelectedCustomer(customer);
    setIsDetailDrawerOpen(true);
  };

  const handleOpenDelete = (customer: Customer, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setCustomerToDelete(customer);
    setIsDeleteDialogOpen(true);
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    // Mandatory: name
    if (!formName.trim()) {
      errors.name = 'Customer name is required.';
    } else if (formName.trim().length < 2) {
      errors.name = 'Customer name must be at least 2 characters.';
    }

    // Mandatory: rut
    if (!formRut.trim()) {
      errors.rut = 'Tax identification (RUT) is required.';
    }

    // Mandatory: email
    if (!formEmail.trim()) {
      errors.email = 'Contact email is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formEmail.trim())) {
      errors.email = 'Please provide a valid email format.';
    }

    // Mandatory: address
    if (!formAddress.trim()) {
      errors.address = 'Street address is required.';
    }

    // Mandatory: city
    if (!formCity.trim()) {
      errors.city = 'City is required.';
    }

    // Mandatory: state
    if (!formState.trim()) {
      errors.state = 'State / Region is required.';
    }

    // Mandatory: country
    if (!formCountry.trim()) {
      errors.country = 'Country is required.';
    }

    // Optional: phone (no required check)

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    const now = new Date().toISOString();

    try {
      if (formMode === 'create') {
        const payload: CreateCustomerPayload = {
          name: formName.trim(),
          rut: formRut.trim(),
          email: formEmail.trim(),
          phone: formPhone.trim() || undefined,
          address: formAddress.trim(),
          city: formCity.trim(),
          state: formState.trim(),
          country: formCountry.trim(),
          companyId: activeCompanyId,
          merchantId: activeMerchantId,
          created_at: now,
          updated_at: now,
        };

        const created = await createCustomer(payload);
        const customerWithId: Customer = {
          ...created,
          id: created.id || Date.now(),
          name: payload.name,
          rut: payload.rut ?? null,
          email: payload.email ?? null,
          phone: payload.phone ?? null,
          address: payload.address ?? null,
          city: payload.city ?? null,
          state: payload.state ?? null,
          country: payload.country ?? null,
          companyId: activeCompanyId,
          merchantId: activeMerchantId,
          created_at: created.created_at ?? now,
          updated_at: created.updated_at ?? now,
          orders: created.orders ?? [],
          loyaltyCustomers: created.loyaltyCustomers ?? [],
        };

        setCustomers((prev) => [customerWithId, ...prev]);
        showToast('Customer created successfully.', 'success');
      } else if (formMode === 'edit' && selectedCustomer) {
        const payload: UpdateCustomerPayload = {
          name: formName.trim(),
          rut: formRut.trim(),
          email: formEmail.trim(),
          phone: formPhone.trim() || undefined,
          address: formAddress.trim(),
          city: formCity.trim(),
          state: formState.trim(),
          country: formCountry.trim(),
          companyId: activeCompanyId,
          merchantId: activeMerchantId,
          updated_at: now,
        };

        const updated = await updateCustomer(selectedCustomer.id, payload);
        const mergedCustomer: Customer = {
          ...selectedCustomer,
          ...updated,
          name: payload.name ?? selectedCustomer.name,
          rut: payload.rut ?? selectedCustomer.rut,
          email: payload.email ?? selectedCustomer.email,
          phone: payload.phone ?? selectedCustomer.phone,
          address: payload.address ?? selectedCustomer.address,
          city: payload.city ?? selectedCustomer.city,
          state: payload.state ?? selectedCustomer.state,
          country: payload.country ?? selectedCustomer.country,
          companyId: activeCompanyId,
          merchantId: activeMerchantId,
          updated_at: now,
        };

        setCustomers((prev) =>
          prev.map((c) => (c.id === selectedCustomer.id ? mergedCustomer : c)),
        );
        setSelectedCustomer(mergedCustomer);
        showToast('Customer profile updated.', 'success');
      }
      setIsFormDrawerOpen(false);
    } catch (err: unknown) {
      console.error('Customer form submit error:', err);
      showToast(
        err instanceof Error ? err.message : 'Error processing customer operation.',
        'error',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Soft-Delete Handler
  const handleConfirmDelete = async () => {
    if (!customerToDelete) return;
    setIsDeleting(true);
    try {
      await deleteCustomer(customerToDelete.id);
      // Instantly remove from active lookups preserving historical transactional integrity
      setCustomers((prev) => prev.filter((c) => c.id !== customerToDelete.id));
      showToast(
        `Customer "${customerToDelete.name}" soft-deleted. Historical records preserved.`,
        'success',
      );
      setIsDeleteDialogOpen(false);
      if (selectedCustomer?.id === customerToDelete.id) {
        setIsDetailDrawerOpen(false);
        setSelectedCustomer(null);
      }
      setCustomerToDelete(null);
    } catch (err: unknown) {
      console.error('Customer delete error:', err);
      showToast(
        err instanceof Error ? err.message : 'Failed to delete customer record.',
        'error',
      );
    } finally {
      setIsDeleting(false);
    }
  };

  // Table options handlers
  const handleExportCSV = () => {
    const headers = [
      'ID',
      'Name',
      'RUT',
      'Email',
      'Phone',
      'Address',
      'City',
      'State',
      'Country',
      'Orders',
      'Loyalty',
    ];
    const rows = filteredCustomers.map((c) => [
      `CUST-${c.id}`,
      `"${(c.name || '').replace(/"/g, '""')}"`,
      `"${c.rut || 'No RUT assigned'}"`,
      `"${c.email || ''}"`,
      `"${c.phone || ''}"`,
      `"${(c.address || '').replace(/"/g, '""')}"`,
      `"${c.city || ''}"`,
      `"${c.state || ''}"`,
      `"${c.country || ''}"`,
      resolveOrdersCount(c),
      resolveLoyaltyCount(c),
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `customer_directory_company_${activeCompanyId}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Customer directory exported to CSV.', 'success');
  };

  const handlePrint = () => {
    window.print();
  };

  const handleCopySummary = () => {
    const summary = `Customer Directory Summary (Company #${activeCompanyId}): ${customers.length} total enterprise customers loaded. Current filtered view: ${filteredCustomers.length} customers.`;
    navigator.clipboard?.writeText(summary);
    showToast('Summary copied to clipboard.', 'success');
  };

  const densityPadding = getDensityPadding(rowDensity);
  const visibleColumnCount = Object.values(visibleColumns).filter(Boolean).length;

  return (
    <div
      ref={topRef}
      className="flex flex-col gap-6 text-left w-full max-w-7xl mx-auto pb-12 animate-fade-in"
    >
      {/* Toast Notification */}
      {toast && (
        <div
          role="status"
          className={`fixed bottom-6 right-6 z-[10001] px-4 py-3 rounded shadow-lg text-white font-medium text-body-sm flex items-center gap-2 ${
            toast.type === 'error' ? 'bg-[#ba1a1a]' : 'bg-[#1b5e20]'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">
            {toast.type === 'error' ? 'error' : 'check_circle'}
          </span>
          <span>{toast.message}</span>
        </div>
      )}

      {/* Module Navigation Shortcuts */}
      <BusinessPartnersQuickLinks active="customers" onNavigate={onNavigate} />

      {/* Workspace Header Panel */}
      <div className="bg-white border border-[#e8e2d8] rounded-xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#ae001a] text-2xl">
              person
            </span>
            <h1 className="text-xl font-bold font-sans tracking-wide text-[#222222]">
              Customer Directory
            </h1>
            <span className="bg-[#f1ece4] text-[#5f5e5e] text-xs font-mono font-bold px-2.5 py-0.5 rounded border border-[#e8e2d8]">
              Tenant #{activeCompanyId}
            </span>
            <span className="bg-[#f1ece4] text-[#5f5e5e] text-xs font-mono font-bold px-2.5 py-0.5 rounded border border-[#e8e2d8]">
              Merchant #{activeMerchantId}
            </span>
          </div>
          <p className="text-secondary text-body-sm mt-1 font-sans">
            Centralized data grid with real-time alphanumeric search, multi-criteria regional filters, and operational record bindings.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={loadCustomers}
            disabled={isLoading}
            className="p-2.5 bg-white border border-[#e8e2d8] rounded hover:bg-[#fef9f1] text-secondary hover:text-[#ae001a] transition-all flex items-center justify-center cursor-pointer disabled:opacity-50"
            title="Reload customers dataset"
            aria-label="Reload customers"
          >
            <span
              className={`material-symbols-outlined text-[18px] ${
                isLoading ? 'animate-spin' : ''
              }`}
            >
              refresh
            </span>
          </button>

          <button
            type="button"
            onClick={handleOpenAdd}
            className="bg-[#ae001a] text-white font-bold text-label-caps px-5 py-2.5 rounded hover:bg-[#d2272f] transition-colors flex items-center gap-2 font-sans cursor-pointer shadow-sm"
          >
            <span className="material-symbols-outlined text-[18px]">person_add</span>
            ADD CUSTOMER
          </button>
        </div>
      </div>

      {/* Error State Banner */}
      {error && (
        <div className="border border-red-300 bg-red-50 p-6 rounded-lg text-center shadow-sm font-sans">
          <span className="material-symbols-outlined text-red-500 text-4xl" aria-hidden="true">
            error
          </span>
          <p className="mt-2 text-red-700 font-medium">{error}</p>
          <button
            type="button"
            onClick={loadCustomers}
            className="mt-4 px-5 py-2 bg-[#222222] text-white font-bold text-[11px] uppercase tracking-widest hover:bg-[#ae001a] transition-colors rounded cursor-pointer"
          >
            Retry Connection
          </button>
        </div>
      )}

      {/* Advanced Real-Time Searching & Filtration Bar */}
      {!isTrueEmpty && !error && (
        <div className="bg-white border border-[#e8e2d8] p-5 rounded-xl shadow-sm flex flex-col gap-4 font-sans">
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3">
            {/* Alphanumeric Search Bar */}
            <div className="relative flex-1 min-w-[240px]">
              <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[#5f5e5e] text-[20px] pointer-events-none">
                search
              </span>
              <input
                type="text"
                data-testid="customer-search-input"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search by name, email, or RUT..."
                className="w-full pl-10 pr-4 py-2.5 bg-[#fef9f1] rounded-lg border border-[#e8e2d8] focus:border-[#ae001a] focus:ring-1 focus:ring-[#ae001a] outline-none text-body-sm transition-all font-sans"
                aria-label="Search by name, email, or RUT"
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={() => setSearchInput('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5f5e5e] hover:text-[#ae001a] cursor-pointer"
                  aria-label="Clear search input"
                >
                  <span className="material-symbols-outlined text-[16px]">close</span>
                </button>
              )}
            </div>

            {/* Geographic & Regional Filters */}
            <div className="flex flex-wrap items-center gap-2.5">
              {/* City Filter */}
              <select
                data-testid="filter-city-select"
                value={selectedCity}
                onChange={(e) => {
                  setSelectedCity(e.target.value);
                  setCurrentPage(1);
                }}
                className="px-3 py-2.5 bg-[#fef9f1] border border-[#e8e2d8] rounded-lg text-body-sm focus:border-[#ae001a] outline-none min-w-[130px] font-sans"
                aria-label="Filter by City"
              >
                <option value="">All Cities</option>
                {uniqueCities.map((city) => (
                  <option key={city} value={city}>
                    {city}
                  </option>
                ))}
              </select>

              {/* State Filter */}
              <select
                data-testid="filter-state-select"
                value={selectedState}
                onChange={(e) => {
                  setSelectedState(e.target.value);
                  setCurrentPage(1);
                }}
                className="px-3 py-2.5 bg-[#fef9f1] border border-[#e8e2d8] rounded-lg text-body-sm focus:border-[#ae001a] outline-none min-w-[130px] font-sans"
                aria-label="Filter by State"
              >
                <option value="">All States</option>
                {uniqueStates.map((state) => (
                  <option key={state} value={state}>
                    {state}
                  </option>
                ))}
              </select>

              {/* Country Filter */}
              <select
                data-testid="filter-country-select"
                value={selectedCountry}
                onChange={(e) => {
                  setSelectedCountry(e.target.value);
                  setCurrentPage(1);
                }}
                className="px-3 py-2.5 bg-[#fef9f1] border border-[#e8e2d8] rounded-lg text-body-sm focus:border-[#ae001a] outline-none min-w-[130px] font-sans"
                aria-label="Filter by Country"
              >
                <option value="">All Countries</option>
                {uniqueCountries.map((country) => (
                  <option key={country} value={country}>
                    {country}
                  </option>
                ))}
              </select>

              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="px-3.5 py-2.5 border border-[#e8e2d8] text-secondary text-label-caps hover:bg-[#f2ede5] hover:text-[#ae001a] transition-colors rounded-lg flex items-center gap-1 cursor-pointer font-sans"
                >
                  <span className="material-symbols-outlined text-[16px]">filter_alt_off</span>
                  <span>Clear Filters</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 1. True Empty State Handling */}
      {isTrueEmpty && (
        <div
          data-testid="customers-empty-state"
          className="bg-white border border-[#e8e2d8] rounded-xl p-16 flex flex-col items-center text-center shadow-sm font-sans"
        >
          <div className="w-24 h-24 rounded-full bg-[#fcf0f2] flex items-center justify-center text-[#ae001a] mb-5 shadow-inner">
            <span className="material-symbols-outlined text-5xl select-none" aria-hidden="true">
              group_add
            </span>
          </div>

          <h3 className="text-lg font-bold text-[#222222]">
            Business Partners Network
          </h3>

          <p className="text-secondary mt-2 max-w-md text-sm leading-relaxed">
            No customers configured yet for this company profile. Click &apos;Add Customer&apos; to establish your business partners network.
          </p>

          <button
            type="button"
            onClick={handleOpenAdd}
            className="mt-6 px-6 py-3 bg-[#ae001a] hover:bg-[#930015] text-white text-label-caps font-bold transition-all rounded-lg flex items-center gap-2 shadow hover:shadow-md cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            <span>Add Customer</span>
          </button>
        </div>
      )}

      {/* 2. Filtered Empty State */}
      {isFilteredEmpty && (
        <div
          data-testid="customers-filtered-empty-state"
          className="bg-white border border-[#e8e2d8] rounded-xl p-12 flex flex-col items-center text-center shadow-sm font-sans"
        >
          <span className="material-symbols-outlined text-secondary text-5xl select-none mb-3">
            search_off
          </span>
          <h4 className="text-base font-bold text-[#222222]">
            No matching customers found
          </h4>
          <p className="text-secondary text-body-sm mt-1 max-w-md">
            No customers match the specified search term &ldquo;{debouncedSearch}&rdquo; and geographic filter criteria.
          </p>
          <button
            type="button"
            onClick={clearFilters}
            className="mt-4 px-4 py-2 border border-[#e8e2d8] text-secondary text-label-caps hover:bg-[#f2ede5] hover:text-[#ae001a] transition-colors rounded-lg cursor-pointer"
          >
            Clear Filters
          </button>
        </div>
      )}

      {/* 3. Core Grid Layout Data-Binding */}
      {!isTrueEmpty && !isFilteredEmpty && !error && (
        <div className="bg-white border border-[#e8e2d8] rounded-xl overflow-hidden shadow-sm animate-fade-in font-sans">
          {/* Dark Header Banner with Metrics and Table Options */}
          <div className="p-4 bg-[#222222] flex flex-wrap justify-between items-center gap-3 relative select-none">
            <div className="flex items-center gap-3">
              <span className="text-label-caps font-bold text-white uppercase tracking-wider">
                CUSTOMER DIRECTORY DATA GRID
              </span>
              <span className="text-[11px] font-mono font-bold bg-[#333333] text-zinc-300 px-2.5 py-0.5 rounded border border-[#444444]">
                {paginatedCustomers.length === filteredCustomers.length
                  ? `${filteredCustomers.length} customer${filteredCustomers.length === 1 ? '' : 's'}`
                  : `${paginatedCustomers.length} / ${filteredCustomers.length} customers`}
              </span>
            </div>

            <TableOptionsMenu
              onExportCSV={handleExportCSV}
              exportCSVLabel="Export Customers to CSV"
              onPrint={handlePrint}
              printLabel="Print Customer Directory"
              onCopySummary={handleCopySummary}
              copySummaryLabel="Copy Directory Summary"
              onReload={loadCustomers}
              columns={[
                { key: 'identity', label: 'Customer Identity' },
                { key: 'contact', label: 'Contact Channels' },
                { key: 'rut', label: 'Tax Identification Number' },
                { key: 'location', label: 'Geographic Location' },
                { key: 'activity', label: 'Linked Activity Badges' },
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
              totalItems={filteredCustomers.length}
              pageSize={pageSize}
              onChangePageSize={(size) => {
                setPageSize(size);
                setCurrentPage(1);
              }}
              currentPage={currentPage}
              onPageChange={setCurrentPage}
            />
          </div>

          {/* Table Canvas */}
          {visibleColumnCount === 0 ? (
            <NoColumnsEmptyState />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead className="bg-[#ece8e0] border-b border-[#e8e2d8]">
                  <tr>
                    {visibleColumns.identity && (
                      <th
                        scope="col"
                        className={`${densityPadding} text-left text-label-caps font-bold text-[#5f5e5e]`}
                      >
                        Customer Identity
                      </th>
                    )}
                    {visibleColumns.contact && (
                      <th
                        scope="col"
                        className={`${densityPadding} text-left text-label-caps font-bold text-[#5f5e5e]`}
                      >
                        Contact Channels
                      </th>
                    )}
                    {visibleColumns.rut && (
                      <th
                        scope="col"
                        className={`${densityPadding} text-left text-label-caps font-bold text-[#5f5e5e]`}
                      >
                        Tax Identification (RUT)
                      </th>
                    )}
                    {visibleColumns.location && (
                      <th
                        scope="col"
                        className={`${densityPadding} text-left text-label-caps font-bold text-[#5f5e5e]`}
                      >
                        Geographic Location
                      </th>
                    )}
                    {visibleColumns.activity && (
                      <th
                        scope="col"
                        className={`${densityPadding} text-center text-label-caps font-bold text-[#5f5e5e]`}
                      >
                        Linked Activity Badges
                      </th>
                    )}
                    {visibleColumns.actions && (
                      <th
                        scope="col"
                        className={`${densityPadding} text-right text-label-caps font-bold text-[#5f5e5e] w-32`}
                      >
                        Actions
                      </th>
                    )}
                  </tr>
                </thead>

                <tbody className="divide-y divide-[#e8e2d8] bg-white">
                  {isLoading ? (
                    <tr>
                      <td
                        colSpan={visibleColumnCount}
                        className="px-6 py-12 text-center text-secondary"
                      >
                        <span className="material-symbols-outlined animate-spin text-[#ae001a] text-3xl block mb-2 mx-auto">
                          sync
                        </span>
                        <span>Hydrating active enterprise customer profiles...</span>
                      </td>
                    </tr>
                  ) : (
                    paginatedCustomers.map((customer) => {
                      const ordersCount = resolveOrdersCount(customer);
                      const loyaltyCount = resolveLoyaltyCount(customer);
                      const isRutAssigned = hasRutAssigned(customer.rut);

                      return (
                        <tr
                          key={customer.id}
                          onClick={() => handleOpenDetail(customer)}
                          className="hover:bg-[#fcfaf7] transition-colors cursor-pointer group"
                        >
                          {/* Column 1: Customer Identity */}
                          {visibleColumns.identity && (
                            <td className={densityPadding}>
                              <div className="flex flex-col items-start gap-1">
                                <span className="font-semibold text-body-sm text-[#1d1c17] group-hover:text-[#ae001a] transition-colors">
                                  {customer.name}
                                </span>
                                <div className="flex items-center gap-1.5">
                                  <span className="inline-flex items-center font-mono text-[11px] font-semibold px-2 py-0.5 rounded bg-[#f1ece4] text-[#5f5e5e] border border-[#e8e2d8]">
                                    #CUST-{customer.id}
                                  </span>
                                  {customer.status && customer.status !== 'active' && (
                                    <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                                      {customer.status}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </td>
                          )}

                          {/* Column 2: Contact Channels */}
                          {visibleColumns.contact && (
                            <td className={densityPadding}>
                              <div className="flex flex-col gap-1 text-xs">
                                <div className="flex items-center gap-1.5 text-[#1d1c17]">
                                  <span className="material-symbols-outlined text-[15px] text-secondary">
                                    mail
                                  </span>
                                  <span className="truncate max-w-[200px]">
                                    {customer.email || '—'}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5 text-secondary">
                                  <span className="material-symbols-outlined text-[15px]">
                                    call
                                  </span>
                                  <span>{customer.phone || '—'}</span>
                                </div>
                              </div>
                            </td>
                          )}

                          {/* Column 3: Tax Identification Number */}
                          {visibleColumns.rut && (
                            <td className={densityPadding}>
                              {isRutAssigned ? (
                                <span className="font-mono text-xs font-semibold text-[#1d1c17] bg-[#f8f6f2] px-2.5 py-1 rounded border border-[#e8e2d8]">
                                  {customer.rut}
                                </span>
                              ) : (
                                <span className="text-[#8c8b88] italic text-xs">
                                  No RUT assigned
                                </span>
                              )}
                            </td>
                          )}

                          {/* Column 4: Geographic Location */}
                          {visibleColumns.location && (
                            <td className={densityPadding}>
                              <div className="flex flex-col gap-0.5 text-xs">
                                <div className="font-medium text-[#1d1c17] flex items-center gap-1">
                                  <span className="material-symbols-outlined text-[15px] text-secondary">
                                    location_on
                                  </span>
                                  <span>{customer.address || 'No street address'}</span>
                                </div>
                                <div className="text-[11px] text-secondary pl-5">
                                  {[customer.city, customer.state, customer.country]
                                    .filter(Boolean)
                                    .join(', ') || 'No regional details'}
                                </div>
                              </div>
                            </td>
                          )}

                          {/* Column 5: Linked Activity Badges */}
                          {visibleColumns.activity && (
                            <td className={`${densityPadding} text-center`}>
                              <div className="flex items-center justify-center gap-2">
                                {/* Orders Badge */}
                                <span
                                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200"
                                  title={`${ordersCount} connected order records`}
                                >
                                  <span className="material-symbols-outlined text-[14px]">
                                    shopping_bag
                                  </span>
                                  <span>{ordersCount} Orders</span>
                                </span>

                                {/* Loyalty Badge */}
                                <span
                                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200"
                                  title={`${loyaltyCount} connected loyalty records`}
                                >
                                  <span className="material-symbols-outlined text-[14px]">
                                    loyalty
                                  </span>
                                  <span>{loyaltyCount} Loyalty</span>
                                </span>
                              </div>
                            </td>
                          )}

                          {/* Column 6: Actions */}
                          {visibleColumns.actions && (
                            <td
                              className={`${densityPadding} text-right`}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleOpenDetail(customer)}
                                  className="p-1.5 text-secondary hover:text-[#ae001a] hover:bg-[#f1ece4] rounded transition-colors"
                                  title="Inspect customer record"
                                  aria-label={`Inspect ${customer.name}`}
                                >
                                  <span className="material-symbols-outlined text-[18px]">
                                    visibility
                                  </span>
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => handleOpenEdit(customer, e)}
                                  className="p-1.5 text-secondary hover:text-[#ae001a] hover:bg-[#f1ece4] rounded transition-colors"
                                  title="Edit customer profile"
                                  aria-label={`Edit ${customer.name}`}
                                >
                                  <span className="material-symbols-outlined text-[18px]">
                                    edit
                                  </span>
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => handleOpenDelete(customer, e)}
                                  className="p-1.5 text-secondary hover:text-[#ba1a1a] hover:bg-red-50 rounded transition-colors"
                                  title="Delete customer record"
                                  aria-label={`Delete ${customer.name}`}
                                >
                                  <span className="material-symbols-outlined text-[18px]">
                                    delete
                                  </span>
                                </button>
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
            currentPage={currentPage}
            totalItems={filteredCustomers.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            totalPages={totalPages}
          />
        </div>
      )}

      {/* 1. Operational CRUD Form Drawer Component */}
      {isFormDrawerOpen && (
        <SideDrawer
          title={formMode === 'create' ? 'Add New Customer' : 'Edit Customer Profile'}
          subtitle={`Company #${activeCompanyId} • Merchant #${activeMerchantId}`}
          onClose={() => setIsFormDrawerOpen(false)}
          closeDisabled={isSubmitting}
          maxWidth={580}
        >
          <form onSubmit={handleSubmitForm} className="flex-1 overflow-y-auto p-6 flex flex-col gap-4 font-sans text-left">
            {/* Context Injection Notice */}
            <div className="bg-[#fcfaf7] border border-[#e8e2d8] rounded-lg p-3 text-xs text-secondary flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-[#ae001a]">
                  verified_user
                </span>
                <span>
                  Automatic Context Injection: <strong>Tenant #{activeCompanyId}</strong> • <strong>Merchant #{activeMerchantId}</strong>
                </span>
              </div>
              <span className="font-mono text-[10px] bg-white px-2 py-0.5 rounded border border-[#e8e2d8]">
                NestJS Entity Binding
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Name (Mandatory) */}
              <div className="md:col-span-2">
                <label className="block text-label-caps font-bold text-[#5f5e5e] mb-1">
                  Customer Enterprise Name *
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Acme Hospitality Group"
                  className={`w-full px-3.5 py-2 rounded border ${
                    formErrors.name ? 'border-[#ba1a1a] bg-red-50' : 'border-[#e8e2d8] bg-[#fef9f1]'
                  } text-body-sm focus:border-[#ae001a] outline-none font-sans`}
                />
                {formErrors.name && (
                  <p className="text-[#ba1a1a] text-xs mt-1">{formErrors.name}</p>
                )}
              </div>

              {/* RUT (Mandatory) */}
              <div>
                <label className="block text-label-caps font-bold text-[#5f5e5e] mb-1">
                  Tax Identification (RUT) *
                </label>
                <input
                  type="text"
                  value={formRut}
                  onChange={(e) => setFormRut(e.target.value)}
                  placeholder="e.g. 76.123.456-7"
                  className={`w-full px-3.5 py-2 rounded border ${
                    formErrors.rut ? 'border-[#ba1a1a] bg-red-50' : 'border-[#e8e2d8] bg-[#fef9f1]'
                  } text-body-sm focus:border-[#ae001a] outline-none font-mono`}
                />
                {formErrors.rut && (
                  <p className="text-[#ba1a1a] text-xs mt-1">{formErrors.rut}</p>
                )}
              </div>

              {/* Email (Mandatory) */}
              <div>
                <label className="block text-label-caps font-bold text-[#5f5e5e] mb-1">
                  Contact Email *
                </label>
                <input
                  type="email"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="contact@example.com"
                  className={`w-full px-3.5 py-2 rounded border ${
                    formErrors.email ? 'border-[#ba1a1a] bg-red-50' : 'border-[#e8e2d8] bg-[#fef9f1]'
                  } text-body-sm focus:border-[#ae001a] outline-none font-sans`}
                />
                {formErrors.email && (
                  <p className="text-[#ba1a1a] text-xs mt-1">{formErrors.email}</p>
                )}
              </div>

              {/* Phone (Optional) */}
              <div className="md:col-span-2">
                <label className="block text-label-caps font-bold text-[#5f5e5e] mb-1">
                  Telephone Channel <span className="text-secondary font-normal lowercase">(optional)</span>
                </label>
                <input
                  type="text"
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  placeholder="+56 9 1234 5678"
                  className="w-full px-3.5 py-2 rounded border border-[#e8e2d8] bg-[#fef9f1] text-body-sm focus:border-[#ae001a] outline-none font-sans"
                />
              </div>

              {/* Address (Mandatory) */}
              <div className="md:col-span-2">
                <label className="block text-label-caps font-bold text-[#5f5e5e] mb-1">
                  Street Address *
                </label>
                <input
                  type="text"
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value)}
                  placeholder="e.g. Av. Providencia 1234, Suite 400"
                  className={`w-full px-3.5 py-2 rounded border ${
                    formErrors.address ? 'border-[#ba1a1a] bg-red-50' : 'border-[#e8e2d8] bg-[#fef9f1]'
                  } text-body-sm focus:border-[#ae001a] outline-none font-sans`}
                />
                {formErrors.address && (
                  <p className="text-[#ba1a1a] text-xs mt-1">{formErrors.address}</p>
                )}
              </div>

              {/* City (Mandatory) */}
              <div>
                <label className="block text-label-caps font-bold text-[#5f5e5e] mb-1">
                  City *
                </label>
                <input
                  type="text"
                  value={formCity}
                  onChange={(e) => setFormCity(e.target.value)}
                  placeholder="Santiago"
                  className={`w-full px-3.5 py-2 rounded border ${
                    formErrors.city ? 'border-[#ba1a1a] bg-red-50' : 'border-[#e8e2d8] bg-[#fef9f1]'
                  } text-body-sm focus:border-[#ae001a] outline-none font-sans`}
                />
                {formErrors.city && (
                  <p className="text-[#ba1a1a] text-xs mt-1">{formErrors.city}</p>
                )}
              </div>

              {/* State (Mandatory) */}
              <div>
                <label className="block text-label-caps font-bold text-[#5f5e5e] mb-1">
                  State / Region *
                </label>
                <input
                  type="text"
                  value={formState}
                  onChange={(e) => setFormState(e.target.value)}
                  placeholder="Región Metropolitana"
                  className={`w-full px-3.5 py-2 rounded border ${
                    formErrors.state ? 'border-[#ba1a1a] bg-red-50' : 'border-[#e8e2d8] bg-[#fef9f1]'
                  } text-body-sm focus:border-[#ae001a] outline-none font-sans`}
                />
                {formErrors.state && (
                  <p className="text-[#ba1a1a] text-xs mt-1">{formErrors.state}</p>
                )}
              </div>

              {/* Country (Mandatory) */}
              <div className="md:col-span-2">
                <label className="block text-label-caps font-bold text-[#5f5e5e] mb-1">
                  Country *
                </label>
                <input
                  type="text"
                  value={formCountry}
                  onChange={(e) => setFormCountry(e.target.value)}
                  placeholder="Chile"
                  className={`w-full px-3.5 py-2 rounded border ${
                    formErrors.country ? 'border-[#ba1a1a] bg-red-50' : 'border-[#e8e2d8] bg-[#fef9f1]'
                  } text-body-sm focus:border-[#ae001a] outline-none font-sans`}
                />
                {formErrors.country && (
                  <p className="text-[#ba1a1a] text-xs mt-1">{formErrors.country}</p>
                )}
              </div>
            </div>

            {/* Drawer Sticky Footer */}
            <div className="flex items-center justify-end gap-3 mt-auto pt-6 border-t border-[#e8e2d8]">
              <button
                type="button"
                onClick={() => setIsFormDrawerOpen(false)}
                className="px-4 py-2 border border-[#e8e2d8] text-secondary text-label-caps font-bold hover:bg-[#f2ede5] rounded transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2 bg-[#ae001a] hover:bg-[#930015] text-white text-label-caps font-bold rounded transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50 shadow-sm"
              >
                {isSubmitting && (
                  <span className="material-symbols-outlined text-[16px] animate-spin">
                    sync
                  </span>
                )}
                <span>{formMode === 'create' ? 'Save Customer' : 'Update Profile'}</span>
              </button>
            </div>
          </form>
        </SideDrawer>
      )}

      {/* 2. Detailed Inspection Drawer & Nested Relational Views */}
      {isDetailDrawerOpen && selectedCustomer && (
        <SideDrawer
          title="Customer Profile Details"
          subtitle={`#CUST-${selectedCustomer.id} • ${selectedCustomer.status || (selectedCustomer.isActive !== false ? 'Active Master' : 'Inactive')}`}
          onClose={() => setIsDetailDrawerOpen(false)}
          maxWidth={580}
        >
          <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6 text-left font-sans">
            {/* Header Profile Section */}
            <div className="flex items-start justify-between pb-4 border-b border-[#e8e2d8]">
              <div>
                <h2 className="text-lg font-bold text-[#1d1c17]">
                  {selectedCustomer.name}
                </h2>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <span className="font-mono text-xs bg-[#f8f6f2] px-2 py-0.5 rounded border border-[#e8e2d8] font-semibold text-[#1d1c17]">
                    RUT: {selectedCustomer.rut || 'No RUT assigned'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setIsDetailDrawerOpen(false);
                    handleOpenEdit(selectedCustomer);
                  }}
                  className="p-2 border border-[#e8e2d8] rounded hover:bg-[#f2ede5] text-secondary hover:text-[#ae001a] transition-all flex items-center gap-1 text-xs font-bold uppercase cursor-pointer"
                  title="Edit customer profile"
                >
                  <span className="material-symbols-outlined text-[16px]">edit</span>
                  <span>Edit</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenDelete(selectedCustomer)}
                  className="p-2 border border-red-200 rounded hover:bg-red-50 text-[#ba1a1a] transition-all flex items-center gap-1 text-xs font-bold uppercase cursor-pointer"
                  title="Soft-delete customer"
                >
                  <span className="material-symbols-outlined text-[16px]">delete</span>
                  <span>Delete</span>
                </button>
              </div>
            </div>

            {/* System Metadata Panel */}
            <div>
              <h4 className="text-label-caps text-secondary font-bold mb-2">
                System Metadata & Tenant Scoping
              </h4>
              <div className="bg-[#fef9f1] border border-[#e8e2d8] rounded-lg p-4 grid grid-cols-2 gap-3 text-xs font-mono">
                <div>
                  <span className="text-secondary block text-[10px] uppercase font-sans font-bold">Company Scope</span>
                  <span className="font-semibold text-[#1d1c17]">Tenant #{selectedCustomer.companyId ?? selectedCustomer.company_id ?? activeCompanyId}</span>
                </div>
                <div>
                  <span className="text-secondary block text-[10px] uppercase font-sans font-bold">Merchant Scope</span>
                  <span className="font-semibold text-[#1d1c17]">Merchant #{selectedCustomer.merchantId ?? selectedCustomer.merchant_id ?? activeMerchantId}</span>
                </div>
                <div>
                  <span className="text-secondary block text-[10px] uppercase font-sans font-bold">Created Timestamp</span>
                  <span className="font-semibold text-[#1d1c17]">
                    {selectedCustomer.createdAt || selectedCustomer.created_at || 'Recently Created'}
                  </span>
                </div>
                <div>
                  <span className="text-secondary block text-[10px] uppercase font-sans font-bold">Last Updated</span>
                  <span className="font-semibold text-[#1d1c17]">
                    {selectedCustomer.updatedAt || selectedCustomer.updated_at || 'Recently Updated'}
                  </span>
                </div>
              </div>
            </div>

            {/* Contact Information */}
            <div>
              <h4 className="text-label-caps text-secondary font-bold mb-2">
                Contact Channels
              </h4>
              <div className="bg-[#fef9f1] border border-[#e8e2d8] rounded-lg p-4 flex flex-col gap-2.5 text-body-sm">
                <div className="flex items-center gap-2 text-[#1d1c17]">
                  <span className="material-symbols-outlined text-secondary text-[18px]">
                    mail
                  </span>
                  <span>{selectedCustomer.email || 'No email registered'}</span>
                </div>
                <div className="flex items-center gap-2 text-[#1d1c17]">
                  <span className="material-symbols-outlined text-secondary text-[18px]">
                    call
                  </span>
                  <span>{selectedCustomer.phone || 'No phone registered'}</span>
                </div>
              </div>
            </div>

            {/* Geographic & Regional Info (Address Vectors) */}
            <div>
              <h4 className="text-label-caps text-secondary font-bold mb-2">
                Geographic Address Vectors
              </h4>
              <div className="bg-[#fef9f1] border border-[#e8e2d8] rounded-lg p-4 flex flex-col gap-2 text-body-sm">
                <div className="flex items-start gap-2">
                  <span className="material-symbols-outlined text-secondary text-[18px] mt-0.5">
                    location_on
                  </span>
                  <div>
                    <div className="font-semibold text-[#1d1c17]">
                      {selectedCustomer.address || 'No street address specified'}
                    </div>
                    <div className="text-xs text-secondary mt-0.5">
                      {[
                        selectedCustomer.city,
                        selectedCustomer.state,
                        selectedCustomer.country,
                      ]
                        .filter(Boolean)
                        .join(', ') || 'No regional details'}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Nested Relational Views: Orders (OneToMany) */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-label-caps text-secondary font-bold">
                  Connected Orders (OneToMany)
                </h4>
                <span className="bg-blue-100 text-blue-800 text-xs font-mono font-bold px-2 py-0.5 rounded">
                  {resolveOrdersCount(selectedCustomer)} Records
                </span>
              </div>

              <div className="bg-blue-50/50 border border-blue-200 rounded-lg p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-blue-900 uppercase tracking-wider">
                    Connected Orders
                  </span>
                  <span className="text-xl font-bold font-mono text-blue-950">
                    {resolveOrdersCount(selectedCustomer)}
                  </span>
                </div>

                {Array.isArray(selectedCustomer.orders) && selectedCustomer.orders.length > 0 ? (
                  <div className="flex flex-col gap-2 mt-1">
                    {selectedCustomer.orders.map((ord, idx) => (
                      <div
                        key={ord.id ?? idx}
                        className="bg-white border border-blue-100 rounded p-2.5 flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-blue-600 text-[16px]">
                            shopping_bag
                          </span>
                          <span className="font-semibold font-mono text-gray-800">
                            Order #{ord.orderNumber ?? ord.id}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {ord.total !== undefined && (
                            <span className="font-mono text-gray-700 font-bold">
                              ${ord.total}
                            </span>
                          )}
                          <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-blue-100 text-blue-800">
                            {ord.status ?? 'Logged'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-blue-700 italic">
                    No individual order item details recorded for this customer.
                  </p>
                )}
              </div>
            </div>

            {/* Nested Relational Views: Loyalty (OneToMany) */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-label-caps text-secondary font-bold">
                  Connected Loyalty Profiles (OneToMany)
                </h4>
                <span className="bg-amber-100 text-amber-800 text-xs font-mono font-bold px-2 py-0.5 rounded">
                  {resolveLoyaltyCount(selectedCustomer)} Records
                </span>
              </div>

              <div className="bg-amber-50/50 border border-amber-200 rounded-lg p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-amber-900 uppercase tracking-wider">
                    Loyalty Records
                  </span>
                  <span className="text-xl font-bold font-mono text-amber-950">
                    {resolveLoyaltyCount(selectedCustomer)}
                  </span>
                </div>

                {Array.isArray(selectedCustomer.loyaltyCustomers) && selectedCustomer.loyaltyCustomers.length > 0 ? (
                  <div className="flex flex-col gap-2 mt-1">
                    {selectedCustomer.loyaltyCustomers.map((loyalty, idx) => (
                      <div
                        key={loyalty.id ?? idx}
                        className="bg-white border border-amber-100 rounded p-2.5 flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-amber-600 text-[16px]">
                            loyalty
                          </span>
                          <span className="font-semibold font-mono text-gray-800">
                            Card #{loyalty.cardNumber ?? loyalty.id}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {loyalty.points !== undefined && (
                            <span className="font-mono text-amber-900 font-bold">
                              {loyalty.points} pts
                            </span>
                          )}
                          <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                            {loyalty.tier ?? 'Member'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-amber-700 italic">
                    No connected loyalty memberships assigned to this customer profile.
                  </p>
                )}
              </div>
            </div>
          </div>
        </SideDrawer>
      )}

      {/* 3. Soft-Delete Confirmation Guard Dialog */}
      {isDeleteDialogOpen && customerToDelete &&
        createPortal(
          <div
            className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs font-sans"
            onClick={() => setIsDeleteDialogOpen(false)}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Confirm Customer Deletion"
              className="relative bg-white rounded-xl shadow-2xl border border-[#e8e2d8] w-full max-w-md overflow-hidden text-left z-10"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-[#222222] text-white p-5 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="material-symbols-outlined text-[#ae001a]">
                    warning
                  </span>
                  <h3 className="text-base font-bold uppercase tracking-wider">
                    Delete Customer Profile
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsDeleteDialogOpen(false)}
                  className="text-white/70 hover:text-white transition-colors cursor-pointer"
                  aria-label="Close delete dialog"
                >
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>

              <div className="p-6 flex flex-col gap-4 font-sans">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center shrink-0 bg-red-50 border border-red-100 text-[#ae001a]">
                    <span className="material-symbols-outlined text-2xl">delete_forever</span>
                  </div>
                  <div className="space-y-1.5">
                    <p className="font-bold text-[#1d1c17] text-base">
                      Are you sure you want to delete {customerToDelete.name}?
                    </p>
                    <p className="text-sm text-[#5f5e5e] leading-relaxed">
                      Customer record <span className="font-mono font-semibold text-[#1d1c17]">#CUST-{customerToDelete.id}</span> will be soft-deleted and removed from active lookups. Historical transaction records (connected orders and loyalty accounts) will remain preserved for relational integrity.
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 mt-4 pt-4 border-t border-[#e8e2d8]">
                  <button
                    type="button"
                    onClick={() => setIsDeleteDialogOpen(false)}
                    className="px-4 py-2 border border-[#e8e2d8] text-secondary text-label-caps font-bold hover:bg-[#f2ede5] rounded transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={isDeleting}
                    onClick={handleConfirmDelete}
                    className="px-5 py-2 bg-[#ae001a] hover:bg-[#930015] text-white text-label-caps font-bold rounded transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {isDeleting ? (
                      <>
                        <span className="material-symbols-outlined text-[16px] animate-spin">
                          sync
                        </span>
                        <span>Deleting…</span>
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-[16px]">delete</span>
                        <span>Confirm Delete</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
};

export default CustomersView;
