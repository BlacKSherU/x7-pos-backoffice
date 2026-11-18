import { defineConfig, devices } from '@playwright/test';

// E2E real de Platform SaaS: companies, merchants y users (e2e/real/saas, historias 1-7). No
// arranca servidores: los levanta e2e/real/saas/stack.mjs en puertos propios (Postgres 54351,
// API 3111, Vite 5283), así nunca toca el backend :3001 ni el backoffice :5173 de desarrollo.
export default defineConfig({
  testDir: './e2e/real/saas',
  // Aparte de test-results/saas-real (capturas y logs), que Playwright no debe vaciar
  outputDir: './test-results/saas-real-artifacts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  timeout: 240_000,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://127.0.0.1:5283',
    trace: 'retain-on-failure',
    viewport: { width: 1440, height: 900 },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } }],
});
