#!/usr/bin/env node
// Levanta un entorno desechable y aislado para el E2E real de Platform SaaS (historias 1-7:
// companies, merchants y users), corre Playwright y lo apaga todo, pase lo que pase:
//   Postgres 17 en Docker (tmpfs, 127.0.0.1:54351) → migraciones + seed de referencia +
//   portal_admin (seed:admin) + datos de la suite (e2e/real/saas/seed.sql)
//   API NestJS compilada (127.0.0.1:3111)
//   Vite del backoffice (127.0.0.1:5283) contra esa API
// Al final revisa el log del backend: cualquier ERROR o aviso de deprecación hace fallar.
// Nunca toca la base x7_pos_e2e, el backend :3001 ni el Vite :5173 de desarrollo.
//
// Uso (Node 22):
//   node e2e/real/saas/stack.mjs [--skip-build] [-- <args de playwright>]
//   node e2e/real/saas/stack.mjs --serve      deja el entorno arriba (Ctrl+C lo apaga)
import { spawn, spawnSync } from 'node:child_process';
import { createWriteStream, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const OFFICE = resolve(here, '../../..');
const BACKEND = resolve(OFFICE, process.env.E2E_BACKEND_DIR ?? '../x7-pos-back-end');
const OUT = resolve(OFFICE, 'test-results/saas-real');
const PG = { port: 54351, name: 'x7-pos-saas-ui-e2e', user: 'x7_e2e', password: 'x7_e2e', db: 'x7_saas_ui_e2e' };
const API_PORT = 3111;
const WEB_PORT = 5283;
const TIME_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;
const PORTAL_ADMIN = { email: 'owner@x7saas-e2e.com', password: 'E2eSaasOwner123!' };
const args = process.argv.slice(2);
const skipBuild = args.includes('--skip-build');
const serve = args.includes('--serve');
const playwrightArgs = args.includes('--') ? args.slice(args.indexOf('--') + 1) : [];

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const children = [];
const log = (msg) => console.log(`\x1b[36m[saas-e2e]\x1b[0m ${msg}`);

function run(cmd, cmdArgs, opts = {}) {
  const res = spawnSync(cmd, cmdArgs, { stdio: 'inherit', ...opts });
  if (res.status !== 0) throw new Error(`${cmd} ${cmdArgs.join(' ')} exited with ${res.status}`);
  return res;
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

let tornDown = false;
function teardown() {
  if (tornDown) return;
  tornDown = true;
  for (const child of children) {
    try {
      process.kill(-child.pid, 'SIGTERM');
    } catch {
      // ya terminó
    }
  }
  spawnSync('docker', ['rm', '-f', PG.name], { stdio: 'ignore' });
}
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(signal, () => {
    teardown();
    process.exit(130);
  });
}

/** Líneas del log del backend que hacen fallar la ejecución */
function backendProblems(text) {
  return text
    .split('\n')
    .filter((line) => /\bERROR\b|\bWARN\b.*[Dd]eprecat|DeprecationWarning|UnhandledPromiseRejection|Exception/.test(line));
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
    // Misma zona horaria que Node: las columnas son timestamp sin zona
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
  log('Migrations + reference data + portal_admin');
  run('node', ['node_modules/typeorm/cli.js', 'migration:run', '-d', 'dist/database/data-source.js'], {
    cwd: BACKEND,
    env: { ...process.env, ...dbEnv },
    stdio: 'ignore',
  });
  run('node', ['dist/database/seed.js', 'reference'], { cwd: BACKEND, env: { ...process.env, ...dbEnv } });
  run('node', ['dist/database/seed.js', 'admin'], {
    cwd: BACKEND,
    env: { ...process.env, ...dbEnv, SEED_ADMIN_EMAIL: PORTAL_ADMIN.email, SEED_ADMIN_PASSWORD: PORTAL_ADMIN.password },
  });

  log('Suite data (e2e/real/saas/seed.sql)');
  run('docker', ['exec', '-i', PG.name, 'psql', '-v', 'ON_ERROR_STOP=1', '-q', '-U', PG.user, '-d', PG.db], {
    input: readFileSync(join(here, 'seed.sql')),
    stdio: ['pipe', 'ignore', 'inherit'],
  });

  log(`API on 127.0.0.1:${API_PORT}`);
  start('backend', 'node', ['--trace-deprecation', 'dist/main.js'], {
    cwd: BACKEND,
    env: {
      ...process.env,
      ...dbEnv,
      NODE_ENV: 'development',
      PORT: String(API_PORT),
      JWT_SECRET: 'saas-e2e-jwt-secret',
      JWT_REFRESH_SECRET: 'saas-e2e-jwt-refresh-secret',
      PAYMENT_CREDENTIALS_KEY: 'c'.repeat(64),
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

  await waitFor(`http://127.0.0.1:${API_PORT}/api/health`, 'API');
  await waitFor(`http://127.0.0.1:${WEB_PORT}/`, 'Vite');

  const pwEnv = {
    ...process.env,
    E2E_SAAS_REAL: '1',
    E2E_BASE_URL: `http://127.0.0.1:${WEB_PORT}`,
    E2E_API: `http://127.0.0.1:${API_PORT}/api`,
    E2E_SHOTS: OUT,
    E2E_BACKEND_LOG: join(OUT, 'backend.log'),
  };

  if (serve) {
    log(`Serving. Run: E2E_SAAS_REAL=1 E2E_BASE_URL=${pwEnv.E2E_BASE_URL} E2E_API=${pwEnv.E2E_API} E2E_SHOTS=${OUT} npx playwright test -c playwright.saas.config.ts`);
    log('Ctrl+C (or SIGTERM) tears everything down.');
    await new Promise(() => {});
  }

  log('Playwright');
  const pw = spawnSync('npx', ['playwright', 'test', '-c', 'playwright.saas.config.ts', ...playwrightArgs], {
    cwd: OFFICE,
    stdio: 'inherit',
    env: pwEnv,
  });
  status = pw.status ?? 1;

  // Un backend sin errores: ningún ERROR de Nest ni aviso de deprecación durante la prueba
  const problems = backendProblems(readFileSync(join(OUT, 'backend.log'), 'utf8'));
  if (problems.length) {
    log(`Backend log has ${problems.length} problem line(s):`);
    for (const line of problems.slice(0, 40)) console.log(`  ${line}`);
    status = status || 2;
  } else {
    log('Backend log: 0 ERROR lines, 0 deprecation warnings');
  }

  // Un cambio de código fuente durante la prueba hace que Vite recargue la página o aplique HMR
  // en mitad de un clic (el clic se pierde sin error). Una ejecución así no vale como evidencia.
  const reloads = readFileSync(join(OUT, 'vite.log'), 'utf8')
    .split('\n')
    .filter((line) => /hmr update|page reload|full reload/i.test(line));
  if (reloads.length) {
    log(`Vite reloaded or hot-updated the app ${reloads.length} time(s) during the run (source files changed):`);
    for (const line of reloads.slice(0, 20)) console.log(`  ${line}`);
    status = status || 3;
  } else {
    log('Vite log: 0 HMR updates / page reloads during the run');
  }
} catch (err) {
  console.error(err);
  status = 1;
} finally {
  teardown();
}
process.exit(status);
