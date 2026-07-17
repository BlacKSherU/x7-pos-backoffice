import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getSubscriptionTiers,
  selectSubscription,
} from '../../api/onboarding';
import { ContactSalesModal } from '../../components/onboarding/ContactSalesModal';
import { OnboardingLayout } from '../../components/onboarding/OnboardingLayout';
import { PlanCard } from '../../components/onboarding/PlanCard';
import { useToast } from '../../hooks/use-toast';
import { useOnboarding } from '../../hooks/use-onboarding';
import { ApiError } from '../../lib/api-error';
import { getSelectedTierId } from '../../lib/onboarding-storage';
import type { SubscriptionTier } from '../../types/onboarding';

export function SubscriptionStepPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const {
    setSessionId,
    setSelectedTier,
    advanceStep,
    exitOnboarding,
    selectedTierId,
  } = useOnboarding();

  const [tiers, setTiers] = useState<SubscriptionTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [selection, setSelection] = useState<string | null>(selectedTierId);
  const [showContactModal, setShowContactModal] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoadError(null);
      try {
        const data = await getSubscriptionTiers();
        if (cancelled) return;
        setTiers(data);
        const stored = getSelectedTierId();
        if (stored && data.some((t) => t.id === stored)) {
          setSelection(stored);
          return;
        }
        const recommended =
          data.find((t) => t.recommended) ??
          data.find((t) => t.name.toLowerCase() === 'professional') ??
          data[0];
        if (recommended) {
          setSelection(recommended.id);
          setSelectedTier(recommended.id);
        }
      } catch {
        if (!cancelled) {
          setLoadError('Failed to load subscription plans. Please try again.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [setSelectedTier]);

  async function reloadTiers() {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await getSubscriptionTiers();
      setTiers(data);
      const stored = getSelectedTierId();
      if (stored && data.some((t) => t.id === stored)) {
        setSelection(stored);
        return;
      }
      const recommended =
        data.find((t) => t.recommended) ??
        data.find((t) => t.name.toLowerCase() === 'professional') ??
        data[0];
      if (recommended) {
        setSelection(recommended.id);
        setSelectedTier(recommended.id);
      }
    } catch {
      setLoadError('Failed to load subscription plans. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const selectedTier = tiers.find((t) => t.id === selection);
  const isExecutive = selectedTier?.isCustom === true;

  function handleSelect(tierId: string) {
    setSelection(tierId);
    setSelectedTier(tierId);
  }

  async function handleContinue() {
    if (!selection) return;

    if (isExecutive) {
      setShowContactModal(true);
      return;
    }

    setSubmitting(true);
    try {
      const response = await selectSubscription(selection);
      setSessionId(response.sessionId);
      advanceStep(2);
      navigate('/register/company');
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : 'Failed to save selection. Please try again.';
      showToast(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <OnboardingLayout
      currentStep={1}
      onSaveExit={() => void exitOnboarding()}
      subtitle="Step 1 of 4: Select Subscription"
      wide
    >
      <div className="text-center mb-10">
        <h1 className="text-3xl md:text-4xl font-bold text-text uppercase tracking-tight mb-3">
          Choose Your Professional Edge
        </h1>
        <p className="text-body-md text-text/60 max-w-2xl mx-auto">
          Select the operational tier that matches your restaurant&apos;s volume
          and complexity. Scale your tools as your hospitality business grows.
        </p>
      </div>

      {loading && (
        <div className="mb-8 -mx-4 overflow-x-auto px-4 md:mx-0 md:overflow-visible md:px-0">
          <div className="mx-auto flex w-max flex-row justify-center gap-5 md:w-full md:flex-wrap">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="surface-paper h-72 w-[240px] shrink-0 animate-pulse rounded-lg bg-stone-100"
              />
            ))}
          </div>
        </div>
      )}

      {loadError && (
        <div
          className="surface-paper rounded-lg p-8 text-center border border-error/30"
          role="alert"
        >
          <p className="text-body-md text-error mb-4">{loadError}</p>
          <button
            className="px-6 py-2 bg-primary text-white rounded-lg font-semibold"
            onClick={() => void reloadTiers()}
            type="button"
          >
            Retry
          </button>
        </div>
      )}

      {!loading && !loadError && (
        <>
          <div className="mb-8 -mx-4 overflow-x-auto px-4 md:mx-0 md:overflow-visible md:px-0">
            <div className="mx-auto flex w-max flex-row justify-center gap-5 md:w-full md:flex-wrap">
              {tiers.map((tier) => (
                <PlanCard
                  key={tier.id}
                  isSelected={selection === tier.id}
                  onSelect={() => handleSelect(tier.id)}
                  tier={tier}
                />
              ))}
            </div>
          </div>

          <div className="surface-paper rounded-lg p-6 flex flex-col md:flex-row items-center justify-between gap-4 border border-border">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-primary text-2xl">
                security
              </span>
              <p className="text-body-sm text-text">
                <strong>Secure Billing Enrollment.</strong> Your selection is
                saved. You can upgrade anytime during the trial.
              </p>
            </div>
            <button
              className="flex items-center gap-2 px-8 py-3 bg-primary text-white rounded-lg font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
              disabled={!selection || submitting}
              onClick={() => void handleContinue()}
              type="button"
            >
              {isExecutive ? (
                'Contact Sales'
              ) : (
                <>
                  Continue to Company Details
                  <span className="material-symbols-outlined">arrow_forward</span>
                </>
              )}
            </button>
          </div>
        </>
      )}

      <ContactSalesModal
        isOpen={showContactModal}
        onClose={() => setShowContactModal(false)}
      />
    </OnboardingLayout>
  );
}
