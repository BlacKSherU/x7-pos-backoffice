//src/components/SaaSDashboard/SaaSDashboard.tsx
import React, { useState, useEffect } from 'react';
import { SaasOverviewContent } from '@/modules/platform-saas/central-backoffice/views/dashboard/SaasOverviewContent';
import { setSimulateApiFailure, getSimulateApiFailure } from '@/modules/platform-saas/central-backoffice/api/saas-service';
import { SubscriptionPlansView } from '@/modules/platform-saas/subscription-system/views/SubscriptionPlansView';
import { SaasLoginOverlay } from '@/platform/auth/components/SaasLoginOverlay';
import { isSaasAuthenticated } from '@/platform/auth/lib/saas-auth-storage';
import { getStoredUser } from '@/platform/auth/lib/auth-storage';
import logoX7 from '@/assets/logo-x7.png';
import { PlatformApplicationsView } from '@/modules/platform-saas/subscription-system/views/PlatformApplicationsView';
import { PlatformFeatureCatalogView } from '@/modules/platform-saas/subscription-system/views/PlatformFeatureCatalogView';
import { PlanApplicationsView } from '@/modules/platform-saas/subscription-system/views/PlanApplicationsView';
import { PlanFeaturesView } from '@/modules/platform-saas/subscription-system/views/PlanFeaturesView';
import { CompanyRegistryView } from '@/modules/platform-saas/companies/views/CompanyRegistryView';
import { CompanySubscriptionsView } from '@/modules/platform-saas/subscription-system/views/CompanySubscriptionsView';
import { GlobalUsersDirectoryView } from '@/modules/platform-saas/users/views/GlobalUsersDirectoryView';
import { OrdersRegistryView } from '@/modules/platform-saas/central-backoffice/views/OrdersRegistryView';
import { MerchantSettlementsView } from '@/modules/platform-saas/central-backoffice/views/MerchantSettlementsView';
import type { SubscriptionPlan } from '@/modules/platform-saas/subscription-system/types/subscription';
import { navHubById, navHubForFeature } from '@/platform/navigation/module-nav-hubs';
import { ModuleNavHubBar } from '@/platform/merchant-frame/layout/ModuleNavHubBar';
import { GenericModuleNavHub } from '@/platform/navigation/GenericModuleNavHub';
import { navigationService, type NavCategory } from '@/platform/navigation/navigationService';

// Options without a dedicated component yet in SaaS panel.
const SAAS_PENDING_TABS: Record<string, { icon: string; title: string; desc: string }> = {
  'sub-apps-mapping': {
    icon: 'apps',
    title: 'Subscription Applications',
    desc: 'Applications active on each merchant subscription.',
  },
  'sub-payments-billing': {
    icon: 'payments',
    title: 'Subscription Payments',
    desc: 'Subscription invoices and payment history.',
  },
};

export const SaaSFrame: React.FC = () => {
  const [saasAuthenticated, setSaasAuthenticated] = useState(isSaasAuthenticated);
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
  const [searchText, setSearchText] = useState<string>('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState<string>('');
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);
  const [apiFailedToggle, setApiFailedToggle] = useState<boolean>(getSimulateApiFailure());
  const [navCategories, setNavCategories] = useState<NavCategory[]>([]);
  const [isNavLoading, setIsNavLoading] = useState<boolean>(true);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});

  const currentUser = getStoredUser();
  const isPortalUser = currentUser?.role === 'portal_user';

  // Derived indicator: user has typed but debounce period (300ms) has not settled yet
  const isSearching = Boolean(searchText && searchText !== debouncedSearchQuery);

  // Load dynamic SaaS navigation catalog (GET /api/me/navigation?surface=saas_web)
  useEffect(() => {
    let ignore = false;
    setIsNavLoading(true);

    navigationService
      .loadDynamicNavigation('saas_web')
      .then((categories) => {
        if (!ignore) {
          setNavCategories(categories);
          setIsNavLoading(false);
        }
      })
      .catch((err: unknown) => {
        console.error('Error loading SaaS dynamic navigation:', err);
        if (!ignore) {
          setIsNavLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [refreshTrigger]);

  // Add classes to override limiting styles from original Vite template
  useEffect(() => {
    const rootEl = document.getElementById('root');
    const bodyEl = document.body;
    rootEl?.classList.add('saas-active');
    bodyEl?.classList.add('saas-active');
    return () => {
      rootEl?.classList.remove('saas-active');
      bodyEl?.classList.remove('saas-active');
    };
  }, []);

  // 300ms debounce for global search (AC 1.3)
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchQuery(searchText);
    }, 300);

    return () => {
      clearTimeout(handler);
    };
  }, [searchText]);

  const handleToggleApiFailure = () => {
    const newState = !apiFailedToggle;
    setSimulateApiFailure(newState);
    setApiFailedToggle(newState);
    setRefreshTrigger((prev) => prev + 1); // Force component update
  };

  const handleRefresh = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  const handleNavigateView = (view: string, plan?: SubscriptionPlan) => {
    if (plan) setSelectedPlan(plan);
    setActiveTab(view);
  };

  // Render views according to active tab
  const renderContent = () => {
    const activeCommandHub = navHubById(activeTab);
    if (activeCommandHub) {
      return (
        <GenericModuleNavHub
          hub={activeCommandHub}
          onNavigate={(featId) => setActiveTab(featId)}
        />
      );
    }

    const pending = SAAS_PENDING_TABS[activeTab];
    if (pending) {
      return (
        <div className="bg-white border border-[#e8e2d8] p-12 rounded flex flex-col items-center text-center">
          <span className="material-symbols-outlined text-[#d51f2c] text-6xl" aria-hidden="true">{pending.icon}</span>
          <h2 className="text-h2 font-black text-[#222222] mt-4 uppercase">{pending.title}</h2>
          <p className="text-body-md text-[#666666] mt-2 max-w-md text-center">{pending.desc}</p>
          <p className="text-label-caps font-bold text-[#d51f2c] mt-4 uppercase">In Development</p>
        </div>
      );
    }

    if (activeTab === 'sub-plans-core' || activeTab === 'subscription') {
      return <SubscriptionPlansView onNavigate={handleNavigateView} />;
    }

    if (activeTab === 'apps-config' || activeTab === 'subscription-applications') {
      return <PlatformApplicationsView onNavigate={handleNavigateView} />;
    }

    if (activeTab === 'features-control' || activeTab === 'subscription-features') {
      return <PlatformFeatureCatalogView onNavigate={handleNavigateView} />;
    }

    // The plan that grants access lives on the company subscription (company_subscription).
    if (activeTab === 'merchant-subs-link' || activeTab === 'subscription-merchant-subscriptions') {
      return <CompanySubscriptionsView />;
    }

    // From Subscription Plans they open on the chosen plan; from the NavHubBar, without one,
    // they offer their own plan selector.
    if (activeTab === 'plan-apps-rules' || activeTab === 'subscription-plan-applications') {
      return (
        <PlanApplicationsView
          plan={selectedPlan ?? undefined}
          onNavigate={handleNavigateView}
        />
      );
    }

    if (activeTab === 'plan-features-mapping' || activeTab === 'subscription-plan-features') {
      return (
        <PlanFeaturesView
          plan={selectedPlan ?? undefined}
          onNavigate={handleNavigateView}
        />
      );
    }

    if (activeTab === 'companies' || activeTab === 'companies-hub') {
      return <CompanyRegistryView onNavigate={handleNavigateView} />;
    }

    if (activeTab === 'users' || activeTab === 'users-auth-profiles' || activeTab === 'users-hub') {
      return <GlobalUsersDirectoryView />;
    }

    if (activeTab === 'orders-registry') {
      return <OrdersRegistryView onNavigate={handleNavigateView} />;
    }

    if (activeTab === 'merchant-settlements') {
      return <MerchantSettlementsView onNavigate={handleNavigateView} />;
    }

    if (activeTab === 'dashboard' || activeTab === 'saas-dashboard') {
      return (
        <SaasOverviewContent
          refreshTrigger={refreshTrigger}
          onNavigateToView={handleNavigateView}
        />
      );
    }

    return (
      <div className="bg-white border border-[#e8e2d8] p-12 rounded flex flex-col items-center text-center">
        <span className="material-symbols-outlined text-[#d51f2c] text-6xl">
          {activeTab === 'merchants' && 'store'}
          {activeTab === 'reports' && 'description'}
          {activeTab !== 'merchants' && activeTab !== 'reports' && 'construction'}
        </span>
        <h2 className="text-h2 font-black text-[#222222] mt-4 uppercase">
          {activeTab === 'merchants' ? 'Merchants Registry' : activeTab === 'reports' ? 'System Reports' : 'Section In Development'}
        </h2>
        <p className="text-body-md text-[#666666] mt-2 max-w-md text-center">
          Interactive section view for <strong className="text-[#d51f2c]">/{activeTab}</strong>.
        </p>
        <button
          onClick={() => setActiveTab('dashboard')}
          className="mt-6 px-4 py-2 bg-[#222222] text-white font-bold text-label-caps hover:bg-[#d51f2c] transition-all cursor-pointer"
        >
          Back to Dashboard
        </button>
      </div>
    );
  };

  if (!saasAuthenticated) {
    return <SaasLoginOverlay onSuccess={() => setSaasAuthenticated(true)} />;
  }

  const activeHub = navHubForFeature(activeTab);

  return (
    <div className="text-on-background antialiased font-sans bg-[#f1ece4] min-h-screen text-[14px]">
      {/* SideNavBar Shell */}
      <aside className="fixed left-0 top-0 h-full w-64 bg-[#222222] border-r border-[#333333] flex flex-col z-50">
        <div className="p-6 flex items-center gap-3">
          <img src={logoX7} alt="X7" className="w-20 h-20 object-contain brightness-0 invert" />
          <div className="flex flex-col">
            <h2 className="text-md font-black text-white tracking-tight leading-none">
              POINT OF SALE
            </h2>
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#d51f2c] mt-1">
              Backoffice SaaS
            </span>
          </div>
        </div>

        <nav className="flex-1 px-2 space-y-1 overflow-y-auto sidebar-scroll py-2">
          {isNavLoading && navCategories.length === 0 ? (
            <div className="px-4 py-8 text-center text-xs text-white/40 space-y-2">
              <span className="material-symbols-outlined text-2xl animate-spin text-white/30">
                sync
              </span>
              <p>Loading platform navigation...</p>
            </div>
          ) : (
            navCategories.map((cat) => {
              const isCatExpanded = expandedCategories[cat.id] ?? true;
              const isCatActive = cat.applications.some(
                (app) =>
                  app.features.some((f) => f.id === activeTab) ||
                  activeTab === `${app.id}-hub` ||
                  activeTab === app.id,
              );

              return (
                <div key={cat.id} className="w-full text-left">
                  {/* Category Header */}
                  <div
                    onClick={() => {
                      setExpandedCategories((prev) => ({
                        ...prev,
                        [cat.id]: !isCatExpanded,
                      }));
                    }}
                    className={`border-l-2 pl-3 py-2.5 flex items-center justify-between cursor-pointer transition-colors ${
                      isCatActive
                        ? 'border-[#d51f2c] bg-white/10 text-white font-semibold'
                        : 'border-transparent text-white/70 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`material-symbols-outlined text-[20px] ${
                          isCatActive ? 'text-[#d51f2c]' : 'text-white/70'
                        }`}
                      >
                        {cat.icon || 'dashboard'}
                      </span>
                      <span className="font-sans text-[13px] tracking-wide uppercase font-bold">
                        {cat.name}
                      </span>
                    </div>
                    <span className="material-symbols-outlined text-[16px] text-white/40 pr-2">
                      {isCatExpanded ? 'expand_more' : 'chevron_right'}
                    </span>
                  </div>

                  {/* Sub-items / Applications & Features */}
                  {isCatExpanded && (
                    <div className="mt-1 ml-4 border-l border-white/20 flex flex-col space-y-0.5">
                      {cat.applications.map((app) => {
                        const isAppActive =
                          activeTab === app.id ||
                          activeTab === `${app.id}-hub` ||
                          app.features.some((f) => f.id === activeTab);

                        if (app.features.length <= 1) {
                          const targetTab = app.features[0]?.id ?? app.id;
                          return (
                            <button
                              key={app.id}
                              onClick={() => setActiveTab(targetTab)}
                              className={`pl-4 pr-3 py-2 text-[13px] text-left transition-colors flex items-center gap-2.5 w-full cursor-pointer ${
                                isAppActive
                                  ? 'text-[#d51f2c] font-semibold bg-white/5 border-l-2 border-[#d51f2c] -ml-[1px]'
                                  : 'text-white/70 hover:text-white hover:bg-white/5'
                              }`}
                            >
                              <span className="material-symbols-outlined text-[18px]">
                                {app.icon || 'circle'}
                              </span>
                              <span>{app.name}</span>
                            </button>
                          );
                        }

                        return (
                          <div key={app.id} className="flex flex-col">
                            <button
                              onClick={() => setActiveTab(`${app.id}-hub`)}
                              className={`pl-4 pr-3 py-2 text-[13px] text-left transition-colors flex items-center justify-between w-full cursor-pointer ${
                                isAppActive
                                  ? 'text-[#d51f2c] font-semibold bg-white/5 border-l-2 border-[#d51f2c] -ml-[1px]'
                                  : 'text-white/70 hover:text-white hover:bg-white/5'
                              }`}
                            >
                              <div className="flex items-center gap-2.5 truncate">
                                <span className="material-symbols-outlined text-[18px]">
                                  {app.icon || 'grid_view'}
                                </span>
                                <span className="truncate">{app.name}</span>
                              </div>
                              <span className="material-symbols-outlined text-[14px] text-white/40">
                                arrow_forward
                              </span>
                            </button>

                            <div className="ml-6 border-l border-white/10 flex flex-col space-y-0.5 my-1">
                              {app.features.map((feat) => {
                                const isFeatActive = activeTab === feat.id;
                                return (
                                  <button
                                    key={feat.id}
                                    onClick={() => setActiveTab(feat.id)}
                                    className={`pl-3 pr-2 py-1.5 text-[12px] text-left transition-colors flex items-center gap-2 w-full cursor-pointer ${
                                      isFeatActive
                                        ? 'text-white font-semibold bg-white/10 border-l-2 border-[#d51f2c] -ml-[1px]'
                                        : 'text-white/60 hover:text-white hover:bg-white/5'
                                    }`}
                                  >
                                    <span className="truncate">{feat.name}</span>
                                  </button>
                                );
                              })}
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

        {/* Demo Controls inside Sidebar */}
        <div className="p-4 bg-black/20 border-t border-white/10 text-[11px] text-white/50 space-y-2">
          <p className="font-bold text-[#d51f2c] uppercase">SaaS Demo Controls</p>
          <button
            onClick={handleToggleApiFailure}
            className={`w-full py-1 px-2 text-center font-bold text-white rounded transition-colors ${
              apiFailedToggle ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
            }`}
          >
            {apiFailedToggle ? 'Simulate Online API' : 'Simulate API Failure'}
          </button>
        </div>

        <div className="mt-auto p-2 border-t border-white/10">
          <a
            className="text-white/70 pl-4 py-2 flex items-center gap-3 hover:bg-white/5 hover:text-white transition-all text-[13px]"
            href="#"
            onClick={(e) => {
              e.preventDefault();
              alert('Support module simulation');
            }}
          >
            <span className="material-symbols-outlined">contact_support</span>
            Support
          </a>
          <a
            className="text-white/70 pl-4 py-2 flex items-center gap-3 hover:bg-white/5 hover:text-white transition-all text-[13px]"
            href="#"
            onClick={(e) => {
              e.preventDefault();
              alert('Logout simulation');
            }}
          >
            <span className="material-symbols-outlined">logout</span>
            Logout
          </a>
        </div>
      </aside>

      {/* TopNavBar Shell */}
      <header className="fixed top-0 right-0 left-64 h-16 flex justify-between items-center px-6 bg-[#f1ece4] border-b border-[#e8e2d8] z-40">
        {/* Search Bar with Debounce (AC 1.3) */}
        <div className="flex items-center gap-4 flex-1">
          <div className="relative w-full max-w-md">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#666666] text-lg">
              search
            </span>
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="w-full bg-white/50 border border-[#e8e2d8] rounded py-1.5 pl-10 pr-4 text-body-sm focus:ring-0 focus:border-[#222222] transition-all"
              placeholder="Search merchants, users, or companies..."
            />
            {isSearching && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#666666] animate-pulse">
                ...
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 ml-4">
          {/* Live reactive search indicator */}
          {debouncedSearchQuery && (
            <div className="bg-[#222222] text-white px-2 py-1 text-[10px] font-bold uppercase flex items-center gap-1.5 rounded animate-fade-in shadow-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-ping"></span>
              Query: "{debouncedSearchQuery}"
            </div>
          )}

          {/* Read-Only Badge for portal_user */}
          {isPortalUser && (
            <span className="px-2.5 py-1 bg-amber-500/20 text-amber-700 border border-amber-500/30 rounded font-bold text-[10px] uppercase tracking-wider flex items-center gap-1 shadow-sm mr-1">
              <span className="material-symbols-outlined text-[14px]">visibility</span>
              Read Only
            </span>
          )}

          {/* Super Admin Frame Switcher to Merchant */}
          {getStoredUser()?.role === 'super_admin' && (
            <a
              href="/dashboard"
              className="px-2.5 py-1 bg-[#ae001a] hover:bg-[#930015] text-white rounded font-bold text-xs uppercase flex items-center gap-1.5 transition-colors duration-200 shadow-sm cursor-pointer mr-1"
              title="Switch to Merchant Backoffice"
            >
              <span className="material-symbols-outlined text-[16px]">storefront</span>
              <span className="hidden sm:inline text-[11px]">Merchant POS</span>
            </a>
          )}

          <button
            onClick={handleRefresh}
            className="p-2 text-[#222222] hover:bg-[#e8e2d8] transition-colors relative"
            title="Refresh Data"
          >
            <span className="material-symbols-outlined">refresh</span>
          </button>
          <button className="p-2 text-[#222222] hover:bg-[#e8e2d8] transition-colors">
            <span className="material-symbols-outlined">help</span>
          </button>
          <button className="p-2 text-[#222222] hover:bg-[#e8e2d8] transition-colors">
            <span className="material-symbols-outlined">settings</span>
          </button>
          <div className="h-8 w-px bg-[#e8e2d8] mx-2"></div>
          <div className="flex items-center gap-3 pl-2">
            <div className="text-right">
              <p className="text-body-sm font-bold text-[#222222] leading-none">SaaS Admin</p>
              <p className="text-[11px] text-secondary">Enterprise Controller</p>
            </div>
            {/* Dynamic admin profile picture instead of googleusercontent placeholder */}
            <div className="w-10 h-10 rounded-full border-2 border-white overflow-hidden bg-zinc-200 shadow-sm">
              <img
                alt="User Profile"
                className="w-full h-full object-cover"
                src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=80&h=80&fit=crop&q=80"
              />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Canvas */}
      <main className="ml-64 pt-16 min-h-screen">
        <div className="p-8 max-w-[1600px] mx-auto space-y-8">
          {/* Dashboard Header */}
          <div className="flex justify-between items-end">
            <div>
              {activeTab === 'companies' && (
                <nav className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-[#5f5e5e] mb-1">
                  <span>SaaS Admin</span>
                  <span className="text-[#d51f2c]">›</span>
                  <span className="text-[#1d1c17]">Company Management</span>
                </nav>
              )}
              {(activeTab === 'subscription-applications' ||
              activeTab === 'subscription-live-installs' ||
              activeTab === 'subscription-features' ||
              activeTab === 'subscription-plan-applications' ||
              activeTab === 'subscription-plan-features') && (
                <nav className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-[#5f5e5e] mb-1">
                  <span>SaaS Admin</span>
                  <span className="text-[#d51f2c]">›</span>
                  <span>
                    {activeTab === 'subscription-plan-applications' ||
                    activeTab === 'subscription-plan-features'
                      ? 'Subscription Architecture'
                      : 'Platform Architecture'}
                  </span>
                  <span className="text-[#d51f2c]">›</span>
                  <span className="text-[#1d1c17]">
                    {activeTab === 'subscription-plan-applications'
                      ? 'Plan Applications'
                      : activeTab === 'subscription-plan-features'
                        ? 'Plan Features'
                        : activeTab === 'subscription-applications'
                          ? 'Applications'
                          : activeTab === 'subscription-live-installs'
                            ? 'Live Installs'
                            : 'Feature Catalog'}
                  </span>
                </nav>
              )}
              <h1 className="font-sans text-h1 text-[#222222] uppercase tracking-tighter">
                Platform SaaS <span className="text-[#d51f2c]">/</span>{' '}
                {activeTab === 'dashboard' ? 'Overview'
                  : activeTab === 'companies' ? 'Company Management'
                  : activeTab === 'orders-registry' ? 'Orders Registry'
                  : activeTab === 'merchant-settlements' ? 'Merchant Settlements'
                  : activeTab === 'subscription' ? 'Subscription Plans'
                  : activeTab === 'subscription-applications' ? 'Applications'
                  : activeTab === 'subscription-features' ? 'Feature Catalog'
                  : activeTab === 'subscription-payments' ? 'Payments'
                  : activeTab === 'subscription-live-installs' ? 'Live Installs'
                  : activeTab === 'subscription-plan-applications' ? 'Plan Applications'
                  : activeTab === 'subscription-plan-features' ? 'Plan Features'
                  : navHubById(activeTab)?.title ?? (SAAS_PENDING_TABS[activeTab]?.title ?? activeTab)}
              </h1>
              <p className="text-body-md text-[#666666] mt-1">
                {activeTab === 'dashboard'
                  ? 'Real-time performance metrics and merchant growth tracking.'
                  : activeTab === 'companies'
                    ? 'Global master directory of every company tenant registered on the platform.'
                  : activeTab === 'orders-registry'
                    ? 'Every order collected across all merchant restaurants, feeding the daily cash settlements.'
                  : activeTab === 'merchant-settlements'
                    ? 'Daily cash payouts: the net revenue collected from each merchant’s orders that we transfer back to them.'
                  : activeTab === 'subscription' || activeTab === 'sub-plans-core'
                    ? 'Manage subscription tiers, pricing models, and billing cadences for your platform.'
                    : activeTab === 'subscription-applications' || activeTab === 'apps-config'
                      ? 'Manage software ecosystems and applications linked to subscription plans.'
                      : activeTab === 'subscription-features' || activeTab === 'features-control'
                        ? 'Configure master feature flags and platform capability tables.'
                        : activeTab === 'subscription-payments' || activeTab === 'sub-payments-billing'
                          ? 'Track payment logs and incoming cash movements from active merchants.'
                          : activeTab === 'subscription-live-installs'
                            ? 'Monitor live merchant profiles mapped to individual applications.'
                            : activeTab === 'subscription-plan-applications' || activeTab === 'plan-apps-rules'
                              ? `Applications bundled into the "${selectedPlan?.name}" subscription tier.`
                              : activeTab === 'subscription-plan-features' || activeTab === 'plan-features-mapping'
                                ? `Feature entitlements and quantitative limits bundled into the "${selectedPlan?.name}" subscription tier.`
                                : navHubById(activeTab)?.description ??
                                  (SAAS_PENDING_TABS[activeTab]?.desc ??
                                    `Interactive visualization and management for /${activeTab}.`)}
              </p>
            </div>
            {activeTab === 'dashboard' && (
              <div className="flex gap-2">
                <button
                  onClick={() => alert('Exporting SaaS report...')}
                  className="px-4 py-2 border border-[#222222] text-[#222222] font-bold text-label-caps hover:bg-[#222222] hover:text-white transition-all flex items-center gap-2"
                >
                  <span className="material-symbols-outlined text-sm">download</span>
                  Export Report
                </button>
                <button
                  onClick={() => alert('New Merchant creation simulation')}
                  className="px-4 py-2 bg-[#d51f2c] text-white font-bold text-label-caps hover:opacity-90 transition-all flex items-center gap-2"
                >
                  <span className="material-symbols-outlined text-sm">add</span>
                  New Merchant
                </button>
              </div>
            )}
          </div>

          {/* Dynamic SPA view rendering (AC 1.1) */}
          {renderContent()}
          {activeHub ? (
            <>
              {/* The bar is `fixed`: this gap prevents it from covering the end of the view. */}
              <div aria-hidden="true" className="h-16 shrink-0" />
              <ModuleNavHubBar
                hub={activeHub}
                currentFeatureId={activeTab}
                onNavigate={(id) => setActiveTab(id)}
              />
            </>
          ) : null}
        </div>
      </main>

      {/* Contextual FAB (Only on main dashboard) */}
      {activeTab === 'dashboard' && (
        <button
          onClick={handleRefresh}
          className="fixed bottom-8 right-8 w-14 h-14 bg-[#222222] text-white rounded-full flex items-center justify-center shadow-xl hover:bg-[#d51f2c] transition-all transform hover:scale-110 active:scale-95 z-50 animate-bounce"
          title="Refresh Metrics"
        >
          <span className="material-symbols-outlined text-3xl">insights</span>
        </button>
      )}
    </div>
  );
};
export default SaaSFrame;
