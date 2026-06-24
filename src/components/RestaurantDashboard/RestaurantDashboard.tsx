import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  restaurantService,
  setSimulate401,
  getSimulate401,
  setSimulationPlanId,
  setSimulationRole,
  setAuthenticatedState
} from '../../services/restaurantService';
import type {
  UserProfile,
  SystemNotification
} from '../../services/restaurantService';
import { navigationService } from '../../services/navigationService';
import type {
  NavCategory
} from '../../services/navigationService';
import { GlobalHeader } from './GlobalHeader';
import { GlobalFooter } from './GlobalFooter';
import { SalesMetricCard } from './SalesMetricCard';
import { TablesOccupancyCard } from './TablesOccupancyCard';
import { KitchenPerformanceCard } from './KitchenPerformanceCard';
import { TopSellingItems } from './TopSellingItems';
import { CurrentShifts } from './CurrentShifts';
import { KitchenMonitorView } from './KitchenMonitorView';
import {
  NewReservationModal,
  VoidTransactionModal,
  EODReportModal,
  EmergencySupportModal,
  NewQuickOrderModal,
  LoginGatewayModal
} from './QuickActionModals';
import { SaasOverviewContent } from '../SaaSDashboard/SaasOverviewContent';
import { setSimulateApiFailure, getSimulateApiFailure } from '../../services/saasService';

import { ProductCategoriesView } from './ProductCategoriesView';
import { ProductsDirectoryView } from './ProductsDirectoryView';
import { clearAuthSession } from '../../lib/auth-storage';

export const RestaurantDashboard: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  // Estados de carga e inicialización de sesión
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isAuthLocked, setIsAuthLocked] = useState<boolean>(false);
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);

  // Estados de navegación SPA
  const [activeCategory, setActiveCategory] = useState<string>('saas'); // Categoria activa
  const [activeTab, setActiveTab] = useState<string>('saas-dashboard'); // Sub-item o vista activa

  // Sincronizar ruta de navegador física con el estado de navegación interna SPA
  useEffect(() => {
    const path = location.pathname;
    if (path === '/legal/privacy-policy') {
      setActiveCategory('legal');
      setActiveTab('privacy-policy');
    } else if (path === '/legal/terms-of-service') {
      setActiveCategory('legal');
      setActiveTab('terms-of-service');
    } else if (path === '/support/help-center') {
      setActiveCategory('support');
      setActiveTab('help-center');
    } else if (path === '/dashboard/products') {
      setActiveCategory('inventory');
      setActiveTab('products');
    } else if (path === '/dashboard/categories') {
      setActiveCategory('inventory');
      setActiveTab('categories');
    } else if (path === '/dashboard') {
      const stateTab = location.state?.activeTab;
      const stateCategory = location.state?.activeCategory;
      if (stateTab && stateCategory) {
        setActiveCategory(stateCategory);
        setActiveTab(stateTab);
      } else {
        if (profile) {
          if (profile.role === 'SaaS Owner') {
            setActiveCategory('saas');
            setActiveTab('saas-dashboard');
          } else {
            setActiveCategory('core');
            setActiveTab('dashboard');
          }
        }
      }
    }
  }, [location.pathname, profile?.role]);
  const [showKitchenKDS, setShowKitchenKDS] = useState<boolean>(false);

  // Navegación Dinámica por Plan y Permisos
  const [navCategories, setNavCategories] = useState<NavCategory[]>([]);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [expandedApps, setExpandedApps] = useState<Record<string, boolean>>({});

  const loadNavigation = async (userProfile: UserProfile) => {
    try {
      const menu = await navigationService.loadAndParseNavigation(userProfile.Plan_id, userProfile.role);
      setNavCategories(menu);
    } catch (err) {
      console.error('Error cargando el menú dinámico', err);
    }
  };

  useEffect(() => {
    if (profile) {
      loadNavigation(profile);
    }
  }, [profile, refreshTrigger]);

  // Auto-expandir la categoría y aplicación activas si corresponden al tab activo
  useEffect(() => {
    if (profile?.role === 'SaaS Owner') {
      return;
    }
    if (navCategories.length > 0 && activeTab) {
      navCategories.forEach(cat => {
        cat.applications.forEach(app => {
          const hasFeat = app.features.some(f => f.id === activeTab);
          if (hasFeat) {
            setExpandedCategories(prev => ({ ...prev, [cat.id]: true }));
            setExpandedApps(prev => ({ ...prev, [app.id]: true }));
            setActiveCategory(cat.id);
          }
        });
      });
    }
  }, [activeTab, navCategories, profile?.role]);

  // Estados de UI
  const [showNotifications, setShowNotifications] = useState<boolean>(false);
  const [notifications, setNotifications] = useState<SystemNotification[]>([]);
  const [demo401Toggle, setDemo401Toggle] = useState<boolean>(getSimulate401());
  const [showDemoPanel, setShowDemoPanel] = useState<boolean>(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);

  const [apiFailedToggle, setApiFailedToggle] = useState<boolean>(getSimulateApiFailure());

  // Estados de Modales
  const [isReservationOpen, setIsReservationOpen] = useState<boolean>(false);
  const [isVoidOpen, setIsVoidOpen] = useState<boolean>(false);
  const [isEODOpen, setIsEODOpen] = useState<boolean>(false);
  const [isSupportOpen, setIsSupportOpen] = useState<boolean>(false);
  const [isQuickOrderOpen, setIsQuickOrderOpen] = useState<boolean>(false);

  // 1. Inicialización y chequeo de sesión (AC 1.1 y 1.2)
  const hydrateSession = async () => {
    try {
      setIsAuthLocked(false);
      setAuthenticatedState(true);
      const userProfile = await restaurantService.getUserProfile();
      setProfile(userProfile);
      await restaurantService.getEstablishmentTier();

      // Auto-inicializar vistas según el rol si no están inicializadas o son incompatibles
      if (userProfile.role === 'SaaS Owner') {
        setActiveCategory('saas');
        setActiveTab('saas-dashboard');
      } else {
        // Para Merchant User, si estaba en saas, cambiar a core/dashboard
        const isSaaSTab = [
          'saas-dashboard',
          'subscription',
          'companies',
          'merchants',
          'users',
          'reports'
        ].includes(activeTab);

        if (activeCategory === 'saas' || isSaaSTab) {
          setActiveCategory('core');
          setActiveTab('dashboard');
        }
      }
    } catch (err: any) {
      if (err.status === 401) {
        setIsAuthLocked(true); // AC 1.3: Bloqueo de sesión
      } else {
        console.error('Error durante la hidratación de sesión', err);
      }
    }
  };

  useEffect(() => {
    hydrateSession();
  }, [refreshTrigger]);

  // Cargar notificaciones (AC 5.1)
  const fetchNotifications = async () => {
    try {
      const data = await restaurantService.getNotifications();
      setNotifications(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (!isAuthLocked) {
      fetchNotifications();
    }
  }, [isAuthLocked, refreshTrigger]);



  // Activar clases dinámicas de layout en el root y body según la pestaña activa
  useEffect(() => {
    const rootEl = document.getElementById('root');
    const bodyEl = document.body;
    const isSaaSTab = [
      'saas-dashboard',
      'subscription',
      'companies',
      'merchants',
      'users',
      'reports'
    ].includes(activeTab);

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
  }, [activeTab]);

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
    } catch (err) {
      console.error(err);
    }
  };

  if (showKitchenKDS) {
    return <KitchenMonitorView onBackToDashboard={() => setShowKitchenKDS(false)} />;
  }

  // Renderizado dinámico de vistas SPA (AC 4.2)
  const renderSPAView = () => {
    if (activeTab === 'privacy-policy' || activeTab === 'terms-of-service' || activeTab === 'help-center') {
      let title = 'Feature';
      let route = '/provisional-stub';
      if (activeTab === 'privacy-policy') {
        title = 'Privacy Policy';
        route = '/legal/privacy-policy';
      } else if (activeTab === 'terms-of-service') {
        title = 'Terms of Service';
        route = '/legal/terms-of-service';
      } else if (activeTab === 'help-center') {
        title = 'Help Center';
        route = '/support/help-center';
      }

      return (
        <div className="bg-white border border-[#e8e2d8] p-12 text-center rounded shadow-sm text-left max-w-4xl mx-auto my-8">
          <div className="flex items-center gap-4 border-b border-[#e8e2d8] pb-6 mb-6">
            <span className="material-symbols-outlined text-primary text-5xl">
              {activeTab === 'help-center' ? 'help' : 'gavel'}
            </span>
            <div>
              <h2 className="text-h2 font-black text-[#222222] uppercase leading-none">
                {title}
              </h2>
              <p className="text-[11px] text-secondary font-bold uppercase tracking-wider mt-1.5">
                Provisional SPA Route: <span className="text-primary">{route}</span>
              </p>
            </div>
          </div>
          
          <div className="p-6 bg-[#f1ece4] border border-[#e8e2d8] rounded mb-6 text-left">
            <p className="font-bold text-primary text-sm uppercase tracking-wider mb-2">Feature Coming Soon</p>
            <p className="text-body-md text-[#5f5e5e] leading-relaxed">
              Esta sección está bajo desarrollo activo por el equipo de ingeniería legal y de operaciones de <strong>X7 Point of Sale</strong>.
              En una futura actualización, este espacio mostrará la documentación oficial de cumplimiento regulatorio y los términos vigentes.
            </p>
          </div>
          
          <div className="flex justify-end">
            <button
              onClick={() => {
                navigate('/dashboard');
              }}
              className="px-6 py-2.5 bg-[#222222] text-white font-bold text-xs uppercase tracking-wider hover:bg-primary transition-all rounded shadow-md"
            >
              Volver al Dashboard
            </button>
          </div>
        </div>
      );
    }

    if (activeTab === 'saas-dashboard') {
      return (
        <div className="space-y-8 animate-fade-in text-left">
          {/* Header del Dashboard de SaaS en el Canvas central */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
            <div>
              <h1 className="font-sans text-h1 text-[#222222] uppercase tracking-tighter">
                Platform SaaS <span className="text-[#d51f2c]">/</span> Overview
              </h1>
              <p className="text-body-md text-[#666666] mt-1">
                Real-time performance metrics and merchant growth tracking.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => alert('Exporting SaaS report...')}
                className="px-4 py-2 border border-[#222222] text-[#222222] font-bold text-label-caps hover:bg-[#222222] hover:text-white transition-all flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-sm">download</span>
                Export Report
              </button>
              <button
                onClick={() => alert('New Merchant simulation')}
                className="px-4 py-2 bg-[#d51f2c] text-white font-bold text-label-caps hover:opacity-90 transition-all flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-sm">add</span>
                New Merchant
              </button>
            </div>
          </div>

          <SaasOverviewContent
            refreshTrigger={refreshTrigger}
            onNavigateToView={(view) => setActiveTab(view)}
          />
        </div>
      );
    }

    if (activeTab === 'categories') {
      return <ProductCategoriesView />;
    }

    if (activeTab === 'products') {
      return <ProductsDirectoryView />;
    }

    if (activeTab !== 'dashboard') {
      return (
        <div className="bg-white border border-[#e8e2d8] p-12 text-center rounded shadow-sm">
          <span className="material-symbols-outlined text-[#d51f2c] text-6xl">
            {activeTab === 'subscription' && 'loyalty'}
            {activeTab === 'companies' && 'corporate_fare'}
            {activeTab === 'merchants' && 'store'}
            {activeTab === 'users' && 'group'}
            {activeTab === 'reports' && 'description'}
            {activeTab === 'core' && 'settings_applications'}
            {activeTab === 'finance' && 'payments'}
            {activeTab === 'inventory' && 'inventory_2'}
            {activeTab === 'commerce' && 'storefront'}
            {activeTab === 'growth' && 'trending_up'}
          </span>
          <h2 className="text-h2 font-black text-[#222222] mt-4 uppercase">
            {activeTab === 'subscription' && 'Subscription System'}
            {activeTab === 'companies' && 'Companies registry'}
            {activeTab === 'merchants' && 'Merchants Registry'}
            {activeTab === 'users' && 'Users list'}
            {activeTab === 'reports' && 'System Reports'}
            {activeTab === 'core' && 'CORE Operational Module'}
            {activeTab === 'finance' && 'Finance & HR Module'}
            {activeTab === 'inventory' && 'Inventory Management'}
            {activeTab === 'commerce' && 'Commerce Operations'}
            {activeTab === 'growth' && 'Growth Platform'}
          </h2>
          <p className="text-body-md text-[#666666] mt-2 max-w-md mx-auto">
            Acceso virtual al submódulo SPA para la sección{' '}
            <strong className="text-[#d51f2c]">/{activeTab}</strong>. Navegación libre de recargas físicas.
          </p>
          <button
            onClick={() => {
              setActiveCategory('operations');
              setActiveTab('dashboard');
            }}
            className="mt-6 px-4 py-2 bg-[#222222] text-white font-bold text-label-caps hover:bg-[#d51f2c] transition-all"
          >
            Volver a Operaciones
          </button>
        </div>
      );
    }

    return (
      <div className="space-y-8">
        {/* Bento Grid Metrics */}
        <div className="grid grid-cols-12 gap-6">
          {/* Daily Sales Card */}
          <SalesMetricCard refreshTrigger={refreshTrigger} />

          {/* Ocupación de mesas y rendimiento apilados */}
          <div className="col-span-12 lg:col-span-4 grid grid-rows-2 gap-6">
            <TablesOccupancyCard refreshTrigger={refreshTrigger} />
            <KitchenPerformanceCard refreshTrigger={refreshTrigger} />
          </div>
        </div>

        {/* Dynamic Lists Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Top Selling Items */}
          <TopSellingItems refreshTrigger={refreshTrigger} />

          {/* Current Shifts */}
          <CurrentShifts refreshTrigger={refreshTrigger} />

          {/* Kitchen Insights Visual (AC 3.3) */}
          <div className="bg-white border border-[#e8e2d8] p-0 overflow-hidden relative group h-[400px]">
            <img
              className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700"
              alt="Kitchen display station screen"
              src="https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=400&h=400&fit=crop&q=80"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#222222] via-transparent to-transparent opacity-80"></div>
            <div className="absolute bottom-0 left-0 p-6 w-full text-left">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="text-white text-[10px] font-bold uppercase tracking-widest">
                  Live Kitchen Status
                </span>
              </div>
              <h4 className="text-white font-bold text-lg mb-1">Peak Hour Incoming</h4>
              <p className="text-white/70 text-body-sm">
                12 new orders in last 10 minutes. Staffing at optimal levels.
              </p>
              <button
                onClick={() => setShowKitchenKDS(true)}
                className="mt-4 w-full py-2 bg-[#d51f2c] text-white font-bold text-xs uppercase tracking-widest hover:bg-[#b01a24] transition-colors"
              >
                View Monitor
              </button>
            </div>
          </div>
        </div>

        {/* Footer Quick Actions (AC 5.2) */}
        <div className="bg-[#222222] p-8 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="text-center md:text-left">
            <h3 className="text-white font-bold text-xl">Quick Launch</h3>
            <p className="text-white/60 text-sm">Access core POS functions instantly.</p>
          </div>
          <div className="flex flex-wrap justify-center gap-4">
            <button
              onClick={() => setIsReservationOpen(true)}
              className="px-6 py-3 bg-white text-[#222222] font-bold text-xs uppercase border-b-4 border-[#d51f2c] hover:translate-y-[-2px] transition-transform duration-200"
            >
              New Reservation
            </button>
            <button
              onClick={() => setIsVoidOpen(true)}
              className="px-6 py-3 bg-white text-[#222222] font-bold text-xs uppercase border-b-4 border-[#d51f2c] hover:translate-y-[-2px] transition-transform duration-200"
            >
              Void Transaction
            </button>
            <button
              onClick={() => setIsEODOpen(true)}
              className="px-6 py-3 bg-white text-[#222222] font-bold text-xs uppercase border-b-4 border-[#d51f2c] hover:translate-y-[-2px] transition-transform duration-200"
            >
              Run EOD Report
            </button>
            <button
              onClick={() => setIsSupportOpen(true)}
              className="px-6 py-3 bg-[#d51f2c] text-white font-bold text-xs uppercase hover:bg-[#b01a24] transition-colors duration-200"
            >
              Emergency Support
            </button>
          </div>
        </div>
      </div>
    );
  };



  return (
    <div className="overflow-hidden min-h-screen relative bg-[#f1ece4]">
      {/* Sidebar Navigation */}
      <aside className={`fixed left-0 top-16 h-[calc(100vh-4rem)] w-64 bg-[#222222] border-r border-white/10 z-50 flex flex-col transition-transform duration-300 ease-in-out ${
        isSidebarCollapsed ? '-translate-x-full' : 'translate-x-0'
      }`}>
        {/* Sidebar Nav (AC 4.1) */}
        <nav className="flex-1 overflow-y-auto custom-scrollbar sidebar-scroll py-4 space-y-1 text-left">
          {profile?.role === 'SaaS Owner' ? (
            <div>
              {/* Categoría Platform SaaS */}
              <div
                onClick={() => setActiveCategory(activeCategory === 'saas' ? '' : 'saas')}
                className={`py-2.5 px-4 flex items-center gap-3 cursor-pointer transition-all duration-200 border-l-2 ${
                  activeCategory === 'saas'
                    ? 'border-[#d51f2c] bg-white/10 text-white font-semibold'
                    : 'border-transparent text-white/70 hover:text-white hover:bg-white/5'
                }`}
              >
                <span className="material-symbols-outlined text-[20px] text-[#d51f2c]">dashboard</span>
                <span className="font-sans text-[13px] tracking-tight">Platform SaaS</span>
              </div>

              {activeCategory === 'saas' && (
                <div className="mt-1 ml-10 border-l border-white/10 flex flex-col space-y-1">
                  {[
                    { id: 'saas-dashboard', label: 'Dashboard' },
                    { id: 'subscription', label: 'Subscription System' },
                    { id: 'companies', label: 'Companies registry' },
                    { id: 'merchants', label: 'Merchants Registry' },
                    { id: 'users', label: 'Users list' },
                    { id: 'reports', label: 'System Reports' },
                  ].map((sub) => {
                    const isActive = activeTab === sub.id;
                    return (
                      <div
                        key={sub.id}
                        onClick={() => {
                          setActiveCategory('saas');
                          setActiveTab(sub.id);
                          navigate('/dashboard', { state: { activeTab: sub.id, activeCategory: 'saas' } });
                        }}
                        className={`pl-4 py-1.5 text-body-sm cursor-pointer transition-all duration-200 ${
                          isActive
                            ? 'bg-white/50 text-[#222222] font-semibold border-l-2 border-[#222222] -ml-[2px]'
                            : 'text-white/60 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        {sub.label}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            navCategories.map((cat) => {
              const isCatExpanded = !!expandedCategories[cat.id];
              
              // Determinar si alguna característica dentro de esta categoría está activa
              const hasActiveTab = cat.applications.some(app => 
                app.features.some(f => f.id === activeTab)
              );
              const isCatActive = activeCategory === cat.id || hasActiveTab;

              return (
                <div key={cat.id} className="w-full text-left">
                  {/* Nivel 1: Categoría */}
                  <div
                    onClick={() => {
                      setExpandedCategories(prev => ({
                        ...prev,
                        [cat.id]: !prev[cat.id]
                      }));
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

                  {/* Nivel 2: Aplicaciones */}
                  {isCatExpanded && (
                    <div className="mt-1 flex flex-col space-y-1">
                      {cat.applications.map((app) => {
                        const isAppExpanded = !!expandedApps[app.id];
                        const isAppSelected = app.features.some(f => f.id === activeTab);

                        return (
                          <div key={app.id} className="w-full text-left">
                            <div
                              onClick={() => {
                                setExpandedApps(prev => ({
                                  ...prev,
                                  [app.id]: !prev[app.id]
                                }));
                              }}
                              className={`ml-10 py-2 px-3 text-[13px] flex items-center gap-2 cursor-pointer hover:bg-white/5 transition-colors font-sans duration-200 ${
                                isAppSelected ? 'text-[#d51f2c] font-semibold' : 'text-white/70 hover:text-white'
                              }`}
                            >
                              <span 
                                className={`w-1 h-1 rounded-full ${
                                  isAppSelected ? 'bg-[#d51f2c]' : 'bg-white/50'
                                }`}
                              ></span>
                              <span>{app.name}</span>
                            </div>

                            {/* Nivel 3: Características */}
                            {isAppExpanded && (
                              <div className="ml-14 mt-1 border-l border-white/10 space-y-1">
                                {app.features.map((feat) => {
                                  const isFeatActive = activeTab === feat.id;
                                  return (
                                    <div
                                      key={feat.id}
                                      onClick={() => {
                                        setActiveCategory(cat.id);
                                        setActiveTab(feat.id);
                                        if (feat.id === 'products') {
                                          navigate('/dashboard/products');
                                        } else if (feat.id === 'categories') {
                                          navigate('/dashboard/categories');
                                        } else {
                                          navigate('/dashboard', { state: { activeTab: feat.id, activeCategory: cat.id } });
                                        }
                                      }}
                                      className={`pl-4 py-1.5 text-body-sm cursor-pointer transition-all duration-200 ${
                                        isFeatActive
                                          ? 'bg-white/50 text-[#222222] font-semibold border-l-2 border-[#222222] -ml-[2px]'
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


        {/* Bottom items */}
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

      {/* Top Navigation Bar */}
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
        onLogoClick={() => {
          if (profile?.role === 'SaaS Owner') {
            setActiveCategory('saas');
            setActiveTab('saas-dashboard');
          } else {
            setActiveCategory('core');
            setActiveTab('dashboard');
          }
          navigate('/dashboard');
        }}
      />

      {/* Main Content Area */}
      <main className={`fixed top-16 bottom-0 right-0 overflow-y-auto bg-[#f1ece4] p-8 custom-scrollbar transition-all duration-300 ease-in-out ${
        isSidebarCollapsed ? 'left-0' : 'left-64'
      }`}>
        <div className="max-w-7xl mx-auto min-h-full flex flex-col justify-between">
          <div className="flex-grow space-y-8 pb-8">
            {renderSPAView()}
          </div>
          <GlobalFooter />
        </div>
      </main>

      {/* Floating Action Button (FAB - AC 5.3) */}
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

      {/* Modales de Acciones Rápidas */}
      <NewReservationModal isOpen={isReservationOpen} onClose={() => setIsReservationOpen(false)} />
      <VoidTransactionModal isOpen={isVoidOpen} onClose={() => setIsVoidOpen(false)} />
      <EODReportModal isOpen={isEODOpen} onClose={() => setIsEODOpen(false)} />
      <EmergencySupportModal isOpen={isSupportOpen} onClose={() => setIsSupportOpen(false)} />
      <NewQuickOrderModal isOpen={isQuickOrderOpen} onClose={() => setIsQuickOrderOpen(false)} />

      {/* Modal Bloqueante de Login Gateway por 401 Unauthorized (AC 1.3) */}
      <LoginGatewayModal isOpen={false} onLoginSuccess={handleLoginSuccess} />

      {/* Botón Flotante de Controles de Demo en la esquina inferior izquierda del canvas */}
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
              <p className="text-[9px] text-white/50 mb-2">Simula condiciones en caliente.</p>
            </div>

            {/* Simulación de Rol (Entorno) */}
            <div className="border-t border-white/10 pt-2">
              <p className="font-bold text-white uppercase text-[9px] tracking-wider mb-1">Role / Environment</p>
              <select
                value={profile?.role || 'General Manager'}
                onChange={(e) => {
                  const role = e.target.value;
                  setSimulationRole(role);
                  if (role === 'SaaS Owner') {
                    setActiveCategory('saas');
                    setActiveTab('saas-dashboard');
                  } else {
                    setActiveCategory('core');
                    setActiveTab('dashboard');
                  }
                  setRefreshTrigger(p => p + 1);
                }}
                className="w-full bg-[#111111] text-white border border-white/20 text-xs p-1 rounded focus:outline-none focus:border-[#d51f2c]"
              >
                <option value="General Manager">General Manager (Merchant)</option>
                <option value="SaaS Owner">SaaS Owner (Platform SaaS)</option>
              </select>
            </div>

            {/* Simulación de Plan (Solo para Merchant) */}
            {profile?.role !== 'SaaS Owner' && (
              <div className="border-t border-white/10 pt-2">
                <p className="font-bold text-white uppercase text-[9px] tracking-wider mb-1">Merchant Plan (Tier)</p>
                <select
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
                    setRefreshTrigger(p => p + 1);
                  }}
                  className="w-full bg-[#111111] text-white border border-white/20 text-xs p-1 rounded focus:outline-none focus:border-[#d51f2c]"
                >
                  <option value="1">Plan 1: Quick Service</option>
                  <option value="2">Plan 2: Full Restaurant</option>
                  <option value="3">Plan 3: Enterprise</option>
                </select>
              </div>
            )}

            {/* Simulación de Fallo de API en SaaS */}
            {profile?.role === 'SaaS Owner' ? (
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
                  {apiFailedToggle ? 'Simular API Online' : 'Simular Error de API'}
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
                  {demo401Toggle ? 'Simular Sesión Ok (200)' : 'Forzar Expiración (401)'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
export default RestaurantDashboard;
