// E2E real de Platform SaaS (historias 1-7): Companies Hub, Companies Directory, Company Hub,
// Company Profile, Company Configuration, Company Merchants Directory, Merchant Hub, Merchant
// Profile, Merchant User Directory y User Dashboard. Chromium contra la API NestJS y Postgres,
// sin mocks. Lo levanta y apaga e2e/real/saas/stack.mjs con los datos de seed.sql; no corre con
// `npm run test:e2e`.
//
// Cada pantalla y cada botón deja una captura (E2E_SHOTS). La ejecución falla ante cualquier
// error o aviso de consola, pageerror, respuesta HTTP >= 400 no provocada a propósito (>= 500
// nunca), desborde horizontal a 1440 px o a 390 px, títulos sin Poppins o iconos sin Material
// Symbols Outlined.
import { readFileSync } from 'node:fs';
import { expect, test, type Browser, type Locator, type Page, type Response } from '@playwright/test';

test.skip(process.env.E2E_SAAS_REAL !== '1', 'Run through e2e/real/saas/stack.mjs');
test.describe.configure({ mode: 'serial' });

const API = process.env.E2E_API ?? 'http://127.0.0.1:3111/api';
const SHOTS = process.env.E2E_SHOTS ?? 'test-results/saas-real';
const BACKEND_LOG = process.env.E2E_BACKEND_LOG;
const RED = 'rgb(174, 0, 26)';
const OWNER = { email: 'owner@x7saas-e2e.com', password: 'E2eSaasOwner123!' };
const COMPANY_ADMIN = { email: 'admin@andesbistro-e2e.com', password: 'E2eSaasOwner123!' };

// Ids y números de seed.sql
const PLATFORM = 1;
const ANDES = 2;
const COASTAL = 3;
const NORDIC = 4;
const OLD_TOWN = 5;
const CENTRO = 2;
const PROVIDENCIA = 3;
const VALPARAISO = 4;
const CONCEPCION = 5;
const MIAMI = 6;
const SOFIA = 3;

let page: Page;
let step = 0;
const visited = new Set<string>();

// ---- puertas de cero errores -------------------------------------------------------------

interface Gates {
  console: string[];
  pageErrors: string[];
  http: string[];
  serverErrors: string[];
  expectedHttp: string[];
  apiResponses: number;
}
const gates: Gates = { console: [], pageErrors: [], http: [], serverErrors: [], expectedHttp: [], apiResponses: 0 };
/**
 * Respuestas >= 400 que la prueba provoca a propósito (status + final de la URL). Valen mientras
 * dure la prueba que las declara (en desarrollo StrictMode repite cada petición) y cada una tiene
 * que llegar al menos una vez.
 */
const expectedFailures: Array<{ status: number; url: string; seen: number }> = [];
const expectedFailureUrls = new Set<string>();
const layoutChecks = { desktop: 0, mobile: 0 };
let fontChecks = 0;
let iconChecks = 0;
let hoverChecks = 0;

const expectFailure = (status: number, url: string) => {
  if (!expectedFailures.some((e) => e.status === status && e.url === url)) expectedFailures.push({ status, url, seen: 0 });
};
/** Comprueba que llegaron todas las respuestas provocadas y deja de admitirlas */
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
    // Chrome registra como error de consola cada 4xx; solo se admite el de una respuesta esperada
    if (/Failed to load resource/.test(text) && expectedFailureUrls.has(msg.location().url)) return;
    gates.console.push(`[${type}] ${text} @ ${msg.location().url}`);
  });
  p.on('pageerror', (err) => gates.pageErrors.push(`${err.message}\n${err.stack ?? ''}`));
  p.on('response', (res: Response) => {
    const url = res.url();
    if (url.startsWith(API)) gates.apiResponses += 1;
    const status = res.status();
    if (status < 400) return;
    const line = `${status} ${res.request().method()} ${url}`;
    if (status >= 500) {
      gates.serverErrors.push(line);
      return;
    }
    const expected = expectedFailures.find((e) => e.status === status && new URL(url).pathname.endsWith(e.url));
    if (expected) {
      expected.seen += 1;
      expectedFailureUrls.add(url);
      gates.expectedHttp.push(line);
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
  // sin indicadores de carga a la vista
  await expect(page.locator('main [role="status"] .animate-spin')).toHaveCount(0);
  await page.waitForTimeout(200);
};

const expectNoOverflow = async (label: string) => {
  const box = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    inner: window.innerWidth,
  }));
  expect(box.scroll, `horizontal overflow on ${label} at ${box.inner}px`).toBeLessThanOrEqual(box.inner);
};

/**
 * Captura de toda la vista: el layout desplaza <main>, no el documento, así que fullPage solo
 * vería la ventana. Se agranda la ventana a la altura del contenido, se captura y se restaura.
 */
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

const shot = async (name: string) => {
  step += 1;
  await settle();
  await expectNoOverflow(name);
  layoutChecks.desktop += 1;
  visited.add(new URL(page.url()).pathname);
  if (new URL(page.url()).pathname.startsWith('/platform-saas/')) {
    // La cabecera global debe ubicar la pantalla en Platform SaaS, nunca en el fallback "SYSTEM".
    const banner = page.getByRole('banner');
    await expect(banner).toContainText(/Platform SaaS/i);
    await expect(banner).not.toContainText(/\bSYSTEM\b/);
  }
  await fullShot(`${SHOTS}/${String(step).padStart(2, '0')}-${name}.png`);
  expectNoErrorsSoFar(name);
};

const colorOf = (l: Locator) => l.evaluate((el) => getComputedStyle(el).color);

/** Títulos en Poppins (y la fuente cargada de verdad, no el fallback) */
const expectPoppins = async (l: Locator) => {
  expect(await l.evaluate((el) => getComputedStyle(el).fontFamily)).toContain('Poppins');
  expect(await page.evaluate(() => document.fonts.check('700 16px Poppins'))).toBe(true);
  fontChecks += 1;
};

/** Icono dibujado con la fuente Material Symbols Outlined (ligadura, no el texto del nombre) */
const expectSymbol = async (l: Locator, name: string) => {
  await expect(l).toHaveText(name);
  expect(await l.evaluate((el) => getComputedStyle(el).fontFamily)).toContain('Material Symbols Outlined');
  expect(await page.evaluate(() => document.fonts.check('24px "Material Symbols Outlined"'))).toBe(true);
  const box = (await l.boundingBox())!;
  // una ligadura ocupa un cuadrado del tamaño de la fuente; el texto "storefront" sería mucho más ancho
  expect(box.width, `icon "${name}" rendered as text`).toBeLessThanOrEqual(box.height * 1.3 + 2);
  iconChecks += 1;
};

/** hover:text-primary: el título de la tarjeta pasa al rojo corporativo */
const expectRedHover = async (target: Locator, colored: Locator = target) => {
  await page.mouse.move(0, 0);
  const before = await colorOf(colored);
  await target.hover();
  await expect.poll(() => colorOf(colored)).toBe(RED);
  expect(before).not.toBe(RED);
  await page.mouse.move(0, 0);
  hoverChecks += 1;
};

const heading = () => page.locator('main h1').first();
/** Botones de acción de la cabecera secundaria (Back to …), fuera de las migas */
const headerAction = (name: string) => page.locator('main header > div').getByRole('button', { name, exact: true });
const crumbs = () => page.locator('nav[aria-label="Breadcrumb"]');
/** Barra inferior fija (NavHubBar) de las vistas Platform SaaS: sustituye a Quick Launch. */
const navBar = () => page.getByRole('navigation', { name: 'Platform SaaS navigation' });
const navButton = (label: string) => navBar().getByRole('button', { name: label, exact: true });

/** Botones de la barra inferior: [back, ...destinos] con el activo marcado con aria-current. */
const expectNavBar = async (back: string, labels: string[], active?: string) => {
  // el <nav> no tiene caja propia: la barra es su hijo con position: fixed
  await expect(navBar().locator('div.fixed').first()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Quick Launch' })).toHaveCount(0);
  await expect(page.locator('.quick-launch-btn')).toHaveCount(0);
  const names = await navBar().getByRole('button').evaluateAll((els) =>
    els.map((el) => el.getAttribute('aria-label') ?? (el.textContent ?? '').replace(/^[a-z_]+/, '').trim()),
  );
  expect(names).toEqual([back, ...labels]);
  if (active) await expect(navButton(active)).toHaveAttribute('aria-current', 'page');
  // anclada abajo: su borde inferior es el de la ventana
  const box = (await navBar().locator('div.fixed').first().boundingBox())!;
  expect(Math.round(box.y + box.height)).toBe(page.viewportSize()!.height);
  await expectSymbol(navButton(back).locator('.material-symbols-outlined'), 'arrow_back');
};

const expectCrumbs = async (labels: string[]) => {
  await expect(crumbs().locator('li')).toHaveText(labels.map((l) => new RegExp(`^${l.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`)));
  await expect(crumbs().locator('[aria-current="page"]')).toHaveText(labels[labels.length - 1]);
};

const clickCrumb = async (label: string) => {
  await crumbs().getByRole('button', { name: label, exact: true }).click();
  await settle();
};

const expectPath = async (path: string) => {
  await expect(page).toHaveURL((url) => url.pathname === path);
  await settle();
};

const stat = (id: string) => page.getByTestId(`stat-${id}`);
const expectStat = async (id: string, value: string | number, hint?: string | RegExp) => {
  await expect(stat(id).locator('[data-stat-value]')).toHaveText(String(value));
  if (hint) await expect(stat(id).locator('[data-stat-hint]')).toHaveText(hint);
};

const rows = (prefix: string) => page.locator(`[data-testid^="${prefix}-row-"]`);
const expectRows = async (prefix: string, ids: number[]) => {
  await settle();
  await expect(rows(prefix)).toHaveCount(ids.length);
  const actual = await rows(prefix).evaluateAll((els) => els.map((el) => Number(el.getAttribute('data-testid')!.split('-').pop())));
  expect([...actual].sort((a, b) => a - b)).toEqual([...ids].sort((a, b) => a - b));
};

const featureCard = (id: string) => page.getByTestId(`feature-card-${id}`);
const companyField = (field: string) => page.locator(`#company-${field}`);

async function login(p: Page, who: { email: string; password: string }, shotName?: string) {
  await p.goto('/login');
  await p.waitForLoadState('networkidle');
  await p.locator('input[type=email]').fill(who.email);
  await p.locator('input[type=password]').fill(who.password);
  if (shotName) await shot(shotName);
  await p.keyboard.press('Enter');
  await p.waitForURL(/dashboard/, { timeout: 30_000 });
  await p.waitForLoadState('networkidle');
}

test.beforeAll(async ({ browser }: { browser: Browser }) => {
  page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  watch(page);
});

test.afterAll(async () => {
  await page?.close();
});

// ---- Historia 1: Companies Hub -----------------------------------------------------------

test('H1 · the SaaS owner reaches the Companies Hub from the Platform SaaS sidebar', async () => {
  await login(page, OWNER, 'login-screen');
  await shot('dashboard-after-login');

  const sidebar = page.locator('aside').first();
  await expect(sidebar.getByText('Platform SaaS', { exact: true }).first()).toBeVisible();
  await sidebar.getByText('Companies', { exact: true }).click();
  await expectPath('/platform-saas/companies/hub');
  await shot('companies-hub');
});

test('H1 · secondary header: exact title, subtitle and breadcrumb context', async () => {
  await expect(heading()).toHaveText('COMPANIES COMMAND HUB');
  await expectPoppins(heading());
  await expect(page.locator('main header p').first()).toContainText('Company profile management and tenant setup');
  await expectCrumbs(['Platform SaaS', 'Companies Hub']);
  await expectSymbol(page.locator('main header .material-symbols-outlined').filter({ hasText: /^business$/ }).first(), 'business');
});

test('H1 · stat cards show the seeded company, configuration and profile counts', async () => {
  // 5 companies (3 activas, 1 suspendida), 4 configuraciones (3 activas), 10 usuarios, 5 merchants activos
  await expectStat('active-companies', 3, '5 company profiles · 1 suspended');
  await expectStat('tenant-configurations', 4, '3 active configurations');
  await expectStat('system-profiles', 10);
  await expectStat('active-merchants', 5);
  await expectPoppins(stat('active-companies').locator('[data-stat-value]'));
  // la cifra se ve grande (text-3xl = 30px), no aplastada por el tema SaaS
  expect(await stat('active-companies').locator('[data-stat-value]').evaluate((el) => getComputedStyle(el).fontSize)).toBe('30px');
  await expectSymbol(stat('active-companies').locator('.material-symbols-outlined'), 'business');
  await expectSymbol(stat('tenant-configurations').locator('.material-symbols-outlined'), 'settings');
});

test('H1 · feature cards: icons, Poppins titles and the red hover micro-interaction', async () => {
  const profile = featureCard('company-profile');
  const configuration = featureCard('company-configuration');
  await expect(profile.locator('h3')).toHaveText('Company Profile');
  await expect(configuration.locator('h3')).toHaveText('Company Configuration');
  await expect(featureCard('companies-directory').locator('h3')).toHaveText('Companies Directory');
  await expectSymbol(profile.locator('.material-symbols-outlined').first(), 'business');
  await expectSymbol(configuration.locator('.material-symbols-outlined').first(), 'settings');
  for (const card of [profile, configuration, featureCard('companies-directory')]) {
    await expectPoppins(card.locator('h3'));
    await expect(card.locator('h3')).toHaveClass(/hover:text-primary/);
    await expect(card.locator('h3')).toHaveClass(/transition-colors/);
    await expect(card.locator('h3')).toHaveClass(/duration-200/);
    // el título solo y la tarjeta entera
    await expectRedHover(card.locator('h3'));
    await expectRedHover(card, card.locator('h3'));
  }
  await profile.hover();
  await shot('companies-hub-card-hover');
  await page.mouse.move(0, 0);
});

test('H1 · bottom NavHubBar (quick access toolbar) anchored at the bottom with the company features', async () => {
  await expectNavBar(
    'Back to Platform SaaS Dashboard',
    ['Companies Hub', 'Companies Directory', 'Company Profile', 'Company Configuration', 'Company Merchants'],
    'Companies Hub',
  );
  // hover rojo corporativo en los botones de la barra
  await page.mouse.move(0, 0);
  const before = await colorOf(navButton('Company Profile'));
  await navButton('Company Profile').hover();
  await expect.poll(() => colorOf(navButton('Company Profile'))).toBe(RED);
  expect(before).not.toBe(RED);
  hoverChecks += 1;
  await shot('companies-hub-nav-bar');
  await page.mouse.move(0, 0);
});

const contextSelect = () => page.getByLabel('Company context');
const rememberedContext = () => page.evaluate(() => sessionStorage.getItem('x7:saas-company-context'));

test('H1 · Company context selector: options from GET /saas/companies, default = first active company', async () => {
  // nada recordado todavía en esta pestaña: la primera company activa por nombre (Andes)
  expect(await rememberedContext()).toBeNull();
  const [companies] = await Promise.all([
    page.waitForResponse((r) => r.request().method() === 'GET' && new URL(r.url()).pathname.endsWith('/v1/saas/companies')),
    page.goto('/platform-saas/companies/hub'),
  ]);
  expect(companies.status()).toBe(200);
  expect(new URL(companies.url()).searchParams.get('limit')).toBe('100');
  await settle();
  const select = contextSelect();
  await expect(select).toBeVisible();
  await expect(select).toBeEnabled();
  await expect(select).toHaveValue(String(ANDES));
  await expect(select.locator('option')).toHaveText([
    'Andes Bistro Group',
    'Coastal Eats LLC',
    'Nordic Grill AB (Suspended)',
    'Old Town Diner Co (Inactive)',
    'X7 POS Platform',
  ]);
  // dentro de la cabecera secundaria, con icono, Poppins y hover rojo
  await expect(page.locator('main header').getByLabel('Company context')).toHaveCount(1);
  await expectSymbol(page.locator('main header .material-symbols-outlined').filter({ hasText: /^apartment$/ }), 'apartment');
  await expectPoppins(select);
  await expectPoppins(page.locator('label[for="companies-hub-context"]'));
  await expect(select).toHaveClass(/hover:text-primary/);
  await expectRedHover(select);
  for (const card of ['company-profile', 'company-configuration']) {
    await expect(featureCard(card)).toContainText('Opens Andes Bistro Group.');
  }
  await shot('hub-context-selector-default-andes');

  await featureCard('company-profile').click();
  await expectPath(`/platform-saas/companies/${ANDES}/profile`);
  await expect(heading()).toHaveText('COMPANY PROFILE');
  await expect(companyField('commercialName')).toHaveValue('Andes Bistro Group');
  await shot('hub-default-context-card-company-profile');
  await clickCrumb('Companies Hub');
  await expectPath('/platform-saas/companies/hub');
  await featureCard('company-configuration').click();
  await expectPath(`/platform-saas/companies/${ANDES}/configuration`);
  await expect(heading()).toHaveText('COMPANY CONFIGURATION');
  await shot('hub-default-context-card-company-configuration');
  await clickCrumb('Companies Hub');
  await expectPath('/platform-saas/companies/hub');
});

test('H1 · changing the Company context sends the cards and the bottom bar to the chosen company', async () => {
  await contextSelect().selectOption({ label: 'Coastal Eats LLC' });
  await expect(contextSelect()).toHaveValue(String(COASTAL));
  // el cambio queda recordado
  expect(await rememberedContext()).toBe(String(COASTAL));
  for (const card of ['company-profile', 'company-configuration']) {
    await expect(featureCard(card)).toContainText('Opens Coastal Eats LLC.');
  }
  await shot('hub-context-selector-changed-coastal');

  await featureCard('company-profile').click();
  await expectPath(`/platform-saas/companies/${COASTAL}/profile`);
  await expect(companyField('commercialName')).toHaveValue('Coastal Eats LLC');
  await expect(companyField('taxId')).toHaveValue('12-3456789');
  await expectCrumbs(['Platform SaaS', 'Companies Hub', 'Companies Directory', 'Coastal Eats LLC', 'Company Profile']);
  await shot('hub-card-company-profile-coastal');
  await clickCrumb('Companies Hub');
  await expectPath('/platform-saas/companies/hub');
  // de vuelta en el hub sigue elegida Coastal
  await expect(contextSelect()).toHaveValue(String(COASTAL));

  await featureCard('company-configuration').click();
  await expectPath(`/platform-saas/companies/${COASTAL}/configuration`);
  await expect(page.locator('main').getByText('Coastal Miami Beach').first()).toBeVisible();
  await expect(page.locator('main')).not.toContainText('Andes Santiago Centro');
  await shot('hub-card-company-configuration-coastal');
  await clickCrumb('Companies Hub');
  await expectPath('/platform-saas/companies/hub');

  for (const [label, path] of [
    ['Company Profile', `/platform-saas/companies/${COASTAL}/profile`],
    ['Company Configuration', `/platform-saas/companies/${COASTAL}/configuration`],
    ['Company Merchants', `/platform-saas/companies/${COASTAL}/merchants`],
  ] as const) {
    await page.goto('/platform-saas/companies/hub');
    await settle();
    await expect(contextSelect()).toHaveValue(String(COASTAL));
    await navButton(label).click();
    await expectPath(path);
    await shot(`hub-nav-bar-coastal-${label.toLowerCase().replace(/ /g, '-')}`);
  }

  // una company suspendida también se puede elegir
  await page.goto('/platform-saas/companies/hub');
  await settle();
  await contextSelect().selectOption(String(NORDIC));
  expect(await rememberedContext()).toBe(String(NORDIC));
  await featureCard('company-profile').click();
  await expectPath(`/platform-saas/companies/${NORDIC}/profile`);
  await expect(companyField('status')).toHaveValue('suspended');
  await shot('hub-card-company-profile-nordic-suspended');

  // se vuelve a Andes para el resto de la suite
  await page.goto('/platform-saas/companies/hub');
  await settle();
  await contextSelect().selectOption(String(ANDES));
  expect(await rememberedContext()).toBe(String(ANDES));
});

// ---- Historia 7: Companies Directory -----------------------------------------------------

test('H7 · feature card Companies Directory opens the directory with the active companies', async () => {
  await featureCard('companies-directory').click();
  await expectPath('/platform-saas/companies/directory');
  await expect(heading()).toHaveText('COMPANIES DIRECTORY');
  await expectPoppins(heading());
  await expectCrumbs(['Platform SaaS', 'Companies Hub', 'Companies Directory']);
  // por defecto: compañías activas
  await expect(page.getByLabel('Status')).toHaveValue('active');
  await expectRows('company', [PLATFORM, ANDES, COASTAL]);
  await expect(page.getByTestId('companies-count')).toHaveText('3 companies');
  const andes = page.getByTestId(`company-row-${ANDES}`);
  await expect(andes).toContainText('Andes Bistro Group');
  await expect(andes).toContainText('Andes Bistro Group SpA');
  await expect(andes).toContainText('76.543.210-3');
  await expect(andes).toContainText('Santiago, Chile');
  await expect(andes).toContainText('Executive');
  await expect(andes).toContainText('4');
  await expect(andes).toContainText('Active');
  await expect(page.getByTestId(`company-row-${COASTAL}`)).toContainText('Professional');
  await expect(page.getByTestId(`company-row-${PLATFORM}`)).toContainText('No plan');
  await expectRedHover(andes, andes.locator('td').first().locator('p').first());
  await shot('directory-default-active');
});

test('H7 · status, tier and search filters update the grid in real time', async () => {
  const status = page.getByLabel('Status');
  const tier = page.getByLabel('Subscription tier');
  const search = page.getByLabel('Search companies');

  await status.selectOption('all');
  await expectRows('company', [PLATFORM, ANDES, COASTAL, NORDIC, OLD_TOWN]);
  await expect(page.getByTestId('companies-count')).toHaveText('5 companies');
  await shot('directory-status-all');

  await status.selectOption('suspended');
  await expectRows('company', [NORDIC]);
  await expect(page.getByTestId(`company-row-${NORDIC}`)).toContainText('Suspended');
  await shot('directory-status-suspended');

  await status.selectOption('inactive');
  await expectRows('company', [OLD_TOWN]);
  // su plan venció: no tiene plan vigente
  await expect(page.getByTestId(`company-row-${OLD_TOWN}`)).toContainText('No plan');
  await shot('directory-status-inactive');

  await status.selectOption('all');
  await expect(tier.locator('option')).toHaveText(['All subscription tiers', 'Essential', 'Executive', 'Professional']);
  await tier.selectOption({ label: 'Executive' });
  await expectRows('company', [ANDES]);
  await shot('directory-tier-executive');
  await tier.selectOption({ label: 'Essential' });
  await expectRows('company', [NORDIC]);
  await shot('directory-tier-essential');
  await tier.selectOption({ label: 'Professional' });
  await expectRows('company', [COASTAL]);
  await tier.selectOption('all');
  await expectRows('company', [PLATFORM, ANDES, COASTAL, NORDIC, OLD_TOWN]);

  await search.fill('coastal');
  await expectRows('company', [COASTAL]);
  await shot('directory-search-name');
  await search.fill('76.543');
  await expectRows('company', [ANDES]);
  await shot('directory-search-tax-id');
  await search.fill('oldtowndiner-e2e');
  await expectRows('company', [OLD_TOWN]);
  await search.fill('Aktiebolag');
  await expectRows('company', [NORDIC]);

  // combinados: texto + estado
  await search.fill('andes');
  await status.selectOption('suspended');
  await expectRows('company', []);
  await expect(page.getByText('No companies match your filters')).toBeVisible();
  await shot('directory-no-match');
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await expect(search).toHaveValue('');
  await expect(status).toHaveValue('all');
  await expect(tier).toHaveValue('all');
  await expectRows('company', [PLATFORM, ANDES, COASTAL, NORDIC, OLD_TOWN]);
  await shot('directory-clear-filters');
});

test('H7 · Back to Companies Hub and breadcrumb links work from the directory', async () => {
  await headerAction('Back to Companies Hub').click();
  await expectPath('/platform-saas/companies/hub');
  await shot('directory-back-to-hub');
  await navButton('Companies Directory').click();
  await expectPath('/platform-saas/companies/directory');
  // mismos destinos que el hub; los de company van a la company de contexto (Andes)
  await expectNavBar(
    'Back to Companies Hub',
    ['Companies Hub', 'Companies Directory', 'Company Profile', 'Company Configuration', 'Company Merchants'],
    'Companies Directory',
  );
  await shot('hub-nav-bar-companies-directory');
  await navButton('Back to Companies Hub').click();
  await expectPath('/platform-saas/companies/hub');
  await shot('directory-nav-bar-back-to-hub');
  await featureCard('companies-directory').click();
  await expectPath('/platform-saas/companies/directory');
  await navButton('Companies Hub').click();
  await expectPath('/platform-saas/companies/hub');
  await featureCard('companies-directory').click();
  await expectPath('/platform-saas/companies/directory');
  await clickCrumb('Companies Hub');
  await expectPath('/platform-saas/companies/hub');
  await featureCard('companies-directory').click();
  await expectPath('/platform-saas/companies/directory');
});

test('H7 · clicking a company row opens that company hub', async () => {
  await page.getByTestId(`company-row-${ANDES}`).click();
  await expectPath(`/platform-saas/companies/${ANDES}/hub`);
  await expect(heading()).toHaveText('ANDES BISTRO GROUP · COMPANY HUB');
  await expectCrumbs(['Platform SaaS', 'Companies Hub', 'Companies Directory', 'Andes Bistro Group', 'Company Hub']);
  // 4 sucursales (2 activas), 5 usuarios activos, 3 configuraciones
  await expectStat('total-merchants', 4);
  await expectStat('active-merchants', 2);
  await expectStat('active-users', 5);
  await expectStat('configurations', 3);
  await shot('directory-row-andes-company-hub');

  // la acción de fila "Open Hub" también navega
  await headerAction('Companies Directory').click();
  await expectPath('/platform-saas/companies/directory');
  await page.getByLabel('Status').selectOption('all');
  await page.getByRole('button', { name: 'Open Nordic Grill AB hub' }).click();
  await expectPath(`/platform-saas/companies/${NORDIC}/hub`);
  await expect(heading()).toHaveText('NORDIC GRILL AB · COMPANY HUB');
  await expectStat('total-merchants', 1);
  await shot('directory-open-hub-button-nordic');
});

test('H1/H7 · company hub buttons, bottom bar and breadcrumbs of Andes Bistro Group', async () => {
  await page.goto(`/platform-saas/companies/${ANDES}/hub`);
  await settle();
  for (const [card, path, title] of [
    ['company-profile', `/platform-saas/companies/${ANDES}/profile`, 'COMPANY PROFILE'],
    ['company-configuration', `/platform-saas/companies/${ANDES}/configuration`, 'COMPANY CONFIGURATION'],
    ['company-merchants', `/platform-saas/companies/${ANDES}/merchants`, 'COMPANY MERCHANTS DIRECTORY'],
  ] as const) {
    await featureCard(card).click();
    await expectPath(path);
    await expect(heading()).toHaveText(title);
    await shot(`company-hub-card-${card}`);
    await headerAction('Back to Company Hub').click();
    await expectPath(`/platform-saas/companies/${ANDES}/hub`);
  }
  const companyItems = ['Company Hub', 'Company Profile', 'Company Configuration', 'Company Merchants'];
  await expectNavBar('Back to Companies Directory', companyItems, 'Company Hub');
  for (const [label, path] of [
    ['Company Profile', `/platform-saas/companies/${ANDES}/profile`],
    ['Company Configuration', `/platform-saas/companies/${ANDES}/configuration`],
    ['Company Merchants', `/platform-saas/companies/${ANDES}/merchants`],
  ] as const) {
    await navButton(label).click();
    await expectPath(path);
    // en cada vista de la company la barra marca la actual y vuelve al Company Hub
    await expectNavBar('Back to Company Hub', companyItems, label);
    await shot(`company-hub-nav-bar-${label.toLowerCase().replace(/ /g, '-')}`);
    await navButton('Company Hub').click();
    await expectPath(`/platform-saas/companies/${ANDES}/hub`);
    await navButton(label).click();
    await expectPath(path);
    await navButton('Back to Company Hub').click();
    await expectPath(`/platform-saas/companies/${ANDES}/hub`);
  }
  await navButton('Back to Companies Directory').click();
  await expectPath('/platform-saas/companies/directory');
  await shot('company-hub-nav-bar-back-to-directory');
  await page.goto('/platform-saas/companies/hub');
  await settle();
});

test('H1 · with Andes as company context, every hub card and bottom bar button targets Andes', async () => {
  for (const [label, path] of [
    ['Company Profile', `/platform-saas/companies/${ANDES}/profile`],
    ['Company Configuration', `/platform-saas/companies/${ANDES}/configuration`],
    ['Company Merchants', `/platform-saas/companies/${ANDES}/merchants`],
  ] as const) {
    await page.goto('/platform-saas/companies/hub');
    await settle();
    await expect(contextSelect()).toHaveValue(String(ANDES));
    await expect(featureCard('company-profile')).toContainText('Opens Andes Bistro Group.');
    await navButton(label).click();
    await expectPath(path);
    await shot(`hub-nav-bar-${label.toLowerCase().replace(/ /g, '-')}`);
  }
  await page.goto('/platform-saas/companies/hub');
  await settle();
  await featureCard('company-profile').click();
  await expectPath(`/platform-saas/companies/${ANDES}/profile`);
  await shot('hub-card-company-profile-andes');
  await clickCrumb('Companies Hub');
  await featureCard('company-configuration').click();
  await expectPath(`/platform-saas/companies/${ANDES}/configuration`);
  await shot('hub-card-company-configuration-andes');
});

// ---- Company Configuration ---------------------------------------------------------------

test('H1 · company configuration lists the tenant configuration records by type', async () => {
  await expect(heading()).toHaveText('COMPANY CONFIGURATION');
  await expectCrumbs(['Platform SaaS', 'Companies Hub', 'Companies Directory', 'Andes Bistro Group', 'Company Configuration']);
  const main = page.locator('main');
  for (const label of ['Tax Rules', 'Tip Rules', 'Payroll Rules']) {
    await expect(main.getByText(label, { exact: true }).first()).toBeVisible();
  }
  await expect(main.getByText('Andes Santiago Centro').first()).toBeVisible();
  await expect(main.getByText('Andes Providencia').first()).toBeVisible();
  await expect(main).not.toContainText('Coastal Miami Beach');
  await shot('company-configuration-andes');
  for (const label of ['Companies Directory', 'Companies Hub']) {
    await page.goto(`/platform-saas/companies/${ANDES}/configuration`);
    await settle();
    await clickCrumb(label);
    await expectPath(label === 'Companies Hub' ? '/platform-saas/companies/hub' : '/platform-saas/companies/directory');
  }
});

// ---- Historia 6: Company Profile ---------------------------------------------------------

test('H6 · profile data loading: the form is hydrated with the company attributes', async () => {
  await page.goto(`/platform-saas/companies/${ANDES}/profile`);
  await settle();
  await expect(heading()).toHaveText('COMPANY PROFILE');
  await expectPoppins(heading());
  await expectCrumbs(['Platform SaaS', 'Companies Hub', 'Companies Directory', 'Andes Bistro Group', 'Company Profile']);
  const expected: Record<string, string> = {
    legalName: 'Andes Bistro Group SpA',
    commercialName: 'Andes Bistro Group',
    taxId: '76.543.210-3',
    email: 'finance@andesbistro-e2e.com',
    phone: '+56 2 2345 6789',
    address: 'Av Providencia 1234',
    city: 'Santiago',
    state: 'Metropolitan Region',
    country: 'Chile',
    baseCurrency: 'CLP',
    status: 'active',
  };
  for (const [field, value] of Object.entries(expected)) await expect(companyField(field)).toHaveValue(value);
  await expectStat('merchant-branches', 2);
  await expect(page.getByRole('button', { name: 'Discard Changes' })).toBeDisabled();
  await shot('company-profile-hydrated');
});

test('H6 · validation: mandatory fields and tax ID format are checked before any PATCH', async () => {
  let patches = 0;
  const count = (req: { method(): string; url(): string }) => {
    if (req.method() === 'PATCH' && req.url().includes('/v1/saas/companies/')) patches += 1;
  };
  page.on('request', count);

  await companyField('taxId').fill('ABC-XYZ');
  await expect(page.locator('#company-taxId-error')).toHaveText(/Enter a valid tax ID/);
  await expect(companyField('taxId')).toHaveAttribute('aria-invalid', 'true');
  await shot('company-profile-invalid-tax-id');

  await companyField('taxId').fill('12.345.678-K!');
  await expect(page.locator('#company-taxId-error')).toHaveText(/Enter a valid tax ID/);
  await companyField('legalName').fill('');
  await expect(page.locator('#company-legalName-error')).toHaveText('Legal name is required.');
  await companyField('city').fill('  ');
  await expect(page.locator('#company-city-error')).toHaveText('City is required.');
  await companyField('email').fill('not-an-email');
  await expect(page.locator('#company-email-error')).toHaveText('Enter a valid business email address.');
  await shot('company-profile-required-fields');

  await page.getByRole('button', { name: 'Save Changes' }).click();
  await expect(page.getByRole('alert')).toHaveText('Please fix the highlighted fields before saving.');
  await shot('company-profile-save-blocked');
  expect(patches, 'no PATCH while the form is invalid').toBe(0);

  await page.getByRole('button', { name: 'Discard Changes' }).click();
  await expect(companyField('taxId')).toHaveValue('76.543.210-3');
  await expect(companyField('legalName')).toHaveValue('Andes Bistro Group SpA');
  await expect(page.locator('[id^="company-"][id$="-error"]')).toHaveCount(0);
  await expect(page.getByRole('alert')).toHaveCount(0);
  await shot('company-profile-discard-changes');
  page.off('request', count);
  expect(patches).toBe(0);
});

test('H6 · persistence: PATCH with only the changed fields, success feedback, value kept after reload', async () => {
  await companyField('legalName').fill('Andes Bistro Group S.p.A.');
  await companyField('taxId').fill('76.543.210-K');
  await companyField('phone').fill('+56 2 2999 0000');
  // la lista ISO 4217 completa, ordenada y con nombres; JPY no estaba entre las 12 de antes
  const currencyCodes = await companyField('baseCurrency').locator('option').evaluateAll((els) => els.map((el) => (el as HTMLOptionElement).value));
  expect(currencyCodes.length).toBeGreaterThanOrEqual(170);
  expect(currencyCodes).toEqual([...currencyCodes].sort());
  await expect(companyField('baseCurrency').locator('option[value="JPY"]')).toHaveText('JPY — Japanese Yen');
  await expect(companyField('baseCurrency').locator('option[value="CHF"]')).toHaveText('CHF — Swiss Franc');
  await companyField('baseCurrency').selectOption({ label: 'JPY — Japanese Yen' });
  await shot('company-profile-valid-edit');
  const [request, response] = await Promise.all([
    page.waitForRequest((r) => r.method() === 'PATCH' && r.url().endsWith(`/v1/saas/companies/${ANDES}/profile`)),
    page.waitForResponse((r) => r.request().method() === 'PATCH' && r.url().endsWith(`/v1/saas/companies/${ANDES}/profile`)),
    page.getByRole('button', { name: 'Save Changes' }).click(),
  ]);
  expect(request.postDataJSON()).toEqual({
    legalName: 'Andes Bistro Group S.p.A.',
    taxId: '76.543.210-K',
    phone: '+56 2 2999 0000',
    baseCurrency: 'JPY',
  });
  expect(response.status()).toBe(200);
  await expect(page.getByRole('status').filter({ hasText: 'Company profile updated successfully.' })).toBeVisible();
  await shot('company-profile-saved-success');

  await page.reload();
  await settle();
  await expect(companyField('legalName')).toHaveValue('Andes Bistro Group S.p.A.');
  await expect(companyField('taxId')).toHaveValue('76.543.210-K');
  await expect(companyField('phone')).toHaveValue('+56 2 2999 0000');
  await expect(companyField('baseCurrency')).toHaveValue('JPY');
  await shot('company-profile-persisted-after-reload');
  // también lo devuelve la API (persistido en la base, no solo en el formulario)
  const token = await page.evaluate(() => localStorage.getItem('x7_access_token') ?? sessionStorage.getItem('x7_access_token'));
  const apiProfile = await page.request.get(`${API}/v1/saas/companies/${ANDES}/profile`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const persisted = {
    status: apiProfile.status(),
    currency: ((await apiProfile.json()) as { data?: { baseCurrency?: string } }).data?.baseCurrency,
  };
  expect(persisted).toEqual({ status: 200, currency: 'JPY' });

  // CHF también se guarda
  await companyField('baseCurrency').selectOption('CHF');
  const [chf] = await Promise.all([
    page.waitForResponse((r) => r.request().method() === 'PATCH' && r.url().endsWith(`/v1/saas/companies/${ANDES}/profile`)),
    page.getByRole('button', { name: 'Save Changes' }).click(),
  ]);
  expect(chf.status()).toBe(200);
  expect(chf.request().postDataJSON()).toEqual({ baseCurrency: 'CHF' });
  await expect(page.getByRole('status').filter({ hasText: 'Company profile updated successfully.' })).toBeVisible();
  await page.reload();
  await settle();
  await expect(companyField('baseCurrency')).toHaveValue('CHF');
  await shot('company-profile-chf-persisted');

  // vuelve a CLP para que el resto de la suite vea los datos del seed
  await companyField('baseCurrency').selectOption('CLP');
  await Promise.all([
    page.waitForResponse((r) => r.request().method() === 'PATCH' && r.status() === 200),
    page.getByRole('button', { name: 'Save Changes' }).click(),
  ]);
  await expect(page.getByRole('status').filter({ hasText: 'Company profile updated successfully.' })).toBeVisible();

  // las migas siguen al nombre comercial
  await clickCrumb('Companies Directory');
  await expectPath('/platform-saas/companies/directory');
  await expect(page.getByTestId(`company-row-${ANDES}`)).toContainText('Andes Bistro Group S.p.A.');
  await shot('directory-shows-updated-legal-name');
});

// ---- Historia 4: Company Merchants Directory ---------------------------------------------

test('H4 · directory hydration: only the merchant branches of the parent company', async () => {
  await page.goto(`/platform-saas/companies/${ANDES}/merchants`);
  await settle();
  await expect(heading()).toHaveText('COMPANY MERCHANTS DIRECTORY');
  await expectPoppins(heading());
  await expectCrumbs(['Platform SaaS', 'Companies Hub', 'Companies Directory', 'Andes Bistro Group', 'Merchants']);
  await expectRows('merchant', [CENTRO, PROVIDENCIA, VALPARAISO, CONCEPCION]);
  await expect(page.getByTestId('merchants-count')).toHaveText('4 of 4 branches');
  await expect(page.getByTestId(`merchant-row-${MIAMI}`)).toHaveCount(0);
  const centro = page.getByTestId(`merchant-row-${CENTRO}`);
  await expect(centro).toContainText('Andes Santiago Centro');
  await expect(centro).toContainText('MCH-0002');
  await expect(centro).toContainText('Santiago, Metropolitan Region, Chile');
  await expect(centro).toContainText('America/Santiago');
  await expect(centro).toContainText('Active');
  await expect(page.getByTestId(`merchant-row-${CONCEPCION}`)).toContainText('Suspended');
  await expect(page.getByTestId(`merchant-row-${VALPARAISO}`)).toContainText('Inactive');
  await expectRedHover(centro, centro.locator('td').first().locator('p').first());
  await shot('merchants-directory-andes');
});

test('H4 · search and filter controls by city, status and branch name', async () => {
  const city = page.getByLabel('City');
  const status = page.getByLabel('Status');
  const search = page.getByLabel('Search merchants');
  await expect(city.locator('option')).toHaveText(['All cities', 'Concepcion', 'Santiago', 'Valparaiso']);

  await city.selectOption('Santiago');
  await expectRows('merchant', [CENTRO, PROVIDENCIA]);
  await expect(page.getByTestId('merchants-count')).toHaveText('2 of 2 branches');
  await shot('merchants-filter-city-santiago');
  await city.selectOption('Valparaiso');
  await expectRows('merchant', [VALPARAISO]);
  await shot('merchants-filter-city-valparaiso');
  await city.selectOption('all');

  await status.selectOption('inactive');
  await expectRows('merchant', [VALPARAISO]);
  await shot('merchants-filter-status-inactive');
  await status.selectOption('suspended');
  await expectRows('merchant', [CONCEPCION]);
  await status.selectOption('active');
  await expectRows('merchant', [CENTRO, PROVIDENCIA]);
  await shot('merchants-filter-status-active');
  await status.selectOption('all');

  await search.fill('provi');
  await expectRows('merchant', [PROVIDENCIA]);
  await shot('merchants-search-branch-name');
  await search.fill('MCH-0004');
  await expectRows('merchant', [VALPARAISO]);
  await shot('merchants-search-branch-code');

  await search.fill('centro');
  await city.selectOption('Concepcion');
  await expectRows('merchant', []);
  await expect(page.getByText('No merchants match your filters')).toBeVisible();
  await shot('merchants-no-match');
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await expectRows('merchant', [CENTRO, PROVIDENCIA, VALPARAISO, CONCEPCION]);
  await shot('merchants-clear-filters');
});

test('H4 · Back button and breadcrumbs of the merchants directory', async () => {
  await headerAction('Back to Company Hub').click();
  await expectPath(`/platform-saas/companies/${ANDES}/hub`);
  for (const [label, path] of [
    ['Andes Bistro Group', `/platform-saas/companies/${ANDES}/hub`],
    ['Companies Directory', '/platform-saas/companies/directory'],
    ['Companies Hub', '/platform-saas/companies/hub'],
  ] as const) {
    await page.goto(`/platform-saas/companies/${ANDES}/merchants`);
    await settle();
    await clickCrumb(label);
    await expectPath(path);
  }
  await shot('merchants-breadcrumbs-done');
});

test('H4 · clicking a merchant entry redirects to its Merchant Hub', async () => {
  await page.goto(`/platform-saas/companies/${ANDES}/merchants`);
  await settle();
  await page.getByTestId(`merchant-row-${CENTRO}`).click();
  await expectPath(`/platform-saas/companies/${ANDES}/merchants/${CENTRO}/hub`);
  await shot('merchants-row-centro-merchant-hub');
  await headerAction('Company Merchants').click();
  await expectPath(`/platform-saas/companies/${ANDES}/merchants`);
  await page.getByRole('button', { name: 'Open Andes Providencia hub' }).click();
  await expectPath(`/platform-saas/companies/${ANDES}/merchants/${PROVIDENCIA}/hub`);
  await expect(heading()).toHaveText('ANDES PROVIDENCIA · MERCHANT HUB');
  // 1 terminal inactiva, sin cobros, 1 de 2 usuarios activos
  await expectStat('active-pos-terminals', 0, '1 terminals registered');
  await expectStat('local-transactions', 0, 'Today · 0 in total');
  await expectStat('active-users', 1, '2 user accounts');
  await shot('merchants-open-hub-providencia');
});

// ---- Historia 5: Merchant Hub ------------------------------------------------------------

test('H5 · merchant hub: header, breadcrumbs and operational KPIs equal the seed', async () => {
  await page.goto(`/platform-saas/companies/${ANDES}/merchants/${CENTRO}/hub`);
  await settle();
  await expect(heading()).toHaveText('ANDES SANTIAGO CENTRO · MERCHANT HUB');
  await expectPoppins(heading());
  await expect(page.locator('main header p').first()).toHaveText('MCH-0002 · Santiago · Active · Andes Bistro Group');
  await expectCrumbs([
    'Platform SaaS', 'Companies Hub', 'Companies Directory', 'Andes Bistro Group', 'Merchants', 'Andes Santiago Centro', 'Merchant Hub',
  ]);
  // 2 terminales activas de 3; 3 cobros hoy de 5 (el reembolso no cuenta); 3 usuarios activos de 4
  await expectStat('active-pos-terminals', 2, '3 terminals registered');
  await expectStat('local-transactions', 3, 'Today · 5 in total');
  await expectStat('active-users', 3, '4 user accounts');
  await expectSymbol(page.locator('main header .material-symbols-outlined').filter({ hasText: /^storefront$/ }).first(), 'storefront');
  await expectSymbol(featureCard('merchant-profile').locator('.material-symbols-outlined').first(), 'storefront');
  await expectSymbol(featureCard('merchant-users').locator('.material-symbols-outlined').first(), 'group');
  // so that I can access its profile, users, and terminal directories
  await expect(featureCard('merchant-terminals').locator('h3')).toHaveText('POS Terminals');
  await expectSymbol(featureCard('merchant-terminals').locator('.material-symbols-outlined').first(), 'point_of_sale');
  for (const card of ['merchant-profile', 'merchant-users', 'merchant-terminals']) {
    await expectPoppins(featureCard(card).locator('h3'));
    await expect(featureCard(card).locator('h3')).toHaveClass(/hover:text-primary transition-colors duration-200/);
    await expectRedHover(featureCard(card).locator('h3'));
  }
  await shot('merchant-hub-centro');
});

test('H5 · feature cards link to the Merchant Profile and the Merchant User Directory', async () => {
  await featureCard('merchant-profile').click();
  await expectPath(`/platform-saas/companies/${ANDES}/merchants/${CENTRO}/profile`);
  await expect(heading()).toHaveText('MERCHANT PROFILE');
  await shot('merchant-hub-card-profile');
  await headerAction('Back to Merchant Hub').click();
  await expectPath(`/platform-saas/companies/${ANDES}/merchants/${CENTRO}/hub`);

  await featureCard('merchant-users').click();
  await expectPath(`/platform-saas/merchants/${CENTRO}/users`);
  await expect(heading()).toHaveText('MERCHANT USER DIRECTORY');
  await shot('merchant-hub-card-users');
  await headerAction('Back to Merchant Hub').click();
  await expectPath(`/platform-saas/companies/${ANDES}/merchants/${CENTRO}/hub`);

  await featureCard('merchant-terminals').click();
  await expectPath(`/platform-saas/companies/${ANDES}/merchants/${CENTRO}/terminals`);
  await expect(heading()).toHaveText('POS TERMINALS DIRECTORY');
  await shot('merchant-hub-card-terminals');
  await headerAction('Back to Merchant Hub').click();
  await expectPath(`/platform-saas/companies/${ANDES}/merchants/${CENTRO}/hub`);
});

const MERCHANT_ITEMS = ['Merchant Hub', 'Merchant Profile', 'Users', 'POS Terminals'];

test('H5 · bottom bar buttons, Back button and breadcrumbs of the merchant hub', async () => {
  const hub = `/platform-saas/companies/${ANDES}/merchants/${CENTRO}/hub`;
  await page.goto(hub);
  await settle();
  await expectNavBar('Back to Company Merchants', MERCHANT_ITEMS, 'Merchant Hub');
  for (const [label, path, back] of [
    ['Merchant Profile', `/platform-saas/companies/${ANDES}/merchants/${CENTRO}/profile`, 'Back to Merchant Hub'],
    ['Users', `/platform-saas/merchants/${CENTRO}/users`, 'Back to Merchant Hub'],
    ['POS Terminals', `/platform-saas/companies/${ANDES}/merchants/${CENTRO}/terminals`, 'Back to Merchant Hub'],
  ] as const) {
    await page.goto(hub);
    await settle();
    await navButton(label).click();
    await expectPath(path);
    await expectNavBar(back, MERCHANT_ITEMS, label);
    await shot(`merchant-hub-nav-bar-${label.toLowerCase().replace(/ /g, '-')}`);
    // la flecha atrás vuelve al hub y el botón Merchant Hub también
    await navButton(back).click();
    await expectPath(hub);
    await navButton(label).click();
    await expectPath(path);
    await navButton('Merchant Hub').click();
    await expectPath(hub);
  }
  await navButton('Back to Company Merchants').click();
  await expectPath(`/platform-saas/companies/${ANDES}/merchants`);
  await expectNavBar('Back to Company Hub', ['Company Hub', 'Company Profile', 'Company Configuration', 'Company Merchants'], 'Company Merchants');
  await shot('merchant-hub-nav-bar-back-company-merchants');
  for (const [label, path] of [
    ['Merchants', `/platform-saas/companies/${ANDES}/merchants`],
    ['Andes Bistro Group', `/platform-saas/companies/${ANDES}/hub`],
    ['Companies Directory', '/platform-saas/companies/directory'],
    ['Companies Hub', '/platform-saas/companies/hub'],
  ] as const) {
    await page.goto(`/platform-saas/companies/${ANDES}/merchants/${CENTRO}/hub`);
    await settle();
    await clickCrumb(label);
    await expectPath(path);
  }
  await page.goto(`/platform-saas/companies/${ANDES}/merchants/${CENTRO}/hub`);
  await settle();
  await headerAction('Company Merchants').click();
  await expectPath(`/platform-saas/companies/${ANDES}/merchants`);
  await shot('merchant-hub-back-company-merchants');
});

test('H5 · a branch with a legacy (non IANA) time zone still loads its KPIs', async () => {
  await page.goto(`/platform-saas/companies/${ANDES}/merchants/${CONCEPCION}/hub`);
  await settle();
  await expect(heading()).toHaveText('ANDES CONCEPCION SUR · MERCHANT HUB');
  await expectStat('local-transactions', 1, 'Today · 1 in total');
  await expectStat('active-users', 0, '0 user accounts');
  await shot('merchant-hub-legacy-timezone');
});

// ---- Historia 5: Merchant Terminals Directory ("access its ... terminal directories") ---------

// Terminales de seed.sql: 1-3 de Andes Santiago Centro (1 y 2 activas, 3 inactiva), 4 de Providencia
const terminalRow = (id: number) => page.getByTestId(`terminal-row-${id}`);

test('H5 · terminals directory: the seeded terminals of the branch, filters and breadcrumbs', async () => {
  const [response] = await Promise.all([
    page.waitForResponse((r) => r.request().method() === 'GET' && new URL(r.url()).pathname.endsWith(`/v1/saas/merchants/${CENTRO}/terminals`)),
    page.goto(`/platform-saas/companies/${ANDES}/merchants/${CENTRO}/terminals`),
  ]);
  expect(response.status()).toBe(200);
  const body = (await response.json()) as { data: Array<{ id: number; merchantId: number }>; meta: { total: number; active: number } };
  expect(body.data.map((t) => t.id).sort()).toEqual([1, 2, 3]);
  expect(body.meta).toEqual({ total: 3, active: 2 });
  expect(JSON.stringify(body)).not.toMatch(/credentials/);
  await settle();
  await expect(heading()).toHaveText('POS TERMINALS DIRECTORY');
  await expectPoppins(heading());
  await expectSymbol(page.locator('main header .material-symbols-outlined').filter({ hasText: /^point_of_sale$/ }).first(), 'point_of_sale');
  await expectCrumbs([
    'Platform SaaS', 'Companies Hub', 'Companies Directory', 'Andes Bistro Group', 'Merchants', 'Andes Santiago Centro', 'POS Terminals',
  ]);
  // las filas = las terminales sembradas de la sucursal (no la de Providencia)
  await expectRows('terminal', [1, 2, 3]);
  await expect(page.getByTestId('terminals-count')).toHaveText('2 active · 3 total');
  await expect(page.locator('main')).not.toContainText('Providencia Reader');
  const front = terminalRow(1);
  for (const text of ['Front Counter', 'C032UQ03960001', 'CardPointe', 'Bolt Clover Flex', 'Active']) {
    await expect(front).toContainText(text);
  }
  await expect(terminalRow(3)).toContainText('Patio (retired)');
  await expect(terminalRow(3)).toContainText('Inactive');
  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  await expect(front).toContainText(today);
  await expectRedHover(front, front.locator('td').first().locator('p').first());
  await shot('terminals-directory-centro');

  const status = page.getByLabel('Status');
  const search = page.getByLabel('Search terminals');
  await expect(status.locator('option')).toHaveText(['All statuses', 'Active', 'Inactive']);
  await status.selectOption('active');
  await expectRows('terminal', [1, 2]);
  await shot('terminals-filter-status-active');
  await status.selectOption('inactive');
  await expectRows('terminal', [3]);
  await shot('terminals-filter-status-inactive');
  await status.selectOption('all');
  await search.fill('bar');
  await expectRows('terminal', [2]);
  await shot('terminals-search-name');
  await search.fill('C032UQ03960003');
  await expectRows('terminal', [3]);
  await shot('terminals-search-device-id');
  await search.fill('clover mini');
  await expectRows('terminal', [2]);
  await search.fill('front');
  await status.selectOption('inactive');
  await expectRows('terminal', []);
  await expect(page.getByText('No terminals match your filters')).toBeVisible();
  await shot('terminals-no-match');
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await expect(search).toHaveValue('');
  await expect(status).toHaveValue('all');
  await expectRows('terminal', [1, 2, 3]);
  await shot('terminals-clear-filters');

  await headerAction('Back to Merchant Hub').click();
  await expectPath(`/platform-saas/companies/${ANDES}/merchants/${CENTRO}/hub`);
  for (const [label, path] of [
    ['Andes Santiago Centro', `/platform-saas/companies/${ANDES}/merchants/${CENTRO}/hub`],
    ['Merchants', `/platform-saas/companies/${ANDES}/merchants`],
    ['Andes Bistro Group', `/platform-saas/companies/${ANDES}/hub`],
    ['Companies Directory', '/platform-saas/companies/directory'],
    ['Companies Hub', '/platform-saas/companies/hub'],
  ] as const) {
    await page.goto(`/platform-saas/companies/${ANDES}/merchants/${CENTRO}/terminals`);
    await settle();
    await clickCrumb(label);
    await expectPath(path);
  }
  await shot('terminals-breadcrumbs-done');
});

test('H5 · terminals directory of other branches: Providencia and an empty one', async () => {
  await page.goto(`/platform-saas/companies/${ANDES}/merchants/${PROVIDENCIA}/hub`);
  await settle();
  await featureCard('merchant-terminals').click();
  await expectPath(`/platform-saas/companies/${ANDES}/merchants/${PROVIDENCIA}/terminals`);
  await expectRows('terminal', [4]);
  await expect(terminalRow(4)).toContainText('Providencia Reader');
  await expect(terminalRow(4)).toContainText('Stripe');
  await expect(terminalRow(4)).toContainText('tmr_ProvidenciaReader');
  await expect(page.getByTestId('terminals-count')).toHaveText('0 active · 1 total');
  await shot('terminals-directory-providencia');

  await page.goto(`/platform-saas/companies/${ANDES}/merchants/${VALPARAISO}/terminals`);
  await settle();
  await expectRows('terminal', []);
  await expect(page.getByText('No terminals registered for this branch')).toBeVisible();
  await expect(page.getByTestId('terminals-count')).toHaveText('0 active · 0 total');
  await shot('terminals-directory-empty-valparaiso');
});

// ---- Historia 3: Merchant Profile --------------------------------------------------------

const merchantField = (field: string) => page.locator(`#merchant-${field}`);

test('H3 · profile hydration: branch metadata loads into the form fields', async () => {
  await page.goto(`/platform-saas/companies/${ANDES}/merchants/${CENTRO}/profile`);
  await settle();
  await expect(heading()).toHaveText('MERCHANT PROFILE');
  await expectPoppins(heading());
  await expectCrumbs([
    'Platform SaaS', 'Companies Hub', 'Companies Directory', 'Andes Bistro Group', 'Merchants', 'Andes Santiago Centro', 'Merchant Profile',
  ]);
  const expected: Record<string, string> = {
    name: 'Andes Santiago Centro',
    status: 'active',
    timezone: 'America/Santiago',
    phone: '+56 2 2111 2222',
    email: 'centro@andesbistro-e2e.com',
    address: 'Huerfanos 1055',
    city: 'Santiago',
    state: 'Metropolitan Region',
    country: 'Chile',
  };
  for (const [field, value] of Object.entries(expected)) await expect(merchantField(field)).toHaveValue(value);
  await expect(page.locator('main')).toContainText('Branch code MCH-0002');
  await expect(page.locator('main')).toContainText('Company Andes Bistro Group');
  await shot('merchant-profile-hydrated');
});

test('H3 · validation: required fields and contact formats block the save', async () => {
  let patches = 0;
  const count = (req: { method(): string }) => {
    if (req.method() === 'PATCH') patches += 1;
  };
  page.on('request', count);
  await merchantField('name').fill('');
  await expect(page.locator('#merchant-name-error')).toHaveText('Branch name is required.');
  await merchantField('phone').fill('12ab');
  await expect(page.locator('#merchant-phone-error')).toHaveText('Enter a valid contact number (7-20 digits).');
  await merchantField('email').fill('centro@');
  await expect(page.locator('#merchant-email-error')).toHaveText('Enter a valid email address.');
  await merchantField('address').fill('');
  await expect(page.locator('#merchant-address-error')).toHaveText('Physical address is required.');
  await page.getByRole('button', { name: 'Save Changes' }).click();
  await expect(page.getByRole('alert')).toHaveText('Please fix the highlighted fields before saving.');
  await shot('merchant-profile-validation-errors');
  await page.getByRole('button', { name: 'Discard Changes' }).click();
  await expect(merchantField('name')).toHaveValue('Andes Santiago Centro');
  await expect(page.locator('[id^="merchant-"][id$="-error"]')).toHaveCount(0);
  await shot('merchant-profile-discard-changes');
  page.off('request', count);
  expect(patches, 'no PATCH while the form is invalid').toBe(0);
});

test('H3 · a duplicate branch name inside the company is rejected by the API (409) and shown', async () => {
  await merchantField('name').fill('Andes Providencia');
  expectFailure(409, `/v1/saas/merchants/${CENTRO}`);
  const [response] = await Promise.all([
    page.waitForResponse((r) => r.request().method() === 'PATCH' && r.url().endsWith(`/v1/saas/merchants/${CENTRO}`)),
    page.getByRole('button', { name: 'Save Changes' }).click(),
  ]);
  expect(response.status()).toBe(409);
  await expect(page.locator('#merchant-name-error')).toContainText(/already exists/i);
  await expect(page.getByRole('alert')).toContainText(/already exists/i);
  await shot('merchant-profile-duplicate-name-409');
  settleExpectedFailures();
  await page.getByRole('button', { name: 'Discard Changes' }).click();
  await expect(merchantField('name')).toHaveValue('Andes Santiago Centro');
});

test('H3 · valid changes are saved with PATCH and persist after reload', async () => {
  await merchantField('phone').fill('+56 2 2111 9999');
  await merchantField('address').fill('Huerfanos 1060, Local 2');
  await merchantField('timezone').selectOption('America/Punta_Arenas');
  await shot('merchant-profile-valid-edit');
  const [request, response] = await Promise.all([
    page.waitForRequest((r) => r.method() === 'PATCH' && r.url().endsWith(`/v1/saas/merchants/${CENTRO}`)),
    page.waitForResponse((r) => r.request().method() === 'PATCH' && r.url().endsWith(`/v1/saas/merchants/${CENTRO}`)),
    page.getByRole('button', { name: 'Save Changes' }).click(),
  ]);
  expect(request.postDataJSON()).toEqual({
    phone: '+56 2 2111 9999',
    address: 'Huerfanos 1060, Local 2',
    timezone: 'America/Punta_Arenas',
  });
  expect(response.status()).toBe(200);
  await expect(page.getByRole('status').filter({ hasText: 'Merchant profile updated successfully.' })).toBeVisible();
  await shot('merchant-profile-saved-success');
  await page.reload();
  await settle();
  await expect(merchantField('phone')).toHaveValue('+56 2 2111 9999');
  await expect(merchantField('address')).toHaveValue('Huerfanos 1060, Local 2');
  await expect(merchantField('timezone')).toHaveValue('America/Punta_Arenas');
  await shot('merchant-profile-persisted-after-reload');
  for (const [label, path] of [
    ['Andes Santiago Centro', `/platform-saas/companies/${ANDES}/merchants/${CENTRO}/hub`],
    ['Merchants', `/platform-saas/companies/${ANDES}/merchants`],
    ['Andes Bistro Group', `/platform-saas/companies/${ANDES}/hub`],
    ['Companies Directory', '/platform-saas/companies/directory'],
    ['Companies Hub', '/platform-saas/companies/hub'],
  ] as const) {
    await page.goto(`/platform-saas/companies/${ANDES}/merchants/${CENTRO}/profile`);
    await settle();
    await clickCrumb(label);
    await expectPath(path);
  }
});

test('H3 · a legacy invalid time zone is flagged and must be replaced by a valid IANA zone', async () => {
  await page.goto(`/platform-saas/companies/${ANDES}/merchants/${CONCEPCION}/profile`);
  await settle();
  await expect(merchantField('timezone')).toHaveValue('America/Atlantis');
  await expect(merchantField('status')).toHaveValue('suspended');
  await merchantField('phone').fill('+56 41 222 3355');
  await page.getByRole('button', { name: 'Save Changes' }).click();
  await expect(page.locator('#merchant-timezone-error')).toHaveText('Select a valid IANA timezone (e.g. America/New_York).');
  await expect(page.getByRole('alert')).toHaveText('Please fix the highlighted fields before saving.');
  await shot('merchant-profile-invalid-timezone');
  await merchantField('timezone').selectOption('America/Santiago');
  await expect(page.locator('#merchant-timezone-error')).toHaveCount(0);
  await merchantField('status').selectOption('active');
  const [response] = await Promise.all([
    page.waitForResponse((r) => r.request().method() === 'PATCH' && r.url().endsWith(`/v1/saas/merchants/${CONCEPCION}`)),
    page.getByRole('button', { name: 'Save Changes' }).click(),
  ]);
  expect(response.status()).toBe(200);
  await expect(page.getByRole('status').filter({ hasText: 'Merchant profile updated successfully.' })).toBeVisible();
  await page.reload();
  await settle();
  await expect(merchantField('timezone')).toHaveValue('America/Santiago');
  await expect(merchantField('status')).toHaveValue('active');
  await shot('merchant-profile-timezone-fixed');
  // la ficha refleja el nuevo estado en el directorio
  await clickCrumb('Merchants');
  await expect(page.getByTestId(`merchant-row-${CONCEPCION}`)).toContainText('Active');
  await shot('merchants-directory-after-merchant-edit');
});

// ---- Historia 2: Merchant User Directory -------------------------------------------------

test('H2 · directory rendering: the active users of the selected merchant branch', async () => {
  await page.goto(`/platform-saas/merchants/${CENTRO}/users`);
  await settle();
  await expect(heading()).toHaveText('MERCHANT USER DIRECTORY');
  await expectPoppins(heading());
  await expectCrumbs([
    'Platform SaaS', 'Companies Hub', 'Companies Directory', 'Andes Bistro Group', 'Merchants', 'Andes Santiago Centro', 'Users',
  ]);
  await expect(page.getByLabel('Status')).toHaveValue('active');
  await expectRows('user', [2, 3, 4]);
  await expect(page.getByTestId('users-count')).toHaveText('3 active · 4 total');
  const sofia = page.getByTestId(`user-row-${SOFIA}`);
  await expect(sofia).toContainText('sofia_cashier');
  await expect(sofia).toContainText('sofia@andesbistro-e2e.com');
  await expect(sofia).toContainText('Merchant User');
  await expect(sofia).toContainText('Active');
  await expect(page.getByTestId('user-row-2')).toContainText('Merchant Admin');
  // ni el inactivo ni usuarios de otra sucursal
  await expect(page.getByTestId('user-row-5')).toHaveCount(0);
  await expect(page.locator('main')).not.toContainText('lead@andesbistro-e2e.com');
  await expect(page.locator('main')).not.toContainText('password');
  await expectRedHover(sofia, sofia.locator('td').first().locator('p').first());
  await shot('users-directory-active');
});

test('H2 · status filter and search over the branch users', async () => {
  await page.getByLabel('Status').selectOption('all');
  await expectRows('user', [2, 3, 4, 5]);
  await expect(page.getByTestId('user-row-5')).toContainText('Inactive');
  await shot('users-directory-all-statuses');
  await page.getByLabel('Status').selectOption('inactive');
  await expectRows('user', [5]);
  await shot('users-directory-inactive');
  await page.getByLabel('Status').selectOption('all');
  await page.getByLabel('Search users').fill('sofia');
  await expectRows('user', [SOFIA]);
  await shot('users-directory-search');
  await page.getByLabel('Search users').fill('nobody-here');
  await expectRows('user', []);
  await expect(page.getByText('No users match your filters')).toBeVisible();
  await shot('users-directory-no-match');
  await page.getByRole('button', { name: 'Show all users' }).click();
  await expectRows('user', [2, 3, 4, 5]);
  await shot('users-directory-show-all');
  for (const [label, path] of [
    ['Andes Santiago Centro', `/platform-saas/companies/${ANDES}/merchants/${CENTRO}/hub`],
    ['Merchants', `/platform-saas/companies/${ANDES}/merchants`],
    ['Andes Bistro Group', `/platform-saas/companies/${ANDES}/hub`],
    ['Companies Directory', '/platform-saas/companies/directory'],
    ['Companies Hub', '/platform-saas/companies/hub'],
  ] as const) {
    await page.goto(`/platform-saas/merchants/${CENTRO}/users`);
    await settle();
    await clickCrumb(label);
    await expectPath(path);
  }
});

test('H2 · clicking a user record routes to the user dashboard', async () => {
  await page.goto(`/platform-saas/merchants/${CENTRO}/users`);
  await settle();
  await page.getByTestId(`user-row-${SOFIA}`).click();
  await expectPath(`/platform-saas/merchants/${CENTRO}/users/${SOFIA}`);
  await expect(heading()).toHaveText('USER DASHBOARD');
  await expectPoppins(heading());
  await expectCrumbs([
    'Platform SaaS', 'Companies Hub', 'Companies Directory', 'Andes Bistro Group', 'Merchants', 'Andes Santiago Centro', 'Users', 'sofia_cashier',
  ]);
  await expectStat('role', 'Merchant User');
  await expectStat('scope', 'Merchant Web');
  await expectStat('status', 'Active');
  await expectStat('hr-profiles', 1);
  await expect(page.locator('main')).toContainText('Sofia Cashier');
  await expect(page.locator('main dl')).toContainText('sofia@andesbistro-e2e.com');
  await expect(page.locator('main dl')).toContainText('Andes Santiago Centro');
  await expect(page.locator('main dl')).toContainText('Andes Bistro Group');
  await shot('user-dashboard-sofia');

  await headerAction('Back to Users').click();
  await expectPath(`/platform-saas/merchants/${CENTRO}/users`);
  // el inactivo solo aparece al mostrar todos los estados
  await expect(page.getByRole('button', { name: 'Open former_manager dashboard' })).toHaveCount(0);
  await page.getByLabel('Status').selectOption('all');
  await page.getByRole('button', { name: 'Open former_manager dashboard' }).click();
  await expectPath(`/platform-saas/merchants/${CENTRO}/users/5`);
  await expectStat('status', 'Inactive');
  await expectStat('role', 'Merchant Admin');
  await shot('user-dashboard-inactive-user');
  await clickCrumb('Users');
  await expectPath(`/platform-saas/merchants/${CENTRO}/users`);

  const dashboard = `/platform-saas/merchants/${CENTRO}/users/${SOFIA}`;
  await page.goto(dashboard);
  await settle();
  await expectNavBar('Back to Users', MERCHANT_ITEMS, 'Users');
  for (const [label, path] of [
    ['Back to Users', `/platform-saas/merchants/${CENTRO}/users`],
    ['Merchant Hub', `/platform-saas/companies/${ANDES}/merchants/${CENTRO}/hub`],
    ['Merchant Profile', `/platform-saas/companies/${ANDES}/merchants/${CENTRO}/profile`],
    ['Users', `/platform-saas/merchants/${CENTRO}/users`],
    ['POS Terminals', `/platform-saas/companies/${ANDES}/merchants/${CENTRO}/terminals`],
  ] as const) {
    await page.goto(dashboard);
    await settle();
    await navButton(label).click();
    await expectPath(path);
    await shot(`user-dashboard-nav-bar-${label.toLowerCase().replace(/ /g, '-')}`);
  }
  for (const [label, path] of [
    ['Andes Santiago Centro', `/platform-saas/companies/${ANDES}/merchants/${CENTRO}/hub`],
    ['Merchants', `/platform-saas/companies/${ANDES}/merchants`],
    ['Andes Bistro Group', `/platform-saas/companies/${ANDES}/hub`],
    ['Companies Directory', '/platform-saas/companies/directory'],
    ['Companies Hub', '/platform-saas/companies/hub'],
  ] as const) {
    await page.goto(`/platform-saas/merchants/${CENTRO}/users/${SOFIA}`);
    await settle();
    await clickCrumb(label);
    await expectPath(path);
  }
});


// ---- Escala de tamaños: las mismas medidas en todas las vistas -----------------------------

interface ViewSizes {
  path: string;
  h1: string;
  header: string;
  headerIcon: number;
  headerButtons: number[];
  stats: number[];
  features: Array<{ top: number; height: number; footerGap: number }>;
  panelBars: number[];
  th: number[];
  rows: number[];
  inputs: number[];
  labels: string[];
}

/** Medidas calculadas por el navegador de la vista actual (solo elementos visibles). */
const measureView = (): Promise<ViewSizes> =>
  page.evaluate(() => {
    const visible = (el: Element) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    };
    const h = (el: Element) => Math.round(el.getBoundingClientRect().height);
    const all = (sel: string) => [...document.querySelectorAll(sel)].filter(visible);
    const header = document.querySelector('main [data-saas-header]')!;
    const h1 = header.querySelector('h1')!;
    const hs = getComputedStyle(header);
    const h1s = getComputedStyle(h1);
    return {
      path: location.pathname,
      h1: `${h1s.fontSize} ${h1s.fontWeight} ${h1s.lineHeight}`,
      header: `${hs.paddingTop} ${hs.paddingLeft} ${hs.borderRadius}`,
      headerIcon: h(header.querySelector('[data-saas-header-icon]')!),
      headerButtons: [...header.querySelectorAll(':scope > div button')].filter(visible).map(h),
      stats: all('main [data-saas-stat]').map(h),
      features: all('main [data-saas-feature]').map((el) => ({
        top: Math.round(el.getBoundingClientRect().top),
        height: h(el),
        footerGap: Math.round(el.getBoundingClientRect().bottom - el.querySelector('[data-saas-feature-footer]')!.getBoundingClientRect().bottom),
      })),
      panelBars: all('main [data-saas-panel-bar]').map(h),
      th: all('main thead th').map(h),
      rows: all('main tbody tr').map(h),
      inputs: all('main input[type="search"], main input[type="text"], main input[type="email"], main input[type="tel"], main input:not([type]), main select').map(h),
      labels: all('main label').map((el) => getComputedStyle(el).fontSize),
    };
  });

const uniq = <T,>(values: T[]) => [...new Set(values)];

/** Todas las vistas comparten la escala de SaasViewKit (saas-scale.ts). */
const expectConsistentSizes = (views: ViewSizes[], { rows = true }: { rows?: boolean } = {}) => {
  const where = (pick: (v: ViewSizes) => unknown) => views.map((v) => `${v.path}: ${JSON.stringify(pick(v))}`).join('\n');
  expect(uniq(views.map((v) => v.h1)), `h1 sizes\n${where((v) => v.h1)}`).toHaveLength(1);
  expect(uniq(views.map((v) => v.header)), `header paddings\n${where((v) => v.header)}`).toHaveLength(1);
  expect(uniq(views.map((v) => v.headerIcon)), 'header icon box').toEqual([48]);
  expect(uniq(views.flatMap((v) => v.headerButtons)), `header buttons\n${where((v) => v.headerButtons)}`).toEqual([40]);
  expect(uniq(views.flatMap((v) => v.stats)), `stat cards\n${where((v) => v.stats)}`).toEqual([128]);
  for (const v of views) {
    // tarjetas de módulo: misma altura por fila (y en toda la cuadrícula) y pies alineados
    expect(uniq(v.features.map((f) => f.height)), `feature card heights on ${v.path}`).toHaveLength(v.features.length ? 1 : 0);
    expect(uniq(v.features.map((f) => f.footerGap)), `feature card footers on ${v.path}`).toHaveLength(v.features.length ? 1 : 0);
  }
  expect(uniq(views.flatMap((v) => v.features.map((f) => f.height))).length, 'feature card height across hubs').toBeLessThanOrEqual(1);
  expect(uniq(views.flatMap((v) => v.panelBars)), `panel title bars\n${where((v) => v.panelBars)}`).toEqual([48]);
  expect(uniq(views.flatMap((v) => v.th)), `table headers\n${where((v) => v.th)}`).toEqual([44]);
  if (rows) expect(uniq(views.flatMap((v) => v.rows)), `table rows\n${where((v) => v.rows)}`).toEqual([64]);
  expect(uniq(views.flatMap((v) => v.inputs)), `inputs and selects\n${where((v) => v.inputs)}`).toEqual([40]);
  expect(uniq(views.flatMap((v) => v.labels)), `form labels\n${where((v) => v.labels)}`).toEqual(['11px']);
};

const SIZE_PAGES = [
  '/platform-saas/companies/hub',
  '/platform-saas/companies/directory',
  `/platform-saas/companies/${ANDES}/hub`,
  `/platform-saas/companies/${ANDES}/profile`,
  `/platform-saas/companies/${ANDES}/configuration`,
  `/platform-saas/companies/${ANDES}/merchants`,
  `/platform-saas/companies/${ANDES}/merchants/${CENTRO}/hub`,
  `/platform-saas/companies/${ANDES}/merchants/${CENTRO}/profile`,
  `/platform-saas/companies/${ANDES}/merchants/${CENTRO}/terminals`,
  `/platform-saas/merchants/${CENTRO}/users`,
  `/platform-saas/merchants/${CENTRO}/users/${SOFIA}`,
];

test('consistent sizes · headers, stat and feature cards, tables, inputs and buttons measure the same on every view (1440 px)', async () => {
  const views: ViewSizes[] = [];
  for (const path of SIZE_PAGES) {
    await page.goto(path);
    await settle();
    views.push(await measureView());
  }
  console.log(`SIZES 1440 ${JSON.stringify(views)}`);
  // cada tipo de pieza aparece al menos en dos vistas: la comparación no es trivial
  expect(views.filter((v) => v.stats.length > 0).length).toBeGreaterThanOrEqual(5);
  expect(views.filter((v) => v.rows.length > 0).length).toBeGreaterThanOrEqual(5);
  expect(views.filter((v) => v.inputs.length > 0).length).toBeGreaterThanOrEqual(6);
  expect(views.filter((v) => v.features.length > 0).length).toBeGreaterThanOrEqual(3);
  expectConsistentSizes(views);
});

// ---- Responsive: 390 px ------------------------------------------------------------------

test('every visited screen fits at 390 px (no horizontal overflow) and keeps the same size scale', async () => {
  await page.setViewportSize({ width: 390, height: 844 });
  const mobileSizes: ViewSizes[] = [];
  const paths = [...visited].filter((p) => p.startsWith('/platform-saas/')).sort();
  expect(paths.length).toBeGreaterThanOrEqual(12);
  for (const path of paths) {
    await page.goto(path);
    await settle();
    await expectNoOverflow(`${path} (390px)`);
    layoutChecks.mobile += 1;
    await expectPoppins(heading());
    if (SIZE_PAGES.includes(path)) mobileSizes.push(await measureView());
    step += 1;
    await fullShot(`${SHOTS}/${String(step).padStart(2, '0')}-mobile-390${path.replace(/\//g, '-')}.png`);
    expectNoErrorsSoFar(`${path} at 390px`);
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  expect(mobileSizes.length).toBe(SIZE_PAGES.length);
  // a 390 px las filas de tabla pueden ocupar más líneas; el resto de la escala es la misma
  expectConsistentSizes(mobileSizes, { rows: false });
});

// ---- Aislamiento por tenant: Company Administrator (merchant_admin) ----------------------

test('tenant isolation · a merchant_admin sees only its company and gets a friendly 403 elsewhere', async ({ browser }) => {
  const ownerPage = page;
  page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  watch(page);
  try {
    await login(page, COMPANY_ADMIN, 'company-admin-login');
    await page.goto('/platform-saas/companies/hub');
    await settle();
    await expect(heading()).toHaveText('COMPANIES COMMAND HUB');
    // conteos limitados a Andes: 1 company, 3 configuraciones, 7 usuarios y 3 merchants activos
    // (Centro, Providencia y Concepcion Sur, reactivada en la prueba de H3)
    await expectStat('active-companies', 1, '1 company profiles · 0 suspended');
    await expectStat('tenant-configurations', 3);
    await expectStat('system-profiles', 7);
    await expectStat('active-merchants', 3);
    // el selector de contexto solo ofrece su company, y es la elegida por defecto
    await expect(contextSelect()).toHaveValue(String(ANDES));
    await expect(contextSelect().locator('option')).toHaveText(['Andes Bistro Group']);
    await shot('company-admin-companies-hub');

    await featureCard('company-profile').click();
    await expectPath(`/platform-saas/companies/${ANDES}/profile`);
    await expect(companyField('commercialName')).toHaveValue('Andes Bistro Group');
    await shot('company-admin-own-profile');

    await page.goto('/platform-saas/companies/directory');
    await settle();
    await expectRows('company', [ANDES]);
    await shot('company-admin-directory-only-own-company');

    expectFailure(403, `/v1/saas/companies/${COASTAL}/hub`);
    await page.goto(`/platform-saas/companies/${COASTAL}/hub`);
    await settle();
    await expect(page.getByRole('alert')).toContainText('You do not have access to companies outside your organization.');
    await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible();
    await shot('company-admin-foreign-company-403');

    expectFailure(403, `/v1/saas/companies/${COASTAL}/profile`);
    await page.goto(`/platform-saas/companies/${COASTAL}/profile`);
    await settle();
    await expect(page.getByRole('alert')).toContainText('You do not have access to companies outside your organization.');
    await shot('company-admin-foreign-profile-403');

    expectFailure(403, `/v1/saas/companies/${COASTAL}/merchants`);
    expectFailure(403, `/v1/saas/companies/${COASTAL}/hub`);
    await page.goto(`/platform-saas/companies/${COASTAL}/merchants`);
    await settle();
    await expect(page.getByRole('alert')).toContainText('You do not have access to companies outside your organization.');
    await shot('company-admin-foreign-merchants-403');

    expectFailure(403, `/v1/saas/merchants/${MIAMI}/users`);
    expectFailure(403, `/v1/saas/merchants/${MIAMI}`);
    await page.goto(`/platform-saas/merchants/${MIAMI}/users`);
    await settle();
    await expect(page.getByRole('alert')).toContainText('You do not have access to companies outside your organization.');
    await shot('company-admin-foreign-users-403');

    // Retry vuelve a pedir y sigue mostrando el mensaje, sin errores no controlados
    expectFailure(403, `/v1/saas/merchants/${MIAMI}/users`);
    await page.getByRole('button', { name: 'Retry' }).click();
    await settle();
    await expect(page.getByRole('alert')).toContainText('You do not have access to companies outside your organization.');
    await shot('company-admin-foreign-users-retry');

    // terminales de una sucursal ajena: 403 amable
    expectFailure(403, `/v1/saas/merchants/${MIAMI}/terminals`);
    expectFailure(403, `/v1/saas/merchants/${MIAMI}`);
    await page.goto(`/platform-saas/companies/${COASTAL}/merchants/${MIAMI}/terminals`);
    await settle();
    await expect(page.getByRole('alert')).toContainText('You do not have access to companies outside your organization.');
    await expect(rows('terminal')).toHaveCount(0);
    await shot('company-admin-foreign-terminals-403');

    // su propia sucursal sí
    await page.goto(`/platform-saas/companies/${ANDES}/merchants/${CENTRO}/hub`);
    await settle();
    await expectStat('active-pos-terminals', 2);
    await shot('company-admin-own-merchant-hub');
    await featureCard('merchant-terminals').click();
    await expectPath(`/platform-saas/companies/${ANDES}/merchants/${CENTRO}/terminals`);
    await expectRows('terminal', [1, 2, 3]);
    await shot('company-admin-own-terminals');
    settleExpectedFailures();
  } finally {
    expectedFailures.length = 0;
    await page.close();
    page = ownerPage;
  }
});

// ---- Resumen de puertas ------------------------------------------------------------------

test('zero-error gates: console, pageerror, HTTP, backend log', async () => {
  expectNoErrorsSoFar('the whole run');
  let backendProblems: string[] = [];
  if (BACKEND_LOG) {
    backendProblems = readFileSync(BACKEND_LOG, 'utf8')
      .split('\n')
      .filter((line) => /\bERROR\b|DeprecationWarning|UnhandledPromiseRejection|Exception/.test(line));
  }
  const summary = {
    screenshots: step,
    apiResponses: gates.apiResponses,
    consoleErrorsOrWarnings: gates.console.length,
    pageErrors: gates.pageErrors.length,
    unexpectedHttp4xx: gates.http.length,
    http5xx: gates.serverErrors.length,
    provokedHttp: gates.expectedHttp,
    backendLogProblems: backendProblems.length,
    overflowChecks1440: layoutChecks.desktop,
    overflowChecks390: layoutChecks.mobile,
    poppinsChecks: fontChecks,
    materialSymbolChecks: iconChecks,
    redHoverChecks: hoverChecks,
  };
  console.log(`GATES ${JSON.stringify(summary)}`);
  expect(backendProblems).toEqual([]);
});
