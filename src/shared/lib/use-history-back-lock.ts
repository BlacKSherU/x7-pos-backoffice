import { useEffect } from 'react';

/**
 * Prevents the browser back action from returning to a prior sensitive view
 * (e.g. password submission) while the user remains on the current screen.
 */
export function useHistoryBackLock(active: boolean): void {
  useEffect(() => {
    if (!active || typeof window === 'undefined') {
      return;
    }

    const lockUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;

    window.history.replaceState({ x7HistoryLock: true }, '', lockUrl);
    window.history.pushState({ x7HistoryLock: true }, '', lockUrl);

    function handlePopState() {
      window.history.pushState({ x7HistoryLock: true }, '', lockUrl);
    }

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [active]);
}
