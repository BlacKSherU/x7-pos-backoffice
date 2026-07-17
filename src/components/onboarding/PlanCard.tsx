import { useState } from 'react';
import type { SubscriptionTier } from '../../types/onboarding';

const FALLBACK_IMAGE =
  'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="80" viewBox="0 0 200 80"%3E%3Crect fill="%23e8e2d8" width="200" height="80"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" fill="%235f5e5e" font-family="sans-serif" font-size="12"%3EPlan%3C/text%3E%3C/svg%3E';

interface PlanCardProps {
  tier: SubscriptionTier;
  isSelected: boolean;
  onSelect: () => void;
}

export function PlanCard({ tier, isSelected, onSelect }: PlanCardProps) {
  const [imageError, setImageError] = useState(false);

  return (
    <article
      className={`surface-paper w-[240px] shrink-0 rounded-lg flex flex-col transition-all duration-300 hover:shadow-md cursor-pointer overflow-hidden ${
        isSelected
          ? 'border-2 border-primary shadow-lg ring-2 ring-primary/10'
          : 'border border-border hover:border-stone-300'
      }`}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect();
        }
      }}
      role="button"
      tabIndex={0}
    >
      {tier.recommended ? (
        <div className="bg-primary text-white text-center text-label-caps py-1.5 flex items-center justify-center gap-1">
          <span className="material-symbols-outlined text-sm">star</span>
          Recommended
        </div>
      ) : null}

      <div
        className={`h-1 ${tier.recommended || isSelected ? 'bg-primary' : 'bg-text'}`}
      />

      <div className="p-5 flex flex-col grow">
        <span className="inline-block self-start text-label-caps bg-text text-white px-2 py-0.5 mb-3">
          {tier.badge}
        </span>

        <h3 className="text-lg font-bold text-text uppercase tracking-wide">
          {tier.name}
        </h3>
        <p
          className={`text-base font-semibold mt-1 mb-3 ${
            isSelected ? 'text-primary' : 'text-text'
          }`}
        >
          {tier.price}
          {tier.priceLabel ? (
            <span className="text-xs font-normal text-text/60 ml-1 block sm:inline">
              {tier.priceLabel}
            </span>
          ) : null}
        </p>

        <div className="h-20 bg-stone-100 rounded mb-3 overflow-hidden">
          <img
            alt={`${tier.name} plan`}
            className="w-full h-full object-cover"
            loading="lazy"
            onError={() => setImageError(true)}
            src={imageError ? FALLBACK_IMAGE : (tier.imageUrl ?? FALLBACK_IMAGE)}
          />
        </div>

        <ul className="space-y-1.5 mb-4 grow">
          {tier.features.map((feature) => (
            <li
              key={feature}
              className="flex items-start gap-2 text-body-sm text-text/80"
            >
              <span className="material-symbols-outlined text-primary text-base shrink-0">
                check_circle
              </span>
              {feature}
            </li>
          ))}
        </ul>

        <button
          className={`w-full py-2.5 rounded-lg font-semibold text-body-sm transition-all duration-200 ${
            isSelected
              ? 'bg-primary text-white'
              : 'bg-white border-2 border-text text-text hover:bg-stone-50'
          }`}
          onClick={(event) => {
            event.stopPropagation();
            onSelect();
          }}
          type="button"
        >
          {isSelected ? (
            <span className="flex items-center justify-center gap-2">
              Plan Selected
              <span className="material-symbols-outlined text-lg">done</span>
            </span>
          ) : tier.isCustom ? (
            'Contact Sales'
          ) : (
            `Select ${tier.name}`
          )}
        </button>
      </div>
    </article>
  );
}
