import React, { useEffect, useState } from 'react';
import type { KitchenDisplayMode, KitchenStation, KitchenStationType } from '@/modules/restaurant-operations/kitchen-display-system/views/stations/kdsStations';
import { KitchenQuickLinks } from '@/modules/restaurant-operations/kitchen-display-system/views/hub/KitchenQuickLinks';
import {
  StandardDashboardHub,
  type DashboardKPIItem,
  type DashboardModuleItem,
} from '@/shared/components/StandardDashboardHub';
import { apiRequest, unwrapList, type MaybeEnvelopedList } from '@/shared/api/http';
interface KitchenKDSHubViewProps {
  onNavigate?: (view: string) => void;
  onOpenLiveMonitor?: () => void;
}

export const KitchenKDSHubView: React.FC<KitchenKDSHubViewProps> = ({
  onNavigate,
  onOpenLiveMonitor,
}) => {
  const [stations, setStations] = useState<KitchenStation[]>([]);
  const [devicesCount, setDevicesCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        // Stations and devices feed independent cards: one failing must not blank the other.
        const [stJson, devJson] = await Promise.all([
          apiRequest<MaybeEnvelopedList<KitchenStation & Record<string, unknown>>>(
            '/kitchen-station',
            { method: 'GET' },
            '',
          ).catch(() => null),
          apiRequest<MaybeEnvelopedList<{ status?: string }>>('/kitchen-display-devices', { method: 'GET' }, '').catch(
            () => null,
          ),
        ]);

        if (stJson) {
          setStations(
            unwrapList(stJson).map((st) => ({
              ...st,
              is_active: (st.isActive as boolean | undefined) ?? st.is_active ?? true,
              station_type: (st.stationType as KitchenStationType | undefined) ?? st.station_type ?? 'PREP',
              display_mode: (st.displayMode as KitchenDisplayMode | undefined) ?? st.display_mode ?? 'AUTO',
              display_order: (st.displayOrder as number | undefined) ?? st.display_order ?? 1,
              station_number: Number(st.stationNumber ?? st.station_number ?? st.displayOrder ?? st.display_order ?? st.id),
              stationNumber: Number(st.stationNumber ?? st.station_number ?? st.displayOrder ?? st.display_order ?? st.id),
              printer_name: (st.printerName as string | null | undefined) ?? st.printer_name ?? null,
              status: st.status || 'active',
            }))
          );
        }

        if (devJson) {
          setDevicesCount(unwrapList(devJson).filter((d) => (d.status ?? 'active') === 'active').length);
        }
      } catch (err) {
        console.error('Error loading KDS Hub metrics:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Real-time calculated metrics
  const activeStations = stations.filter(s => (s.is_active ?? true) && (s.status === 'active' || !s.status));
  const boundPrintersCount = stations.filter(s => s.printer_name && s.printer_name.trim() !== '').length;
  const expoStationsCount = stations.filter(s => (s.station_type === 'EXPO' || s.station_type === 'PACKING') && (s.status === 'active' || !s.status)).length;

  const kpis: DashboardKPIItem[] = [
    {
      title: 'Active Stations',
      value: activeStations.length,
      subtitle: 'Prep & pass lines',
      icon: 'soup_kitchen',
      variant: 'red',
    },
    {
      title: 'Printers Bound',
      value: boundPrintersCount,
      subtitle: 'Hardware printers',
      icon: 'print',
      variant: 'blue',
    },
    {
      title: 'Expo / Pass',
      value: expoStationsCount,
      subtitle: 'Expo stations ready',
      icon: 'star',
      variant: 'amber',
    },
    {
      title: 'System Status',
      value: 'OPERATIONAL',
      subtitle: 'Real-time KDS',
      icon: 'check_circle',
      variant: 'emerald',
      isOperationalStatus: true,
      statusLabel: 'OPERATIONAL',
    },
  ];

  const modules: DashboardModuleItem[] = [
    {
      id: 'kitchen-stations',
      title: 'Kitchen Display Stations',
      subtitle: 'LINE PREP & EXPEDITOR MONITORS',
      description: 'Configure line prep monitors, display modes, printer bindings, routing channels, and ticket sequencing for kitchen staff.',
      icon: 'soup_kitchen',
      badge: `${activeStations.length} Active Stations`,
      badgeVariant: 'emerald',
      actionText: 'Manage Display Stations',
    },
    {
      id: 'kitchen-display-devices',
      title: 'Kitchen Display Devices',
      subtitle: 'TERMINALS & HARDWARE PAIRING',
      description: 'Register kitchen terminals, monitor hardware heartbeats, assign screen profiles, and pair physical bump bars.',
      icon: 'desktop_windows',
      badge: `${devicesCount || boundPrintersCount} Hardware Bound`,
      badgeVariant: 'blue',
      actionText: 'Manage Display Devices',
    },
    {
      id: 'kitchen-orders',
      title: 'Kitchen Orders & Tickets',
      subtitle: 'REAL-TIME TICKET QUEUE',
      description: 'Monitor active food preparation tickets, course pacing, priority orders, and pass window delivery status.',
      icon: 'restaurant',
      badge: 'Live Queue Active',
      badgeVariant: 'amber',
      actionText: 'Manage Kitchen Orders',
    },
    {
      id: 'kitchen-order-items',
      title: 'Kitchen Order Items Tracking',
      subtitle: 'DISH PREP & COURSE PACING',
      description: 'Track granular dish preparation progress, recipe modifiers, allergen alerts, and station rerouting in real-time.',
      icon: 'format_list_bulleted',
      badge: 'Granular Tracking',
      badgeVariant: 'purple',
      actionText: 'Track Order Items',
    },
    {
      id: 'kitchen-event-log',
      title: 'Kitchen System Event Log',
      subtitle: 'AUDIT TRAIL & LATENCY LOGS',
      description: 'Inspect ticket bump history, recall actions, station latency logs, and staff operational audit events.',
      icon: 'history',
      badge: 'System Audit Active',
      badgeVariant: 'zinc',
      actionText: 'View Event Log',
    },
    {
      id: 'kitchen-performance',
      title: 'Kitchen Performance Analytics',
      subtitle: 'THROUGHPUT & PREP METRICS',
      description: 'Analyze station preparation times, peak bottleneck trends, fulfillment times, and SLA throughput metrics.',
      icon: 'speed',
      badge: 'KPI Analytics',
      badgeVariant: 'rose',
      actionText: 'View Analytics',
    },
  ];

  return (
    <StandardDashboardHub
      breadcrumb="Kitchen Display System / Operational Hub"
      headerIcon="space_dashboard"
      title="KDS Ecosystem Command Hub"
      description="Centralized management hub for kitchen station profiles, hardware terminals, live prep queues, event logging, and preparation metrics."
      primaryAction={
        onOpenLiveMonitor
          ? {
              label: 'LAUNCH LIVE KDS DISPLAY',
              icon: 'open_in_new',
              onClick: onOpenLiveMonitor,
            }
          : undefined
      }
      kpis={kpis}
      loadingKpis={loading}
      modules={modules}
      onModuleClick={(id) => onNavigate?.(id)}
    >
      <KitchenQuickLinks current="kitchen-stations" onNavigate={onNavigate} />
    </StandardDashboardHub>
  );
};

export default KitchenKDSHubView;

