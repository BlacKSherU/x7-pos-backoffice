import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  restaurantService,
  setSimulate401,
  getSimulate401,
  setSimulationPlanId,
  setSimulationRole,
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
import { KitchenMonitorView } from '@/modules/restaurant-operations/kitchen-display-system/views/KitchenMonitorView';
import { sendStationKeepaliveHeartbeat } from '@/modules/restaurant-operations/kitchen-display-system/lib/kds-keepalive';
import {
  NewReservationModal,
  VoidTransactionModal,
  EODReportModal,
  EmergencySupportModal,
  NewQuickOrderModal,
  LoginGatewayModal
} from '@/shared/components/QuickActionModals';
import { setSimulateApiFailure, getSimulateApiFailure } from '@/modules/platform-saas/central-backoffice/api/saas-service';
import type { SubscriptionPlan } from '@/modules/platform-saas/subscription-system/types/subscription';
import type { JournalEntry } from '@/modules/core/financial-engine/types/accounting';
import type { SupplierPayment } from '@/modules/finance-hr/accounts-payable/types/accounts-payable';
import { navHubById, navHubForFeature } from '@/platform/navigation/module-nav-hubs';
import { ModuleNavHubBar } from '@/platform/merchant-frame/layout/ModuleNavHubBar';
import { GenericModuleNavHub } from '@/platform/navigation/GenericModuleNavHub';
import { clearAuthSession } from '@/platform/auth/lib/auth-storage';
import { getNavFromPath, resolveStaffTarget } from '@/platform/merchant-frame/merchant-routes';
import { renderMerchantView } from '@/platform/merchant-frame/merchant-view-registry';
import type { AllocationsContext, MerchantViewContext } from '@/platform/merchant-frame/merchant-view-registry';
import { FeatureInDevelopmentView } from '@/shared/components/PlaceholderViews';
import { MerchantHomeDashboard } from '@/modules/platform-saas/client-backoffice/views/dashboard/MerchantHomeDashboard';

export const MerchantFrame: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  // Session loading and initialization state
  const [profile, setProfile] = useState<UserProfile | null>(null);
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

  const [prevRouteKey, setPrevRouteKey] = useState<string>('');
  const currentRouteKey = `${location.pathname}:${location.search}:${profile?.role ?? ''}:${location.state?.activeTab ?? ''}:${location.state?.activeCategory ?? ''}`;

  if (currentRouteKey !== prevRouteKey) {
    setPrevRouteKey(currentRouteKey);
    const routeNav = getNavFromPath(location.pathname, location.state, profile?.role);
    if (routeNav) {
      setActiveCategory(routeNav.category);
      setActiveTab(routeNav.tab);
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
  const [expandedApps, setExpandedApps] = useState<Record<string, boolean>>({});
  const [sidebarSearchQuery, setSidebarSearchQuery] = useState<string>('');

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

  useEffect(() => {
    let ignore = false;
    setIsNavLoading(true);

    navigationService
      .loadDynamicNavigation('merchant_web')
      .then((menu) => {
        if (!ignore) {
          setNavCategories(menu);
          setIsNavLoading(false);
        }
      })
      .catch((err: unknown) => {
        console.error('Error loading dynamic navigation menu', err);
        if (!ignore) {
          setIsNavLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [refreshTrigger]);

  const [showNotifications, setShowNotifications] = useState<boolean>(false);
  const [notifications, setNotifications] = useState<SystemNotification[]>([]);
  const [demo401Toggle, setDemo401Toggle] = useState<boolean>(getSimulate401());
  const [showDemoPanel, setShowDemoPanel] = useState<boolean>(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [apiFailedToggle, setApiFailedToggle] = useState<boolean>(getSimulateApiFailure());

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
  }, [refreshTrigger]);

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
      activeCategory === 'saas';

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

  // Latido keepalive continuo de estaciones de cocina en Backoffice mientras el usuario tenga sesión activa
  useEffect(() => {
    void sendStationKeepaliveHeartbeat('ALL');

    const keepaliveTimer = setInterval(() => {
      void sendStationKeepaliveHeartbeat('ALL');
    }, 15000);

    return () => clearInterval(keepaliveTimer);
  }, []);

  const handleToggleApiFailure = () => {
    const newState = !apiFailedToggle;
    setSimulateApiFailure(newState);
    setApiFailedToggle(newState);
    setRefreshTrigger((prev) => prev + 1);
  };

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
      setActiveCategory('saas');
      setActiveTab('saas-dashboard');
    } else {
      setActiveCategory('core');
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
    if (commandHub) {
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
            featureIcon = cat.icon;
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
          {navCategories.length === 0 ? (
            isNavLoading ? (
              <div className="px-5 py-8 text-center text-xs text-white/50 space-y-2">
                <span className="material-symbols-outlined text-2xl text-white/30 animate-spin">
                  sync
                </span>
                <p className="text-[11px] text-white/40">Loading navigation menu...</p>
              </div>
            ) : (
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
            )
          ) : filteredNavCategories.length === 0 ? (
            <div className="px-4 py-8 text-center text-xs text-white/50 space-y-1">
              <span className="material-symbols-outlined text-2xl text-white/30">search_off</span>
              <p className="font-semibold">No menu items match</p>
              <p className="text-[10px] text-white/40">"{sidebarSearchQuery}"</p>
            </div>
          ) : (
            filteredNavCategories.map((cat) => {
              const isCatExpanded = sidebarSearchQuery.trim() !== '' || !!expandedCategories[cat.id];
              const hasActiveTab = cat.applications.some(
                (app) =>
                  app.features.some((f) => f.id === activeTab) ||
                  navHubById(activeTab)?.appId === app.id ||
                  activeTab === `${app.id}-hub`,
              );
              const isCatActive = activeCategory === cat.id || hasActiveTab;

              return (
                <div key={cat.id} className="w-full text-left">
                  <div
                    onClick={() => {
                      const isCurrentlyExpanded = !!expandedCategories[cat.id];
                      setExpandedCategories((prev) => ({
                        ...prev,
                        [cat.id]: !prev[cat.id],
                      }));
                      if (isCurrentlyExpanded) {
                        setExpandedApps((prevApps) => {
                          const nextApps = { ...prevApps };
                          cat.applications.forEach((app) => {
                            delete nextApps[app.id];
                          });
                          return nextApps;
                        });
                      }
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
                          navHubById(activeTab)?.appId === app.id ||
                          activeTab === hubId ||
                          activeTab === app.id;
                        const isAppExpanded =
                          sidebarSearchQuery.trim() !== '' || !!expandedApps[app.id];

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

                        return (
                          <div key={app.id} className="w-full text-left">
                            <div
                              className={`ml-6 mr-3 py-2 px-3 text-[13px] flex items-center justify-between cursor-pointer rounded hover:bg-white/5 transition-colors font-sans duration-200 ${
                                isAppSelected
                                  ? 'text-[#d51f2c] font-semibold bg-white/5'
                                  : 'text-white/70 hover:text-white'
                              }`}
                            >
                              <div
                                onClick={() => {
                                  if (app.features.length === 1) {
                                    handleNavigateTarget(app.features[0].id, app.features[0].route);
                                  } else {
                                    handleNavigateTarget(hubId);
                                  }
                                }}
                                className="flex items-center gap-2.5 flex-1 min-w-0"
                              >
                                <span
                                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                    isAppSelected ? 'bg-[#d51f2c]' : 'bg-white/40'
                                  }`}
                                />
                                <span className="truncate">{app.name}</span>
                              </div>

                              {app.features.length > 1 && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setExpandedApps((prev) => ({
                                      ...prev,
                                      [app.id]: !prev[app.id],
                                    }));
                                  }}
                                  className="p-1 text-white/40 hover:text-white transition-colors"
                                  title={isAppExpanded ? 'Collapse submenus' : 'Expand submenus'}
                                >
                                  <span className="material-symbols-outlined text-[16px]">
                                    {isAppExpanded ? 'expand_more' : 'chevron_right'}
                                  </span>
                                </button>
                              )}
                            </div>

                            {isAppExpanded && app.features.length > 1 && (
                              <div className="ml-12 mt-1 border-l border-white/10 space-y-0.5">
                                {app.features.map((feat) => {
                                  const isFeatActive = activeTab === feat.id;
                                  return (
                                    <div
                                      key={feat.id}
                                      onClick={() => handleNavigateTarget(feat.id, feat.route)}
                                      className={`pl-4 py-1.5 text-body-sm cursor-pointer transition-all duration-200 ${
                                        isFeatActive
                                          ? 'bg-white/20 text-white font-semibold border-l-2 border-[#d51f2c] -ml-[2px]'
                                          : 'text-white/60 hover:text-white hover:bg-white/5'
                                      }`}
                                    >
                                      {feat.name}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
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

      {import.meta.env.DEV && (
        <div className={`fixed bottom-16 z-[9999] transition-all duration-300 ease-in-out ${
          isSidebarCollapsed ? 'left-6' : 'left-[272px]'
        }`}>
        <button
          onClick={() => setShowDemoPanel(!showDemoPanel)}
          className="w-10 h-10 bg-[#222222] hover:bg-[#d51f2c] text-white rounded-full shadow-lg flex items-center justify-center border border-white/20 transition-all active:scale-95"
          title="Demo Simulation Controls"
        >
          <span className="material-symbols-outlined text-[20px]">construction</span>
        </button>

        {showDemoPanel && (
          <div className="absolute bottom-12 left-0 w-64 bg-[#222222] border border-white/10 p-4 rounded shadow-2xl space-y-3 animate-fade-in text-left">
            <div>
              <p className="font-bold text-[#d51f2c] uppercase text-[10px] tracking-wider">Demo Simulation Controls</p>
              <p className="text-[9px] text-white/50 mb-2">Simulate live conditions.</p>
            </div>

            <div className="border-t border-white/10 pt-2">
              <p className="font-bold text-white uppercase text-[9px] tracking-wider mb-1">Role / Environment</p>
              <select
                aria-label="Role / Environment"
                value={profile?.role || 'merchant_admin'}
                onChange={(e) => {
                  const role = e.target.value;
                  setSimulationRole(role);
                  if (
                    role === 'portal_admin' ||
                    role === 'portal_user' ||
                    role === 'SaaS Owner'
                  ) {
                    setActiveCategory('saas');
                    setActiveTab('saas-dashboard');
                  } else if (
                    role === 'super_admin' ||
                    role === 'Super Admin (All Access)'
                  ) {
                    setActiveCategory('core');
                    setActiveTab('dashboard');
                  } else {
                    setActiveCategory('core');
                    setActiveTab('dashboard');
                  }
                  setRefreshTrigger((p) => p + 1);
                }}
                className="w-full bg-[#111111] text-white border border-white/20 text-xs p-1 rounded focus:outline-none focus:border-[#d51f2c]"
              >
                <option value="super_admin">Super Admin (All Access)</option>
                <option value="portal_admin">Portal Admin (Platform SaaS)</option>
                <option value="portal_user">Portal User (SaaS Read-Only)</option>
                <option value="merchant_admin">Merchant Admin (General Manager)</option>
                <option value="merchant_user">Merchant User (Staff)</option>
              </select>
            </div>

            {profile?.role !== 'SaaS Owner' &&
              profile?.role !== 'portal_admin' &&
              profile?.role !== 'portal_user' && (
              <div className="border-t border-white/10 pt-2">
                <p className="font-bold text-white uppercase text-[9px] tracking-wider mb-1">Merchant Plan (Tier)</p>
                <select
                  aria-label="Merchant Plan (Tier)"
                  value={profile?.Plan_id || 2}
                  onChange={(e) => {
                    const planId = parseInt(e.target.value);
                    setSimulationPlanId(planId);
                    if (planId === 1 && (activeCategory === 'finance' || activeCategory === 'growth')) {
                      setActiveCategory('core');
                      setActiveTab('dashboard');
                    } else if (planId === 2 && activeCategory === 'growth') {
                      setActiveCategory('core');
                      setActiveTab('dashboard');
                    }
                    setRefreshTrigger((p) => p + 1);
                  }}
                  className="w-full bg-[#111111] text-white border border-white/20 text-xs p-1 rounded focus:outline-none focus:border-[#d51f2c]"
                >
                  <option value="1">Plan 1: Quick Service</option>
                  <option value="2">Plan 2: Full Restaurant</option>
                  <option value="3">Plan 3: Enterprise</option>
                </select>
              </div>
            )}

            {profile?.role === 'SaaS Owner' ||
            profile?.role === 'portal_admin' ||
            profile?.role === 'portal_user' ? (
              <div className="border-t border-white/10 pt-2">
                <p className="font-bold text-white uppercase text-[9px] tracking-wider mb-1">SaaS Status</p>
                <button
                  onClick={() => {
                    handleToggleApiFailure();
                  }}
                  className={`w-full py-1.5 px-2 text-center text-xs font-bold text-white rounded transition-colors ${
                    apiFailedToggle ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  {apiFailedToggle ? 'Simulate Online API' : 'Simulate API Failure'}
                </button>
              </div>
            ) : (
              <div className="border-t border-white/10 pt-2">
                <p className="font-bold text-white uppercase text-[9px] tracking-wider mb-1">Auth Session</p>
                <button
                  onClick={() => {
                    handleToggle401();
                  }}
                  className={`w-full py-1.5 px-2 text-center text-xs font-bold text-white rounded transition-colors ${
                    demo401Toggle ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  {demo401Toggle ? 'Simulate Session OK (200)' : 'Force Expiration (401)'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
      )}
    </div>
  );
};

export default MerchantFrame;