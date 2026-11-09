// Central registry of ModuleCommandHub descriptors.
// Defines which applications have a hub and what 3rd-level views they bundle.
//
// Source of truth for:
//   - HeaderQuickTabs (the "Hub" button at the start of the tabs strip)
//   - NavHubBar (the back button: "← <Module> Command Hub")
//   - ModuleCommandHubView (renders the KPI header + one card per 3rd-level option)

export interface ModuleNavItem {
  featureId: string;
  label: string;
  icon: string;
  live: boolean;
  description: string;
}

export interface ModuleNavHub {
  appId: string;
  hubId: string;
  hubLabel: string;
  title: string;
  category: string;
  icon: string;
  description: string;
  items: ModuleNavItem[];
}

export const MODULE_NAV_HUBS: ModuleNavHub[] = [
  {
    appId: 'subscription-system',
    hubId: 'subscription-system-hub',
    hubLabel: 'SUBSCRIPTION SYSTEM COMMAND HUB',
    title: 'Subscription System Command Hub',
    category: 'Platform SaaS',
    icon: 'grid_view',
    description: 'Plans, the applications and features they unlock, and merchant subscriptions and payments.',
    items: [
      { featureId: 'apps-config', label: 'APPLICATIONS', icon: 'apps', live: true, description: 'Platform application catalog and configuration.' },
      { featureId: 'features-control', label: 'FEATURES', icon: 'toggle_on', live: true, description: 'Feature catalog and feature flags.' },
      { featureId: 'company-subscriptions', label: 'COMPANY SUBSCRIPTIONS', icon: 'business', live: true, description: 'Which plan each company is subscribed to and when it expires.' },
      { featureId: 'merchant-subs-link', label: 'MERCHANT SUBSCRIPTIONS', icon: 'storefront', live: true, description: 'Which plan each merchant store is subscribed to.' },
      { featureId: 'plan-apps-rules', label: 'PLAN APPLICATIONS', icon: 'widgets', live: true, description: 'Applications included in each plan.' },
      { featureId: 'plan-features-mapping', label: 'PLAN FEATURES', icon: 'checklist', live: true, description: 'Features unlocked by each plan.' },
      { featureId: 'sub-plans-core', label: 'SUBSCRIPTION PLANS', icon: 'workspace_premium', live: true, description: 'Plan tiers, pricing and billing cycles.' },
      { featureId: 'sub-apps-mapping', label: 'SUBSCRIPTION APPLICATIONS', icon: 'apps_outage', live: false, description: 'Applications active on each merchant subscription.' },
      { featureId: 'sub-payments-billing', label: 'SUBSCRIPTION PAYMENTS', icon: 'payments', live: false, description: 'Subscription invoices and payment history.' },
    ],
  },
  {
    appId: 'saas-companies',
    hubId: 'saas-companies-hub',
    hubLabel: 'GLOBAL COMPANIES COMMAND HUB',
    title: 'Global Companies Command Hub',
    category: 'Platform SaaS',
    icon: 'business',
    description: 'Platform-wide commercial company accounts, corporate tax IDs, subscription tiers, and tenant allocations.',
    items: [
      { featureId: 'companies-registry', label: 'Global Companies Directory', icon: 'domain', live: true, description: 'Manage all commercial company accounts, corporate tax IDs, subscription tiers, and tenant allocations across the platform.' },
    ],
  },
  {
    appId: 'companies',
    hubId: 'companies-hub',
    hubLabel: 'COMPANIES COMMAND HUB',
    title: 'Company Administration Command Hub',
    category: 'Merchant Portal',
    icon: 'business',
    description: 'Company corporate profile, legal identity, workspace settings, and regional configurations.',
    items: [
      { featureId: 'company-profile', label: 'Company Legal Profile', icon: 'domain', live: true, description: 'Manage company legal registration details, corporate addresses, trade names, and invoice logos.' },
      { featureId: 'company-configurations', label: 'Company Configurations', icon: 'tune', live: true, description: 'Set fiscal year calendars, base operating currencies, timezone settings, and business profile preferences.' },
    ],
  },
  {
    appId: 'saas-merchants',
    hubId: 'saas-merchants-hub',
    hubLabel: 'GLOBAL MERCHANTS COMMAND HUB',
    title: 'Global Merchants Command Hub',
    category: 'Platform SaaS',
    icon: 'storefront',
    description: 'Platform-wide registry of all provisioned merchant locations and tenant provisioning across all companies.',
    items: [
      { featureId: 'global-merchants-directory', label: 'Global Merchants Directory', icon: 'store', live: true, description: 'Global registry of all provisioned merchant locations across all company accounts on the platform.' },
      { featureId: 'merchants-provisioning', label: 'Merchants & Tenants Provisioning', icon: 'add_business', live: true, description: 'Provision new restaurant tenants, assign initial subscription quotas, and configure merchant branches.' },
    ],
  },
  {
    appId: 'merchants',
    hubId: 'merchants-hub',
    hubLabel: 'MERCHANTS COMMAND HUB',
    title: 'Merchants & Branches Command Hub',
    category: 'Merchant Portal',
    icon: 'storefront',
    description: 'Company restaurant locations, branch outlets, store profiles, and operational status.',
    items: [
      { featureId: 'merchant-directory', label: 'Company Merchants Directory', icon: 'storefront', live: true, description: 'Manage active branch outlets, physical locations, operating hours, and terminal deployments for your company.' },
    ],
  },
  {
    appId: 'saas-users',
    hubId: 'saas-users-hub',
    hubLabel: 'GLOBAL USERS COMMAND HUB',
    title: 'Global Users Command Hub',
    category: 'Platform SaaS',
    icon: 'manage_accounts',
    description: 'Platform-wide user registry, administrative access control, authentication profiles, and audit log.',
    items: [
      { featureId: 'users-auth-profiles', label: 'Global Users Directory', icon: 'badge', live: true, description: 'Platform-wide user registry, administrative access control, authentication profiles, and audit log.' },
    ],
  },
  {
    appId: 'users',
    hubId: 'users-hub',
    hubLabel: 'USERS COMMAND HUB',
    title: 'Company Users Command Hub',
    category: 'Merchant Portal',
    icon: 'manage_accounts',
    description: 'Company user accounts, role-based access control, security credentials, and branch collaborators.',
    items: [
      { featureId: 'user-management', label: 'Company Users Directory', icon: 'manage_accounts', live: true, description: 'Manage company staff users, assign granular roles and permissions, and audit security credentials.' },
    ],
  },
  {
    appId: 'hr',
    hubId: 'hr-hub',
    hubLabel: 'HR COMMAND HUB',
    title: 'HR & Staff Command Hub',
    category: 'Finance & HR',
    icon: 'badge',
    description: 'Employee records, employment contracts and attendance in one place.',
    items: [
      { featureId: 'collaborators', label: 'Staff Collaborator Directory', icon: 'badge', live: true, description: 'Manage staff master profiles, job roles, emergency contacts, wage rates, and branch assignments.' },
      { featureId: 'collaborators-contracts', label: 'Employment Contracts', icon: 'contract', live: true, description: 'Maintain legal employment agreements, contract types, probation periods, and annual renewal logs.' },
      { featureId: 'collaborators-time-entries', label: 'Collaborator Time & Attendance', icon: 'schedule', live: true, description: 'Verify staff clock-in records, manager time corrections, paid leave, and billable hours for payroll calculation.' },
    ],
  },
  {
    appId: 'dining-system',
    hubId: 'dining-system-hub',
    hubLabel: 'DINING SYSTEM COMMAND HUB',
    title: 'Dining System Command Hub',
    category: 'Restaurant Operations',
    icon: 'restaurant',
    description: 'Floor layout, tables, zones and waiter coverage for live service.',
    items: [
      { featureId: 'floor-plans', label: 'Dining Room Floor Plans', icon: 'map', live: true, description: 'Design visual dining room blueprints, seating sections, outdoor patios, bar stools, and obstacle placements.' },
      { featureId: 'table-assignments', label: 'Staff Table Assignments', icon: 'assignment_ind', live: true, description: 'Assign servers and waitstaff to specific table sections, balance guest covers, and manage shift handoffs.' },
      { featureId: 'table-zones', label: 'Dining Room Table Zones', icon: 'layers', live: true, description: 'Group tables into service sections such as Main Dining, Terrace, VIP Lounge, and Bar Counter.' },
      { featureId: 'tables', label: 'Guest Table Inventory', icon: 'table_restaurant', live: true, description: 'Configure table numbers, seating capacities, table shapes, occupancy states, and active dining tickets.' },
    ],
  },
  {
    appId: 'reservations',
    hubId: 'reservations-hub',
    hubLabel: 'RESERVATIONS COMMAND HUB',
    title: 'Reservations Command Hub',
    category: 'Restaurant Operations',
    icon: 'calendar_today',
    description: 'Bookings, guest rosters, table assignments, service notes and status audit.',
    items: [
      { featureId: 'reservation-guests', label: 'Reservation Guest Book', icon: 'group', live: true, description: 'Who is dining in each party, guest contact profiles, VIP status, visit history, and special occasions.' },
      { featureId: 'reservation-notes', label: 'Reservation Dietary & Seating Notes', icon: 'event_note', live: true, description: 'Allergy warnings, dietary restrictions, anniversaries, high chair requests, and quiet table preferences.' },
      { featureId: 'reservation-status-history', label: 'Reservation Status Audit History', icon: 'history', live: true, description: 'Complete audit log of every booking confirmation, seated time, delayed alert, cancellation, and no-show.' },
      { featureId: 'reservation-tables', label: 'Table Allocation & Seating', icon: 'table_restaurant', live: true, description: 'Assign booked parties to physical dining tables, optimize section pacing, and balance waiter covers.' },
      { featureId: 'reservations', label: 'Master Reservation Book', icon: 'calendar_today', live: true, description: 'The central booking book: calendar view, hourly capacity limits, dining slot pacing, and booking lifecycle.' },
    ],
  },
  {
    appId: 'accounts-payable',
    hubId: 'accounts-payable-hub',
    hubLabel: 'ACCOUNTS PAYABLE COMMAND HUB',
    title: 'Accounts Payable Command Hub',
    category: 'Finance & HR',
    icon: 'payments',
    description: 'Supplier invoices, credit notes, payments and how they are allocated.',
    items: [
      { featureId: 'supplier-credit-notes', label: 'Supplier Credit Notes', icon: 'request_quote', live: true, description: 'Track vendor credit memos for damaged inventory goods, short deliveries, and price adjustments.' },
      { featureId: 'supplier-invoice-items', label: 'Supplier Invoice Line Items', icon: 'list_alt', live: true, description: 'Audit itemized invoice charges, raw ingredient unit costs, price variance alerts, and warehouse receipts.' },
      { featureId: 'supplier-invoices', label: 'Supplier Invoices Directory', icon: 'receipt_long', live: true, description: 'Review and approve vendor bills, purchase order matchings, invoice line items, and payment schedules.' },
      { featureId: 'supplier-payment-items', label: 'Payment Breakdown Details', icon: 'format_list_bulleted', live: true, description: 'Detailed breakdown of settled invoice balances, discounts captured, and payment voucher line items.' },
      { featureId: 'supplier-payments', label: 'Supplier Payment Vouchers', icon: 'payments', live: true, description: 'Schedule and execute vendor payments, bank transfers, automated remittances, and cash disbursements.' },
      { featureId: 'supplier-payments-allocation', label: 'Invoice Payment Allocations', icon: 'account_tree', live: true, description: 'Match payment vouchers and available credit notes against open supplier invoices with zero balance reconciliation.' },
    ],
  },
  {
    appId: 'payrolls',
    hubId: 'payrolls-hub',
    hubLabel: 'PAYROLLS COMMAND HUB',
    title: 'Payrolls Command Hub',
    category: 'Finance & HR',
    icon: 'account_balance_wallet',
    description: 'Payroll runs, per-employee entries, tax detail and adjustments.',
    items: [
      { featureId: 'payroll-adjustments', label: 'Payroll Adjustments & Bonuses', icon: 'tune', live: false, description: 'Apply discretionary bonuses, staff advances, performance commissions, and manual deductions.' },
      { featureId: 'payroll-entries', label: 'Employee Payroll Entries', icon: 'list_alt', live: false, description: 'Inspect per-collaborator gross pay, overtime additions, tips earned, deductions, and final net pay.' },
      { featureId: 'payroll-runs', label: 'Payroll Calculation Runs', icon: 'play_circle', live: false, description: 'Open, compute, verify, and finalize periodic payroll runs for restaurant staff across all branches.' },
      { featureId: 'payroll-tax-detail', label: 'Payroll Tax Detail & Withholdings', icon: 'percent', live: false, description: 'Audit statutory income tax withholdings, social security contributions, and employer tax liabilities.' },
    ],
  },
  {
    appId: 'pos',
    hubId: 'pos-hub',
    hubLabel: 'POS COMMAND HUB',
    title: 'Point of Sale Command Hub',
    category: 'Restaurant Operations',
    icon: 'point_of_sale',
    description: 'Orders, lines, modifiers, taxes, discounts and payment settlements.',
    items: [
      { featureId: 'order-discounts', label: 'Order Discounts & Promotions', icon: 'sell', live: false, description: 'Apply promotional bill discounts, happy hour specials, VIP comps, and manager bill reductions.' },
      { featureId: 'order-items', label: 'Order Items & Course Routing', icon: 'restaurant_menu', live: false, description: 'Review items ordered per check, course fire pacing, customer seat numbers, and kitchen dispatch routing.' },
      { featureId: 'order-item-modifiers', label: 'Order Modifiers & Upcharges', icon: 'tune', live: false, description: 'Manage modifier selections, ingredient exclusions, portion upgrades, and special dining instructions.' },
      { featureId: 'order-payments', label: 'Order Payment Tenders', icon: 'credit_card', live: false, description: 'Process split tenders, EMV chip transactions, contactless digital payments, and cash receipts.' },
      { featureId: 'order-taxes', label: 'Order Taxes & Surcharges', icon: 'percent', live: false, description: 'Audit applied sales taxes, service charges, local dining fees, and tax exemption certificates per order.' },
      { featureId: 'orders', label: 'Point of Sale Orders & Bills', icon: 'receipt', live: false, description: 'Open, split, transfer, and settle customer dining checks with support for multiple payment tenders.' },
    ],
  },
  {
    appId: 'cash-drawers',
    hubId: 'cash-drawers-hub',
    hubLabel: 'CASH DRAWERS COMMAND HUB',
    title: 'Cash Drawers Command Hub',
    category: 'Restaurant Operations',
    icon: 'point_of_sale',
    description: 'Drawer sessions, cash shifts, transactions, movements and closing history.',
    items: [
      { featureId: 'cash-drawer-history', label: 'Cash Drawer History', icon: 'history', live: true, description: 'Closed cash drawer sessions, final count reconciliations, and overage/shortage discrepancies.' },
      { featureId: 'cash-drawers', label: 'Cash Drawers Directory', icon: 'point_of_sale', live: true, description: 'Open, assign, monitor, and close register drawer sessions across all terminal POS stations.' },
      { featureId: 'cash-movements', label: 'Cash Drawer Movements', icon: 'swap_vert', live: true, description: 'Record cash register openings, mid-shift drops, petty cash paid-outs, and cash float balances.' },
      { featureId: 'cash-shifts', label: 'Cashier Shift Sessions', icon: 'schedule', live: true, description: 'Track cashier shifts on each register, starting cash floats, blind drop handoffs, and shift totals.' },
      { featureId: 'cash-transactions', label: 'Cash Transaction Ledger', icon: 'receipt_long', live: true, description: 'Detailed breakdown of every recorded cash payment tender, change returned, and drawer operation.' },
    ],
  },
  {
    appId: 'delivery-management',
    hubId: 'delivery-management-hub',
    hubLabel: 'DELIVERY MANAGEMENT COMMAND HUB',
    title: 'Delivery Management Command Hub',
    category: 'Commerce',
    icon: 'local_shipping',
    description: 'Coverage zones, delivery pricing, drivers, assignments and live tracking.',
    items: [
      { featureId: 'delivery-assignments', label: 'Driver Delivery Assignments', icon: 'assignment_turned_in', live: true, description: 'Assign pending outbound delivery orders to couriers, track driver handoffs, and monitor dispatch times.' },
      { featureId: 'delivery-drivers', label: 'Delivery Courier Fleet Directory', icon: 'two_wheeler', live: true, description: 'Manage in-house drivers and third-party fleets, driver contact details, vehicle types, and shift availability.' },
      { featureId: 'delivery-fees', label: 'Delivery Fee Structure & Rates', icon: 'payments', live: true, description: 'Configure base delivery fees, per-km distance rates, minimum order spend, and free-delivery promotions.' },
      { featureId: 'delivery-tracking', label: 'Live Delivery GPS Tracking', icon: 'my_location', live: true, description: 'Track live driver positions, transit progress on interactive map, drop-off milestones, and real-time ETAs.' },
      { featureId: 'delivery-zones', label: 'Delivery Zones & Geofencing', icon: 'map', live: true, description: 'Draw delivery coverage zones on map, assign distance surcharges, minimum spend requirements, and estimated transit times.' },
    ],
  },
  {
    appId: 'shifts',
    hubId: 'shifts-hub',
    hubLabel: 'SHIFTS COMMAND HUB',
    title: 'Staff Shifts Command Hub',
    category: 'Restaurant Operations',
    icon: 'schedule',
    description: 'Shift scheduling, shift assignments, roster planning and clock-in management.',
    items: [
      { featureId: 'shift-assignment', label: 'Weekly Shift Assignment Matrix', icon: 'assignment', live: true, description: 'Interactive weekly schedule matrix, floor coverage planning, break intervals, and publication control.' },
      { featureId: 'shifts', label: 'Daily Staff Shifts Timeline', icon: 'schedule', live: true, description: 'Daily Gantt timeline view of staff station coverage, scheduled hours, active clock-ins, and shift pacing.' },
    ],
  },
  {
    appId: 'tips',
    hubId: 'tips-hub',
    hubLabel: 'TIPS COMMAND HUB',
    title: 'Tips & Gratuities Command Hub',
    category: 'Restaurant Operations',
    icon: 'payments',
    description: 'Tip pools, allocations formulas, settlement processing and cash tip movements.',
    items: [
      { featureId: 'tip-movements', label: 'Cash Tip Movements & Shifts', icon: 'swap_vert', live: true, description: 'Cash tip movements, in-and-out history, drawer safe transfers, and cashier shift logs.' },
      { featureId: 'tip-pool-members', label: 'Tip Pool Member Eligibility', icon: 'group', live: true, description: 'Designate front-of-house and back-of-house staff eligible to participate in specific gratuity pools.' },
      { featureId: 'tip-settlements', label: 'Tip Payout Settlements', icon: 'receipt_long', live: true, description: 'Approve and settle tip distributions to payroll or direct cash disbursements with complete audit history.' },
      { featureId: 'tips', label: 'Gratuity & Tips Ledger', icon: 'payments', live: true, description: 'Track all credit card, online order, and digital gratuities collected across POS checkout terminals.' },
      { featureId: 'tips-allocations', label: 'Staff Tip Allocations Matrix', icon: 'calculate', live: true, description: 'Calculate shift gratuity shares per employee based on hours worked, role weightings, and pool guidelines.' },
      { featureId: 'tips-pools', label: 'Tip Pooling Configurations', icon: 'pool', live: true, description: 'Configure automated tip pool distribution models, hours-worked ratios, points systems, and role allocations.' },
    ],
  },
  {
    appId: 'configuration',
    hubId: 'configuration-hub',
    hubLabel: 'CONFIGURATION COMMAND HUB',
    title: 'Configuration Command Hub',
    category: 'CORE',
    icon: 'settings_applications',
    description: 'Merchant overtime rules, payroll rules, tax rules and tip distribution rules.',
    items: [
      { featureId: 'merchant-overtime-rules', label: 'Overtime Calculation Rules', icon: 'more_time', live: true, description: 'Establish statutory overtime multiplier rates, daily rest thresholds, and weekend premium calculations.' },
      { featureId: 'merchant-payroll-rules', label: 'Payroll Processing Rules', icon: 'payments', live: true, description: 'Configure bi-weekly or monthly pay cycles, standard pay dates, and automated direct deposit rules.' },
      { featureId: 'merchant-tax-rules', label: 'Merchant Tax Rules Matrix', icon: 'percent', live: true, description: 'Configure state and local sales tax percentages, item tax exemptions, and takeout food tax rules.' },
      { featureId: 'merchant-tips-rules', label: 'Gratuity & Tip Calculation Rules', icon: 'request_quote', live: true, description: 'Configure suggested gratuity percentages printed on guest receipts, card prompt defaults, and auto-gratuity.' },
    ],
  },
  {
    appId: 'billing-transactions',
    hubId: 'billing-transactions-hub',
    hubLabel: 'BILLING & TRANSACTIONS COMMAND HUB',
    title: 'Billing & Transactions Command Hub',
    category: 'CORE',
    icon: 'receipt_long',
    description: 'Receipts issued, their line items and the taxes they carry.',
    items: [
      { featureId: 'receipt-items', label: 'Itemized Receipt Line Items', icon: 'list', live: false, description: 'Inspect itemized charges printed on each customer sales receipt, applied item discounts, seat numbers, and quantity breakdowns.' },
      { featureId: 'receipt-orders', label: 'Customer Sales Receipts', icon: 'receipt_long', live: false, description: 'Archive of issued customer sales receipts, POS register terminals, settlement tenders, customer copies, and fiscal audit logs.' },
      { featureId: 'receipt-taxes', label: 'Receipt Tax Line Breakdown', icon: 'percent', live: false, description: 'Detailed breakdown of sales tax brackets, VAT rates, local municipal surcharges, and tax-exempt balances allocated per receipt.' },
    ],
  },
  {
    appId: 'financial-engine',
    hubId: 'financial-engine-hub',
    hubLabel: 'FINANCIAL ENGINE COMMAND HUB',
    title: 'Financial Engine Command Hub',
    category: 'CORE',
    icon: 'account_balance',
    description: 'Double-entry journal and the chart of ledger accounts.',
    items: [
      { featureId: 'journal-entries', label: 'General Journal Entries', icon: 'menu_book', live: true, description: 'Create and review posted financial journal entries, transaction dates, source modules, and balanced debits/credits.' },
      { featureId: 'journal-entries-lines', label: 'Journal Entry Line Details', icon: 'segment', live: true, description: 'Granular debit and credit line breakdown with accounts, memo descriptions, currencies, and cost centers.' },
      { featureId: 'ledger-accounts', label: 'Chart of Accounts & Ledger', icon: 'account_balance', live: true, description: 'Configure assets, liabilities, equity, revenues, and expense accounts with real-time financial balances.' },
    ],
  },
  {
    appId: 'business-partners',
    hubId: 'business-partners-hub',
    hubLabel: 'BUSINESS PARTNERS COMMAND HUB',
    title: 'Business Partners Command Hub',
    category: 'CORE',
    icon: 'handshake',
    description: 'Customer and supplier master data.',
    items: [
      { featureId: 'customers', label: 'CUSTOMERS', icon: 'person', live: true, description: 'Customer profiles and billing identity.' },
      { featureId: 'suppliers', label: 'SUPPLIERS', icon: 'local_shipping', live: true, description: 'Supplier directory and terms.' },
    ],
  },
  {
    appId: 'qr-code',
    hubId: 'qr-code-hub',
    hubLabel: 'QR CODE SYSTEM COMMAND HUB',
    title: 'QR Code Ordering Command Hub',
    category: 'Commerce',
    icon: 'qr_code',
    description: 'Locations, menus, sections, items and table-side orders.',
    items: [
      { featureId: 'qr-code-locations', label: 'QR Code Access Points', icon: 'location_on', live: true, description: 'Manage physical table QR placements, counter signs, patio stations, and location-specific menu linkages.' },
      { featureId: 'qr-code-menus', label: 'QR Digital Menu Catalog', icon: 'restaurant_menu', live: true, description: 'Deploy mobile-optimized digital menus, customize theme branding, and control dine-in guest ordering permissions.' },
      { featureId: 'qr-code-menu-sections', label: 'QR Menu Sections & Categories', icon: 'category', live: true, description: 'Organize digital menu sections, appetizers, chef specials, beverages, and display order for mobile guests.' },
      { featureId: 'qr-code-menu-items', label: 'QR Menu Items & Dish Catalog', icon: 'fastfood', live: true, description: 'Manage dish photos, descriptions, dietary labels, modifier options, and live item availability for mobile users.' },
      { featureId: 'qr-code-orders', label: 'QR Table Orders Queue', icon: 'receipt', live: true, description: 'Track live food and drink orders submitted directly by guests from their table QR codes with instant POS routing.' },
      { featureId: 'qr-order-items', label: 'QR Order Line Items', icon: 'list_alt', live: true, description: 'Inspect itemized dish breakdown, customer special instructions, seat assignments, and modifier selections.' },
    ],
  },
  {
    appId: 'online-ordering',
    hubId: 'online-ordering-hub',
    hubLabel: 'ONLINE ORDERING COMMAND HUB',
    title: 'Online Ordering Command Hub',
    category: 'Commerce',
    icon: 'storefront',
    description: 'Stores, digital menus, catalog categories, items and inbound orders queue.',
    items: [
      { featureId: 'online-stores', label: 'Online Stores Directory', icon: 'storefront', live: true, description: 'Manage multi-storefront digital channels, subdomains, color themes, currencies, and operational statuses.' },
      { featureId: 'online-menus', label: 'Digital Store Menus', icon: 'restaurant_menu', live: true, description: 'Create and publish specialized digital menus, meal schedules, seasonal offerings, and channel-specific menus.' },
      { featureId: 'online-menu-categories', label: 'Store Menu Categories', icon: 'category', live: true, description: 'Structure digital menu sections, item families, display sorting order, and customer-facing browse categories.' },
      { featureId: 'online-menu-items', label: 'Online Store Catalog Items', icon: 'lunch_dining', live: true, description: 'Synchronize saleable catalog dishes with online storefronts, including digital photos, tags, and modifier sets.' },
      { featureId: 'online-orders', label: 'Online Orders Dispatch Queue', icon: 'shopping_bag', live: true, description: 'Track live incoming web and delivery orders, customer details, acceptance workflows, and fulfillment dispatch.' },
      { featureId: 'online-payments', label: 'Digital Payments Gateway', icon: 'payments', live: false, description: 'Configure online payment gateways, Stripe, card acquiring providers, and digital checkout tender rules.' },
      { featureId: 'online-order-items', label: 'Itemized Order Details', icon: 'receipt_long', live: false, description: 'Detailed breakdown of customer shopping carts, special cooking instructions, modifier choices, and price lines.' },
      { featureId: 'online-delivery-info', label: 'Delivery Logistics & Coverage', icon: 'local_shipping', live: false, description: 'Configure delivery radiuses, polygon coverage zones, distance-based courier fees, minimum orders, and dispatch times.' },
    ],
  },
  {
    appId: 'kitchen-display-system',
    hubId: 'kitchen-display-system-hub',
    hubLabel: 'KITCHEN DISPLAY SYSTEM HUB',
    title: 'Kitchen Display System Command Hub',
    category: 'Restaurant Operations',
    icon: 'soup_kitchen',
    description: 'Centralized management hub for kitchen station profiles, hardware terminals, live prep queues, event logging, and preparation metrics.',
    items: [
      { featureId: 'kitchen-stations', label: 'Kitchen Display Stations', icon: 'soup_kitchen', live: true, description: 'Configure line prep monitors, display modes, printer bindings, routing channels, and ticket sequencing for kitchen staff.' },
      { featureId: 'kitchen-display-devices', label: 'Kitchen Display Devices', icon: 'desktop_windows', live: true, description: 'Register kitchen terminals, monitor hardware heartbeats, assign screen profiles, and pair physical bump bars.' },
      { featureId: 'kitchen-orders', label: 'Kitchen Orders & Tickets', icon: 'restaurant', live: true, description: 'Monitor active food preparation tickets, course pacing, priority orders, and pass window delivery status.' },
      { featureId: 'kitchen-order-items', label: 'Kitchen Order Items Tracking', icon: 'format_list_bulleted', live: true, description: 'Track granular dish preparation progress, recipe modifiers, allergen alerts, and station rerouting in real-time.' },
      { featureId: 'kitchen-event-log', label: 'Kitchen System Event Log', icon: 'history', live: true, description: 'Inspect ticket bump history, recall actions, station latency logs, and staff operational audit events.' },
      { featureId: 'kitchen-performance', label: 'Kitchen Performance Analytics', icon: 'speed', live: true, description: 'Analyze station preparation times, peak bottleneck trends, fulfillment times, and SLA throughput metrics.' },
    ],
  },
  {
    appId: 'food-costing',
    hubId: 'food-costing-hub',
    hubLabel: 'FOOD COSTING COMMAND HUB',
    title: 'Food Costing Command Hub',
    category: 'Inventory & Supplies',
    icon: 'calculate',
    description: 'Food cost variance, theoretical costs, recipe engineering, and bill of materials yield tracking.',
    items: [
      { featureId: 'actual-cost-variance', label: 'Actual Cost Variance Analysis', icon: 'trending_down', live: false, description: 'Audit discrepancies between standard theoretical recipe consumption and physical inventory usage.' },
      { featureId: 'recipes', label: 'Production Formulas & Recipes', icon: 'menu_book', live: true, description: 'Review production formulas, link raw ingredients to finished products, and audit theoretical food costs.' },
      { featureId: 'recipe-ingredients', label: 'Recipe Ingredients & Portions', icon: 'egg', live: false, description: 'Manage portion quantities, units of measure, yields, wastage allowances, and ingredient costs per recipe.' },
      { featureId: 'theoretical-cost', label: 'Theoretical Cost Benchmarks', icon: 'calculate', live: false, description: 'Calculate target cost percentages, gross margin benchmarks, and menu profitability suggestions.' },
    ],
  },
  {
    appId: 'loyalty-system',
    hubId: 'loyalty-system-hub',
    hubLabel: 'LOYALTY SYSTEM COMMAND HUB',
    title: 'Loyalty Program Command Hub',
    category: 'Growth',
    icon: 'card_membership',
    description: 'Customer loyalty rewards, membership tiers, point balances, promotional coupons, and engagement incentives.',
    items: [
      { featureId: 'loyalty-customers', label: 'Loyalty Customer Accounts', icon: 'loyalty', live: false, description: 'Manage registered loyalty members, accumulated reward balances, contact details, and customer engagement history.' },
      { featureId: 'loyalty-coupons', label: 'Loyalty Promotional Coupons', icon: 'confirmation_number', live: false, description: 'Create and issue promotional coupons, percentage discounts, minimum spend thresholds, and redemption expiry rules.' },
      { featureId: 'loyalty-point-transactions', label: 'Loyalty Points Ledger', icon: 'toll', live: false, description: 'Audit granular points earned from checkout purchases, manual point adjustments, expiry logs, and redemption transactions.' },
      { featureId: 'loyalty-programs', label: 'Loyalty Program Rules', icon: 'card_membership', live: false, description: 'Configure loyalty point accumulation policies, spend-to-point ratios, bonus campaigns, and partner program rules.' },
      { featureId: 'loyalty-rewards', label: 'Redeemable Loyalty Rewards', icon: 'redeem', live: false, description: 'Manage the catalog of redeemable items, free dishes, store merchandise, and point redemption conversion rates.' },
      { featureId: 'loyalty-rewards-redemptions', label: 'Reward Redemptions History', icon: 'savings', live: false, description: 'Track claimed customer rewards, POS voucher validations, cashier approvals, and redemption fulfillment logs.' },
      { featureId: 'loyalty-tiers', label: 'Customer VIP Membership Tiers', icon: 'workspace_premium', live: false, description: 'Establish progressive membership tier thresholds, exclusive dining perks, tier multipliers, and annual retention rules.' },
    ],
  },
  {
    appId: 'marketing-system',
    hubId: 'marketing-system-hub',
    hubLabel: 'MARKETING SYSTEM COMMAND HUB',
    title: 'Marketing System Command Hub',
    category: 'Growth',
    icon: 'campaign',
    description: 'Omnichannel campaigns, automated drip workflows, audience segmentation cohorts, and promotional coupons.',
    items: [
      { featureId: 'marketing-campaign', label: 'Omnichannel Marketing Campaigns', icon: 'campaign', live: false, description: 'Design and broadcast promotional email, SMS, and push notification campaigns with conversion tracking.' },
      { featureId: 'marketing-automation', label: 'Automated Marketing Workflows', icon: 'smart_toy', live: false, description: 'Automate customer re-engagement journeys, welcome onboarding sequences, and post-dining review requests.' },
      { featureId: 'marketing-automation-action', label: 'Marketing Automation Actions', icon: 'play_arrow', live: false, description: 'Configure automated message dispatches, coupon distribution webhooks, customer tagging, and webhook notifications.' },
      { featureId: 'marketing-campaign-audience', label: 'Target Campaign Audiences', icon: 'groups', live: false, description: 'Filter customer recipient pools by dining frequency, average check size, preferred categories, and channel preferences.' },
      { featureId: 'marketing-coupon', label: 'Promotional Marketing Coupons', icon: 'confirmation_number', live: false, description: 'Generate campaign promo codes, first-time diner incentives, limited-time holiday offers, and tracking tags.' },
      { featureId: 'marketing-coupon-redemption', label: 'Marketing Coupon Redemptions', icon: 'redeem', live: false, description: 'Analyze redeemed promotional offers, revenue generated per coupon campaign, and average ticket lift.' },
      { featureId: 'marketing-message-log', label: 'Marketing Message Dispatch Log', icon: 'forum', live: false, description: 'Inspect SMS gateway responses, email deliverability rates, customer unsubscribes, and message error logs.' },
      { featureId: 'marketing-segment', label: 'Customer Segmentation Directory', icon: 'pie_chart', live: false, description: 'Build dynamic customer cohorts such as VIP diners, lunch regulars, lapsed guests, and high-frequency patrons.' },
      { featureId: 'marketing-segment-rule', label: 'Segmentation Logic & Criteria', icon: 'rule', live: false, description: 'Define granular rule conditions including last visit recency, lifetime spend thresholds, and dietary preferences.' },
    ],
  },
  {
    appId: 'table-turnover',
    hubId: 'table-turnover-hub',
    hubLabel: 'TABLE TURNOVER OPTIMIZATION HUB',
    title: 'Table Turnover Command Hub',
    category: 'Restaurant Operations',
    icon: 'sync_alt',
    description: 'Dining duration velocity, course pacing bottleneck alerts, meal cycle analytics, and table turnover benchmarking.',
    items: [
      { featureId: 'table-turnover-analytics', label: 'Table Turnover Analytics', icon: 'timeline', live: false, description: 'Analyze average dining times per party size, seat occupancy cycles, and table turnover velocity.' },
      { featureId: 'course-timing-alerts', label: 'Course Timing & Alert Pacing', icon: 'alarm', live: false, description: 'Set target duration thresholds for ordering, appetizers, entrees, desserts, and bill settlement.' },
      { featureId: 'turnover-benchmarks', label: 'Service Turnover Benchmarks', icon: 'speed', live: false, description: 'Benchmark meal duration goals by shift and server performance to optimize table availability.' },
    ],
  },
];

const HUB_BY_FEATURE = new Map<string, ModuleNavHub>();
for (const hub of MODULE_NAV_HUBS) {
  for (const item of hub.items) HUB_BY_FEATURE.set(item.featureId, hub);
}

let dynamicHubs: ModuleNavHub[] = [];
const DYNAMIC_HUB_BY_FEATURE = new Map<string, ModuleNavHub>();
const DYNAMIC_HUB_BY_ID = new Map<string, ModuleNavHub>();

let authorizedFeatureCodes: Set<string> | null = null;
const authorizedFeatureListeners = new Set<() => void>();

/**
 * Updates the active set of authorized feature codes for the current session / user preview.
 * Pass null to allow all features without filtering.
 */
export function setAuthorizedFeatures(codes: Iterable<string> | null): void {
  authorizedFeatureCodes = codes ? new Set(codes) : null;
  for (const listener of authorizedFeatureListeners) {
    listener();
  }
}

/**
 * Subscribes a listener to changes in authorized feature codes.
 */
export function subscribeAuthorizedFeatures(listener: () => void): () => void {
  authorizedFeatureListeners.add(listener);
  return () => {
    authorizedFeatureListeners.delete(listener);
  };
}

/**
 * Checks whether a given feature code is authorized in the current navigation tree.
 * Non-navigation action IDs (not present in any static or dynamic hub) are allowed by default.
 */
export function isFeatureAuthorized(featureId?: string | null): boolean {
  if (!featureId || !authorizedFeatureCodes) return true;
  if (authorizedFeatureCodes.has(featureId)) return true;
  const isKnownNavFeature =
    HUB_BY_FEATURE.has(featureId) || DYNAMIC_HUB_BY_FEATURE.has(featureId);
  if (!isKnownNavFeature) return true;
  return false;
}

function filterHubItems(hub: ModuleNavHub | null): ModuleNavHub | null {
  if (!hub) return null;
  if (!authorizedFeatureCodes) return hub;
  const filteredItems = hub.items.filter((item) =>
    isFeatureAuthorized(item.featureId),
  );
  return {
    ...hub,
    items: filteredItems.length > 0 ? filteredItems : hub.items,
  };
}

/**
 * Registers dynamic command hubs generated from the navigation catalog (GET /api/me/navigation).
 */
export function registerDynamicNavHubs(hubs: ModuleNavHub[]): void {
  const byHubId = new Map<string, ModuleNavHub>();
  for (const existing of dynamicHubs) {
    byHubId.set(existing.hubId, existing);
  }
  for (const incoming of hubs) {
    byHubId.set(incoming.hubId, incoming);
  }
  dynamicHubs = Array.from(byHubId.values());
  DYNAMIC_HUB_BY_FEATURE.clear();
  DYNAMIC_HUB_BY_ID.clear();
  for (const hub of dynamicHubs) {
    // Only register dynamic hubs if not already declared in static MODULE_NAV_HUBS
    const isStatic = MODULE_NAV_HUBS.some((s) => s.hubId === hub.hubId || s.appId === hub.appId);
    if (!isStatic) {
      DYNAMIC_HUB_BY_ID.set(hub.hubId, hub);
      if (!hub.items.some((item) => item.featureId === hub.appId)) {
        DYNAMIC_HUB_BY_ID.set(hub.appId, hub);
      }
      for (const item of hub.items) {
        DYNAMIC_HUB_BY_FEATURE.set(item.featureId, hub);
      }
    }
  }
    }

/** Returns the active dynamic command hubs list. */
export function getDynamicNavHubs(): ModuleNavHub[] {
  return dynamicHubs;
}

/** Module to which a featureId belongs (to mount its bar), or null. */
export const navHubForFeature = (featureId: string): ModuleNavHub | null =>
  filterHubItems(
    HUB_BY_FEATURE.get(featureId) ?? DYNAMIC_HUB_BY_FEATURE.get(featureId) ?? null,
  );

/** Module whose Command Hub is this synthetic featureId (`<appId>-hub`), or null. */
export const navHubById = (hubId: string): ModuleNavHub | null => {
  const staticByHubId = MODULE_NAV_HUBS.find((hub) => hub.hubId === hubId);
  if (staticByHubId) return filterHubItems(staticByHubId);

  const staticByAppId = MODULE_NAV_HUBS.find((hub) => hub.appId === hubId);
  if (staticByAppId && !staticByAppId.items.some((item) => item.featureId === hubId)) {
    return filterHubItems(staticByAppId);
  }

  const dynamic = DYNAMIC_HUB_BY_ID.get(hubId);
  if (dynamic) return filterHubItems(dynamic);

  return null;
};
