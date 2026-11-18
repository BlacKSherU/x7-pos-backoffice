#!/usr/bin/env node
// Levanta un entorno desechable y aislado para el E2E real de cobros, corre Playwright y
// lo apaga todo, pase lo que pase:
//   Postgres 17 en Docker (tmpfs, 127.0.0.1:54331) → migraciones + seed de referencia
//   gateway falso Stripe/CardPointe/Bolt (127.0.0.1:4599)
//   API NestJS compilada (127.0.0.1:3101) con PAYMENT_GATEWAY_SANDBOX_URL
//   Vite del backoffice (127.0.0.1:5273) contra esa API
// Al final revisa el log del backend: cualquier ERROR o aviso de deprecación hace fallar.
//
// Uso (Node 22): node e2e/real/payments/stack.mjs [--skip-build] [-- <args de playwright>]
import { spawn, spawnSync } from 'node:child_process';
import { createWriteStream, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const OFFICE = resolve(here, '../../..');
const BACKEND = resolve(OFFICE, process.env.E2E_BACKEND_DIR ?? '../x7-pos-back-end');
const OUT = resolve(OFFICE, 'test-results/payments-real');
const PG = { port: 54331, name: 'x7-pos-payments-ui-e2e', user: 'x7_e2e', password: 'x7_e2e', db: 'x7_payments_ui_e2e' };
const API_PORT = 3101;
const GATEWAY_PORT = 4599;
const WEB_PORT = 5273;
const TIME_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;
const args = process.argv.slice(2);
const skipBuild = args.includes('--skip-build');
const playwrightArgs = args.includes('--') ? args.slice(args.indexOf('--') + 1) : [];

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const children = [];
const log = (msg) => console.log(`\x1b[36m[payments-e2e]\x1b[0m ${msg}`);

function run(cmd, cmdArgs, opts = {}) {
  const res = spawnSync(cmd, cmdArgs, { stdio: 'inherit', ...opts });
  if (res.status !== 0) throw new Error(`${cmd} ${cmdArgs.join(' ')} exited with ${res.status}`);
}

function start(name, cmd, cmdArgs, opts) {
  const file = createWriteStream(join(OUT, `${name}.log`));
  const child = spawn(cmd, cmdArgs, { ...opts, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
  child.stdout.pipe(file);
  child.stderr.pipe(file);
  child.on('exit', (code) => code && code !== 0 && log(`${name} exited with ${code}`));
  children.push(child);
  return child;
}

async function waitFor(url, label, timeoutMs = 120_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // aún no responde
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`${label} did not answer at ${url}`);
}

function teardown() {
  for (const child of children) {
    try {
      process.kill(-child.pid, 'SIGTERM');
    } catch {
      // ya terminó
    }
  }
  spawnSync('docker', ['rm', '-f', PG.name], { stdio: 'ignore' });
}

const dbEnv = {
  DB_HOST: '127.0.0.1',
  DB_PORT: String(PG.port),
  DB_USERNAME: PG.user,
  DB_PASSWORD: PG.password,
  DB_NAME: PG.db,
  DB_SSL: 'false',
};

let status = 1;
try {
  log(`Postgres (docker ${PG.name}) on 127.0.0.1:${PG.port}`);
  spawnSync('docker', ['rm', '-f', PG.name], { stdio: 'ignore' });
  run('docker', [
    'run', '-d', '--rm', '--name', PG.name,
    '-e', `POSTGRES_USER=${PG.user}`, '-e', `POSTGRES_PASSWORD=${PG.password}`, '-e', `POSTGRES_DB=${PG.db}`,
    // Misma zona horaria que Node: las columnas son timestamp sin zona, y now() de la base y
    // new Date() del backend deben coincidir (como en una instalación local normal)
    '-e', `TZ=${TIME_ZONE}`, '-e', `PGTZ=${TIME_ZONE}`,
    '-p', `127.0.0.1:${PG.port}:5432`, '--tmpfs', '/var/lib/postgresql/data', 'postgres:17',
    '-c', `timezone=${TIME_ZONE}`,
  ], { stdio: 'ignore' });
  for (let i = 0; ; i++) {
    const ready = spawnSync('docker', ['exec', PG.name, 'pg_isready', '-U', PG.user, '-d', PG.db]);
    if (ready.status === 0) break;
    if (i > 60) throw new Error('Postgres did not start');
    await new Promise((r) => setTimeout(r, 1000));
  }
  // pg_isready responde antes de que termine el arranque inicial del contenedor
  await new Promise((r) => setTimeout(r, 2000));

  if (!skipBuild) {
    log('Building the backend');
    run('npm', ['run', 'build'], { cwd: BACKEND, stdio: 'ignore' });
  }
  log('Migrations + reference data');
  run('node', ['node_modules/typeorm/cli.js', 'migration:run', '-d', 'dist/database/data-source.js'], {
    cwd: BACKEND,
    env: { ...process.env, ...dbEnv },
    stdio: 'ignore',
  });
  run('node', ['dist/database/seed.js', 'reference'], { cwd: BACKEND, env: { ...process.env, ...dbEnv } });

  log(`Fake payment gateway on 127.0.0.1:${GATEWAY_PORT}`);
  start('fake-gateway', 'node', ['-r', 'ts-node/register', 'test/fake-payment-gateway/fake-gateway.ts', '--port', String(GATEWAY_PORT), '--log'], {
    cwd: BACKEND,
    env: { ...process.env, TS_NODE_TRANSPILE_ONLY: '1' },
  });

  log(`API on 127.0.0.1:${API_PORT}`);
  start('backend', 'node', ['--trace-deprecation', 'dist/main.js'], {
    cwd: BACKEND,
    env: {
      ...process.env,
      ...dbEnv,
      NODE_ENV: 'development',
      PORT: String(API_PORT),
      JWT_SECRET: 'payments-e2e-jwt-secret',
      JWT_REFRESH_SECRET: 'payments-e2e-jwt-refresh-secret',
      PAYMENT_CREDENTIALS_KEY: 'b'.repeat(64),
      PAYMENT_GATEWAY_SANDBOX_URL: `http://127.0.0.1:${GATEWAY_PORT}`,
      CORS_ORIGINS: `http://127.0.0.1:${WEB_PORT},http://localhost:${WEB_PORT}`,
      SMTP_HOST: '',
      WS_REDIS_ENABLED: 'false',
      DB_LOGGING: 'false',
    },
  });

  log(`Backoffice (Vite) on 127.0.0.1:${WEB_PORT}`);
  start('vite', 'npx', ['vite', '--port', String(WEB_PORT), '--strictPort', '--host', '127.0.0.1'], {
    cwd: OFFICE,
    env: { ...process.env, VITE_API_URL: `http://127.0.0.1:${API_PORT}/api`, VITE_WS_URL: `http://127.0.0.1:${API_PORT}` },
  });

  await waitFor(`http://127.0.0.1:${GATEWAY_PORT}/health`, 'fake gateway');
  await waitFor(`http://127.0.0.1:${API_PORT}/api/health`, 'API');
  await waitFor(`http://127.0.0.1:${WEB_PORT}/`, 'Vite');

  log('Playwright');
  const pw = spawnSync('npx', ['playwright', 'test', '-c', 'playwright.payments.config.ts', ...playwrightArgs], {
    cwd: OFFICE,
    stdio: 'inherit',
    env: {
      ...process.env,
      E2E_PAYMENTS_REAL: '1',
      E2E_BASE_URL: `http://127.0.0.1:${WEB_PORT}`,
      E2E_API: `http://127.0.0.1:${API_PORT}/api`,
      E2E_GATEWAY: `http://127.0.0.1:${GATEWAY_PORT}`,
      E2E_SHOTS: OUT,
    },
  });
  status = pw.status ?? 1;

  // Un backend sin errores: ningún ERROR de Nest ni aviso de deprecación durante la prueba
  const backendLog = readFileSync(join(OUT, 'backend.log'), 'utf8');
  const problems = backendLog
    .split('\n')
    .filter((line) => /\bERROR\b|DeprecationWarning|UnhandledPromiseRejection|Exception/.test(line));
  if (problems.length) {
    log(`Backend log has ${problems.length} problem line(s):`);
    for (const line of problems.slice(0, 40)) console.log(`  ${line}`);
    status = status || 2;
  } else {
    log('Backend log: no errors or deprecation warnings');
  }
} catch (err) {
  console.error(err);
  status = 1;
} finally {
  teardown();
}
process.exit(status);
