import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in React render tree:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReset = () => {
    try {
      // Clear storage keys that might hold corrupt state
      localStorage.removeItem('x7_journal_entries_v3');
      localStorage.removeItem('x7_merchant_tax_rules_v1');
      localStorage.removeItem('x7_ledger_accounts_v1');
    } catch {
      // ignore
    }
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      const err = this.state.error as (Error & {
        status?: number;
        statusCode?: number;
        code?: string;
        details?: {
          redirectTo?: string;
          subscriptionStatus?: string;
          companyId?: string | number;
          requiredFeature?: string;
          actionRequired?: string;
          [key: string]: unknown;
        };
      }) | null;
      const isSubscriptionError =
        err?.status === 403 ||
        err?.statusCode === 403 ||
        err?.code === 'SUBSCRIPTION_SUSPENDED' ||
        err?.code === 'SUBSCRIPTION_CANCELLED' ||
        err?.code === 'SUBSCRIPTION_EXPIRED' ||
        err?.code === 'FEATURE_NOT_ENTITLED' ||
        err?.name === 'SubscriptionGuardForbiddenException';

      if (isSubscriptionError) {
        const redirectTo = err?.details?.redirectTo ?? '/platform-saas/subscription/hub';
        const code = err?.code ?? 'SUBSCRIPTION_SUSPENDED';
        const isCancelled = code === 'SUBSCRIPTION_CANCELLED';
        const isEntitlement = code === 'FEATURE_NOT_ENTITLED';

        return (
          <div
            className="min-h-screen bg-[#fef9f1] flex flex-col justify-center items-center p-6 text-center text-[#1d1c17] font-['Poppins',sans-serif]"
            data-testid="subscription-billing-boundary-screen"
          >
            <div className="bg-white border border-[#e8e2d8] rounded-2xl shadow-2xl p-8 max-w-lg w-full flex flex-col items-center gap-4 animate-fade-in text-center">
              {/* Icon badge */}
              <div className="w-16 h-16 bg-[#ae001a]/10 border-2 border-[#ae001a] rounded-full flex items-center justify-center text-[#ae001a]">
                <span className="material-symbols-outlined text-3xl">
                  {isCancelled ? 'cancel' : isEntitlement ? 'widgets' : 'lock'}
                </span>
              </div>

              {/* Status Pill */}
              <span className="px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-[#ae001a]/10 text-[#ae001a] border border-[#ae001a]/20">
                {code.replace(/_/g, ' ')}
              </span>

              {/* Title */}
              <h2 className="text-xl font-black text-[#1d1c17] tracking-tight uppercase">
                {isEntitlement ? 'Module Not Entitled' : 'Subscription Access Suspended'}
              </h2>

              {/* Description */}
              <p className="text-sm text-[#5f5e5e] max-w-md leading-relaxed">
                {err?.message ??
                  'Access to restricted merchant sub-modules is blocked by the subscription security guard. Please review active subscription statuses or update your plan entitlements.'}
              </p>

              {/* Detailed Exception Payload (formatted for transparency) */}
              {err?.details && (
                <div className="w-full bg-[#f8f3eb] p-3 rounded-lg text-left font-mono text-xs text-[#1d1c17] overflow-x-auto border border-[#e8e2d8] space-y-1">
                  <div className="text-[10px] uppercase font-bold text-[#8a8880] tracking-wider mb-1">
                    API Guard Response Payload
                  </div>
                  <div>
                    <span className="text-[#8a8880]">Status:</span>{' '}
                    <span className="font-bold text-amber-700">{err.details.subscriptionStatus ?? 'SUSPENDED'}</span>
                  </div>
                  {err.details.companyId && (
                    <div>
                      <span className="text-[#8a8880]">Tenant Company ID:</span> {err.details.companyId}
                    </div>
                  )}
                  {err.details.requiredFeature && (
                    <div>
                      <span className="text-[#8a8880]">Required Feature:</span> {err.details.requiredFeature}
                    </div>
                  )}
                  {err.details.actionRequired && (
                    <div>
                      <span className="text-[#8a8880]">Action Required:</span>{' '}
                      <span className="font-bold text-[#ae001a]">{err.details.actionRequired}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-col sm:flex-row gap-3 mt-4 w-full">
                <a
                  href={redirectTo}
                  className="flex-1 px-5 py-3 bg-[#ae001a] hover:bg-[#8e0015] text-white font-bold text-xs uppercase tracking-wider rounded transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                >
                  <span className="material-symbols-outlined text-base">receipt_long</span>
                  {isEntitlement ? 'Upgrade Subscription Plan' : 'Go to Billing Notice & Hub'}
                </a>
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="px-4 py-3 bg-[#f8f3eb] hover:bg-[#e8e2d8] text-[#1d1c17] font-bold text-xs uppercase tracking-wider rounded border border-[#e8e2d8] transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-base">refresh</span>
                  Recheck
                </button>
              </div>
            </div>
          </div>
        );
      }

      return (
        <div className="min-h-screen bg-[#fef9f1] flex flex-col justify-center items-center p-6 text-center text-[#1d1c17]">
          <div className="bg-white border border-[#e8e2d8] rounded-xl shadow-2xl p-8 max-w-lg w-full flex flex-col items-center gap-4 animate-fade-in">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center text-[#ae001a]">
              <span className="material-symbols-outlined text-3xl">warning</span>
            </div>
            <h2 className="text-xl font-bold text-[#1d1c17]">An unexpected error occurred</h2>
            <p className="text-sm text-[#5f5e5e] max-w-md">
              The view could not load due to a data conflict in the current session.
            </p>
            {this.state.error && (
              <div className="w-full bg-[#f8f3eb] p-3 rounded text-left font-mono text-xs text-red-700 overflow-x-auto border border-[#e8e2d8]">
                {this.state.error.toString()}
              </div>
            )}
            <div className="flex gap-3 mt-4 w-full">
              <button
                type="button"
                onClick={this.handleReset}
                className="flex-1 px-5 py-3 bg-[#ae001a] hover:bg-[#930015] text-white font-bold text-xs uppercase tracking-widest rounded transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">refresh</span>
                Clear Cache & Reload
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
