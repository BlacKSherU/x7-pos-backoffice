import { defineConfig, devices } from '@playwright/test';

// E2E real de cobros con tarjeta (e2e/real/payments). No arranca servidores: los levanta
// e2e/real/payments/stack.mjs en puertos propios (Postgres 54331, API 3101, gateway falso
// 4599, Vite 5273), así nunca toca el backend :3001 ni el backoffice :5173 de desarrollo.
export default defineConfig({
  testDir: './e2e/real/payments',
  // Aparte de test-results/payments-real (capturas y logs), que Playwright no debe vaciar
  outputDir: './test-results/payments-real-artifacts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  timeout: 180_000,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://127.0.0.1:5273',
    trace: 'retain-on-failure',
    viewport: { width: 1440, height: 900 },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } }],
});
