// Carga de Stripe.js y URL del iFrame de CardSecure (sin componentes, para fast refresh).

const scriptLoads = new Map<string, Promise<void>>();

/** Carga Stripe.js una sola vez por URL. */
export function loadScript(src: string): Promise<void> {
  const existing = scriptLoads.get(src);
  if (existing) return existing;
  const loading = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      scriptLoads.delete(src);
      reject(new Error('The card form could not be loaded. Check your connection and try again.'));
    };
    document.head.appendChild(script);
  });
  scriptLoads.set(src, loading);
  return loading;
}

const CARDSECURE_CSS = [
  'body{margin:0;font-family:Poppins,sans-serif;font-size:14px;color:#1d1c17}',
  'input{box-sizing:border-box;width:100%;padding:8px 10px;border:1px solid #e8e2d8;border-radius:4px;font-size:14px;margin-bottom:6px}',
  'input:focus{outline:none;border-color:#ae001a}',
  '.error{color:#ae001a}',
].join('');

export function cardSecureSrc(iframeUrl: string): string {
  const params = new URLSearchParams({
    useexpiry: 'true',
    usecvv: 'true',
    formatinput: 'true',
    invalidinputevent: 'true',
    tokenizewheninactive: 'true',
    css: CARDSECURE_CSS,
  });
  return `${iframeUrl}?${params.toString()}`;
}

