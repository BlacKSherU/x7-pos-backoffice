// Domain logic and business rules for QR Location management.
import type { CreateQRLocationDto, QRLocation, QRMenuType, TableRef } from '../types/qr-location';
import { generateQrSvgDataUrl } from './qr-generator';

export const BASE_QR_SCAN_URL = 'https://menu.x7pos.com';

/**
 * Builds target landing URL stored in qr_code_url:
 * e.g., https://menu.x7pos.com/m/{merchant_id}/loc/{id}
 */
export function buildQrLandingUrl(merchantId: number, locationId: number | string): string {
  return `${BASE_QR_SCAN_URL}/m/${merchantId}/loc/${locationId}`;
}

/**
 * Unique Location Naming Validation: Prevents duplicate location names under the same merchant.
 */
export function validateUniqueLocationName(
  name: string,
  merchantId: number,
  locations: QRLocation[],
  currentId?: number
): { valid: boolean; error?: string } {
  const trimmed = name.trim().toLowerCase();
  if (!trimmed) {
    return { valid: false, error: 'Location name is required.' };
  }

  const duplicate = locations.find(
    (loc) =>
      loc.merchant_id === merchantId &&
      loc.id !== currentId &&
      loc.name.trim().toLowerCase() === trimmed
  );

  if (duplicate) {
    return {
      valid: false,
      error: `A QR location with name "${name.trim()}" already exists for this merchant (#QR-LOC-${duplicate.id}). Location names must be unique.`,
    };
  }

  return { valid: true };
}

/**
 * Table Validation: Ensures table_id belongs to the same merchant_id context.
 */
export function validateTableMerchantContext(
  tableId: number | null | undefined,
  merchantId: number,
  tables: TableRef[]
): { valid: boolean; error?: string } {
  if (tableId === null || tableId === undefined || tableId === 0) {
    return { valid: true };
  }

  const table = tables.find((t) => t.id === tableId);
  if (!table) {
    return { valid: false, error: `Table #${tableId} was not found.` };
  }

  if (table.merchant_id !== merchantId) {
    return {
      valid: false,
      error: `Table #${table.number} (ID ${table.id}) belongs to merchant #${table.merchant_id}, which does not match active merchant #${merchantId}.`,
    };
  }

  return { valid: true };
}

/**
 * Full Form Payload Validation: Enforces required fields (name, qr_menu_id, location_type, status)
 * and name length <= 100 characters.
 */
export function validateQRLocationPayload(
  dto: Partial<CreateQRLocationDto>,
  merchantId: number,
  locations: QRLocation[],
  tables: TableRef[],
  currentId?: number
): { valid: boolean; error?: string; fieldErrors: Record<string, string> } {
  const fieldErrors: Record<string, string> = {};

  // Name validation
  if (!dto.name || !dto.name.trim()) {
    fieldErrors.name = 'Location name is required.';
  } else if (dto.name.length > 100) {
    fieldErrors.name = 'Location name cannot exceed 100 characters.';
  } else {
    const uniqueCheck = validateUniqueLocationName(dto.name, merchantId, locations, currentId);
    if (!uniqueCheck.valid) {
      fieldErrors.name = uniqueCheck.error!;
    }
  }

  // QR Menu validation
  if (!dto.qr_menu_id || dto.qr_menu_id <= 0) {
    fieldErrors.qr_menu_id = 'A valid QR Menu must be assigned.';
  }

  // Location Type validation
  if (!dto.location_type) {
    fieldErrors.location_type = 'Location type classification is required.';
  }

  // Status validation
  if (!dto.status) {
    fieldErrors.status = 'Operational status is required.';
  }

  // Table merchant context validation
  if (dto.table_id) {
    const tableCheck = validateTableMerchantContext(dto.table_id, merchantId, tables);
    if (!tableCheck.valid) {
      fieldErrors.table_id = tableCheck.error!;
    }
  }

  const firstError = Object.values(fieldErrors)[0];
  return {
    valid: Object.keys(fieldErrors).length === 0,
    error: firstError,
    fieldErrors,
  };
}

/**
 * Table Association Sync: Linking a table_id automatically sets location_type context to DINE_IN
 * for dine-in auto-ordering.
 */
export function syncLocationTypeWithTable(
  tableId: number | null | undefined,
  currentType: QRMenuType
): QRMenuType {
  if (tableId !== null && tableId !== undefined && tableId > 0) {
    return 'DINE_IN';
  }
  return currentType;
}

/**
 * Generates hosted SVG data stream or SVG string for qr_code_image.
 */
export function generateQrAssetImage(url: string, name?: string): string {
  return generateQrSvgDataUrl(url, {
    title: name ? name.toUpperCase() : 'SCAN FOR MENU',
    size: 300,
  });
}

/**
 * Converts SVG Data URL to high-resolution PNG Data URL using Canvas for high-DPI export.
 */
export function convertSvgToHighResPngDataUrl(
  svgDataUrl: string,
  width = 600,
  height = 600
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas context unavailable'));
        return;
      }
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = (err) => reject(err);
    img.src = svgDataUrl;
  });
}
