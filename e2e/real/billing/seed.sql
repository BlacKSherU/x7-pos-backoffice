-- Datos de la suite E2E real de Billing & Transactions. Lo aplica stack.mjs sobre una base
-- desechable recién migrada, después del seed de referencia (planes 1-3 con las features 14/15/16
-- y la aplicación 7) y de seed:admin (company 1, merchant 1 y el portal_admin, user 1). Ids fijos:
-- billing-real.spec.ts compara los números de pantalla con esto.
--
-- Company 2 "Harbor Bistro Group" (USD, plan 2 Professional): merchants 2 Downtown y 3 Uptown.
-- Usuario de la prueba: admin@harborbistro-e2e.com (merchant_admin de Downtown, misma contraseña
-- que el portal_admin).
--
-- Recibos de Downtown (tasa "Sales Tax" 8 %, "City Tax" 1,5 %; importes coherentes al centavo):
--   1 INV-000001 INVOICE  bloqueado  orden pagada y descontada del stock  asiento POSTED  nota de crédito 4,00
--                         subtotal 28,00  impuestos 2,66 (recibo)  total 30,66
--   2 INV-000002 RECEIPT  editable   orden sin pagar, stock suficiente     sin asiento
--                         subtotal 17,50  impuesto 1,40 (recibo)   total 18,90
--   3 INV-000003 INVOICE  editable   enlazado al proveedor 1, orden con saldo  asiento DRAFT
--                         subtotal 67,00  impuestos 5,36 (línea)   total 72,36
--   4 INV-000004 RECEIPT  editable   descuento 6,00, stock insuficiente de carne
--                         subtotal 40,00  impuesto 3,20  descuento 6,00  total 37,20
--   5 INV-000005 RECEIPT  inactivo (anulado)
--                         subtotal 9,50   impuesto 0,76            total 10,26
--   6 INV-000006 RECEIPT  bloqueado  orden pagada sin descontar stock, SKU sin mapear
--                         subtotal 27,00  impuesto 2,16            total 29,16
--   7 INV-000007 INVOICE  editable   exento de impuestos (EX-2026-014)
--                         subtotal 40,00  impuesto 0,00            total 40,00
-- Recibo de Uptown: 8 INV-000001 INVOICE (cliente 3), subtotal 55,00  impuesto 4,40  total 59,40.
-- Orden 9 de Downtown: pagada y sin recibo (la prueba la factura con NEW RECEIPT).
BEGIN;

INSERT INTO company (id, name, legal_name, status, email, phone, tax_id, address, city, state, country, base_currency) VALUES
  (2, 'Harbor Bistro Group', 'Harbor Bistro Group LLC', 'active', 'finance@harborbistro-e2e.com', '+1 415 555 0100', '94-1234567', '1 Embarcadero Center', 'San Francisco', 'California', 'United States', 'USD');

INSERT INTO company_subscription (company_id, plan_id, "startDate", "endDate", "renewalDate", status, payment_method) VALUES
  (2, 2, CURRENT_DATE - 30, CURRENT_DATE + 335, CURRENT_DATE + 335, 'active', 'card');

INSERT INTO merchant (id, name, email, phone, tax_id, address, city, state, country, timezone, status, "companyId") VALUES
  (2, 'Harbor Bistro Downtown', 'downtown@harborbistro-e2e.com', '+1 415 555 0101', '94-1234567', '100 Market Street', 'San Francisco', 'California', 'United States', 'America/Los_Angeles', 'active', 2),
  (3, 'Harbor Bistro Uptown', 'uptown@harborbistro-e2e.com', '+1 415 555 0102', '94-1234567', '2200 Fillmore Street', 'San Francisco', 'California', 'United States', 'America/Los_Angeles', 'active', 2);

-- Misma contraseña que el portal_admin (E2eBillingOwner123!)
INSERT INTO users (id, username, email, password, role, scope, "isActive", "merchantId")
SELECT v.id, v.username, v.email, (SELECT password FROM users WHERE id = 1), v.role::users_role_enum, v.scope::users_scope_enum, true, v.merchant
  FROM (VALUES
    (2, 'laura_admin', 'admin@harborbistro-e2e.com', 'merchant_admin', 'merchant_web', 2),
    (3, 'tom_uptown', 'cashier@harborbistro-e2e.com', 'merchant_user', 'merchant_web', 3)
  ) AS v(id, username, email, role, scope, merchant);

INSERT INTO collaborator (id, user_id, merchant_id, name, role, status) VALUES
  (1, 2, 2, 'Laura Admin', 'manager', 'active'),
  (2, 3, 3, 'Tom Uptown', 'cashier', 'active');

-- Clientes: 1-2 y 4 de Downtown (4 sin company: solo la sucursal), 3 de Uptown
INSERT INTO customer (id, name, email, phone, document_id, address, city, state, country, "merchantId", "companyId") VALUES
  (1, 'Walk-in Guest', 'walkin@harborbistro-e2e.com', NULL, NULL, '100 Market Street', 'San Francisco', 'California', 'United States', 2, 2),
  (2, 'Acme Catering SpA', 'billing@acmecatering-e2e.com', '+1 415 555 0140', '76.123.456-7', '500 Howard Street', 'San Francisco', 'California', 'United States', 2, 2),
  (3, 'Blue Harbor Events LLC', 'events@blueharbor-e2e.com', '+1 415 555 0150', '12-3456789', '3100 Fillmore Street', 'San Francisco', 'California', 'United States', 3, 2),
  (4, 'Sunset Weddings Co', 'hello@sunsetweddings-e2e.com', '+1 415 555 0160', '45-6789012', '900 Sunset Blvd', 'San Francisco', 'California', 'United States', 2, NULL);

INSERT INTO supplier (id, company_id, name, tax_id, email, phone, address, "isActive") VALUES
  (1, 2, 'Fresh Farms Distributors', '98-7654321', 'orders@freshfarms-e2e.com', '+1 510 555 0170', '42 Produce Row, Oakland', true),
  (2, 2, 'Ocean Seafood Supply', '87-6543210', 'sales@oceanseafood-e2e.com', '+1 510 555 0180', '7 Pier Road, Oakland', true),
  (3, 2, 'Old Vendor Inc', '11-1111111', 'old@oldvendor-e2e.com', NULL, NULL, false);

-- Carta e inventario ----------------------------------------------------------------------
INSERT INTO category (id, name, "merchantId", "isActive") VALUES
  (1, 'Mains', 2, true),
  (2, 'Drinks', 2, true),
  (3, 'Mains', 3, true);

INSERT INTO product (id, name, sku, "basePrice", "merchantId", "categoryId", "isActive") VALUES
  (1, 'Classic Burger', 'BRG-001', 12.00, 2, 1, true),
  (2, 'Caesar Salad', 'SAL-002', 9.50, 2, 1, true),
  (3, 'Fresh Lemonade', 'DRK-003', 4.00, 2, 2, true),
  (4, 'Fish Tacos', 'TAC-004', 11.00, 3, 3, true);

INSERT INTO supplies (id, company_id, code, sku, name, unit, cost_per_unit, "isActive") VALUES
  (1, 2, 'SUP-BEEF', 'SUP-BEEF', 'Beef Patty', 'unit', 2.40, true),
  (2, 2, 'SUP-BUN', 'SUP-BUN', 'Burger Bun', 'unit', 0.45, true),
  (3, 2, 'SUP-ROM', 'SUP-ROM', 'Romaine Lettuce', 'unit', 1.10, true),
  (4, 2, 'SUP-LEM', 'SUP-LEM', 'Lemon', 'unit', 0.30, true);

-- Recetas: hamburguesa = 1 carne + 1 pan; ensalada = 1 lechuga; limonada = 2 limones
INSERT INTO product_recipe (id, merchant_id, finished_product_id) VALUES
  (1, 2, 1),
  (2, 2, 2),
  (3, 2, 3);
INSERT INTO product_recipe_line (recipe_id, line_type, raw_material_id, quantity, unit_of_measure, quantity_per_sold_unit, quantity_unit) VALUES
  (1, 'REQUIRED', 1, 1, 'unit', 1, 'UNIT'),
  (1, 'REQUIRED', 2, 1, 'unit', 1, 'UNIT'),
  (2, 'REQUIRED', 3, 1, 'unit', 1, 'UNIT'),
  (3, 'REQUIRED', 4, 2, 'unit', 2, 'UNIT');

INSERT INTO stock_location (id, name, code, address, is_main_storage, "merchantId", "isActive") VALUES
  (1, 'Main Kitchen', 'MAIN', '100 Market Street', true, 2, true),
  (2, 'Uptown Kitchen', 'UPT', '2200 Fillmore Street', true, 3, true);
UPDATE merchant SET default_sales_stock_location_id = 1 WHERE id = 2;
UPDATE merchant SET default_sales_stock_location_id = 2 WHERE id = 3;

-- Carne bajo mínimo (2 < 10): la orden 1 ya la descontó; las órdenes 3 y 4 piden más de la que hay
INSERT INTO stock_item (id, "currentQty", minimum_qty, supply_id, "locationId", "isActive", weighted_average_unit_cost) VALUES
  (1, 2, 10, 1, 1, true, 2.40),
  (2, 36, 10, 2, 1, true, 0.45),
  (3, 6, 5, 3, 1, true, 1.10),
  (4, 28, 10, 4, 1, true, 0.30);

INSERT INTO inventory_stock_alert ("merchantId", "stockItemId", "supplyId", "locationId", "alertType", "currentQty", "minimumQty", status, "triggeredAt") VALUES
  (2, 1, 1, 1, 'LOW', 2, 10, 'ACTIVE', now() - interval '2 days');

-- Órdenes -----------------------------------------------------------------------------------
INSERT INTO orders (id, merchant_id, collaborator_id, customer_id, type, status, order_number, subtotal, tax_total, discount_total, total, paid_total, balance_due, is_paid, inventory_consumed_at, created_at, closed_at) VALUES
  (1, 2, 1, 2, 'dine_in', 'paid', '0001', 28.00, 2.66, 0, 30.66, 30.66, 0, true, now() - interval '2 days', now() - interval '2 days', now() - interval '2 days'),
  (2, 2, 1, 1, 'take_out', 'in_progress', '0002', 17.50, 1.40, 0, 18.90, 0, 18.90, false, NULL, now() - interval '1 day', NULL),
  (3, 2, 1, 1, 'dine_in', 'partially_paid', '0003', 67.00, 5.36, 0, 72.36, 40.00, 32.36, false, NULL, now() - interval '27 hours', NULL),
  (4, 2, 1, 1, 'dine_in', 'in_progress', '0004', 40.00, 3.20, 6.00, 37.20, 0, 37.20, false, NULL, now() - interval '3 hours', NULL),
  (5, 2, 1, 1, 'take_out', 'cancelled', '0005', 9.50, 0.76, 0, 10.26, 0, 10.26, false, NULL, now() - interval '4 days', now() - interval '4 days'),
  (6, 2, 1, 1, 'take_out', 'paid', '0006', 27.00, 2.16, 0, 29.16, 29.16, 0, true, NULL, now() - interval '50 hours', now() - interval '50 hours'),
  (7, 2, 1, 2, 'delivery', 'in_progress', '0007', 40.00, 0, 0, 40.00, 0, 40.00, false, NULL, now() - interval '5 hours', NULL),
  (8, 3, 2, 3, 'dine_in', 'partially_paid', '0001', 55.00, 4.40, 0, 59.40, 20.00, 39.40, false, NULL, now() - interval '1 day', NULL),
  (9, 2, 1, 2, 'take_out', 'paid', '0009', 19.00, 1.52, 0, 20.52, 20.52, 0, true, NULL, now() - interval '1 hour', now() - interval '1 hour');

INSERT INTO order_item (order_id, product_id, quantity, price, discount, total_price, status) VALUES
  (1, 1, 2, 12.00, 0, 24.00, 'active'),
  (1, 3, 1, 4.00, 0, 4.00, 'active'),
  (2, 2, 1, 9.50, 0, 9.50, 'active'),
  (2, 3, 2, 4.00, 0, 8.00, 'active'),
  (3, 1, 4, 12.00, 0, 48.00, 'active'),
  (3, 2, 2, 9.50, 0, 19.00, 'active'),
  (4, 1, 3, 12.00, 6.00, 30.00, 'active'),
  (4, 3, 1, 4.00, 0, 4.00, 'active'),
  (5, 2, 1, 9.50, 0, 9.50, 'active'),
  (6, 1, 1, 12.00, 0, 12.00, 'active'),
  (7, 3, 10, 4.00, 0, 40.00, 'active'),
  (8, 4, 5, 11.00, 0, 55.00, 'active'),
  (9, 2, 2, 9.50, 0, 19.00, 'active');

INSERT INTO order_payments (order_id, amount, method, provider, is_refund, status, created_at) VALUES
  (1, 30.66, 'card', 'cardpointe', false, 'completed', now() - interval '2 days'),
  (3, 40.00, 'cash', NULL, false, 'completed', now() - interval '27 hours'),
  (6, 29.16, 'card', 'cardpointe', false, 'completed', now() - interval '50 hours'),
  (8, 20.00, 'cash', NULL, false, 'completed', now() - interval '1 day'),
  (9, 20.52, 'cash', NULL, false, 'completed', now() - interval '1 hour');

-- Descuento real de la venta 1: 2 carnes, 2 panes, 2 limones
INSERT INTO stock_movement ("stockItemId", quantity, type, reference, reason, "merchantId", order_id, movement_type, "createdAt", "isActive") VALUES
  (1, 2, 'OUT_FOR_SALE', 'order:1', 'Checkout sale (recipe consumption)', 2, 1, 'OUT_FOR_SALE', now() - interval '2 days', true),
  (2, 2, 'OUT_FOR_SALE', 'order:1', 'Checkout sale (recipe consumption)', 2, 1, 'OUT_FOR_SALE', now() - interval '2 days', true),
  (4, 2, 'OUT_FOR_SALE', 'order:1', 'Checkout sale (recipe consumption)', 2, 1, 'OUT_FOR_SALE', now() - interval '2 days', true);

-- Recibos -----------------------------------------------------------------------------------
INSERT INTO receipts (id, order_id, merchant_id, type, invoice_number, fiscal_data, subtotal, total_tax, total_discount, grand_total, currency, is_active, is_locked, processed_by_user_id, processed_by_role, customer_id, supplier_id, order_snapshot, created_at, updated_at) VALUES
  (1, 1, 2, 'INVOICE', 'INV-000001', '{"tax_id":"76.123.456-7","business_name":"Acme Catering SpA"}', 28.00, 2.66, 0, 30.66, 'USD', true, true, 2, 'merchant_admin', NULL, NULL,
   '{"orderId":1,"orderNumber":"0001","subtotal":"28.00","taxTotal":"2.66","discountTotal":"0.00","total":"30.66","paidTotal":30.66,"tipTotal":0,"items":[{"product_id":1,"productName":"Classic Burger","quantity":2,"price":"12.00","totalPrice":"24.00","notes":null},{"product_id":3,"productName":"Fresh Lemonade","quantity":1,"price":"4.00","totalPrice":"4.00","notes":null}],"payments":[{"method":"card","amount":30.66,"tipAmount":0}]}',
   now() - interval '2 days', now() - interval '2 days'),
  (2, 2, 2, 'RECEIPT', 'INV-000002', NULL, 17.50, 1.40, 0, 18.90, 'USD', true, false, NULL, NULL, NULL, NULL, NULL,
   now() - interval '1 day', now() - interval '1 day'),
  (3, 3, 2, 'INVOICE', 'INV-000003', '{"tax_id":"98-7654321","business_name":"Fresh Farms Distributors"}', 67.00, 5.36, 0, 72.36, 'USD', true, false, NULL, NULL, NULL, 1, NULL,
   now() - interval '27 hours', now() - interval '27 hours'),
  (4, 4, 2, 'RECEIPT', 'INV-000004', NULL, 40.00, 3.20, 6.00, 37.20, 'USD', true, false, 2, 'merchant_admin', NULL, NULL,
   '{"orderId":4,"orderNumber":"0004","subtotal":"40.00","taxTotal":"3.20","discountTotal":"6.00","total":"37.20","paidTotal":0,"tipTotal":0,"items":[{"product_id":1,"productName":"Classic Burger","quantity":3,"price":"12.00","totalPrice":"36.00","notes":"Manager comp: 6.00 off"},{"product_id":3,"productName":"Fresh Lemonade","quantity":1,"price":"4.00","totalPrice":"4.00","notes":null}],"payments":[]}',
   now() - interval '3 hours', now() - interval '3 hours'),
  (5, 5, 2, 'RECEIPT', 'INV-000005', NULL, 9.50, 0.76, 0, 10.26, 'USD', false, false, 2, 'merchant_admin', NULL, NULL,
   '{"orderId":5,"orderNumber":"0005","subtotal":"9.50","taxTotal":"0.76","discountTotal":"0.00","total":"10.26","paidTotal":0,"tipTotal":0,"items":[{"product_id":2,"productName":"Caesar Salad","quantity":1,"price":"9.50","totalPrice":"9.50","notes":null}],"payments":[]}',
   now() - interval '4 days', now() - interval '4 days' + interval '20 minutes'),
  (6, 6, 2, 'RECEIPT', 'INV-000006', NULL, 27.00, 2.16, 0, 29.16, 'USD', true, true, 2, 'merchant_admin', NULL, NULL,
   '{"orderId":6,"orderNumber":"0006","subtotal":"27.00","taxTotal":"2.16","discountTotal":"0.00","total":"29.16","paidTotal":29.16,"tipTotal":0,"items":[{"productName":"Chef Special","quantity":1,"price":"15.00","totalPrice":"15.00","notes":null},{"product_id":1,"productName":"Classic Burger","quantity":1,"price":"12.00","totalPrice":"12.00","notes":null}],"payments":[{"method":"card","amount":29.16,"tipAmount":0}]}',
   now() - interval '50 hours', now() - interval '50 hours'),
  (7, 7, 2, 'INVOICE', 'INV-000007', '{"tax_id":"76.123.456-7","business_name":"Acme Catering SpA","tax_exempt":true,"exemption_code":"EX-2026-014"}', 40.00, 0, 0, 40.00, 'USD', true, false, NULL, NULL, NULL, NULL, NULL,
   now() - interval '5 hours', now() - interval '5 hours'),
  (8, 8, 3, 'INVOICE', 'INV-000001', '{"tax_id":"12-3456789","business_name":"Blue Harbor Events LLC"}', 55.00, 4.40, 0, 59.40, 'USD', true, false, NULL, NULL, NULL, NULL, NULL,
   now() - interval '1 day', now() - interval '1 day');

INSERT INTO receipt_items (id, receipt_id, name, sku, quantity, unit_price, subtotal, discount_amount, total, metadata, is_active, created_at) VALUES
  (1, 1, 'Classic Burger', 'BRG-001', 2, 12.00, 24.00, 0, 24.00, NULL, true, now() - interval '2 days'),
  (2, 1, 'Fresh Lemonade', 'DRK-003', 1, 4.00, 4.00, 0, 4.00, NULL, true, now() - interval '2 days'),
  (3, 2, 'Caesar Salad', 'SAL-002', 1, 9.50, 9.50, 0, 9.50, NULL, true, now() - interval '1 day'),
  (4, 2, 'Fresh Lemonade', 'DRK-003', 2, 4.00, 8.00, 0, 8.00, NULL, true, now() - interval '1 day'),
  (5, 3, 'Classic Burger', 'BRG-001', 4, 12.00, 48.00, 0, 48.00, NULL, true, now() - interval '27 hours'),
  (6, 3, 'Caesar Salad', 'SAL-002', 2, 9.50, 19.00, 0, 19.00, NULL, true, now() - interval '27 hours'),
  (7, 4, 'Classic Burger', 'BRG-001', 3, 12.00, 36.00, 6.00, 30.00, '{"notes":"Manager comp: 6.00 off"}', true, now() - interval '3 hours'),
  (8, 4, 'Fresh Lemonade', 'DRK-003', 1, 4.00, 4.00, 0, 4.00, NULL, true, now() - interval '3 hours'),
  (9, 5, 'Caesar Salad', 'SAL-002', 1, 9.50, 9.50, 0, 9.50, NULL, true, now() - interval '4 days'),
  (10, 6, 'Chef Special', 'SPC-999', 1, 15.00, 15.00, 0, 15.00, NULL, true, now() - interval '50 hours'),
  (11, 6, 'Classic Burger', 'BRG-001', 1, 12.00, 12.00, 0, 12.00, NULL, true, now() - interval '50 hours'),
  (12, 7, 'Fresh Lemonade', 'DRK-003', 10, 4.00, 40.00, 0, 40.00, NULL, true, now() - interval '5 hours'),
  (13, 8, 'Fish Tacos', 'TAC-004', 5, 11.00, 55.00, 0, 55.00, NULL, true, now() - interval '1 day');

INSERT INTO receipt_taxes (id, receipt_id, receipt_item_id, name, rate, amount, scope, is_active, created_at) VALUES
  (1, 1, NULL, 'Sales Tax', 8.00, 2.24, 'RECEIPT', true, now() - interval '2 days'),
  (2, 1, NULL, 'City Tax', 1.50, 0.42, 'RECEIPT', true, now() - interval '2 days'),
  (3, 2, NULL, 'Sales Tax', 8.00, 1.40, 'RECEIPT', true, now() - interval '1 day'),
  (4, 3, 5, 'Sales Tax', 8.00, 3.84, 'ITEM', true, now() - interval '27 hours'),
  (5, 3, 6, 'Sales Tax', 8.00, 1.52, 'ITEM', true, now() - interval '27 hours'),
  (6, 4, NULL, 'Sales Tax', 8.00, 3.20, 'RECEIPT', true, now() - interval '3 hours'),
  (7, 5, NULL, 'Sales Tax', 8.00, 0.76, 'RECEIPT', true, now() - interval '4 days'),
  (8, 6, NULL, 'Sales Tax', 8.00, 2.16, 'RECEIPT', true, now() - interval '50 hours'),
  (9, 7, NULL, 'Sales Tax', 8.00, 0.00, 'RECEIPT', true, now() - interval '5 hours'),
  (10, 8, NULL, 'Sales Tax', 8.00, 4.40, 'RECEIPT', true, now() - interval '1 day');

-- Nota de crédito sobre el recibo bloqueado 1 (devolución parcial de 4,00)
INSERT INTO receipt_adjustment_notes (id, receipt_id, merchant_id, note_type, note_number, original_invoice_number, adjustment_amount, resulting_net_amount, currency, reason_code, processed_by_user_id, processed_by_role, created_at) VALUES
  (1, 1, 2, 'CREDIT_NOTE', 'CN-000001', 'INV-000001', 4.00, 26.66, 'USD', 'PARTIAL_RETURN', 2, 'merchant_admin', now() - interval '1 day');

-- Audit trail de los recibos sembrados (la migración solo rellenó los que ya existían)
INSERT INTO receipt_audit_logs (receipt_id, merchant_id, action, user_id, role, previous_values, new_values, metadata, created_at) VALUES
  (1, 2, 'CREATED', 2, 'merchant_admin', NULL, '{"subtotal":28,"total_tax":2.66,"total_discount":0,"grand_total":30.66}', '{"source":"order_settlement","order_id":1,"invoice_number":"INV-000001","type":"INVOICE","currency":"USD"}', now() - interval '2 days'),
  (1, 2, 'LOCKED', 2, 'merchant_admin', NULL, NULL, '{"source":"order_settlement"}', now() - interval '2 days' + interval '1 minute'),
  (1, 2, 'ADJUSTMENT_ISSUED', 2, 'merchant_admin', '{"subtotal":28,"total_tax":2.66,"total_discount":0,"grand_total":30.66}', '{"subtotal":28,"total_tax":2.66,"total_discount":0,"grand_total":30.66}', '{"note_id":1,"note_type":"CREDIT_NOTE","note_number":"CN-000001","original_invoice_number":"INV-000001","adjustment_amount":4,"reason_code":"PARTIAL_RETURN","net_total_before":30.66,"net_total_after":26.66}', now() - interval '1 day'),
  (2, 2, 'CREATED', 2, 'merchant_admin', NULL, '{"subtotal":17.5,"total_tax":1.4,"total_discount":0,"grand_total":18.9}', '{"source":"manual","order_id":2,"invoice_number":"INV-000002","type":"RECEIPT","currency":"USD"}', now() - interval '1 day'),
  (3, 2, 'CREATED', 2, 'merchant_admin', NULL, '{"subtotal":67,"total_tax":5.36,"total_discount":0,"grand_total":72.36}', '{"source":"manual","order_id":3,"invoice_number":"INV-000003","type":"INVOICE","currency":"USD"}', now() - interval '27 hours'),
  (4, 2, 'CREATED', 2, 'merchant_admin', NULL, '{"subtotal":40,"total_tax":3.2,"total_discount":6,"grand_total":37.2}', '{"source":"manual","order_id":4,"invoice_number":"INV-000004","type":"RECEIPT","currency":"USD"}', now() - interval '3 hours'),
  (5, 2, 'CREATED', 2, 'merchant_admin', NULL, '{"subtotal":9.5,"total_tax":0.76,"total_discount":0,"grand_total":10.26}', '{"source":"manual","order_id":5,"invoice_number":"INV-000005","type":"RECEIPT","currency":"USD"}', now() - interval '4 days'),
  (5, 2, 'DEACTIVATED', 2, 'merchant_admin', '{"subtotal":9.5,"total_tax":0.76,"total_discount":0,"grand_total":10.26}', NULL, '{"via":"delete"}', now() - interval '4 days' + interval '20 minutes'),
  (6, 2, 'CREATED', 2, 'merchant_admin', NULL, '{"subtotal":27,"total_tax":2.16,"total_discount":0,"grand_total":29.16}', '{"source":"order_settlement","order_id":6,"invoice_number":"INV-000006","type":"RECEIPT","currency":"USD"}', now() - interval '50 hours'),
  (6, 2, 'LOCKED', 2, 'merchant_admin', NULL, NULL, '{"source":"order_settlement"}', now() - interval '50 hours' + interval '1 minute'),
  (7, 2, 'CREATED', 2, 'merchant_admin', NULL, '{"subtotal":40,"total_tax":0,"total_discount":0,"grand_total":40}', '{"source":"manual","order_id":7,"invoice_number":"INV-000007","type":"INVOICE","currency":"USD"}', now() - interval '5 hours'),
  (8, 3, 'CREATED', 3, 'merchant_user', NULL, '{"subtotal":55,"total_tax":4.4,"total_discount":0,"grand_total":59.4}', '{"source":"manual","order_id":8,"invoice_number":"INV-000001","type":"INVOICE","currency":"USD"}', now() - interval '1 day');

-- Contabilidad: plan de cuentas de la company 2, un asiento POSTED (recibo 1) y uno DRAFT (recibo 3)
INSERT INTO ledger_accounts (id, company_id, code, name, type, is_active) VALUES
  (1, 2, '1100', 'Cash & Card Clearing', 'ASSET', true),
  (2, 2, '1200', 'Accounts Receivable', 'ASSET', true),
  (3, 2, '2100', 'Sales Tax Payable', 'LIABILITY', true),
  (4, 2, '3000', 'Owner Equity', 'EQUITY', true),
  (5, 2, '4000', 'Food & Beverage Sales', 'REVENUE', true),
  (6, 2, '4900', 'Sales Discounts', 'EXPENSE', true);

INSERT INTO journal_entries (id, company_id, entry_number, entry_date, description, status, total_debit, total_credit, reference_type, reference_id, is_active) VALUES
  (1, 2, 'RCPT-INV-000001', CURRENT_DATE - 2, 'Sales receipt INV-000001 posted from Billing', 'POSTED', 30.66, 30.66, 'RECEIPT', 1, true),
  (2, 2, 'RCPT-INV-000003', CURRENT_DATE - 1, 'Sales receipt INV-000003 (draft)', 'DRAFT', 72.36, 72.36, 'RECEIPT', 3, true);
INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description, is_active) VALUES
  (1, 1, 30.66, 0, 'Receipt INV-000001 · amount collected', true),
  (1, 5, 0, 28.00, 'Receipt INV-000001 · sales revenue', true),
  (1, 3, 0, 2.66, 'Receipt INV-000001 · tax liability', true),
  (2, 2, 72.36, 0, 'Receipt INV-000003 · amount receivable', true),
  (2, 5, 0, 67.00, 'Receipt INV-000003 · sales revenue', true),
  (2, 3, 0, 5.36, 'Receipt INV-000003 · tax liability', true);

-- Secuencias -------------------------------------------------------------------------------
SELECT setval(pg_get_serial_sequence('company', 'id'), (SELECT MAX(id) FROM company));
SELECT setval(pg_get_serial_sequence('merchant', 'id'), (SELECT MAX(id) FROM merchant));
SELECT setval(pg_get_serial_sequence('users', 'id'), (SELECT MAX(id) FROM users));
SELECT setval(pg_get_serial_sequence('collaborator', 'id'), (SELECT MAX(id) FROM collaborator));
SELECT setval(pg_get_serial_sequence('customer', 'id'), (SELECT MAX(id) FROM customer));
SELECT setval(pg_get_serial_sequence('supplier', 'id'), (SELECT MAX(id) FROM supplier));
SELECT setval(pg_get_serial_sequence('category', 'id'), (SELECT MAX(id) FROM category));
SELECT setval(pg_get_serial_sequence('product', 'id'), (SELECT MAX(id) FROM product));
SELECT setval(pg_get_serial_sequence('supplies', 'id'), (SELECT MAX(id) FROM supplies));
SELECT setval(pg_get_serial_sequence('product_recipe', 'id'), (SELECT MAX(id) FROM product_recipe));
SELECT setval(pg_get_serial_sequence('stock_location', 'id'), (SELECT MAX(id) FROM stock_location));
SELECT setval(pg_get_serial_sequence('stock_item', 'id'), (SELECT MAX(id) FROM stock_item));
SELECT setval(pg_get_serial_sequence('orders', 'id'), (SELECT MAX(id) FROM orders));
SELECT setval(pg_get_serial_sequence('receipts', 'id'), (SELECT MAX(id) FROM receipts));
SELECT setval(pg_get_serial_sequence('receipt_items', 'id'), (SELECT MAX(id) FROM receipt_items));
SELECT setval(pg_get_serial_sequence('receipt_taxes', 'id'), (SELECT MAX(id) FROM receipt_taxes));
SELECT setval(pg_get_serial_sequence('receipt_adjustment_notes', 'id'), (SELECT MAX(id) FROM receipt_adjustment_notes));
SELECT setval(pg_get_serial_sequence('ledger_accounts', 'id'), (SELECT MAX(id) FROM ledger_accounts));
SELECT setval(pg_get_serial_sequence('journal_entries', 'id'), (SELECT MAX(id) FROM journal_entries));

COMMIT;
