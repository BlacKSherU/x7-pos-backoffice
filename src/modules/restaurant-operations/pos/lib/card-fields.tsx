// Campos de tarjeta que tokenizan en el navegador: el número nunca pasa por el backoffice
// ni por la API del POS (fuera del alcance PCI-DSS). Stripe usa Stripe.js (Card Element) y
// CardPointe el iFrame tokenizer de CardSecure; el backend dice cuál y con qué URL.
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { CheckoutTokenization } from '@/modules/restaurant-operations/pos/types/payments';
import { cardSecureSrc, loadScript } from '@/modules/restaurant-operations/pos/lib/card-tokenization';

export interface CardToken {
  token: string;
  /** MMYY (CardSecure); Stripe no lo necesita */
  expiry?: string;
}

export interface CardFieldHandle {
  /** Tokeniza lo escrito; lanza un Error con el mensaje para el usuario si no puede */
  tokenize: () => Promise<CardToken>;
}

interface CardFieldProps {
  tokenization: CheckoutTokenization;
  onCompleteChange: (complete: boolean) => void;
}

// ------------------------------------------------------------- Stripe.js

interface StripeCardElement {
  mount: (target: HTMLElement) => void;
  on: (event: 'change' | 'ready', handler: (e: { complete?: boolean; error?: { message: string } }) => void) => void;
  destroy: () => void;
}

interface StripeInstance {
  elements: () => { create: (type: 'card', options?: Record<string, unknown>) => StripeCardElement };
  createPaymentMethod: (opts: {
    type: 'card';
    card: StripeCardElement;
  }) => Promise<{ paymentMethod?: { id: string }; error?: { message: string } }>;
}

declare global {
  interface Window {
    Stripe?: (publishableKey: string) => StripeInstance;
  }
}

const StripeCardField = forwardRef<CardFieldHandle, CardFieldProps>(function StripeCardField(
  { tokenization, onCompleteChange },
  ref,
) {
  const mountRef = useRef<HTMLDivElement>(null);
  const stripeRef = useRef<StripeInstance | null>(null);
  const cardRef = useRef<StripeCardElement | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const completeChange = useRef(onCompleteChange);
  completeChange.current = onCompleteChange;

  useEffect(() => {
    let cancelled = false;
    const { scriptUrl, publishableKey } = tokenization;
    if (!scriptUrl || !publishableKey) return undefined;
    loadScript(scriptUrl)
      .then(() => {
        if (cancelled || !mountRef.current || !window.Stripe) return;
        const stripe = window.Stripe(publishableKey);
        const card = stripe.elements().create('card', {
          hidePostalCode: true,
          style: { base: { fontFamily: 'Poppins, sans-serif', fontSize: '14px', color: '#1d1c17' } },
        });
        card.on('change', (e) => {
          setFieldError(e.error?.message ?? null);
          completeChange.current(Boolean(e.complete));
        });
        card.mount(mountRef.current);
        stripeRef.current = stripe;
        cardRef.current = card;
        setReady(true);
      })
      .catch((err: Error) => {
        if (!cancelled) setLoadError(err.message);
      });
    return () => {
      cancelled = true;
      cardRef.current?.destroy();
      cardRef.current = null;
    };
  }, [tokenization]);

  useImperativeHandle(ref, () => ({
    async tokenize() {
      if (!stripeRef.current || !cardRef.current) {
        throw new Error('The card form is not ready yet');
      }
      const result = await stripeRef.current.createPaymentMethod({ type: 'card', card: cardRef.current });
      if (result.error || !result.paymentMethod) {
        throw new Error(result.error?.message ?? 'The card could not be tokenized');
      }
      return { token: result.paymentMethod.id };
    },
  }));

  return (
    <div className="flex flex-col gap-1.5">
      <div
        ref={mountRef}
        data-testid="stripe-card-element"
        aria-busy={!ready}
        className="bg-white px-3 py-2.5 border border-[#e8e2d8] rounded text-sm min-h-[40px] focus-within:border-[#ae001a] focus-within:ring-1 focus-within:ring-[#ae001a]"
      />
      {!ready && !loadError && <div className="text-[11px] text-[#5f5e5e]">Loading secure card form…</div>}
      {(loadError || fieldError) && (
        <div role="alert" className="text-[12px] text-[#ae001a] font-medium">
          {loadError ?? fieldError}
        </div>
      )}
    </div>
  );
});

// --------------------------------------------------------------- CardSecure

const CardSecureField = forwardRef<CardFieldHandle, CardFieldProps>(function CardSecureField(
  { tokenization, onCompleteChange },
  ref,
) {
  const [token, setToken] = useState<CardToken | null>(null);
  const [error, setError] = useState<string | null>(null);
  const iframeUrl = tokenization.iframeUrl ?? '';
  const completeChange = useRef(onCompleteChange);
  completeChange.current = onCompleteChange;

  useEffect(() => {
    let origin = '';
    try {
      origin = new URL(iframeUrl).origin;
    } catch {
      return undefined;
    }
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== origin) return;
      let data: { message?: string; expiry?: string; validationError?: string };
      try {
        data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
      } catch {
        return;
      }
      if (data.validationError) {
        setError(data.validationError);
        setToken(null);
        completeChange.current(false);
        return;
      }
      if (data.message) {
        setError(null);
        const next = { token: data.message, expiry: data.expiry || undefined };
        setToken(next);
        completeChange.current(Boolean(next.expiry && next.expiry.length === 4));
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [iframeUrl]);

  useImperativeHandle(ref, () => ({
    async tokenize() {
      if (!token) throw new Error(error ?? 'Enter the card number');
      if (!token.expiry || token.expiry.length !== 4) throw new Error('Enter the card expiry (MMYY)');
      return token;
    },
  }));

  return (
    <div className="flex flex-col gap-1.5">
      <iframe
        title="Secure card entry"
        src={cardSecureSrc(iframeUrl)}
        className="w-full h-[96px] border-0"
        data-testid="cardsecure-iframe"
      />
      {token && !error && (
        <div className="text-[11px] text-green-700 font-medium flex items-center gap-1">
          <span aria-hidden="true" className="material-symbols-outlined text-sm">lock</span>
          Card tokenized ending in {token.token.slice(-4)}
        </div>
      )}
      {error && (
        <div role="alert" className="text-[12px] text-[#ae001a] font-medium">
          {error}
        </div>
      )}
    </div>
  );
});

/** Campo de tarjeta según el método de tokenización de la configuración. */
export const CardField = forwardRef<CardFieldHandle, CardFieldProps>(function CardField(props, ref) {
  if (props.tokenization.method === 'stripe_js') return <StripeCardField ref={ref} {...props} />;
  if (props.tokenization.method === 'cardsecure_iframe') return <CardSecureField ref={ref} {...props} />;
  return (
    <div role="alert" className="text-sm text-[#ae001a] font-medium">
      {props.tokenization.reason ?? 'Card payments are not available for this gateway'}
    </div>
  );
});
