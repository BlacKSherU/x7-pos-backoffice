export const getProviderBadgeStyle = (provider: string) => {
  const key = (provider || '').toLowerCase();
  if (key.includes('stripe')) {
    return {
      label: 'Stripe',
      cls: 'bg-indigo-50 text-indigo-800 border-indigo-200',
      icon: 'credit_card',
    };
  }
  if (key.includes('paypal')) {
    return {
      label: 'PayPal',
      cls: 'bg-sky-50 text-sky-800 border-sky-200',
      icon: 'account_balance_wallet',
    };
  }
  if (key.includes('square')) {
    return {
      label: 'Square',
      cls: 'bg-neutral-100 text-neutral-800 border-neutral-300',
      icon: 'crop_square',
    };
  }
  if (key.includes('clover')) {
    return {
      label: 'Clover Pay',
      cls: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      icon: 'point_of_sale',
    };
  }
  return {
    label: provider ? provider.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : 'Gateway',
    cls: 'bg-slate-100 text-slate-800 border-slate-200',
    icon: 'payments',
  };
};

