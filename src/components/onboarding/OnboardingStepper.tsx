import type { OnboardingStep } from '../../types/onboarding';

const STEPS: { step: OnboardingStep; label: string }[] = [
  { step: 1, label: 'Subscription' },
  { step: 2, label: 'Company' },
  { step: 3, label: 'Merchant' },
  { step: 4, label: 'User' },
];

interface OnboardingStepperProps {
  currentStep: OnboardingStep;
  subtitle?: string;
}

export function OnboardingStepper({
  currentStep,
  subtitle,
}: OnboardingStepperProps) {
  return (
    <div className="w-full max-w-3xl mx-auto mb-10">
      <div className="flex items-center">
        {STEPS.map(({ step, label }, index) => {
          const isCompleted = step < currentStep;
          const isActive = step === currentStep;
          const connectorComplete =
            index > 0 && currentStep > STEPS[index - 1].step;

          return (
            <div key={step} className="contents">
              {index > 0 ? (
                <div
                  aria-hidden
                  className={`flex-1 h-0.5 min-w-3 transition-colors duration-300 ${
                    connectorComplete ? 'bg-primary' : 'bg-stone-200'
                  }`}
                />
              ) : null}

              <div className="flex flex-col items-center gap-2 shrink-0 px-1">
                <div
                  className={`flex items-center justify-center rounded-full font-bold transition-all duration-300 ${
                    isActive ? 'w-11 h-11 text-base' : 'w-9 h-9 text-sm'
                  } ${
                    isCompleted || isActive
                      ? 'bg-primary text-white shadow-sm'
                      : 'bg-white border-2 border-stone-300 text-stone-400'
                  }`}
                >
                  {isCompleted ? (
                    <span className="material-symbols-outlined text-lg">check</span>
                  ) : (
                    step
                  )}
                </div>
                <span
                  className={`text-label-caps whitespace-nowrap ${
                    isActive ? 'text-primary' : 'text-stone-400'
                  }`}
                >
                  {label}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {subtitle ? (
        <p className="text-center text-label-caps text-stone-500 mt-6">
          {subtitle}
        </p>
      ) : null}
    </div>
  );
}
