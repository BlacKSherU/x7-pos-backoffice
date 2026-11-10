import { describe, expect, it } from 'vitest';
import {
  MODULE_NAV_HUBS,
  navHubById,
  navHubForFeature,
  setAuthorizedFeatures,
  isFeatureAuthorized,
} from '@/platform/navigation/module-nav-hubs';

const featuresByApp = (): Map<string, string[]> => {
  const map = new Map<string, string[]>();
  for (const hub of MODULE_NAV_HUBS) {
    map.set(
      hub.appId,
      hub.items.map((i) => i.featureId),
    );
  }
  return map;
};

describe('module NavHubBars', () => {
  it('covers every registered module with non-empty Title Case labels and descriptions', () => {
    expect(MODULE_NAV_HUBS.length).toBeGreaterThanOrEqual(17);
    for (const hub of MODULE_NAV_HUBS) {
      expect(hub.hubLabel.length).toBeGreaterThan(0);
      expect(hub.title.length).toBeGreaterThan(0);
      expect(hub.items.length).toBeGreaterThan(0);
      for (const item of hub.items) {
        expect(item.featureId.length).toBeGreaterThan(0);
        expect(item.label.length).toBeGreaterThan(0);
        expect(item.description.length).toBeGreaterThan(0);
      }
    }
  });

  it('links ALL the 3rd-level options of each application in Features.txt', () => {
    const catalog = featuresByApp();
    for (const hub of MODULE_NAV_HUBS) {
      expect(hub.items.map((i) => i.featureId).sort()).toEqual(
        [...(catalog.get(hub.appId) ?? [])].sort(),
      );
    }
  });

  it('resolves a feature to its module and a hub id to its hub', () => {
    expect(navHubForFeature('collaborators-contracts')?.appId).toBe('hr');
    expect(navHubForFeature('receipt-orders')?.hubLabel).toBe(
      'BILLING & TRANSACTIONS COMMAND HUB',
    );
    expect(navHubForFeature('kitchen-stations')?.appId).toBe(
      'kitchen-display-system',
    );
    expect(navHubById('pos-hub')?.appId).toBe('pos');
    expect(navHubById('collaborators')).toBeNull();
  });

  it('uses unique hub ids that never collide with a real feature id', () => {
    const hubIds = MODULE_NAV_HUBS.map((h) => h.hubId);
    expect(new Set(hubIds).size).toBe(hubIds.length);
    const allFeatures = [...featuresByApp().values()].flat();
    for (const id of hubIds) expect(allFeatures).not.toContain(id);
  });

  it('filters a module NavHub by authorized features and resets cleanly', () => {
    setAuthorizedFeatures(['collaborators', 'collaborators-time-entries']);
    try {
      const hrHub = navHubById('hr-hub');
      expect(hrHub?.items.map((i) => i.featureId)).toEqual([
        'collaborators',
        'collaborators-time-entries',
      ]);
      expect(isFeatureAuthorized('collaborators')).toBe(true);
      expect(isFeatureAuthorized('collaborators-contracts')).toBe(false);
    } finally {
      setAuthorizedFeatures(null);
    }
  });
});
