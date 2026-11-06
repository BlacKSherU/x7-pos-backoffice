import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  restaurantService,
  setSimulate401,
  getSimulate401,
  setAuthenticatedState
} from '@/modules/platform-saas/client-backoffice/api/restaurant-service';
import type {
  UserProfile,
  SystemNotification
} from '@/modules/platform-saas/client-backoffice/api/restaurant-service';
import { navigationService } from '@/platform/navigation/navigationService';
import type {
  NavCategory,
  NavApplication
} from '@/platform/navigation/navigationService';
import { GlobalHeader } from '@/platform/merchant-frame/layout/GlobalHeader';
import { GlobalFooter } from '@/platform/merchant-frame/layout/GlobalFooter';
import { KitchenMonitorView } from '@/modules/restaurant-operations/kitchen-display-system/views/monitor/KitchenMonitorView';
import {
  sendStationKeepaliveHeartbeat,
  resetHeartbeatSuspension,
} from '@/modules/restaurant-operations/kitchen-display-system/lib/kds-keepalive';
import {
  NewReservationModal,
  VoidTransactionModal,
  EODReportModal,
  EmergencySupportModal,
  NewQuickOrderModal,
  LoginGatewayModal
} from '@/shared/components/QuickActionModals';
import type { SubscriptionPlan } from '@/modules/platform-saas/subscription-system/types/subscription';
import type { JournalEntry } from '@/modules/core/financial-engine/types/accounting';
import type { SupplierPayment } from '@/modules/finance-hr/accounts-payable/types/accounts-payable';
import { navHubById, navHubForFeature, setAuthorizedFeatures } from '@/platform/navigation/module-nav-hubs';
import { ModuleNavHubBar } from '@/platform/merchant-frame/layout/ModuleNavHubBar';
import { GenericModuleNavHub } from '@/platform/navigation/GenericModuleNavHub';
import { clearAuthSession, getStoredUser, setPreviewUserRole } from '@/platform/auth/lib/auth-storage';
import { getNavFromPath, resolveStaffTarget } from '@/platform/merchant-frame/merchant-routes';
import { renderMerchantView } from '@/platform/merchant-frame/merchant-view-registry';
import type { AllocationsContext, MerchantViewContext } from '@/platform/merchant-frame/merchant-view-registry';
import { FeatureInDevelopmentView } from '@/shared/components/PlaceholderViews';
import { MerchantHomeDashboard } from '@/modules/platform-saas/client-backoffice/views/dashboard/MerchantHomeDashboard';
import {
  apiRequest,
  getActiveSuperAdminMerchantId,
  setActiveSuperAdminMerchantId,
} from '@/shared/api/http';

interface MerchantStaffUser {
  id: number;
  email: string;
  username: string;
  role: string;
  shiftRole?: string | null;
  collaboratorName?: string | null;
}

const PLATFORM_FALLBACK_USERS: MerchantStaffUser[] = [
  { id: 14, email: 'superadmin@x7pos.com', username: 'superadmin', role: 'super_admin' },
  { id: 16, email: 'portal.admin@x7pos.com', username: 'portal_admin', role: 'portal_admin' },
  { id: 17, email: 'portal.user@x7pos.com', username: 'portal_user', role: 'portal_user' },
];

export const MerchantFrame: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  // Session loading and initialization state (hydrated synchronously from stored user so role is known on first render)
  const [profile, setProfile] = useState<UserProfile | null>(() => {
    const stored = getStoredUser();
    if (!stored) return null;
    return {
      name: stored.email ? stored.email.split('@')[0] : 'Merchant Admin',
      role: stored.role || 'merchant_admin',
      portraitUrl: '',
      Plan_id: 2,
      company_id: stored.merchant?.id,
    };
  });
  const [isAuthLocked, setIsAuthLocked] = useState<boolean>(false);
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);

  // SPA navigation states
  const [activeCategory, setActiveCategory] = useState<string>('core');
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [linesEntryFilter, setLinesEntryFilter] = useState<JournalEntry | null>(null);
  const [itemsPaymentFilter, setItemsPaymentFilter] = useState<SupplierPayment | null>(null);
  const [allocationsContext, setAllocationsContext] = useState<AllocationsContext | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);

  const SAAS_VIEW_TAB_MAP: Record<string, string> = {
    'subscription': 'sub-plans-core',
    'subscription-applications': 'apps-config',
    'subscription-features': 'features-control',
    'subscription-plan-applications': 'plan-apps-rules',
    'subscription-plan-features': 'plan-features-mapping',
  };

  const handleViewChange = (view: string) => {
    setActiveTab(view);
  };

  const navigateToFeature = (featureId: string) => {
    setLinesEntryFilter(null);
    setItemsPaymentFilter(null);
    setAllocationsContext(null);
    setActiveTab(featureId);
    if (location.pathname !== '/dashboard') {
      navigate('/dashboard', { state: { activeTab: featureId, activeCategory } });
    }
    const mainEl = document.querySelector('main');
    if (mainEl) {
      mainEl.scrollTop = 0;
    }
    window.scrollTo(0, 0);
  };

  useEffect(() => {
    const mainEl = document.querySelector('main');
    if (mainEl) {
      mainEl.scrollTop = 0;
      try {
        mainEl.scrollTo({ top: 0, behavior: 'instant' });
      } catch {
        // fallback
      }
    }
    window.scrollTo(0, 0);
    const timer = setTimeout(() => {
      const el = document.querySelector('main');
      if (el) el.scrollTop = 0;
      window.scrollTo(0, 0);
    }, 30);
    return () => clearTimeout(timer);
  }, [activeTab]);

  const handleNavigateView = (view: string, plan?: SubscriptionPlan) => {
    if (plan) setSelectedPlan(plan);
    setActiveTab(SAAS_VIEW_TAB_MAP[view] ?? view);
  };

  const effectiveProfileRole = profile?.role ?? getStoredUser()?.role;
  const [prevRouteKey, setPrevRouteKey] = useState<string>('');
  const currentRouteKey = `${location.pathname}:${location.search}:${effectiveProfileRole ?? ''}:${location.state?.activeTab ?? ''}:${location.state?.activeCategory ?? ''}`;

  if (currentRouteKey !== prevRouteKey) {
    setPrevRouteKey(currentRouteKey);
    const routeNav = getNavFromPath(location.pathname, location.state, effectiveProfileRole);
    if (routeNav) {
      const isPlatformStaff =
        effectiveProfileRole === 'super_admin' ||
        effectiveProfileRole === 'Super Admin (All Access)' ||
        effectiveProfileRole === 'portal_admin' ||
        effectiveProfileRole === 'portal_user' ||
        effectiveProfileRole === 'SaaS Owner';

      const isSaaSCat =
        routeNav.category === 'platformsaas' ||
        routeNav.category === 'platform-saas' ||
        routeNav.category === 'saas' ||
        routeNav.tab === 'saas-dashboard';

      if (isSaaSCat && !isPlatformStaff) {
        setActiveCategory('core');
        setActiveTab('dashboard');
      } else {
        setActiveCategory(routeNav.category);
        setActiveTab(routeNav.tab);
      }
    }
  }

  // Entrar a /dashboard desde el directorio de merchants fija la sucursal de trabajo.
  useEffect(() => {
    const stateMerchantId = location.state?.merchantId;
    if (location.pathname === '/dashboard' && stateMerchantId != null) {
      sessionStorage.setItem('x7:branch-context', String(stateMerchantId));
    }
  }, [location.pathname, location.state]);

  const [showKitchenKDS, setShowKitchenKDS] = useState<boolean>(false);
  const [navCategories, setNavCategories] = useState<NavCategory[]>([]);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [sidebarSearchQuery, setSidebarSearchQuery] = useState<string>('');

  // Auto-expand category strictly when activeTab changes (single accordion model)
  useEffect(() => {
    if (!activeTab || navCategories.length === 0) return;
    const featureHub = navHubForFeature(activeTab);
    const activeCommandHub = navHubById(activeTab);
    const matchedByApp = navCategories.find((cat) =>
      cat.applications.some(
        (app) =>
          app.features.some((f) => f.id === activeTab) ||
          app.id === featureHub?.appId ||
          app.id === activeCommandHub?.appId ||
          activeTab === `${app.id}-hub` ||
          activeTab === app.id,
      ),
    );
    const matchedCat =
      matchedByApp ??
      navCategories.find(
        (cat) =>
          cat.name.toLowerCase() ===
          (featureHub?.category ?? activeCommandHub?.category ?? '').toLowerCase(),
      );

    if (matchedCat) {
      setExpandedCategories({ [matchedCat.id]: true });
      setActiveCategory(matchedCat.id);
    }
  }, [activeTab, navCategories]);

  const filteredNavCategories = useMemo(() => {
    const query = sidebarSearchQuery.trim().toLowerCase();
    if (!query) return navCategories;

    return navCategories
      .map((cat) => {
        const filteredApps = cat.applications
          .map((app) => {
            const filteredFeats = app.features.filter((feat) => {
              const featName = feat.name.toLowerCase();
              const featId = feat.id.toLowerCase();
              return featName.includes(query) || featId.includes(query);
            });

            if (filteredFeats.length > 0) {
              return { ...app, features: filteredFeats };
            }
            return null;
          })
          .filter((app): app is NavApplication => app !== null);

        if (filteredApps.length > 0) {
          return { ...cat, applications: filteredApps };
        }
        return null;
      })
      .filter((cat): cat is NavCategory => cat !== null);
  }, [navCategories, sidebarSearchQuery]);

  const [isNavLoading, setIsNavLoading] = useState<boolean>(true);
  const [navError, setNavError] = useState<string | null>(null);

  const [showNotifications, setShowNotifications] = useState<boolean>(false);
  const [notifications, setNotifications] = useState<SystemNotification[]>([]);
  const [demo401Toggle, setDemo401Toggle] = useState<boolean>(getSimulate401());
  const [showDemoPanel, setShowDemoPanel] = useState<boolean>(false);

  // Super Admin active merchant switching
  const [activeMerchantId, setActiveMerchantId] = useState<string>(
    () => getActiveSuperAdminMerchantId() || '1',
  );
  const [merchantsList, setMerchantsList] = useState<
    Array<{ id: number; name: string; companyId?: number; companyName?: string }>
  >([
    { id: 1, name: 'FastBites Downtown [Essential M1]', companyId: 1, companyName: 'FastBites Corp [Essential]' },
    { id: 3, name: 'FastBites Airport [Essential M2]', companyId: 1, companyName: 'FastBites Corp [Essential]' },
    { id: 2, name: 'Bistro Central [Professional M1]', companyId: 2, companyName: 'Bistro Gourmet Group [Professional]' },
    { id: 4, name: 'Bistro Marina [Professional M2]', companyId: 2, companyName: 'Bistro Gourmet Group [Professional]' },
    { id: 5, name: 'Grand Palace Dining [Executive M1]', companyId: 3, companyName: 'Grand Palace Hospitality [Executive]' },
    { id: 6, name: 'Grand Palace Sky Bar [Executive M2]', companyId: 3, companyName: 'Grand Palace Hospitality [Executive]' },
  ]);

  useEffect(() => {
    const role = profile?.role ?? getStoredUser()?.role;
    if (role === 'super_admin' || role === 'Super Admin (All Access)') {
      apiRequest<{ data?: Array<{ id: number; name: string; company?: { id: number; name: string } }> }>(
        '/merchants',
        { method: 'GET' },
        'Failed to load merchants list',
      )
        .then((res) => {
          if (res?.data && Array.isArray(res.data) && res.data.length > 0) {
            setMerchantsList(
              res.data.map((m) => ({
                id: m.id,
                name: m.name,
                companyId: m.company?.id,
                companyName: m.company?.name || (m.name.includes('Essential') ? 'FastBites Corp [Essential]' : m.name.includes('Professional') ? 'Bistro Gourmet Group [Professional]' : 'Grand Palace Hospitality [Executive]'),
              })),
            );
          }
        })
        .catch((err) => {
          console.error('Failed to load merchants list for superadmin:', err);
        });
    }
  }, [profile?.role, refreshTrigger]);

  const groupedMerchants = useMemo(() => {
    const groups: Record<string, Array<{ id: number; name: string }>> = {};
    for (const m of merchantsList) {
      const groupKey = m.companyName || 'Other Companies';
      if (!groups[groupKey]) groups[groupKey] = [];
      groups[groupKey].push(m);
    }
    return groups;
  }, [merchantsList]);

  const [merchantUsers, setMerchantUsers] = useState<MerchantStaffUser[]>([]);
  const [platformUsers, setPlatformUsers] = useState<MerchantStaffUser[]>(PLATFORM_FALLBACK_USERS);

  // Platform staff (super admin + portal admin/user). Only a super admin can list them.
  useEffect(() => {
    const role = profile?.role ?? getStoredUser()?.role;
    if (role !== 'super_admin') return;
    let ignore = false;
    apiRequest<{ data: MerchantStaffUser[] }>(
      '/users/platform',
      { method: 'GET' },
      'Failed to load platform users',
    )
      .then((res) => {
        if (!ignore && Array.isArray(res?.data) && res.data.length > 0) {
          setPlatformUsers(res.data);
        }
      })
      .catch((err) => {
        console.error('Failed to load platform users:', err);
      });
    return () => {
      ignore = true;
    };
  }, [profile?.role, refreshTrigger]);

  const [selectedUserEmail, setSelectedUserEmail] = useState<string>(
    () =>
      sessionStorage.getItem('x7_superadmin_preview_email') ||
      getStoredUser()?.email ||
      'superadmin@x7pos.com',
  );

  const handleSelectPreviewUser = (email: string) => {
    setSelectedUserEmail(email);
    sessionStorage.setItem('x7_superadmin_preview_email', email);
  };

  const selectedPreviewUser = useMemo(
    () => [...platformUsers, ...merchantUsers].find((u) => u.email === selectedUserEmail) ?? null,
    [platformUsers, merchantUsers, selectedUserEmail],
  );

  const actualUserRole = profile?.role ?? getStoredUser()?.role;
  const isActualSuperAdmin =
    actualUserRole === 'super_admin' || actualUserRole === 'Super Admin (All Access)';
  setPreviewUserRole(isActualSuperAdmin ? (selectedPreviewUser?.role ?? null) : null);

  const handleMerchantSwitch = (newMerchantId: string) => {
    setActiveMerchantId(newMerchantId);
    setActiveSuperAdminMerchantId(newMerchantId);
    window.location.reload();
  };

  useEffect(() => {
    const role = profile?.role ?? getStoredUser()?.role;
    const canSwitchUsers =
      role === 'super_admin' ||
      role === 'Super Admin (All Access)';
    if (!canSwitchUsers) return;

    const fallbackUsers: Record<string, MerchantStaffUser[]> = {
      '1': [
        { id: 18, email: 'admin.mer1@x7pos.com', username: 'admin_mer1', role: 'merchant_admin', shiftRole: null, collaboratorName: null },
        { id: 19, email: 'manager.mer1@x7pos.com', username: 'manager_mer1', role: 'merchant_user', shiftRole: 'manager', collaboratorName: 'Mateo Manager' },
        { id: 20, email: 'cashier.mer1@x7pos.com', username: 'cashier_mer1', role: 'merchant_user', shiftRole: 'cashier', collaboratorName: 'Camila Cajera' },
        { id: 21, email: 'waiter.mer1@x7pos.com', username: 'waiter_mer1', role: 'merchant_user', shiftRole: 'waiter', collaboratorName: 'Manuel Mozo' },
        { id: 22, email: 'cook.mer1@x7pos.com', username: 'cook_mer1', role: 'merchant_user', shiftRole: 'cook', collaboratorName: 'Cristian Cocinero' },
        { id: 23, email: 'delivery.mer1@x7pos.com', username: 'delivery_mer1', role: 'merchant_user', shiftRole: 'delivery', collaboratorName: 'David Delivery' },
      ],
      '2': [
        { id: 25, email: 'admin.mer2@x7pos.com', username: 'admin_mer2', role: 'merchant_admin', shiftRole: null, collaboratorName: null },
        { id: 26, email: 'manager.mer2@x7pos.com', username: 'manager_mer2', role: 'merchant_user', shiftRole: 'manager', collaboratorName: 'Marcos Manager M2' },
        { id: 27, email: 'cashier.mer2@x7pos.com', username: 'cashier_mer2', role: 'merchant_user', shiftRole: 'cashier', collaboratorName: 'Carla Cashier M2' },
        { id: 28, email: 'waiter.mer2@x7pos.com', username: 'waiter_mer2', role: 'merchant_user', shiftRole: 'waiter', collaboratorName: 'Walter Waiter M2' },
        { id: 33, email: 'cook.mer2@x7pos.com', username: 'cook_mer2', role: 'merchant_user', shiftRole: 'cook', collaboratorName: 'Claudio Chef M2' },
        { id: 34, email: 'delivery.mer2@x7pos.com', username: 'delivery_mer2', role: 'merchant_user', shiftRole: 'delivery', collaboratorName: 'Diego Delivery M2' },
      ],
      '3': [
        { id: 29, email: 'admin.mer1b@x7pos.com', username: 'admin_mer1b', role: 'merchant_admin', shiftRole: null, collaboratorName: null },
        { id: 35, email: 'manager.mer1b@x7pos.com', username: 'manager_mer1b', role: 'merchant_user', shiftRole: 'manager', collaboratorName: 'Mariano Manager M1B' },
        { id: 36, email: 'cashier.mer1b@x7pos.com', username: 'cashier_mer1b', role: 'merchant_user', shiftRole: 'cashier', collaboratorName: 'Carolina Cashier M1B' },
        { id: 37, email: 'waiter.mer1b@x7pos.com', username: 'waiter_mer1b', role: 'merchant_user', shiftRole: 'waiter', collaboratorName: 'William Waiter M1B' },
        { id: 38, email: 'cook.mer1b@x7pos.com', username: 'cook_mer1b', role: 'merchant_user', shiftRole: 'cook', collaboratorName: 'Cesar Cook M1B' },
      ],
      '4': [
        { id: 30, email: 'admin.mer2b@x7pos.com', username: 'admin_mer2b', role: 'merchant_admin', shiftRole: null, collaboratorName: null },
        { id: 39, email: 'manager.mer2b@x7pos.com', username: 'manager_mer2b', role: 'merchant_user', shiftRole: 'manager', collaboratorName: 'Mauricio Manager M2B' },
        { id: 40, email: 'cashier.mer2b@x7pos.com', username: 'cashier_mer2b', role: 'merchant_user', shiftRole: 'cashier', collaboratorName: 'Carmen Cashier M2B' },
        { id: 41, email: 'waiter.mer2b@x7pos.com', username: 'waiter_mer2b', role: 'merchant_user', shiftRole: 'waiter', collaboratorName: 'Wendy Waiter M2B' },
        { id: 42, email: 'cook.mer2b@x7pos.com', username: 'cook_mer2b', role: 'merchant_user', shiftRole: 'cook', collaboratorName: 'Camilo Cook M2B' },
        { id: 43, email: 'delivery.mer2b@x7pos.com', username: 'delivery_mer2b', role: 'merchant_user', shiftRole: 'delivery', collaboratorName: 'Daniel Delivery M2B' },
      ],
      '5': [
        { id: 31, email: 'admin.mer3a@x7pos.com', username: 'admin_mer3a', role: 'merchant_admin', shiftRole: null, collaboratorName: null },
        { id: 44, email: 'manager.mer3a@x7pos.com', username: 'manager_mer3a', role: 'merchant_user', shiftRole: 'manager', collaboratorName: 'Marcelo Manager M3A' },
        { id: 45, email: 'cashier.mer3a@x7pos.com', username: 'cashier_mer3a', role: 'merchant_user', shiftRole: 'cashier', collaboratorName: 'Clara Cashier M3A' },
        { id: 46, email: 'waiter.mer3a@x7pos.com', username: 'waiter_mer3a', role: 'merchant_user', shiftRole: 'waiter', collaboratorName: 'Waldemar Waiter M3A' },
        { id: 47, email: 'cook.mer3a@x7pos.com', username: 'cook_mer3a', role: 'merchant_user', shiftRole: 'cook', collaboratorName: 'Carlos Chef M3A' },
        { id: 48, email: 'delivery.mer3a@x7pos.com', username: 'delivery_mer3a', role: 'merchant_user', shiftRole: 'delivery', collaboratorName: 'Dario Delivery M3A' },
      ],
      '6': [
        { id: 32, email: 'admin.mer3b@x7pos.com', username: 'admin_mer3b', role: 'merchant_admin', shiftRole: null, collaboratorName: null },
        { id: 49, email: 'manager.mer3b@x7pos.com', username: 'manager_mer3b', role: 'merchant_user', shiftRole: 'manager', collaboratorName: 'Martin Manager M3B' },
        { id: 50, email: 'cashier.mer3b@x7pos.com', username: 'cashier_mer3b', role: 'merchant_user', shiftRole: 'cashier', collaboratorName: 'Cinthia Cashier M3B' },
        { id: 51, email: 'waiter.mer3b@x7pos.com', username: 'waiter_mer3b', role: 'merchant_user', shiftRole: 'waiter', collaboratorName: 'Wenceslao Waiter M3B' },
        { id: 52, email: 'bartender.mer3b@x7pos.com', username: 'bartender_mer3b', role: 'merchant_user', shiftRole: 'bartender', collaboratorName: 'Bernardo Bartender M3B' },
        { id: 53, email: 'cook.mer3b@x7pos.com', username: 'cook_mer3b', role: 'merchant_user', shiftRole: 'cook', collaboratorName: 'Cristobal Cook M3B' },
      ],
    };

    const applyUsersList = (users: MerchantStaffUser[]) => {
      setMerchantUsers(users);
      if (users.length > 0) {
        setSelectedUserEmail((prev) => {
          const isKnown =
            users.some((u) => u.email === prev) ||
            PLATFORM_FALLBACK_USERS.some((u) => u.email === prev);
          if (prev && isKnown) return prev;
          const fallbackEmail = users[0].email;
          sessionStorage.setItem('x7_superadmin_preview_email', fallbackEmail);
          return fallbackEmail;
        });
      }
    };

    let ignore = false;
    apiRequest<{ data: MerchantStaffUser[] }>(
      `/users/merchant/${activeMerchantId}`,
      { method: 'GET' },
      'Failed to load merchant users',
    )
      .then((res) => {
        if (!ignore && res?.data && Array.isArray(res.data) && res.data.length > 0) {
          applyUsersList(res.data);
        }
      })
      .catch((err) => {
        console.error('Failed to load merchant users:', err);
        if (!ignore) {
          applyUsersList(fallbackUsers[String(activeMerchantId)] || []);
        }
      });
    return () => {
      ignore = true;
    };
  }, [activeMerchantId, refreshTrigger, profile?.role]);

  // Platform SaaS lives inside this same shell: portal staff only see the Platform SaaS
  // category (saas_web); the super admin sees it together with the merchant categories;
  // every other role gets the merchant menu with the SaaS category hidden.
  useEffect(() => {
    const baseRole = profile?.role ?? getStoredUser()?.role;
    const isRealSuperAdmin =
      baseRole === 'super_admin' || baseRole === 'Super Admin (All Access)';
    const effectiveRole =
      isRealSuperAdmin && selectedPreviewUser ? selectedPreviewUser.role : baseRole;
    const previewUserId =
      isRealSuperAdmin && selectedPreviewUser ? selectedPreviewUser.id : undefined;

    const isPortalStaff = effectiveRole === 'portal_admin' || effectiveRole === 'portal_user';
    const isSuperAdmin =
      effectiveRole === 'super_admin' || effectiveRole === 'Super Admin (All Access)';
    let ignore = false;
    setIsNavLoading(true);
    setNavError(null);

    const loadWithRetry = async (
      surface: 'merchant_web' | 'saas_web',
      attempts = 3,
      targetUserId?: number,
    ): Promise<NavCategory[]> => {
      for (let attempt = 1; attempt <= attempts; attempt++) {
        try {
          return await navigationService.loadDynamicNavigation(surface, targetUserId);
        } catch (err) {
          const status =
            typeof err === 'object' && err !== null && 'status' in err
              ? (err as { status?: number }).status
              : undefined;
          const isTransient = status === 502 || status === 503 || status === 504 || err instanceof TypeError;
          if (!isTransient || attempt === attempts) {
            throw err;
          }
          await new Promise((resolve) => setTimeout(resolve, attempt * 700));
        }
      }
      return [];
    };

    const loadMenu = async (): Promise<NavCategory[]> => {
      if (isPortalStaff) {
        return loadWithRetry('saas_web', 3, previewUserId);
      }
      const merchantMenu = await loadWithRetry(
        'merchant_web',
        3,
        isSuperAdmin ? undefined : previewUserId,
      );
      if (!isSuperAdmin) {
        return merchantMenu.filter(
          (cat) =>
            cat.id !== 'platform-saas' &&
            cat.id !== 'platformsaas' &&
            cat.name.toLowerCase() !== 'platform saas',
        );
      }
      try {
        const saasMenu = await loadWithRetry('saas_web');
        const merchantOnly = merchantMenu.filter((cat) => !saasMenu.some((s) => s.id === cat.id));
        return [...saasMenu, ...merchantOnly];
      } catch (err) {
        console.warn('Could not load saas_web menu for super_admin, falling back to merchant_web:', err);
        return merchantMenu;
      }
    };

    loadMenu()
      .then((menu) => {
        if (!ignore) {
          const allowedCodes = new Set<string>();
          for (const cat of menu) {
            for (const app of cat.applications) {
              allowedCodes.add(app.id);
              allowedCodes.add(`${app.id}-hub`);
              for (const feat of app.features) {
                allowedCodes.add(feat.id);
              }
            }
          }
          setAuthorizedFeatures(allowedCodes);
          setNavCategories(menu);
          setNavError(null);
          setIsNavLoading(false);

          if (menu.length > 0) {
            const directTargets: Record<string, string> = {
              'central-backoffice': 'saas-dashboard',
              'saas-companies': 'companies-registry',
              'saas-merchants': 'global-merchants-directory',
              'saas-users': 'users-auth-profiles',
              'client-backoffice': 'dashboard',
              companies: 'company-profile',
              merchants: 'merchant-directory',
              users: 'user-management',
            };
            const featureHub = navHubForFeature(activeTab);
            const activeCommandHub = navHubById(activeTab);
            const isTabAllowed = menu.some((cat) =>
              cat.applications.some(
                (app) =>
                  app.features.some((f) => f.id === activeTab) ||
                  directTargets[app.id] === activeTab ||
                  app.id === featureHub?.appId ||
                  app.id === activeCommandHub?.appId ||
                  activeTab === `${app.id}-hub` ||
                  activeTab === app.id,
              ),
            );

            if (!isTabAllowed) {
              const firstCat = menu[0];
              const firstApp = firstCat.applications[0];
              const nextTab =
                (firstApp && directTargets[firstApp.id]) ||
                firstApp?.features[0]?.id ||
                (isPortalStaff ? 'saas-dashboard' : 'dashboard');
              setActiveCategory(firstCat.id);
              setActiveTab(nextTab);
              setExpandedCategories({ [firstCat.id]: true });
              if (location.pathname !== '/dashboard') {
                navigate('/dashboard', {
                  state: { activeTab: nextTab, activeCategory: firstCat.id },
                });
              }
            }
          }
        }
      })
      .catch((err: unknown) => {
        console.error('Error loading dynamic navigation menu', err);
        if (!ignore) {
          const message =
            err instanceof Error
              ? err.message
              : typeof err === 'object' && err !== null && 'message' in err
                ? String((err as { message: unknown }).message)
                : 'Failed to load navigation menu';
          setNavError(message);
          setIsNavLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshTrigger, profile?.role, selectedPreviewUser]);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);

  const [isReservationOpen, setIsReservationOpen] = useState<boolean>(false);
  const [isVoidOpen, setIsVoidOpen] = useState<boolean>(false);
  const [isEODOpen, setIsEODOpen] = useState<boolean>(false);
  const [isSupportOpen, setIsSupportOpen] = useState<boolean>(false);
  const [isQuickOrderOpen, setIsQuickOrderOpen] = useState<boolean>(false);

  useEffect(() => {
    let ignore = false;

    async function initSession() {
      try {
        setAuthenticatedState(true);
        const userProfile = await restaurantService.getUserProfile();
        if (ignore) return;
        setIsAuthLocked(false);
        setProfile(userProfile);
        await restaurantService.getEstablishmentTier();
      } catch (err: unknown) {
        if (ignore) return;
        if (typeof err === 'object' && err !== null && 'status' in err && (err as { status?: number }).status === 401) {
          setIsAuthLocked(true);
        } else {
          console.error('Error during session hydration', err);
        }
      }
    }

    initSession();

    return () => {
      ignore = true;
    };
  }, [refreshTrigger, profile?.role]);

  useEffect(() => {
    let ignore = false;

    if (!isAuthLocked) {
      restaurantService
        .getNotifications()
        .then((data) => {
          if (!ignore) {
            setNotifications(data);
          }
        })
        .catch((err: unknown) => {
          console.error('Error loading notifications', err);
        });
    }

    return () => {
      ignore = true;
    };
  }, [isAuthLocked, refreshTrigger]);

  useEffect(() => {
    const handleOpenKiosk = () => setActiveTab('time-clock-kiosk');
    const handleOpenDash = () => setActiveTab('dashboard');
    window.addEventListener('open-time-clock-kiosk', handleOpenKiosk);
    window.addEventListener('open-dashboard', handleOpenDash);
    return () => {
      window.removeEventListener('open-time-clock-kiosk', handleOpenKiosk);
      window.removeEventListener('open-dashboard', handleOpenDash);
    };
  }, []);

  useEffect(() => {
    const rootEl = document.getElementById('root');
    const bodyEl = document.body;
    const exclusiveSaaS = [
      'saas-dashboard',
      'companies-dashboard',
      'apps-config',
      'features-control',
      'plan-apps-rules',
      'plan-features-mapping',
      'sub-plans-core',
      'sub-apps-mapping'
    ];
    const isSaaSTab =
      profile?.role === 'SaaS Owner' ||
      profile?.role === 'portal_admin' ||
      profile?.role === 'portal_user' ||
      exclusiveSaaS.includes(activeTab) ||
      activeCategory === 'saas' ||
      activeCategory === 'platform-saas';

    if (isSaaSTab) {
      rootEl?.classList.remove('restaurant-active');
      bodyEl?.classList.remove('restaurant-active');
      rootEl?.classList.add('saas-active');
      bodyEl?.classList.add('saas-active');
    } else {
      rootEl?.classList.remove('saas-active');
      bodyEl?.classList.remove('saas-active');
      rootEl?.classList.add('restaurant-active');
      bodyEl?.classList.add('restaurant-active');
    }

    return () => {
      rootEl?.classList.remove('restaurant-active', 'saas-active');
      bodyEl?.classList.remove('restaurant-active', 'saas-active');
    };
  }, [activeTab, activeCategory, profile?.role]);

  // Latido keepalive continuo de estaciones de cocina en Backoffice mientras el usuario tenga sesión activa de comercio
  useEffect(() => {
    const role = profile?.role ?? getStoredUser()?.role;
    if (!role || role === 'portal_admin' || role === 'portal_user') {
      return;
    }
    resetHeartbeatSuspension();
    void sendStationKeepaliveHeartbeat('ALL');

    const keepaliveTimer = setInterval(() => {
      void sendStationKeepaliveHeartbeat('ALL');
    }, 15000);

    return () => clearInterval(keepaliveTimer);
  }, [profile?.role]);

  const handleToggle401 = () => {
    const newState = !demo401Toggle;
    setSimulate401(newState);
    setDemo401Toggle(newState);
    if (newState) {
      setIsAuthLocked(true);
    } else {
      setRefreshTrigger((prev) => prev + 1);
    }
  };

  const handleLoginSuccess = () => {
    setIsAuthLocked(false);
    setRefreshTrigger((prev) => prev + 1);
  };

  const handleLogout = async () => {
    try {
      await restaurantService.logout();
      clearAuthSession();
      navigate('/login', { replace: true });
    } catch (err: unknown) {
      console.error(err);
    }
  };

  if (showKitchenKDS) {
    return <KitchenMonitorView onBackToDashboard={() => setShowKitchenKDS(false)} />;
  }

  const moduleNavHub = navHubForFeature(activeTab);

  const goToDashboard = () => {
    if (
      profile?.role === 'SaaS Owner' ||
      profile?.role === 'portal_admin' ||
      profile?.role === 'portal_user'
    ) {
      setActiveCategory('platform-saas');
      setActiveTab('saas-dashboard');
    } else {
      setActiveCategory('merchant-portal');
      setActiveTab('dashboard');
    }
    navigate('/dashboard');
  };

  const handleStaffNavigate = (target: string) => {
    const staffTarget = resolveStaffTarget(target);
    if (!staffTarget) {
      setActiveTab(target);
      return;
    }
    if (staffTarget.category) setActiveCategory(staffTarget.category);
    setActiveTab(staffTarget.tab);
    try {
      navigate(staffTarget.path);
    } catch {
      // Router navigation suppressed if context not available
    }
  };

  const viewContext: MerchantViewContext = {
    activeCategory,
    profile,
    selectedPlan,
    refreshTrigger,
    onNavigate: handleViewChange,
    onStaffNavigate: handleStaffNavigate,
    onSaasNavigate: handleNavigateView,
    navigateToFeature,
    setActiveTab,
    goToDashboard,
    openLiveMonitor: () => setShowKitchenKDS(true),
    linesEntryFilter,
    setLinesEntryFilter,
    itemsPaymentFilter,
    setItemsPaymentFilter,
    allocationsContext,
    setAllocationsContext,
  };

  const renderSPAView = () => {
    const registered = renderMerchantView(activeTab, viewContext);
    if (registered !== undefined) return registered;

    const commandHub = navHubById(activeTab);
    if (commandHub && !commandHub.items.some((i) => i.featureId === activeTab)) {
      return <GenericModuleNavHub hub={commandHub} onNavigate={navigateToFeature} />;
    }

    if (activeTab !== 'dashboard') {
      let featureName = activeTab.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      let featureIcon = 'widgets';
      let appName = '';

      for (const cat of navCategories) {
        for (const app of cat.applications) {
          const feat = app.features.find(f => f.id === activeTab);
          if (feat) {
            featureName = feat.name;
            featureIcon = feat.icon || cat.icon;
            appName = app.name;
            break;
          }
        }
        if (appName) break;
      }

      return (
        <FeatureInDevelopmentView
          featureName={featureName}
          featureIcon={featureIcon}
          appName={appName}
          hub={moduleNavHub}
          onBackToHub={() => {
            if (moduleNavHub) navigateToFeature(moduleNavHub.hubId);
          }}
          onBackToDashboard={() => {
            if (
              profile?.role === 'SaaS Owner' ||
              profile?.role === 'portal_admin' ||
              profile?.role === 'portal_user'
            ) {
              setActiveTab('saas-dashboard');
            } else {
              setActiveCategory('core');
              setActiveTab('dashboard');
            }
          }}
        />
      );
    }

    return (
      <MerchantHomeDashboard
        refreshTrigger={refreshTrigger}
        onOpenKitchenMonitor={() => setShowKitchenKDS(true)}
        onNewReservation={() => setIsReservationOpen(true)}
        onVoidTransaction={() => setIsVoidOpen(true)}
        onRunEodReport={() => setIsEODOpen(true)}
        onEmergencySupport={() => setIsSupportOpen(true)}
      />
    );
  };

  return (
    <div className="overflow-hidden min-h-screen relative bg-[#f1ece4]">
      <aside className={`fixed left-0 top-16 h-[calc(100vh-4rem)] w-64 bg-[#222222] border-r border-white/10 z-50 flex flex-col transition-transform duration-300 ease-in-out ${
        isSidebarCollapsed ? '-translate-x-full' : 'translate-x-0'
      }`}>
        <nav className="flex-1 overflow-y-auto custom-scrollbar sidebar-scroll py-4 space-y-1 text-left">
          {isNavLoading ? (
            <div className="px-5 py-8 text-center text-xs text-white/50 space-y-2">
              <span className="material-symbols-outlined text-2xl text-white/30 animate-spin">
                sync
              </span>
              <p className="text-[11px] text-white/40">Loading navigation menu...</p>
            </div>
          ) : navError ? (
            <div className="px-5 py-8 text-center text-xs text-white/60 space-y-3">
              <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto text-red-400">
                <span className="material-symbols-outlined text-2xl">error</span>
              </div>
              <div>
                <p className="font-semibold text-white/90 text-sm">Failed to Load Menu</p>
                <p className="text-[11px] text-white/50 mt-1 leading-relaxed">
                  {navError}. Please check your backend connection, migrations, or permissions.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRefreshTrigger((prev) => prev + 1)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium text-white bg-white/10 hover:bg-white/20 rounded cursor-pointer transition-colors"
              >
                <span className="material-symbols-outlined text-sm">refresh</span>
                Retry
              </button>
            </div>
          ) : navCategories.length === 0 ? (
            <div className="px-5 py-10 text-center text-xs text-white/60 space-y-3">
              <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mx-auto text-amber-500">
                <span className="material-symbols-outlined text-2xl">assignment_late</span>
              </div>
              <div>
                <p className="font-semibold text-white/90 text-sm">No Active Assignments</p>
                <p className="text-[11px] text-white/50 mt-1 leading-relaxed">
                  No shift position or active modules have been assigned to your account. Please contact your restaurant branch manager.
                </p>
              </div>
            </div>
          ) : filteredNavCategories.length === 0 ? (
            <div className="px-4 py-8 text-center text-xs text-white/50 space-y-1">
              <span className="material-symbols-outlined text-2xl text-white/30">search_off</span>
              <p className="font-semibold">No menu items match</p>
              <p className="text-[10px] text-white/40">"{sidebarSearchQuery}"</p>
            </div>
          ) : (
            filteredNavCategories.map((cat) => {
              const isCatExpanded = sidebarSearchQuery.trim() !== '' || !!expandedCategories[cat.id];
              const featureHub = navHubForFeature(activeTab);
              const activeCommandHub = navHubById(activeTab);

              // Active category is strictly determined by the active tab location; fallback to activeCategory only when no category matches activeTab
              const activeMatchingCat =
                navCategories.find((c) =>
                  c.applications.some(
                    (app) =>
                      app.features.some((f) => f.id === activeTab) ||
                      activeCommandHub?.appId === app.id ||
                      featureHub?.appId === app.id ||
                      activeTab === `${app.id}-hub` ||
                      activeTab === app.id,
                  ),
                ) ??
                navCategories.find(
                  (c) =>
                    c.name.toLowerCase() ===
                    (featureHub?.category ?? activeCommandHub?.category ?? '').toLowerCase(),
                );
              const isCatActive = activeMatchingCat ? activeMatchingCat.id === cat.id : activeCategory === cat.id;

              return (
                <div key={cat.id} className="w-full text-left">
                  <div
                    onClick={() => {
                      const isCurrentlyExpanded = !!expandedCategories[cat.id];
                      setExpandedCategories(isCurrentlyExpanded ? {} : { [cat.id]: true });
                      setActiveCategory(cat.id);
                    }}
                    className={`py-2.5 px-4 flex items-center gap-3 cursor-pointer transition-all duration-200 border-l-2 ${
                      isCatActive
                        ? 'border-[#d51f2c] bg-white/10 text-white font-semibold'
                        : 'border-transparent text-white/70 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <span
                      className={`material-symbols-outlined text-[20px] transition-colors duration-200 ${
                        isCatActive ? 'text-[#d51f2c]' : 'text-white/70'
                      }`}
                    >
                      {cat.icon}
                    </span>
                    <span className="font-sans text-[13px] tracking-tight">{cat.name}</span>
                  </div>

                  {isCatExpanded && (
                    <div className="mt-1 flex flex-col space-y-1">
                      {cat.applications.map((app) => {
                        const appHub = navHubById(`${app.id}-hub`) ?? navHubById(app.id);
                        const hubId = appHub?.hubId ?? `${app.id}-hub`;
                        const isAppSelected =
                          app.features.some((f) => f.id === activeTab) ||
                          activeCommandHub?.appId === app.id ||
                          featureHub?.appId === app.id ||
                          featureHub?.hubId === hubId ||
                          activeTab === hubId ||
                          activeTab === app.id;

                        const handleNavigateTarget = (targetId: string, route?: string) => {
                          setActiveCategory(cat.id);
                          setActiveTab(targetId);
                          if (route) {
                            navigate(route, { state: { activeTab: targetId, activeCategory: cat.id } });
                          } else if (targetId === 'products') {
                            navigate('/dashboard/products');
                          } else if (targetId === 'categories') {
                            navigate('/dashboard/categories');
                          } else if (targetId === 'merchant-directory') {
                            navigate('/dashboard/merchants');
                          } else if (targetId === 'user-management') {
                            navigate('/dashboard/users');
                          } else if (targetId === 'company-profile') {
                            navigate('/dashboard/company-profile');
                          } else if (targetId === 'company-configurations') {
                            navigate('/dashboard/company-configurations');
                          } else if (targetId === 'online-stores') {
                            navigate('/dashboard/online-stores');
                          } else {
                            navigate('/dashboard', { state: { activeTab: targetId, activeCategory: cat.id } });
                          }
                        };

                        const DIRECT_APP_TARGETS: Record<string, string> = {
                          'central-backoffice': 'saas-dashboard',
                          'saas-companies': 'companies-registry',
                          'saas-merchants': 'global-merchants-directory',
                          'saas-users': 'users-auth-profiles',
                          'client-backoffice': 'dashboard',
                          companies: 'company-profile',
                          merchants: 'merchant-directory',
                          users: 'user-management',
                        };

                        const primaryTargetId =
                          DIRECT_APP_TARGETS[app.id] ??
                          (app.features.length === 1 ? app.features[0].id : hubId);

                        return (
                          <div
                            key={app.id}
                            onClick={() => {
                              handleNavigateTarget(primaryTargetId);
                            }}
                            className={`ml-6 mr-3 py-2 px-3 text-[13px] flex items-center justify-between cursor-pointer rounded hover:bg-white/5 transition-colors font-sans duration-200 ${
                              isAppSelected
                                ? 'text-[#d51f2c] font-semibold bg-white/5'
                                : 'text-white/70 hover:text-white'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 flex-1 min-w-0">
                              <span
                                className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                  isAppSelected ? 'bg-[#d51f2c]' : 'bg-white/40'
                                }`}
                              />
                              <span className="truncate">{app.name}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </nav>

        <div className="p-4 border-t border-white/10 space-y-1">
          <div
            onClick={() => alert('Support escalation initiated.')}
            className="side-nav-inactive hover:bg-white/10 py-2 transition-colors cursor-pointer text-white/70 hover:text-white"
          >
            <span className="material-symbols-outlined text-[20px]">contact_support</span>
            <span className="font-body-sm text-body-sm">Support</span>
          </div>
          <div
            onClick={handleLogout}
            className="side-nav-inactive hover:bg-white/10 py-2 transition-colors cursor-pointer text-white/70 hover:text-white"
          >
            <span className="material-symbols-outlined text-[20px]">logout</span>
            <span className="font-body-sm text-body-sm">Logout</span>
          </div>
        </div>
      </aside>

      <GlobalHeader
        activeTab={activeTab}
        activeCategory={activeCategory}
        refreshTrigger={refreshTrigger}
        navCategories={navCategories}
        notifications={notifications}
        showNotifications={showNotifications}
        setShowNotifications={setShowNotifications}
        isSidebarCollapsed={isSidebarCollapsed}
        onToggleSidebar={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        onLogoClick={goToDashboard}
        onSelectFeature={(featureId, categoryId) => {
          if (categoryId) setActiveCategory(categoryId);
          setActiveTab(featureId);
          navigate('/dashboard', { state: { activeTab: featureId, activeCategory: categoryId } });
        }}
        onMenuSearchChange={(query) => setSidebarSearchQuery(query)}
      />

      <main className={`fixed top-16 bottom-0 right-0 overflow-y-auto overflow-x-hidden bg-[#f1ece4] p-4 md:p-8 custom-scrollbar transition-all duration-300 ease-in-out ${
        isSidebarCollapsed ? 'left-0' : 'left-64'
      }`}>
        <div className="w-full min-h-full flex flex-col justify-between">
          <div className="flex-grow space-y-8 pb-8">
            {renderSPAView()}
          </div>
          <GlobalFooter />
          {moduleNavHub ? (
            <>
              <div aria-hidden="true" className="h-16 shrink-0" />
              <ModuleNavHubBar
                hub={moduleNavHub}
                currentFeatureId={activeTab}
                onNavigate={navigateToFeature}
              />
            </>
          ) : null}
        </div>
      </main>

      {activeTab === 'dashboard' && (
        <button
          onClick={() => setIsQuickOrderOpen(true)}
          className="fixed bottom-8 right-8 w-16 h-16 bg-[#d51f2c] text-white rounded-full shadow-2xl flex items-center justify-center group hover:scale-110 active:scale-95 transition-all z-50 animate-pulse"
        >
          <span className="material-symbols-outlined text-3xl">add</span>
          <span className="absolute right-full mr-4 px-3 py-1 bg-[#222222] text-white text-[10px] font-bold uppercase rounded-sm opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap pointer-events-none shadow-md">
            New Quick Order
          </span>
        </button>
      )}

      <NewReservationModal isOpen={isReservationOpen} onClose={() => setIsReservationOpen(false)} />
      <VoidTransactionModal isOpen={isVoidOpen} onClose={() => setIsVoidOpen(false)} />
      <EODReportModal isOpen={isEODOpen} onClose={() => setIsEODOpen(false)} />
      <EmergencySupportModal isOpen={isSupportOpen} onClose={() => setIsSupportOpen(false)} />
      <NewQuickOrderModal isOpen={isQuickOrderOpen} onClose={() => setIsQuickOrderOpen(false)} />

      <LoginGatewayModal isOpen={false} onLoginSuccess={handleLoginSuccess} />

      {(profile?.role === 'super_admin' ||
        profile?.role === 'Super Admin (All Access)') && (
        <div className={`fixed bottom-16 z-[9999] transition-all duration-300 ease-in-out ${
          isSidebarCollapsed ? 'left-6' : 'left-[272px]'
        }`}>
        <button
          onClick={() => setShowDemoPanel(!showDemoPanel)}
          className="relative w-10 h-10 bg-[#222222] hover:bg-[#d51f2c] text-white rounded-full shadow-lg flex items-center justify-center border border-white/20 transition-all active:scale-95 cursor-pointer"
          title={`Super Admin Controls - Active Store: Merchant ${activeMerchantId}`}
        >
          <span className="material-symbols-outlined text-[20px]">construction</span>
          <span className="absolute -top-1 -right-1 bg-[#ae001a] text-white text-[9px] font-bold px-1 rounded-full border border-[#222222] leading-tight">
            M{activeMerchantId}
          </span>
        </button>

        {showDemoPanel && (
          <div className="absolute bottom-12 left-0 w-[350px] bg-[#1c1c1c] border border-white/20 p-4 rounded-xl shadow-2xl space-y-3.5 animate-fade-in text-left font-sans z-[10000]">
            {/* Header */}
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-[#d51f2c]">admin_panel_settings</span>
                <div>
                  <h3 className="font-bold text-white text-xs leading-none">Super Admin Controls</h3>
                  <p className="text-[10px] text-white/50 mt-0.5">Switch active store & merchant user</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDemoPanel(false)}
                className="p-1 text-white/40 hover:text-white rounded hover:bg-white/10 transition-colors cursor-pointer flex items-center justify-center"
                title="Close panel"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            </div>

            {/* Active Merchant Switcher with Optgroups by Company */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-semibold text-white/90 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[15px] text-amber-400">storefront</span>
                  Switch Active Merchant
                </label>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#ae001a] text-white font-bold tracking-wide">
                  Active #{activeMerchantId}
                </span>
              </div>
              <select
                aria-label="Active Merchant Store"
                value={activeMerchantId}
                onChange={(e) => handleMerchantSwitch(e.target.value)}
                className="w-full bg-[#111111] text-white border border-white/25 text-xs p-2 rounded-lg focus:outline-none focus:border-[#d51f2c] cursor-pointer font-sans transition-colors"
              >
                {Object.entries(groupedMerchants).map(([groupName, stores]) => (
                  <optgroup key={groupName} label={groupName} className="bg-[#222222] text-amber-400 font-bold py-1">
                    {stores.map((m) => (
                      <option key={m.id} value={String(m.id)} className="bg-[#111111] text-white font-normal py-1">
                        #{m.id} — {m.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            {/* Contracted Plan Info */}
            <div className="bg-[#111111] border border-white/10 rounded-lg p-2.5 flex items-center justify-between">
              <div>
                <p className="text-[10px] uppercase font-bold text-white/50 tracking-wider">Contracted Plan</p>
                <p className="text-xs font-bold text-white">
                  {Number(activeMerchantId) === 1 || Number(activeMerchantId) === 3
                    ? 'Plan 1 (15 Apps)'
                    : Number(activeMerchantId) === 2 || Number(activeMerchantId) === 4
                    ? 'Plan 2 (26 Apps)'
                    : 'Plan 3 (28 Apps)'}
                </p>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded font-bold uppercase bg-white/10 text-amber-300 border border-amber-300/20">
                {Number(activeMerchantId) === 1 || Number(activeMerchantId) === 3
                  ? 'Essential'
                  : Number(activeMerchantId) === 2 || Number(activeMerchantId) === 4
                  ? 'Professional'
                  : 'Executive'}
              </span>
            </div>

            {/* Merchant Staff Users Selector & Quick Switch */}
            <div className="border-t border-white/10 pt-2.5 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-semibold text-white/90 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[15px] text-purple-400">group</span>
                  Users & Team
                </label>
                <span className="text-[10px] px-1.5 py-0.5 bg-white/10 text-white/70 rounded font-medium">
                  {platformUsers.length + merchantUsers.length} users
                </span>
              </div>
              <select
                aria-label="Platform and Merchant Users"
                value={selectedUserEmail}
                onChange={(e) => handleSelectPreviewUser(e.target.value)}
                className="w-full bg-[#111111] text-white border border-white/25 text-xs p-2 rounded-lg focus:outline-none focus:border-[#d51f2c] cursor-pointer font-sans transition-colors"
              >
                <optgroup label="Platform Team (SaaS)" className="bg-[#111111] text-white/60">
                  {platformUsers.map((u) => (
                    <option key={`p-${u.id}`} value={u.email} className="bg-[#111111] text-white py-1">
                      {u.username} [{u.role.replace('_', ' ').toUpperCase()}] — {u.email}
                    </option>
                  ))}
                </optgroup>
                <optgroup
                  label={`Merchant Team (#${activeMerchantId})`}
                  className="bg-[#111111] text-white/60"
                >
                  {merchantUsers.map((u) => {
                    const roleLabel = u.shiftRole
                      ? u.shiftRole.toUpperCase()
                      : u.role === 'merchant_admin'
                      ? 'STORE ADMIN'
                      : u.role.toUpperCase();
                    const nameLabel = u.collaboratorName || u.username;
                    return (
                      <option key={u.id} value={u.email} className="bg-[#111111] text-white py-1">
                        {nameLabel} [{roleLabel}] — {u.email}
                      </option>
                    );
                  })}
                </optgroup>
              </select>
            </div>

            {/* Auth Session / 401 Testing */}
            <div className="border-t border-white/10 pt-2.5 space-y-1.5">
              <label className="text-[11px] font-semibold text-white/90 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[15px] text-emerald-400">lock</span>
                Session Security (401 Testing)
              </label>
              <button
                type="button"
                onClick={() => {
                  handleToggle401();
                }}
                className={`w-full py-2 px-3 text-center text-xs font-bold rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  demo401Toggle
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md'
                    : 'bg-red-600 hover:bg-red-700 text-white shadow-md'
                }`}
              >
                <span className="material-symbols-outlined text-[15px]">
                  {demo401Toggle ? 'check_circle' : 'warning'}
                </span>
                <span>{demo401Toggle ? 'Simulate Session OK (200)' : 'Force Expiration (401)'}</span>
              </button>
            </div>
          </div>
        )}
      </div>
      )}
    </div>
  );
};

export default MerchantFrame;