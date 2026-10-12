// Domain types for QR Location management (QRLocation).
// Maps to the qr_location table with TypeORM relational bindings to Merchant, QRMenu, and Table.

export type QRMenuType = 'DINE_IN' | 'PICKUP' | 'DELIVERY' | 'ROOM_SERVICE';

export type QRLocationStatus = 'active' | 'inactive' | 'archived';

export interface MerchantRef {
  id: number;
  name: string;
  code?: string;
}

export interface QRMenuRef {
  id: number;
  name: string;
  is_active?: boolean;
}

export interface TableRef {
  id: number;
  number: string;
  merchant_id: number;
  capacity?: number;
  zone_name?: string;
}

export interface QRLocation {
  id: number;
  name: string;
  merchant_id: number;
  qr_menu_id: number;
  table_id?: number | null;
  location_type: QRMenuType;
  status: QRLocationStatus;
  qr_code_url: string;
  qr_code_image: string; // Hosted SVG/PNG image URL or base64 / SVG data stream
  created_at?: string;
  updated_at?: string;

  // TypeORM Eager / Relation Bindings
  merchant?: MerchantRef;
  qrMenu?: QRMenuRef;
  table?: TableRef | null;
}

export interface CreateQRLocationDto {
  name: string;
  merchant_id: number;
  qr_menu_id: number;
  table_id?: number | null;
  location_type: QRMenuType;
  status: QRLocationStatus;
}

export interface UpdateQRLocationDto {
  name?: string;
  merchant_id?: number;
  qr_menu_id?: number;
  table_id?: number | null;
  location_type?: QRMenuType;
  status?: QRLocationStatus;
}

export const QR_LOCATION_TYPES: QRMenuType[] = ['DINE_IN', 'PICKUP', 'DELIVERY', 'ROOM_SERVICE'];

export const QR_LOCATION_TYPE_LABELS: Record<QRMenuType, string> = {
  DINE_IN: 'Dine-In Table',
  PICKUP: 'Pickup Counter',
  DELIVERY: 'Delivery Station',
  ROOM_SERVICE: 'Room Service',
};

export const QR_LOCATION_STATUSES: QRLocationStatus[] = ['active', 'inactive', 'archived'];

export const QR_LOCATION_STATUS_LABELS: Record<QRLocationStatus, string> = {
  active: 'Active Access',
  inactive: 'Disabled',
  archived: 'Archived',
};

// Required status pill styling as per acceptance criteria:
// active: Success Green pill (#10b981 - Active Access)
// inactive: Warning Amber pill (#f59e0b - Disabled)
// archived: Danger Red pill (#ef4444 - Archived)
export const QR_STATUS_BADGE_STYLES: Record<QRLocationStatus, { bg: string; text: string; hex: string }> = {
  active: { bg: 'bg-[#10b981]/10 border-[#10b981]/30 text-[#10b981]', text: 'Active Access', hex: '#10b981' },
  inactive: { bg: 'bg-[#f59e0b]/10 border-[#f59e0b]/30 text-[#f59e0b]', text: 'Disabled', hex: '#f59e0b' },
  archived: { bg: 'bg-[#ef4444]/10 border-[#ef4444]/30 text-[#ef4444]', text: 'Archived', hex: '#ef4444' },
};
