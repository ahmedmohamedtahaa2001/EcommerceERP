-- ============================================================================
-- OPERIX ERP - COMPLETE RLS SETUP SCRIPT
-- ============================================================================
-- Run this in Supabase SQL Editor to enable security
-- Copy each section and run individually or run entire script
-- ============================================================================

-- SECTION 1: Enable RLS on all tables
-- ============================================================================
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- SECTION 2: Inventory Table Policies
-- ============================================================================
CREATE POLICY "Users can view own organization inventory"
  ON inventory
  FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM users WHERE id = auth.uid()
  ));

CREATE POLICY "Users can insert inventory in own organization"
  ON inventory
  FOR INSERT
  WITH CHECK (organization_id IN (
    SELECT organization_id FROM users WHERE id = auth.uid()
  ));

CREATE POLICY "Users can update inventory in own organization"
  ON inventory
  FOR UPDATE
  USING (organization_id IN (
    SELECT organization_id FROM users WHERE id = auth.uid()
  ))
  WITH CHECK (organization_id IN (
    SELECT organization_id FROM users WHERE id = auth.uid()
  ));

CREATE POLICY "Users can delete inventory in own organization"
  ON inventory
  FOR DELETE
  USING (organization_id IN (
    SELECT organization_id FROM users WHERE id = auth.uid()
  ));

-- SECTION 3: Stock Movements Table Policies
-- ============================================================================
CREATE POLICY "Users can view own organization stock movements"
  ON stock_movements
  FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM users WHERE id = auth.uid()
  ));

CREATE POLICY "Users can insert stock movements in own organization"
  ON stock_movements
  FOR INSERT
  WITH CHECK (organization_id IN (
    SELECT organization_id FROM users WHERE id = auth.uid()
  ));

-- SECTION 4: Products Table Policies
-- ============================================================================
CREATE POLICY "Users can view own organization products"
  ON products
  FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM users WHERE id = auth.uid()
  ));

CREATE POLICY "Users can insert products in own organization"
  ON products
  FOR INSERT
  WITH CHECK (organization_id IN (
    SELECT organization_id FROM users WHERE id = auth.uid()
  ));

CREATE POLICY "Users can update products in own organization"
  ON products
  FOR UPDATE
  USING (organization_id IN (
    SELECT organization_id FROM users WHERE id = auth.uid()
  ))
  WITH CHECK (organization_id IN (
    SELECT organization_id FROM users WHERE id = auth.uid()
  ));

CREATE POLICY "Users can delete products in own organization"
  ON products
  FOR DELETE
  USING (organization_id IN (
    SELECT organization_id FROM users WHERE id = auth.uid()
  ));

-- SECTION 5: Orders Table Policies
-- ============================================================================
CREATE POLICY "Users can view own organization orders"
  ON orders
  FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM users WHERE id = auth.uid()
  ));

CREATE POLICY "Users can insert orders in own organization"
  ON orders
  FOR INSERT
  WITH CHECK (organization_id IN (
    SELECT organization_id FROM users WHERE id = auth.uid()
  ));

CREATE POLICY "Users can update orders in own organization"
  ON orders
  FOR UPDATE
  USING (organization_id IN (
    SELECT organization_id FROM users WHERE id = auth.uid()
  ))
  WITH CHECK (organization_id IN (
    SELECT organization_id FROM users WHERE id = auth.uid()
  ));

CREATE POLICY "Users can delete orders in own organization"
  ON orders
  FOR DELETE
  USING (organization_id IN (
    SELECT organization_id FROM users WHERE id = auth.uid()
  ));

-- SECTION 6: Customers Table Policies
-- ============================================================================
CREATE POLICY "Users can view own organization customers"
  ON customers
  FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM users WHERE id = auth.uid()
  ));

CREATE POLICY "Users can insert customers in own organization"
  ON customers
  FOR INSERT
  WITH CHECK (organization_id IN (
    SELECT organization_id FROM users WHERE id = auth.uid()
  ));

CREATE POLICY "Users can update customers in own organization"
  ON customers
  FOR UPDATE
  USING (organization_id IN (
    SELECT organization_id FROM users WHERE id = auth.uid()
  ))
  WITH CHECK (organization_id IN (
    SELECT organization_id FROM users WHERE id = auth.uid()
  ));

CREATE POLICY "Users can delete customers in own organization"
  ON customers
  FOR DELETE
  USING (organization_id IN (
    SELECT organization_id FROM users WHERE id = auth.uid()
  ));

-- SECTION 7: Warehouses Table Policies
-- ============================================================================
CREATE POLICY "Users can view own organization warehouses"
  ON warehouses
  FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM users WHERE id = auth.uid()
  ));

CREATE POLICY "Users can insert warehouses in own organization"
  ON warehouses
  FOR INSERT
  WITH CHECK (organization_id IN (
    SELECT organization_id FROM users WHERE id = auth.uid()
  ));

CREATE POLICY "Users can update warehouses in own organization"
  ON warehouses
  FOR UPDATE
  USING (organization_id IN (
    SELECT organization_id FROM users WHERE id = auth.uid()
  ))
  WITH CHECK (organization_id IN (
    SELECT organization_id FROM users WHERE id = auth.uid()
  ));

CREATE POLICY "Users can delete warehouses in own organization"
  ON warehouses
  FOR DELETE
  USING (organization_id IN (
    SELECT organization_id FROM users WHERE id = auth.uid()
  ));

-- SECTION 8: Audit Logs Table Policies (Read-Only)
-- ============================================================================
CREATE POLICY "Users can view own organization audit logs"
  ON audit_logs
  FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM users WHERE id = auth.uid()
  ));

-- SECTION 9: Users Table Policies
-- ============================================================================
CREATE POLICY "Users can view own user record"
  ON users
  FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "Users can update own user record"
  ON users
  FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid() AND organization_id IN (
    SELECT organization_id FROM users WHERE id = auth.uid()
  ));

-- SECTION 10: Organizations Table Policies
-- ============================================================================
CREATE POLICY "Users can view own organization"
  ON organizations
  FOR SELECT
  USING (id IN (
    SELECT organization_id FROM users WHERE id = auth.uid()
  ));

-- SECTION 11: Roles Table Policies
-- ============================================================================
CREATE POLICY "Users can view roles in their organization"
  ON roles
  FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM users WHERE id = auth.uid()
  ));

-- ============================================================================
-- SETUP COMPLETE
-- ============================================================================
-- All tables now have Row Level Security enabled
-- All users can only access their organization's data
-- Data isolation is now enforced at database level
-- ============================================================================

-- Verify policies are created (run this to check):
-- SELECT * FROM pg_policies WHERE tablename IN ('inventory', 'products', 'orders', 'customers', 'warehouses', 'users', 'organizations', 'audit_logs', 'stock_movements', 'roles');

