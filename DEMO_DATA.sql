-- ============================================================================
-- OPERIX ERP - DEMO DATA SETUP
-- ============================================================================
-- This script creates realistic demo data for testing
-- Run in Supabase SQL Editor
-- ============================================================================

-- STEP 1: Create Demo Organization
-- ============================================================================
INSERT INTO organizations (name, slug, logo_url, created_at, updated_at)
VALUES (
  'Acme Corporation',
  'acme-corp',
  'https://via.placeholder.com/200',
  NOW(),
  NOW()
) ON CONFLICT DO NOTHING;

-- Get the organization ID for subsequent inserts
-- Run this separately to get ORG_ID:
-- SELECT id FROM organizations WHERE name = 'Acme Corporation' LIMIT 1;
-- Replace ORG_ID in below queries with the actual UUID

-- STEP 2: Create Demo Warehouses
-- ============================================================================
-- Replace ORG_ID with actual organization UUID
INSERT INTO warehouses (
  organization_id,
  name,
  location,
  address,
  city,
  state,
  zip,
  capacity,
  created_at,
  updated_at
) VALUES
(
  'YOUR_ORG_ID_HERE',
  'Main Warehouse',
  'Downtown',
  '123 Main St',
  'New York',
  'NY',
  '10001',
  10000,
  NOW(),
  NOW()
),
(
  'YOUR_ORG_ID_HERE',
  'East Coast Hub',
  'New Jersey',
  '456 Industrial Ave',
  'Newark',
  'NJ',
  '07102',
  5000,
  NOW(),
  NOW()
),
(
  'YOUR_ORG_ID_HERE',
  'West Coast Distribution',
  'Los Angeles',
  '789 Commerce Blvd',
  'Los Angeles',
  'CA',
  '90001',
  8000,
  NOW(),
  NOW()
) ON CONFLICT DO NOTHING;

-- STEP 3: Create Demo Products
-- ============================================================================
INSERT INTO products (
  organization_id,
  name,
  sku,
  description,
  price,
  category,
  created_at,
  updated_at
) VALUES
(
  'YOUR_ORG_ID_HERE',
  'Laptop Pro 15',
  'LAPTOP-001',
  'High-performance laptop for professionals',
  1299.99,
  'electronics',
  NOW(),
  NOW()
),
(
  'YOUR_ORG_ID_HERE',
  'Wireless Mouse',
  'MOUSE-001',
  'Ergonomic wireless mouse',
  49.99,
  'accessories',
  NOW(),
  NOW()
),
(
  'YOUR_ORG_ID_HERE',
  'USB-C Cable',
  'CABLE-001',
  '2-meter USB-C charging cable',
  19.99,
  'accessories',
  NOW(),
  NOW()
),
(
  'YOUR_ORG_ID_HERE',
  'Monitor 4K',
  'MONITOR-001',
  '27-inch 4K UltraHD monitor',
  699.99,
  'electronics',
  NOW(),
  NOW()
),
(
  'YOUR_ORG_ID_HERE',
  'Keyboard Mechanical',
  'KEYBOARD-001',
  'RGB Mechanical Gaming Keyboard',
  149.99,
  'accessories',
  NOW(),
  NOW()
) ON CONFLICT DO NOTHING;

-- STEP 4: Create Demo Inventory
-- ============================================================================
-- Replace WAREHOUSE_ID_1, WAREHOUSE_ID_2, WAREHOUSE_ID_3 with actual IDs
-- Get IDs from: SELECT id FROM warehouses WHERE organization_id = 'YOUR_ORG_ID_HERE';
INSERT INTO inventory (
  organization_id,
  warehouse_id,
  product_id,
  quantity,
  reserved,
  reorder_level,
  created_at,
  updated_at
) VALUES
-- Main Warehouse stock
(
  'YOUR_ORG_ID_HERE',
  'WAREHOUSE_ID_1',
  'PRODUCT_ID_1',
  150,
  20,
  30,
  NOW(),
  NOW()
),
(
  'YOUR_ORG_ID_HERE',
  'WAREHOUSE_ID_1',
  'PRODUCT_ID_2',
  500,
  50,
  100,
  NOW(),
  NOW()
),
(
  'YOUR_ORG_ID_HERE',
  'WAREHOUSE_ID_1',
  'PRODUCT_ID_3',
  1000,
  100,
  200,
  NOW(),
  NOW()
),
-- East Coast Hub stock
(
  'YOUR_ORG_ID_HERE',
  'WAREHOUSE_ID_2',
  'PRODUCT_ID_4',
  75,
  10,
  20,
  NOW(),
  NOW()
),
(
  'YOUR_ORG_ID_HERE',
  'WAREHOUSE_ID_2',
  'PRODUCT_ID_5',
  200,
  25,
  50,
  NOW(),
  NOW()
),
-- West Coast Distribution stock
(
  'YOUR_ORG_ID_HERE',
  'WAREHOUSE_ID_3',
  'PRODUCT_ID_1',
  100,
  15,
  30,
  NOW(),
  NOW()
),
(
  'YOUR_ORG_ID_HERE',
  'WAREHOUSE_ID_3',
  'PRODUCT_ID_4',
  80,
  10,
  20,
  NOW(),
  NOW()
) ON CONFLICT DO NOTHING;

-- STEP 5: Create Demo Customers
-- ============================================================================
INSERT INTO customers (
  organization_id,
  name,
  email,
  phone,
  company,
  address,
  city,
  state,
  zip,
  created_at,
  updated_at
) VALUES
(
  'YOUR_ORG_ID_HERE',
  'John Smith',
  'john.smith@company.com',
  '+1-212-555-0100',
  'Smith Industries',
  '100 Business Ave',
  'New York',
  'NY',
  '10001',
  NOW(),
  NOW()
),
(
  'YOUR_ORG_ID_HERE',
  'Sarah Johnson',
  'sarah@techcorp.com',
  '+1-415-555-0200',
  'Tech Corp',
  '200 Innovation Blvd',
  'San Francisco',
  'CA',
  '94105',
  NOW(),
  NOW()
),
(
  'YOUR_ORG_ID_HERE',
  'Mike Chen',
  'mike.chen@retailers.com',
  '+1-312-555-0300',
  'Retail Plus',
  '300 Commerce St',
  'Chicago',
  'IL',
  '60601',
  NOW(),
  NOW()
),
(
  'YOUR_ORG_ID_HERE',
  'Emily Davis',
  'emily@distributors.com',
  '+1-206-555-0400',
  'National Distributors',
  '400 Logistics Lane',
  'Seattle',
  'WA',
  '98101',
  NOW(),
  NOW()
) ON CONFLICT DO NOTHING;

-- STEP 6: Create Demo Orders
-- ============================================================================
-- Replace CUSTOMER_ID_1, CUSTOMER_ID_2, etc with actual customer IDs
-- Get IDs from: SELECT id FROM customers WHERE organization_id = 'YOUR_ORG_ID_HERE';
INSERT INTO orders (
  organization_id,
  customer_id,
  total,
  status,
  notes,
  created_at,
  updated_at
) VALUES
(
  'YOUR_ORG_ID_HERE',
  'CUSTOMER_ID_1',
  5999.95,
  'pending',
  'Initial order for Smith Industries',
  NOW() - INTERVAL '5 days',
  NOW() - INTERVAL '5 days'
),
(
  'YOUR_ORG_ID_HERE',
  'CUSTOMER_ID_2',
  2449.96,
  'processing',
  'Tech Corp expansion order',
  NOW() - INTERVAL '3 days',
  NOW() - INTERVAL '2 days'
),
(
  'YOUR_ORG_ID_HERE',
  'CUSTOMER_ID_3',
  3499.93,
  'shipped',
  'Retail Plus bulk order',
  NOW() - INTERVAL '7 days',
  NOW() - INTERVAL '2 days'
),
(
  'YOUR_ORG_ID_HERE',
  'CUSTOMER_ID_4',
  4199.94,
  'delivered',
  'National Distributors quarterly order',
  NOW() - INTERVAL '10 days',
  NOW() - INTERVAL '1 day'
) ON CONFLICT DO NOTHING;

-- ============================================================================
-- DEMO DATA SETUP COMPLETE
-- ============================================================================
-- You now have:
-- - 1 Demo Organization
-- - 3 Warehouses with different capacities
-- - 5 Products across categories
-- - 7 Inventory records across warehouses
-- - 4 Customers
-- - 4 Orders in different statuses
-- ============================================================================

-- Verify data was created:
-- SELECT COUNT(*) FROM organizations;
-- SELECT COUNT(*) FROM warehouses;
-- SELECT COUNT(*) FROM products;
-- SELECT COUNT(*) FROM customers;
-- SELECT COUNT(*) FROM orders;
-- SELECT COUNT(*) FROM inventory;

