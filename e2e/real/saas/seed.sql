-- Datos de la suite E2E real de Platform SaaS (historias 1-7). Lo aplica stack.mjs sobre una
-- base desechable recién migrada, después del seed de referencia (planes 1 Essential,
-- 2 Professional, 3 Executive) y de seed:admin (company 1 "X7 POS Platform", merchant 1 y el
-- portal_admin, user 1). Ids fijos: saas-real.spec.ts compara los números de pantalla con esto.
--
-- Companies (5 en total: 3 activas, 1 suspendida, 1 inactiva)
--   1 X7 POS Platform     active     sin plan
--   2 Andes Bistro Group  active     Executive      4 merchants (Santiago x2, Valparaiso, Concepcion)
--   3 Coastal Eats LLC    active     Professional   1 merchant  (Miami)
--   4 Nordic Grill AB     suspended  Essential      1 merchant  (Stockholm)
--   5 Old Town Diner Co   inactive   (Essential vencido → sin plan vigente)
-- Merchants activos: 1, 2, 3, 6, 7 → 5
-- Users: 10 (activos 8)   Configurations: 4 (activas 3; 3 de la company 2)
-- Merchant 2 (Andes Santiago Centro): 2 terminales activas + 1 inactiva, 5 cobros (3 hoy) y un
--   reembolso hoy que no cuenta; usuarios 4 (3 activos).
BEGIN;

INSERT INTO company (id, name, legal_name, status, email, phone, tax_id, address, city, state, country, base_currency) VALUES
  (2, 'Andes Bistro Group', 'Andes Bistro Group SpA', 'active', 'finance@andesbistro-e2e.com', '+56 2 2345 6789', '76.543.210-3', 'Av Providencia 1234', 'Santiago', 'Metropolitan Region', 'Chile', 'CLP'),
  (3, 'Coastal Eats LLC', 'Coastal Eats Holdings LLC', 'active', 'hello@coastaleats-e2e.com', '+1 305 555 0101', '12-3456789', '100 Ocean Drive', 'Miami', 'Florida', 'United States', 'USD'),
  (4, 'Nordic Grill AB', 'Nordic Grill Aktiebolag', 'suspended', 'kontakt@nordicgrill-e2e.com', '+46 8 123 456 78', 'SE556677889901', 'Gotgatan 12', 'Stockholm', 'Stockholm County', 'Sweden', 'EUR'),
  (5, 'Old Town Diner Co', 'Old Town Diner Company Inc', 'inactive', 'owner@oldtowndiner-e2e.com', '+1 617 555 0199', '04-1234567', '12 Main Street', 'Boston', 'Massachusetts', 'United States', 'USD');

INSERT INTO company_subscription (company_id, plan_id, "startDate", "endDate", "renewalDate", status, payment_method) VALUES
  (2, 3, CURRENT_DATE - 30, CURRENT_DATE + 335, CURRENT_DATE + 335, 'active', 'card'),
  (3, 2, CURRENT_DATE - 10, CURRENT_DATE + 355, CURRENT_DATE + 355, 'active', 'card'),
  (4, 1, CURRENT_DATE - 60, CURRENT_DATE + 305, CURRENT_DATE + 305, 'active', 'card'),
  (5, 1, CURRENT_DATE - 400, CURRENT_DATE - 35, NULL, 'active', 'card');

INSERT INTO merchant (id, name, email, phone, address, city, state, country, timezone, status, "companyId") VALUES
  (2, 'Andes Santiago Centro', 'centro@andesbistro-e2e.com', '+56 2 2111 2222', 'Huerfanos 1055', 'Santiago', 'Metropolitan Region', 'Chile', 'America/Santiago', 'active', 2),
  (3, 'Andes Providencia', 'providencia@andesbistro-e2e.com', '+56 2 2333 4444', 'Av Providencia 2100', 'Santiago', 'Metropolitan Region', 'Chile', 'America/Santiago', 'active', 2),
  (4, 'Andes Valparaiso Puerto', 'puerto@andesbistro-e2e.com', '+56 32 255 6677', 'Blanco 1500', 'Valparaiso', 'Valparaiso Region', 'Chile', 'America/Santiago', 'inactive', 2),
  -- Dato heredado: zona horaria que no es IANA (la columna es texto libre)
  (5, 'Andes Concepcion Sur', 'sur@andesbistro-e2e.com', '+56 41 222 3344', 'Barros Arana 800', 'Concepcion', 'Biobio Region', 'Chile', 'America/Atlantis', 'suspended', 2),
  (6, 'Coastal Miami Beach', 'beach@coastaleats-e2e.com', '+1 305 555 0102', '1500 Collins Ave', 'Miami', 'Florida', 'United States', 'America/New_York', 'active', 3),
  (7, 'Nordic Sodermalm', 'sodermalm@nordicgrill-e2e.com', '+46 8 765 432 10', 'Hornsgatan 50', 'Stockholm', 'Stockholm County', 'Sweden', 'Europe/Stockholm', 'active', 4),
  (8, 'Old Town Main Street', 'main@oldtowndiner-e2e.com', '+1 617 555 0198', '12 Main Street', 'Boston', 'Massachusetts', 'United States', 'America/New_York', 'inactive', 5);

-- Misma contraseña que el portal_admin (E2eSaasOwner123!)
INSERT INTO users (id, username, email, password, role, scope, "isActive", "merchantId")
SELECT v.id, v.username, v.email, (SELECT password FROM users WHERE id = 1), v.role::users_role_enum, v.scope::users_scope_enum, v.active, v.merchant
  FROM (VALUES
    (2, 'andes_admin', 'admin@andesbistro-e2e.com', 'merchant_admin', 'merchant_web', true, 2),
    (3, 'sofia_cashier', 'sofia@andesbistro-e2e.com', 'merchant_user', 'merchant_web', true, 2),
    (4, 'diego_host', 'diego@andesbistro-e2e.com', 'merchant_user', 'merchant_web', true, 2),
    (5, 'former_manager', 'former@andesbistro-e2e.com', 'merchant_admin', 'merchant_web', false, 2),
    (6, 'provi_lead', 'lead@andesbistro-e2e.com', 'merchant_user', 'merchant_web', true, 3),
    (7, 'provi_temp', 'temp@andesbistro-e2e.com', 'merchant_user', 'merchant_web', false, 3),
    (8, 'valpo_waiter', 'valpo@andesbistro-e2e.com', 'merchant_user', 'merchant_web', true, 4),
    (9, 'coastal_admin', 'admin@coastaleats-e2e.com', 'merchant_admin', 'merchant_web', true, 6),
    (10, 'nordic_chef', 'chef@nordicgrill-e2e.com', 'merchant_user', 'merchant_web', true, 7)
  ) AS v(id, username, email, role, scope, active, merchant);

-- La fila de nómina lleva el discriminador tal como lo escribe la API ({"name":"..."})
INSERT INTO configuration (company_id, merchant_id, "createdAt", "updatedAt", status, name, description, rate, type) VALUES
  (2, 2, CURRENT_DATE - 20, CURRENT_DATE - 2, 'active', 'IVA 19%', 'Chilean VAT', 19, 'merchant_tax_rule'),
  (2, 3, CURRENT_DATE - 20, CURRENT_DATE - 3, 'active', 'Pooled tips', 'Tips shared by the floor team', NULL, 'merchant_tip_rule'),
  (2, 2, CURRENT_DATE - 40, CURRENT_DATE - 9, 'inactive', 'Biweekly payroll', 'Legacy payroll rule', NULL, '{"name":"merchant_payroll_rule"}'),
  (3, 6, CURRENT_DATE - 5, CURRENT_DATE - 1, 'active', 'Florida sales tax', 'State sales tax', 6, 'merchant_tax_rule');

-- Terminales de pago de Andes Santiago Centro (2 activas, 1 inactiva) y de Providencia (1 inactiva)
INSERT INTO merchant_payment_configs (id, company_id, merchant_id, provider, environment, display_name, credentials, credentials_preview, is_default) VALUES
  (1, 2, 2, 'cardpointe', 'sandbox', 'CardPointe Centro', '{}', '{}', true),
  (2, 2, 3, 'stripe', 'sandbox', 'Stripe Providencia', '{}', '{}', false);
INSERT INTO payment_terminals (company_id, merchant_id, payment_config_id, name, model, device_identifier, is_active) VALUES
  (2, 2, 1, 'Front Counter', 'Bolt Clover Flex', 'C032UQ03960001', true),
  (2, 2, 1, 'Bar Counter', 'Bolt Clover Mini', 'C032UQ03960002', true),
  (2, 2, 1, 'Patio (retired)', 'Bolt Ingenico', 'C032UQ03960003', false),
  (2, 3, 2, 'Providencia Reader', 'Stripe S700', 'tmr_ProvidenciaReader', false);

-- Pedidos y cobros de Andes Santiago Centro: 3 hoy, 2 hace 3 días, 1 reembolso hoy (no cuenta)
INSERT INTO collaborator (id, user_id, merchant_id, name, role, status) VALUES
  (1, 3, 2, 'Sofia Cashier', 'cashier', 'active');
INSERT INTO customer (id, name, email, address, city, state, country, "merchantId", "companyId") VALUES
  (1, 'Walk-in Guest', 'guest@andesbistro-e2e.com', 'Huerfanos 1055', 'Santiago', 'Metropolitan Region', 'Chile', 2, 2);
INSERT INTO orders (id, merchant_id, collaborator_id, customer_id, type, status, total, paid_total, is_paid, created_at) VALUES
  (1, 2, 1, 1, 'take_out', 'closed', 25, 25, true, now()),
  (2, 2, 1, 1, 'take_out', 'closed', 40, 40, true, now()),
  (3, 2, 1, 1, 'dine_in', 'closed', 18, 18, true, now() - interval '3 days'),
  -- Concepcion Sur (zona horaria heredada no IANA): un cobro hoy
  (4, 5, 1, 1, 'take_out', 'closed', 12, 12, true, now());
INSERT INTO order_payments (order_id, amount, method, provider, is_refund, status, created_at) VALUES
  (1, 25, 'card', 'cardpointe', false, 'completed', now()),
  (2, 20, 'card', 'cardpointe', false, 'completed', now()),
  (2, 20, 'cash', NULL, false, 'completed', now()),
  (2, 5, 'card', 'cardpointe', true, 'completed', now()),
  (3, 10, 'cash', NULL, false, 'completed', now() - interval '3 days'),
  (3, 8, 'card', 'cardpointe', false, 'completed', now() - interval '3 days'),
  (4, 12, 'cash', NULL, false, 'completed', now());

SELECT setval(pg_get_serial_sequence('company', 'id'), (SELECT MAX(id) FROM company));
SELECT setval(pg_get_serial_sequence('merchant', 'id'), (SELECT MAX(id) FROM merchant));
SELECT setval(pg_get_serial_sequence('users', 'id'), (SELECT MAX(id) FROM users));
SELECT setval(pg_get_serial_sequence('merchant_payment_configs', 'id'), (SELECT MAX(id) FROM merchant_payment_configs));
SELECT setval(pg_get_serial_sequence('collaborator', 'id'), (SELECT MAX(id) FROM collaborator));
SELECT setval(pg_get_serial_sequence('customer', 'id'), (SELECT MAX(id) FROM customer));
SELECT setval(pg_get_serial_sequence('orders', 'id'), (SELECT MAX(id) FROM orders));

COMMIT;
