-- ============================================================================
-- OPERIX ERP - COMPLETE SUPABASE SCHEMA
-- Production-Ready, Multi-Tenant, Scalable Database
-- ============================================================================

-- ============================================================================
-- PART 1: CREATE SCHEMA AND ENABLE EXTENSIONS
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS public;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- PART 2: CREATE CORE TABLES
-- ============================================================================

-- TABLE 1: ORGANIZATIONS (Multi-tenant root)
CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL UNIQUE,
  industry VARCHAR(100),
  website VARCHAR(255),
  country VARCHAR(100) NOT NULL,
  timezone VARCHAR(50) DEFAULT 'UTC',
  active BOOLEAN DEFAULT true,
  subscription_tier VARCHAR(50) DEFAULT 'free' CHECK (subscription_tier IN ('free', 'starter', 'pro', 'enterprise')),
  subscription_start_date TIMESTAMPTZ,
  subscription_end_date TIMESTAMPTZ,
  max_users INTEGER DEFAULT 10,
  features JSONB DEFAULT '[]'::jsonb,
  settings JSONB DEFAULT '{}'::jsonb,
  billing_address JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_organizations_active ON public.organizations(active);
CREATE INDEX idx_organizations_created ON public.organizations(created_at DESC);

-- TABLE 2: ROLES & PERMISSIONS
CREATE TABLE IF NOT EXISTS public.roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  display_name VARCHAR(255),
  description TEXT,
  permissions JSONB DEFAULT '[]'::jsonb,
  priority INTEGER DEFAULT 0,
  is_system_role BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, name)
);

CREATE INDEX idx_roles_organization ON public.roles(organization_id);
CREATE INDEX idx_roles_system ON public.roles(is_system_role);

-- TABLE 3: USERS (Application users)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  full_name VARCHAR(255),
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE RESTRICT,
  department VARCHAR(100),
  phone VARCHAR(20),
  avatar_url VARCHAR(255),
  active BOOLEAN DEFAULT true,
  last_login TIMESTAMPTZ,
  last_activity TIMESTAMPTZ,
  preferences JSONB DEFAULT '{}'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, email)
);

CREATE INDEX idx_users_organization ON public.users(organization_id);
CREATE INDEX idx_users_role ON public.users(role_id);
CREATE INDEX idx_users_active ON public.users(organization_id, active);
CREATE INDEX idx_users_created ON public.users(created_at DESC);

-- TABLE 4: WAREHOUSES (Physical locations)
CREATE TABLE IF NOT EXISTS public.warehouses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  address JSONB,
  phone VARCHAR(20),
  email VARCHAR(100),
  manager_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  warehouse_type VARCHAR(50) DEFAULT 'storage',
  capacity INTEGER NOT NULL,
  current_utilization INTEGER DEFAULT 0,
  opening_hours JSONB,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, code)
);

CREATE INDEX idx_warehouses_organization ON public.warehouses(organization_id);
CREATE INDEX idx_warehouses_active ON public.warehouses(organization_id, is_active);
CREATE INDEX idx_warehouses_created ON public.warehouses(created_at DESC);
CREATE INDEX idx_warehouses_manager ON public.warehouses(manager_id);

-- TABLE 5: PRODUCTS (Product catalog)
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  sku VARCHAR(100) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100) NOT NULL,
  subcategory VARCHAR(100),
  manufacturer VARCHAR(255),
  manufacturer_code VARCHAR(100),
  brand VARCHAR(100),
  pricing JSONB DEFAULT '{}'::jsonb,
  dimensions JSONB DEFAULT '{}'::jsonb,
  weight NUMERIC,
  volume NUMERIC,
  barcode VARCHAR(100),
  qr_code VARCHAR(255),
  is_active BOOLEAN DEFAULT true,
  is_discontinued BOOLEAN DEFAULT false,
  is_hazardous BOOLEAN DEFAULT false,
  storage_requirements JSONB DEFAULT '{}'::jsonb,
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  metadata JSONB DEFAULT '{}'::jsonb,
  created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, sku)
);

CREATE INDEX idx_products_organization ON public.products(organization_id);
CREATE INDEX idx_products_active ON public.products(organization_id, is_active);
CREATE INDEX idx_products_category ON public.products(organization_id, category);
CREATE INDEX idx_products_sku ON public.products(sku);
CREATE INDEX idx_products_barcode ON public.products(barcode);
CREATE INDEX idx_products_created ON public.products(created_at DESC);

-- TABLE 6: INVENTORY (Stock levels)
CREATE TABLE IF NOT EXISTS public.inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  warehouse_id UUID NOT NULL REFERENCES public.warehouses(id) ON DELETE CASCADE,
  quantity_on_hand INTEGER DEFAULT 0,
  quantity_reserved INTEGER DEFAULT 0,
  quantity_damaged INTEGER DEFAULT 0,
  quantity_available INTEGER GENERATED ALWAYS AS (quantity_on_hand - quantity_reserved) STORED,
  quantity_on_order INTEGER DEFAULT 0,
  reorder_point INTEGER DEFAULT 10,
  reorder_quantity INTEGER DEFAULT 50,
  lead_time_days INTEGER DEFAULT 0,
  turnover_rate NUMERIC DEFAULT 0,
  safety_stock_days INTEGER DEFAULT 0,
  last_counted TIMESTAMPTZ,
  last_restocked TIMESTAMPTZ,
  last_sold TIMESTAMPTZ,
  expiration_date TIMESTAMPTZ,
  batch_number VARCHAR(100),
  location_in_warehouse VARCHAR(255),
  is_active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, product_id, warehouse_id)
);

CREATE INDEX idx_inventory_organization ON public.inventory(organization_id);
CREATE INDEX idx_inventory_product_warehouse ON public.inventory(organization_id, product_id, warehouse_id);
CREATE INDEX idx_inventory_warehouse_quantity ON public.inventory(warehouse_id, quantity_available);
CREATE INDEX idx_inventory_low_stock ON public.inventory(organization_id, warehouse_id)
  WHERE quantity_available <= reorder_point;
CREATE INDEX idx_inventory_product ON public.inventory(product_id);
CREATE INDEX idx_inventory_updated ON public.inventory(updated_at DESC);

-- TABLE 7: STOCK_MOVEMENTS (Immutable audit trail)
CREATE TABLE IF NOT EXISTS public.stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  inventory_id UUID NOT NULL REFERENCES public.inventory(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  warehouse_id UUID NOT NULL REFERENCES public.warehouses(id) ON DELETE CASCADE,
  movement_type VARCHAR(50) NOT NULL CHECK (movement_type IN ('add', 'remove', 'adjust', 'transfer_in', 'transfer_out', 'count', 'damage', 'return')),
  quantity_before INTEGER NOT NULL,
  quantity_after INTEGER NOT NULL,
  quantity_changed INTEGER NOT NULL,
  reason VARCHAR(100) NOT NULL,
  reference_number VARCHAR(100),
  notes TEXT,
  from_warehouse_id UUID REFERENCES public.warehouses(id) ON DELETE SET NULL,
  to_warehouse_id UUID REFERENCES public.warehouses(id) ON DELETE SET NULL,
  initiated_by_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  approved_by_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  approval_timestamp TIMESTAMPTZ,
  document_url VARCHAR(255),
  cost_impact NUMERIC,
  created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  batch_id UUID,
  CONSTRAINT valid_quantity_change CHECK (quantity_changed = quantity_after - quantity_before)
);

CREATE INDEX idx_stock_movements_organization ON public.stock_movements(organization_id);
CREATE INDEX idx_stock_movements_created ON public.stock_movements(organization_id, created_at DESC);
CREATE INDEX idx_stock_movements_warehouse ON public.stock_movements(warehouse_id, created_at DESC);
CREATE INDEX idx_stock_movements_product ON public.stock_movements(product_id, created_at DESC);
CREATE INDEX idx_stock_movements_batch ON public.stock_movements(batch_id);

-- Prevent updates and deletes on stock_movements (immutable)
CREATE TRIGGER prevent_stock_movements_update
  BEFORE UPDATE ON public.stock_movements
  FOR EACH ROW
  EXECUTE FUNCTION raise_immutable_error();

CREATE TRIGGER prevent_stock_movements_delete
  BEFORE DELETE ON public.stock_movements
  FOR EACH ROW
  EXECUTE FUNCTION raise_immutable_error();

-- TABLE 8: AUDIT_LOGS (System audit trail)
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  action VARCHAR(50) NOT NULL CHECK (action IN ('create', 'read', 'update', 'delete', 'export', 'import')),
  resource_type VARCHAR(100) NOT NULL,
  resource_id UUID,
  resource_name VARCHAR(255),
  old_values JSONB,
  new_values JSONB,
  changes JSONB,
  status VARCHAR(50) DEFAULT 'success',
  error_message TEXT,
  ip_address INET,
  user_agent TEXT,
  session_id VARCHAR(255),
  request_id VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_organization ON public.audit_logs(organization_id);
CREATE INDEX idx_audit_logs_created ON public.audit_logs(organization_id, created_at DESC);
CREATE INDEX idx_audit_logs_user ON public.audit_logs(user_id, created_at DESC);
CREATE INDEX idx_audit_logs_resource ON public.audit_logs(resource_type, resource_id);

-- Prevent updates and deletes on audit_logs (immutable)
CREATE TRIGGER prevent_audit_logs_update
  BEFORE UPDATE ON public.audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION raise_immutable_error();

CREATE TRIGGER prevent_audit_logs_delete
  BEFORE DELETE ON public.audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION raise_immutable_error();

-- ============================================================================
-- PART 3: HELPER FUNCTIONS
-- ============================================================================

-- Function to get user's organization ID
CREATE OR REPLACE FUNCTION public.auth_organization_id()
RETURNS UUID AS $$
  SELECT organization_id FROM public.users WHERE id = auth.uid()
$$ LANGUAGE SQL STABLE;

-- Function to get user's role
CREATE OR REPLACE FUNCTION public.auth_user_role()
RETURNS VARCHAR AS $$
  SELECT r.name FROM public.users u
  JOIN public.roles r ON u.role_id = r.id
  WHERE u.id = auth.uid()
$$ LANGUAGE SQL STABLE;

-- Function to check if user has permission
CREATE OR REPLACE FUNCTION public.auth_has_permission(p_permission VARCHAR)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users u
    JOIN public.roles r ON u.role_id = r.id
    WHERE u.id = auth.uid()
    AND (
      r.permissions @> '["*.*"]'::jsonb OR
      r.permissions @> to_jsonb(ARRAY[p_permission])
    )
  )
$$ LANGUAGE SQL STABLE;

-- Function to raise immutable error
CREATE OR REPLACE FUNCTION public.raise_immutable_error()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'This record is immutable and cannot be modified';
END;
$$ LANGUAGE plpgsql;

-- Function to update organization timestamp
CREATE OR REPLACE FUNCTION public.update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- PART 4: TRIGGERS FOR AUTOMATION
-- ============================================================================

-- Update timestamps on all tables
CREATE TRIGGER update_organizations_timestamp
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_timestamp();

CREATE TRIGGER update_roles_timestamp
  BEFORE UPDATE ON public.roles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_timestamp();

CREATE TRIGGER update_users_timestamp
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.update_timestamp();

CREATE TRIGGER update_warehouses_timestamp
  BEFORE UPDATE ON public.warehouses
  FOR EACH ROW
  EXECUTE FUNCTION public.update_timestamp();

CREATE TRIGGER update_products_timestamp
  BEFORE UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.update_timestamp();

CREATE TRIGGER update_inventory_timestamp
  BEFORE UPDATE ON public.inventory
  FOR EACH ROW
  EXECUTE FUNCTION public.update_timestamp();

-- ============================================================================
-- PART 5: ENABLE ROW LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PART 6: ROW LEVEL SECURITY POLICIES
-- ============================================================================

-- ORGANIZATIONS: Only admins of organization can view/edit
CREATE POLICY "Organizations: Admins can view own organization" ON public.organizations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users u
      JOIN public.roles r ON u.role_id = r.id
      WHERE u.organization_id = organizations.id
        AND u.id = auth.uid()
        AND r.name = 'admin'
    )
  );

CREATE POLICY "Organizations: Admins can update own organization" ON public.organizations
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.users u
      JOIN public.roles r ON u.role_id = r.id
      WHERE u.organization_id = organizations.id
        AND u.id = auth.uid()
        AND r.name = 'admin'
    )
  );

-- ROLES: Members can view, admins can edit
CREATE POLICY "Roles: Organization members can view" ON public.roles
  FOR SELECT USING (
    organization_id = public.auth_organization_id()
  );

CREATE POLICY "Roles: Admins can insert" ON public.roles
  FOR INSERT WITH CHECK (
    organization_id = public.auth_organization_id()
    AND public.auth_user_role() = 'admin'
  );

CREATE POLICY "Roles: Admins can update" ON public.roles
  FOR UPDATE USING (
    organization_id = public.auth_organization_id()
    AND public.auth_user_role() = 'admin'
    AND NOT is_system_role
  );

CREATE POLICY "Roles: Admins can delete" ON public.roles
  FOR DELETE USING (
    organization_id = public.auth_organization_id()
    AND public.auth_user_role() = 'admin'
    AND NOT is_system_role
  );

-- USERS: Members can view each other, admins can manage
CREATE POLICY "Users: Organization members can view" ON public.users
  FOR SELECT USING (
    organization_id = public.auth_organization_id()
  );

CREATE POLICY "Users: Users can view own profile" ON public.users
  FOR SELECT USING (
    id = auth.uid()
  );

CREATE POLICY "Users: Users can update own profile" ON public.users
  FOR UPDATE USING (
    id = auth.uid()
  );

CREATE POLICY "Users: Admins can insert" ON public.users
  FOR INSERT WITH CHECK (
    organization_id = public.auth_organization_id()
    AND public.auth_user_role() = 'admin'
  );

CREATE POLICY "Users: Admins can update" ON public.users
  FOR UPDATE USING (
    organization_id = public.auth_organization_id()
    AND public.auth_user_role() = 'admin'
  );

CREATE POLICY "Users: Admins can delete" ON public.users
  FOR DELETE USING (
    organization_id = public.auth_organization_id()
    AND public.auth_user_role() = 'admin'
  );

-- WAREHOUSES: Members view, managers/admins edit
CREATE POLICY "Warehouses: Organization members can view" ON public.warehouses
  FOR SELECT USING (
    organization_id = public.auth_organization_id()
  );

CREATE POLICY "Warehouses: Managers can insert" ON public.warehouses
  FOR INSERT WITH CHECK (
    organization_id = public.auth_organization_id()
    AND public.auth_user_role() IN ('manager', 'admin')
  );

CREATE POLICY "Warehouses: Managers can update" ON public.warehouses
  FOR UPDATE USING (
    organization_id = public.auth_organization_id()
    AND public.auth_user_role() IN ('manager', 'admin')
  );

CREATE POLICY "Warehouses: Admins can delete" ON public.warehouses
  FOR DELETE USING (
    organization_id = public.auth_organization_id()
    AND public.auth_user_role() = 'admin'
  );

-- PRODUCTS: Members view, managers/admins edit
CREATE POLICY "Products: Organization members can view" ON public.products
  FOR SELECT USING (
    organization_id = public.auth_organization_id()
  );

CREATE POLICY "Products: Managers can insert" ON public.products
  FOR INSERT WITH CHECK (
    organization_id = public.auth_organization_id()
    AND public.auth_user_role() IN ('manager', 'admin')
  );

CREATE POLICY "Products: Managers can update" ON public.products
  FOR UPDATE USING (
    organization_id = public.auth_organization_id()
    AND public.auth_user_role() IN ('manager', 'admin')
  );

CREATE POLICY "Products: Admins can delete" ON public.products
  FOR DELETE USING (
    organization_id = public.auth_organization_id()
    AND public.auth_user_role() = 'admin'
  );

-- INVENTORY: Members view, managers/admins edit
CREATE POLICY "Inventory: Organization members can view" ON public.inventory
  FOR SELECT USING (
    organization_id = public.auth_organization_id()
  );

CREATE POLICY "Inventory: Users can insert" ON public.inventory
  FOR INSERT WITH CHECK (
    organization_id = public.auth_organization_id()
  );

CREATE POLICY "Inventory: Managers can update" ON public.inventory
  FOR UPDATE USING (
    organization_id = public.auth_organization_id()
    AND public.auth_user_role() IN ('manager', 'admin')
  );

CREATE POLICY "Inventory: Admins can delete" ON public.inventory
  FOR DELETE USING (
    organization_id = public.auth_organization_id()
    AND public.auth_user_role() = 'admin'
  );

-- STOCK_MOVEMENTS: Read-only for users, immutable
CREATE POLICY "Stock Movements: Organization members can view" ON public.stock_movements
  FOR SELECT USING (
    organization_id = public.auth_organization_id()
  );

CREATE POLICY "Stock Movements: System can insert" ON public.stock_movements
  FOR INSERT WITH CHECK (
    organization_id = public.auth_organization_id()
  );

-- AUDIT_LOGS: Read-only for viewing, system creates
CREATE POLICY "Audit Logs: Organization members can view" ON public.audit_logs
  FOR SELECT USING (
    organization_id = public.auth_organization_id()
  );

CREATE POLICY "Audit Logs: System can insert" ON public.audit_logs
  FOR INSERT WITH CHECK (
    organization_id = public.auth_organization_id()
  );

-- ============================================================================
-- PART 7: SAMPLE DATA
-- ============================================================================

-- Insert sample organization
INSERT INTO public.organizations (name, email, industry, website, country, active, subscription_tier, max_users)
VALUES (
  'Demo Retail Corp',
  'admin@demoretail.com',
  'Retail',
  'https://demo.example.com',
  'US',
  true,
  'premium',
  50
) ON CONFLICT (email) DO NOTHING
RETURNING id AS organization_id;

-- Note: Copy the organization_id from above and use it for remaining inserts
