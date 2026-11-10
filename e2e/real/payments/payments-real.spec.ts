// E2E real de cobros con tarjeta: backoffice en Chromium contra la API NestJS, Postgres y un
// gateway falso de Stripe/CardPointe/Bolt (sin mocks en el navegador). Lo levanta y apaga
// e2e/real/payments/stack.mjs; no corre con `npm run test:e2e`.
//
// Cubre las tres historias:
//   - POST /payment-processing/charge (token de Stripe.js y de CardSecure, rechazo, PCI)
//   - POST /payment-processing/terminal-sale (Bolt y Stripe reader: pending → paid/failed)
//   - POST /payment-processing/:id/refund y /void (parcial, total, bloqueo, lote cerrado)
// y las pantallas de alta de pasarelas y terminales, con cada botón y una captura por paso.
import { expect, test, type APIRequestContext, type Locator, type Page } from '@playwright/test';

test.skip(process.env.E2E_PAYMENTS_REAL !== '1', 'Run through e2e/real/payments/stack.mjs');
test.describe.configure({ mode: 'serial' });

const API = process.env.E2E_API ?? 'http://127.0.0.1:3101/api';
const GATEWAY = process.env.E2E_GATEWAY ?? 'http://127.0.0.1:4599';
const SHOTS = process.env.E2E_SHOTS ?? 'test-results/payments-real';
const RED = 'rgb(174, 0, 26)';
const ADMIN = { email: 'admin@x7payments-e2e.com', password: 'E2ePayments123!' };
const BOLT_HSN = 'C032UQ03960231';
const STRIPE_READER = 'tmr_FakeCounterReader';
const PRICE = 12.5;

let page: Page;
let token = '';
let merchantId = 0;
let step = 0;
const orders: number[] = [];
const consoleErrors: string[] = [];
const serverErrors: string[] = [];
/** 4xx que la prueba provoca a propósito (Chrome los registra como error de consola) */
let expectedClientErrors = 0;

const shot = async (name: string) => {
  step += 1;
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${SHOTS}/${String(step).padStart(2, '0')}-${name}.png`, fullPage: true });
};

const api = async (request: APIRequestContext, method: 'get' | 'post' | 'put', path: string, data?: unknown) => {
  const res = await request[method](`${API}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    ...(data ? { data } : {}),
  });
  expect(res.ok(), `${method.toUpperCase()} ${path} → ${res.status()} ${await res.text()}`).toBeTruthy();
  const text = await res.text();
  return text ? JSON.parse(text) : {};
};

const gateway = (request: APIRequestContext, path: string, data: unknown = {}, headers: Record<string, string> = {}) =>
  request.post(`${GATEWAY}${path}`, { data, headers });

const colorOf = (l: Locator, prop: 'color' | 'backgroundColor' = 'color') =>
  l.evaluate((el, p) => getComputedStyle(el)[p as 'color'], prop);
const fontOf = (l: Locator) => l.evaluate((el) => getComputedStyle(el).fontFamily);

const expectRedHover = async (l: Locator) => {
  await l.hover();
  await expect.poll(() => colorOf(l)).toBe(RED);
  await page.mouse.move(0, 0);
};

/** Ni la página ni el diálogo abierto se desbordan a lo ancho; los botones caben en pantalla */
const expectLayoutIntact = async (scope?: Locator) => {
  const page_ = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  expect(page_.scroll, 'page wider than the viewport').toBeLessThanOrEqual(page_.client + 1);
  // Las tablas caben en su tarjeta sin barra de desplazamiento horizontal
  const tables = await page.locator('main .overflow-x-auto').evaluateAll((els) =>
    els.map((el) => ({ scroll: el.scrollWidth, client: el.clientWidth, text: (el.textContent ?? '').slice(0, 40) })),
  );
  for (const t of tables) {
    expect(t.scroll, `table wider than its card: "${t.text}"`).toBeLessThanOrEqual(t.client + 1);
  }
  if (!scope) return;
  const box = await scope.evaluate((el) => ({ scroll: el.scrollWidth, client: el.clientWidth }));
  expect(box.scroll, 'dialog content wider than the dialog').toBeLessThanOrEqual(box.client + 1);
  const viewport = page.viewportSize()!;
  for (const button of await scope.getByRole('button').all()) {
    if (!(await button.isVisible())) continue;
    const b = (await button.boundingBox())!;
    expect(b.x, 'button cut off on the left').toBeGreaterThanOrEqual(0);
    expect(b.x + b.width, `button "${await button.innerText()}" cut off on the right`).toBeLessThanOrEqual(viewport.width + 1);
  }
};

const expectPoppins = async (l: Locator) => expect(await fontOf(l)).toContain('Poppins');

const posNav = () => page.getByRole('navigation', { name: /Point of Sale module navigation/i });

const expectNavHub = async (active: RegExp) => {
  const nav = posNav();
  await expect(nav.getByRole('button', { name: /POS COMMAND HUB/i })).toBeVisible();
  for (const label of [/^payments$/i, /^gateways$/i, /^terminals$/i]) {
    await expect(nav.getByRole('button', { name: label })).toBeVisible();
  }
  const current = nav.getByRole('button', { name: active });
  await expect(current).toHaveAttribute('aria-current', 'page');
  await expect.poll(() => colorOf(current, 'backgroundColor')).toBe(RED);
};

const goTo = async (label: RegExp) => {
  await posNav().getByRole('button', { name: label }).click();
  await page.waitForLoadState('networkidle');
};

const dialog = () => page.getByRole('dialog');
const toast = () => page.getByRole('status').filter({ hasText: /./ }).last();

async function newOrder(request: APIRequestContext, collaboratorId: number, customerId: number, productId: number) {
  const res = await api(request, 'post', '/orders', {
    merchantId,
    collaboratorId,
    customerId,
    type: 'take_out',
    items: [{ orderId: 1, productId, quantity: 2 }],
  });
  orders.push(res.data.id);
  return res.data.id as number;
}

test.beforeAll(async ({ browser, request }) => {
  // Alta del comercio por el onboarding público (plan Executive del seed de referencia)
  const reg = await request.post(`${API}/auth/register-onboarding`, {
    data: {
      companyName: 'X7 Payments E2E',
      companyEmail: 'contact@x7payments-e2e.com',
      tax_id: 'PAY-E2E-1',
      address: '100 Ocean Drive',
      city: 'Miami',
      state: 'Florida',
      country: 'United States',
      branchName: 'Ocean Drive',
      adminEmail: ADMIN.email,
      password: ADMIN.password,
      planId: 3,
    },
  });
  expect(reg.ok(), `register → ${reg.status()} ${await reg.text()}`).toBeTruthy();
  const login = await request.post(`${API}/auth/login`, { data: ADMIN });
  expect(login.ok()).toBeTruthy();
  const session = await login.json();
  token = session.access_token;
  merchantId = session.user.merchant.id;

  // Lo que necesita la caja: colaborador, turno, cajón y turno de caja, cliente y producto
  const collaborator = await api(request, 'post', '/collaborators', {
    user_id: session.user.id,
    merchant_id: merchantId,
    name: 'Ana Cashier',
    role: 'waiter',
    status: 'active',
  });
  await api(request, 'post', '/shifts', { merchantId, startTime: new Date().toISOString(), status: 'active' });
  const drawer = await api(request, 'post', '/cash-drawers', { openingBalance: 0 });
  await api(request, 'post', '/cash-shifts', { cashDrawerId: drawer.data.id, openingBalance: 0 });
  const customer = await api(request, 'post', '/customers', {
    name: 'Grace Hopper',
    email: 'grace@x7payments-e2e.com',
    address: '1 Customer Ave',
    city: 'Miami',
    state: 'Florida',
    country: 'United States',
  });
  const product = await api(request, 'post', '/products', { name: 'Smash Burger', sku: 'PAY-E2E-BURGER', basePrice: PRICE });
  // Ubicación de venta por defecto: así el descuento de inventario del pedido pagado no falla
  const location = await api(request, 'post', '/locations', { name: 'Front Kitchen', code: 'FRONT-01' });
  await api(request, 'put', `/merchants/${merchantId}`, { defaultSalesStockLocationId: location.data.id });
  for (let i = 0; i < 9; i++) {
    await newOrder(request, collaborator.data.id, customer.data?.id ?? customer.id, product.data.id);
  }

  page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => consoleErrors.push(`pageerror: ${err.message}`));
  page.on('response', (res) => {
    if (res.status() >= 500) serverErrors.push(`${res.status()} ${res.request().method()} ${res.url()}`);
  });
});

test.afterAll(async () => {
  await page?.close();
});

test('logs in and opens the POS hub with the three payment workspaces live', async () => {
  await page.goto('/login');
  await page.locator('input[type=email]').fill(ADMIN.email);
  await page.locator('input[type=password]').fill(ADMIN.password);
  await shot('login');
  await page.keyboard.press('Enter');
  await page.waitForURL(/dashboard/, { timeout: 30_000 });
  await page.goto('/app/pos');
  await page.waitForLoadState('networkidle');
  await expect(page.getByText('Point of Sale Command Hub')).toBeVisible();
  for (const title of ['Order Payment Tenders', 'Payment Gateway Configs', 'Payment Terminals']) {
    const card = page.getByText(title, { exact: true }).first();
    await expect(card).toBeVisible();
    await expectPoppins(card);
  }
  await page.waitForTimeout(1200);
  await shot('pos-hub');
  await expectLayoutIntact();
});

test('Payment Gateway Configs: create, edit, default, deactivate and delete', async () => {
  await page.getByText('Payment Gateway Configs', { exact: true }).first().click();
  await page.waitForLoadState('networkidle');
  await expect(page.getByText(/In Development/i)).toHaveCount(0);
  await expectNavHub(/^gateways$/i);
  await expect(page.getByTestId('gateways-empty-state')).toBeVisible();
  await shot('gateways-empty');

  // Stripe (por defecto)
  await page.getByTestId('gateways-empty-state').getByRole('button', { name: /new gateway/i }).click();
  let form = dialog();
  await expect(form).toBeVisible();
  await expectLayoutIntact(form);
  await form.getByLabel('Display name').fill('Stripe Ocean Drive');
  await form.getByLabel(/secret key/i).fill('sk_test_e2eFakeKey');
  await form.getByLabel(/publishable key/i).fill('pk_test_e2eFakeKey');
  await form.getByLabel(/default gateway/i).check();
  await shot('gateway-stripe-form');
  await form.getByRole('button', { name: 'Create gateway' }).click();
  await expect(form).toBeHidden();
  await expect(toast()).toContainText('Payment gateway created');
  await shot('gateway-stripe-created');

  // CardPointe con Bolt
  await page.getByRole('button', { name: /new gateway/i }).first().click();
  form = dialog();
  await form.getByLabel('Provider').selectOption('cardpointe');
  await form.getByLabel('Display name').fill('CardPointe UAT');
  await form.getByLabel(/merchant id/i).fill('496160873888');
  await form.getByLabel(/api username/i).fill('testing');
  await form.getByLabel(/api password/i).fill('testing123');
  await form.getByLabel(/gateway site/i).fill('fts-uat');
  await form.getByLabel(/^bolt site/i).fill('bolt-uat');
  await form.getByLabel(/bolt api key/i).fill('bolt-e2e-key');
  await expectLayoutIntact(form);
  await shot('gateway-cardpointe-form');
  await form.getByRole('button', { name: 'Create gateway' }).click();
  await expect(form).toBeHidden();

  const rows = page.locator('[data-testid^="gateway-row-"]');
  await expect(rows).toHaveCount(2);
  const stripeRow = rows.filter({ hasText: 'Stripe Ocean Drive' });
  const cpRow = rows.filter({ hasText: 'CardPointe UAT' });
  await expect(stripeRow.getByText('Default')).toBeVisible();
  // Los secretos llegan enmascarados; lo público, en claro
  await expect(stripeRow).toContainText('sk_test_****');
  await expect(stripeRow).not.toContainText('sk_test_e2eFakeKey');
  await expect(cpRow).toContainText('fts-uat');
  await expect(cpRow).not.toContainText('testing123');
  await expectPoppins(cpRow.locator('td').first());
  await expectRedHover(cpRow.getByRole('button', { name: 'Edit CardPointe UAT' }));
  await shot('gateways-list');

  // Editar: el proveedor no cambia y un secreto vacío se conserva
  await cpRow.getByRole('button', { name: 'Edit CardPointe UAT' }).click();
  form = dialog();
  await expect(form.getByLabel('Provider')).toBeDisabled();
  await form.getByLabel('Display name').fill('CardPointe Bolt UAT');
  await shot('gateway-edit');
  await form.getByRole('button', { name: 'Save changes' }).click();
  await expect(form).toBeHidden();
  await expect(toast()).toContainText('Payment gateway updated');
  const cpRowRenamed = rows.filter({ hasText: 'CardPointe Bolt UAT' });
  await expect(cpRowRenamed).toBeVisible();

  // Default ida y vuelta
  await cpRowRenamed.getByRole('button', { name: /make cardpointe bolt uat the default/i }).click();
  await expect(cpRowRenamed.getByText('Default')).toBeVisible();
  await shot('gateway-default-cardpointe');
  await stripeRow.getByRole('button', { name: /make stripe ocean drive the default/i }).click();
  await expect(stripeRow.getByText('Default')).toBeVisible();

  // Desactivar y reactivar
  await cpRowRenamed.getByRole('button', { name: 'Deactivate CardPointe Bolt UAT' }).click();
  await shot('gateway-deactivate-confirm');
  await page.getByRole('button', { name: 'Deactivate', exact: true }).click();
  await expect(cpRowRenamed.getByText('Inactive')).toBeVisible();
  await cpRowRenamed.getByRole('button', { name: 'Activate CardPointe Bolt UAT' }).click();
  await page.getByRole('button', { name: 'Activate', exact: true }).click();
  await expect(cpRowRenamed.getByText('Active', { exact: true })).toBeVisible();

  // Una pasarela temporal que sí se puede borrar
  await page.getByRole('button', { name: /new gateway/i }).first().click();
  form = dialog();
  await form.getByLabel('Display name').fill('Temp Stripe');
  await form.getByLabel(/secret key/i).fill('sk_test_tempKey');
  await form.getByRole('button', { name: 'Create gateway' }).click();
  await expect(form).toBeHidden();
  await rows.filter({ hasText: 'Temp Stripe' }).getByRole('button', { name: 'Delete Temp Stripe' }).click();
  await shot('gateway-delete-confirm');
  await dialog().getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(toast()).toContainText('Payment gateway deleted');
  await expect(rows).toHaveCount(2);
  await expectLayoutIntact();
  await shot('gateways-final');
});

test('Payment Terminals: register Bolt and Stripe readers, validate, edit, toggle and delete', async () => {
  await goTo(/^terminals$/i);
  await expectNavHub(/^terminals$/i);
  await expect(page.getByTestId('terminals-empty-state')).toBeVisible();
  await shot('terminals-empty');

  await page.getByTestId('terminals-empty-state').getByRole('button', { name: /register terminal/i }).click();
  let form = dialog();
  const boltGateway = await form.getByLabel('Payment gateway').locator('option', { hasText: 'CardPointe Bolt UAT' }).getAttribute('value');
  await form.getByLabel('Payment gateway').selectOption(boltGateway!);
  await form.getByLabel('Name').fill('Counter Bolt');
  await form.getByLabel(/model/i).fill('Ingenico Lane/3000');
  const device = form.getByLabel(/hardware serial number/i);
  await device.fill('bad id!');
  await expect(device).toHaveAttribute('aria-invalid', 'true');
  await expect(form.getByRole('button', { name: 'Register terminal' })).toBeDisabled();
  await shot('terminal-invalid-hsn');
  await device.fill(BOLT_HSN);
  await expectLayoutIntact(form);
  await form.getByRole('button', { name: 'Register terminal' }).click();
  await expect(form).toBeHidden();
  await expect(toast()).toContainText('Payment terminal registered');

  // Stripe reader
  await page.getByRole('button', { name: /register terminal/i }).first().click();
  form = dialog();
  const stripeValue = await form.getByLabel('Payment gateway').locator('option', { hasText: 'Stripe Ocean Drive' }).getAttribute('value');
  await form.getByLabel('Payment gateway').selectOption(stripeValue!);
  await form.getByLabel('Name').fill('WisePOS E');
  await form.getByLabel(/stripe reader id/i).fill(STRIPE_READER);
  await shot('terminal-stripe-form');
  await form.getByRole('button', { name: 'Register terminal' }).click();
  await expect(form).toBeHidden();

  // Uno extra para editar, desactivar y borrar
  await page.getByRole('button', { name: /register terminal/i }).first().click();
  form = dialog();
  await form.getByLabel('Payment gateway').selectOption(stripeValue!);
  await form.getByLabel('Name').fill('Patio reader');
  await form.getByLabel(/stripe reader id/i).fill('tmr_PatioReader01');
  await form.getByRole('button', { name: 'Register terminal' }).click();
  await expect(form).toBeHidden();

  const rows = page.locator('[data-testid^="terminal-row-"]');
  await expect(rows).toHaveCount(3);
  await expectRedHover(rows.filter({ hasText: 'Counter Bolt' }).getByRole('button', { name: 'Edit Counter Bolt' }));
  await shot('terminals-list');

  await rows.filter({ hasText: 'Patio reader' }).getByRole('button', { name: 'Edit Patio reader' }).click();
  form = dialog();
  await form.getByLabel('Name').fill('Patio reader 2');
  await form.getByRole('button', { name: 'Save changes' }).click();
  await expect(form).toBeHidden();
  await expect(toast()).toContainText('Payment terminal updated');
  const patio = rows.filter({ hasText: 'Patio reader 2' });
  await patio.getByRole('button', { name: 'Deactivate Patio reader 2' }).click();
  await page.getByRole('button', { name: 'Deactivate', exact: true }).click();
  await expect(patio.getByText('Inactive')).toBeVisible();
  await shot('terminal-deactivated');
  await patio.getByRole('button', { name: 'Delete Patio reader 2' }).click();
  await shot('terminal-delete-confirm');
  await dialog().getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(toast()).toContainText('Payment terminal deleted');
  await expect(rows).toHaveCount(2);

  // Una pasarela con terminales no se borra: el backend lo explica (409 esperado)
  await goTo(/^gateways$/i);
  const cpRow = page.locator('[data-testid^="gateway-row-"]').filter({ hasText: 'CardPointe Bolt UAT' });
  await cpRow.getByRole('button', { name: 'Delete CardPointe Bolt UAT' }).click();
  expectedClientErrors += 1;
  await dialog().getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(dialog().getByRole('alert')).toContainText(/terminal\(s\) are bound/);
  await shot('gateway-delete-conflict');
  await dialog().getByRole('button', { name: 'Cancel' }).click();
});

test('Order Payment Tenders: charge cards with Stripe.js and CardSecure, including a decline', async () => {
  await goTo(/^payments$/i);
  await expectNavHub(/^payments$/i);
  await expect(page.getByText(/In Development/i)).toHaveCount(0);
  await expect(page.getByTestId(`payable-order-${orders[0]}`)).toBeVisible();
  await expect(page.getByTestId('transactions-empty-state')).toBeVisible();
  await expectPoppins(page.getByTestId(`payable-order-${orders[0]}`).locator('td').first());
  await expectLayoutIntact();
  await shot('payments-initial');

  // 1. Stripe aprobado, con propina
  const row0 = page.getByTestId(`payable-order-${orders[0]}`);
  await expectRedHover(row0.getByRole('button', { name: /charge card/i }));
  await row0.getByRole('button', { name: /charge card/i }).click();
  let form = dialog();
  await expect(form.getByLabel('Payment gateway')).toHaveValue(/\d+/);
  const card = form.getByTestId('stripe-card-element');
  await expect(card.getByLabel('Card number')).toBeVisible();
  await expect(form.getByRole('button', { name: 'Charge $25.00' })).toBeDisabled();
  await card.getByLabel('Card number').fill('4242 4242 4242 4242');
  await card.getByLabel('MM / YY').fill('12 / 30');
  await card.getByLabel('CVC').fill('123');
  await form.getByLabel(/tip/i).fill('3');
  await expectLayoutIntact(form);
  await shot('charge-stripe-form');
  await form.getByRole('button', { name: 'Charge $28.00' }).click();
  await expect(form).toBeHidden({ timeout: 15_000 });
  await expect(toast()).toContainText('Payment approved: $28.00 · Visa •••• 4242');
  await expect(page.getByTestId(`payable-order-${orders[0]}`)).toHaveCount(0);
  const saleRow = page.locator('[data-testid^="payment-row-"]').first();
  await expect(saleRow).toContainText('Paid');
  await expect(saleRow).toContainText('Visa •••• 4242');
  await shot('charge-stripe-approved');

  // 2. Tarjeta rechazada: el diálogo sigue abierto con el motivo
  await page.getByTestId(`payable-order-${orders[1]}`).getByRole('button', { name: /charge card/i }).click();
  form = dialog();
  const card2 = form.getByTestId('stripe-card-element');
  await card2.getByLabel('Card number').fill('4000 0000 0000 0002');
  await card2.getByLabel('MM / YY').fill('12 / 30');
  await card2.getByLabel('CVC').fill('123');
  await form.getByRole('button', { name: 'Charge $25.00' }).click();
  await expect(form.getByRole('alert')).toContainText('Payment declined: Your card was declined.');
  await expectLayoutIntact(form);
  await shot('charge-declined');
  await form.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByTestId(`payable-order-${orders[1]}`)).toBeVisible();

  // 3. CardPointe con el iFrame de CardSecure
  await page.getByTestId(`payable-order-${orders[1]}`).getByRole('button', { name: /charge card/i }).click();
  form = dialog();
  const cpValue = await form.getByLabel('Payment gateway').locator('option', { hasText: 'CardPointe' }).getAttribute('value');
  await form.getByLabel('Payment gateway').selectOption(cpValue!);
  const iframe = page.frameLocator('iframe[title="Secure card entry"]');
  await iframe.getByLabel('Card number').fill('5555555555554444');
  await iframe.getByLabel('Expiry MMYY').fill('1230');
  await iframe.getByLabel('CVV').fill('123');
  await expect(form.getByText(/card tokenized ending in 4444/i)).toBeVisible();
  await expectLayoutIntact(form);
  await shot('charge-cardsecure-form');
  await form.getByRole('button', { name: 'Charge $25.00' }).click();
  await expect(form).toBeHidden({ timeout: 15_000 });
  await expect(toast()).toContainText('Payment approved');
  await shot('charge-cardpointe-approved');
});

test('Order Payment Tenders: terminal sales on Bolt and a Stripe reader (pending → paid / failed)', async ({ request }) => {
  // Bolt aprobado
  await page.getByTestId(`payable-order-${orders[2]}`).getByRole('button', { name: /terminal/i }).click();
  let form = dialog();
  const boltValue = await form.getByLabel('Terminal', { exact: true }).locator('option', { hasText: 'Counter Bolt' }).getAttribute('value');
  await form.getByLabel('Terminal', { exact: true }).selectOption(boltValue!);
  await expectLayoutIntact(form);
  await shot('terminal-sale-form');
  await form.getByRole('button', { name: /send \$25\.00 to terminal/i }).click();
  await expect(form.getByText('Waiting for the customer card')).toBeVisible();
  await expect(form.getByText('Pending')).toBeVisible();
  await shot('terminal-sale-waiting');
  await expect
    .poll(async () => ((await (await request.get(`${GATEWAY}/__control/state`)).json()) as { boltWaiting: string[] }).boltWaiting)
    .toContain(BOLT_HSN);
  expect((await gateway(request, `/__control/bolt/${BOLT_HSN}/present`, { outcome: 'approve' })).ok()).toBeTruthy();
  await expect(form.getByText('Payment approved')).toBeVisible({ timeout: 15_000 });
  await shot('terminal-sale-approved');
  await form.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByTestId(`payable-order-${orders[2]}`)).toHaveCount(0);

  // Bolt rechazado y reintento
  await page.getByTestId(`payable-order-${orders[3]}`).getByRole('button', { name: /terminal/i }).click();
  form = dialog();
  await form.getByLabel('Terminal', { exact: true }).selectOption(boltValue!);
  await form.getByRole('button', { name: /to terminal/i }).click();
  await expect(form.getByText('Waiting for the customer card')).toBeVisible();
  await expect
    .poll(async () => ((await (await request.get(`${GATEWAY}/__control/state`)).json()) as { boltWaiting: string[] }).boltWaiting)
    .toContain(BOLT_HSN);
  await gateway(request, `/__control/bolt/${BOLT_HSN}/present`, { outcome: 'decline' });
  await expect(form.getByText('Payment failed')).toBeVisible({ timeout: 15_000 });
  await expect(form.getByText('Do not honor')).toBeVisible();
  await shot('terminal-sale-declined');
  await form.getByRole('button', { name: 'Try again' }).click();
  await expect(form.getByRole('button', { name: /to terminal/i })).toBeVisible();
  await form.getByRole('button', { name: 'Cancel' }).click();

  // Stripe reader con propina: se cierra el diálogo mientras espera y luego se paga
  await page.getByTestId(`payable-order-${orders[3]}`).getByRole('button', { name: /terminal/i }).click();
  form = dialog();
  const readerValue = await form.getByLabel('Terminal', { exact: true }).locator('option', { hasText: 'WisePOS E' }).getAttribute('value');
  await form.getByLabel('Terminal', { exact: true }).selectOption(readerValue!);
  await form.getByLabel(/tip/i).fill('2');
  await form.getByRole('button', { name: /send \$27\.00 to terminal/i }).click();
  await expect(form.getByText('Waiting for the customer card')).toBeVisible();
  await expect
    .poll(async () => ((await (await request.get(`${GATEWAY}/__control/state`)).json()) as { readers: Record<string, string> }).readers)
    .toHaveProperty(STRIPE_READER);
  await shot('reader-sale-waiting');
  await gateway(request, `/stripe/v1/test_helpers/terminal/readers/${STRIPE_READER}/present_payment_method`, {}, {
    Authorization: 'Bearer sk_test_e2eFakeKey',
  });
  await expect(form.getByText('Payment approved')).toBeVisible({ timeout: 15_000 });
  await expect(form).toContainText('Visa •••• 4242');
  await shot('reader-sale-approved');
  await form.getByRole('button', { name: 'Done' }).click();
  await expect(toast()).toContainText('Terminal payment approved: $27.00');
});

test('Refunds and voids: partial, full, locked, and a void refused after batch closure', async ({ request }) => {
  /** Id de la venta pagada del pedido (por la API, sin depender del texto de las filas) */
  const saleIdOf = async (orderId: number) => {
    const res = await api(request, 'get', `/v1/payment-processing?orderId=${orderId}&type=sale&status=paid`);
    expect(res.data, `paid sale of order ${orderId}`).toHaveLength(1);
    return String(res.data[0].id);
  };
  const rowOf = (id: string) => page.getByTestId(`payment-row-${id}`);

  // Parcial sobre la venta Stripe de $28
  const saleId = await saleIdOf(orders[0]);
  const sale = rowOf(saleId);
  await expectRedHover(sale.getByRole('button', { name: `Refund payment ${saleId}` }));
  await sale.getByRole('button', { name: `Refund payment ${saleId}` }).click();
  let form = dialog();
  await expect(form.getByLabel(/refund amount/i)).toHaveValue('28.00');
  await form.getByLabel(/refund amount/i).fill('10');
  await expect(form.getByText('Partial refund')).toBeVisible();
  await form.getByLabel(/reason/i).fill('Cold fries');
  await expectLayoutIntact(form);
  await shot('refund-partial-form');
  await form.getByRole('button', { name: 'Refund $10.00' }).click();
  await expect(form).toBeHidden();
  await expect(toast()).toContainText('Refunded $10.00 · Visa •••• 4242');
  const partial = rowOf(saleId);
  await expect(partial).toContainText('Partially refunded');
  await expect(partial).toContainText('$10.00');
  // Con devoluciones ya no se anula
  await expect(partial.getByRole('button', { name: `Void payment ${saleId}` })).toHaveCount(0);
  await shot('refund-partial-done');

  // Detalle con su devolución, y desde ahí devolver el resto
  await partial.getByRole('button', { name: `View payment ${saleId}` }).click();
  form = dialog();
  await expect(form.getByText('Refunds and voids')).toBeVisible();
  await expect(form.getByText('Cold fries')).toHaveCount(0);
  await expectLayoutIntact(form);
  await shot('payment-detail');
  await form.getByRole('button', { name: 'Refund' }).click();
  form = dialog();
  await form.getByRole('button', { name: 'Max' }).click();
  await expect(form.getByText('Full refund of the remaining balance')).toBeVisible();
  await form.getByRole('button', { name: 'Refund $18.00' }).click();
  await expect(form).toBeHidden();
  const refunded = rowOf(saleId);
  await expect(refunded).toContainText('Refunded');
  await expect(refunded.getByRole('button', { name: `Refund payment ${saleId}` })).toHaveCount(0);
  await expect(page.getByTestId(`payable-order-${orders[0]}`)).toBeVisible();
  await shot('refund-full-locked');

  // La API también bloquea una venta devuelta por completo (409)
  const locked = await request.post(`${API}/v1/payment-processing/${saleId}/refund`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { amount: 1 },
  });
  expect(locked.status()).toBe(409);

  // Anular una venta Stripe antes del cierre: el pedido vuelve a la lista por cobrar
  const readerId = await saleIdOf(orders[3]);
  const readerSale = rowOf(readerId);
  await readerSale.getByRole('button', { name: `Void payment ${readerId}` }).click();
  form = dialog();
  await form.getByLabel(/reason/i).fill('Charged the wrong table');
  await expectLayoutIntact(form);
  await shot('void-form');
  await form.getByRole('button', { name: 'Void payment' }).click();
  await expect(form).toBeHidden();
  await expect(toast()).toContainText('Transaction voided');
  await expect(rowOf(readerId)).toContainText('Voided');
  await expect(page.getByTestId(`payable-order-${orders[3]}`)).toBeVisible();
  await shot('void-done');

  // Lote cerrado en CardPointe: la anulación se rechaza y se indica devolver
  await gateway(request, '/__control/cardpointe/settle');
  const cpId = await saleIdOf(orders[1]);
  const cpSale = rowOf(cpId);
  await cpSale.getByRole('button', { name: `Void payment ${cpId}` }).click();
  form = dialog();
  await form.getByRole('button', { name: 'Void payment' }).click();
  await expect(form.getByRole('alert')).toContainText(/Txn not voidable.*refund it instead/);
  await shot('void-refused-settled');
  await form.getByRole('button', { name: 'Cancel' }).click();
  await cpSale.getByRole('button', { name: `Refund payment ${cpId}` }).click();
  await dialog().getByRole('button', { name: 'Refund $25.00' }).click();
  await expect(rowOf(cpId)).toContainText('Refunded');
  await shot('refund-after-settlement');
});

test('History filters, pagination and the PCI guard of the API', async ({ request }) => {
  await page.getByLabel('Filter by type').selectOption('refund');
  await expect(page.locator('[data-testid^="payment-row-"]').first()).toContainText('Refund');
  for (const row of await page.locator('[data-testid^="payment-row-"]').all()) {
    await expect(row.getByText('Refund', { exact: true })).toBeVisible();
  }
  await shot('filter-refunds');
  await page.getByLabel('Filter by type').selectOption('');
  await page.getByLabel('Filter by status').selectOption('failed');
  await expect(page.locator('[data-testid^="payment-row-"]').first()).toContainText('Failed');
  await shot('filter-failed');
  await page.getByLabel('Filter by status').selectOption('');
  await page.getByLabel('Filter by order ID').fill(String(orders[0]));
  await expect(page.locator('[data-testid^="payment-row-"]')).toHaveCount(3);
  await shot('filter-order');
  await page.getByRole('button', { name: 'Clear Filters' }).click();
  await page.getByLabel('Filter by order ID').fill('999999');
  await expect(page.getByTestId('transactions-empty-state')).toContainText('No payments match your filters');
  await page.getByTestId('transactions-empty-state').getByRole('button', { name: 'Clear filters' }).click();

  // Más de una página de historial
  await expect(page.getByText(/Page 1 of 2/)).toBeVisible();
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByText(/Page 2 of 2/)).toBeVisible();
  await shot('history-page-2');
  await page.getByRole('button', { name: 'Previous' }).click();
  await expect(page.getByText(/Page 1 of 2/)).toBeVisible();
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await page.getByRole('button', { name: 'Refresh orders' }).click();
  await page.waitForLoadState('networkidle');

  // Datos de tarjeta en claro nunca se aceptan
  const pan = await request.post(`${API}/v1/payment-processing/charge`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { orderId: orders[4], amount: 25, paymentMethodToken: '4242424242424242' },
  });
  expect(pan.status()).toBe(400);
  const cvv = await request.post(`${API}/v1/payment-processing/charge`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { orderId: orders[4], amount: 25, paymentMethodToken: 'pm_card_visa', cvv: '123' },
  });
  expect(cvv.status()).toBe(400);
  expect(await cvv.text()).toContain('raw card data');
  await expectLayoutIntact();
  await shot('payments-final');
});

test('no console errors, no 5xx responses, consistent at a narrower width', async () => {
  await page.setViewportSize({ width: 1280, height: 800 });
  // Enlace directo a la pantalla (las URLs /app/pos/... que se registraron)
  await page.goto('/app/pos/order-payments');
  await page.waitForLoadState('networkidle');
  await expect(page.getByText('Card payment transactions')).toBeVisible();
  await expectNavHub(/^payments$/i);
  await expectLayoutIntact();
  await shot('payments-1280');

  expect(serverErrors, 'responses with status >= 500').toEqual([]);
  const unexpected = consoleErrors.filter((e) => !/status of 409/.test(e));
  expect(unexpected, 'console errors').toEqual([]);
  expect(consoleErrors.filter((e) => /status of 409/.test(e)).length).toBeLessThanOrEqual(expectedClientErrors);
});
