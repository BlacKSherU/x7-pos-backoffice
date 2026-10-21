import React, { useState, useEffect, useMemo } from 'react';
import type {
  CreateQRLocationDto,
  MerchantRef,
  QRLocation,
  QRLocationStatus,
  QRMenuRef,
  QRMenuType,
  TableRef,
  UpdateQRLocationDto,
} from '../../../../types/qr-location';
import {
  QR_LOCATION_STATUSES,
  QR_LOCATION_TYPE_LABELS,
  QR_LOCATION_TYPES,
  QR_STATUS_BADGE_STYLES,
} from '../../../../types/qr-location';
import {
  createQRLocation,
  deleteQRLocation,
  fetchAvailableMerchants,
  fetchAvailableQRMenus,
  fetchAvailableTables,
  getQRLocations,
  updateQRLocation,
} from '../../../../api/qr-locations';
import {
  buildQrLandingUrl,
  convertSvgToHighResPngDataUrl,
  generateQrAssetImage,
  syncLocationTypeWithTable,
  validateQRLocationPayload,
  validateTableMerchantContext,
  validateUniqueLocationName,
} from '../../../../lib/qr-location';

interface QRLocationsViewProps {
  onNavigate?: (featureId: string) => void;
  merchantId?: number;
}

export const QRLocationsView: React.FC<QRLocationsViewProps> = ({ merchantId }) => {
  const [locations, setLocations] = useState<QRLocation[]>([]);
  const [merchants, setMerchants] = useState<MerchantRef[]>([]);
  const [menus, setMenus] = useState<QRMenuRef[]>([]);
  const [tables, setTables] = useState<TableRef[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Search, Multi-Filter & View Controls
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [menuFilter, setMenuFilter] = useState<string>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [selectedStatusSet, setSelectedStatusSet] = useState<Set<QRLocationStatus>>(
    new Set(['active', 'inactive', 'archived'])
  );
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [tableSearchQuery, setTableSearchQuery] = useState<string>('');

  // Batch selection state
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // Side Drawer state
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [editingLocation, setEditingLocation] = useState<QRLocation | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Export Modal & Print Template State
  const [exportModalLocation, setExportModalLocation] = useState<QRLocation | null>(null);
  const [isBatchExportOpen, setIsBatchExportOpen] = useState<boolean>(false);
  const [printTemplate, setPrintTemplate] = useState<'acrylic' | 'sticker' | 'tentCard'>('acrylic');
  const [copiedUrlId, setCopiedUrlId] = useState<number | null>(null);

  // Form state (POST / PATCH /api/v1/qr-locations)
  const [formData, setFormData] = useState<{
    name: string;
    merchant_id: number;
    qr_menu_id: number;
    table_id: number | null;
    location_type: QRMenuType;
    status: QRLocationStatus;
  }>({
    name: '',
    merchant_id: merchantId || 3,
    qr_menu_id: 101,
    table_id: null,
    location_type: 'DINE_IN',
    status: 'active',
  });
  const [formError, setFormError] = useState<string | null>(null);

  const activeMerchantId = merchantId || formData.merchant_id || 3;

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [locsRes, merchsRes, menusRes, tablesRes] = await Promise.allSettled([
        getQRLocations(activeMerchantId),
        fetchAvailableMerchants(),
        fetchAvailableQRMenus(activeMerchantId),
        fetchAvailableTables(activeMerchantId),
      ]);
      if (locsRes.status === 'fulfilled') setLocations(locsRes.value);
      if (merchsRes.status === 'fulfilled') setMerchants(merchsRes.value);
      if (menusRes.status === 'fulfilled') setMenus(menusRes.value);
      if (tablesRes.status === 'fulfilled') setTables(tablesRes.value);

      if (locsRes.status === 'rejected') {
        setError(locsRes.reason?.message || 'Failed to load QR Locations directory.');
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load QR Locations directory.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeMerchantId]);

  // Handle table selection change -> auto-sync location_type & validate merchant context
  const handleTableSelection = (rawTableId: string) => {
    const tableIdNum = rawTableId === '' ? null : parseInt(rawTableId, 10);
    const updatedType = syncLocationTypeWithTable(tableIdNum, formData.location_type);

    setFormData((prev) => ({
      ...prev,
      table_id: tableIdNum,
      location_type: updatedType,
    }));

    // Live validation against merchant context
    const validation = validateTableMerchantContext(tableIdNum, formData.merchant_id, tables);
    if (!validation.valid) {
      setFieldErrors((prev) => ({ ...prev, table_id: validation.error || 'Invalid table selection.' }));
    } else {
      setFieldErrors((prev) => {
        const copy = { ...prev };
        delete copy.table_id;
        return copy;
      });
    }
  };

  // Open side drawer for creation
  const handleOpenCreateDrawer = () => {
    setEditingLocation(null);
    const defaultMenu = menus.length > 0 ? menus[0].id : 101;
    setFormData({
      name: '',
      merchant_id: activeMerchantId,
      qr_menu_id: defaultMenu,
      table_id: null,
      location_type: 'DINE_IN',
      status: 'active',
    });
    setFieldErrors({});
    setFormError(null);
    setIsDrawerOpen(true);
  };

  // Open side drawer for editing
  const handleOpenEditDrawer = (loc: QRLocation) => {
    setEditingLocation(loc);
    setFormData({
      name: loc.name,
      merchant_id: loc.merchant_id,
      qr_menu_id: loc.qr_menu_id,
      table_id: loc.table_id || null,
      location_type: loc.location_type,
      status: loc.status,
    });
    setFieldErrors({});
    setFormError(null);
    setIsDrawerOpen(true);
  };

  // Live Location Name Validation (Max 100 chars & Unique under merchant)
  const handleNameChange = (val: string) => {
    const truncated = val.slice(0, 100);
    setFormData((prev) => ({ ...prev, name: truncated }));

    const uniqueCheck = validateUniqueLocationName(
      truncated,
      formData.merchant_id,
      locations,
      editingLocation?.id
    );

    if (!uniqueCheck.valid) {
      setFieldErrors((prev) => ({ ...prev, name: uniqueCheck.error! }));
    } else {
      setFieldErrors((prev) => {
        const copy = { ...prev };
        delete copy.name;
        return copy;
      });
    }
  };

  // Submit Drawer Form (POST / PATCH /api/v1/qr-locations)
  const handleSaveLocation = async (e: React.FormEvent) => {
    e.preventDefault();

    // Payload validation (Name, unique check, menu, type, status)
    const payloadCheck = validateQRLocationPayload(
      formData,
      formData.merchant_id,
      locations,
      tables,
      editingLocation?.id
    );

    if (!payloadCheck.valid) {
      setFieldErrors(payloadCheck.fieldErrors);
      setFormError(payloadCheck.error || 'Please correct the highlighted form errors.');
      return;
    }

    try {
      if (editingLocation) {
        const dto: UpdateQRLocationDto = {
          name: formData.name,
          merchant_id: formData.merchant_id,
          qr_menu_id: formData.qr_menu_id,
          table_id: formData.table_id,
          location_type: formData.location_type,
          status: formData.status,
        };
        await updateQRLocation(editingLocation.id, dto);
      } else {
        const dto: CreateQRLocationDto = {
          name: formData.name,
          merchant_id: formData.merchant_id,
          qr_menu_id: formData.qr_menu_id,
          table_id: formData.table_id,
          location_type: formData.location_type,
          status: formData.status,
        };
        await createQRLocation(dto);
      }
      setIsDrawerOpen(false);
      await loadData();
    } catch (err: any) {
      setFormError(err?.message || 'Failed to save QR Location.');
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm(`Are you sure you want to archive / remove QR Location #QR-LOC-${id}?`)) {
      try {
        await deleteQRLocation(id);
        await loadData();
      } catch (err: any) {
        alert(err?.message || 'Failed to delete QR Location.');
      }
    }
  };

  const handleCopyUrl = (url: string, id: number) => {
    navigator.clipboard.writeText(url);
    setCopiedUrlId(id);
    setTimeout(() => setCopiedUrlId(null), 2500);
  };

  // Status Checkbox Filter Toggle
  const toggleStatusCheckbox = (st: QRLocationStatus) => {
    setSelectedStatusSet((prev) => {
      const next = new Set(prev);
      if (next.has(st)) {
        if (next.size > 1) {
          next.delete(st);
        }
      } else {
        next.add(st);
      }
      return next;
    });
  };

  // Batch Selection Handlers
  const toggleSelectAll = () => {
    if (selectedIds.size === filteredLocations.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredLocations.map((l) => l.id)));
    }
  };

  const toggleSelectId = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Multi-Filtered locations list (Search across name, ID, menu name, physical table number)
  const filteredLocations = useMemo(() => {
    return locations.filter((loc) => {
      // Universal Search (location name, #QR-LOC-id, menu name, table number)
      const query = searchTerm.trim().toLowerCase();
      const matchSearch =
        query === '' ||
        loc.name.toLowerCase().includes(query) ||
        `#qr-loc-${loc.id}`.includes(query) ||
        (loc.qrMenu?.name && loc.qrMenu.name.toLowerCase().includes(query)) ||
        (loc.table?.number && loc.table.number.toLowerCase().includes(query));

      // QR Menu Filter
      const matchMenu = menuFilter === 'ALL' || loc.qr_menu_id === parseInt(menuFilter, 10);

      // Location Type Filter
      const matchType = typeFilter === 'ALL' || loc.location_type === typeFilter;

      // Status Checkboxes Filter
      const matchStatus = selectedStatusSet.has(loc.status);

      return matchSearch && matchMenu && matchType && matchStatus;
    });
  }, [locations, searchTerm, menuFilter, typeFilter, selectedStatusSet]);

  // Searchable tables picker list
  const searchableTables = useMemo(() => {
    if (!tableSearchQuery.trim()) return tables;
    const q = tableSearchQuery.toLowerCase();
    return tables.filter(
      (t) =>
        t.number.toLowerCase().includes(q) ||
        (t.zone_name && t.zone_name.toLowerCase().includes(q))
    );
  }, [tables, tableSearchQuery]);

  // Selected locations for batch export
  const selectedLocationsList = useMemo(() => {
    return locations.filter((l) => selectedIds.has(l.id));
  }, [locations, selectedIds]);

  // Operational KPI Summary Metrics (Live Header Tallies)
  const metrics = useMemo(() => {
    const total = locations.length;
    const active = locations.filter((l) => l.status === 'active').length;
    const tableLinked = locations.filter((l) => l.table_id !== null && l.table_id !== undefined && l.table_id > 0).length;
    const virtualPts = locations.filter((l) => l.table_id === null || l.table_id === undefined || l.table_id === 0).length;
    return { total, active, tableLinked, virtualPts };
  }, [locations]);

  // Preview generated QR URL in create drawer
  const previewUrl = useMemo(() => {
    const targetId = editingLocation ? editingLocation.id : locations.length + 1;
    return buildQrLandingUrl(formData.merchant_id, targetId);
  }, [formData.merchant_id, editingLocation, locations]);

  const previewQrSvg = useMemo(() => {
    return generateQrAssetImage(previewUrl, formData.name || 'SAMPLE ACCESS');
  }, [previewUrl, formData.name]);

  // PNG High-Res Exporter
  const handleDownloadPng = async (loc: QRLocation) => {
    try {
      const pngDataUrl = await convertSvgToHighResPngDataUrl(loc.qr_code_image, 1000, 1000);
      const link = document.createElement('a');
      link.href = pngDataUrl;
      link.download = `QR-LOC-${loc.id}-${loc.name.replace(/\s+/g, '_')}_HighRes.png`;
      link.click();
    } catch {
      alert('Failed to generate PNG export.');
    }
  };

  return (
    <div className="flex flex-col gap-6 text-left animate-fade-in font-poppins">
      {/* Main Workspace Header (Theme: Black, White, Red #ae001a, Poppins Font) */}
      <div className="bg-white border border-[#e8e2d8] p-6 rounded-2xl shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-[#ae001a] text-white flex items-center justify-center shadow-md shadow-[#ae001a]/20 shrink-0">
            <span className="material-symbols-outlined text-3xl font-bold">qr_code_2</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-[#1d1c17] tracking-tight font-poppins">QR Location Management</h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#ae001a]/10 text-[#ae001a] border border-[#ae001a]/30">
                Live Deployment Engine
              </span>
            </div>
            <p className="text-[#5f5e5e] text-sm mt-0.5">
              Monitor active QR deployment points, filter locations by menu or table assignment, and export high-res print assets.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {selectedIds.size > 0 && (
            <button
              onClick={() => setIsBatchExportOpen(true)}
              className="px-4 py-2.5 bg-purple-700 hover:bg-purple-800 text-white font-bold rounded-xl shadow-md transition-colors duration-200 flex items-center gap-2 text-sm"
            >
              <span className="material-symbols-outlined text-lg">print</span>
              Export Selected ({selectedIds.size})
            </button>
          )}

          <button
            onClick={loadData}
            className="px-4 py-2.5 bg-white hover:bg-slate-50 text-[#1d1c17] hover:text-[#ae001a] border border-[#e8e2d8] rounded-xl transition-colors duration-200 flex items-center gap-2 text-sm font-semibold shadow-xs"
            title="Refresh Directory"
          >
            <span className="material-symbols-outlined text-lg">refresh</span>
            Refresh
          </button>
          <button
            onClick={handleOpenCreateDrawer}
            className="px-4 py-2.5 bg-[#ae001a] hover:bg-[#900015] text-white font-bold rounded-xl shadow-md transition-colors duration-200 flex items-center gap-2 text-sm"
          >
            <span className="material-symbols-outlined text-lg">add_location_alt</span>
            Configure QR Location
          </button>
        </div>
      </div>

      {/* QR Location Operational KPI Summary Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total QR Locations */}
        <div className="bg-white border border-[#e8e2d8] rounded-2xl p-5 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-[#5f5e5e] uppercase tracking-wider font-poppins">Total QR Locations</p>
            <p className="text-3xl font-extrabold text-[#1d1c17] mt-1 font-poppins">{metrics.total}</p>
            <p className="text-xs text-[#5f5e5e] mt-1">Aggregate registered locations</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-slate-100 border border-[#e8e2d8] text-[#1d1c17] flex items-center justify-center">
            <span className="material-symbols-outlined text-2xl">qr_code_2</span>
          </div>
        </div>

        {/* Active QR Access Points */}
        <div className="bg-white border border-[#e8e2d8] rounded-2xl p-5 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-[#5f5e5e] uppercase tracking-wider font-poppins">Active QR Access Points</p>
            <p className="text-3xl font-extrabold text-[#10b981] mt-1 font-poppins">{metrics.active}</p>
            <p className="text-xs text-emerald-700 mt-1">Status = 'active' points</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-[#10b981]/10 border border-[#10b981]/30 text-[#10b981] flex items-center justify-center">
            <span className="material-symbols-outlined text-2xl">check_circle</span>
          </div>
        </div>

        {/* Table-Linked Locations */}
        <div className="bg-white border border-[#e8e2d8] rounded-2xl p-5 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-[#5f5e5e] uppercase tracking-wider font-poppins">Table-Linked Locations</p>
            <p className="text-3xl font-extrabold text-amber-600 mt-1 font-poppins">{metrics.tableLinked}</p>
            <p className="text-xs text-amber-700 mt-1">Mapped to physical tables</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-600 flex items-center justify-center">
            <span className="material-symbols-outlined text-2xl">table_restaurant</span>
          </div>
        </div>

        {/* Virtual Access Points */}
        <div className="bg-white border border-[#e8e2d8] rounded-2xl p-5 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-[#5f5e5e] uppercase tracking-wider font-poppins">Virtual Access Points</p>
            <p className="text-3xl font-extrabold text-purple-600 mt-1 font-poppins">{metrics.virtualPts}</p>
            <p className="text-xs text-purple-700 mt-1">Takeaway / Pickup / Service</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-600 flex items-center justify-center">
            <span className="material-symbols-outlined text-2xl">devices</span>
          </div>
        </div>
      </div>

      {/* Dynamic Multi-Filter Bar & Search Controls */}
      <div className="bg-white border border-[#e8e2d8] rounded-2xl p-4 shadow-sm flex flex-col gap-4">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          {/* Universal Search & Select All */}
          <div className="flex items-center gap-3 w-full md:w-auto">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-[#1d1c17] bg-[#fef9f1] px-3 py-2 rounded-xl border border-[#e8e2d8]">
              <input
                type="checkbox"
                checked={selectedIds.size === filteredLocations.length && filteredLocations.length > 0}
                onChange={toggleSelectAll}
                className="w-4 h-4 rounded text-[#ae001a] focus:ring-[#ae001a]"
              />
              <span className="font-poppins">Select All ({selectedIds.size})</span>
            </label>

            <div className="relative flex-1 md:w-80">
              <span className="material-symbols-outlined absolute left-3 top-2.5 text-[#5f5e5e] text-xl">search</span>
              <input
                type="text"
                placeholder="Search location name or table number..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-[#fef9f1] border border-[#e8e2d8] rounded-xl text-sm text-[#1d1c17] placeholder-[#5f5e5e] focus:outline-none focus:border-[#ae001a] focus:ring-1 focus:ring-[#ae001a] font-poppins"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
            {/* QR Menu Filter */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-[#5f5e5e]">QR Menu:</span>
              <select
                value={menuFilter}
                onChange={(e) => setMenuFilter(e.target.value)}
                className="bg-[#fef9f1] border border-[#e8e2d8] rounded-xl px-3 py-1.5 text-xs text-[#1d1c17] focus:outline-none focus:border-[#ae001a] font-poppins"
              >
                <option value="ALL">All QR Menus</option>
                {menus.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Location Type Filter */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-[#5f5e5e]">Type:</span>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="bg-[#fef9f1] border border-[#e8e2d8] rounded-xl px-3 py-1.5 text-xs text-[#1d1c17] focus:outline-none focus:border-[#ae001a] font-poppins"
              >
                <option value="ALL">All Types</option>
                {QR_LOCATION_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {QR_LOCATION_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>

            {/* View Mode Switch */}
            <div className="flex items-center bg-[#fef9f1] p-1 rounded-xl border border-[#e8e2d8]">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg transition-colors duration-200 ${
                  viewMode === 'grid' ? 'bg-[#ae001a] text-white' : 'text-[#5f5e5e] hover:text-[#ae001a]'
                }`}
                title="Grid View"
              >
                <span className="material-symbols-outlined text-lg">grid_view</span>
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-lg transition-colors duration-200 ${
                  viewMode === 'table' ? 'bg-[#ae001a] text-white' : 'text-[#5f5e5e] hover:text-[#ae001a]'
                }`}
                title="Table Directory View"
              >
                <span className="material-symbols-outlined text-lg">view_list</span>
              </button>
            </div>
          </div>
        </div>

        {/* Status Checkboxes Row */}
        <div className="flex items-center gap-4 pt-2 border-t border-[#e8e2d8]/60 text-xs">
          <span className="font-bold text-[#5f5e5e]">Filter Status:</span>
          <div className="flex items-center gap-4 flex-wrap">
            {QR_LOCATION_STATUSES.map((st) => {
              const checked = selectedStatusSet.has(st);
              const style = QR_STATUS_BADGE_STYLES[st];
              return (
                <label key={st} className="flex items-center gap-1.5 cursor-pointer font-semibold select-none">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleStatusCheckbox(st)}
                    className="w-3.5 h-3.5 rounded text-[#ae001a] focus:ring-[#ae001a]"
                  />
                  <span className={`px-2 py-0.5 rounded-full text-[11px] border ${style.bg}`}>
                    {style.text}
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="py-20 text-center space-y-3 bg-white border border-[#e8e2d8] rounded-2xl">
          <div className="inline-block w-10 h-10 border-4 border-[#ae001a] border-t-transparent rounded-full animate-spin"></div>
          <p className="text-[#5f5e5e] text-sm font-medium">Loading QR Locations & relational entities...</p>
        </div>
      ) : error ? (
        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-6 text-center space-y-3">
          <span className="material-symbols-outlined text-4xl text-red-600">error</span>
          <p className="text-red-700 font-semibold">{error}</p>
          <button
            onClick={loadData}
            className="px-4 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-800 rounded-xl text-sm font-medium border border-red-600/40"
          >
            Retry Loading
          </button>
        </div>
      ) : filteredLocations.length === 0 ? (
        <div className="bg-white border border-[#e8e2d8] rounded-2xl p-12 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-[#fef9f1] border border-[#e8e2d8] flex items-center justify-center mx-auto text-[#5f5e5e]">
            <span className="material-symbols-outlined text-3xl">qr_code_scanner</span>
          </div>
          <div>
            <h3 className="text-lg font-bold text-[#1d1c17] font-poppins">No QR Locations Found</h3>
            <p className="text-[#5f5e5e] text-sm max-w-md mx-auto mt-1">
              No QR location access points match your current search terms or filter selection.
            </p>
          </div>
          <button
            onClick={handleOpenCreateDrawer}
            className="px-4 py-2.5 bg-[#ae001a] text-white font-bold rounded-xl text-sm shadow-md hover:bg-[#900015] transition-colors duration-200"
          >
            Configure New Access Point
          </button>
        </div>
      ) : viewMode === 'grid' ? (
        /* GRID VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredLocations.map((loc) => {
            const statusConfig = QR_STATUS_BADGE_STYLES[loc.status];
            const isSelected = selectedIds.has(loc.id);

            return (
              <div
                key={loc.id}
                className={`bg-white border rounded-2xl p-5 shadow-sm flex flex-col justify-between transition-all duration-200 group relative ${
                  isSelected ? 'border-[#ae001a] ring-2 ring-[#ae001a]/20 bg-red-50/10' : 'border-[#e8e2d8] hover:border-[#ae001a]/50'
                }`}
              >
                <div>
                  {/* Top Bar: Checkbox, Badge ID & Status Pill */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectId(loc.id)}
                        className="w-4 h-4 rounded text-[#ae001a] focus:ring-[#ae001a] cursor-pointer"
                      />
                      <span className="px-2.5 py-1 bg-[#fef9f1] border border-[#e8e2d8] rounded-lg text-xs font-mono font-bold text-[#ae001a]">
                        #QR-LOC-{loc.id}
                      </span>
                    </div>

                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold border ${statusConfig.bg}`}
                    >
                      {statusConfig.text}
                    </span>
                  </div>

                  {/* Name & Context */}
                  <h3 className="text-lg font-bold text-[#1d1c17] group-hover:text-[#ae001a] transition-colors duration-200 font-poppins">
                    {loc.name}
                  </h3>

                  {/* Location Type Pill & Table Tag */}
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <span className="px-2.5 py-0.5 rounded-md bg-blue-500/10 border border-blue-500/20 text-blue-700 text-xs font-semibold flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm">
                        {loc.location_type === 'DINE_IN'
                          ? 'restaurant'
                          : loc.location_type === 'PICKUP'
                          ? 'shopping_bag'
                          : loc.location_type === 'DELIVERY'
                          ? 'local_shipping'
                          : 'room_service'}
                      </span>
                      {QR_LOCATION_TYPE_LABELS[loc.location_type]}
                    </span>

                    <span className="px-2.5 py-0.5 rounded-md bg-[#fef9f1] text-[#1d1c17] text-xs font-semibold flex items-center gap-1 border border-[#e8e2d8] font-poppins">
                      <span className="material-symbols-outlined text-sm">table_restaurant</span>
                      {loc.table?.number ? `Table #${loc.table.number}` : 'Virtual Access Point'}
                    </span>
                  </div>

                  {/* Assigned Menu */}
                  <div className="mt-4 pt-3 border-t border-[#e8e2d8] flex items-center justify-between text-xs text-[#5f5e5e]">
                    <span className="font-semibold">Assigned Menu:</span>
                    <span className="text-[#1d1c17] font-bold truncate max-w-[180px] font-poppins">
                      {loc.qrMenu?.name || `Menu #${loc.qr_menu_id}`}
                    </span>
                  </div>

                  {/* QR Image Thumbnail preview */}
                  <div className="mt-4 bg-[#fef9f1] border border-[#e8e2d8] p-3 rounded-xl flex items-center justify-center relative group/qr">
                    <img
                      src={loc.qr_code_image}
                      alt={loc.name}
                      className="w-36 h-36 object-contain"
                    />
                    <div className="absolute inset-0 bg-[#1d1c17]/80 backdrop-blur-xs opacity-0 group-hover/qr:opacity-100 transition duration-200 rounded-xl flex items-center justify-center p-2">
                      <button
                        onClick={() => setExportModalLocation(loc)}
                        className="px-3 py-1.5 bg-[#ae001a] text-white font-bold rounded-lg text-xs shadow hover:bg-[#900015] flex items-center gap-1 transition-colors duration-200"
                      >
                        <span className="material-symbols-outlined text-base">fullscreen</span>
                        Expand Assets
                      </button>
                    </div>
                  </div>
                </div>

                {/* Footer Actions */}
                <div className="mt-5 pt-3 border-t border-[#e8e2d8] flex items-center justify-between gap-2">
                  <button
                    onClick={() => handleCopyUrl(loc.qr_code_url, loc.id)}
                    className="text-xs text-[#5f5e5e] hover:text-[#ae001a] flex items-center gap-1 font-mono transition-colors duration-200 font-semibold"
                    title="Copy Dynamic QR Link"
                  >
                    <span className="material-symbols-outlined text-base">
                      {copiedUrlId === loc.id ? 'check' : 'link'}
                    </span>
                    {copiedUrlId === loc.id ? 'Copied!' : 'Copy Link'}
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setExportModalLocation(loc)}
                      className="px-3 py-1.5 bg-white hover:bg-slate-50 text-[#1d1c17] hover:text-[#ae001a] text-xs font-semibold rounded-lg border border-[#e8e2d8] transition-colors duration-200 flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-base">print</span>
                      Print / Asset
                    </button>
                    <button
                      onClick={() => handleOpenEditDrawer(loc)}
                      className="p-1.5 text-[#5f5e5e] hover:text-[#ae001a] bg-[#fef9f1] hover:bg-slate-100 rounded-lg transition-colors duration-200 border border-[#e8e2d8]"
                      title="Configure / Edit Location"
                    >
                      <span className="material-symbols-outlined text-base">edit</span>
                    </button>
                    <button
                      onClick={() => handleDelete(loc.id)}
                      className="p-1.5 text-[#5f5e5e] hover:text-red-600 bg-[#fef9f1] hover:bg-red-50 rounded-lg transition-colors duration-200 border border-[#e8e2d8]"
                      title="Delete / Archive"
                    >
                      <span className="material-symbols-outlined text-base">delete</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* TABLE DIRECTORY VIEW */
        <div className="bg-white border border-[#e8e2d8] rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-[#1d1c17] font-poppins">
              <thead className="bg-[#fef9f1] text-xs uppercase tracking-wider text-[#5f5e5e] border-b border-[#e8e2d8]">
                <tr>
                  <th className="py-3.5 px-4 font-semibold w-10">Select</th>
                  <th className="py-3.5 px-4 font-semibold">Location Badge & Name</th>
                  <th className="py-3.5 px-4 font-semibold">Assigned Menu</th>
                  <th className="py-3.5 px-4 font-semibold">Table Context</th>
                  <th className="py-3.5 px-4 font-semibold">Location Type</th>
                  <th className="py-3.5 px-4 font-semibold">Status</th>
                  <th className="py-3.5 px-4 font-semibold">QR Code & Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e8e2d8]">
                {filteredLocations.map((loc) => {
                  const statusConfig = QR_STATUS_BADGE_STYLES[loc.status];
                  const isSelected = selectedIds.has(loc.id);

                  return (
                    <tr key={loc.id} className={`hover:bg-[#fef9f1]/60 transition-colors duration-200 ${isSelected ? 'bg-red-50/20' : ''}`}>
                      <td className="py-4 px-4">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectId(loc.id)}
                          className="w-4 h-4 rounded text-[#ae001a] focus:ring-[#ae001a] cursor-pointer"
                        />
                      </td>

                      {/* Location Badge & Name */}
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <span className="px-2 py-0.5 bg-[#fef9f1] border border-[#e8e2d8] rounded text-xs font-mono font-bold text-[#ae001a]">
                            #QR-LOC-{loc.id}
                          </span>
                          <div>
                            <span className="font-bold text-[#1d1c17] hover:text-[#ae001a] transition-colors duration-200 block font-poppins">{loc.name}</span>
                            <span className="text-xs text-[#5f5e5e] font-mono">{loc.qr_code_url}</span>
                          </div>
                        </div>
                      </td>

                      {/* Assigned Menu */}
                      <td className="py-4 px-4 font-semibold text-[#1d1c17]">
                        {loc.qrMenu?.name || `Menu #${loc.qr_menu_id}`}
                      </td>

                      {/* Table Context Tag */}
                      <td className="py-4 px-4">
                        <span className="px-2.5 py-1 rounded-md bg-[#fef9f1] text-[#1d1c17] text-xs font-medium border border-[#e8e2d8] font-poppins">
                          {loc.table?.number ? `Table #${loc.table.number}` : 'Virtual Access Point'}
                        </span>
                      </td>

                      {/* Location Type Pill */}
                      <td className="py-4 px-4">
                        <span className="px-2.5 py-1 rounded-md bg-blue-500/10 border border-blue-500/20 text-blue-700 text-xs font-semibold">
                          {QR_LOCATION_TYPE_LABELS[loc.location_type]}
                        </span>
                      </td>

                      {/* Status Pill */}
                      <td className="py-4 px-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${statusConfig.bg}`}>
                          {statusConfig.text}
                        </span>
                      </td>

                      {/* Actions & QR Thumbnail */}
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={loc.qr_code_image}
                            alt={loc.name}
                            className="w-10 h-10 bg-white p-1 rounded-lg border border-[#e8e2d8] cursor-pointer hover:scale-105 transition-transform duration-200 shadow-xs"
                            onClick={() => setExportModalLocation(loc)}
                            title="Click to preview QR Asset"
                          />
                          <button
                            onClick={() => setExportModalLocation(loc)}
                            className="px-3 py-1.5 bg-white hover:bg-slate-50 text-[#1d1c17] hover:text-[#ae001a] text-xs font-semibold rounded-lg border border-[#e8e2d8] transition-colors duration-200 flex items-center gap-1"
                          >
                            <span className="material-symbols-outlined text-base">print</span>
                            Print / Asset
                          </button>
                          <button
                            onClick={() => handleOpenEditDrawer(loc)}
                            className="p-1.5 text-[#5f5e5e] hover:text-[#ae001a] bg-[#fef9f1] rounded-lg transition-colors duration-200 border border-[#e8e2d8]"
                          >
                            <span className="material-symbols-outlined text-base">edit</span>
                          </button>
                          <button
                            onClick={() => handleDelete(loc.id)}
                            className="p-1.5 text-[#5f5e5e] hover:text-red-600 bg-[#fef9f1] rounded-lg transition-colors duration-200 border border-[#e8e2d8]"
                          >
                            <span className="material-symbols-outlined text-base">delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ADD / EDIT LOCATION SIDE DRAWER MODAL (POST / PATCH /api/v1/qr-locations) */}
      {isDrawerOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-[9998] bg-black/60 backdrop-blur-xs transition-opacity"
            onClick={() => setIsDrawerOpen(false)}
          />

          {/* Slide Drawer Container */}
          <div className="fixed inset-y-0 right-0 z-[9999] w-full max-w-lg bg-white border-l border-[#e8e2d8] shadow-2xl flex flex-col transform transition-transform duration-300 ease-in-out text-[#1d1c17] font-poppins">
            {/* Drawer Header (Pinned Top) */}
            <div className="px-6 py-4 bg-[#fef9f1] border-b border-[#e8e2d8] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#ae001a] text-2xl font-bold">
                  {editingLocation ? 'edit_location' : 'add_location_alt'}
                </span>
                <div>
                  <h2 className="text-lg font-bold text-[#1d1c17]">
                    {editingLocation ? `Edit QR Location #QR-LOC-${editingLocation.id}` : 'Configure New QR Access Point'}
                  </h2>
                  <p className="text-xs text-[#5f5e5e]">POST / PATCH /api/v1/qr-locations</p>
                </div>
              </div>
              <button
                onClick={() => setIsDrawerOpen(false)}
                className="text-[#5f5e5e] hover:text-[#ae001a] p-1.5 rounded-lg transition-colors duration-200 hover:bg-slate-200"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            {/* Drawer Body (Scrollable Form) */}
            <form id="qr-drawer-form" onSubmit={handleSaveLocation} className="p-6 space-y-5 overflow-y-auto flex-1 bg-white">
              {formError && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3.5 text-red-700 text-xs font-semibold flex items-center gap-2">
                  <span className="material-symbols-outlined text-lg">warning</span>
                  {formError}
                </div>
              )}

              {/* Location Name Input (Max 100 chars limit) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-[#1d1c17]">
                    Location Name / Label <span className="text-[#ae001a]">*</span>
                  </label>
                  <span className="text-[11px] font-mono text-[#5f5e5e]">
                    {formData.name.length}/100 chars
                  </span>
                </div>
                <input
                  type="text"
                  required
                  maxLength={100}
                  placeholder='e.g., "Patio Table #12", "Main Bar Counter Spot 3"'
                  value={formData.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  className={`w-full bg-[#fef9f1] border rounded-xl px-3.5 py-2.5 text-sm text-[#1d1c17] placeholder-[#5f5e5e] focus:outline-none font-poppins ${
                    fieldErrors.name
                      ? 'border-red-500 ring-1 ring-red-500'
                      : 'border-[#e8e2d8] focus:border-[#ae001a] focus:ring-1 focus:ring-[#ae001a]'
                  }`}
                />
                {fieldErrors.name && (
                  <p className="text-[11px] text-red-600 font-semibold mt-1 flex items-center gap-1">
                    <span className="material-symbols-outlined text-xs">error</span>
                    {fieldErrors.name}
                  </p>
                )}
              </div>

              {/* Merchant Context */}
              <div>
                <label className="block text-xs font-bold text-[#1d1c17] mb-1">Merchant Context</label>
                <select
                  value={formData.merchant_id}
                  onChange={(e) => {
                    const mId = parseInt(e.target.value, 10);
                    setFormData((prev) => ({ ...prev, merchant_id: mId }));
                  }}
                  className="w-full bg-[#fef9f1] border border-[#e8e2d8] rounded-xl px-3.5 py-2.5 text-sm text-[#1d1c17] focus:outline-none focus:border-[#ae001a] font-poppins"
                >
                  {merchants.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.code || `#${m.id}`})
                    </option>
                  ))}
                </select>
              </div>

              {/* QR Menu Selector (qr_menu_id) */}
              <div>
                <label className="block text-xs font-bold text-[#1d1c17] mb-1">
                  Assigned Active QR Menu <span className="text-[#ae001a]">*</span>
                </label>
                <select
                  value={formData.qr_menu_id || ''}
                  onChange={(e) => setFormData((prev) => ({ ...prev, qr_menu_id: parseInt(e.target.value, 10) }))}
                  className={`w-full bg-[#fef9f1] border rounded-xl px-3.5 py-2.5 text-sm text-[#1d1c17] focus:outline-none font-poppins ${
                    fieldErrors.qr_menu_id
                      ? 'border-red-500'
                      : 'border-[#e8e2d8] focus:border-[#ae001a]'
                  }`}
                >
                  {menus.length === 0 ? (
                    <option value="" disabled>No QR menus found for this merchant</option>
                  ) : (
                    menus.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))
                  )}
                </select>
                {menus.length === 0 && (
                  <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2 mt-1.5 font-medium">
                    No active QR menus available for this merchant. Make sure at least one QR Menu is created first.
                  </p>
                )}
                {fieldErrors.qr_menu_id && (
                  <p className="text-[11px] text-red-600 font-semibold mt-1">{fieldErrors.qr_menu_id}</p>
                )}
              </div>

              {/* Searchable Dining Table Picker (table_id, nullable) */}
              <div>
                <label className="block text-xs font-bold text-[#1d1c17] mb-1">
                  Physical Dining Table (Optional)
                </label>
                <div className="space-y-2">
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-2 text-[#5f5e5e] text-base">search</span>
                    <input
                      type="text"
                      placeholder="Filter tables by number or zone..."
                      value={tableSearchQuery}
                      onChange={(e) => setTableSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-3 py-1.5 bg-white border border-[#e8e2d8] rounded-lg text-xs text-[#1d1c17] focus:outline-none focus:border-[#ae001a] font-poppins"
                    />
                  </div>
                  <select
                    value={formData.table_id ?? ''}
                    onChange={(e) => handleTableSelection(e.target.value)}
                    className={`w-full bg-[#fef9f1] border rounded-xl px-3.5 py-2.5 text-sm text-[#1d1c17] focus:outline-none font-poppins ${
                      fieldErrors.table_id ? 'border-red-500' : 'border-[#e8e2d8] focus:border-[#ae001a]'
                    }`}
                  >
                    <option value="">Virtual Access Point (No Physical Table Linked)</option>
                    {searchableTables.map((t) => (
                      <option key={t.id} value={t.id}>
                        Table #{t.number} ({t.zone_name || 'Floor Plan'}) - Cap: {t.capacity || 4}
                      </option>
                    ))}
                  </select>
                </div>
                <p className="text-[11px] text-[#5f5e5e] mt-1">
                  Linking a table auto-sets location context to Dine-In auto-ordering.
                </p>
                {fieldErrors.table_id && (
                  <p className="text-[11px] text-red-600 font-semibold mt-1">{fieldErrors.table_id}</p>
                )}
              </div>

              {/* Location Type Classification */}
              <div>
                <label className="block text-xs font-bold text-[#1d1c17] mb-1">
                  Location Type Classification <span className="text-[#ae001a]">*</span>
                </label>
                <select
                  value={formData.location_type}
                  onChange={(e) => setFormData((prev) => ({ ...prev, location_type: e.target.value as QRMenuType }))}
                  className="w-full bg-[#fef9f1] border border-[#e8e2d8] rounded-xl px-3.5 py-2.5 text-sm text-[#1d1c17] focus:outline-none focus:border-[#ae001a] font-poppins"
                >
                  {QR_LOCATION_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {QR_LOCATION_TYPE_LABELS[t]}
                    </option>
                  ))}
                </select>
              </div>

              {/* Operational Status Selector */}
              <div>
                <label className="block text-xs font-bold text-[#1d1c17] mb-1">
                  Operational Status <span className="text-[#ae001a]">*</span>
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {QR_LOCATION_STATUSES.map((st) => {
                    const style = QR_STATUS_BADGE_STYLES[st];
                    const selected = formData.status === st;
                    return (
                      <button
                        key={st}
                        type="button"
                        onClick={() => setFormData((prev) => ({ ...prev, status: st }))}
                        className={`p-2.5 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-2 ${
                          selected
                            ? `${style.bg} ring-2 ring-[#10b981]/50`
                            : 'bg-[#fef9f1] border-[#e8e2d8] text-[#5f5e5e] hover:text-[#1d1c17]'
                        }`}
                      >
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: style.hex }}
                        ></span>
                        {style.text}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Live Vector QR Asset Preview Box */}
              <div className="mt-4 p-4 bg-[#fef9f1] border border-[#e8e2d8] rounded-xl flex items-center gap-4">
                <div className="bg-white p-2 rounded-lg shrink-0 border border-[#e8e2d8]">
                  <img src={previewQrSvg} alt="QR Preview" className="w-20 h-20 object-contain" />
                </div>
                <div className="space-y-1 text-xs">
                  <span className="px-2 py-0.5 rounded bg-[#ae001a]/10 text-[#ae001a] font-semibold border border-[#ae001a]/30">
                    Dynamic QR Asset Engine
                  </span>
                  <p className="text-[#5f5e5e]">Scanning Target URL:</p>
                  <p className="text-[#1d1c17] font-mono text-[11px] truncate max-w-xs">{previewUrl}</p>
                </div>
              </div>
            </form>

            {/* Drawer Footer (Pinned Bottom) */}
            <div className="px-6 py-4 bg-[#fef9f1] border-t border-[#e8e2d8] flex items-center justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setIsDrawerOpen(false)}
                className="px-4 py-2 bg-white hover:bg-slate-100 text-[#1d1c17] font-semibold rounded-xl text-sm border border-[#e8e2d8] transition-colors duration-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="qr-drawer-form"
                className="px-5 py-2 bg-[#ae001a] hover:bg-[#900015] text-white font-bold rounded-xl text-sm shadow-md transition-colors duration-200"
              >
                {editingLocation ? 'Save Changes' : 'Create Access Point'}
              </button>
            </div>
          </div>
        </>
      )}

      {/* SINGLE PRINT & ASSET EXPORT CONTROLLER MODAL (PNG, SVG, PDF Templates: Acrylic Stand, Table Sticker, Tent Card) */}
      {exportModalLocation && (
        <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-[#e8e2d8] rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden p-6 space-y-5 text-center my-auto max-h-[90vh] flex flex-col text-[#1d1c17] font-poppins">
            <div className="flex items-center justify-between pb-3 border-b border-[#e8e2d8] shrink-0">
              <div className="text-left">
                <h3 className="text-lg font-bold text-[#1d1c17]">Print & Asset Export Controller</h3>
                <p className="text-xs text-[#5f5e5e]">High-Res SVG, PNG & Printable Template Sizes</p>
              </div>
              <button
                onClick={() => setExportModalLocation(null)}
                className="text-[#5f5e5e] hover:text-[#ae001a] p-1 rounded-lg transition-colors duration-200"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            {/* Template Selector */}
            <div className="flex items-center justify-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setPrintTemplate('acrylic')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors duration-200 ${
                  printTemplate === 'acrylic'
                    ? 'bg-[#ae001a] text-white border-[#ae001a]'
                    : 'bg-[#fef9f1] text-[#5f5e5e] border-[#e8e2d8] hover:text-[#ae001a]'
                }`}
              >
                Table Acrylic (4" x 6")
              </button>
              <button
                type="button"
                onClick={() => setPrintTemplate('sticker')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors duration-200 ${
                  printTemplate === 'sticker'
                    ? 'bg-[#ae001a] text-white border-[#ae001a]'
                    : 'bg-[#fef9f1] text-[#5f5e5e] border-[#e8e2d8] hover:text-[#ae001a]'
                }`}
              >
                Table Sticker (3" x 3")
              </button>
              <button
                type="button"
                onClick={() => setPrintTemplate('tentCard')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors duration-200 ${
                  printTemplate === 'tentCard'
                    ? 'bg-[#ae001a] text-white border-[#ae001a]'
                    : 'bg-[#fef9f1] text-[#5f5e5e] border-[#e8e2d8] hover:text-[#ae001a]'
                }`}
              >
                Tent Card (5" x 7")
              </button>
            </div>

            {/* Print Card Container */}
            <div className="overflow-y-auto space-y-4 flex-1">
              <div
                id="qr-print-card-single"
                className={`bg-white rounded-2xl text-slate-950 space-y-4 shadow-xl border border-slate-200 mx-auto transition-all duration-200 ${
                  printTemplate === 'sticker'
                    ? 'p-4 max-w-[280px]'
                    : printTemplate === 'tentCard'
                    ? 'p-6 max-w-[360px]'
                    : 'p-6 max-w-[320px]'
                }`}
              >
                <div className="flex items-center justify-between border-b pb-3 border-slate-200">
                  <span className="text-xs font-bold tracking-widest text-[#ae001a] uppercase truncate max-w-[180px]">
                    {exportModalLocation.merchant?.name || 'X7 POS RESTAURANT'}
                  </span>
                  <span className="px-2 py-0.5 bg-slate-100 rounded text-[10px] font-mono font-bold text-slate-700">
                    #QR-LOC-{exportModalLocation.id}
                  </span>
                </div>

                <div>
                  <h2 className="text-xl font-extrabold text-slate-900 font-poppins">{exportModalLocation.name}</h2>
                  <p className="text-xs font-semibold text-[#ae001a] mt-0.5">
                    {exportModalLocation.table?.number
                      ? `Dine-In Table #${exportModalLocation.table.number}`
                      : QR_LOCATION_TYPE_LABELS[exportModalLocation.location_type]}
                  </p>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl flex items-center justify-center border border-slate-200">
                  <img
                    src={exportModalLocation.qr_code_image}
                    alt={exportModalLocation.name}
                    className="w-48 h-48 object-contain"
                  />
                </div>

                <div className="text-[11px] text-slate-600 space-y-1">
                  <p className="font-semibold text-slate-800">Scan to View Digital Menu & Order</p>
                  <p className="font-mono text-[10px] text-slate-500 break-all">
                    {exportModalLocation.qr_code_url}
                  </p>
                </div>
              </div>
            </div>

            {/* Export Actions */}
            <div className="grid grid-cols-3 gap-2 pt-2 shrink-0">
              <button
                onClick={() => window.print()}
                className="px-3 py-2.5 bg-[#ae001a] hover:bg-[#900015] text-white font-bold rounded-xl text-xs shadow transition-colors duration-200 flex items-center justify-center gap-1"
              >
                <span className="material-symbols-outlined text-base">print</span>
                Print PDF
              </button>
              <button
                onClick={() => handleDownloadPng(exportModalLocation)}
                className="px-3 py-2.5 bg-purple-700 hover:bg-purple-800 text-white font-bold rounded-xl text-xs shadow transition-colors duration-200 flex items-center justify-center gap-1"
              >
                <span className="material-symbols-outlined text-base">image</span>
                High-Res PNG
              </button>
              <button
                onClick={() => {
                  const link = document.createElement('a');
                  link.href = exportModalLocation.qr_code_image;
                  link.download = `QR-LOC-${exportModalLocation.id}-${exportModalLocation.name.replace(/\s+/g, '_')}.svg`;
                  link.click();
                }}
                className="px-3 py-2.5 bg-white hover:bg-slate-50 text-[#1d1c17] hover:text-[#ae001a] font-bold rounded-xl text-xs border border-[#e8e2d8] transition-colors duration-200 flex items-center justify-center gap-1"
              >
                <span className="material-symbols-outlined text-base">download</span>
                Vector SVG
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BATCH EXPORT & PRINT CONTROLLER MODAL */}
      {isBatchExportOpen && (
        <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-[#e8e2d8] rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden p-6 space-y-5 my-auto max-h-[90vh] flex flex-col text-[#1d1c17] font-poppins">
            <div className="flex items-center justify-between pb-3 border-b border-[#e8e2d8] shrink-0">
              <div>
                <h3 className="text-lg font-bold text-[#1d1c17]">Batch Print & Asset Export Package</h3>
                <p className="text-xs text-[#5f5e5e]">
                  Generating printable layout for {selectedLocationsList.length} selected QR Locations
                </p>
              </div>
              <button
                onClick={() => setIsBatchExportOpen(false)}
                className="text-[#5f5e5e] hover:text-[#ae001a] p-1 rounded-lg transition-colors duration-200"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            {/* Batch Cards Grid Container (Print Layout) */}
            <div className="overflow-y-auto flex-1 p-4 bg-slate-100 rounded-xl space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {selectedLocationsList.map((loc) => (
                  <div
                    key={loc.id}
                    className="bg-white p-4 rounded-xl border border-slate-300 shadow text-center space-y-2 font-poppins"
                  >
                    <div className="flex items-center justify-between text-[10px] text-slate-500 font-bold border-b pb-1">
                      <span>#QR-LOC-{loc.id}</span>
                      <span className="text-[#ae001a] uppercase">{loc.location_type}</span>
                    </div>
                    <h4 className="font-bold text-slate-900 text-sm truncate">{loc.name}</h4>
                    <img src={loc.qr_code_image} alt={loc.name} className="w-32 h-32 mx-auto object-contain" />
                    <p className="text-[10px] font-mono text-slate-500 truncate">{loc.qr_code_url}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Batch Actions */}
            <div className="flex items-center justify-between pt-2 shrink-0 border-t border-[#e8e2d8]">
              <span className="text-xs text-[#5f5e5e] font-semibold">
                Ready for acrylic stands & sticker sheets
              </span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsBatchExportOpen(false)}
                  className="px-4 py-2 bg-slate-100 text-[#1d1c17] hover:text-[#ae001a] font-semibold rounded-xl text-sm border border-[#e8e2d8] transition-colors duration-200"
                >
                  Close
                </button>
                <button
                  onClick={() => window.print()}
                  className="px-5 py-2 bg-[#ae001a] hover:bg-[#900015] text-white font-bold rounded-xl text-sm shadow-md flex items-center gap-2 transition-colors duration-200"
                >
                  <span className="material-symbols-outlined text-lg">print</span>
                  Print All Cards
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
