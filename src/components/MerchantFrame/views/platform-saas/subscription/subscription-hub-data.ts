export interface HubSubModuleItem {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  icon: string;
  badge?: string;
  badgeVariant?: 'emerald' | 'blue' | 'amber' | 'purple' | 'zinc' | 'rose';
  actionText?: string;
}

export const SUBSCRIPTION_SUB_MODULES: HubSubModuleItem[] = [
  {
    id: 'sub-plans-core',
    title: 'Subscription Plans Configuration',
    subtitle: 'TIERS & PRICING',
    description: 'Create and configure subscription tiers, billing cadences, custom pricing models, and active tiers.',
    icon: 'workspace_premium',
    badge: 'Core Config',
    badgeVariant: 'emerald',
    actionText: 'Configure Plans',
  },
  {
    id: 'apps-config',
    title: 'Applications Configuration',
    subtitle: 'ECOSYSTEM MODULES',
    description: 'Manage platform application catalog, ecosystem modules, software categories, and system availability.',
    icon: 'apps',
    badge: 'Catalog',
    badgeVariant: 'blue',
    actionText: 'Manage Apps',
  },
  {
    id: 'features-control',
    title: 'Features Configuration',
    subtitle: 'CAPABILITY CATALOG',
    description: 'Master feature flags catalog and granular platform capability tables with measurement units and rules.',
    icon: 'toggle_on',
    badge: 'Feature Flags',
    badgeVariant: 'amber',
    actionText: 'Configure Features',
  },
  {
    id: 'plan-apps-rules',
    title: 'Applications to Plans Association',
    subtitle: 'PLAN BUNDLES',
    description: 'Associate software applications and modular capabilities included in each subscription plan tier.',
    icon: 'widgets',
    badge: 'Associations',
    badgeVariant: 'blue',
    actionText: 'Map Applications',
  },
  {
    id: 'plan-features-mapping',
    title: 'Features to Plans Association',
    subtitle: 'ENTITLEMENTS & LIMITS',
    description: 'Map feature entitlements, usage quotas, and quantitative limits bundled into subscription tiers.',
    icon: 'checklist',
    badge: 'Entitlements',
    badgeVariant: 'emerald',
    actionText: 'Map Features',
  },
  {
    id: 'company-subscriptions',
    title: 'Company Subscriptions Inquiry',
    subtitle: 'TENANT SUBSCRIPTIONS',
    description: 'Inquire active company tenant subscriptions, expiration dates, assigned plans, and renewal schedules.',
    icon: 'business',
    badge: 'Inquiry',
    badgeVariant: 'zinc',
    actionText: 'Inquire Subscriptions',
  },
  {
    id: 'merchant-subs-link',
    title: 'Merchant Subscriptions Inquiry',
    subtitle: 'STORE SUBSCRIPTIONS',
    description: 'Inquire and manage individual merchant store subscriptions, assigned plans, and store licenses.',
    icon: 'storefront',
    badge: 'Inquiry',
    badgeVariant: 'zinc',
    actionText: 'Inquire Merchants',
  },
  {
    id: 'sub-payments-billing',
    title: 'Subscription Payments Inquiry (with Status Change)',
    subtitle: 'BILLING & INVOICES',
    description: 'Audit subscription billing transactions, invoices, payment methods, and update transaction statuses.',
    icon: 'payments',
    badge: 'Billing',
    badgeVariant: 'rose',
    actionText: 'Inquire Payments',
  },
  {
    id: 'sub-apps-mapping',
    title: 'Subscription Applications Inquiry',
    subtitle: 'ACTIVE DEPLOYMENTS',
    description: 'Inquire active applications and software modules mapped to company subscriptions and merchant profiles.',
    icon: 'apps_outage',
    badge: 'Deployments',
    badgeVariant: 'amber',
    actionText: 'Inquire Applications',
  },
];

