// Generic Command Hub for a module: target of its NavHubBar back button.
// Uses standard StandardDashboardHub (same as KDS and Products) with standardized cards.
//
// KPIs reflect structural module metrics (workspace counts and availability),
// not synthetic business metrics: each module has its own backend and a generic hub
// does not guess unverified figures.

import React from 'react';
import {
  StandardDashboardHub,
  type DashboardKPIItem,
  type DashboardModuleItem,
  type DashboardBadgeVariant,
} from '@/shared/components/StandardDashboardHub';
import type { ModuleNavHub } from '@/platform/navigation/module-nav-hubs';

interface ModuleCommandHubViewProps {
  hub: ModuleNavHub;
  onNavigate: (featureId: string) => void;
}

interface CardMetadata {
  title: string;
  subtitle: string;
  description?: string;
  badge?: string;
  badgeVariant?: DashboardBadgeVariant;
}

const BADGE_PALETTE: DashboardBadgeVariant[] = [
  'emerald',
  'blue',
  'purple',
  'amber',
  'rose',
  'zinc',
];

const toTitleCase = (text: string): string => {
  if (!text) return '';
  if (text === text.toUpperCase()) {
    return text
      .toLowerCase()
      .split(' ')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }
  return text;
};

const KNOWN_CARD_METADATA: Record<string, CardMetadata> = {
  // ---- Growth: Loyalty System ----
  'loyalty-customers': {
    title: 'Loyalty Customer Accounts',
    subtitle: 'MEMBER PROFILES & STATUS',
    description: 'Manage registered loyalty members, accumulated reward balances, contact details, and customer engagement history.',
    badge: 'Active Members',
    badgeVariant: 'blue',
  },
  'loyalty-coupons': {
    title: 'Loyalty Promotional Coupons',
    subtitle: 'DISCOUNT CODES & VOUCHERS',
    description: 'Create and issue promotional coupons, percentage discounts, minimum spend thresholds, and redemption expiry rules.',
    badge: 'Campaign Coupons',
    badgeVariant: 'purple',
  },
  'loyalty-point-transactions': {
    title: 'Loyalty Points Ledger',
    subtitle: 'EARN & BURN AUDIT TRAIL',
    description: 'Audit granular points earned from checkout purchases, manual point adjustments, expiry logs, and redemption transactions.',
    badge: 'Points Ledger Active',
    badgeVariant: 'amber',
  },
  'loyalty-programs': {
    title: 'Loyalty Program Rules',
    subtitle: 'ACCRUAL & EARNING POLICIES',
    description: 'Configure loyalty point accumulation policies, spend-to-point ratios, bonus campaigns, and partner program rules.',
    badge: 'Program Configured',
    badgeVariant: 'emerald',
  },
  'loyalty-rewards': {
    title: 'Redeemable Loyalty Rewards',
    subtitle: 'REWARD CATALOG & REDEMPTIONS',
    description: 'Manage the catalog of redeemable items, free dishes, store merchandise, and point redemption conversion rates.',
    badge: 'Reward Catalog Live',
    badgeVariant: 'rose',
  },
  'loyalty-rewards-redemptions': {
    title: 'Reward Redemptions History',
    subtitle: 'COMPLETED REWARD CLAIMS',
    description: 'Track claimed customer rewards, POS voucher validations, cashier approvals, and redemption fulfillment logs.',
    badge: 'Fulfillment History',
    badgeVariant: 'zinc',
  },
  'loyalty-tiers': {
    title: 'Customer VIP Membership Tiers',
    subtitle: 'BRONZE, SILVER & VIP STATUS',
    description: 'Establish progressive membership tier thresholds, exclusive dining perks, tier multipliers, and annual retention rules.',
    badge: 'Tier Matrix Live',
    badgeVariant: 'emerald',
  },

  // ---- Growth: Marketing System ----
  'marketing-campaign': {
    title: 'Omnichannel Marketing Campaigns',
    subtitle: 'PROMOTIONS & MESSAGING BLASTS',
    description: 'Design and broadcast promotional email, SMS, and push notification campaigns with conversion tracking.',
    badge: 'Active Campaigns',
    badgeVariant: 'emerald',
  },
  'marketing-automation': {
    title: 'Automated Marketing Workflows',
    subtitle: 'TRIGGER LOGIC & DRIP CAMPAIGNS',
    description: 'Automate customer re-engagement journeys, welcome onboarding sequences, and post-dining review requests.',
    badge: 'Workflows Live',
    badgeVariant: 'blue',
  },
  'marketing-automation-action': {
    title: 'Marketing Automation Actions',
    subtitle: 'EXECUTION TRIGGERS & WEBHOOKS',
    description: 'Configure automated message dispatches, coupon distribution webhooks, customer tagging, and webhook notifications.',
    badge: 'Actions Pipeline',
    badgeVariant: 'purple',
  },
  'marketing-campaign-audience': {
    title: 'Target Campaign Audiences',
    subtitle: 'CUSTOMER TARGETING & REACH',
    description: 'Filter customer recipient pools by dining frequency, average check size, preferred categories, and channel preferences.',
    badge: 'Audience Segments',
    badgeVariant: 'amber',
  },
  'marketing-coupon': {
    title: 'Promotional Marketing Coupons',
    subtitle: 'PROMO CODES & SPECIAL OFFERS',
    description: 'Generate campaign promo codes, first-time diner incentives, limited-time holiday offers, and tracking tags.',
    badge: 'Promo Offers Active',
    badgeVariant: 'rose',
  },
  'marketing-coupon-redemption': {
    title: 'Marketing Coupon Redemptions',
    subtitle: 'PROMO TRACKING & ROI AUDIT',
    description: 'Analyze redeemed promotional offers, revenue generated per coupon campaign, and average ticket lift.',
    badge: 'Redemption Audit',
    badgeVariant: 'zinc',
  },
  'marketing-message-log': {
    title: 'Marketing Message Dispatch Log',
    subtitle: 'DELIVERY AUDIT & BOUNCE LOGS',
    description: 'Inspect SMS gateway responses, email deliverability rates, customer unsubscribes, and message error logs.',
    badge: 'Delivery Logs Active',
    badgeVariant: 'blue',
  },
  'marketing-segment': {
    title: 'Customer Segmentation Directory',
    subtitle: 'BEHAVIORAL & SPENDING COHORTS',
    description: 'Build dynamic customer cohorts such as VIP diners, lunch regulars, lapsed guests, and high-frequency patrons.',
    badge: 'Cohorts Segmented',
    badgeVariant: 'emerald',
  },
  'marketing-segment-rule': {
    title: 'Segmentation Logic & Criteria',
    subtitle: 'FILTER RULES & RECURRENCE',
    description: 'Define granular rule conditions including last visit recency, lifetime spend thresholds, and dietary preferences.',
    badge: 'Criteria Configured',
    badgeVariant: 'purple',
  },

  // ---- Commerce: Delivery Management ----
  'delivery-assignments': {
    title: 'Driver Delivery Assignments',
    subtitle: 'ORDER-TO-COURIER DISPATCH',
    description: 'Assign pending outbound delivery orders to couriers, track driver handoffs, and monitor dispatch times.',
    badge: 'Assignments Ready',
    badgeVariant: 'emerald',
  },
  'delivery-drivers': {
    title: 'Delivery Courier Fleet Directory',
    subtitle: 'DRIVER ROSTER & VEHICLES',
    description: 'Manage in-house drivers and third-party fleets, driver contact details, vehicle types, and shift availability.',
    badge: 'Couriers Active',
    badgeVariant: 'blue',
  },
  'delivery-fees': {
    title: 'Delivery Fee Structure & Rates',
    subtitle: 'DISTANCE PRICING & THRESHOLDS',
    description: 'Configure base delivery fees, per-km distance rates, minimum order spend, and free-delivery promotions.',
    badge: 'Fee Matrix Live',
    badgeVariant: 'purple',
  },
  'delivery-tracking': {
    title: 'Live Delivery GPS Tracking',
    subtitle: 'REAL-TIME FLEET MAP & ETA',
    description: 'Track live driver positions, transit progress on interactive map, drop-off milestones, and real-time ETAs.',
    badge: 'Live GPS Fleet',
    badgeVariant: 'amber',
  },
  'delivery-zones': {
    title: 'Delivery Zones & Geofencing',
    subtitle: 'POLYGON BOUNDARIES & SURCHARGES',
    description: 'Draw delivery coverage zones on map, assign distance surcharges, minimum spend requirements, and estimated transit times.',
    badge: 'Coverage Geofenced',
    badgeVariant: 'rose',
  },
  'delivery-orders': {
    title: 'Delivery Orders Dispatch',
    subtitle: 'LIVE DISPATCH & COURIER QUEUE',
    description: 'Monitor active outbound delivery orders, customer address mapping, prep-ready dispatches, and delivery status.',
    badge: 'Live Dispatch Active',
    badgeVariant: 'amber',
  },
  'delivery-couriers': {
    title: 'Courier & Driver Directory',
    subtitle: 'FLEET & IN-HOUSE DRIVERS',
    description: 'Manage restaurant delivery drivers, third-party fleet connections, driver contact details, and vehicle assignments.',
    badge: 'Courier Fleet',
    badgeVariant: 'blue',
  },
  'delivery-dispatch': {
    title: 'Driver Route Dispatching',
    subtitle: 'ASSIGNMENT & BATCH ROUTING',
    description: 'Assign pending orders to drivers, batch nearby drop-offs, and track estimated times of arrival in real time.',
    badge: 'Batch Routing Ready',
    badgeVariant: 'purple',
  },

  // ---- Commerce: QR Code System ----
  'qr-code-locations': {
    title: 'QR Code Access Points',
    subtitle: 'TABLE TENTS & DINE-IN PLACEMENTS',
    description: 'Manage physical table QR placements, counter signs, patio stations, and location-specific menu linkages.',
    badge: 'Placements Live',
    badgeVariant: 'emerald',
  },
  'qr-code-menus': {
    title: 'QR Digital Menu Catalog',
    subtitle: 'DIGITAL MENU ACTIVATION',
    description: 'Deploy mobile-optimized digital menus, customize theme branding, and control dine-in guest ordering permissions.',
    badge: 'Active QR Menus',
    badgeVariant: 'blue',
  },
  'qr-code-menu-sections': {
    title: 'QR Menu Sections & Categories',
    subtitle: 'STOREFRONT NAVIGATION LAYOUT',
    description: 'Organize digital menu sections, appetizers, chef specials, beverages, and display order for mobile guests.',
    badge: 'Sections Configured',
    badgeVariant: 'purple',
  },
  'qr-code-menu-items': {
    title: 'QR Menu Items & Dish Catalog',
    subtitle: 'MOBILE DISHES & MODIFIERS',
    description: 'Manage dish photos, descriptions, dietary labels, modifier options, and live item availability for mobile users.',
    badge: 'Dishes Published',
    badgeVariant: 'amber',
  },
  'qr-code-orders': {
    title: 'QR Table Orders Queue',
    subtitle: 'SELF-ORDERED GUEST TICKETS',
    description: 'Track live food and drink orders submitted directly by guests from their table QR codes with instant POS routing.',
    badge: 'Table Queue Live',
    badgeVariant: 'rose',
  },
  'qr-order-items': {
    title: 'QR Order Line Items',
    subtitle: 'ITEMIZED GUEST SELECTIONS',
    description: 'Inspect itemized dish breakdown, customer special instructions, seat assignments, and modifier selections.',
    badge: 'Granular Line Items',
    badgeVariant: 'zinc',
  },

  // ---- Restaurant Operations: Dining System ----
  'floor-plans': {
    title: 'Dining Room Floor Plans',
    subtitle: 'ARCHITECTURAL LAYOUT & MAPS',
    description: 'Design visual dining room blueprints, seating sections, outdoor patios, bar stools, and obstacle placements.',
    badge: 'Blueprints Active',
    badgeVariant: 'emerald',
  },
  'table-zones': {
    title: 'Dining Room Table Zones',
    subtitle: 'SERVICE AREAS & ROOM SECTIONS',
    description: 'Group tables into service sections such as Main Dining, Terrace, VIP Lounge, and Bar Counter.',
    badge: 'Zones Configured',
    badgeVariant: 'blue',
  },
  'tables': {
    title: 'Guest Table Inventory',
    subtitle: 'CAPACITY, STATUS & TABLE SIZING',
    description: 'Configure table numbers, seating capacities, table shapes, occupancy states, and active dining tickets.',
    badge: 'Live Tables Ready',
    badgeVariant: 'purple',
  },
  'table-assignments': {
    title: 'Staff Table Assignments',
    subtitle: 'WAITER COVERAGE & STATION ROSTER',
    description: 'Assign servers and waitstaff to specific table sections, balance guest covers, and manage shift handoffs.',
    badge: 'Coverage Assigned',
    badgeVariant: 'amber',
  },

  // ---- Restaurant Operations: Reservations ----
  'reservation-guests': {
    title: 'Reservation Guest Book',
    subtitle: 'VIP PROFILES & CONTACT DETAILS',
    description: 'Who is dining in each party, guest contact profiles, VIP status, visit history, and special occasions.',
    badge: 'Guest Directory',
    badgeVariant: 'emerald',
  },
  'reservation-notes': {
    title: 'Reservation Dietary & Seating Notes',
    subtitle: 'ALLERGIES & SPECIAL REQUESTS',
    description: 'Allergy warnings, dietary restrictions, anniversaries, high chair requests, and quiet table preferences.',
    badge: 'Dietary Notes Active',
    badgeVariant: 'blue',
  },
  'reservation-status-history': {
    title: 'Reservation Status Audit History',
    subtitle: 'BOOKING LIFECYCLE & TIMELINE',
    description: 'Complete audit log of every booking confirmation, seated time, delayed alert, cancellation, and no-show.',
    badge: 'Status Timeline',
    badgeVariant: 'purple',
  },
  'reservation-tables': {
    title: 'Table Allocation & Seating',
    subtitle: 'PHYSICAL TABLE ASSIGNMENT',
    description: 'Assign booked parties to physical dining tables, optimize section pacing, and balance waiter covers.',
    badge: 'Tables Allocated',
    badgeVariant: 'amber',
  },
  'reservations': {
    title: 'Master Reservation Book',
    subtitle: 'CALENDAR, CAPACITY & PACING',
    description: 'The central booking book: calendar view, hourly capacity limits, dining slot pacing, and booking lifecycle.',
    badge: 'Bookings Active',
    badgeVariant: 'rose',
  },
  'reservations-list': {
    title: 'Dining Table Reservations',
    subtitle: 'UPCOMING BOOKINGS & CALENDAR',
    description: 'Manage guest table bookings, arrival times, party sizes, deposit payments, and booking confirmations.',
    badge: 'Reservations Active',
    badgeVariant: 'emerald',
  },
  'guest-directory': {
    title: 'Guest Book & Dining History',
    subtitle: 'VIP PREFERENCES & ALLERGIES',
    description: 'Maintain guest contact profiles, dining preferences, VIP status, special occasions, and visit history.',
    badge: 'Guest Profiles',
    badgeVariant: 'blue',
  },
  'seating-plans': {
    title: 'Shift Seating Plan Allocations',
    subtitle: 'TABLE PRE-ALLOCATION & PACING',
    description: 'Pre-assign booked parties to tables, manage dining time slots, and prevent kitchen overbooking.',
    badge: 'Pacing Plan Active',
    badgeVariant: 'purple',
  },
  'reservation-settings': {
    title: 'Reservation Booking Policies',
    subtitle: 'CAPACITY RULES & DEPOSIT TERMS',
    description: 'Configure party size limits, cancellation windows, deposit requirements, and automated SMS reminders.',
    badge: 'Policies Configured',
    badgeVariant: 'zinc',
  },

  // ---- Restaurant Operations: Table Turnover ----
  'table-turnover-analytics': {
    title: 'Table Turnover Analytics',
    subtitle: 'DINING CYCLE & DURATION METRICS',
    description: 'Analyze average dining times per party size, seat occupancy cycles, and table turnover velocity.',
    badge: 'Turnover Analytics',
    badgeVariant: 'rose',
  },
  'course-timing-alerts': {
    title: 'Course Timing & Alert Pacing',
    subtitle: 'KITCHEN BOTTLENECK MONITOR',
    description: 'Set target duration thresholds for ordering, appetizers, entrees, desserts, and bill settlement.',
    badge: 'Pacing Alerts Live',
    badgeVariant: 'amber',
  },
  'turnover-benchmarks': {
    title: 'Service Turnover Benchmarks',
    subtitle: 'TARGET METRICS & SPEED AUDIT',
    description: 'Benchmark meal duration goals by shift and server performance to optimize table availability.',
    badge: 'Target Benchmarks',
    badgeVariant: 'emerald',
  },

  // ---- Restaurant Operations: POS ----
  'orders': {
    title: 'Point of Sale Orders & Bills',
    subtitle: 'LIVE TICKETS & CHECKOUT',
    description: 'Open, split, transfer, and settle customer dining checks with support for multiple payment tenders.',
    badge: 'Checkout Operational',
    badgeVariant: 'emerald',
  },
  'order-items': {
    title: 'Order Items & Course Routing',
    subtitle: 'DISH PREP & SEAT BREAKDOWN',
    description: 'Review items ordered per check, course fire pacing, customer seat numbers, and kitchen dispatch routing.',
    badge: 'Items Active',
    badgeVariant: 'blue',
  },
  'order-item-modifiers': {
    title: 'Order Modifiers & Upcharges',
    subtitle: 'TOPPINGS & SPECIAL REQUESTS',
    description: 'Manage modifier selections, ingredient exclusions, portion upgrades, and special dining instructions.',
    badge: 'Modifiers Matrix',
    badgeVariant: 'purple',
  },
  'order-discounts': {
    title: 'Order Discounts & Promotions',
    subtitle: 'PERCENTAGE & COUPON OFFERS',
    description: 'Apply promotional bill discounts, happy hour specials, VIP comps, and manager bill reductions.',
    badge: 'Discounts Active',
    badgeVariant: 'amber',
  },
  'order-payments': {
    title: 'Order Payment Tenders',
    subtitle: 'CARD CHARGES, TERMINALS & REFUNDS',
    description: 'Charge tokenized cards, send sales to counter terminals, and refund or void card payments.',
    badge: 'Tenders Operational',
    badgeVariant: 'rose',
  },
  'payment-gateway-configs': {
    title: 'Payment Gateway Configs',
    subtitle: 'STRIPE & CARDPOINTE ACCOUNTS',
    description: 'Connect Stripe and CardPointe accounts, sandbox or production credentials, and the default gateway.',
    badge: 'Gateways Secured',
    badgeVariant: 'emerald',
  },
  'payment-terminals': {
    title: 'Payment Terminals',
    subtitle: 'COUNTER READERS & BOLT DEVICES',
    description: 'Register CardPointe Bolt and Stripe readers per branch and register, bound to a gateway config.',
    badge: 'Readers Paired',
    badgeVariant: 'blue',
  },
  'order-taxes': {
    title: 'Order Taxes & Surcharges',
    subtitle: 'TAX DETAIL & COMPLIANCE',
    description: 'Audit applied sales taxes, service charges, local dining fees, and tax exemption certificates per order.',
    badge: 'Tax Compliance Active',
    badgeVariant: 'zinc',
  },

  // ---- Restaurant Operations: Cash Drawers ----
  'cash-drawer-history': {
    title: 'Cash Drawer History',
    subtitle: 'SESSION RECONCILIATIONS & AUDIT',
    description: 'Closed cash drawer sessions, final count reconciliations, and overage/shortage discrepancies.',
    badge: 'Reconciliations Log',
    badgeVariant: 'zinc',
  },
  'cash-drawers': {
    title: 'Cash Drawers Directory',
    subtitle: 'ACTIVE DRAWERS & TILLS',
    description: 'Open, assign, monitor, and close register drawer sessions across all terminal POS stations.',
    badge: 'Active Tills Ready',
    badgeVariant: 'emerald',
  },
  'cash-movements': {
    title: 'Cash Drawer Movements',
    subtitle: 'DRAWER DROPS & PAID-OUT LOGS',
    description: 'Record cash register openings, mid-shift drops, petty cash paid-outs, and cash float balances.',
    badge: 'Movement Log Active',
    badgeVariant: 'blue',
  },
  'cash-shifts': {
    title: 'Cashier Shift Sessions',
    subtitle: 'CASHIER TILL ASSIGNMENTS',
    description: 'Track cashier shifts on each register, starting cash floats, blind drop handoffs, and shift totals.',
    badge: 'Shifts Monitored',
    badgeVariant: 'amber',
  },
  'cash-transactions': {
    title: 'Cash Transaction Ledger',
    subtitle: 'TRANSACTION AUDIT & PAYMENTS',
    description: 'Detailed breakdown of every recorded cash payment tender, change returned, and drawer operation.',
    badge: 'Transactions Audited',
    badgeVariant: 'purple',
  },
  'cash-drawers-history': {
    title: 'Cash Drawer Shift History',
    subtitle: 'AUDIT TRAIL & RECONCILIATIONS',
    description: 'Inspect end-of-shift cash drawer reconciliations, overage and shortage discrepancies, and manager sign-offs.',
    badge: 'Drawer History Audit',
    badgeVariant: 'amber',
  },

  // ---- Restaurant Operations: Shifts ----
  'shift-assignment': {
    title: 'Weekly Shift Assignment Matrix',
    subtitle: 'ROSTER & FLOOR COVERAGE',
    description: 'Interactive weekly schedule matrix, floor coverage planning, break intervals, and publication control.',
    badge: 'Assignments Active',
    badgeVariant: 'emerald',
  },
  'shifts': {
    title: 'Daily Staff Shifts Timeline',
    subtitle: 'GANTT COVERAGE & ACTIVE SHIFTS',
    description: 'Daily Gantt timeline view of staff station coverage, scheduled hours, active clock-ins, and shift pacing.',
    badge: 'Live Shift Timeline',
    badgeVariant: 'blue',
  },
  'collaborator-shifts-schedule': {
    title: 'Staff Weekly Shift Schedule',
    subtitle: 'ROSTER PLANNING & ROTAS',
    description: 'Build and publish weekly employee shift schedules, station roles, break intervals, and labor coverage.',
    badge: 'Roster Active',
    badgeVariant: 'blue',
  },
  'collaborators-shifts-assign': {
    title: 'Shift Station Assignments',
    subtitle: 'ROLE & STATION ALLOCATION',
    description: 'Assign scheduled employees to specific kitchen, floor, bar, and cashier stations for each work period.',
    badge: 'Assignments Ready',
    badgeVariant: 'emerald',
  },
  'restaurant-time-clock': {
    title: 'Staff Time Clock Kiosk',
    subtitle: 'PUNCH-IN & ATTENDANCE TERMINAL',
    description: 'Interactive kiosk for staff PIN-based clock-in, meal break recording, clock-out, and manager shift authorization.',
    badge: 'Kiosk Terminal Live',
    badgeVariant: 'purple',
  },
  'restaurant-time-entries': {
    title: 'Attendance & Time Entries',
    subtitle: 'TIMESHEETS & CLOCK AUDIT',
    description: 'Audit real-time attendance punches, manager timesheet approvals, missed punches, and overtime logs.',
    badge: 'Timesheets Active',
    badgeVariant: 'zinc',
  },
  'open-shifts-marketplace': {
    title: 'Open Shifts Marketplace',
    subtitle: 'SHIFT SWAPS & CLAIM BOARD',
    description: 'Enable staff to broadcast available shift covers, request shift swaps, and submit manager approval workflows.',
    badge: 'Shift Board Live',
    badgeVariant: 'amber',
  },
  'labor-cost-forecasting': {
    title: 'Labor Cost Forecasting',
    subtitle: 'SALES VS LABOR PERCENTAGES',
    description: 'Compare projected labor spend against forecasted sales throughput to optimize floor staffing efficiency.',
    badge: 'Cost Forecasting',
    badgeVariant: 'rose',
  },

  // ---- Restaurant Operations: Tips ----
  'tip-movements': {
    title: 'Cash Tip Movements & Shifts',
    subtitle: 'FLOAT IN/OUT & LOGS',
    description: 'Cash tip movements, in-and-out history, drawer safe transfers, and cashier shift logs.',
    badge: 'Cash Logs Active',
    badgeVariant: 'rose',
  },
  'tip-pool-members': {
    title: 'Tip Pool Member Eligibility',
    subtitle: 'QUALIFIED ROLES & PARTICIPANTS',
    description: 'Designate front-of-house and back-of-house staff eligible to participate in specific gratuity pools.',
    badge: 'Eligible Members',
    badgeVariant: 'purple',
  },
  'tip-settlements': {
    title: 'Tip Payout Settlements',
    subtitle: 'PAYROLL DISBURSEMENTS & CASH PAYOUT',
    description: 'Approve and settle tip distributions to payroll or direct cash disbursements with complete audit history.',
    badge: 'Settlement History',
    badgeVariant: 'zinc',
  },
  'tips': {
    title: 'Gratuity & Tips Ledger',
    subtitle: 'CARD & DIGITAL TIP COLLECTIONS',
    description: 'Track all credit card, online order, and digital gratuities collected across POS checkout terminals.',
    badge: 'Tip Ledger Active',
    badgeVariant: 'emerald',
  },
  'tips-allocations': {
    title: 'Staff Tip Allocations Matrix',
    subtitle: 'CALCULATED DISTRIBUTIONS',
    description: 'Calculate shift gratuity shares per employee based on hours worked, role weightings, and pool guidelines.',
    badge: 'Allocations Ready',
    badgeVariant: 'amber',
  },
  'tips-pools': {
    title: 'Tip Pooling Configurations',
    subtitle: 'PERCENTAGE RULES & SPLIT MODELS',
    description: 'Configure automated tip pool distribution models, hours-worked ratios, points systems, and role allocations.',
    badge: 'Pools Configured',
    badgeVariant: 'blue',
  },
  'tips-ledger': {
    title: 'Gratuity & Tips Ledger',
    subtitle: 'CARD & DIGITAL TIP COLLECTIONS',
    description: 'Track all credit card, online order, and digital gratuities collected across POS checkout terminals.',
    badge: 'Tip Ledger Active',
    badgeVariant: 'emerald',
  },
  'tip-pools': {
    title: 'Tip Pooling Configurations',
    subtitle: 'PERCENTAGE RULES & SPLIT MODELS',
    description: 'Configure automated tip pool distribution models, hours-worked ratios, points systems, and role allocations.',
    badge: 'Pools Configured',
    badgeVariant: 'blue',
  },
  'tip-allocations': {
    title: 'Staff Tip Allocations',
    subtitle: 'CALCULATED DISTRIBUTIONS',
    description: 'Calculate shift gratuity shares per employee based on hours worked, role weightings, and pool guidelines.',
    badge: 'Allocations Ready',
    badgeVariant: 'amber',
  },
  'cash-tip-movements': {
    title: 'Cash Gratuity Declarations',
    subtitle: 'STAFF CASH TIP REPORTING',
    description: 'Record and verify declared cash tips received by servers and bartenders for statutory compliance.',
    badge: 'Cash Declarations',
    badgeVariant: 'rose',
  },

  // ---- Kitchen Display System ----
  'kitchen-stations': {
    title: 'Kitchen Display Stations',
    subtitle: 'LINE PREP & EXPEDITOR MONITORS',
    description: 'Configure line prep monitors, display modes, printer bindings, routing channels, and ticket sequencing for kitchen staff.',
    badge: 'Active Stations',
    badgeVariant: 'emerald',
  },
  'kitchen-display-devices': {
    title: 'Kitchen Display Devices',
    subtitle: 'TERMINALS & HARDWARE PAIRING',
    description: 'Register kitchen terminals, monitor hardware heartbeats, assign screen profiles, and pair physical bump bars.',
    badge: 'Hardware Bound',
    badgeVariant: 'blue',
  },
  'kitchen-orders': {
    title: 'Kitchen Orders & Tickets',
    subtitle: 'REAL-TIME TICKET QUEUE',
    description: 'Monitor active food preparation tickets, course pacing, priority orders, and pass window delivery status.',
    badge: 'Live Queue Active',
    badgeVariant: 'amber',
  },
  'kitchen-order-items': {
    title: 'Kitchen Order Items Tracking',
    subtitle: 'DISH PREP & COURSE PACING',
    description: 'Track granular dish preparation progress, recipe modifiers, allergen alerts, and station rerouting in real-time.',
    badge: 'Granular Tracking',
    badgeVariant: 'purple',
  },
  'kitchen-event-log': {
    title: 'Kitchen System Event Log',
    subtitle: 'AUDIT TRAIL & LATENCY LOGS',
    description: 'Inspect ticket bump history, recall actions, station latency logs, and staff operational audit events.',
    badge: 'System Audit Active',
    badgeVariant: 'zinc',
  },
  'kitchen-performance': {
    title: 'Kitchen Performance Analytics',
    subtitle: 'THROUGHPUT & PREP METRICS',
    description: 'Analyze station preparation times, peak bottleneck trends, fulfillment times, and SLA throughput metrics.',
    badge: 'KPI Analytics',
    badgeVariant: 'rose',
  },

  // ---- Finance & HR: Accounts Payable ----
  'supplier-invoices': {
    title: 'Supplier Invoices Directory',
    subtitle: 'BILLS, DUE DATES & BALANCES',
    description: 'Review and approve vendor bills, purchase order matchings, invoice line items, and payment schedules.',
    badge: 'Invoices Active',
    badgeVariant: 'emerald',
  },
  'supplier-invoice-items': {
    title: 'Supplier Invoice Line Items',
    subtitle: 'INVENTORY RECEIPTS & UNIT COSTS',
    description: 'Audit itemized invoice charges, raw ingredient unit costs, price variance alerts, and warehouse receipts.',
    badge: 'Line Items Audit',
    badgeVariant: 'blue',
  },
  'supplier-credit-notes': {
    title: 'Supplier Credit Notes',
    subtitle: 'VENDOR CREDITS & RETURN SLIPS',
    description: 'Track vendor credit memos for damaged inventory goods, short deliveries, and price adjustments.',
    badge: 'Credit Notes Active',
    badgeVariant: 'purple',
  },
  'supplier-payments': {
    title: 'Supplier Payment Vouchers',
    subtitle: 'DISBURSEMENTS & VENDOR CHECKS',
    description: 'Schedule and execute vendor payments, bank transfers, automated remittances, and cash disbursements.',
    badge: 'Payments Processed',
    badgeVariant: 'amber',
  },
  'supplier-payment-items': {
    title: 'Payment Breakdown Details',
    subtitle: 'ITEMIZED SETTLEMENT AMOUNTS',
    description: 'Detailed breakdown of settled invoice balances, discounts captured, and payment voucher line items.',
    badge: 'Settlement Lines',
    badgeVariant: 'zinc',
  },
  'supplier-payments-allocation': {
    title: 'Invoice Payment Allocations',
    subtitle: 'MATCHED BILLS & CREDITS',
    description: 'Match payment vouchers and available credit notes against open supplier invoices with zero balance reconciliation.',
    badge: 'Allocations Reconciled',
    badgeVariant: 'rose',
  },

  // ---- Finance & HR: HR ----
  'collaborators': {
    title: 'Staff Collaborator Directory',
    subtitle: 'EMPLOYEE PROFILES & ROLES',
    description: 'Manage staff master profiles, job roles, emergency contacts, wage rates, and branch assignments.',
    badge: 'Active Staff Profiles',
    badgeVariant: 'emerald',
  },
  'collaborators-contracts': {
    title: 'Employment Contracts',
    subtitle: 'TERMS, AGREEMENTS & RENEWALS',
    description: 'Maintain legal employment agreements, contract types, probation periods, and annual renewal logs.',
    badge: 'Contracts Active',
    badgeVariant: 'blue',
  },
  'collaborators-time-entries': {
    title: 'Collaborator Time & Attendance',
    subtitle: 'TIMESHEET VERIFICATION & AUDIT',
    description: 'Verify staff clock-in records, manager time corrections, paid leave, and billable hours for payroll calculation.',
    badge: 'Attendance Verified',
    badgeVariant: 'amber',
  },

  // ---- Finance & HR: Payrolls ----
  'payroll-runs': {
    title: 'Payroll Calculation Runs',
    subtitle: 'PAY PERIOD PROCESSING',
    description: 'Open, compute, verify, and finalize periodic payroll runs for restaurant staff across all branches.',
    badge: 'Payroll Periods',
    badgeVariant: 'emerald',
  },
  'payroll-entries': {
    title: 'Employee Payroll Entries',
    subtitle: 'ITEMIZED PAYSLIPS & NET PAY',
    description: 'Inspect per-collaborator gross pay, overtime additions, tips earned, deductions, and final net pay.',
    badge: 'Payslips Calculated',
    badgeVariant: 'blue',
  },
  'payroll-adjustments': {
    title: 'Payroll Adjustments & Bonuses',
    subtitle: 'INCENTIVES & DISCRETIONARY DEDUCTIONS',
    description: 'Apply discretionary bonuses, staff advances, performance commissions, and manual deductions.',
    badge: 'Adjustments Log',
    badgeVariant: 'purple',
  },
  'payroll-tax-detail': {
    title: 'Payroll Tax Detail & Withholdings',
    subtitle: 'STATUTORY CONTRIBUTIONS & TAX',
    description: 'Audit statutory income tax withholdings, social security contributions, and employer tax liabilities.',
    badge: 'Tax Withholdings Active',
    badgeVariant: 'zinc',
  },

  // ---- Financial Engine ----
  'journal-entries': {
    title: 'General Journal Entries',
    subtitle: 'POSTED DOUBLE-ENTRY LEDGER',
    description: 'Create and review posted financial journal entries, transaction dates, source modules, and balanced debits/credits.',
    badge: 'Journal Active',
    badgeVariant: 'emerald',
  },
  'journal-entries-lines': {
    title: 'Journal Entry Line Details',
    subtitle: 'DEBIT & CREDIT LINE BREAKDOWN',
    description: 'Granular debit and credit line breakdown with accounts, memo descriptions, currencies, and cost centers.',
    badge: 'Debit/Credit Lines',
    badgeVariant: 'blue',
  },
  'ledger-accounts': {
    title: 'Chart of Accounts & Ledger',
    subtitle: 'ACCOUNT TAXONOMY & BALANCES',
    description: 'Configure assets, liabilities, equity, revenues, and expense accounts with real-time financial balances.',
    badge: 'Chart of Accounts Live',
    badgeVariant: 'purple',
  },

  // ---- Business Partners ----
  'suppliers': {
    title: 'Master Supplier Directory',
    subtitle: 'VENDOR CONTACTS & PAYMENT TERMS',
    description: 'Manage verified vendor profiles, payment credit terms, purchasing lead times, and tax identification numbers.',
    badge: 'Verified Suppliers',
    badgeVariant: 'emerald',
  },

  // ---- Companies ----
  'company-configurations': {
    title: 'Company Configurations',
    subtitle: 'SYSTEM SETTINGS & WORKSPACE PREFS',
    description: 'Set fiscal year calendars, base operating currencies, timezone settings, and business profile preferences.',
    badge: 'Configurations Active',
    badgeVariant: 'emerald',
  },
  'company-profile': {
    title: 'Company Legal Profile',
    subtitle: 'CORPORATE IDENTITY & BRANDING',
    description: 'Manage company legal registration details, corporate addresses, trade names, and invoice logos.',
    badge: 'Profile Verified',
    badgeVariant: 'blue',
  },
  'companies': {
    title: 'Company Master Registry',
    subtitle: 'MULTI-TENANT CORPORATE DIRECTORY',
    description: 'Manage commercial company accounts, corporate tax IDs, subscription tiers, and tenant allocations.',
    badge: 'Tenants Active',
    badgeVariant: 'emerald',
  },

  // ---- Merchants ----
  'merchant-directory': {
    title: 'Company Merchants Directory',
    subtitle: 'OUTLETS & PHYSICAL BRANCHES',
    description: 'Manage active branch outlets, physical locations, operating hours, and terminal deployments.',
    badge: 'Branches Active',
    badgeVariant: 'emerald',
  },
  'merchants-provisioning': {
    title: 'Merchants & Tenants Provisioning',
    subtitle: 'TENANT ONBOARDING ENGINE',
    description: 'Provision new restaurant tenants, assign initial subscription quotas, and configure merchant branches.',
    badge: 'Provisioning Engine',
    badgeVariant: 'blue',
  },
  'global-merchants-directory': {
    title: 'Global Merchants Directory',
    subtitle: 'ALL PLATFORM STOREFRONTS',
    description: 'Global registry of all provisioned merchant locations across all company accounts on the platform.',
    badge: 'Platform Directory',
    badgeVariant: 'zinc',
  },

  // ---- Users ----
  'user-management': {
    title: 'Company Users Directory',
    subtitle: 'ROLES & ACCESS PERMISSIONS',
    description: 'Manage company staff users, assign granular roles and permissions, and audit security credentials.',
    badge: 'Staff Accounts Active',
    badgeVariant: 'emerald',
  },
  'users-auth-profiles': {
    title: 'Global Users Directory',
    subtitle: 'PLATFORM-WIDE CREDENTIALS',
    description: 'Platform-wide user registry, administrative access control, authentication profiles, and audit log.',
    badge: 'Security Registry',
    badgeVariant: 'purple',
  },
  'merchant-tax-rules': {
    title: 'Merchant Tax Rules Matrix',
    subtitle: 'SALES TAX, VAT & SURCHARGES',
    description: 'Configure state and local sales tax percentages, item tax exemptions, and takeout food tax rules.',
    badge: 'Tax Rules Configured',
    badgeVariant: 'purple',
  },
  'merchant-tips-rules': {
    title: 'Gratuity & Tip Calculation Rules',
    subtitle: 'SUGGESTED TIP PERCENTAGES & SPLITS',
    description: 'Configure suggested gratuity percentages printed on guest receipts, card prompt defaults, and auto-gratuity.',
    badge: 'Tip Rules Active',
    badgeVariant: 'amber',
  },
  'merchant-overtime-rules': {
    title: 'Overtime Calculation Rules',
    subtitle: 'DAILY & WEEKLY THRESHOLDS',
    description: 'Establish statutory overtime multiplier rates, daily rest thresholds, and weekend premium calculations.',
    badge: 'Overtime Rules Active',
    badgeVariant: 'zinc',
  },
  'merchant-payroll-rules': {
    title: 'Payroll Processing Rules',
    subtitle: 'PAY CYCLES & DISBURSEMENT POLICIES',
    description: 'Configure bi-weekly or monthly pay cycles, standard pay dates, and automated direct deposit rules.',
    badge: 'Payroll Policies Live',
    badgeVariant: 'rose',
  },

  // ---- Billing & Transactions ----
  'receipt-items': {
    title: 'Itemized Receipt Line Items',
    subtitle: 'BILL BREAKDOWN & ITEM CHARGES',
    description: 'Inspect itemized charges printed on each customer sales receipt, applied item discounts, seat numbers, and quantity breakdowns.',
    badge: 'In Development',
    badgeVariant: 'amber',
  },
  'receipt-orders': {
    title: 'Customer Sales Receipts',
    subtitle: 'FISCAL RECEIPTS & TENDER AUDIT',
    description: 'Archive of issued customer sales receipts, POS register terminals, settlement tenders, customer copies, and fiscal audit logs.',
    badge: 'In Development',
    badgeVariant: 'amber',
  },
  'receipt-taxes': {
    title: 'Receipt Tax Line Breakdown',
    subtitle: 'TAX DETAIL & EXEMPTIONS',
    description: 'Detailed breakdown of sales tax brackets, VAT rates, local municipal surcharges, and tax-exempt balances allocated per receipt.',
    badge: 'In Development',
    badgeVariant: 'amber',
  },
  'billing-invoices': {
    title: 'Billing Invoices Directory',
    subtitle: 'CLIENT BILLS & PAYMENT STATUS',
    description: 'Generate customer billing invoices, payment reminders, due dates, and real-time payment reconciliation.',
    badge: 'Invoices Active',
    badgeVariant: 'emerald',
  },
  'billing-payments': {
    title: 'Transaction Payment Records',
    subtitle: 'RECEIVED PAYMENTS & RECEIPTS',
    description: 'Track customer payments received via bank transfer, credit cards, payment links, and receipts.',
    badge: 'Transactions Logged',
    badgeVariant: 'blue',
  },

  // ---- Platform SaaS: Subscription System ----
  'apps-config': {
    title: 'Platform Applications Catalog',
    subtitle: 'MODULE INVENTORY & CONTROLS',
    description: 'Platform application catalog, module configurations, system dependencies, and deployment provisioning.',
    badge: 'Apps Catalog Live',
    badgeVariant: 'blue',
  },
  'features-control': {
    title: 'Feature Flags & Entitlements',
    subtitle: 'CAPABILITIES & PERMISSION GATES',
    description: 'Granular feature flag catalog, permission gates, capabilities toggles, and beta module rollouts.',
    badge: 'Features Live',
    badgeVariant: 'purple',
  },
  'merchant-subs-link': {
    title: 'Merchant Subscriptions Directory',
    subtitle: 'COMPANY PLANS & EXPIRY',
    description: 'Monitor merchant subscription allocations, active platform tiers, automated renewal dates, and billing statuses.',
    badge: 'In Development',
    badgeVariant: 'amber',
  },
  'plan-apps-rules': {
    title: 'Plan Application Inclusions',
    subtitle: 'TIER MODULE ALLOCATION',
    description: 'Define software applications, subsystems, and add-on modules bundled into each commercial subscription plan.',
    badge: 'Rules Configured',
    badgeVariant: 'emerald',
  },
  'plan-features-mapping': {
    title: 'Plan Feature Capabilities Mapping',
    subtitle: 'TIER FEATURE MATRIX',
    description: 'Map granular feature entitlements and operational limits unlocked across standard, pro, and enterprise tiers.',
    badge: 'Features Matrix Live',
    badgeVariant: 'amber',
  },
  'sub-plans-core': {
    title: 'Software Subscription Plans',
    subtitle: 'TIERS, PRICING & CYCLES',
    description: 'Manage SaaS subscription tiers, recurring billing frequencies, user seat allocations, and module access.',
    badge: 'Subscription Plans',
    badgeVariant: 'emerald',
  },
  'sub-apps-mapping': {
    title: 'Active Merchant Applications',
    subtitle: 'MODULE PROVISIONING & STATUS',
    description: 'Audit software modules and subsystem applications provisioned for each subscribed restaurant merchant.',
    badge: 'In Development',
    badgeVariant: 'amber',
  },
  'sub-payments-billing': {
    title: 'Subscription Billing Invoices',
    subtitle: 'RECURRING BILLS & CHARGES',
    description: 'Track monthly platform SaaS subscription fee invoices, card payment receipts, and settlement history.',
    badge: 'In Development',
    badgeVariant: 'amber',
  },
  'subscription-plans': {
    title: 'Software Subscription Plans',
    subtitle: 'TIERS, PRICING & SEATS',
    description: 'Manage SaaS subscription tiers, recurring billing frequencies, user seat allocations, and module access.',
    badge: 'Tiers Active',
    badgeVariant: 'emerald',
  },
  'subscription-features': {
    title: 'Feature Flag Entitlements',
    subtitle: 'MODULE PERMISSIONS & CAPABILITIES',
    description: 'Control platform feature gates, add-on modules, and granular capability access across subscription tiers.',
    badge: 'Feature Matrix Live',
    badgeVariant: 'blue',
  },
  'subscription-invoices': {
    title: 'Platform Subscription Invoices',
    subtitle: 'BILLING HISTORY & RECEIPTS',
    description: 'Audit recurring monthly subscription invoices, card charges, receipt downloads, and renewal statements.',
    badge: 'Invoices Reconciled',
    badgeVariant: 'zinc',
  },

  // ---- Business Partners: Customers ----
  'customers': {
    title: 'Customer Billing Directory',
    subtitle: 'CLIENT IDENTITIES & DIRECTORY',
    description: 'Maintain customer contact directories, corporate tax IDs, billing addresses, credit limits, and dining history.',
    badge: 'In Development',
    badgeVariant: 'amber',
  },

  // ---- Commerce: Online Ordering Live Items ----
  'online-stores': {
    title: 'Online Stores Directory',
    subtitle: 'WEB PORTALS & BRANDING',
    description: 'Manage multi-storefront digital channels, subdomains, color themes, currencies, and operational statuses.',
    badge: 'Stores Active',
    badgeVariant: 'emerald',
  },
  'online-menus': {
    title: 'Digital Store Menus',
    subtitle: 'DIGITAL CATALOGS & AVAILABILITY',
    description: 'Create and publish specialized digital menus, meal schedules, seasonal offerings, and channel-specific menus.',
    badge: 'Active Menus',
    badgeVariant: 'purple',
  },
  'online-menu-categories': {
    title: 'Store Menu Categories',
    subtitle: 'TAXONOMY & STOREFRONT NAVIGATION',
    description: 'Structure digital menu sections, item families, display sorting order, and customer-facing browse categories.',
    badge: 'Categories Live',
    badgeVariant: 'emerald',
  },
  'online-menu-items': {
    title: 'Online Store Catalog Items',
    subtitle: 'DISHES, PRICING & MODIFIERS',
    description: 'Synchronize saleable catalog dishes with online storefronts, including digital photos, tags, and modifier sets.',
    badge: 'Dishes Published',
    badgeVariant: 'blue',
  },
  'online-orders': {
    title: 'Online Orders Dispatch Queue',
    subtitle: 'INCOMING ORDERS & FULFILLMENT',
    description: 'Track live incoming web and delivery orders, customer details, acceptance workflows, and fulfillment dispatch.',
    badge: 'Live Dispatch Active',
    badgeVariant: 'amber',
  },

  // ---- Commerce: Online Ordering In Development Items ----
  'online-payments': {
    title: 'Digital Payments Gateway',
    subtitle: 'CHECKOUT & CARD PROCESSORS',
    description: 'Configure online payment gateways, Stripe, card acquiring providers, and digital checkout tender rules.',
    badge: 'In Development',
    badgeVariant: 'amber',
  },
  'online-order-items': {
    title: 'Itemized Order Details',
    subtitle: 'ITEMIZED CARTS & MODIFIERS',
    description: 'Detailed breakdown of customer shopping carts, special cooking instructions, modifier choices, and price lines.',
    badge: 'In Development',
    badgeVariant: 'amber',
  },
  'online-delivery-info': {
    title: 'Delivery Logistics & Coverage',
    subtitle: 'ZONES, COURIERS & COVERAGE',
    description: 'Configure delivery radiuses, polygon coverage zones, distance-based courier fees, minimum orders, and dispatch times.',
    badge: 'In Development',
    badgeVariant: 'amber',
  },

  // ---- Table Turnover Optimization (In Development) ----
  'table-turnover': {
    title: 'Table Turnover Optimization Workspace',
    subtitle: 'SERVICE PACING & DURATION VELOCITY',
    description: 'Dining duration velocity, course pacing bottleneck alerts, meal cycle analytics, and table turnover benchmarking.',
    badge: 'In Development',
    badgeVariant: 'amber',
  },

  // ---- Reports & Business Intelligence (In Development) ----
  'reports': {
    title: 'Business Intelligence & Reports',
    subtitle: 'ANALYTICS, MIX & REVENUE',
    description: 'Operational sales summaries, hourly throughput reports, product mix analysis, and staff attendance performance metrics.',
    badge: 'In Development',
    badgeVariant: 'amber',
  },

  // ---- Inventory: Food Costing ----
  'actual-cost-variance': {
    title: 'Actual Cost Variance Analysis',
    subtitle: 'THEORETICAL VS ACTUAL USAGE',
    description: 'Audit discrepancies between standard theoretical recipe consumption and physical inventory usage.',
    badge: 'Variance Audit',
    badgeVariant: 'amber',
  },
  'recipes': {
    title: 'Production Formulas & Recipes',
    subtitle: 'BILL OF MATERIALS & YIELD',
    description: 'Review production formulas, link raw ingredients to finished products, and audit food costs.',
    badge: 'Costing Active',
    badgeVariant: 'purple',
  },
  'recipe-ingredients': {
    title: 'Recipe Ingredients & Portions',
    subtitle: 'PORTION MEASURES & UNIT COSTS',
    description: 'Manage granular ingredient lines, portion weights, wastage allowances, and component costs.',
    badge: 'Portions Matrix',
    badgeVariant: 'blue',
  },
  'theoretical-cost': {
    title: 'Theoretical Cost Benchmarks',
    subtitle: 'TARGET FOOD COST PERCENTAGES',
    description: 'Benchmark target dish margins, calculate optimal menu price suggestions, and assess profitability.',
    badge: 'Margin Benchmarks',
    badgeVariant: 'emerald',
  },

  // ---- Inventory: Products Catalog ----
  'categories': {
    title: 'Product Categories Hierarchy',
    subtitle: 'TAXONOMY & CATEGORY FAMILIES',
    description: 'Organize menu items and retail products into structured departments, parent groups, and sub-categories.',
    badge: 'Categories',
    badgeVariant: 'emerald',
  },
  'products': {
    title: 'Finished Products Catalog',
    subtitle: 'SALEABLE GOODS & POS MATRIX',
    description: 'Manage saleable dishes and retail goods, pricing rules, tax rates, and kitchen display routing.',
    badge: 'Products Live',
    badgeVariant: 'blue',
  },
  'variants': {
    title: 'Product Variants & Sizing',
    subtitle: 'PORTIONS, SIZES & PRICING MATRIX',
    description: 'Define product variations such as sizing, portions, combo choices, and SKU-level price overrides.',
    badge: 'Variations Matrix',
    badgeVariant: 'zinc',
  },
  'modifiers': {
    title: 'Custom Modifiers & Add-ons',
    subtitle: 'OPTIONS, TOPPINGS & CHOICES',
    description: 'Configure ingredient add-ons, removals, portion choices, customer requests, and upcharge pricing rules.',
    badge: 'Modifier Groups',
    badgeVariant: 'amber',
  },

  // ---- Inventory: Raw Materials & Stock ----
  'raw-material-categories': {
    title: 'Raw Material Categories',
    subtitle: 'SUPPLIES TAXONOMY & GROUPING',
    description: 'Organize raw ingredients into families, temperature zones, and supplier departments.',
    badge: 'Live Categories',
    badgeVariant: 'emerald',
  },
  'raw-materials': {
    title: 'Raw Materials Workspace',
    subtitle: 'MASTER INGREDIENTS & SUPPLIES',
    description: 'Manage raw ingredients, base goods, units of measurement, yields, and cost benchmarks.',
    badge: 'Live Items',
    badgeVariant: 'blue',
  },
  'purchase-orders': {
    title: 'Purchase Orders Management',
    subtitle: 'PROCUREMENT & INBOUND SHIPMENTS',
    description: 'Create purchase orders, receive supplier shipments, verify bills, and replenish warehouse stock.',
    badge: 'Live Orders',
    badgeVariant: 'amber',
  },
  'stock-inventory': {
    title: 'Stock Levels & Balances',
    subtitle: 'LIVE INVENTORY BALANCES & THRESHOLDS',
    description: 'Track real-time inventory balances, stock counts by location, par levels, and low-stock alerts.',
    badge: 'Stock Healthy',
    badgeVariant: 'emerald',
  },
  'stock-movements': {
    title: 'Stock Movements & Audit',
    subtitle: 'AUDIT TRAIL & TRANSFER LOGS',
    description: 'Record manual adjustments, internal warehouse transfers, waste logging, and audit history.',
    badge: 'Audit Active',
    badgeVariant: 'purple',
  },
  'locations': {
    title: 'Inventory Storage Locations',
    subtitle: 'STORAGE SITES & PANTRIES',
    description: 'Manage warehouse zones, walk-in coolers, dry storage shelves, and prep station caches.',
    badge: 'Active Sites',
    badgeVariant: 'zinc',
  },
};

export const ModuleCommandHubView: React.FC<ModuleCommandHubViewProps> = ({ hub, onNavigate }) => {
  const live = hub.items.filter((item) => item.live).length;
  const pending = hub.items.length - live;

  const kpis: DashboardKPIItem[] = [
    {
      title: 'Workspaces',
      value: hub.items.length,
      subtitle: 'Third-level options',
      icon: 'space_dashboard',
      variant: 'red',
    },
    {
      title: 'Available',
      value: live,
      subtitle: 'Ready to use',
      icon: 'check_circle',
      variant: 'emerald',
    },
    {
      title: 'In Development',
      value: pending,
      subtitle: pending ? 'Coming in a next release' : 'Nothing pending',
      icon: 'construction',
      variant: 'amber',
    },
    {
      title: 'Category',
      value: hub.category,
      subtitle: 'Menu section',
      icon: hub.icon,
      variant: 'zinc',
    },
  ];

  const modules: DashboardModuleItem[] = hub.items.map((item, index) => {
    const known = KNOWN_CARD_METADATA[item.featureId];
    const isLive = item.live;
    const cardTitle = known?.title ?? toTitleCase(item.label);
    const cardSubtitle =
      known?.subtitle ??
      (isLive
        ? `${toTitleCase(hub.title).toUpperCase()} SECTION`
        : `${toTitleCase(cardTitle).toUpperCase()} WORKSPACE`);
    const cardDescription = known?.description ?? item.description;
    const cardBadge = isLive
      ? (known?.badge ?? `${cardTitle.split(' ')[0]} Live`)
      : 'In Development';
    const cardBadgeVariant = isLive
      ? (known?.badgeVariant ?? BADGE_PALETTE[index % BADGE_PALETTE.length])
      : 'amber';
    const actionText = isLive ? `Manage ${cardTitle}` : 'Preview Workspace';

    return {
      id: item.featureId,
      title: cardTitle,
      subtitle: cardSubtitle,
      description: cardDescription,
      icon: item.icon,
      badge: cardBadge,
      badgeVariant: cardBadgeVariant,
      actionText,
    };
  });

  return (
    <StandardDashboardHub
      breadcrumb={`${hub.category} / ${hub.title.replace(/\s+Command\s+Hub$/i, '')}`}
      headerIcon="space_dashboard"
      title={hub.title}
      description={hub.description}
      kpis={kpis}
      modules={modules}
      onModuleClick={onNavigate}
    />
  );
};

export default ModuleCommandHubView;
