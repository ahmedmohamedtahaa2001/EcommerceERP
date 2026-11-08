-- Operix ERP - Supabase Database Schema
-- Multi-tenant database with RLS for security
-- Created for Browser Extension setup

-- ============================================================================
-- 1. COMPANIES TABLE (Multi-tenant root)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  industry VARCHAR(100),
  website VARCHAR(255),
  country VARCHAR(100) NOT NULL,
  active BOOLEAN DEFAULT true,
  subscription VARCHAR(50) DEFAULT 'free' CHECK (subscription IN ('free', 'starter', 'pro', 'enterprise')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 2. WAREHOUSES TABLE (Physical locations)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.warehouses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  location VARCHAR(255) NOT NULL,
  address VARCHAR(255) NOT NULL,
  city VARCHAR(100) NOT NULL,
  state VARCHAR(100) NOT NULL,
  zip_code VARCHAR(20) NOT NULL,
  country VARCHAR(100) NOT NULL,
  is_default BOOLEAN DEFAULT false,
  capacity INTEGER NOT NULL,
  current_utilization INTEGER DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 3. PRODUCTS TABLE (Product catalog)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  sku VARCHAR(100) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100) NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  cost DECIMAL(10, 2) NOT NULL,
  margin DECIMAL(5, 2),
  weight DECIMAL(10, 3),
  dimensions JSONB,
  active BOOLEAN DEFAULT true,
  barcode VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, sku)
);

-- ============================================================================
-- 4. INVENTORY TABLE (Stock levels by product and warehouse)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  warehouse_id UUID NOT NULL REFERENCES public.warehouses(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 0,
  reserved INTEGER NOT NULL DEFAULT 0,
  available INTEGER GENERATED ALWAYS AS (quantity - reserved) STORED,
  reorder_level INTEGER DEFAULT 10,
  reorder_quantity INTEGER DEFAULT 50,
  last_restocked TIMESTAMPTZ,
  last_checked TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, product_id, warehouse_id)
);

-- ============================================================================
-- 5. STOCK_MOVEMENTS TABLE (Audit trail - IMMUTABLE)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  inventory_id UUID NOT NULL REFERENCES public.inventory(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  warehouse_id UUID NOT NULL REFERENCES public.warehouses(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL CHECK (type IN ('add', 'remove', 'adjust', 'transfer_in', 'transfer_out')),
  quantity_before INTEGER NOT NULL,
  quantity_after INTEGER NOT NULL,
  quantity_changed INTEGER NOT NULL,
  reason VARCHAR(100) NOT NULL,
  notes TEXT,
  from_warehouse_id UUID REFERENCES public.warehouses(id),
  to_warehouse_id UUID REFERENCES public.warehouses(id),
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 6. USERS TABLE (Application users)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'manager', 'user')),
  department VARCHAR(100),
  phone VARCHAR(20),
  avatar VARCHAR(255),
  active BOOLEAN DEFAULT true,
  permissions JSONB DEFAULT '[]'::jsonb,
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 7. AUDIT_LOGS TABLE (System audit trail - IMMUTABLE)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id),
  action VARCHAR(50) NOT NULL CHECK (action IN ('create', 'read', 'update', 'delete')),
  resource VARCHAR(100) NOT NULL,
  resource_id UUID NOT NULL,
  changes JSONB,
  ip_address VARCHAR(45),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Warehouses indexes
CREATE INDEX idx_warehouses_company_id ON public.warehouses(company_id);
CREATE INDEX idx_warehouses_company_created ON public.warehouses(company_id, created_at DESC);

-- Products indexes
CREATE INDEX idx_products_company_id ON public.products(company_id);
CREATE INDEX idx_products_company_active ON public.products(company_id, active);
CREATE INDEX idx_products_company_created ON public.products(company_id, created_at DESC);

-- Inventory indexes
CREATE INDEX idx_inventory_company_id ON public.inventory(company_id);
CREATE INDEX idx_inventory_company_product_warehouse ON public.inventory(company_id, product_id, warehouse_id);
CREATE INDEX idx_inventory_warehouse_quantity ON public.inventory(warehouse_id, quantity);
CREATE INDEX idx_inventory_company_updated ON public.inventory(company_id, updated_at DESC);
CREATE INDEX idx_inventory_low_stock ON public.inventory(company_id, warehouse_id) WHERE quantity <= reorder_level;

-- Stock movements indexes
CREATE INDEX idx_stock_movements_company_id ON public.stock_movements(company_id);
CREATE INDEX idx_stock_movements_company_created ON public.stock_movements(company_id, created_at DESC);
CREATE INDEX idx_stock_movements_warehouse_created ON public.stock_movements(warehouse_id, created_at DESC);
CREATE INDEX idx_stock_movements_product_created ON public.stock_movements(product_id, created_at DESC);

-- Users indexes
CREATE INDEX idx_users_company_id ON public.users(company_id);
CREATE INDEX idx_users_company_active ON public.users(company_id, active);

-- Audit logs indexes
CREATE INDEX idx_audit_logs_company_id ON public.audit_logs(company_id);
CREATE INDEX idx_audit_logs_company_created ON public.audit_logs(company_id, created_at DESC);
CREATE INDEX idx_audit_logs_user_created ON public.audit_logs(user_id, created_at DESC);

-- ============================================================================
-- ENABLE RLS ON ALL TABLES
-- ============================================================================
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- SAMPLE DATA (optional - for testing)
-- ============================================================================

-- Insert sample company
INSERT INTO public.companies (name, email, industry, website, country, active, subscription)
VALUES (
  'Demo Retail Co',
  'demo@example.com',
  'Retail',
  'https://demo.example.com',
  'US',
  true,
  'premium'
) ON CONFLICT DO NOTHING;

-- Note: After inserting company, get the company_id and use it for other inserts
-- Example: INSERT INTO warehouses (company_id, ...) VALUES ('COMPANY_ID', ...);
