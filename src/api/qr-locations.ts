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
import { ApiError } from '../lib/api-error';
import { apiRequest, unwrapItem, unwrapList, type MaybeEnvelopedItem, type MaybeEnvelopedList } from './http';

// Rutas del backend (NestJS, prefijo global /api): qr-locations, qr-menus, tables, merchants.
const QR_LOCATIONS = '/qr-locations';
// El DTO de mesas limita `limit` a 100; mismo tope para el resto de listas auxiliares.
const LIST_LIMIT = 100;

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
    _cachedMerchants.find((m) => m.id === item.merchant_id) || {
      id: item.merchant_id,
      name: `Merchant #${item.merchant_id}`,
    };

  const qrMenu =
    item.qrMenu ||
    _cachedMenus.find((m) => m.id === item.qr_menu_id) || {
      id: item.qr_menu_id,
      name: `Menu #${item.qr_menu_id}`,
      is_active: true,
    };

  const foundTable = item.table_id
    ? _cachedTables.find((t) => t.id === item.table_id) || {
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
 * Sucursales (comercios) de la compañía del usuario.
 */
export async function fetchAvailableMerchants(): Promise<MerchantRef[]> {
  const json = await apiRequest<MaybeEnvelopedList<BackendMerchant>>(
    '/merchants/company/branches',
    { method: 'GET' },
    'Failed to load merchants. Please try again.',
  );
  const list: MerchantRef[] = unwrapList(json).map((m) => ({
    id: m.id,
    name: m.name,
    code: m.code || `MCH-${m.id}`,
  }));
  _cachedMerchants = list;
  return list;
}

/**
 * Menús QR disponibles, filtrados por comercio cuando se indica.
 */
export async function fetchAvailableQRMenus(merchantId?: number): Promise<QRMenuRef[]> {
  const json = await apiRequest<MaybeEnvelopedList<BackendQRMenu>>(
    `/qr-menus?limit=${LIST_LIMIT}`,
    { method: 'GET' },
    'Failed to load QR menus. Please try again.',
  );
  const rawList = unwrapList(json);
  const toRef = (m: BackendQRMenu): QRMenuRef => ({
    id: m.id,
    name: m.name || m.title || `Menu #${m.id}`,
    is_active: m.status ? m.status === 'active' : true,
  });
  _cachedMenus = rawList.map(toRef);

  if (!merchantId) return _cachedMenus;
  return rawList
    .filter((m) => !m.merchant || m.merchant.id === merchantId || m.merchant_id === merchantId)
    .map(toRef);
}

/**
 * Mesas del salón, filtradas por comercio cuando se indica.
 */
export async function fetchAvailableTables(merchantId?: number): Promise<TableRef[]> {
  const json = await apiRequest<MaybeEnvelopedList<BackendTable>>(
    `/tables?limit=${LIST_LIMIT}`,
    { method: 'GET' },
    'Failed to load tables. Please try again.',
  );
  const mapped: TableRef[] = unwrapList(json).map((t) => ({
    id: t.id,
    number: String(t.number),
    merchant_id: t.merchant?.id ?? t.merchant_id ?? (merchantId || 0),
    capacity: t.capacity,
    zone_name: t.floorZone?.name ?? t.zone?.name ?? t.zone_name,
  }));
  _cachedTables = mapped;

  if (!merchantId) return mapped;
  return mapped.filter((t) => !t.merchant_id || t.merchant_id === merchantId);
}

/**
 * Puntos de acceso QR (activos e inactivos; el backend excluye los borrados).
 */
export async function getQRLocations(merchantId?: number): Promise<QRLocation[]> {
  const json = await apiRequest<MaybeEnvelopedList<BackendQRLocation>>(
    `${QR_LOCATIONS}?limit=${LIST_LIMIT}`,
    { method: 'GET' },
    'Failed to load QR Locations directory.',
  );
  const normalized = unwrapList(json).map(normalizeBackendQRLocation);
  const filtered = merchantId
    ? normalized.filter((loc) => !loc.merchant_id || loc.merchant_id === merchantId)
    : normalized;
  return filtered.map(hydrateRelations);
}

/**
 * Crea un punto de acceso QR. Valida nombre único y mesa contra los datos reales del comercio.
 */
export async function createQRLocation(dto: CreateQRLocationDto): Promise<QRLocation> {
  const [items, tables] = await Promise.all([
    getQRLocations(dto.merchant_id),
    fetchAvailableTables(dto.merchant_id),
  ]);

  const payloadCheck = validateQRLocationPayload(dto, dto.merchant_id, items, tables);
  if (!payloadCheck.valid) {
    throw new ApiError(payloadCheck.error || 'Validation failed.', 400);
  }

  // Business Rule: Table Association Sync
  const finalLocationType = syncLocationTypeWithTable(dto.table_id, dto.location_type);
  const tempUrl = buildQrLandingUrl(dto.merchant_id, 'new');

  const backendPayload: Record<string, unknown> = {
    merchant: Number(dto.merchant_id),
    qrMenu: Number(dto.qr_menu_id),
    name: dto.name.trim(),
    location_type: mapLocationTypeToBackend(finalLocationType),
    status: dto.status === 'active' ? 'active' : 'inactive',
    qr_code_url: tempUrl,
    qr_code_image: generateQrAssetImage(tempUrl, dto.name),
  };
  if (dto.table_id && Number(dto.table_id) > 0) {
    backendPayload.table = Number(dto.table_id);
  }

  const created = await apiRequest<MaybeEnvelopedItem<BackendQRLocation>>(
    QR_LOCATIONS,
    { method: 'POST', body: JSON.stringify(backendPayload) },
    'Failed to save QR Location.',
  );
  return hydrateRelations(normalizeBackendQRLocation(unwrapItem(created)));
}

/**
 * Actualiza un punto de acceso QR.
 */
export async function updateQRLocation(
  id: number,
  dto: UpdateQRLocationDto
): Promise<QRLocation> {
  const items = await getQRLocations();
  const existing = items.find((i) => i.id === id);
  if (!existing) {
    throw new ApiError(`QR Location #${id} not found.`, 404);
  }

  const targetMerchantId = dto.merchant_id ?? existing.merchant_id;
  const targetTableId = dto.table_id !== undefined ? dto.table_id : existing.table_id;
  const tables = await fetchAvailableTables(targetMerchantId);

  if (dto.name && dto.name.trim() !== existing.name.trim()) {
    const uniqueCheck = validateUniqueLocationName(dto.name, targetMerchantId, items, id);
    if (!uniqueCheck.valid) {
      throw new ApiError(uniqueCheck.error!, 400);
    }
  }

  const validation = validateTableMerchantContext(targetTableId, targetMerchantId, tables);
  if (!validation.valid) {
    throw new ApiError(validation.error || 'Table validation failed.', 400);
  }

  const currentType = dto.location_type ?? existing.location_type;
  const finalLocationType = syncLocationTypeWithTable(targetTableId, currentType);

  const backendPayload: Record<string, unknown> = {};
  if (dto.name !== undefined) backendPayload.name = dto.name.trim();
  if (dto.merchant_id !== undefined) backendPayload.merchant = Number(dto.merchant_id);
  if (dto.qr_menu_id !== undefined) backendPayload.qrMenu = Number(dto.qr_menu_id);
  if (dto.table_id && Number(dto.table_id) > 0) {
    backendPayload.table = Number(dto.table_id);
  }
  if (dto.location_type !== undefined) {
    backendPayload.location_type = mapLocationTypeToBackend(finalLocationType);
  }
  if (dto.status !== undefined) {
    backendPayload.status = dto.status === 'active' ? 'active' : 'inactive';
  }

  const updated = await apiRequest<MaybeEnvelopedItem<BackendQRLocation>>(
    `${QR_LOCATIONS}/${id}`,
    { method: 'PATCH', body: JSON.stringify(backendPayload) },
    'Failed to save QR Location.',
  );
  return hydrateRelations(normalizeBackendQRLocation(unwrapItem(updated)));
}

/**
 * Borra (soft delete en el backend: status = 'deleted') un punto de acceso QR.
 */
export async function deleteQRLocation(id: number): Promise<void> {
  await apiRequest<void>(
    `${QR_LOCATIONS}/${id}`,
    { method: 'DELETE' },
    'Failed to delete QR Location.',
  );
}
