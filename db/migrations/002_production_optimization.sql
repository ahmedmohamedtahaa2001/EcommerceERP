-- Production Database Optimization
-- Indexes, Constraints, and Performance Tuning
-- Run before production deployment

-- 1. CREATE MISSING INDEXES FOR PERFORMANCE

-- Products indexes
CREATE INDEX IF NOT EXISTS idx_products_sku
  ON products(sku)
  WHERE active = true;

CREATE INDEX IF NOT EXISTS idx_products_company_id
  ON products(company_id, active);

CREATE INDEX IF NOT EXISTS idx_products_created_at
  ON products(created_at DESC);

-- Orders indexes
CREATE INDEX IF NOT EXISTS idx_orders_customer_id
  ON orders(customer_id);

CREATE INDEX IF NOT EXISTS idx_orders_status
  ON orders(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_payment_status
  ON orders(payment_status);

CREATE INDEX IF NOT EXISTS idx_orders_created_at
  ON orders(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_company_id
  ON orders(company_id, created_at DESC);

-- Customers indexes
CREATE INDEX IF NOT EXISTS idx_customers_email
  ON customers(email);

CREATE INDEX IF NOT EXISTS idx_customers_company_id
  ON customers(company_id);

CREATE INDEX IF NOT EXISTS idx_customers_created_at
  ON customers(created_at DESC);

-- Inventory indexes
CREATE INDEX IF NOT EXISTS idx_inventory_product_id
  ON inventory(product_id);

CREATE INDEX IF NOT EXISTS idx_inventory_warehouse_id
  ON inventory(warehouse_id);

CREATE INDEX IF NOT EXISTS idx_inventory_quantity_low
  ON inventory(quantity)
  WHERE quantity < reorder_level;

-- Order items indexes
CREATE INDEX IF NOT EXISTS idx_order_items_order_id
  ON order_items(order_id);

CREATE INDEX IF NOT EXISTS idx_order_items_product_id
  ON order_items(product_id);

-- Users indexes
CREATE INDEX IF NOT EXISTS idx_users_company_id
  ON users(company_id);

CREATE INDEX IF NOT EXISTS idx_users_email
  ON users(email);

-- Audit logs indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id
  ON audit_logs(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_resource
  ON audit_logs(resource_type, resource_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at
  ON audit_logs(created_at DESC);

-- 2. ANALYZE TABLES FOR QUERY PLANNER

ANALYZE products;
ANALYZE orders;
ANALYZE customers;
ANALYZE inventory;
ANALYZE order_items;
ANALYZE users;
ANALYZE audit_logs;

-- 3. ENABLE PARTIAL INDEXES FOR COMMON QUERIES

-- Active products only
CREATE INDEX IF NOT EXISTS idx_products_active
  ON products(company_id)
  WHERE active = true;

-- Recent orders
CREATE INDEX IF NOT EXISTS idx_orders_recent
  ON orders(company_id, created_at DESC)
  WHERE created_at > NOW() - INTERVAL '90 days';

-- Low stock items
CREATE INDEX IF NOT EXISTS idx_inventory_critical
  ON inventory(product_id, quantity)
  WHERE quantity < reorder_level;

-- 4. SET STATISTICS FOR BETTER QUERY PLANS

ALTER TABLE products SET (fillfactor = 80);
ALTER TABLE orders SET (fillfactor = 80);
ALTER TABLE customers SET (fillfactor = 90);
ALTER TABLE order_items SET (fillfactor = 80);

-- 5. VACUUM AND ANALYZE FOR CLEANUP

VACUUM FULL ANALYZE;

-- 6. VERIFY INDEXES EXIST

SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

-- 7. ENABLE QUERY STATISTICS EXTENSION

CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- 8. SET PERFORMANCE PARAMETERS (for admin to adjust as needed)

-- Increase work_mem for large queries (adjust based on server RAM)
-- ALTER DATABASE current_database SET work_mem = '256MB';

-- Enable parallel queries
-- ALTER SYSTEM SET max_parallel_workers_per_gather = 4;

-- 9. CREATE MATERIALIZED VIEW FOR DASHBOARD PERFORMANCE

DROP MATERIALIZED VIEW IF EXISTS mv_dashboard_metrics;

CREATE MATERIALIZED VIEW mv_dashboard_metrics AS
SELECT
  DATE(orders.created_at) as date,
  COUNT(*) as order_count,
  SUM(orders.total) as revenue,
  AVG(orders.total) as avg_order_value,
  COUNT(DISTINCT orders.customer_id) as unique_customers
FROM orders
WHERE orders.created_at > NOW() - INTERVAL '30 days'
GROUP BY DATE(orders.created_at);

CREATE INDEX idx_mv_dashboard_metrics_date
  ON mv_dashboard_metrics(date DESC);

-- 10. RESULTS VERIFICATION

-- Check index sizes
SELECT
  schemaname,
  tablename,
  indexname,
  pg_size_pretty(pg_relation_size(indexrelid)) as size
FROM pg_indexes
JOIN pg_class ON indexname = pg_class.relname
WHERE schemaname = 'public'
ORDER BY pg_relation_size(indexrelid) DESC;

-- Check table sizes
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Performance query example: Check slow queries
SELECT
  query,
  calls,
  mean_time,
  total_time
FROM pg_stat_statements
WHERE query NOT ILIKE '%pg_stat_statements%'
ORDER BY mean_time DESC
LIMIT 10;
