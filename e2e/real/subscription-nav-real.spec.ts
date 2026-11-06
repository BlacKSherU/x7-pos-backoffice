// E2E REAL de la NavHubBar del Subscription System (panel SaaS y workspace de comercio).
// Mismas condiciones que delivery-real.spec.ts: sólo con E2E_REAL=1 y backend vivo.

import { expect, test, type Page } from '@playwright/test';

const REAL = process.env.E2E_REAL === '1';
const EMAIL = process.env.E2E_EMAIL ?? 'admin@x7delivery-e2e.com';
const PORTAL_EMAIL = process.env.E2E_PORTAL_EMAIL ?? 'portal@x7delivery-e2e.com';
const PASSWORD = process.env.E2E_PASSWORD ?? 'E2ePass123';
const SHOTS = process.env.E2E_SHOTS ?? 'test-results/delivery-real';
const RED = 'rgb(174, 0, 26)';

const LABELS = [
  'Platform Applications Catalog',
  'Feature Flags & Entitlements',
  'Merchant Subscriptions Directory',
  'Plan Application Inclusions',
  'Plan Feature Capabilities Mapping',
  'Software Subscription Plans',
  'Active Merchant Applications',
  'Subscription Billing Invoices',
];

test.describe.configure({ mode: 'serial', timeout: 90_000 });
test.skip(!REAL, 'E2E real: exporta E2E_REAL=1 con el backend y la base de pruebas levantados');

const bar = (page: Page) =>
  page.getByRole('navigation', { name: /Subscription System module navigation/i });

const expectBar = async (page: Page, active?: string) => {
  for (const label of LABELS) {
    await expect(bar(page).getByRole('button', { name: label, exact: true })).toBeVisible();
  }
  await expect(
    bar(page).getByRole('button', { name: 'SUBSCRIPTION SYSTEM COMMAND HUB' }),
  ).toBeVisible();
  if (active) {
    const current = bar(page).getByRole('button', { name: active, exact: true });
    await expect(current).toHaveAttribute('aria-current', 'page');
    await expect
      .poll(() => current.evaluate((el) => getComputedStyle(el).backgroundColor))
      .toBe(RED);
  }
};

test('panel SaaS: barra con las 8 opciones, opción activa y regreso al hub', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/saas-admin');
  await page.fill('input[type=email]', PORTAL_EMAIL);
  await page.fill('input[type=password]', PASSWORD);
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Software Subscription Plans' }).first().click();
  await expectBar(page, 'Software Subscription Plans');
  // El botón flotante "+" de la vista no puede tapar la barra.
  const fab = page.locator('button.fixed.rounded-full').first();
  const fabBox = await fab.boundingBox();
  const barTop = Math.min(
    ...(await bar(page)
      .getByRole('button')
      .evaluateAll((els) => els.map((e) => e.getBoundingClientRect().top))),
  );
  expect(
    fabBox && fabBox.y + fabBox.height,
    'el botón flotante queda por encima de la barra',
  ).toBeLessThanOrEqual(barTop);
  await page.screenshot({ path: `${SHOTS}/30-saas-subscription-plans.png`, fullPage: true });

  await bar(page).getByRole('button', { name: 'Platform Applications Catalog', exact: true }).click();
  await expectBar(page, 'Platform Applications Catalog');

  // Sin plan elegido, Plan Feature Capabilities Mapping pide elegir uno (no cae en una pantalla vacía).
  await bar(page)
    .getByRole('button', { name: 'Plan Feature Capabilities Mapping', exact: true })
    .click();
  await expectBar(page, 'Plan Feature Capabilities Mapping');
  await expect(page.getByRole('button', { name: /choose a plan/i })).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/31-saas-plan-features-choose.png`, fullPage: true });

  await bar(page)
    .getByRole('button', { name: 'Merchant Subscriptions Directory', exact: true })
    .click();
  await expectBar(page, 'Merchant Subscriptions Directory');
  await expect(page.getByText(/In Development/i).first()).toBeVisible();

  await bar(page).getByRole('button', { name: 'SUBSCRIPTION SYSTEM COMMAND HUB' }).click();
  await expect(page.getByText(/Subscription System Command Hub/i).first()).toBeVisible();
  await expectBar(page);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${SHOTS}/32-saas-subscription-hub.png`, fullPage: true });
});

test('workspace de comercio: misma barra al entrar por el menú lateral', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/login');
  await page.fill('input[type=email]', EMAIL);
  await page.fill('input[type=password]', PASSWORD);
  await page.keyboard.press('Enter');
  await page.waitForURL(/dashboard/);
  // Un admin de comercio sólo ve en el menú las opciones de suscripción de su lado.
  const aside = page.locator('aside');
  await aside.getByText('Platform SaaS').first().click();
  await aside.getByText('Subscription System').first().click();
  await aside.getByText('Merchant Subscriptions Directory').first().click();
  await expectBar(page, 'Merchant Subscriptions Directory');
  // Desde la barra se llega a cualquier opción del módulo.
  await bar(page)
    .getByRole('button', { name: 'Subscription Billing Invoices', exact: true })
    .click();
  await expectBar(page, 'Subscription Billing Invoices');
  await bar(page)
    .getByRole('button', { name: 'Feature Flags & Entitlements', exact: true })
    .click();
  await expectBar(page, 'Feature Flags & Entitlements');
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${SHOTS}/33-merchant-subscription-features.png`, fullPage: true });
});
