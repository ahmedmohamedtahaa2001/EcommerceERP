-- Seed data for testing
-- Companies
INSERT INTO companies (id, name, slug, email) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Demo Company', 'demo-company', 'demo@example.com')
ON CONFLICT DO NOTHING;

-- Warehouses
INSERT INTO warehouses (company_id, name, location, is_default) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Main Warehouse', 'New York, NY', true),
  ('11111111-1111-1111-1111-111111111111', 'Secondary Warehouse', 'Los Angeles, CA', false)
ON CONFLICT DO NOTHING;

-- Sample Products
INSERT INTO products (company_id, sku, name, description, price, cost) VALUES
  ('11111111-1111-1111-1111-111111111111', 'PROD-001', 'Laptop', 'High-performance laptop', 999.99, 500.00),
  ('11111111-1111-1111-1111-111111111111', 'PROD-002', 'Mouse', 'Wireless mouse', 29.99, 10.00),
  ('11111111-1111-1111-1111-111111111111', 'PROD-003', 'Keyboard', 'Mechanical keyboard', 79.99, 30.00)
ON CONFLICT DO NOTHING;

-- Sample Customers
INSERT INTO customers (company_id, email, name, phone) VALUES
  ('11111111-1111-1111-1111-111111111111', 'john@example.com', 'John Doe', '+1-555-0100'),
  ('11111111-1111-1111-1111-111111111111', 'jane@example.com', 'Jane Smith', '+1-555-0101')
ON CONFLICT DO NOTHING;
