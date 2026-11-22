import { defineConfig, devices } from '@playwright/test';

// E2E real de Billing & Transactions (e2e/real/billing, historias 1-22). No arranca servidores:
// los levanta e2e/real/billing/stack.mjs en puertos propios (Postgres 54361, API 3121, Vite 5293),
// así nunca toca el backend :3001 ni el backoffice :5173 de desarrollo.
export default defineConfig({
  testDir: './e2e/real/billing',
  // Aparte de test-results/billing-real (capturas y logs), que Playwright no debe vaciar
  outputDir: './test-results/billing-real-artifacts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  timeout: 240_000,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://127.0.0.1:5293',
    trace: 'retain-on-failure',
    viewport: { width: 1440, height: 900 },
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
        // E2E_BROWSER_CHANNEL=chrome usa el Google Chrome instalado en vez del Chromium de Playwright
        ...(process.env.E2E_BROWSER_CHANNEL ? { channel: process.env.E2E_BROWSER_CHANNEL } : {}),
      },
    },
  ],
});
