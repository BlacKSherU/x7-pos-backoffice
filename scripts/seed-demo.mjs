#!/usr/bin/env node
// Carga datos de demostración en el backend a través de la API, como lo haría el backoffice.
//
// Todo se crea dentro de una empresa y un comercio propios ("X7 Demo"), así que no toca los
// datos de otros. Es re-ejecutable: antes de crear algo busca si ya existe por su nombre.
//
//   node scripts/seed-demo.mjs --dry-run     # muestra lo que haría, sin escribir nada
//   node scripts/seed-demo.mjs               # crea lo que falte
//   node scripts/seed-demo.mjs --only=kitchen,dining
//
// Variables (opcionales): SEED_API_URL (por defecto VITE_API_URL del .env), SEED_EMAIL,
// SEED_PASSWORD.

import { readFileSync } from 'node:fs';

const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has('--dry-run');
const ONLY = [...args].find((a) => a.startsWith('--only='))?.slice('--only='.length).split(',') ?? null;

const envFile = (() => {
  try {
    return readFileSync(new URL('../.env', import.meta.url), 'utf8');
  } catch {
    return '';
  }
})();
const fromEnvFile = (key) => envFile.match(new RegExp(`^${key}=(.*)$`, 'm'))?.[1]?.trim();

const API = (process.env.SEED_API_URL ?? fromEnvFile('VITE_API_URL') ?? 'http://localhost:3000/api').replace(/\/$/, '');
const EMAIL = process.env.SEED_EMAIL ?? 'demo.admin@x7demo.dev';
const PASSWORD = process.env.SEED_PASSWORD ?? 'Demo1234!';

const DEMO_COMPANY = {
  companyName: 'X7 Demo Restaurant Group',
  companyEmail: 'demo@x7demo.dev',
  companyPhone: '+56 2 2345 6789',
  rut: '76123456-0',
  address: 'Av. Providencia 1234',
  city: 'Santiago',
  state: 'Region Metropolitana', // el backend aún rechaza tildes en ciudad/región/país
  country: 'Chile',
  branchName: 'X7 Demo Bistro',
  adminEmail: EMAIL,
  username: 'x7demo_admin',
  password: PASSWORD,
  planId: 3, // Executive: habilita todos los módulos del backoffice
};

// ---------------------------------------------------------------------------------------------
// HTTP

let token = null;
let merchantId = null;
let adminUserId = null;

async function request(method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Accept: 'application/json',
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : undefined;
  if (!res.ok) {
    const base = Array.isArray(json?.message) ? json.message.join(', ') : json?.message ?? res.statusText;
    // ValidationExceptionFilter manda el detalle por campo en `errors`.
    const details = Array.isArray(json?.errors) ? ` (${json.errors.map((e) => (typeof e === 'string' ? e : JSON.stringify(e))).join('; ')})` : '';
    const message = base + details;
    const err = new Error(`${method} ${path} → ${res.status}: ${message}`);
    err.status = res.status;
    throw err;
  }
  return json;
}

const unwrapList = (json) => (Array.isArray(json) ? json : json?.data ?? json?.items ?? []);
const unwrapItem = (json) => json?.data ?? json;

// Algunos listados no aceptan `limit` (u otros filtros) y responden 400: se reintenta sin query.
async function list(path) {
  try {
    return await request('GET', path);
  } catch (err) {
    if (err.status === 400 && path.includes('?')) return request('GET', path.split('?')[0]);
    throw err;
  }
}

const stats = { created: 0, existing: 0, failed: 0 };
let dryRunId = -1;

/**
 * Busca en `listPath` un registro que cumpla `match`; si no existe, lo crea con POST.
 * Devuelve el registro (o uno simulado con id negativo en --dry-run). `found` permite pasar el
 * registro ya buscado en un listado previo, sin volver a pedirlo.
 */
async function ensure(label, listPath, match, createPath, body, found) {
  try {
    const existing = found ?? unwrapList(await list(listPath)).find(match);
    if (existing) {
      stats.existing += 1;
      console.log(`  = ${label} (ya existe, id ${existing.id})`);
      return existing;
    }
  } catch (err) {
    // Sin listado no podemos comprobar duplicados: mejor no crear a ciegas.
    if (!DRY_RUN) throw err;
  }
  if (DRY_RUN) {
    console.log(`  + ${label}  POST ${createPath} ${JSON.stringify(body)}`);
    return { id: dryRunId--, ...body };
  }
  try {
    const created = unwrapItem(await request('POST', createPath, body));
    stats.created += 1;
    console.log(`  + ${label} (id ${created.id})`);
    return created;
  } catch (err) {
    stats.failed += 1;
    console.log(`  ! ${label}: ${err.message}`);
    return null;
  }
}

const byName = (name) => (r) => String(r.name ?? '').trim().toLowerCase() === name.toLowerCase();

/** Registros ya existentes de un listado (para enlazar áreas que se ejecutan por separado). */
async function existing(listPath) {
  try {
    return unwrapList(await list(listPath));
  } catch {
    return [];
  }
}

const idOf = (ref) => (ref && typeof ref === 'object' ? ref.id : ref);

/** Empresa del comercio demo (varios DTO de finanzas la piden explícitamente). */
let cachedCompanyId = null;
async function companyId() {
  if (cachedCompanyId == null) {
    const merchant = unwrapItem(await request('GET', `/merchants/${merchantId}`).catch(() => null));
    cachedCompanyId = idOf(merchant?.companyId ?? merchant?.company) ?? null;
  }
  return cachedCompanyId;
}

/** Fecha (YYYY-MM-DD) `daysFromToday` días a partir de hoy. */
const day = (daysFromToday) => at(daysFromToday, 12).slice(0, 10);

/** Fecha local `daysFromToday` días a partir de hoy, a la hora indicada, en ISO. */
const at = (daysFromToday, hour, minute = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + daysFromToday);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
};

// ---------------------------------------------------------------------------------------------
// Sesión: login con el admin demo; si no existe, se registra la empresa demo (onboarding).

async function login() {
  try {
    const res = await request('POST', '/auth/login', { email: EMAIL, password: PASSWORD });
    token = res.access_token;
    merchantId = res.user?.merchant?.id;
    adminUserId = res.user?.id;
    return true;
  } catch (err) {
    if (err.status === 401 || err.status === 404) return false;
    throw err;
  }
}

async function session() {
  if (await login()) {
    console.log(`Sesión: ${EMAIL} (merchant ${merchantId})`);
    return;
  }
  if (DRY_RUN) {
    console.log(`Sesión: ${EMAIL} no existe; se registraría la empresa demo:`);
    console.log(`  + onboarding POST /auth/register-onboarding ${JSON.stringify({ ...DEMO_COMPANY, password: '***' })}`);
    return;
  }
  console.log('Registrando la empresa demo (onboarding)…');
  await request('POST', '/auth/register-onboarding', DEMO_COMPANY);
  if (!(await login())) throw new Error('El registro terminó pero el login sigue fallando');
  console.log(`Sesión: ${EMAIL} (merchant ${merchantId})`);
}

// ---------------------------------------------------------------------------------------------
// Áreas. Cada una recibe y devuelve un contexto con los ids que necesitan las siguientes.

const AREAS = {
  async catalog(ctx) {
    console.log('\nCatálogo: categorías, productos, variantes y modificadores');
    const categories = {};
    for (const name of ['Entradas', 'Platos de fondo', 'Postres', 'Bebidas']) {
      categories[name] = await ensure(`categoría ${name}`, '/category?limit=100', byName(name), '/category', { name, isActive: true });
    }
    const PRODUCTS = [
      ['Empanada de pino', 'DEMO-ENT-01', 2500, 'Entradas'],
      ['Ceviche mixto', 'DEMO-ENT-02', 6900, 'Entradas'],
      ['Burger X7', 'DEMO-FON-01', 8900, 'Platos de fondo'],
      ['Lomo a lo pobre', 'DEMO-FON-02', 12900, 'Platos de fondo'],
      ['Risotto de hongos', 'DEMO-FON-03', 10500, 'Platos de fondo'],
      ['Leche asada', 'DEMO-POS-01', 3500, 'Postres'],
      ['Brownie con helado', 'DEMO-POS-02', 4200, 'Postres'],
      ['Limonada menta jengibre', 'DEMO-BEB-01', 2900, 'Bebidas'],
      ['Pisco sour', 'DEMO-BEB-02', 4500, 'Bebidas'],
    ];
    ctx.products = {};
    for (const [name, sku, basePrice, category] of PRODUCTS) {
      ctx.products[name] = await ensure(`producto ${name}`, '/products?limit=100', byName(name), '/products', {
        name,
        sku,
        basePrice,
        categoryId: categories[category]?.id,
        isActive: true,
      });
    }
    const burger = ctx.products['Burger X7'];
    if (burger) {
      for (const [name, price] of [['Simple', 8900], ['Doble', 11900]]) {
        await ensure(`variante Burger ${name}`, '/variants?limit=100', (v) => byName(name)(v) && (v.productId ?? v.product?.id) === burger.id, '/variants', {
          name,
          price,
          sku: `DEMO-FON-01-${name.toUpperCase()}`,
          productId: burger.id,
          isActive: true,
        });
      }
      for (const [name, priceDelta] of [['Extra queso', 900], ['Sin cebolla', 0], ['Tocino', 1200]]) {
        await ensure(`modificador ${name}`, '/modifiers?limit=100', (m) => byName(name)(m) && (m.productId ?? m.product?.id) === burger.id, '/modifiers', {
          name,
          priceDelta,
          productId: burger.id,
          isActive: true,
        });
      }
    }
    return ctx;
  },

  async config(ctx) {
    console.log('\nConfiguración: impuestos y plan de cuentas');
    await ensure('impuesto IVA 19%', '/merchant-tax-rule?limit=100', byName('IVA 19%'), '/merchant-tax-rule', {
      name: 'IVA 19%',
      description: 'Impuesto al valor agregado',
      taxType: 'percentage',
      rate: 0.19,
      appliesToTips: false,
      appliesToOvertime: false,
    });
    const ACCOUNTS = [
      ['1100', 'Caja', 'ASSET'],
      ['1200', 'Bancos', 'ASSET'],
      ['1300', 'Inventario de insumos', 'ASSET'],
      ['2100', 'Proveedores', 'LIABILITY'],
      ['2200', 'IVA débito fiscal', 'LIABILITY'],
      ['3100', 'Capital', 'EQUITY'],
      ['4100', 'Ventas de alimentos', 'REVENUE'],
      ['4200', 'Ventas de bebidas', 'REVENUE'],
      ['5100', 'Costo de insumos', 'EXPENSE'],
      ['5200', 'Remuneraciones', 'EXPENSE'],
    ];
    for (const [code, name, type] of ACCOUNTS) {
      await ensure(`cuenta ${code} ${name}`, '/ledger-accounts?limit=100', (a) => String(a.code) === code, '/ledger-accounts', { code, name, type });
    }
    return ctx;
  },

  async inventory(ctx) {
    console.log('\nInventario: proveedores, categorías de insumos y bodegas');
    for (const [name, tax_id, email] of [
      ['Distribuidora Andes', '76543210-3', 'ventas@andes.demo'],
      ['Verduras del Valle', '77111222-6', 'pedidos@valle.demo'],
      ['Carnes Patagonia', '76999888-8', 'contacto@patagonia.demo'],
    ]) {
      await ensure(`proveedor ${name}`, '/v1/inventory/suppliers?limit=100', byName(name), '/v1/inventory/suppliers', {
        name,
        tax_id,
        email,
        isActive: true,
      });
    }
    for (const [name, description] of [
      ['Lácteos', 'Leche, quesos, mantequilla y crema'],
      ['Carnes', 'Vacuno, cerdo y aves'],
      ['Verduras', 'Hortalizas y hierbas frescas'],
      ['Abarrotes', 'Arroz, harinas, aceites y conservas'],
    ]) {
      await ensure(`categoría de insumos ${name}`, '/v1/raw-material-categories?limit=100', byName(name), '/v1/raw-material-categories', {
        name,
        description,
        is_active: true,
      });
    }
    for (const [name, code, isMainStorage] of [
      ['Bodega central', 'MAIN-01', true],
      ['Cámara de frío', 'COLD-01', false],
    ]) {
      await ensure(`bodega ${name}`, '/v1/raw-material-stock/locations?limit=100', byName(name), '/v1/raw-material-stock/locations', {
        name,
        code,
        isMainStorage,
        isActive: true,
      });
    }
    return ctx;
  },

  async kitchen(ctx) {
    console.log('\nCocina: estaciones (una por modo de pantalla)');
    const STATIONS = [
      ['Hot Line', 'HOT', 'GRID', 1],
      ['Cold Prep', 'COLD', 'SUMMARY', 2],
      ['Main Bar', 'BAR', 'AUTO', 3],
      ['Desserts', 'DESSERT', 'MANUAL', 4],
    ];
    ctx.stations = {};
    for (const [name, stationType, displayMode, displayOrder] of STATIONS) {
      ctx.stations[name] = await ensure(`estación ${name} (${displayMode})`, '/kitchen-station?limit=100', byName(name), '/kitchen-station', {
        name,
        stationType,
        displayMode,
        displayOrder,
        maxActiveTicketsCapacity: 15,
        autoRerouteOnOffline: true,
        autoRerouteOnCapacity: true,
      });
    }
    return ctx;
  },

  async dining(ctx) {
    console.log('\nSalón: plano, zonas y mesas');
    const plan = await ensure('plano Salón principal', '/floor-plan?limit=100', byName('Salón principal'), '/floor-plan', {
      merchant: merchantId,
      name: 'Salón principal',
      width: 1000,
      height: 700,
      status: 'active',
    });
    if (!plan) return ctx;
    const zones = {};
    for (const [name, color] of [['Interior', '#ae001a'], ['Terraza', '#2e7d32'], ['Barra', '#1565c0']]) {
      zones[name] = await ensure(`zona ${name}`, '/floor-zone?limit=100', byName(name), '/floor-zone', {
        merchant: merchantId,
        name,
        color,
        floorPlan: plan.id,
        status: 'active',
      });
    }
    const TABLES = [
      ['T1', 4, 'Square', 'Interior', 80, 80],
      ['T2', 4, 'Square', 'Interior', 220, 80],
      ['T3', 2, 'Circle', 'Interior', 360, 80],
      ['T4', 6, 'Rectangle', 'Interior', 80, 240],
      ['T5', 8, 'Booth', 'Interior', 260, 240],
      ['T6', 4, 'Circle', 'Terraza', 620, 80],
      ['T7', 4, 'Circle', 'Terraza', 760, 80],
      ['T8', 2, 'Square', 'Terraza', 620, 240],
      ['B1', 6, 'Counter', 'Barra', 80, 520],
    ];
    for (const [number, capacity, shape, zone, pos_x, pos_y] of TABLES) {
      if (!zones[zone]) continue;
      await ensure(`mesa ${number}`, '/tables?limit=100', (t) => String(t.number) === number, '/tables', {
        merchant_id: merchantId,
        number,
        capacity,
        status: 'available',
        location: zone,
        rotation: 0,
        shape,
        pos_x,
        pos_y,
        floorZone: zones[zone].id,
        floorPlan: plan.id,
      });
    }
    return ctx;
  },

  async cash(ctx) {
    console.log('\nCaja: cajón y turno de caja abierto (los pedidos lo exigen)');
    const active = unwrapItem(await request('GET', '/cash-shifts/active').catch(() => null));
    if (active?.id) {
      stats.existing += 1;
      console.log(`  = turno de caja abierto (ya existe, id ${active.id})`);
      return ctx;
    }
    // GET /cash-drawers responde 403 a todos (el backend lee req.merchant en vez de req.user):
    // se reutiliza el cajón de un turno anterior y solo si no hay ninguno se crea uno.
    const previous = (await existing('/cash-shifts?limit=100'))[0];
    let drawerId = idOf(previous?.cashDrawerId ?? previous?.cashDrawer);
    if (!drawerId) {
      const drawer = await ensure('cajón principal', '/cash-shifts?limit=1', () => false, '/cash-drawers', { openingBalance: 50000 });
      drawerId = drawer?.id;
    }
    if (!drawerId) return ctx;
    await ensure('turno de caja abierto', '/cash-shifts?limit=1', () => false, '/cash-shifts', {
      cashDrawerId: drawerId,
      openingBalance: 50000,
    });
    return ctx;
  },

  async orders(ctx) {
    console.log('\nComandas de cocina (para el monitor KDS)');
    const station = (name) => ctx.stations?.[name]?.id;
    const ORDERS = [
      ['Table 1', 'Hot Line', 0, [['Burger X7', 2, 'main_course', 'Sin cebolla'], ['Limonada menta jengibre', 2, 'beverage']]],
      ['Table 4', 'Hot Line', 2, [['Lomo a lo pobre', 1, 'main_course'], ['Empanada de pino', 3, 'appetizer']]],
      ['Table 6', 'Cold Prep', 0, [['Ceviche mixto', 2, 'appetizer', 'Alergia: mariscos (solo uno)']]],
      ['Table 7', 'Cold Prep', 1, [['Ceviche mixto', 1, 'appetizer']]],
      ['Barra B1', 'Main Bar', 0, [['Pisco sour', 4, 'beverage']]],
      ['Table 2', 'Desserts', 0, [['Brownie con helado', 2, 'dessert'], ['Leche asada', 1, 'dessert']]],
    ];
    if (!ctx.stations) {
      console.log('  (sin estaciones: ejecuta también el área "kitchen")');
      return ctx;
    }
    for (const [table, stationName, priority, items] of ORDERS) {
      await ensure(`comanda ${table} → ${stationName}`, '/kitchen-orders?limit=100', (o) => o.notes === table && o.businessStatus !== 'completed' && o.businessStatus !== 'cancelled', '/kitchen-orders', {
        stationId: station(stationName),
        priority,
        businessStatus: 'pending',
        notes: table,
        skipAutoKitchenItems: true,
        kitchenOrderItems: items.map(([productName, quantity, course, notes]) => ({
          productId: ctx.products?.[productName]?.id ?? null,
          productName,
          quantity,
          course,
          notes: notes ?? null,
        })),
      });
    }
    return ctx;
  },

  // ---- Fase 2 ----

  async staff(ctx) {
    console.log('\nPersonal: usuarios y colaboradores');
    const STAFF = [
      ['Camila Rojas', 'camila', 'waiter', 'Salón'],
      ['Diego Muñoz', 'diego', 'waiter', 'Salón'],
      ['Valentina Soto', 'valentina', 'cook', 'Cocina'],
      ['Matías González', 'matias', 'cook', 'Cocina'],
      ['Ignacio Pérez', 'ignacio', 'bartender', 'Barra'],
      ['Fernanda Díaz', 'fernanda', 'host', 'Salón'],
      ['Tomás Herrera', 'tomas', 'cashier', 'Caja'],
      ['Javiera Morales', 'javiera', 'manager', 'Administración'],
    ];
    ctx.collaborators = {};
    // El admin también necesita ficha de colaborador: el backend la exige para abrir cajas.
    await ensure('colaborador Admin Demo (manager)', '/collaborators?limit=100', byName('Admin Demo'), '/collaborators', {
      user_id: adminUserId,
      merchant_id: merchantId,
      name: 'Admin Demo',
      employeeId: 'DEMO-ADMIN',
      department: 'Administración',
      role: 'manager',
      status: 'active',
    });
    for (const [name, handle, role, department] of STAFF) {
      const email = `${handle}@x7demo.dev`;
      const user = await ensure(`usuario ${email}`, `/users/merchant/${merchantId}`, (u) => u.email === email, '/users', {
        username: `x7demo_${handle}`,
        email,
        password: PASSWORD,
        role: 'merchant_user',
        scope: 'merchant_web',
        merchantId,
      });
      if (!user) continue;
      ctx.collaborators[role] ??= [];
      const collaborator = await ensure(`colaborador ${name} (${role})`, '/collaborators?limit=100', byName(name), '/collaborators', {
        user_id: user.id,
        merchant_id: merchantId,
        name,
        employeeId: `DEMO-${handle.toUpperCase()}`,
        department,
        role,
        status: 'active',
      });
      if (collaborator) ctx.collaborators[role].push(collaborator);
    }
    return ctx;
  },

  async shifts(ctx) {
    console.log('\nTurnos: almuerzo y cena de los próximos 7 días, con asignaciones');
    const collaborators = await existing('/collaborators?limit=100');
    const byRole = (role) => collaborators.filter((c) => c.role === role);
    const shifts = await existing('/shifts?limit=100');
    const assignments = await existing('/shift-assignments?limit=100');
    const sameTime = (a, b) => a && b && new Date(a).getTime() === new Date(b).getTime();
    ctx.shifts = [];
    for (let day = 0; day < 7; day += 1) {
      for (const [label, start, end] of [['almuerzo', 11, 17], ['cena', 18, 24]]) {
        const startTime = at(day, start);
        const endTime = at(day, end);
        const found = shifts.find((s) => sameTime(s.startTime ?? s.start_time, startTime) && (s.merchantId ?? s.merchant?.id ?? merchantId) === merchantId);
        const shift = found
          ? (stats.existing++, found)
          : await ensure(`turno ${label} día +${day}`, '/shifts?limit=1', () => false, '/shifts', {
              merchantId,
              startTime,
              endTime,
              status: 'active',
            });
        if (!shift) continue;
        ctx.shifts.push(shift);
        // Un mesero, un cocinero y el bartender en cada turno; en la cena, el segundo de cada uno.
        const pick = (role) => byRole(role)[label === 'cena' ? 1 : 0] ?? byRole(role)[0];
        for (const role of ['waiter', 'cook', 'bartender']) {
          const collaborator = pick(role);
          if (!collaborator) continue;
          const already = assignments.find(
            (a) => idOf(a.shiftId ?? a.shift) === shift.id && idOf(a.collaboratorId ?? a.collaborator) === collaborator.id,
          );
          if (already) {
            stats.existing += 1;
            continue;
          }
          await ensure(`  asignación ${collaborator.name}`, '/shift-assignments?limit=1', () => false, '/shift-assignments', {
            shiftId: shift.id,
            collaboratorId: collaborator.id,
            roleDuringShift: role,
            startTime,
            endTime,
            status: 'active',
          });
        }
      }
    }
    return ctx;
  },

  async customers(ctx) {
    console.log('\nClientes');
    const CUSTOMERS = [
      ['Andrea Fuentes', 'andrea.fuentes@cliente.demo', '+56 9 6123 4501', '15234567-4'],
      ['Roberto Silva', 'roberto.silva@cliente.demo', '+56 9 6123 4502', '13987654-7'],
      ['Carolina Vega', 'carolina.vega@cliente.demo', '+56 9 6123 4503', '17456321-7'],
      ['Felipe Araya', 'felipe.araya@cliente.demo', '+56 9 6123 4504', '16789012-1'],
      ['Daniela Contreras', 'daniela.contreras@cliente.demo', '+56 9 6123 4505', '18345678-4'],
    ];
    for (const [name, email, phone, rut] of CUSTOMERS) {
      await ensure(`cliente ${name}`, '/customers?limit=100', (c) => c.email === email, '/customers', {
        name,
        email,
        phone,
        rut,
        address: 'Av. Providencia 1234',
        city: 'Santiago',
        state: 'Region Metropolitana',
        country: 'Chile',
      });
    }
    return ctx;
  },

  async reservations(ctx) {
    console.log('\nReservas (próximos días)');
    const customers = await existing('/customers?limit=100');
    const tables = await existing('/tables?limit=100');
    const reservations = await existing('/reservation?limit=100');
    const table = (number) => tables.find((t) => String(t.number) === number)?.id;
    const customer = (email) => customers.find((c) => c.email === email)?.id;
    const RESERVATIONS = [
      ['andrea.fuentes@cliente.demo', 1, 13, 4, ['T1'], 'confirmed', 'Cumpleaños, traerán torta'],
      ['roberto.silva@cliente.demo', 1, 20, 2, ['T3'], 'confirmed', 'Mesa tranquila'],
      ['carolina.vega@cliente.demo', 2, 21, 6, ['T4'], 'pending', null],
      ['felipe.araya@cliente.demo', 3, 14, 8, ['T5'], 'confirmed', 'Almuerzo de empresa'],
      ['daniela.contreras@cliente.demo', 4, 20, 4, ['T6'], 'pending', 'Prefiere terraza'],
    ];
    for (const [email, day, hour, party_size, tableNumbers, status, special_requests] of RESERVATIONS) {
      const customer_id = customer(email);
      const reservation_date = at(day, hour);
      const found = reservations.find(
        (r) => idOf(r.customer_id ?? r.customer) === customer_id && new Date(r.reservation_date).getTime() === new Date(reservation_date).getTime(),
      );
      if (found) {
        stats.existing += 1;
        console.log(`  = reserva ${email} (ya existe, id ${found.id})`);
        continue;
      }
      await ensure(`reserva ${email} día +${day} ${hour}:00`, '/reservation?limit=1', () => false, '/reservation', {
        customer_id,
        reservation_date,
        duration_minutes: 90,
        party_size,
        status,
        source: 'phone',
        special_requests: special_requests ?? undefined,
        table_ids: tableNumbers.map(table).filter(Boolean),
      });
    }
    return ctx;
  },

  async delivery(ctx) {
    console.log('\nDelivery: zona, tarifa y repartidores');
    // Polígono aproximado de Providencia (Santiago), en [lng, lat].
    const zone = await ensure('zona Providencia', '/delivery-zone?limit=100', byName('Providencia'), '/delivery-zone', {
      merchant: merchantId,
      name: 'Providencia',
      description: 'Radio cercano al local',
      geojson: {
        type: 'Polygon',
        coordinates: [[[-70.628, -33.418], [-70.596, -33.418], [-70.596, -33.44], [-70.628, -33.44], [-70.628, -33.418]]],
      },
      status: 'active',
    });
    if (zone) {
      await ensure('tarifa Providencia', '/delivery-fee?limit=100', (f) => idOf(f.deliveryZone ?? f.delivery_zone_id ?? f.deliveryZoneId) === zone.id, '/delivery-fee', {
        deliveryZone: zone.id,
        base_fee: 1990,
        per_km_fee: 350,
        min_order_amount: 8000,
        free_above: 35000,
        status: 'active',
      });
    }
    for (const [name, phone, vehicleType] of [
      ['Pedro Castillo', '+56 9 7111 2201', 'motorcycle'],
      ['Sofía Navarro', '+56 9 7111 2202', 'bicycle'],
      ['Lucas Ortiz', '+56 9 7111 2203', 'car'],
    ]) {
      await ensure(`repartidor ${name}`, '/delivery-driver?limit=100', byName(name), '/delivery-driver', {
        name,
        phone,
        vehicleType,
        status: 'active',
      });
    }
    return ctx;
  },

  async online(ctx) {
    console.log('\nVenta online: tienda y menú');
    const store = await ensure('tienda x7demo-bistro', '/online-stores?limit=100', (s) => s.subdomain === 'x7demo-bistro', '/online-stores', {
      subdomain: 'x7demo-bistro',
      theme: 'default',
      currency: 'CLP',
      timezone: 'America/Santiago',
      is_active: true,
    });
    if (store) {
      await ensure('menú online Carta principal', '/online-menus?limit=100', byName('Carta principal'), '/online-menus', {
        storeId: store.id,
        name: 'Carta principal',
        isActive: true,
      });
    }
    return ctx;
  },

  async qr(ctx) {
    console.log('\nQR: menú y ubicaciones por mesa');
    const menu = await ensure('menú QR Carta salón', '/qr-menus?limit=100', byName('Carta salón'), '/qr-menus', {
      merchant: merchantId,
      name: 'Carta salón',
      description: 'Carta para pedir desde la mesa',
      status: 'active',
      design_theme: 'classic',
      qr_type: 'Table',
    });
    if (!menu) return ctx;
    const tables = await existing('/tables?limit=100');
    for (const number of ['T1', 'T2', 'T3', 'T6']) {
      const table = tables.find((t) => String(t.number) === number);
      if (!table) continue;
      const url = `https://x7demo-bistro.x7pos.com/qr/${number.toLowerCase()}`;
      await ensure(`QR mesa ${number}`, '/qr-locations?limit=100', byName(`Mesa ${number}`), '/qr-locations', {
        merchant: merchantId,
        qrMenu: menu.id,
        table: table.id,
        name: `Mesa ${number}`,
        qr_code_url: url,
        qr_code_image: `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(url)}`,
        location_type: 'Table',
        status: 'active',
      });
    }
    return ctx;
  },

  async sales(ctx) {
    console.log('\nVentas: suscripción del comercio y pedidos de mesa');
    const today = new Date();
    const nextYear = new Date(today);
    nextYear.setFullYear(today.getFullYear() + 1);
    const subscription = await ensure('suscripción del comercio', '/merchant-subscription?limit=100', (s) => idOf(s.merchantId ?? s.merchant) === merchantId && s.status === 'active', '/merchant-subscription', {
      merchantId,
      planId: 3,
      startDate: today.toISOString(),
      endDate: nextYear.toISOString(),
      renewalDate: nextYear.toISOString(),
      status: 'active',
      paymentMethod: 'seed',
    });
    if (!subscription) return ctx;
    const [tables, customers, collaborators, products, orders] = await Promise.all([
      existing('/tables?limit=100'),
      existing('/customers?limit=100'),
      existing('/collaborators?limit=100'),
      existing('/products?limit=100'),
      existing('/orders?limit=100'),
    ]);
    // El backend exige que el pedido lo registre quien abrió el turno de caja activo.
    const activeShift = unwrapItem(await request('GET', '/cash-shifts/active').catch(() => null));
    const openerId = idOf(activeShift?.openedByCollaborator ?? activeShift?.openedBy);
    const waiter = collaborators.find((c) => c.id === openerId);
    if (!waiter) {
      console.log('  ! sin turno de caja abierto: ejecuta también el área "cash"');
      return ctx;
    }
    const product = (name) => products.find(byName(name));
    const ORDERS = [
      ['T2', 'andrea.fuentes@cliente.demo', 4, [['Burger X7', 2], ['Pisco sour', 2]]],
      ['T3', 'roberto.silva@cliente.demo', 2, [['Lomo a lo pobre', 1], ['Ceviche mixto', 1], ['Limonada menta jengibre', 2]]],
      ['T8', 'carolina.vega@cliente.demo', 2, [['Risotto de hongos', 2], ['Brownie con helado', 1]]],
    ];
    for (const [tableNumber, email, guestCount, items] of ORDERS) {
      const table = tables.find((t) => String(t.number) === tableNumber);
      const customer = customers.find((c) => c.email === email);
      if (!table || !customer || !waiter) {
        console.log(`  ! pedido ${tableNumber}: faltan mesa o cliente (ejecuta dining y customers)`);
        continue;
      }
      const found = orders.find((o) => idOf(o.tableId ?? o.table) === table.id && idOf(o.customerId ?? o.customer) === customer.id);
      if (found) {
        stats.existing += 1;
        console.log(`  = pedido mesa ${tableNumber} (ya existe, id ${found.id})`);
        continue;
      }
      const order = await ensure(`pedido mesa ${tableNumber}`, '/orders?limit=1', () => false, '/orders', {
        merchantId,
        tableId: table.id,
        collaboratorId: waiter.id,
        subscriptionId: subscription.id,
        customerId: customer.id,
        businessStatus: 'pending',
        source: 'pos',
        type: 'dine_in',
        guestCount,
      });
      if (!order) continue;
      for (const [name, quantity] of items) {
        const p = product(name);
        if (!p) continue;
        await ensure(`  ${quantity}x ${name}`, '/order-item?limit=1', () => false, '/order-item', {
          orderId: order.id,
          productId: p.id,
          quantity,
          price: Number(p.basePrice),
        });
      }
    }
    return ctx;
  },

  async tips(ctx) {
    console.log('\nPropinas: pozo del turno de hoy');
    const shifts = await existing('/shifts?limit=100');
    const today = at(0, 11);
    const shift = shifts.find((s) => new Date(s.startTime ?? s.start_time).getTime() === new Date(today).getTime());
    if (!shift) {
      console.log('  (sin turno de hoy: ejecuta también el área "shifts")');
      return ctx;
    }
    await ensure('pozo de propinas Almuerzo de hoy', '/tip-pools?limit=100', (p) => idOf(p.shiftId ?? p.shift) === shift.id, '/tip-pools', {
      companyId: await companyId(),
      merchantId,
      shiftId: shift.id,
      name: 'Almuerzo de hoy',
      distributionType: 'equal',
      totalAmount: 0,
      status: 'open',
    });
    return ctx;
  },

  // ---- Fase 3 ----

  async supplies(ctx) {
    console.log('\nInsumos: materias primas, proveedores y stock en bodega');
    const [categories, suppliers, locations] = await Promise.all([
      existing('/v1/raw-material-categories?limit=100'),
      existing('/v1/inventory/suppliers?limit=100'),
      existing('/v1/raw-material-stock/locations?limit=100'),
    ]);
    const category = (name) => categories.find(byName(name))?.id;
    const supplier = (name) => suppliers.find(byName(name))?.id;
    const location = (name) => locations.find(byName(name))?.id;
    const SUPPLIES = [
      ['Carne molida vacuno', 'INS-001', 'Carnes', 'gram', 'kg', 1000, 9.5, 'Carnes Patagonia', 'Cámara de frío', 12000, 3000],
      ['Lomo vetado', 'INS-002', 'Carnes', 'gram', 'kg', 1000, 18.9, 'Carnes Patagonia', 'Cámara de frío', 8000, 2000],
      ['Queso cheddar', 'INS-003', 'Lácteos', 'gram', 'kg', 1000, 11.2, 'Distribuidora Andes', 'Cámara de frío', 4000, 1000],
      ['Leche entera', 'INS-004', 'Lácteos', 'milliliter', 'l', 1000, 1.1, 'Distribuidora Andes', 'Cámara de frío', 20000, 5000],
      ['Limón', 'INS-005', 'Verduras', 'unit', 'caja', 50, 120, 'Verduras del Valle', 'Bodega central', 300, 60],
      ['Arroz arbóreo', 'INS-006', 'Abarrotes', 'gram', 'kg', 1000, 4.8, 'Distribuidora Andes', 'Bodega central', 10000, 2000],
    ];
    for (const [name, code, cat, unit, purchase_unit, conversion_factor, cost_per_unit, supplierName, locationName, qty, minimumQty] of SUPPLIES) {
      const supply = await ensure(`insumo ${name}`, '/v1/inventory/raw-materials?limit=100', byName(name), '/v1/inventory/raw-materials', {
        code,
        sku: `DEMO-${code}`,
        name,
        category_id: category(cat),
        unit,
        purchase_unit,
        consumption_unit: unit,
        conversion_factor,
        minimumQty,
        cost_per_unit,
        isActive: true,
      });
      if (!supply || supply.id < 0) continue;
      if (supplier(supplierName) && !DRY_RUN) {
        await request('POST', `/v1/inventory/raw-materials/${supply.id}/suppliers`, { supplierIds: [supplier(supplierName)] }).catch((err) =>
          console.log(`  ! proveedor de ${name}: ${err.message}`),
        );
      }
      // Al crear el insumo el backend ya abre un ítem de stock (en 0) por bodega: se ajusta
      // el de la bodega elegida, solo si sigue en 0 para no sumar stock en cada ejecución.
      const locationId = location(locationName);
      const item = (await existing('/v1/raw-material-stock/items?limit=100')).find(
        (i) => idOf(i.supply) === supply.id && idOf(i.location) === locationId,
      );
      if (!item) {
        console.log(`  ! sin ítem de stock de ${name} en ${locationName}`);
        continue;
      }
      if (Number(item.currentQty) > 0) {
        stats.existing += 1;
        continue;
      }
      if (DRY_RUN) {
        console.log(`  + stock ${name}  POST /items/${item.id}/adjust {"value":${qty}}`);
        continue;
      }
      try {
        await request('POST', `/items/${item.id}/adjust`, { type: 'absolute', value: qty, reason: 'Inventario inicial (demo)' });
        stats.created += 1;
        console.log(`  + stock ${name} en ${locationName}: ${qty}`);
      } catch (err) {
        stats.failed += 1;
        console.log(`  ! stock ${name}: ${err.message}`);
      }
    }
    return ctx;
  },

  async purchasing(ctx) {
    console.log('\nCompras: órdenes de compra');
    const [suppliers, products, locations, orders] = await Promise.all([
      existing('/v1/inventory/suppliers?limit=100'),
      existing('/products?limit=100'),
      existing('/v1/raw-material-stock/locations?limit=100'),
      existing('/v1/purchase-orders?limit=100'),
    ]);
    const mainStorage = locations.find((l) => l.isMainStorage)?.id ?? locations[0]?.id;
    const PURCHASES = [
      ['Distribuidora Andes', 'DRAFT', [['Limonada menta jengibre', 24, 900], ['Pisco sour', 12, 1800]]],
      ['Carnes Patagonia', 'SENT', [['Burger X7', 40, 2600], ['Lomo a lo pobre', 20, 5200]]],
    ];
    for (const [supplierName, status, items] of PURCHASES) {
      const supplierId = suppliers.find(byName(supplierName))?.id;
      if (!supplierId) continue;
      const found = orders.find((o) => idOf(o.supplierId ?? o.supplier) === supplierId);
      if (found) {
        stats.existing += 1;
        console.log(`  = orden de compra ${supplierName} (ya existe, id ${found.id})`);
        continue;
      }
      const totalAmount = items.reduce((sum, [, qty, price]) => sum + qty * price, 0);
      const po = await ensure(`orden de compra ${supplierName} (${status})`, '/v1/purchase-orders?limit=1', () => false, '/v1/purchase-orders', {
        supplierId,
        status,
        totalAmount,
      });
      if (!po || po.id < 0) continue;
      for (const [productName, quantity, unitPrice] of items) {
        const productId = products.find(byName(productName))?.id;
        if (!productId) continue;
        await ensure(`  ${quantity}x ${productName}`, '/purchase-order-item?limit=1', () => false, '/purchase-order-item', {
          purchaseOrderId: po.id,
          productId,
          quantity,
          unitPrice,
          locationId: mainStorage,
        });
      }
    }
    return ctx;
  },

  async payables(ctx) {
    console.log('\nCuentas por pagar: facturas, pagos, asignaciones y nota de crédito');
    const company_id = await companyId();
    const [suppliers, products] = await Promise.all([existing('/v1/inventory/suppliers?limit=100'), existing('/products?limit=100')]);
    const supplier = (name) => suppliers.find(byName(name))?.id;
    const product = (name) => products.find(byName(name));
    // [número, proveedor, emisión (días), vencimiento (días), ítems, estado]
    const INVOICES = [
      ['F-1001', 'Carnes Patagonia', -20, 10, [['Burger X7', 40, 2600], ['Lomo a lo pobre', 20, 5200]], 'paid'],
      ['F-1002', 'Distribuidora Andes', -12, 18, [['Pisco sour', 12, 1800], ['Limonada menta jengibre', 24, 900]], 'partially_paid'],
      ['F-1003', 'Verduras del Valle', -5, 25, [['Ceviche mixto', 15, 2900]], 'pending'],
    ];
    const invoices = await existing('/supplier-invoices?limit=100');
    for (const [invoice_number, supplierName, issued, due, items, status] of INVOICES) {
      const subtotal = items.reduce((sum, [, qty, price]) => sum + qty * price, 0);
      const tax_total = Math.round(subtotal * 0.19);
      const total_amount = subtotal + tax_total;
      const paid_amount = status === 'paid' ? total_amount : status === 'partially_paid' ? Math.round(total_amount / 2) : 0;
      const found = invoices.find((i) => i.invoice_number === invoice_number);
      if (found) {
        stats.existing += 1;
        console.log(`  = factura ${invoice_number} (ya existe, id ${found.id})`);
      }
      const invoice =
        found ??
        (await ensure(`factura ${invoice_number} ${supplierName} (${status})`, '/supplier-invoices?limit=1', () => false, '/supplier-invoices', {
          company_id,
          supplier_id: supplier(supplierName),
          invoice_number,
          invoice_date: day(issued),
          due_date: day(due),
          subtotal,
          tax_total,
          total_amount,
          paid_amount,
          balance_due: total_amount - paid_amount,
          status,
        }));
      if (!invoice || invoice.id < 0) continue;
      const invoiceItems = await existing(`/supplier-invoice-items?invoice_id=${invoice.id}&limit=100`);
      for (const [productName, quantity, unit_price] of items) {
        const p = product(productName);
        if (!p) continue;
        if (invoiceItems.some((i) => idOf(i.invoice_id ?? i.invoice) === invoice.id && i.description === productName)) {
          stats.existing += 1;
          continue;
        }
        const line_subtotal = quantity * unit_price;
        const tax_amount = Math.round(line_subtotal * 0.19);
        await ensure(`  ${quantity}x ${productName}`, '/supplier-invoice-items?limit=1', () => false, '/supplier-invoice-items', {
          // Sin product_id: enlazar con inventario exige también variant_id y los productos
          // demo no tienen variantes (salvo la burger). La línea queda solo descrita.
          invoice_id: invoice.id,
          description: productName,
          quantity,
          unit_price,
          line_subtotal,
          tax_amount,
          line_total: line_subtotal + tax_amount,
        });
      }
      if (paid_amount > 0) {
        const payment_number = `P-${invoice_number.slice(2)}`;
        const payment = await ensure(`  pago ${payment_number}`, '/supplier-payments?limit=100', (p) => p.payment_number === payment_number, '/supplier-payments', {
          company_id,
          supplier_id: supplier(supplierName),
          payment_number,
          payment_date: day(issued + 3),
          payment_method: 'transfer',
          reference: `Transferencia ${payment_number}`,
          total_amount: paid_amount,
          status: 'posted',
        });
        if (!payment || payment.id < 0) continue;
        const forPayment = (r) => idOf(r.payment_id ?? r.payment) === payment.id && r.document_number === invoice_number;
        // Un pago ya contabilizado (posted) no admite ítems nuevos.
        if (payment.status === 'draft') {
          await ensure(`  ítem de pago ${invoice_number}`, '/supplier-payment-items?limit=100', forPayment, '/supplier-payment-items', {
            payment_id: payment.id,
            document_type: 'invoice',
            document_number: invoice_number,
            amount: paid_amount,
          });
        }
        await ensure(`  asignación ${payment_number} → ${invoice_number}`, '/supplier-payment-allocations?limit=100', forPayment, '/supplier-payment-allocations', {
          payment_id: payment.id,
          supplier_id: supplier(supplierName),
          document_type: 'invoice',
          document_number: invoice_number,
          allocated_amount: paid_amount,
        });
      }
    }
    await ensure('nota de crédito NC-201 Distribuidora Andes', '/supplier-credit-notes?limit=100', (n) => n.credit_note_number === 'NC-201', '/supplier-credit-notes', {
      company_id,
      supplier_id: supplier('Distribuidora Andes'),
      credit_note_number: 'NC-201',
      issue_date: day(-8),
      total_amount: 15000,
      applied_amount: 0,
      status: 'issued',
    });
    return ctx;
  },

  async accounting(ctx) {
    console.log('\nContabilidad: asientos');
    const accounts = await existing('/ledger-accounts?limit=100');
    const account = (code) => accounts.find((a) => String(a.code) === code)?.id;
    const ENTRIES = [
      ['AS-0001', -7, 'POSTED', [['1100', 250000, 0], ['4100', 0, 210084], ['2200', 0, 39916]]],
      ['AS-0002', -5, 'POSTED', [['5100', 280000, 0], ['2200', 53200, 0], ['2100', 0, 333200]]],
      ['AS-0003', -1, 'DRAFT', [['5200', 450000, 0], ['1200', 0, 450000]]],
    ];
    for (const [entry_number, offset, status, lines] of ENTRIES) {
      await ensure(`asiento ${entry_number} (${status})`, '/journal-entry?limit=100', (e) => e.entry_number === entry_number, '/journal-entry', {
        entry_number,
        entry_date: day(offset),
        status,
        lines: lines.map(([code, debit, credit]) => ({ account_id: account(code), debit, credit })),
      });
    }
    return ctx;
  },

  async timeentries(ctx) {
    console.log('\nAsistencia: marcas de los últimos 3 días');
    const company_id = await companyId();
    const [collaborators, entries] = await Promise.all([existing('/collaborators?limit=100'), existing('/collaborator-time-entries?limit=100')]);
    const staff = collaborators.filter((c) => c.name !== 'Admin Demo');
    for (let offset = -3; offset <= -1; offset += 1) {
      for (const [i, c] of staff.entries()) {
        // Turno de almuerzo para la mitad, de cena para el resto; uno con horas extra.
        const lunch = i % 2 === 0;
        const clock_in = at(offset, lunch ? 11 : 18);
        const extra = i === 0 ? 2 : 0;
        const clock_out = at(offset, (lunch ? 17 : 24) + extra);
        const found = entries.find((e) => idOf(e.collaborator_id ?? e.collaborator) === c.id && new Date(e.clock_in).getTime() === new Date(clock_in).getTime());
        if (found) {
          stats.existing += 1;
          continue;
        }
        await ensure(`marca ${c.name} día ${offset}`, '/collaborator-time-entries?limit=1', () => false, '/collaborator-time-entries', {
          company_id,
          merchant_id: merchantId,
          collaborator_id: c.id,
          clock_in,
          clock_out,
          regular_hours: 6,
          overtime_hours: extra,
          break_minutes: 30,
          approved: offset < -1,
        });
      }
    }
    return ctx;
  },

  async payroll(ctx) {
    console.log('\nRemuneraciones: liquidación de la quincena anterior');
    const company_id = await companyId();
    // El backend guarda las columnas `date` un día antes (desfase UTC/Chile), así que el período
    // existente se busca con un día de margen.
    const period_start = day(-15);
    const period_end = day(-1);
    const run = await ensure(`período ${period_start} a ${period_end}`, '/payroll-runs?limit=100', (r) => Math.abs(Date.parse(r.period_start) - Date.parse(period_start)) <= 86_400_000, '/payroll-runs', {
      company_id,
      merchant_id: merchantId,
      period_start,
      period_end,
      status: 'draft',
    });
    if (!run || run.id < 0) return ctx;
    const [collaborators, entries] = await Promise.all([existing('/collaborators?limit=100'), existing('/payroll-entries?limit=100')]);
    const BASE = { waiter: 320000, cook: 380000, bartender: 340000, host: 300000, cashier: 310000, manager: 520000 };
    for (const c of collaborators.filter((x) => x.name !== 'Admin Demo')) {
      if (entries.some((e) => idOf(e.payroll_run_id ?? e.payrollRun) === run.id && idOf(e.collaborator_id ?? e.collaborator) === c.id)) {
        stats.existing += 1;
        continue;
      }
      const base_pay = BASE[c.role] ?? 300000;
      const tips_amount = c.role === 'waiter' || c.role === 'bartender' ? 45000 : 0;
      const gross_total = base_pay + tips_amount;
      const tax_total = Math.round(gross_total * 0.07);
      await ensure(`  liquidación ${c.name}`, '/payroll-entries?limit=1', () => false, '/payroll-entries', {
        payroll_run_id: run.id,
        collaborator_id: c.id,
        base_pay,
        overtime_pay: 0,
        tips_amount,
        bonuses: 0,
        deductions: 0,
        gross_total,
        tax_total,
        net_total: gross_total - tax_total,
      });
    }
    return ctx;
  },

  async onlineorders(ctx) {
    console.log('\nPedidos online');
    const [stores, customers, products, orders] = await Promise.all([
      existing('/online-stores?limit=100'),
      existing('/customers?limit=100'),
      existing('/products?limit=100'),
      existing('/online-orders?limit=100'),
    ]);
    const store = stores.find((s) => s.subdomain === 'x7demo-bistro');
    if (!store) {
      console.log('  (sin tienda: ejecuta también el área "online")');
      return ctx;
    }
    const ONLINE = [
      ['WEB-001', 'felipe.araya@cliente.demo', 'paid', [['Burger X7', 2], ['Limonada menta jengibre', 2]]],
      ['WEB-002', 'daniela.contreras@cliente.demo', 'pending', [['Risotto de hongos', 1], ['Leche asada', 1]]],
    ];
    for (const [ref, email, paymentStatus, items] of ONLINE) {
      const notes = `Pedido ${ref}`;
      const found = orders.find((o) => o.notes === notes);
      if (found) {
        stats.existing += 1;
        console.log(`  = pedido online ${ref} (ya existe, id ${found.id})`);
        continue;
      }
      const order = await ensure(`pedido online ${ref} (${paymentStatus})`, '/online-orders?limit=1', () => false, '/online-orders', {
        storeId: store.id,
        customerId: customers.find((c) => c.email === email)?.id,
        type: ref === 'WEB-001' ? 'delivery' : 'pickup',
        paymentStatus,
        placedAt: new Date().toISOString(),
        notes,
      });
      if (!order || order.id < 0) continue;
      for (const [name, quantity] of items) {
        const productId = products.find(byName(name))?.id;
        if (!productId) continue;
        await ensure(`  ${quantity}x ${name}`, '/online-order-items?limit=1', () => false, '/online-order-items', {
          onlineOrderId: order.id,
          productId,
          quantity,
        });
      }
    }
    return ctx;
  },

  async deliveryorders(ctx) {
    console.log('\nDelivery: un pedido a domicilio asignado a un repartidor');
    const active = unwrapItem(await request('GET', '/cash-shifts/active').catch(() => null));
    const openerId = idOf(active?.openedByCollaborator ?? active?.openedBy);
    const [subscriptions, tables, customers, zones, drivers, products, orders] = await Promise.all([
      existing('/merchant-subscription?limit=100'),
      existing('/tables?limit=100'),
      existing('/customers?limit=100'),
      existing('/delivery-zone?limit=100'),
      existing('/delivery-driver?limit=100'),
      existing('/products?limit=100'),
      existing('/orders?limit=100'),
    ]);
    const subscription = subscriptions.find((s) => idOf(s.merchantId ?? s.merchant) === merchantId && s.status === 'active');
    const zone = zones.find(byName('Providencia'));
    const customer = customers.find((c) => c.email === 'andrea.fuentes@cliente.demo');
    const driver = drivers.find(byName('Pedro Castillo'));
    if (!openerId || !subscription || !zone || !customer || !driver) {
      console.log('  (faltan turno de caja, suscripción, zona, cliente o repartidor: ejecuta cash, sales, delivery y customers)');
      return ctx;
    }
    const deliveryAddress = 'Av. Nueva Providencia 2155, depto 801';
    let order = orders.find((o) => o.deliveryAddress === deliveryAddress || o.delivery_address === deliveryAddress);
    if (order) {
      stats.existing += 1;
      console.log(`  = pedido a domicilio (ya existe, id ${order.id})`);
    } else {
      order = await ensure('pedido a domicilio', '/orders?limit=1', () => false, '/orders', {
        merchantId,
        // El DTO exige mesa aunque sea delivery: se usa la barra.
        tableId: tables.find((t) => String(t.number) === 'B1')?.id,
        collaboratorId: openerId,
        subscriptionId: subscription.id,
        customerId: customer.id,
        businessStatus: 'pending',
        source: 'delivery',
        type: 'delivery',
        guestCount: 1,
        deliveryAddress,
        deliveryZoneId: zone.id,
        deliveryFee: 1990,
      });
      if (!order || order.id < 0) return ctx;
      for (const [name, quantity] of [['Burger X7', 1], ['Pisco sour', 1]]) {
        const p = products.find(byName(name));
        if (!p) continue;
        await ensure(`  ${quantity}x ${name}`, '/order-item?limit=1', () => false, '/order-item', {
          orderId: order.id,
          productId: p.id,
          quantity,
          price: Number(p.basePrice),
        });
      }
    }
    await ensure(`asignación a ${driver.name}`, '/delivery-assignment?limit=100', (a) => idOf(a.order ?? a.order_id ?? a.orderId) === order.id, '/delivery-assignment', {
      order: order.id,
      deliveryDriver: driver.id,
      status: 'active',
    });
    return ctx;
  },

  // ---- Fase 4 ----

  async rules(ctx) {
    console.log('\nReglas del comercio: remuneraciones, horas extra y propinas');
    await ensure('regla de remuneración mensual', '/merchant-payroll-rule?limit=100', byName('Remuneración mensual'), '/merchant-payroll-rule', {
      name: 'Remuneración mensual',
      frequencyPayroll: 'monthly',
      payDayOfMonth: 30,
      allowNegativePayroll: false,
      roundingPrecision: 0,
      currency: 'CLP',
      autoApprovePayroll: false,
      requiresManagerApproval: true,
    });
    for (const [name, description, calculationMethod, thresholdHours, maxHours, rateValue, appliesOnWeekends, priority] of [
      ['Horas extra diarias', 'Recargo de 50% sobre 9 horas diarias', 'daily', 9, 12, 150, true, 1],
      ['Horas extra en feriado', 'Recargo de 100% en días feriados', 'holiday', null, null, 200, false, 2],
    ]) {
      await ensure(`regla ${name}`, '/merchant-overtime-rule?limit=100', byName(name), '/merchant-overtime-rule', {
        name,
        description,
        calculationMethod,
        thresholdHours,
        maxHours,
        rateMethod: 'percentage',
        rateValue,
        appliesOnHolidays: true,
        appliesOnWeekends,
        priority,
      });
    }
    // Con tipCalculationMethod 'percentage' el backend exige que los porcentajes sugeridos sumen
    // 1, lo que no permite ofrecer 10% / 15%: se usa 'custom', que no los valida.
    await ensure('regla de propinas Propina sugerida', '/merchant-tip-rule?limit=100', byName('Propina sugerida'), '/merchant-tip-rule', {
      name: 'Propina sugerida',
      tipCalculationMethod: 'custom',
      tipDistributionMethod: 'role_based',
      suggestedPercentages: [0.1, 0.15],
      fixedAmountOptions: [1000, 2000, 5000],
      allowCustomTip: true,
      maximumTipPercentage: 30,
      autoDistribute: false,
      staffPercentage: 0.7,
      kitchenPercentage: 0.2,
      managerPercentage: 0.1,
    });
    return ctx;
  },

  async contracts(ctx) {
    console.log('\nContratos de los colaboradores');
    const company_id = await companyId();
    const [collaborators, contracts] = await Promise.all([existing('/collaborators?limit=100'), existing('/collaborator-contracts?limit=100')]);
    // Sueldo base mensual de los contratos por sueldo; los part-time cobran por hora.
    const CONTRACTS = {
      waiter: ['hourly', 'part_time', 'hourly', 0, 4200, 30],
      host: ['hourly', 'part_time', 'hourly', 0, 4000, 30],
      bartender: ['mixed', 'full_time', 'monthly', 450000, 3500, 45],
      cook: ['salary', 'full_time', 'monthly', 750000, 0, 45],
      cashier: ['salary', 'full_time', 'monthly', 620000, 0, 45],
      manager: ['salary', 'full_time', 'monthly', 1400000, 0, 45],
    };
    for (const c of collaborators) {
      if (contracts.some((k) => idOf(k.collaborator_id ?? k.collaborator) === c.id)) {
        stats.existing += 1;
        continue;
      }
      const [contract_type, employment_type, pay_frequency, base_salary, hourly_rate, working_hours_per_week] = CONTRACTS[c.role] ?? CONTRACTS.waiter;
      await ensure(`contrato ${c.name} (${contract_type})`, '/collaborator-contracts?limit=1', () => false, '/collaborator-contracts', {
        company_id,
        merchant_id: merchantId,
        collaborator_id: c.id,
        contract_type,
        employment_type,
        pay_frequency,
        base_salary,
        hourly_rate,
        wage_rate: hourly_rate,
        working_hours_per_week,
        overtime_multiplier: 1.5,
        double_overtime_multiplier: 2,
        tips_included_in_payroll: c.role === 'waiter' || c.role === 'bartender',
        start_date: day(-180),
        active: true,
      });
    }
    return ctx;
  },

  async cashtransactions(ctx) {
    console.log('\nCaja: ventas, propina y retiro del turno abierto');
    const activeShift = unwrapItem(await request('GET', '/cash-shifts/active').catch(() => null));
    const cashDrawerId = idOf(activeShift?.cashDrawerId ?? activeShift?.cashDrawer);
    const collaboratorId = idOf(activeShift?.openedByCollaborator ?? activeShift?.openedBy);
    if (!cashDrawerId || !collaboratorId) {
      console.log('  ! sin turno de caja abierto: ejecuta también el área "cash"');
      return ctx;
    }
    const [orders, orderItems, transactions] = await Promise.all([
      existing('/orders?limit=100'),
      existing('/order-item?limit=100'),
      existing('/cash-transactions?limit=100'),
    ]);
    const total = (order) =>
      orderItems
        .filter((i) => idOf(i.orderId ?? i.order_id ?? i.order) === order.id)
        .reduce((sum, i) => sum + Number(i.quantity) * Number(i.price), 0);
    // Se marcan por la nota para no repetirlas: el listado no trae otra clave natural.
    const MOVES = orders
      .filter((o) => o.source === 'pos' && total(o) > 0)
      .map((o) => ['sale', total(o), `Venta pedido #${o.id} (demo)`, o.id]);
    MOVES.push(['tip', 3500, 'Propina en efectivo (demo)'], ['withdrawal', 20000, 'Retiro a caja fuerte (demo)']);
    for (const [type, amount, notes, orderId] of MOVES) {
      await ensure(`${type} ${amount}`, '/cash-transactions?limit=1', () => false, '/cash-transactions', {
        cashDrawerId,
        orderId,
        type,
        amount,
        collaboratorId,
        notes,
      }, transactions.find((t) => t.notes === notes));
    }
    return ctx;
  },

  async tipdistribution(ctx) {
    console.log('\nPropinas: propinas de los pedidos, reparto, liquidación y miembros del pozo');
    const company = await companyId();
    const [orders, shifts, assignments, pools, collaborators] = await Promise.all([
      existing('/orders?limit=100'),
      existing('/shifts?limit=100'),
      existing('/shift-assignments?limit=100'),
      existing('/tip-pools?limit=100'),
      existing('/collaborators?limit=100'),
    ]);
    const shift = shifts.find((s) => new Date(s.startTime ?? s.start_time).getTime() === new Date(at(0, 11)).getTime());
    if (!shift) {
      console.log('  (sin turno de hoy: ejecuta también el área "shifts")');
      return ctx;
    }
    // Personal asignado al almuerzo de hoy (mesero, cocinero y bartender).
    const crew = assignments
      .filter((a) => idOf(a.shiftId ?? a.shift) === shift.id)
      .map((a) => collaborators.find((c) => c.id === idOf(a.collaboratorId ?? a.collaborator)))
      .filter(Boolean);
    const waiter = crew.find((c) => c.role === 'waiter');
    const bartender = crew.find((c) => c.role === 'bartender');

    const pool = pools.find((p) => idOf(p.shiftId ?? p.shift) === shift.id);
    if (pool) {
      const members = await existing('/tip-pool-members?limit=100');
      for (const c of crew) {
        const weight = { waiter: 2, bartender: 1.5, cook: 1 }[c.role] ?? 1;
        await ensure(`miembro del pozo ${c.name}`, '/tip-pool-members?limit=1', () => false, '/tip-pool-members', {
          tipPoolId: pool.id,
          collaboratorId: c.id,
          role: c.role,
          weight,
        }, members.find((m) => idOf(m.tipPoolId ?? m.tipPool) === pool.id && idOf(m.collaboratorId ?? m.collaborator) === c.id));
      }
    } else {
      console.log('  (sin pozo de propinas de hoy: ejecuta también el área "tips")');
    }

    // Una propina por pedido de mesa: con tarjeta (repartida), en efectivo (liquidada) y online
    // (pendiente), para que se vea cada estado.
    const orderItems = await existing('/order-item?limit=100');
    const total = (order) =>
      orderItems.filter((i) => idOf(i.orderId ?? i.order_id ?? i.order) === order.id).reduce((sum, i) => sum + Number(i.quantity) * Number(i.price), 0);
    const tipped = orders.filter((o) => o.source === 'pos' && total(o) > 0);
    const TIPS = [
      ['card', 0.1, 'allocated'],
      ['cash', 0.1, 'settled'],
      ['online', 0.15, 'pending'],
    ];
    const tips = await existing('/tips?limit=100');
    const [allocations, settlements, cashTipMovements] = await Promise.all([
      existing('/tip-allocations?limit=100'),
      existing('/tip-settlements?limit=100'),
      existing('/cash-tip-movements?limit=100'),
    ]);
    const activeShift = unwrapItem(await request('GET', '/cash-shifts/active').catch(() => null));
    const cashDrawerId = idOf(activeShift?.cashDrawerId ?? activeShift?.cashDrawer);
    for (const [i, order] of tipped.slice(0, TIPS.length).entries()) {
      const [method, rate, status] = TIPS[i];
      const amount = Math.round(total(order) * rate);
      const tip = await ensure(`propina ${method} pedido #${order.id}: ${amount}`, '/tips?limit=1', () => false, '/tips', {
        companyId: company,
        merchantId,
        orderId: order.id,
        amount,
        method,
        status,
      }, tips.find((t) => idOf(t.orderId ?? t.order) === order.id));
      if (!tip || tip.id < 0 || status === 'pending') continue;

      // Reparto 70/30 entre el mesero y el bartender del turno.
      for (const [collaborator, role, percentage] of [[waiter, 'waiter', 70], [bartender, 'bartender', 30]]) {
        if (!collaborator) continue;
        await ensure(`  reparto ${percentage}% a ${collaborator.name}`, '/tip-allocations?limit=1', () => false, '/tip-allocations', {
          tipId: tip.id,
          collaboratorId: collaborator.id,
          shiftId: shift.id,
          role,
          percentage,
          amount: Math.round((amount * percentage) / 100),
        }, allocations.find((a) => idOf(a.tipId ?? a.tip) === tip.id && idOf(a.collaboratorId ?? a.collaborator) === collaborator.id));
      }
      if (method === 'cash' && cashDrawerId) {
        await ensure(`  entrada de propina a caja`, '/cash-tip-movements?limit=1', () => false, '/cash-tip-movements', {
          cashDrawerId,
          tipId: tip.id,
          movementType: 'in',
          amount,
        }, cashTipMovements.find((m) => idOf(m.tipId ?? m.tip) === tip.id));
      }
      if (status === 'settled' && waiter) {
        await ensure(`  liquidación a ${waiter.name}`, '/tip-settlements?limit=1', () => false, '/tip-settlements', {
          collaboratorId: waiter.id,
          shiftId: shift.id,
          totalAmount: Math.round(amount * 0.7),
          settlementMethod: 'cash',
          settledBy: adminUserId,
        }, settlements.find((s) => idOf(s.collaboratorId ?? s.collaborator) === waiter.id && idOf(s.shiftId ?? s.shift) === shift.id));
      }
    }
    return ctx;
  },

  async recipes(ctx) {
    console.log('\nRecetas: insumos por plato');
    const [products, supplies, recipes] = await Promise.all([
      existing('/products?limit=100'),
      existing('/v1/inventory/raw-materials?limit=100'),
      existing('/v1/recipes?limit=100'),
    ]);
    const RECIPES = [
      ['Burger X7', [['Carne molida vacuno', 180], ['Queso cheddar', 40]]],
      ['Lomo a lo pobre', [['Lomo vetado', 250]]],
      ['Risotto de hongos', [['Arroz arbóreo', 120], ['Leche entera', 80]]],
      ['Leche asada', [['Leche entera', 150]]],
      ['Limonada menta jengibre', [['Limón', 2]]],
      ['Pisco sour', [['Limón', 1]]],
    ];
    for (const [productName, lines] of RECIPES) {
      const product = products.find(byName(productName));
      if (!product) continue;
      const recipeLines = lines
        .map(([name, quantity]) => {
          const supply = supplies.find(byName(name));
          return supply && { raw_material_id: supply.id, quantity, unit_of_measure: supply.consumption_unit ?? supply.unit };
        })
        .filter(Boolean);
      if (recipeLines.length === 0) {
        console.log(`  ! receta ${productName}: faltan insumos (ejecuta "supplies")`);
        continue;
      }
      await ensure(`receta ${productName}`, '/v1/recipes?limit=1', () => false, '/v1/recipes', {
        productId: product.id,
        name: productName,
        yieldQuantity: 1,
        isActive: true,
        lines: recipeLines,
      }, recipes.find((r) => idOf(r.finishedProductId ?? r.finishedProduct) === product.id));
    }
    return ctx;
  },

  async movements(ctx) {
    console.log('\nInventario: merma y traspaso entre bodegas');
    // El inventario inicial ya deja un movimiento de entrada por insumo (área "supplies").
    const [items, locations, movements] = await Promise.all([
      existing('/v1/raw-material-stock/items?limit=100'),
      existing('/v1/raw-material-stock/locations?limit=100'),
      existing('/v1/raw-material-stock/movements?limit=100'),
    ]);
    const item = (supplyName) => items.find((i) => (i.supply?.name ?? '') === supplyName && Number(i.currentQty) > 0);
    const cold = locations.find(byName('Cámara de frío'));
    const MOVES = [
      ['DEMO-MERMA-01', 'Limón', 12, 'OUT', 'WASTE', 'Merma: limones en mal estado'],
      ['DEMO-MERMA-02', 'Leche entera', 1000, 'OUT', 'WASTE', 'Merma: leche vencida'],
      ['DEMO-TRASP-01', 'Arroz arbóreo', 2000, 'TRANSFER', 'TRANSFER', 'Traspaso a cámara de frío para la línea'],
    ];
    for (const [reference, supplyName, quantity, type, movementType, reason] of MOVES) {
      const stockItem = item(supplyName);
      if (!stockItem) {
        console.log(`  ! ${reference}: sin stock de ${supplyName} (ejecuta "supplies")`);
        continue;
      }
      await ensure(`${reference} ${supplyName} ${quantity}`, '/v1/raw-material-stock/movements?limit=1', () => false, '/v1/raw-material-stock/movements', {
        stockItemId: stockItem.id,
        quantity,
        type,
        movementType,
        reason,
        reference,
        sourceLocationId: idOf(stockItem.location),
        ...(type === 'TRANSFER' && cold ? { destinationLocationId: cold.id } : {}),
      }, movements.find((m) => m.reference === reference));
    }
    return ctx;
  },

  async tableassignments(ctx) {
    console.log('\nSalón: mesas asignadas a los meseros en el turno en curso');
    const [tables, shifts, collaborators, current] = await Promise.all([
      existing('/tables?limit=100'),
      existing('/shifts?limit=100'),
      existing('/collaborators?limit=100'),
      existing('/table-assignments?limit=100'),
    ]);
    const waiters = collaborators.filter((c) => c.role === 'waiter');
    const dining = tables.filter((t) => /^T\d+$/.test(String(t.number))).sort((a, b) => String(a.number).localeCompare(String(b.number), undefined, { numeric: true }));
    // El backend admite una sola asignación abierta (sin releasedAt) por mesa y la fecha de
    // asignación es siempre "ahora": se asigna el almuerzo de hoy o, pasadas las 17:00, la cena.
    const hour = new Date().getHours() < 17 ? 11 : 18;
    const shift = shifts.find((s) => new Date(s.startTime ?? s.start_time).getTime() === new Date(at(0, hour)).getTime());
    if (!shift || waiters.length === 0) {
      console.log('  (sin turno de hoy o sin meseros: ejecuta también "staff" y "shifts")');
      return ctx;
    }
    // El salón se divide en dos, una mitad por mesero.
    for (const [i, table] of dining.entries()) {
      const waiter = waiters[Math.floor((i * waiters.length) / dining.length)];
      await ensure(`mesa ${table.number} → ${waiter.name} (${hour}:00)`, '/table-assignments?limit=1', () => false, '/table-assignments', {
        shiftId: shift.id,
        tableId: table.id,
        collaboratorId: waiter.id,
        status: 'active',
      }, current.find((a) => idOf(a.tableId ?? a.table) === table.id && !(a.releasedAt ?? a.released_at)));
    }
    return ctx;
  },

  async kdsdevices(ctx) {
    console.log('\nCocina: una pantalla KDS por estación');
    const stations = await existing('/kitchen-station?limit=100');
    for (const [i, station] of stations.entries()) {
      const deviceIdentifier = `DEMO-KDS-${String(station.stationType ?? station.name).toUpperCase()}`;
      await ensure(`pantalla ${station.name}`, '/kitchen-display-devices?limit=100', (d) => d.deviceIdentifier === deviceIdentifier, '/kitchen-display-devices', {
        stationId: station.id,
        name: `Pantalla ${station.name}`,
        deviceIdentifier,
        ipAddress: `192.168.1.${101 + i}`,
        isOnline: true,
        lastSync: new Date().toISOString(),
        status: 'active',
      });
    }
    return ctx;
  },
};

// ---------------------------------------------------------------------------------------------

async function main() {
  console.log(`API: ${API}${DRY_RUN ? '   [DRY RUN: no se escribe nada]' : ''}`);
  await session();
  let ctx = {};
  for (const [name, run] of Object.entries(AREAS)) {
    if (ONLY && !ONLY.includes(name)) continue;
    ctx = await run(ctx);
  }
  console.log(`\nListo: ${stats.created} creados, ${stats.existing} ya existían, ${stats.failed} fallidos.`);
  if (stats.failed > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error(`\nError: ${err.message}`);
  process.exit(1);
});
