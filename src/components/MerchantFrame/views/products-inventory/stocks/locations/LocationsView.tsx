import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { getAccessToken, clearAuthSession } from '../../../../../../lib/auth-storage';
import { QuickLaunchPanel } from '../../../../shared/QuickLaunchPanel';
import { EmergencySupportModal } from '../../../../modals/QuickActionModals';

interface StockItem {
  id: number;
  sku: string;
  quantity: number;
}

interface Location {
  id: number;
  name: string;
  address: string;
  isActive: boolean;
  items?: StockItem[];
}

interface LocationsViewProps {
  onNavigate?: (view: string) => void;
}

export const LocationsView: React.FC<LocationsViewProps> = ({ onNavigate }) => {
  const [locations, setLocations] = useState<Location[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filtros locales
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('All Statuses');

  // Estados de Cajones Laterales (Drawers)
  const [isFormDrawerOpen, setIsFormDrawerOpen] = useState<boolean>(false);
  const [formDrawerMode, setFormDrawerMode] = useState<'add' | 'edit'>('add');
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);

  const [isDetailDrawerOpen, setIsDetailDrawerOpen] = useState<boolean>(false);

  // Campos del Formulario
  const [formName, setFormName] = useState<string>('');
  const [formAddress, setFormAddress] = useState<string>('');
  const [formIsActive, setFormIsActive] = useState<boolean>(true);

  // Estados para modal de confirmación de activación/desactivación
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState<boolean>(false);
  const [confirmTargetLocation, setConfirmTargetLocation] = useState<Location | null>(null);
  const [isToggling, setIsToggling] = useState<boolean>(false);
  const [toggleError, setToggleError] = useState<string | null>(null);



  // Soporte
  const [isSupportOpen, setIsSupportOpen] = useState<boolean>(false);

  const topRef = useRef<HTMLDivElement | null>(null);
  const API_BASE = import.meta.env.VITE_API_URL ?? '/api';

  // Auto-scroll al inicio al montar la vista
  useEffect(() => {
    if (topRef.current) {
      topRef.current.scrollIntoView({ behavior: 'instant' });
    }
  }, []);

  // Carga de datos de la API (Sincronización silenciosa en segundo plano)
  const fetchLocations = async (silent = false) => {
    if (!silent) setIsLoading(true);
    setError(null);
    try {
      const token = getAccessToken();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      };

      const merchantId = sessionStorage.getItem('x7:branch-context') || '1';

      // 1. Intentar primero la ruta de negocio estricta
      let res = await fetch(`${API_BASE}/v1/inventory/locations?merchantId=${merchantId}`, { headers });
      
      // 2. Fallback a /locations
      if (!res.ok || res.status === 404 || res.status === 400) {
        const fallbackRes = await fetch(`${API_BASE}/locations`, { headers });
        if (fallbackRes.ok) {
          res = fallbackRes;
        }
      }

      if (res.status === 401) {
        clearAuthSession();
        window.location.href = '/login';
        return;
      }

      if (!res.ok) {
        throw new Error('Error al cargar ubicaciones de inventario');
      }

      const json = await res.json();
      const data = json.data || json || [];
      setLocations(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error(err);
      if (!silent) setError('Failed to load inventory locations. Please check if the backend is running.');
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLocations();
  }, []);

  // Abrir Form Drawer para Creación
  const handleOpenAddDrawer = () => {
    setFormDrawerMode('add');
    setSelectedLocation(null);
    setFormName('');
    setFormAddress('');
    setFormIsActive(true);
    setIsFormDrawerOpen(true);
  };

  // Abrir Form Drawer para Edición
  const handleOpenEditDrawer = (e: React.MouseEvent, loc: Location) => {
    e.stopPropagation(); // Evitar Detail Drawer
    setFormDrawerMode('edit');
    setSelectedLocation(loc);
    setFormName(loc.name);
    setFormAddress(loc.address);
    setFormIsActive(loc.isActive);
    setIsFormDrawerOpen(true);
  };

  // Abrir Detail Drawer
  const handleOpenDetailDrawer = (loc: Location) => {
    setSelectedLocation(loc);
    setIsDetailDrawerOpen(true);
  };

  // Abrir Modal de Confirmación
  const handleOpenConfirmToggle = (e: React.MouseEvent, loc: Location) => {
    e.stopPropagation();
    setConfirmTargetLocation(loc);
    setToggleError(null);
    setIsConfirmModalOpen(true);
  };

  // Activar/Desactivar ubicación mediante el Modal
  const executeToggleActive = async () => {
    if (!confirmTargetLocation) return;
    setIsToggling(true);
    setToggleError(null);
    try {
      const token = getAccessToken();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      };

      const newIsActive = !confirmTargetLocation.isActive;
      let res;

      if (!newIsActive) {
        // Para desactivar, usamos DELETE que en el backend sí tiene manejo correcto con 'Deleted'
        res = await fetch(`${API_BASE}/locations/${confirmTargetLocation.id}`, {
          method: 'DELETE',
          headers
        });
      } else {
        // Para activar, usamos PATCH con isActive: true
        res = await fetch(`${API_BASE}/locations/${confirmTargetLocation.id}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ isActive: true })
        });
      }

      if (!res.ok) {
        const errorJson = await res.json().catch(() => ({}));
        throw new Error(errorJson.message || 'Error al cambiar el estado de la ubicación');
      }

      setLocations((prevLocations) =>
        prevLocations.map((l) =>
          l.id === confirmTargetLocation.id ? { ...l, isActive: newIsActive } : l
        )
      );
      setIsConfirmModalOpen(false);
      setConfirmTargetLocation(null);
    } catch (err: any) {
      console.error(err);
      setToggleError(err.message || 'Error al cambiar el estado de la ubicación');
    } finally {
      setIsToggling(false);
    }
  };

  // Enviar Mutación (Crear / Editar)
  const handleSubmitLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formAddress.trim()) {
      alert('Name and Address are strictly required.');
      return;
    }

    try {
      const token = getAccessToken();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      };

      let res;

      if (formDrawerMode === 'add') {
        const payload = {
          name: formName,
          address: formAddress,
          isActive: formIsActive
        };
        res = await fetch(`${API_BASE}/locations`, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload)
        });
      } else if (selectedLocation) {
        const wasActive = selectedLocation.isActive;
        const nowActive = formIsActive;

        if (wasActive && !nowActive) {
          // Cambió de Activo a Inactivo:
          // 1. Guardamos los datos de name/address usando PATCH (dejando isActive en true)
          const patchRes = await fetch(`${API_BASE}/locations/${selectedLocation.id}`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ name: formName, address: formAddress, isActive: true })
          });
          if (!patchRes.ok) {
            const errBody = await patchRes.json().catch(() => ({}));
            throw new Error(errBody.message || 'Error al actualizar datos de la ubicación');
          }
          // 2. Desactivamos lógicamente usando DELETE
          res = await fetch(`${API_BASE}/locations/${selectedLocation.id}`, {
            method: 'DELETE',
            headers
          });
        } else if (!wasActive && nowActive) {
          // Cambió de Inactivo a Activo: PATCH con isActive: true
          res = await fetch(`${API_BASE}/locations/${selectedLocation.id}`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ name: formName, address: formAddress, isActive: true })
          });
        } else {
          // Sin cambio de estado: PATCH normal
          res = await fetch(`${API_BASE}/locations/${selectedLocation.id}`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ name: formName, address: formAddress, isActive: formIsActive })
          });
        }
      }

      if (res && !res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || 'Error al guardar la ubicación');
      }

      setIsFormDrawerOpen(false);
      // Sincronización silenciosa de fondo
      fetchLocations(true);
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Error al guardar la ubicación');
    }
  };



  // Filtrado reactivo en caliente
  const filteredLocations = locations.filter((loc) => {
    const matchesSearch =
      loc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      loc.address.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === 'All Statuses' ||
      (statusFilter === 'Active' && loc.isActive) ||
      (statusFilter === 'Inactive' && !loc.isActive);

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="flex flex-col gap-6 animate-fade-in text-left font-sans">
      <div ref={topRef} />

      {/* Título de Sección */}
      <div className="bg-white border border-[#e8e2d8] p-6 rounded shadow-sm">
        <div>
          <h2 className="text-[#ae001a] font-bold text-heading-lg tracking-wider uppercase font-sans">
            Warehouse Locations & Physical Nodes
          </h2>
          <p className="text-[#5f5e5e] text-body-sm font-sans mt-1">
            Establish storage nodes, physical warehouses, branch inventories, and distribution points for business logistics.
          </p>
        </div>
      </div>

      {/* Barra de Búsqueda y Filtros */}
      <div className="bg-white border border-[#e8e2d8] p-6 rounded shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="relative w-full md:w-96">
          <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-secondary font-sans">
            search
          </span>
          <input
            type="text"
            placeholder="Search locations by name or address..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-4 py-2 bg-[#fef9f1] rounded border border-[#e8e2d8] focus:border-[#ae001a] focus:ring-1 focus:ring-[#ae001a] outline-none text-body-md transition-all font-sans"
          />
        </div>

        <div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
          {/* Filtro por Estado */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 bg-[#fef9f1] rounded border border-[#e8e2d8] text-body-sm focus:border-[#ae001a] focus:ring-1 focus:ring-[#ae001a] outline-none min-w-[130px] font-sans text-secondary cursor-pointer"
          >
            <option value="All Statuses">All Status</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>

          {/* Botón Añadir Ubicación */}
          <button
            onClick={handleOpenAddDrawer}
            className="bg-[#ae001a] text-white font-bold text-label-caps px-6 py-2.5 rounded hover:bg-[#d2272f] transition-colors flex items-center gap-2 font-sans cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            ADD LOCATION
          </button>

          <button
            onClick={() => fetchLocations()}
            className="p-2.5 bg-white border border-[#e8e2d8] rounded hover:bg-[#fef9f1] text-secondary hover:text-[#ae001a] transition-all flex items-center justify-center cursor-pointer"
            title="Reload locations"
          >
            <span className="material-symbols-outlined text-[18px]">refresh</span>
          </button>
        </div>
      </div>

      {/* Grid Canvas con Carga y Datos */}
      {isLoading ? (
        <div className="bg-white border border-[#e8e2d8] p-12 text-center rounded shadow-sm">
          <span className="material-symbols-outlined text-secondary animate-spin text-5xl">
            sync
          </span>
          <p className="text-body-md text-secondary font-bold uppercase tracking-wider mt-4">
            Loading configurations...
          </p>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 p-8 text-center rounded shadow-sm">
          <span className="material-symbols-outlined text-red-700 text-5xl">
            error
          </span>
          <p className="text-body-md text-red-800 font-bold uppercase tracking-wider mt-4">
            {error}
          </p>
        </div>
      ) : locations.length === 0 ? (
        /* Empty State */
        <div className="bg-white border border-[#e8e2d8] p-16 text-center rounded shadow-sm flex flex-col items-center justify-center gap-6">
          <div className="w-20 h-20 bg-zinc-50 border border-zinc-100 rounded-full flex items-center justify-center shadow-inner">
            <span className="material-symbols-outlined text-zinc-400 text-4xl">
              storefront
            </span>
          </div>
          <div className="max-w-md">
            <h3 className="font-bold text-[#222222] uppercase tracking-wider text-sm">
              No inventory locations or branch nodes configured yet.
            </h3>
            <p className="text-body-md text-secondary leading-relaxed mt-2">
              Click 'Add Location' to establish your physical or digital tracking sites.
            </p>
          </div>
        </div>
      ) : (
        /* Tabla de Ubicaciones */
        <div className="bg-white border border-[#e8e2d8] overflow-hidden rounded shadow-sm">
          <div className="p-4 bg-[#222222] flex justify-between items-center">
            <span className="text-label-caps font-bold text-white uppercase tracking-wider">
              INVENTORY LOCATIONS
            </span>
            <span className="material-symbols-outlined text-white text-sm cursor-pointer">
              more_vert
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead className="bg-[#ece8e0] border-b border-[#e8e2d8]">
                <tr>
                  <th className="px-6 py-3 text-left text-label-caps font-bold text-[#5f5e5e]">
                    Location Designation
                  </th>
                  <th className="px-6 py-3 text-left text-label-caps font-bold text-[#5f5e5e]">
                    Physical Street Address
                  </th>
                  <th className="px-6 py-3 text-center text-label-caps font-bold text-[#5f5e5e]">
                    Status
                  </th>
                  <th className="px-6 py-3 text-center text-label-caps font-bold text-[#5f5e5e]">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e8e2d8]">
                {filteredLocations.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-secondary italic bg-white">
                      No locations match the selected filters.
                    </td>
                  </tr>
                ) : (
                  filteredLocations.map((loc) => {
                    const isInactive = !loc.isActive;
                    return (
                      <tr
                        key={loc.id}
                        onClick={() => handleOpenDetailDrawer(loc)}
                        className={`category-row group transition-colors cursor-pointer ${
                          isInactive ? 'bg-[#f8f3eb]/40 opacity-75' : 'hover:bg-[#f8f3eb]'
                        }`}
                      >
                        <td className="px-6 py-4 flex items-center gap-3">
                          <div className="w-1 h-8 bg-[#ae001a] rounded-full"></div>
                          <div>
                            <p className="font-bold text-[#1d1c17]">{loc.name}</p>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-secondary">
                          {loc.address}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span
                            className={`text-[10px] px-2.5 py-0.5 font-bold rounded uppercase ${
                              loc.isActive
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-zinc-200 text-[#5f5e5e]'
                            }`}
                          >
                            {loc.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex justify-center gap-3">
                            <button
                              onClick={(e) => handleOpenEditDrawer(e, loc)}
                              className="p-1 text-[#5f5e5e] hover:text-[#ae001a] transition-colors duration-200 cursor-pointer"
                              title="Editar ubicación"
                            >
                              <span className="material-symbols-outlined text-[20px]">edit</span>
                            </button>
                            <button
                              onClick={(e) => handleOpenConfirmToggle(e, loc)}
                              className="p-1 text-[#5f5e5e] hover:text-[#ae001a] transition-colors duration-200 cursor-pointer"
                              title={loc.isActive ? "Desactivar ubicación" : "Activar ubicación"}
                            >
                              <span className="material-symbols-outlined text-[20px]">
                                {loc.isActive ? 'block' : 'check_circle_outline'}
                              </span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Floating Action Button (FAB) */}
      <button
        onClick={handleOpenAddDrawer}
        className="fixed bottom-6 right-6 w-14 h-14 bg-[#ae001a] text-white rounded-full flex items-center justify-center shadow-xl hover:bg-[#d2272f] transition-all transform hover:scale-110 z-50 cursor-pointer"
        title="Add Location"
      >
        <span className="material-symbols-outlined text-[28px]">add</span>
      </button>

      {/* Footer de Acciones Rápidas */}
      <div className="mt-8">
        <QuickLaunchPanel
          description="One-click access to system settings, master suppliers, and your corporate customer directory."
          actions={[
            {
              id: 'products-master',
              label: 'PRODUCTS MASTER LIST',
              onClick: () => onNavigate?.('products'),
            },
            {
              id: 'stock-management',
              label: 'STOCK MANAGEMENT',
              onClick: () => onNavigate?.('stock-movements'),
            },
            {
              id: 'tax-configs',
              label: 'TAX CONFIGURATIONS',
              onClick: () => onNavigate?.('company-configurations'),
            },
            {
              id: 'emergency-support',
              label: 'EMERGENCY SUPPORT',
              variant: 'danger',
              onClick: () => setIsSupportOpen(true),
            },
          ]}
        />
      </div>

      <EmergencySupportModal
        isOpen={isSupportOpen}
        onClose={() => setIsSupportOpen(false)}
      />

      {/* Portal: Modal Interactivo de Add / Edit Location (Centrado, idéntico a categorías) */}
      {isFormDrawerOpen && createPortal(
        <div className="fixed inset-0 bg-black/60 z-[9999] flex justify-center items-start overflow-y-auto p-2 md:pt-4 md:pb-12 backdrop-blur-sm font-sans">
          <div className="bg-white border border-[#e8e2d8] rounded shadow-2xl w-full max-w-md overflow-hidden animate-fade-in max-h-[90vh] flex flex-col">
            <div className="bg-[#222222] p-4 text-white flex justify-between items-center shrink-0">
              <span className="font-bold text-label-caps uppercase tracking-wider">
                {formDrawerMode === 'add' ? 'Add Inventory Location' : 'Edit Inventory Location'}
              </span>
              <button
                onClick={() => setIsFormDrawerOpen(false)}
                className="text-white/70 hover:text-white transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <form onSubmit={handleSubmitLocation} className="flex-1 flex flex-col min-h-0">
              <div className="p-6 space-y-4 overflow-y-auto flex-1 text-left">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold text-[#5f5e5e] uppercase">
                    Location Designation Name
                  </label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="bg-white text-[#1d1c17] px-3 py-2 border border-[#e8e2d8] rounded text-body-md focus:border-[#ae001a] focus:ring-1 focus:ring-[#ae001a] outline-none w-full"
                    placeholder="e.g. Warehouse Branch A"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold text-[#5f5e5e] uppercase">
                    Physical Street Address
                  </label>
                  <input
                    type="text"
                    required
                    value={formAddress}
                    onChange={(e) => setFormAddress(e.target.value)}
                    className="bg-white text-[#1d1c17] px-3 py-2 border border-[#e8e2d8] rounded text-body-md focus:border-[#ae001a] focus:ring-1 focus:ring-[#ae001a] outline-none w-full"
                    placeholder="e.g. 123 Main St, New York"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold text-[#5f5e5e] uppercase mb-1">
                    Status Configuration
                  </label>
                  <div className="flex items-center gap-6">
                    <label className="flex items-center gap-2 text-body-md font-bold text-[#1c1b16] cursor-pointer">
                      <input
                        type="radio"
                        name="isActive"
                        checked={formIsActive === true}
                        onChange={() => setFormIsActive(true)}
                        className="text-[#ae001a] focus:ring-[#ae001a] cursor-pointer"
                      />
                      Active Node
                    </label>
                    <label className="flex items-center gap-2 text-body-md font-bold text-[#1c1b16] cursor-pointer">
                      <input
                        type="radio"
                        name="isActive"
                        checked={formIsActive === false}
                        onChange={() => setFormIsActive(false)}
                        className="text-[#ae001a] focus:ring-[#ae001a] cursor-pointer"
                      />
                      Inactive / Disabled
                    </label>
                  </div>
                </div>
              </div>

              <div className="p-6 pt-4 border-t border-[#e8e2d8] flex justify-end gap-3 shrink-0 bg-[#fefbf6]">
                <button
                  type="button"
                  onClick={() => setIsFormDrawerOpen(false)}
                  className="px-4 py-2 border border-[#222222] text-[#222222] font-bold text-label-caps hover:bg-zinc-100 transition-colors font-sans cursor-pointer"
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#ae001a] text-white font-bold text-label-caps hover:bg-[#d2272f] transition-colors font-sans cursor-pointer"
                >
                  SAVE LOCATION
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Portal: Detail Drawer (Inspección de datos) */}
      {isDetailDrawerOpen && selectedLocation && createPortal(
        <div className="fixed inset-0 z-[1000] flex justify-end font-sans">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 transition-opacity duration-300 animate-fade-in"
            onClick={() => setIsDetailDrawerOpen(false)}
          />

          {/* Drawer Body */}
          <div className="relative w-full max-w-md bg-[#fcfbfa] h-full shadow-2xl z-10 flex flex-col justify-between border-l border-[#e8e2d8] animate-slide-in">
            {/* Header */}
            <div className="bg-[#222222] px-6 py-5 flex items-center justify-between border-b border-[#333333]">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-white text-xl">store</span>
                <span className="text-[11px] font-bold uppercase tracking-widest text-white">
                  LOCATION INSPECTOR
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsDetailDrawerOpen(false)}
                className="text-white/60 hover:text-white transition-colors"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            {/* Info Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div>
                <h2 className="text-xl font-black text-[#1c1b16] tracking-tight">{selectedLocation.name}</h2>
                <span
                  className={`text-[9px] px-2.5 py-0.5 font-bold rounded uppercase inline-block mt-2 ${
                    selectedLocation.isActive
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-zinc-200 text-[#5f5e5e]'
                  }`}
                >
                  {selectedLocation.isActive ? 'Active Node' : 'Inactive / Muted'}
                </span>
              </div>

              <div className="border-t border-[#e8e2d8] pt-5 space-y-4">
                <h4 className="text-[10px] font-bold uppercase tracking-widest text-[#ae001a]">Physical Address</h4>
                <div className="flex gap-3 items-start">
                  <span className="material-symbols-outlined text-base text-[#5f5e5e] mt-0.5">location_on</span>
                  <span className="text-xs text-[#1c1b16] leading-relaxed">{selectedLocation.address}</span>
                </div>
              </div>

              <div className="border-t border-[#e8e2d8] pt-5 space-y-4">
                <h4 className="text-[10px] font-bold uppercase tracking-widest text-[#ae001a]">Connected Stock Items</h4>
                <div className="bg-[#222222] p-4 flex justify-between items-center text-white">
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-[#ae001a] text-2xl">box</span>
                    <div>
                      <span className="block text-[9px] font-bold uppercase tracking-wider text-white/50">Stock Balances</span>
                      <span className="text-md font-black">
                        {selectedLocation.items?.length || 0} items configured
                      </span>
                    </div>
                  </div>
                  <span className="material-symbols-outlined text-white/20 text-3xl">storefront</span>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="bg-[#f5efe6] border-t border-[#e8e2d8] px-6 py-4 flex justify-end">
              <button
                type="button"
                onClick={() => setIsDetailDrawerOpen(false)}
                className="px-5 py-2.5 bg-[#ece8e0] text-[#1c1b16] font-bold text-label-caps hover:bg-[#dcd7cd] transition-colors font-sans cursor-pointer"
              >
                CLOSE INSPECTOR
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}


    {/* Modal de Confirmación de Activación / Desactivación */}
      {isConfirmModalOpen && confirmTargetLocation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white border border-[#e8e2d8] rounded-xl max-w-sm w-full p-6 shadow-2xl animate-scale-up text-left">
            <div className="flex items-start gap-4">
              <div className={`p-3 rounded-xl text-white ${
                confirmTargetLocation.isActive ? 'bg-[#ba1a1a]' : 'bg-emerald-600'
              }`}>
                <span className="material-symbols-outlined text-2xl block">
                  {confirmTargetLocation.isActive ? 'power_settings_new' : 'check_circle'}
                </span>
              </div>
              <div className="space-y-2">
                <h3 className="text-body-md font-bold text-zinc-900 font-sans">
                  {confirmTargetLocation.isActive ? 'Confirm Deactivation' : 'Confirm Activation'}
                </h3>
                <p className="text-body-xs text-zinc-500 leading-relaxed font-sans">
                  Are you sure you want to {confirmTargetLocation.isActive ? 'deactivate' : 'activate'} this location? This action will set the status to {confirmTargetLocation.isActive ? 'inactive' : 'active'}.
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
                onClick={() => {
                  setIsConfirmModalOpen(false);
                  setConfirmTargetLocation(null);
                }}
                className="px-4 py-2 text-body-xs font-bold border border-zinc-200 rounded-lg text-zinc-700 hover:bg-zinc-50 transition-all duration-200 cursor-pointer font-sans"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeToggleActive}
                disabled={isToggling}
                className={`px-4 py-2 text-white text-body-xs font-bold rounded-lg transition-all duration-200 disabled:opacity-50 cursor-pointer flex items-center gap-1.5 font-sans ${
                  confirmTargetLocation.isActive
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
                  <span>{confirmTargetLocation.isActive ? 'Deactivate' : 'Activate'}</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default LocationsView;
