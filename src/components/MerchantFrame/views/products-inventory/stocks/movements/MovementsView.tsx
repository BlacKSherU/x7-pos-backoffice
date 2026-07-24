import React, { useState, useEffect } from 'react';
import { getAccessToken, clearAuthSession } from '../../../../../../lib/auth-storage';

interface Movement {
  id: number;
  item: {
    id: number;
    currentQty: number;
  } | null;
  quantity: number;
  type: string;
  reference: string;
  reason: string;
  createdAt: string;
}

interface MovementsViewProps {
  onNavigate?: (view: string) => void;
}

export const MovementsView: React.FC<MovementsViewProps> = ({ onNavigate }) => {
  const [movements, setMovements] = useState<Movement[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // Paginación y Filtros
  const [page, setPage] = useState<number>(1);
  const [limit] = useState<number>(15);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [itemNameFilter, setItemNameFilter] = useState<string>('');

  const API_BASE = import.meta.env.VITE_API_URL ?? '/api';

  useEffect(() => {
    fetchMovements();
  }, [page, itemNameFilter]);

  const fetchMovements = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const token = getAccessToken();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      };

      let url = `${API_BASE}/movements?page=${page}&limit=${limit}`;
      if (itemNameFilter.trim()) {
        url += `&itemName=${encodeURIComponent(itemNameFilter)}`;
      }

      const res = await fetch(url, { headers });

      if (res.status === 401) {
        clearAuthSession();
        window.location.href = '/login';
        return;
      }

      if (!res.ok) {
        throw new Error('Error al consultar el registro de movimientos');
      }

      const json = await res.json();
      const bodyData = json.data || json;
      setMovements(Array.isArray(bodyData) ? bodyData : (Array.isArray(bodyData.data) ? bodyData.data : []));
      
      if (bodyData.totalPages) {
        setTotalPages(bodyData.totalPages);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error loading stock movements.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 animate-fade-in text-left font-sans">
      {/* Título de Sección */}
      <div className="bg-white border border-[#e8e2d8] p-6 rounded shadow-sm flex justify-between items-center">
        <div>
          <h2 className="text-[#ae001a] font-bold text-heading-lg tracking-wider uppercase font-sans">
            Stock Movements Log
          </h2>
          <p className="text-[#5f5e5e] text-body-sm font-sans mt-1">
            Audit trail of all inventory entries, exits, transfers, and adjustments across all active storage locations.
          </p>
        </div>
        <button
          onClick={() => onNavigate?.('stock-movements')}
          className="px-5 py-2.5 bg-[#ece8e0] text-[#1c1b16] font-bold text-label-caps hover:bg-[#dcd7cd] transition-all duration-200 cursor-pointer text-xs"
        >
          Back to Stock Ledger
        </button>
      </div>

      {/* Filtros */}
      <div className="bg-white border border-[#e8e2d8] p-6 rounded shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="relative w-full md:w-96">
          <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-secondary font-sans">
            search
          </span>
          <input
            type="text"
            placeholder="Search by product name..."
            value={itemNameFilter}
            onChange={(e) => {
              setItemNameFilter(e.target.value);
              setPage(1);
            }}
            className="w-full pl-11 pr-4 py-2 bg-[#fef9f1] border border-[#e8e2d8] rounded text-body-md font-sans outline-none focus:border-[#ae001a]"
          />
        </div>
        <div className="flex items-center gap-4 w-full md:w-auto">
          {/* Botón de Recarga tipo Categorías */}
          <button
            onClick={() => fetchMovements()}
            className="p-2 bg-white border border-[#e8e2d8] rounded hover:bg-[#fef9f1] text-[#5f5e5e] hover:text-[#ae001a] transition-all flex items-center justify-center cursor-pointer font-sans h-[38px] w-[38px]"
            title="Reload movements data"
          >
            <span className="material-symbols-outlined text-[18px]">refresh</span>
          </button>
        </div>
      </div>

      {/* Tabla */}
      {isLoading ? (
        <div className="py-20 text-center bg-white border border-[#e8e2d8] rounded">
          <span className="material-symbols-outlined text-secondary animate-spin text-4xl">sync</span>
          <p className="text-secondary text-body-sm mt-3 uppercase tracking-wider font-bold">
            Loading activity history...
          </p>
        </div>
      ) : error ? (
        <div className="p-6 bg-red-50 border border-red-200 text-red-800 text-body-md rounded-lg">
          {error}
        </div>
      ) : (
        <div className="bg-white border border-[#e8e2d8] rounded shadow-sm overflow-hidden">
          <div className="p-4 bg-[#222222] flex justify-between items-center">
            <span className="text-label-caps font-bold text-white uppercase tracking-wider">
              STOCK MOVEMENTS LEDGER
            </span>
            <span className="material-symbols-outlined text-white text-sm cursor-pointer select-none">
              more_vert
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead className="bg-[#ece8e0] border-b border-[#e8e2d8]">
                <tr>
                  <th className="px-6 py-3 text-label-caps font-bold text-[#5f5e5e]">Date & Time</th>
                  <th className="px-6 py-3 text-label-caps font-bold text-[#5f5e5e] text-center">Type</th>
                  <th className="px-6 py-3 text-label-caps font-bold text-[#5f5e5e] text-right">Quantity</th>
                  <th className="px-6 py-3 text-label-caps font-bold text-[#5f5e5e]">Reference / Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e8e2d8]">
                {movements.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-secondary italic bg-white">
                      No stock movements found.
                    </td>
                  </tr>
                ) : (
                  movements.map((mv) => {
                    const isEntry = ['IN', 'PURCHASE_ENTRY', 'RETURN'].includes(mv.type);
                    return (
                      <tr key={mv.id} className="hover:bg-[#f8f3eb] transition-colors">
                        <td className="px-6 py-4 text-body-sm text-zinc-800">
                          {new Date(mv.createdAt).toLocaleDateString()} • {new Date(mv.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded uppercase ${
                            isEntry ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                          }`}>
                            {mv.type}
                          </span>
                        </td>
                        <td className={`px-6 py-4 font-mono font-bold text-right text-sm ${
                          isEntry ? 'text-emerald-600' : 'text-red-600'
                        }`}>
                          {isEntry ? '+' : '-'}{mv.quantity}
                        </td>
                        <td className="px-6 py-4 text-body-sm text-zinc-800">
                          <span className="font-bold block text-zinc-900">{mv.reference || 'N/A'}</span>
                          <span className="text-secondary text-xs">{mv.reason || 'N/A'}</span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Paginación */}
          {totalPages > 1 && (
            <div className="bg-[#fef9f1] px-6 py-4 border-t border-[#e8e2d8] flex justify-between items-center">
              <button
                disabled={page <= 1}
                onClick={() => setPage(prev => Math.max(1, prev - 1))}
                className="px-4 py-2 border border-[#e8e2d8] rounded font-bold text-xs uppercase tracking-wider hover:bg-zinc-100 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer bg-white"
              >
                Previous
              </button>
              <span className="text-body-xs font-semibold text-zinc-600">
                Page {page} of {totalPages}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
                className="px-4 py-2 border border-[#e8e2d8] rounded font-bold text-xs uppercase tracking-wider hover:bg-zinc-100 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer bg-white"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
