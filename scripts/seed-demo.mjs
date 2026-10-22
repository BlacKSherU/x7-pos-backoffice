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
 * Devuelve el registro (o uno simulado con id negativo en --dry-run).
 */
async function ensure(label, listPath, match, createPath, body) {
  try {
    const existing = unwrapList(await list(listPath)).find(match);
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
    const merchant = unwrapItem(await request('GET', `/merchants/${merchantId}`).catch(() => null));
    await ensure('pozo de propinas Almuerzo de hoy', '/tip-pools?limit=100', (p) => idOf(p.shiftId ?? p.shift) === shift.id, '/tip-pools', {
      companyId: idOf(merchant?.companyId ?? merchant?.company),
      merchantId,
      shiftId: shift.id,
      name: 'Almuerzo de hoy',
      distributionType: 'equal',
      totalAmount: 0,
      status: 'open',
    });
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
