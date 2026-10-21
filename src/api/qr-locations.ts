import type {
  CreateQRLocationDto,
  MerchantRef,
  QRLocation,
  QRMenuRef,
  QRLocationStatus,
  QRMenuType,
  TableRef,
  UpdateQRLocationDto,
} from '../types/qr-location';
import {
  buildQrLandingUrl,
  generateQrAssetImage,
  syncLocationTypeWithTable,
  validateTableMerchantContext,
  validateUniqueLocationName,
  validateQRLocationPayload,
} from '../lib/qr-location';
import { getAccessToken } from '../lib/auth-storage';
import { ApiError } from '../lib/api-error';

const API_BASE = import.meta.env.VITE_API_URL ?? '/api';
const STORAGE_KEY = 'x7_qr_locations_mock_db';

// Cache for live fetched entities so relations can be hydrated even if backend only returns scalar IDs
let _cachedMerchants: MerchantRef[] = [];
let _cachedMenus: QRMenuRef[] = [];
let _cachedTables: TableRef[] = [];

// Raw backend shapes (TypeORM entities may return relations or plain foreign keys)
interface BackendQRLocation {
  id: number;
  name: string;
  merchant?: MerchantRef;
  merchant_id?: number;
  qrMenu?: QRMenuRef;
  qr_menu_id?: number;
  table?: TableRef | null;
  table_id?: number | null;
  location_type: string;
  status?: QRLocationStatus;
  qr_code_url?: string;
  qr_code_image?: string;
  created_at?: string;
  updated_at?: string;
}

interface BackendMerchant {
  id: number;
  name: string;
  code?: string | null;
}

interface BackendQRMenu {
  id: number;
  name?: string;
  title?: string;
  status?: string;
  merchant?: { id: number } | null;
  merchant_id?: number;
}

interface BackendTable {
  id: number;
  number: string | number;
  merchant?: { id: number } | null;
  merchant_id?: number;
  capacity?: number;
  floorZone?: { name?: string } | null;
  zone?: { name?: string } | null;
  zone_name?: string;
}

// Default mock seed data (used when offline, mock mode, or unauthenticated)
export const MOCK_MERCHANTS: MerchantRef[] = [
  { id: 1, name: 'Bistro Downtown', code: 'MCH-001' },
  { id: 2, name: 'La Trattoria Patio', code: 'MCH-002' },
  { id: 3, name: 'prueba1', code: 'MCH-003' },
];

export const MOCK_MENUS: QRMenuRef[] = [
  { id: 101, name: 'Main Dinner & Cocktail Menu', is_active: true },
  { id: 102, name: 'Lunch Express & Drinks Menu', is_active: true },
  { id: 103, name: 'Patio & Terrace Special Menu', is_active: true },
  { id: 104, name: 'Takeout & Pickup Menu', is_active: true },
];

export const MOCK_TABLES: TableRef[] = [
  { id: 201, number: '12', merchant_id: 3, capacity: 4, zone_name: 'Main Dining Room' },
  { id: 202, number: '14', merchant_id: 3, capacity: 6, zone_name: 'Main Dining Room' },
  { id: 203, number: 'Patio-01', merchant_id: 3, capacity: 2, zone_name: 'Terrace' },
  { id: 204, number: 'Patio-02', merchant_id: 3, capacity: 4, zone_name: 'Terrace' },
  { id: 205, number: 'VIP-1', merchant_id: 1, capacity: 8, zone_name: 'VIP Lounge' },
  { id: 206, number: 'Bar-5', merchant_id: 2, capacity: 2, zone_name: 'Main Bar' },
];

function authHeaders(includeJson = false): Record<string, string> {
  const token = getAccessToken();
  return {
    Accept: 'application/json',
    ...(includeJson ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function initializeMockData(): QRLocation[] {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      // Fallback to seed
    }
  }

  const initialList: QRLocation[] = [
    {
      id: 1,
      name: 'Patio Table #12 Access',
      merchant_id: 3,
      qr_menu_id: 101,
      table_id: 201,
      location_type: 'DINE_IN',
      status: 'active',
      qr_code_url: buildQrLandingUrl(3, 1),
      qr_code_image: generateQrAssetImage(buildQrLandingUrl(3, 1), 'Patio Table #12 Access'),
      created_at: new Date(Date.now() - 86400000 * 5).toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 2,
      name: 'Curbside Pickup Point',
      merchant_id: 3,
      qr_menu_id: 104,
      table_id: null,
      location_type: 'PICKUP',
      status: 'active',
      qr_code_url: buildQrLandingUrl(3, 2),
      qr_code_image: generateQrAssetImage(buildQrLandingUrl(3, 2), 'Curbside Pickup Point'),
      created_at: new Date(Date.now() - 86400000 * 3).toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 3,
      name: 'Terrace Table #Patio-01',
      merchant_id: 3,
      qr_menu_id: 103,
      table_id: 203,
      location_type: 'DINE_IN',
      status: 'inactive',
      qr_code_url: buildQrLandingUrl(3, 3),
      qr_code_image: generateQrAssetImage(buildQrLandingUrl(3, 3), 'Terrace Table #Patio-01'),
      created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 4,
      name: 'Room 402 Room Service QR',
      merchant_id: 3,
      qr_menu_id: 102,
      table_id: null,
      location_type: 'ROOM_SERVICE',
      status: 'archived',
      qr_code_url: buildQrLandingUrl(3, 4),
      qr_code_image: generateQrAssetImage(buildQrLandingUrl(3, 4), 'Room 402 Room Service QR'),
      created_at: new Date(Date.now() - 86400000 * 10).toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  localStorage.setItem(STORAGE_KEY, JSON.stringify(initialList));
  return initialList;
}

function persistMockData(items: QRLocation[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

// Convert front-end QRMenuType to backend enum ('Table' | 'Pickup' | 'Delivery')
function mapLocationTypeToBackend(type: QRMenuType): 'Table' | 'Pickup' | 'Delivery' {
  if (type === 'PICKUP') return 'Pickup';
  if (type === 'DELIVERY') return 'Delivery';
  return 'Table'; // DINE_IN and ROOM_SERVICE map to Table
}

// Convert backend enum to front-end QRMenuType
function mapBackendLocationTypeToFrontend(type: string): QRMenuType {
  const upper = String(type || '').toUpperCase();
  if (upper === 'PICKUP') return 'PICKUP';
  if (upper === 'DELIVERY') return 'DELIVERY';
  if (upper === 'ROOM_SERVICE') return 'ROOM_SERVICE';
  return 'DINE_IN';
}

function normalizeBackendQRLocation(item: BackendQRLocation): QRLocation {
  const merchantId = item.merchant?.id ?? item.merchant_id ?? 0;
  const qrMenuId = item.qrMenu?.id ?? item.qr_menu_id ?? 0;
  const tableId = item.table?.id ?? item.table_id ?? null;
  const locType = mapBackendLocationTypeToFrontend(item.location_type);

  const locId = item.id;
  const url = item.qr_code_url || buildQrLandingUrl(merchantId, locId);
  const img = item.qr_code_image || generateQrAssetImage(url, item.name);

  return {
    id: locId,
    name: item.name,
    merchant_id: merchantId,
    qr_menu_id: qrMenuId,
    table_id: tableId,
    location_type: locType,
    status: item.status || 'active',
    qr_code_url: url,
    qr_code_image: img,
    created_at: item.created_at || new Date().toISOString(),
    updated_at: item.updated_at || new Date().toISOString(),
    merchant: item.merchant,
    qrMenu: item.qrMenu,
    table: item.table,
  };
}

function hydrateRelations(item: QRLocation): QRLocation {
  const merchant =
    item.merchant ||
    _cachedMerchants.find((m) => m.id === item.merchant_id) ||
    MOCK_MERCHANTS.find((m) => m.id === item.merchant_id) || {
      id: item.merchant_id,
      name: `Merchant #${item.merchant_id}`,
    };

  const qrMenu =
    item.qrMenu ||
    _cachedMenus.find((m) => m.id === item.qr_menu_id) ||
    MOCK_MENUS.find((m) => m.id === item.qr_menu_id) || {
      id: item.qr_menu_id,
      name: `Menu #${item.qr_menu_id}`,
      is_active: true,
    };

  const foundTable = item.table_id
    ? _cachedTables.find((t) => t.id === item.table_id) ||
      MOCK_TABLES.find((t) => t.id === item.table_id) || {
        id: item.table_id,
        number: item.table?.number || `${item.table_id}`,
        merchant_id: item.merchant_id,
      }
    : null;

  return {
    ...item,
    merchant,
    qrMenu,
    table: foundTable,
  };
}

/**
 * Fetch available merchants from backend or fallback to mocks
 */
export async function fetchAvailableMerchants(): Promise<MerchantRef[]> {
  const token = getAccessToken();
  if (token) {
    try {
      const response = await fetch(`${API_BASE}/merchants/company/branches`, {
        headers: authHeaders(),
      });
      if (response.ok) {
        const json = await response.json();
        const rawList: BackendMerchant[] = json.data ?? (Array.isArray(json) ? json : []);
        if (rawList.length > 0) {
          const list: MerchantRef[] = rawList.map((m) => ({
            id: m.id,
            name: m.name,
            code: m.code || `MCH-${m.id}`,
          }));
          _cachedMerchants = list;
          return list;
        }
      }
    } catch {
      // Ignore network errors and fallback
    }
  }

  _cachedMerchants = MOCK_MERCHANTS;
  return MOCK_MERCHANTS;
}

/**
 * Fetch available QR Menus from backend or fallback to mocks
 */
export async function fetchAvailableQRMenus(merchantId?: number): Promise<QRMenuRef[]> {
  const token = getAccessToken();
  if (token) {
    try {
      const response = await fetch(`${API_BASE}/qr-menu?limit=100`, {
        headers: authHeaders(),
      });
      if (response.ok) {
        const json = await response.json();
        const rawList: BackendQRMenu[] = json.data ?? (Array.isArray(json) ? json : []);
        if (rawList.length > 0) {
          const mapped: QRMenuRef[] = rawList.map((m) => ({
            id: m.id,
            name: m.name || m.title || `Menu #${m.id}`,
            is_active: m.status ? m.status === 'active' : true,
          }));
          _cachedMenus = mapped;

          if (merchantId) {
            const filtered = rawList
              .filter((m) => !m.merchant || m.merchant.id === merchantId || m.merchant_id === merchantId)
              .map((m) => ({
                id: m.id,
                name: m.name || m.title || `Menu #${m.id}`,
                is_active: m.status ? m.status === 'active' : true,
              }));
            if (filtered.length > 0) return filtered;
          }
          return mapped;
        }
      }
    } catch {
      // Ignore network errors and fallback
    }
  }

  _cachedMenus = MOCK_MENUS;
  return MOCK_MENUS;
}

/**
 * Fetch available dining tables from backend or fallback to mocks
 */
export async function fetchAvailableTables(merchantId?: number): Promise<TableRef[]> {
  const token = getAccessToken();
  if (token) {
    try {
      const response = await fetch(`${API_BASE}/tables?limit=100`, {
        headers: authHeaders(),
      });
      if (response.ok) {
        const json = await response.json();
        const rawList: BackendTable[] = json.data ?? (Array.isArray(json) ? json : []);
        if (rawList.length > 0) {
          const mapped: TableRef[] = rawList.map((t) => ({
            id: t.id,
            number: String(t.number),
            merchant_id: t.merchant?.id ?? t.merchant_id ?? (merchantId || 0),
            capacity: t.capacity,
            zone_name: t.floorZone?.name ?? t.zone?.name ?? t.zone_name,
          }));
          _cachedTables = mapped;

          if (merchantId) {
            const filtered = mapped.filter((t) => !t.merchant_id || t.merchant_id === merchantId);
            if (filtered.length > 0) return filtered;
          }
          return mapped;
        }
      }
    } catch {
      // Ignore network errors and fallback
    }
  }

  const result = merchantId ? MOCK_TABLES.filter((t) => t.merchant_id === merchantId) : MOCK_TABLES;
  _cachedTables = result;
  return result;
}

/**
 * Retrieves QR Locations. Handles backend singular (/api/qr-location) and plural (/api/qr-locations).
 */
export async function getQRLocations(merchantId?: number): Promise<QRLocation[]> {
  const token = getAccessToken();
  if (token) {
    try {
      // Backend candidates (singular, plural, and v1 versioning)
      const candidatePaths = ['/qr-location', '/qr-locations', '/v1/qr-locations', '/v1/qr-location'];
      let response: Response | null = null;
      for (const path of candidatePaths) {
        response = await fetch(`${API_BASE}${path}?limit=100`, {
          headers: authHeaders(),
        });
        if (response.status !== 404) break;
      }

      if (response && response.ok) {
        const json = await response.json();
        const rawList: BackendQRLocation[] = json.data ?? (Array.isArray(json) ? json : []);
        const normalized = rawList.map(normalizeBackendQRLocation);
        const filtered = merchantId
          ? normalized.filter((loc) => !loc.merchant_id || loc.merchant_id === merchantId)
          : normalized;
        return filtered.map(hydrateRelations);
      }
    } catch {
      // Fallback to mock persistence
    }
  }

  const items = initializeMockData();
  const filtered = merchantId ? items.filter((i) => i.merchant_id === merchantId) : items;
  return filtered.map(hydrateRelations);
}

/**
 * Creates a new QR Location. Formats body to match backend expectations.
 */
export async function createQRLocation(dto: CreateQRLocationDto): Promise<QRLocation> {
  const tables = await fetchAvailableTables(dto.merchant_id);
  const items = initializeMockData();

  // Enforce Form Validation & Unique Location Naming under merchant
  const payloadCheck = validateQRLocationPayload(dto, dto.merchant_id, items, tables);
  if (!payloadCheck.valid) {
    throw new ApiError(payloadCheck.error || 'Validation failed.', 400);
  }

  // Business Rule: Table Association Sync
  const finalLocationType = syncLocationTypeWithTable(dto.table_id, dto.location_type);
  const token = getAccessToken();

  if (token) {
    const backendLocationType = mapLocationTypeToBackend(finalLocationType);
    const tempUrl = buildQrLandingUrl(dto.merchant_id, 'new');
    const tempImage = generateQrAssetImage(tempUrl, dto.name);

    const backendPayload: Record<string, unknown> = {
      merchant: Number(dto.merchant_id),
      qrMenu: Number(dto.qr_menu_id),
      name: dto.name.trim(),
      location_type: backendLocationType,
      status: dto.status === 'active' ? 'active' : 'inactive',
      qr_code_url: tempUrl,
      qr_code_image: tempImage,
    };
    if (dto.table_id && Number(dto.table_id) > 0) {
      backendPayload.table = Number(dto.table_id);
    }

    try {
      const candidatePaths = ['/qr-location', '/qr-locations', '/v1/qr-locations', '/v1/qr-location'];
      let response: Response | null = null;
      for (const path of candidatePaths) {
        response = await fetch(`${API_BASE}${path}`, {
          method: 'POST',
          headers: authHeaders(true),
          body: JSON.stringify(backendPayload),
        });
        if (response.status !== 404) break;
      }

      if (response && response.ok) {
        const created = await response.json();
        const normalized = normalizeBackendQRLocation(created.data ?? created);
        return hydrateRelations(normalized);
      } else if (response) {
        const errorData = await response.json().catch(() => ({}));
        const message = Array.isArray(errorData.message)
          ? errorData.message.join(', ')
          : errorData.message || `Server responded with status ${response.status}`;
        throw new ApiError(message, response.status);
      }
    } catch (err) {
      if (err instanceof ApiError) {
        throw err;
      }
      // If network unreachable, continue to mock fallback below
    }
  }

  // Fallback to local mock persistence
  const newId = items.length > 0 ? Math.max(...items.map((i) => i.id)) + 1 : 1;
  const qr_code_url = buildQrLandingUrl(dto.merchant_id, newId);
  const qr_code_image = generateQrAssetImage(qr_code_url, dto.name);

  const newItem: QRLocation = {
    id: newId,
    name: dto.name,
    merchant_id: dto.merchant_id,
    qr_menu_id: dto.qr_menu_id,
    table_id: dto.table_id || null,
    location_type: finalLocationType,
    status: dto.status,
    qr_code_url,
    qr_code_image,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const updatedList = [newItem, ...items];
  persistMockData(updatedList);
  return hydrateRelations(newItem);
}

/**
 * Updates a QR Location.
 */
export async function updateQRLocation(
  id: number,
  dto: UpdateQRLocationDto
): Promise<QRLocation> {
  const items = initializeMockData();
  const existing = items.find((i) => i.id === id);

  const targetMerchantId = dto.merchant_id ?? existing?.merchant_id ?? 1;
  const targetTableId = dto.table_id !== undefined ? dto.table_id : existing?.table_id;
  const tables = await fetchAvailableTables(targetMerchantId);

  if (dto.name && existing && dto.name.trim() !== existing.name.trim()) {
    const uniqueCheck = validateUniqueLocationName(dto.name, targetMerchantId, items, id);
    if (!uniqueCheck.valid) {
      throw new ApiError(uniqueCheck.error!, 400);
    }
  }

  const validation = validateTableMerchantContext(targetTableId, targetMerchantId, tables);
  if (!validation.valid) {
    throw new ApiError(validation.error || 'Table validation failed.', 400);
  }

  const currentType = dto.location_type ?? existing?.location_type ?? 'DINE_IN';
  const finalLocationType = syncLocationTypeWithTable(targetTableId, currentType);
  const token = getAccessToken();

  if (token) {
    const backendPayload: Record<string, unknown> = {};
    if (dto.name !== undefined) backendPayload.name = dto.name.trim();
    if (dto.merchant_id !== undefined) backendPayload.merchant = Number(dto.merchant_id);
    if (dto.qr_menu_id !== undefined) backendPayload.qrMenu = Number(dto.qr_menu_id);
    if (dto.table_id !== undefined) {
      if (dto.table_id && Number(dto.table_id) > 0) {
        backendPayload.table = Number(dto.table_id);
      }
    }
    if (dto.location_type !== undefined) {
      backendPayload.location_type = mapLocationTypeToBackend(finalLocationType);
    }
    if (dto.status !== undefined) {
      backendPayload.status = dto.status === 'active' ? 'active' : 'inactive';
    }

    try {
      const candidatePaths = ['/qr-location', '/qr-locations', '/v1/qr-locations', '/v1/qr-location'];
      let response: Response | null = null;
      for (const path of candidatePaths) {
        response = await fetch(`${API_BASE}${path}/${id}`, {
          method: 'PATCH',
          headers: authHeaders(true),
          body: JSON.stringify(backendPayload),
        });
        if (response.status !== 404) break;
      }

      if (response && response.ok) {
        const updated = await response.json();
        const normalized = normalizeBackendQRLocation(updated.data ?? updated);
        return hydrateRelations(normalized);
      } else if (response) {
        const errorData = await response.json().catch(() => ({}));
        const message = Array.isArray(errorData.message)
          ? errorData.message.join(', ')
          : errorData.message || `Server responded with status ${response.status}`;
        throw new ApiError(message, response.status);
      }
    } catch (err) {
      if (err instanceof ApiError) {
        throw err;
      }
    }
  }

  if (!existing) {
    throw new ApiError(`QR Location #${id} not found.`, 404);
  }

  const updatedUrl = buildQrLandingUrl(targetMerchantId, id);
  const updatedImage = generateQrAssetImage(updatedUrl, dto.name ?? existing.name);

  const updatedItem: QRLocation = {
    ...existing,
    ...dto,
    location_type: finalLocationType,
    qr_code_url: updatedUrl,
    qr_code_image: updatedImage,
    updated_at: new Date().toISOString(),
  };

  const updatedList = items.map((i) => (i.id === id ? updatedItem : i));
  persistMockData(updatedList);
  return hydrateRelations(updatedItem);
}

/**
 * Deletes a QR Location.
 */
export async function deleteQRLocation(id: number): Promise<void> {
  const token = getAccessToken();
  if (token) {
    try {
      const candidatePaths = ['/qr-location', '/qr-locations', '/v1/qr-locations', '/v1/qr-location'];
      for (const path of candidatePaths) {
        const response = await fetch(`${API_BASE}${path}/${id}`, {
          method: 'DELETE',
          headers: authHeaders(),
        });
        if (response.status !== 404) break;
      }
    } catch {
      // Ignore
    }
  }

  const items = initializeMockData();
  const updatedList = items.filter((i) => i.id !== id);
  persistMockData(updatedList);
}
