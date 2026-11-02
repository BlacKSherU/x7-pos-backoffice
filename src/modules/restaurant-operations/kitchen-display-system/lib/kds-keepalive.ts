import { apiRequest } from '@/shared/api/http';
import { ApiError } from '@/shared/lib/api-error';

let isHeartbeatSuspended = false;

export function resetHeartbeatSuspension(): void {
  isHeartbeatSuspended = false;
}

/**
 * Sends a station keepalive heartbeat to ensure kitchen stations and display devices
 * remain marked as active and online in the backend, preventing premature contingency reroutes.
 * Defaults to 'ALL' to keep all stations of the authenticated merchant online.
 */
export async function sendStationKeepaliveHeartbeat(
  stationId: number | string = 'ALL',
): Promise<void> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;
  if (isHeartbeatSuspended) return;

  try {
    await apiRequest<void>(
      `/kitchen-station/${stationId}/heartbeat`,
      { method: 'POST' },
      'Failed to send station keepalive heartbeat',
    );
  } catch (err) {
    if (err instanceof ApiError && (err.status === 402 || err.status === 403)) {
      // Suspend periodic heartbeat attempts if subscription is expired/inactive or feature forbidden
      isHeartbeatSuspended = true;
      return;
    }
    console.warn('Failed to send station keepalive heartbeat:', err);
  }
}
