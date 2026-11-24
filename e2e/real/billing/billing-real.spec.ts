// E2E real de Billing & Transactions: hub, Receipts, Receipt Items, Receipt Taxes, Financial
// Ledger Sync, Inventory & Billing Stock Sync, Business Partners Billing Link y Billing Reports.
// Chromium contra la API NestJS y Postgres, sin mocks. Lo levanta y apaga
// e2e/real/billing/stack.mjs con los datos de seed.sql; no corre con `npm run test:e2e`.
//
// Recorre un ciclo de vida completo: emite un recibo nuevo, le agrega líneas e impuestos, lo
// bloquea (y comprueba que la API rechaza cambios), lo pasa al libro mayor, valida stock, lo
// enlaza a un socio y lo encuentra en los reportes. Cada pantalla y cada acción deja una captura
// (E2E_SHOTS). La ejecución falla ante cualquier error o aviso de consola, pageerror, respuesta
// HTTP >= 400 no provocada a propósito (>= 500 nunca), desborde horizontal a 1440 px o a 390 px,
// títulos sin Poppins o iconos sin Material Symbols Outlined.
import { readFileSync } from 'node:fs';
import { expect, test, type Browser, type Locator, type Page, type Response } from '@playwright/test';

test.skip(process.env.E2E_BILLING_REAL !== '1', 'Run through e2e/real/billing/stack.mjs');
// Sin modo serial: si una prueba falla, las siguientes siguen corriendo (cada una abre su
// pantalla por URL) y una sola ejecución muestra todos los fallos.

const API = process.env.E2E_API ?? 'http://127.0.0.1:3121/api';
const SHOTS = process.env.E2E_SHOTS ?? 'test-results/billing-real';
const ADMIN = { email: 'admin@harborbistro-e2e.com', password: 'E2eBillingOwner123!' };

// Ids de seed.sql y de lo que crea la prueba (secuencias tras el seed)
const NEW_INVOICE = { id: 9, label: 'INV-000008' }; // NEW RECEIPT sobre la orden 9 (INVOICE)
const NEW_RECEIPT = { id: 10, label: 'INV-000009' }; // NEW RECEIPT sobre la orden 9 (RECEIPT), luego anulado
const NEW_BURGER_LINE = 14;
const NEW_SALAD_LINE = 15;
const NEW_CITY_TAX = 12;

let page: Page;
// Capturas <sección>-<paso>-<nombre>.png: la sección sale del título de la prueba, así un
// reinicio del worker tras un fallo no reinicia ni pisa la numeración.
const SECTIONS = [
  'the merchant admin opens',
  'Receipts: KPIs',
  'Receipts: locked receipt',
  'Receipts: issue new',
  'Receipt Items:',
  'Receipt Taxes:',
  'Receipts: lock the new',
  'Ledger Sync:',
  'Inventory Sync:',
  'Partner Link:',
  'Reports:',
  'every billing screen',
];
let section = '00';
let step = 0;
let totalShots = 0;

// ---- puertas de cero errores -------------------------------------------------------------

const gates = { console: [] as string[], pageErrors: [] as string[], http: [] as string[], serverErrors: [] as string[] };
const expectedFailures: Array<{ status: number; url: string; seen: number }> = [];
const expectedFailureUrls = new Set<string>();
const checks = { tables: 0, layoutDesktop: 0, layoutMobile: 0, fonts: 0, icons: 0, downloads: 0 };

const expectFailure = (status: number, url: string) => expectedFailures.push({ status, url, seen: 0 });
const settleExpectedFailures = () => {
  const missing = expectedFailures.filter((e) => e.seen === 0).map((e) => `${e.status} ${e.url}`);
  expectedFailures.length = 0;
  expect(missing, 'provoked failures that never happened').toEqual([]);
};

function watch(p: Page) {
  p.on('console', (msg) => {
    const type = msg.type();
    if (type !== 'error' && type !== 'warning') return;
    const text = msg.text();
    if (/Failed to load resource/.test(text) && expectedFailureUrls.has(msg.location().url)) return;
    gates.console.push(`[${type}] ${text} @ ${msg.location().url}`);
  });
  p.on('pageerror', (err) => gates.pageErrors.push(`${err.message}\n${err.stack ?? ''}`));
  p.on('response', (res: Response) => {
    const status = res.status();
    if (status < 400) return;
    const url = res.url();
    const line = `${status} ${res.request().method()} ${url}`;
    if (status >= 500) {
      gates.serverErrors.push(line);
      return;
    }
    const expected = expectedFailures.find((e) => e.status === status && new URL(url).pathname.endsWith(e.url));
    if (expected) {
      expected.seen += 1;
      expectedFailureUrls.add(url);
    } else {
      gates.http.push(line);
    }
  });
}

const expectNoErrorsSoFar = (label: string) => {
  expect(gates.pageErrors, `pageerror after ${label}`).toEqual([]);
  expect(gates.serverErrors, `HTTP >= 500 after ${label}`).toEqual([]);
  expect(gates.http, `unexpected HTTP >= 400 after ${label}`).toEqual([]);
  expect(gates.console, `console errors/warnings after ${label}`).toEqual([]);
};

// ---- utilidades de pantalla --------------------------------------------------------------

const settle = async () => {
  await page.waitForLoadState('networkidle');
  await expect(page.locator('main .animate-spin')).toHaveCount(0, { timeout: 15_000 });
  // las vistas entran con una animación de opacidad
  await page.waitForTimeout(450);
};

const expectNoOverflow = async (label: string) => {
  const box = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, inner: window.innerWidth }));
  expect(box.scroll, `horizontal overflow on ${label} at ${box.inner}px`).toBeLessThanOrEqual(box.inner);
  if (box.inner < 768) return;
  // A 1440 px ninguna tabla debe esconder columnas (p. ej. Actions) tras un scroll horizontal interno
  const clipped = await page.evaluate(() =>
    Array.from(document.querySelectorAll('main table'))
      .map((table) => {
        const scroller = table.closest('.overflow-x-auto') as HTMLElement | null;
        if (!scroller || scroller.scrollWidth <= scroller.clientWidth + 1) return null;
        return `${table.getAttribute('aria-label') ?? 'table'}: ${scroller.scrollWidth} > ${scroller.clientWidth}`;
      })
      .filter(Boolean),
  );
  expect(clipped, `tables scrolling horizontally on ${label} at ${box.inner}px`).toEqual([]);
  checks.tables += clipped.length === 0 ? 1 : 0;
};

/** Captura de toda la vista: el layout desplaza <main>, no el documento. */
const fullShot = async (path: string) => {
  const viewport = page.viewportSize()!;
  const extra = await page.evaluate(() => {
    const main = document.querySelector('main');
    return main ? Math.max(0, main.scrollHeight - main.clientHeight) : 0;
  });
  if (extra > 0) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height + extra });
    await page.waitForTimeout(150);
  }
  await page.screenshot({ path, fullPage: true });
  if (extra > 0) await page.setViewportSize(viewport);
};

/** Captura de la ventana tal cual (cajones y diálogos abiertos encima de la vista). */
const shot = async (name: string, { full = true }: { full?: boolean } = {}) => {
  step += 1;
  totalShots += 1;
  await settle();
  await expectNoOverflow(name);
  if ((page.viewportSize()?.width ?? 0) < 768) checks.layoutMobile += 1;
  else checks.layoutDesktop += 1;
  const path = `${SHOTS}/${section}-${String(step).padStart(2, '0')}-${name}.png`;
  if (full) await fullShot(path);
  else await page.screenshot({ path });
  expectNoErrorsSoFar(name);
};

const expectPoppins = async (l: Locator) => {
  expect(await l.evaluate((el) => getComputedStyle(el).fontFamily)).toContain('Poppins');
  expect(await page.evaluate(() => document.fonts.check('700 16px Poppins'))).toBe(true);
  checks.fonts += 1;
};

const expectSymbol = async (l: Locator) => {
  expect(await l.evaluate((el) => getComputedStyle(el).fontFamily)).toContain('Material Symbols Outlined');
  expect(await page.evaluate(() => document.fonts.check('24px "Material Symbols Outlined"'))).toBe(true);
  const box = (await l.boundingBox())!;
  expect(box.width, 'icon rendered as text').toBeLessThanOrEqual(box.height * 1.3 + 2);
  checks.icons += 1;
};

const toast = (text: string | RegExp) => page.getByRole('status').filter({ hasText: text });
const expectToast = async (text: string | RegExp) => {
  await expect(toast(text).first()).toBeVisible();
};
const dialog = (name: string | RegExp) => page.getByRole('dialog', { name });
const navBar = () => page.getByRole('navigation', { name: 'Billing & Transactions module navigation' });
const goNav = async (label: string) => {
  await navBar().getByRole('button', { name: label, exact: true }).click();
  await expect(navBar().getByRole('button', { name: label, exact: true })).toHaveAttribute('aria-current', 'page');
  await settle();
};

const NAV_LABELS = ['Receipts', 'Receipt Items', 'Receipts Taxes', 'Ledger Sync', 'Partner Link', 'Inventory Sync', 'Reports'];
const expectNavBar = async (active: string) => {
  const names = await navBar()
    .getByRole('button')
    .evaluateAll((els) =>
      els.map((el) => {
        if (el.getAttribute('aria-label')) return el.getAttribute('aria-label');
        const clone = el.cloneNode(true) as HTMLElement;
        clone.querySelectorAll('.material-symbols-outlined').forEach((icon) => icon.remove());
        return (clone.textContent ?? '').trim();
      }),
    );
  expect(names.slice(0, 1 + NAV_LABELS.length)).toEqual(['BILLING & TRANSACTIONS COMMAND HUB', ...NAV_LABELS]);
  await expect(navBar().getByRole('button', { name: active, exact: true })).toHaveAttribute('aria-current', 'page');
};

const waitApi = (method: string, path: RegExp) =>
  page.waitForResponse((r) => r.request().method() === method && path.test(new URL(r.url()).pathname) && r.status() < 400);

const openScreen = async (path: string) => {
  await page.goto(path);
  await settle();
};

async function login(p: Page, screenshotName?: string) {
  await p.goto('/login');
  await p.waitForLoadState('networkidle');
  await p.locator('#email').fill(ADMIN.email);
  await p.locator('#password').fill(ADMIN.password);
  await p.locator('#remember').check();
  if (screenshotName) await shot(screenshotName, { full: false });
  await p.getByRole('button', { name: /Login/ }).click();
  await p.waitForURL(/dashboard/, { timeout: 30_000 });
  await p.waitForLoadState('networkidle');
}

async function apiToken(): Promise<string> {
  const res = await page.request.post(`${API}/auth/login`, { data: ADMIN });
  expect(res.ok()).toBe(true);
  return (await res.json()).access_token as string;
}

test.beforeAll(async ({ browser }: { browser: Browser }) => {
  page = await browser.newPage({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  // Print / PDF abre el diálogo nativo de impresión: se sustituye para no bloquear la prueba
  await page.addInitScript(() => {
    (window as unknown as { __printCalls: number }).__printCalls = 0;
    window.print = () => {
      (window as unknown as { __printCalls: number }).__printCalls += 1;
    };
  });
  watch(page);
  section = '00';
  step = 0;
  await login(page, 'login');
});

test.beforeEach(async () => {
  const testInfo = test.info();
  const index = SECTIONS.findIndex((prefix) => testInfo.title.startsWith(prefix));
  expect(index, `section for "${testInfo.title}"`).toBeGreaterThanOrEqual(0);
  section = String(index + 1).padStart(2, '0');
  step = 0;
  // cada prueba arranca con las puertas limpias: un fallo anterior ya quedó reportado
  for (const list of Object.values(gates)) list.length = 0;
  expectedFailures.length = 0;
  if (page.viewportSize()?.width !== 1440) await page.setViewportSize({ width: 1440, height: 900 });
});

test.afterAll(async () => {
  await page?.close();
  console.log(`[billing-e2e] screenshots: ${totalShots} · layout checks desktop ${checks.layoutDesktop} (tables without inner scroll ${checks.tables}) / mobile ${checks.layoutMobile} · Poppins ${checks.fonts} · icons ${checks.icons} · downloads ${checks.downloads}`);
});

// ---- Login y hub ---------------------------------------------------------------------------

test('the merchant admin opens the Billing & Transactions hub with its seven live screens', async () => {
  await openScreen('/app/billing-transactions');
  const title = page.locator('main h1').first();
  await expect(title).toHaveText('Billing & Transactions Command Hub');
  await expectPoppins(title);
  for (const card of [
    'Customer Sales Receipts',
    'Itemized Receipt Line Items',
    'Receipt Tax Line Breakdown',
    'Financial Ledger Sync',
    'Business Partners Billing Link',
    'Inventory & Billing Stock Sync',
    'Billing Reports',
  ]) {
    await expect(page.locator('main h3').filter({ hasText: new RegExp(`^${card.replace(/[&]/g, '\\$&')}$`) })).toBeVisible();
  }
  // las 7 pantallas están live: ninguna tarjeta se anuncia "In Development"
  for (const badge of ['Receipts Live', 'Line Items Live', 'Tax Lines Live', 'Ledger Sync Live', 'Partner Link Live', 'Stock Sync Live', 'Reports Live']) {
    await expect(page.locator('main').getByText(badge, { exact: true })).toBeVisible();
  }
  await expect(page.locator('main').getByText('In Development', { exact: true })).toHaveCount(1); // solo el KPI
  await shot('billing-hub');

  await page.locator('main h3').filter({ hasText: /^Customer Sales Receipts$/ }).click();
  await expect(page.getByTestId('receipts-view')).toBeVisible();
  await settle();
});

// ---- Receipts ------------------------------------------------------------------------------

test('Receipts: KPIs, tax breakdown, filters, expandable lines and the navigation bar', async () => {
  await openScreen('/app/billing-transactions/receipt-orders');
  const kpi = (id: string) => page.getByTestId(`receipts-kpi-${id}`);
  await expect(kpi('count')).toContainText('6');
  await expect(kpi('count')).toContainText('2 fiscally locked');
  await expect(kpi('volume')).toContainText('228.28 USD');
  await expect(kpi('tax')).toContainText('14.78 USD');
  await expect(kpi('tax')).toContainText('6.00 USD');
  await expect(kpi('average')).toContainText('38.05 USD');
  await expect(kpi('average')).toContainText('1 logically deleted');
  await expect(page.getByTestId('receipts-tax-total-card')).toContainText('14.78 USD');
  await expect(page.getByRole('button', { name: /^All types/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-testid^="receipt-row-"]')).toHaveCount(6);
  await expect(page.getByTestId('receipt-1-locked')).toContainText('Locked');
  await expect(page.getByTestId('receipt-7-tax-exempt')).toContainText(/TAX EXEMPT/i);
  await expectNavBar('Receipts');
  await expectPoppins(page.getByRole('heading', { name: 'Billing & Transactions', exact: true }));
  await expectSymbol(navBar().getByRole('button', { name: 'BILLING & TRANSACTIONS COMMAND HUB' }).locator('.material-symbols-outlined'));
  await shot('receipts-ledger');

  // chips por tipo
  await page.getByRole('button', { name: /^Invoices/ }).click();
  await settle();
  await expect(page.locator('[data-testid^="receipt-row-"]')).toHaveCount(3);
  await shot('receipts-filter-invoices');
  await page.getByRole('button', { name: /^Receipts \d/ }).click();
  await settle();
  await expect(page.locator('[data-testid^="receipt-row-"]')).toHaveCount(3);
  await page.getByRole('button', { name: /^All types/ }).click();

  // búsqueda por número o datos fiscales
  await page.getByRole('searchbox', { name: 'Search receipts' }).fill('Acme Catering');
  await settle();
  await expect(page.locator('[data-testid^="receipt-row-"]')).toHaveCount(2); // INV-000001 e INV-000007 (fiscal_data)
  await shot('receipts-search-fiscal-data');
  await page.getByRole('searchbox', { name: 'Search receipts' }).fill('');

  // estado: inactivos y rango de fechas
  await page.getByRole('combobox', { name: 'Filter by status' }).selectOption('inactive');
  await settle();
  await expect(page.locator('[data-testid^="receipt-row-"]')).toHaveCount(1);
  const voided = page.getByTestId('receipt-row-5');
  await expect(voided.getByRole('button', { name: 'View INV-000005' })).toBeVisible();
  await expect(voided.getByRole('button', { name: 'Edit INV-000005' })).toHaveCount(0);
  await shot('receipts-inactive');
  await page.getByRole('combobox', { name: 'Filter by status' }).selectOption('active');
  const today = await page.evaluate(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  await page.getByLabel('Created from').fill(today);
  await settle();
  await expect(page.getByTestId('receipts-tax-breakdown-range')).toContainText('Since');
  await shot('receipts-date-range');
  await page.getByRole('button', { name: 'Clear filters' }).first().click();
  await settle();
  await expect(page.locator('[data-testid^="receipt-row-"]')).toHaveCount(6);

  // fila expandible: líneas e impuestos del recibo
  await page.getByRole('button', { name: 'Expand INV-000001' }).click();
  await expect(page.getByTestId('receipt-1-items-total')).toContainText('28.00');
  await expect(page.getByTestId('receipt-1-taxes-total')).toContainText('2.66');
  await shot('receipts-expanded-lines');
  await page.getByRole('button', { name: 'Collapse INV-000001' }).click();

  // recargas
  const summary = waitApi('GET', /\/receipts\/summary$/);
  await page.getByRole('button', { name: 'Refresh metrics' }).click();
  await summary;
  const list = waitApi('GET', /\/receipts$/);
  await page.getByRole('button', { name: 'Reload receipts' }).click();
  await list;
});

test('Receipts: locked receipt details, adjustment notes (credit / debit) and the activity log', async () => {
  await openScreen('/app/billing-transactions/receipt-orders');
  await page.getByTestId('receipt-row-1').getByRole('button', { name: 'View INV-000001' }).click();
  const details = dialog('INV-000001');
  await expect(details).toBeVisible();
  await expect(details.getByTestId('receipt-detail-locked-by')).toContainText('merchant_admin');
  await expect(details.getByTestId('receipt-detail-balance')).toHaveAttribute('data-balanced', 'true');
  await expect(details.getByTestId('receipt-adjustment-1')).toContainText('CN-000001');
  await expect(details.getByTestId('receipt-detail-adjusted-net')).toContainText('26.66');
  await expect(details.getByTestId('receipt-detail-immutable')).toContainText('Fiscally locked');
  await shot('receipt-details-locked', { full: false });

  await details.getByRole('button', { name: 'ISSUE ADJUSTMENT NOTE' }).click();
  const adjust = dialog('Adjust INV-000001');
  await expect(adjust).toBeVisible();
  await expect(adjust.getByTestId('adjustment-current-net')).toContainText('26.66');
  // una nota de crédito no puede superar el saldo disponible
  await adjust.locator('#adjustment-amount').fill('30');
  await adjust.locator('#adjustment-reason').selectOption({ label: 'Refund' });
  await adjust.getByRole('button', { name: 'ISSUE ADJUSTMENT NOTE' }).click();
  await expect(adjust.getByText(/Credit notes cannot exceed the grand total/)).toBeVisible();
  await shot('adjustment-credit-over-limit', { full: false });

  await adjust.getByRole('radio', { name: /Debit Note/ }).check();
  await adjust.locator('#adjustment-amount').fill('2.50');
  await adjust.locator('#adjustment-reason').selectOption({ label: 'Missed charge' });
  await expect(adjust.getByTestId('adjustment-projected-net')).toContainText('29.16');
  await shot('adjustment-debit-note-form', { full: false });
  const issued = waitApi('POST', /\/billing\/receipts\/1\/adjustments$/);
  await adjust.getByRole('button', { name: 'ISSUE ADJUSTMENT NOTE' }).click();
  await issued;
  await expectToast('Debit Note DN-000001 issued for INV-000001.');
  await shot('adjustment-debit-note-issued', { full: false });

  await page.getByTestId('receipt-row-1').getByRole('button', { name: 'View activity log for INV-000001' }).click();
  const activity = dialog('INV-000001');
  await expect(activity.getByTestId('activity-log-count')).toContainText('4 events · oldest first');
  await expect(activity.getByRole('list', { name: 'Activity timeline' })).toContainText('Adjustment issued');
  await shot('receipt-activity-log', { full: false });
  await activity.getByRole('button', { name: 'Close drawer' }).click();

  // recibo exento: nota de exención en la ficha y casilla marcada en el formulario
  await page.getByTestId('receipt-row-7').getByRole('button', { name: 'View INV-000007' }).click();
  const exempt = dialog('INV-000007');
  await expect(exempt.getByTestId('receipt-detail-exemption-note')).toBeVisible();
  await expect(exempt.getByTestId('receipt-detail-tax-exempt')).toContainText('Yes');
  await shot('receipt-details-tax-exempt', { full: false });
  await exempt.getByRole('button', { name: 'Edit Receipt' }).click();
  const editExempt = dialog('Edit INV-000007');
  await expect(editExempt.getByRole('checkbox', { name: 'Tax exempt customer' })).toBeChecked();
  await expect(editExempt.locator('#receipt-exemption-code')).toHaveValue('EX-2026-014');
  await editExempt.getByRole('button', { name: 'Cancel' }).click();
});

test('Receipts: issue new receipts from the order and currency selectors, edit fiscal data and deactivate one', async () => {
  await openScreen('/app/billing-transactions/receipt-orders');
  await page.getByRole('button', { name: 'New Receipt', exact: true }).click();
  const form = dialog('New Receipt');
  await form.getByRole('button', { name: 'Create Receipt' }).click();
  await expect(form.getByText('Select the order to bill.')).toBeVisible();
  await shot('new-receipt-validation', { full: false });

  // la moneda arranca en la moneda base de la company (USD) y se elige de la lista ISO 4217
  await expect(form.locator('#receipt-currency')).toContainText('USD');
  await form.locator('#receipt-type').selectOption('INVOICE');
  await form.locator('#receipt-order-id').click();
  await form.getByRole('combobox', { name: 'Search order' }).fill('0009');
  await shot('new-receipt-order-select', { full: false });
  await form.getByRole('listbox', { name: 'Order' }).getByRole('option', { name: /Order #0009 · ID 9/ }).click();
  await expect(form.locator('#receipt-order-id')).toContainText('Order #0009 · ID 9');
  await form.locator('#receipt-currency').click();
  await form.getByRole('combobox', { name: 'Search currency' }).fill('usd');
  await expect(form.getByRole('listbox', { name: 'Currency' }).getByRole('option').first()).toContainText('USD — US Dollar');
  await shot('new-receipt-currency-select', { full: false });
  await page.keyboard.press('Escape');
  await form.locator('#receipt-tax-id').fill('76.123.456-7');
  await shot('new-receipt-form', { full: false });
  const created = waitApi('POST', /\/receipts$/);
  await form.getByRole('button', { name: 'Create Receipt' }).click();
  await created;
  await expectToast(`${NEW_INVOICE.label} created.`);
  await expect(page.getByTestId(`receipt-row-${NEW_INVOICE.id}`)).toBeVisible();

  // la orden ya facturada no se ofrece para otra factura: el selector evita el 409
  await page.getByRole('button', { name: 'New Receipt', exact: true }).click();
  const duplicate = dialog('New Receipt');
  await duplicate.locator('#receipt-type').selectOption('INVOICE');
  await duplicate.locator('#receipt-order-id').click();
  await duplicate.getByRole('combobox', { name: 'Search order' }).fill('0009');
  await expect(duplicate.getByText('No orders left to bill as invoice.')).toBeVisible();
  await shot('new-receipt-duplicate-not-offered', { full: false });
  await page.keyboard.press('Escape');
  // el comprobante (RECEIPT) de la misma orden sí se permite
  await duplicate.locator('#receipt-type').selectOption('RECEIPT');
  await duplicate.locator('#receipt-order-id').click();
  await duplicate.getByRole('combobox', { name: 'Search order' }).fill('0009');
  await duplicate.getByRole('listbox', { name: 'Order' }).getByRole('option', { name: /Order #0009 · ID 9/ }).click();
  await duplicate.getByRole('button', { name: 'Create Receipt' }).click();
  await expectToast(`${NEW_RECEIPT.label} created.`);
  await expect(page.getByTestId(`receipt-row-${NEW_RECEIPT.id}`)).toBeVisible();
  await shot('receipts-after-create');

  // edición de datos fiscales de un recibo abierto
  await page.getByTestId('receipt-row-2').getByRole('button', { name: 'Edit INV-000002' }).click();
  const edit = dialog('Edit INV-000002');
  await edit.locator('#receipt-tax-id').fill('45-6789012');
  await shot('edit-receipt-form', { full: false });
  const patched = waitApi('PATCH', /\/receipts\/2$/);
  await edit.getByRole('button', { name: 'Save Changes' }).click();
  await patched;
  await expectToast('INV-000002 updated.');
  await page.getByTestId('receipt-row-2').getByRole('button', { name: 'View INV-000002' }).click();
  await expect(dialog('INV-000002')).toContainText('45-6789012');
  await dialog('INV-000002').getByRole('button', { name: 'Close drawer' }).click();

  // anulación lógica con confirmación
  await page.getByTestId(`receipt-row-${NEW_RECEIPT.id}`).getByRole('button', { name: `Deactivate ${NEW_RECEIPT.label}` }).click();
  await expect(page.getByTestId('receipts-view').getByText(/^Deactivating "INV-000009" is a logical deletion/)).toBeVisible();
  await shot('deactivate-receipt-confirm', { full: false });
  await page.getByTestId('receipts-view').getByRole('button', { name: 'Deactivate', exact: true }).click();
  await expectToast(`${NEW_RECEIPT.label} deactivated.`);
  await expect(page.getByTestId(`receipt-row-${NEW_RECEIPT.id}`)).toHaveCount(0);
  await expect(page.getByTestId('receipts-kpi-count')).toContainText('7');
});

// ---- Receipt Items -------------------------------------------------------------------------

test('Receipt Items: lines of every receipt, filters, add / edit / delete / restore with totals recalculated', async () => {
  await openScreen('/app/billing-transactions/receipt-orders');
  await goNav('Receipt Items');
  await expect(page.getByRole('main').getByRole('heading', { name: 'INVOICE LINE ITEMS', exact: true })).toBeVisible();
  await expect(page.getByTestId('receipt-items-count')).toContainText('11 lines');
  await expect(page.getByTestId('receipt-item-locked-1')).toHaveText(/Locked/);
  await expectNavBar('Receipt Items');
  await shot('receipt-items');

  await page.getByRole('searchbox', { name: 'Search by description or SKU' }).fill('BRG-001');
  await settle();
  await expect(page.getByTestId('receipt-items-count')).toContainText('4 lines');
  await shot('receipt-items-search-sku');
  await page.getByRole('button', { name: 'Reset' }).click();
  await page.getByRole('combobox', { name: 'Filter by invoice or receipt' }).selectOption('1');
  await settle();
  await expect(page.getByTestId('receipt-items-count')).toContainText('2 lines');
  await page.getByRole('button', { name: 'Reset' }).click();
  await settle();

  const linesRegion = page.getByRole('region', { name: 'Receipt line items' });
  // línea 1 del recibo nuevo
  await linesRegion.getByRole('button', { name: 'Add line item' }).click();
  let form = dialog('New receipt line item');
  await form.locator('#receipt-item-receipt').selectOption(String(NEW_INVOICE.id));
  await form.locator('#receipt-item-name').fill('Classic Burger');
  await form.locator('#receipt-item-sku').fill('BRG-001');
  await form.locator('#receipt-item-quantity').fill('2');
  await form.locator('#receipt-item-unit-price').fill('12');
  await expect(form.getByTestId('receipt-item-live-total')).toContainText('24.00');
  await shot('receipt-item-form', { full: false });
  await form.getByRole('button', { name: 'Add line item' }).click();
  await expectToast('Line "Classic Burger" added. Receipt totals recalculated.');

  // línea 2 con descuento; primero un descuento mayor que el subtotal
  await linesRegion.getByRole('button', { name: 'Add line item' }).click();
  form = dialog('New receipt line item');
  await form.locator('#receipt-item-receipt').selectOption(String(NEW_INVOICE.id));
  await form.locator('#receipt-item-name').fill('Caesar Salad');
  await form.locator('#receipt-item-sku').fill('SAL-002');
  await form.locator('#receipt-item-quantity').fill('1');
  await form.locator('#receipt-item-unit-price').fill('9.50');
  await form.locator('#receipt-item-discount').fill('20');
  await form.getByRole('button', { name: 'Add line item' }).click();
  await expect(form.getByText('Discount cannot be greater than the subtotal.')).toBeVisible();
  await shot('receipt-item-discount-validation', { full: false });
  await form.locator('#receipt-item-discount').fill('1.50');
  await form.getByRole('button', { name: 'Add line item' }).click();
  await expectToast('Line "Caesar Salad" added. Receipt totals recalculated.');

  // edición: 2 ensaladas → 19,00 − 1,50 = 17,50
  await page.getByTestId(`receipt-item-row-${NEW_SALAD_LINE}`).getByRole('button', { name: 'Edit Caesar Salad' }).click();
  form = dialog('Edit line · Caesar Salad');
  await form.locator('#receipt-item-quantity').fill('2');
  await expect(form.getByTestId('receipt-item-live-total')).toContainText('17.50');
  await form.getByRole('button', { name: 'Save changes' }).click();
  await expectToast('Line "Caesar Salad" updated. Receipt totals recalculated.');
  await expect(page.getByTestId(`receipt-item-total-${NEW_SALAD_LINE}`)).toContainText('17.50');

  // borrado lógico y restauración
  await page.getByTestId(`receipt-item-row-${NEW_SALAD_LINE}`).getByRole('button', { name: 'Delete Caesar Salad' }).click();
  const confirm = dialog('Delete receipt line');
  await shot('receipt-item-delete-confirm', { full: false });
  await confirm.getByRole('button', { name: 'Delete line' }).click();
  await expectToast('Line "Caesar Salad" deleted. Receipt totals recalculated.');
  await page.getByRole('combobox', { name: 'Filter by status' }).selectOption('false');
  await settle();
  await expect(page.getByTestId(`receipt-item-row-${NEW_SALAD_LINE}`)).toContainText('Deleted');
  await shot('receipt-items-deleted-lines');
  await page.getByTestId(`receipt-item-row-${NEW_SALAD_LINE}`).getByRole('button', { name: 'Restore Caesar Salad' }).click();
  await expectToast('Line "Caesar Salad" restored. Receipt totals recalculated.');
  await page.getByRole('button', { name: 'Reset' }).click();
  await settle();
  await expect(page.getByTestId('receipt-items-count')).toContainText('13 lines');
  await shot('receipt-items-after-changes');
});

// ---- Receipt Taxes -------------------------------------------------------------------------

test('Receipt Taxes: metrics, receipt- and item-scope taxes, edit, deactivate / activate and filters', async () => {
  await openScreen('/app/billing-transactions/receipt-items');
  await goNav('Receipts Taxes');
  await expect(page.getByRole('main').getByRole('heading', { name: 'Receipt Taxes', exact: true })).toBeVisible();
  await expectNavBar('Receipts Taxes');
  await shot('receipt-taxes');

  await page.getByRole('button', { name: 'New Receipt Tax' }).click();
  let form = dialog('New Receipt Tax');
  await form.getByRole('button', { name: 'Create Tax' }).click();
  await expect(form.getByText('Select the receipt this tax belongs to.')).toBeVisible();
  await form.locator('#rt-receipt').selectOption(String(NEW_INVOICE.id));
  await form.locator('#rt-name').fill('Sales Tax');
  await form.locator('#rt-rate').fill('8');
  // base imponible del recibo: subtotal bruto 43,00 → 3,44
  await expect(form.getByTestId('rt-amount-preview')).toContainText('43.00');
  await expect(form.getByTestId('rt-amount-preview')).toContainText('3.44');
  await shot('receipt-tax-form-receipt-scope', { full: false });
  await form.getByRole('button', { name: 'Create Tax' }).click();
  await expectToast(/Receipt tax created\. INV-000008 totals updated: tax 3\.44 USD · grand total 44\.94 USD/);

  await page.getByRole('button', { name: 'New Receipt Tax' }).click();
  form = dialog('New Receipt Tax');
  await form.locator('#rt-receipt').selectOption(String(NEW_INVOICE.id));
  await form.getByRole('radio', { name: /Specific item/ }).check();
  await form.locator('#rt-item').selectOption(String(NEW_BURGER_LINE));
  await form.locator('#rt-name').fill('City Tax');
  await form.locator('#rt-rate').fill('1.5');
  await expect(form.getByTestId('rt-amount-preview')).toContainText('0.36');
  await shot('receipt-tax-form-item-scope', { full: false });
  await form.getByRole('button', { name: 'Create Tax' }).click();
  await expectToast(/Receipt tax created\. INV-000008 totals updated: tax 3\.80 USD · grand total 45\.30 USD/);

  // edición de la tasa: 2 % de 24,00 = 0,48
  await page.getByTestId(`receipt-tax-row-${NEW_CITY_TAX}`).getByRole('button', { name: 'Edit City Tax' }).click();
  form = dialog('Edit Receipt Tax');
  await form.locator('#rt-rate').fill('2');
  await form.getByRole('button', { name: 'Save Changes' }).click();
  await expectToast(/Receipt tax updated\..*grand total 45\.42 USD/);

  // desactivar / activar
  await page.getByTestId(`receipt-tax-row-${NEW_CITY_TAX}`).getByRole('button', { name: 'Deactivate City Tax', exact: true }).click();
  await shot('receipt-tax-deactivate-confirm', { full: false });
  await page.getByRole('button', { name: 'Deactivate', exact: true }).click();
  await expectToast(/Receipt tax deactivated\..*grand total 44\.94 USD/);
  await expect(page.getByTestId(`receipt-tax-row-${NEW_CITY_TAX}`).getByRole('button', { name: 'Edit City Tax' })).toBeDisabled();
  await page.getByTestId(`receipt-tax-row-${NEW_CITY_TAX}`).getByRole('button', { name: 'Activate City Tax', exact: true }).click();
  await page.getByRole('button', { name: 'Activate', exact: true }).click();
  await expectToast(/Receipt tax activated\..*grand total 45\.42 USD/);

  // filtros
  await page.getByRole('combobox', { name: 'Filter by scope' }).selectOption('ITEM');
  await settle();
  await expect(page.locator('[data-testid^="receipt-tax-row-"]')).toHaveCount(3); // 2 del recibo 3 + City Tax
  await shot('receipt-taxes-item-scope');
  await page.getByRole('button', { name: 'Clear Filters' }).click();
  await page.locator('#rt-filter-type').selectOption({ label: 'City Tax' });
  await settle();
  await expect(page.getByRole('list', { name: 'Tax breakdown by type and rate' })).toContainText('City Tax');
  await page.getByRole('button', { name: 'Reset tax filters' }).click();
  await settle();
  await shot('receipt-taxes-after-changes');
});

test('Receipts: lock the new invoice; the API then rejects changes and the activity log shows it', async () => {
  await openScreen('/app/billing-transactions/receipt-taxes');
  await goNav('Receipts');
  const row = page.getByTestId(`receipt-row-${NEW_INVOICE.id}`);
  await expect(page.getByTestId(`receipt-${NEW_INVOICE.id}-grand-total`)).toContainText('45.42');
  await row.getByRole('button', { name: `Lock ${NEW_INVOICE.label}` }).click();
  const lock = dialog('Lock receipt');
  await expect(lock).toContainText('45.42 USD');
  await shot('lock-receipt-confirm', { full: false });
  await lock.getByRole('button', { name: 'LOCK RECEIPT' }).click();
  await expectToast(`${NEW_INVOICE.label} locked.`);
  await expect(page.getByTestId(`receipt-${NEW_INVOICE.id}-locked`)).toContainText('Locked');
  await expect(row.getByRole('button', { name: `Edit ${NEW_INVOICE.label}` })).toHaveCount(0);
  await expect(row.getByRole('button', { name: `Issue adjustment note for ${NEW_INVOICE.label}` })).toBeVisible();

  // inmutabilidad en la API (FiscalLockGuard): 403 en recibo, línea e impuesto
  const token = await apiToken();
  const headers = { Authorization: `Bearer ${token}` };
  for (const [method, url, data] of [
    ['PATCH', `${API}/receipts/${NEW_INVOICE.id}`, { currency: 'EUR' }],
    ['PATCH', `${API}/receipt-items/${NEW_BURGER_LINE}`, { quantity: 5 }],
    ['PATCH', `${API}/receipt-taxes/${NEW_CITY_TAX}`, { rate: 5 }],
  ] as const) {
    const res = await page.request.fetch(url, { method, headers, data });
    expect(res.status(), `${method} ${url}`).toBe(403);
    expect((await res.json()).message).toBe('Receipt is fiscally locked and cannot be modified.');
  }

  await row.getByRole('button', { name: `View activity log for ${NEW_INVOICE.label}` }).click();
  const activity = dialog(NEW_INVOICE.label);
  const timeline = activity.getByRole('list', { name: 'Activity timeline' });
  for (const action of ['Created', 'Line item modified', 'Tax modified', 'Locked', 'Modification blocked']) {
    await expect(timeline).toContainText(action);
  }
  await shot('locked-receipt-activity-log', { full: false });
  await activity.getByRole('button', { name: 'Close drawer' }).click();
  await shot('receipts-after-lock');
});

// ---- Financial Ledger Sync -----------------------------------------------------------------

test('Ledger Sync: posting status, journal lines and posting the batch to the ledger', async () => {
  await openScreen('/app/billing-transactions/receipt-orders');
  await goNav('Ledger Sync');
  await expect(page.getByRole('main').getByRole('heading', { name: 'FINANCIAL ENGINE LEDGER SYNC', exact: true })).toBeVisible();
  await expect(page.getByTestId('kpi-posted-receipts-value')).toHaveText('1 / 7');
  // 7 recibos activos (incluido INV-000008, creado y bloqueado antes) y solo INV-000001 asentado
  await expect(page.getByTestId('kpi-unposted-transactions-value')).toHaveText('6');
  await expect(page.getByTestId('kpi-pending-entries-value')).toHaveText('1');
  await expectNavBar('Ledger Sync');
  await shot('ledger-sync');

  const filter = page.getByRole('group', { name: 'Filter by posting status' });
  await filter.getByRole('button', { name: 'Pending', exact: true }).click();
  await settle();
  await expect(page.locator('[data-testid^="sync-row-"]')).toHaveCount(1);
  await filter.getByRole('button', { name: 'Unposted', exact: true }).click();
  await settle();
  await expect(page.locator('[data-testid^="sync-row-"]')).toHaveCount(5);
  await shot('ledger-sync-unposted');
  await filter.getByRole('button', { name: 'Posted', exact: true }).click();
  await settle();
  await expect(page.locator('[data-testid^="sync-row-"]')).toHaveCount(1);

  await page.getByRole('button', { name: 'Show journal entry lines of INV-000001' }).click();
  const detail = page.getByRole('region', { name: 'Ledger detail for INV-000001' });
  await expect(detail.getByTestId('lines-total-debit')).toContainText('30.66');
  await expect(detail.getByTestId('lines-total-credit')).toContainText('30.66');
  await shot('ledger-sync-journal-lines');
  await filter.getByRole('button', { name: 'All', exact: true }).click();
  await settle();

  await page.getByRole('button', { name: 'POST BATCH TO LEDGER' }).click();
  const modal = dialog('Post batch to ledger');
  await expect(modal.getByRole('button', { name: 'Confirm & post' })).toBeDisabled();
  await modal.locator('#post-batch-cashAccountId').selectOption({ label: '1100 · Cash & Card Clearing (ASSET)' });
  await modal.locator('#post-batch-revenueAccountId').selectOption({ label: '4000 · Food & Beverage Sales (REVENUE)' });
  await modal.locator('#post-batch-taxAccountId').selectOption({ label: '2100 · Sales Tax Payable (LIABILITY)' });
  await modal.locator('#post-batch-discountAccountId').selectOption({ label: '4900 · Sales Discounts (EXPENSE)' });
  await shot('post-batch-modal', { full: false });
  const posted = waitApi('POST', /\/billing\/financial-sync\/post-batch$/);
  await modal.getByRole('button', { name: 'Confirm & post' }).click();
  await posted;
  await expect(page.getByRole('status').filter({ hasText: /Posted 6 journal entries to the ledger/ })).toBeVisible();
  await expect(page.getByTestId('kpi-posted-receipts-value')).toHaveText('7 / 7');
  await expect(page.getByTestId('kpi-unposted-transactions-value')).toHaveText('0');
  await expect(page.getByTestId('kpi-balance-status-value')).toContainText('Balanced');
  await expect(page.getByRole('button', { name: 'POST BATCH TO LEDGER' })).toBeDisabled();
  await shot('ledger-sync-after-post');
  await page.getByRole('button', { name: 'Dismiss batch result' }).click();
});

// ---- Inventory & Billing Stock Sync --------------------------------------------------------

test('Inventory Sync: deduction status per receipt line, components, stock validation and the NavHubBar', async () => {
  await openScreen('/app/billing-transactions/billing-financial-sync');
  await goNav('Inventory Sync');
  await expect(page.getByRole('main').getByRole('heading', { name: 'INVENTORY & BILLING STOCK SYNC', exact: true })).toBeVisible();
  await expect(page.getByTestId('kpi-status-DEDUCTED')).toBeVisible();
  await expect(page.getByTestId('inventory-sync-row-1')).toHaveAttribute('data-status', 'DEDUCTED');
  await expect(page.getByTestId('inventory-sync-row-10')).toHaveCount(0); // página 2
  await expectNavBar('Inventory Sync');
  await shot('inventory-sync');

  await page.getByRole('combobox', { name: 'Filter by deduction status' }).selectOption({ label: 'Insufficient Stock' });
  await settle();
  await expect(page.locator('[data-testid^="inventory-sync-row-"]')).toHaveCount(2); // carne: 4 y 3 pedidas, 2 en stock
  await shot('inventory-sync-insufficient-stock');
  await page.getByRole('combobox', { name: 'Filter by deduction status' }).selectOption({ label: 'Not Tracked' });
  await settle();
  await expect(page.getByTestId('inventory-sync-row-10')).toHaveAttribute('data-status', 'NOT_TRACKED');
  await page.getByRole('combobox', { name: 'Filter by deduction status' }).selectOption({ label: 'All Statuses' });
  await settle();

  await page.getByRole('button', { name: 'Show stock components of line 1', exact: true }).click();
  await expect(page.getByTestId('inventory-sync-details-1')).toBeVisible();
  await shot('inventory-sync-components');

  // validación desde una línea seleccionada (receipt) y por lista de SKU
  await page.getByTestId('inventory-sync-row-7').click();
  await expect(page.getByTestId('inventory-sync-row-7')).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('button', { name: 'VALIDATE STOCK AVAILABILITY' }).click();
  const drawer = dialog('Validate Stock Availability');
  await expect(drawer.getByRole('tab', { name: 'Receipt' })).toHaveAttribute('aria-selected', 'true');
  await drawer.getByRole('button', { name: 'Run Validation' }).click();
  await expect(drawer.getByTestId('stock-validation-summary')).toHaveText(/Stock check failed/);
  await shot('stock-validation-receipt', { full: false });
  await drawer.getByRole('tab', { name: 'SKU List' }).click();
  await drawer.getByLabel('SKU 1', { exact: true }).fill('DRK-003');
  await drawer.getByLabel('Quantity 1', { exact: true }).fill('3');
  await drawer.getByRole('button', { name: 'Add SKU' }).click();
  await drawer.getByLabel('SKU 2', { exact: true }).fill('SAL-002');
  await drawer.getByLabel('Quantity 2', { exact: true }).fill('1');
  await drawer.getByRole('button', { name: 'Run Validation' }).click();
  await expect(drawer.getByTestId('stock-validation-summary')).toHaveText(/Stock available for every line/);
  await shot('stock-validation-sku-list', { full: false });
  await drawer.getByRole('button', { name: 'Close drawer' }).click();

  // sin Quick Launch: la NavHubBar es la única barra de atajos de la pantalla
  await expect(page.getByTestId('billing-inventory-quick-launch')).toHaveCount(0);
  await expect(page.locator('main').getByText(/quick launch/i)).toHaveCount(0);
  await expectNavBar('Inventory Sync');
  await shot('inventory-sync-navhubbar');
});

// ---- Business Partners Billing Link --------------------------------------------------------

test('Partner Link: B2B metrics, partner grid, scope, assign / unlink and link from the header', async () => {
  await openScreen('/app/billing-transactions/billing-inventory-sync');
  await goNav('Partner Link');
  await expect(page.getByRole('main').getByRole('heading', { name: 'BUSINESS PARTNERS BILLING LINK', exact: true })).toBeVisible();
  await expect(page.getByTestId('partner-row-supplier:1')).toContainText('Fresh Farms Distributors');
  await expect(page.getByTestId('partner-row-customer:2')).toContainText('Acme Catering SpA');
  await expectNavBar('Partner Link');
  await shot('partner-link');

  const types = page.getByRole('group', { name: 'Partner type' });
  await types.getByRole('button', { name: 'Suppliers', exact: true }).click();
  await settle();
  await expect(page.locator('[data-testid^="partner-row-"]')).toHaveCount(1);
  await types.getByRole('button', { name: 'All', exact: true }).click();
  await page.getByRole('group', { name: 'Scope' }).getByRole('button', { name: 'Company-wide', exact: true }).click();
  await settle();
  await expect(page.getByTestId('partner-sync-scope')).toContainText('Company-wide');
  await expect(page.getByTestId('partner-row-customer:3')).toContainText('Blue Harbor Events LLC');
  await shot('partner-link-company-wide');
  await page.getByRole('group', { name: 'Scope' }).getByRole('button', { name: 'Branch', exact: true }).click();
  await settle();

  // asignar un recibo del cliente de mostrador a un perfil corporativo
  await page.getByRole('button', { name: 'Show receipts of Walk-in Guest' }).click();
  await expect(page.getByTestId('partner-receipt-6').getByRole('button', { name: 'Assign receipt INV-000006', exact: true })).toBeDisabled();
  await shot('partner-link-receipts-of-partner');
  await page.getByTestId('partner-receipt-2').getByRole('button', { name: 'Assign receipt INV-000002', exact: true }).click();
  let drawer = dialog('LINK CUSTOMER PROFILE');
  await expect(drawer.getByTestId('selected-receipt')).toContainText('INV-000002');
  await drawer.getByRole('textbox', { name: 'Search business partners' }).fill('Sunset');
  await drawer.getByRole('radio', { name: 'Customer Sunset Weddings Co' }).check();
  await shot('link-partner-drawer', { full: false });
  await drawer.getByRole('button', { name: 'LINK CUSTOMER PROFILE' }).click();
  await expectToast('Receipt INV-000002 assigned to Sunset Weddings Co.');
  await expect(page.getByTestId('partner-row-customer:4')).toContainText('Sunset Weddings Co');

  await page.getByRole('button', { name: 'Show receipts of Sunset Weddings Co' }).click();
  await page.getByRole('button', { name: 'Unlink receipt INV-000002' }).click();
  await expectToast('Receipt INV-000002 now uses its order customer.');
  await expect(page.getByTestId('partner-row-customer:4')).toHaveCount(0);

  // enlazar desde la cabecera, con el selector de recibos sin perfil
  await page.getByRole('region', { name: 'Business partners billing link' }).getByRole('button', { name: 'LINK CUSTOMER PROFILE' }).click();
  drawer = dialog('LINK CUSTOMER PROFILE');
  await drawer.getByRole('radio', { name: 'Receipt INV-000004' }).check();
  await drawer.getByRole('button', { name: 'Supplier', exact: true }).click();
  await drawer.getByRole('radio', { name: 'Supplier Ocean Seafood Supply' }).check();
  await shot('link-supplier-from-header', { full: false });
  await drawer.getByRole('button', { name: 'LINK SUPPLIER PROFILE' }).click();
  await expectToast('Receipt INV-000004 linked to Ocean Seafood Supply.');
  await expect(page.getByTestId('partner-row-supplier:2')).toContainText('Ocean Seafood Supply');
  await shot('partner-link-after-changes');
});

// ---- Billing Reports -----------------------------------------------------------------------

test('Reports: tax liability and discount & void audit with filters, CSV / Excel export and print preview', async () => {
  await openScreen('/app/billing-transactions/billing-partner-sync');
  await goNav('Reports');
  await expect(page.getByRole('main').getByRole('heading', { name: 'Billing Reports', exact: true })).toBeVisible();
  const taxTable = page.getByRole('table', { name: 'Tax liability by rate and scope' });
  await expect(taxTable).toContainText('City Tax');
  await expect(taxTable).toContainText('Sales Tax');
  await expectNavBar('Reports');
  await shot('reports-tax-liability');

  await page.locator('#tax-scope').selectOption({ label: 'Line item' });
  await page.getByRole('button', { name: 'Apply filters' }).click();
  await settle();
  await expect(taxTable).toContainText('Subtotal line item scope');
  await expect(taxTable).not.toContainText('Subtotal receipt scope');
  await shot('reports-tax-liability-line-items');
  await page.getByRole('button', { name: 'Reset' }).click();
  await settle();

  for (const [button, ext] of [['Export CSV', 'csv'], ['Export Excel', 'xls']] as const) {
    const download = page.waitForEvent('download');
    await page.getByRole('group', { name: 'Export report' }).getByRole('button', { name: button }).click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(new RegExp(`^tax-liability_\\d{4}-\\d{2}-\\d{2}_\\d{4}-\\d{2}-\\d{2}\\.${ext}$`));
    const saved = `${SHOTS}/${file.suggestedFilename()}`;
    await file.saveAs(saved);
    expect(readFileSync(saved, 'utf8')).toContain('Sales Tax');
    checks.downloads += 1;
  }

  await page.getByRole('button', { name: 'Print / PDF' }).click();
  const preview = dialog('Tax Liability Report print preview');
  await expect(preview).toContainText('Sales Tax');
  await shot('reports-tax-liability-print-preview', { full: false });
  await preview.getByRole('button', { name: 'Print / Save as PDF' }).click();
  expect(await page.evaluate(() => (window as unknown as { __printCalls: number }).__printCalls)).toBe(1);
  await preview.getByRole('button', { name: 'Close' }).click();

  await page.getByRole('tab', { name: 'Discount & Void Audit' }).click();
  await settle();
  for (const id of [4, 5, NEW_INVOICE.id, NEW_RECEIPT.id]) await expect(page.getByTestId(`audit-row-${id}`)).toBeVisible();
  await shot('reports-discount-audit');
  await page.getByRole('radiogroup', { name: 'Event type' }).getByRole('radio', { name: 'Voids' }).click();
  await settle();
  await expect(page.locator('[data-testid^="audit-row-"]')).toHaveCount(2);
  await page.getByRole('radiogroup', { name: 'Event type' }).getByRole('radio', { name: 'All events' }).click();
  await settle();
  await page.getByRole('button', { name: 'Show order snapshot of INV-000004' }).click();
  await expect(page.getByTestId('audit-details-4')).toContainText('Classic Burger');
  await shot('reports-discount-audit-snapshot');

  const download = page.waitForEvent('download');
  await page.getByRole('group', { name: 'Export report' }).getByRole('button', { name: 'Export CSV' }).click();
  const csv = await download;
  expect(csv.suggestedFilename()).toMatch(/^discount-audit_.*\.csv$/);
  await csv.saveAs(`${SHOTS}/${csv.suggestedFilename()}`);
  checks.downloads += 1;
  await page.getByRole('button', { name: 'Print / PDF' }).click();
  const auditPreview = dialog('Discount & Void Audit Trail print preview');
  await expect(auditPreview).toContainText('INV-000004');
  await shot('reports-discount-audit-print-preview', { full: false });
  await auditPreview.getByRole('button', { name: 'Close' }).click();

  // accesos a pantallas relacionadas y vuelta al hub
  await page.getByRole('navigation', { name: 'Related screens' }).getByRole('button', { name: 'Receipt Taxes' }).click();
  await expect(page.getByRole('main').getByRole('heading', { name: 'Receipt Taxes', exact: true })).toBeVisible();
  await navBar().getByRole('button', { name: 'BILLING & TRANSACTIONS COMMAND HUB' }).click();
  await expect(page.locator('main h1').first()).toHaveText('Billing & Transactions Command Hub');
  await shot('back-to-billing-hub');
});

// ---- Móvil (390 px) ------------------------------------------------------------------------

test('every billing screen fits a 390 px phone without horizontal scroll', async () => {
  await page.setViewportSize({ width: 390, height: 844 });
  // En el teléfono el menú lateral arranca oculto y la pantalla ocupa todo el ancho
  const expectFullWidth = async (label: string) => {
    await expect(page.getByTitle('Show menu')).toBeVisible();
    await page.waitForTimeout(350); // transición del menú
    const mainBox = (await page.locator('main').boundingBox())!;
    expect(mainBox.x, `main starts at the left edge on ${label}`).toBeLessThanOrEqual(1);
    expect(mainBox.width).toBeGreaterThanOrEqual(389);
  };
  const openOnPhone = async (path: string) => {
    await page.goto(path);
    await settle();
    await expectFullWidth(path);
  };
  await openOnPhone('/app/billing-transactions/receipt-orders');
  // el botón ☰ abre el menú; elegir una pantalla lo vuelve a cerrar
  await page.getByTitle('Show menu').click();
  await expect(page.getByTitle('Hide menu')).toBeVisible();
  await page.locator('aside').getByText('Billing / Transactions', { exact: true }).click();
  await expect(page.locator('main h1').first()).toHaveText('Billing & Transactions Command Hub');
  await expectFullWidth('the hub opened from the menu');
  await shot('mobile-billing-hub');
  for (const tab of ['receipt-orders', 'receipt-items', 'receipt-taxes', 'billing-financial-sync', 'billing-inventory-sync', 'billing-partner-sync', 'billing-reports']) {
    await openOnPhone(`/app/billing-transactions/${tab}`);
    await expect(navBar()).toBeAttached();
    await shot(`mobile-${tab}`);
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  expect(checks.layoutMobile).toBe(8);
});
