# SUPABASE COMPLETE SETUP - EXECUTION GUIDE

## Production-Ready Operix ERP Database

---

## 📋 TABLE OF CONTENTS

1. [Phase 1: Project Setup](#phase-1-project-setup)
2. [Phase 2: Create Schema](#phase-2-create-schema)
3. [Phase 3: Add Sample Data](#phase-3-add-sample-data)
4. [Phase 4: Test RLS & Security](#phase-4-test-rls--security)
5. [Phase 5: Get Credentials](#phase-5-get-credentials)
6. [Phase 6: Environment Setup](#phase-6-environment-setup)

---

## PHASE 1: PROJECT SETUP

### Step 1.1: Create Supabase Project

**Actions:**

1. Go to https://supabase.com/dashboard
2. Click "New project"
3. Enter:
   - Project Name: `operix-erp-prod`
   - Password: Generate strong password (save it!)
   - Region: Select closest to your location
4. Click "Create new project"
5. Wait 3-5 minutes for initialization

**Save this information:**

```
Organization Name: [your-org]
Project Name: operix-erp-prod
Project URL: https://[project-id].supabase.co
Database Password: [save securely]
Region: [selected-region]
```

---

## PHASE 2: CREATE SCHEMA

### Step 2.1: Access SQL Editor

**In Supabase Dashboard:**

1. Go to SQL Editor (left sidebar)
2. Click "New query"

### Step 2.2: Create All Tables and Functions

**Copy the ENTIRE content of `SUPABASE_COMPLETE_SCHEMA.sql`:**

- This file contains:
  - All 8 tables with relationships
  - Indexes for performance
  - Helper functions
  - Triggers for automation
  - RLS policies
  - Sample organization

**How to run:**

1. Open `SUPABASE_COMPLETE_SCHEMA.sql` in any text editor
2. Copy entire content (Ctrl+A, Ctrl+C)
3. In Supabase SQL Editor, paste it
4. Click "Run"
5. Wait for completion (green checkmark appears)

**Verify Success:**

- Go to Database → Tables
- Verify all 8 tables exist:
  - [ ] organizations
  - [ ] roles
  - [ ] users
  - [ ] warehouses
  - [ ] products
  - [ ] inventory
  - [ ] stock_movements
  - [ ] audit_logs

---

## PHASE 3: ADD SAMPLE DATA

### Step 3.1: Create Organization (if not already created)

**In SQL Editor, run:**

```sql
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
RETURNING id;
```

**Action:** Copy the returned `id` → this is your `ORGANIZATION_ID`

### Step 3.2: Create System Roles

**In SQL Editor, run:**

```sql
-- Insert admin role
INSERT INTO public.roles (organization_id, name, display_name, description, permissions, priority, is_system_role)
VALUES (
  'ORGANIZATION_ID',
  'admin',
  'Administrator',
  'Full system access',
  '["*.*"]'::jsonb,
  1,
  true
) ON CONFLICT DO NOTHING
RETURNING id AS admin_role_id;

-- Insert manager role
INSERT INTO public.roles (organization_id, name, display_name, description, permissions, priority, is_system_role)
VALUES (
  'ORGANIZATION_ID',
  'manager',
  'Manager',
  'Operational management',
  '["inventory.read", "inventory.write", "warehouse.read", "warehouse.write", "product.read", "product.write", "user.read", "audit.read"]'::jsonb,
  2,
  true
) ON CONFLICT DO NOTHING
RETURNING id AS manager_role_id;

-- Insert user role
INSERT INTO public.roles (organization_id, name, display_name, description, permissions, priority, is_system_role)
VALUES (
  'ORGANIZATION_ID',
  'user',
  'User',
  'Basic operations',
  '["inventory.read", "inventory.write", "warehouse.read", "product.read"]'::jsonb,
  3,
  true
) ON CONFLICT DO NOTHING
RETURNING id AS user_role_id;

-- Insert viewer role
INSERT INTO public.roles (organization_id, name, display_name, description, permissions, priority, is_system_role)
VALUES (
  'ORGANIZATION_ID',
  'viewer',
  'Viewer',
  'Read-only access',
  '["inventory.read", "warehouse.read", "product.read", "audit.read"]'::jsonb,
  4,
  true
) ON CONFLICT DO NOTHING
RETURNING id AS viewer_role_id;
```

**Action:** Copy the returned role IDs and save them

### Step 3.3: Create Supabase Auth Users

**In Supabase Dashboard:**

1. Go to Authentication → Users
2. Click "Invite"
3. Enter email: `admin@demoretail.com`
4. Click "Send invite"
5. User receives email with signup link
6. After signup, copy the Auth UID

**Repeat for:**

- `manager@demoretail.com`
- `user@demoretail.com`
- `viewer@demoretail.com`

### Step 3.4: Create User Records in Database

**For Admin user, in SQL Editor run:**

```sql
INSERT INTO public.users (id, organization_id, email, full_name, first_name, last_name, role_id, active)
VALUES (
  'AUTH_UID_FOR_ADMIN',
  'ORGANIZATION_ID',
  'admin@demoretail.com',
  'Admin User',
  'Admin',
  'User',
  'ADMIN_ROLE_ID',
  true
) ON CONFLICT DO NOTHING;
```

**Repeat for other users:**

```sql
INSERT INTO public.users (id, organization_id, email, full_name, first_name, last_name, role_id, active)
VALUES (
  'AUTH_UID_FOR_MANAGER',
  'ORGANIZATION_ID',
  'manager@demoretail.com',
  'Manager User',
  'Manager',
  'User',
  'MANAGER_ROLE_ID',
  true
) ON CONFLICT DO NOTHING;

INSERT INTO public.users (id, organization_id, email, full_name, first_name, last_name, role_id, active)
VALUES (
  'AUTH_UID_FOR_USER',
  'ORGANIZATION_ID',
  'user@demoretail.com',
  'Regular User',
  'Regular',
  'User',
  'USER_ROLE_ID',
  true
) ON CONFLICT DO NOTHING;

INSERT INTO public.users (id, organization_id, email, full_name, first_name, last_name, role_id, active)
VALUES (
  'AUTH_UID_FOR_VIEWER',
  'ORGANIZATION_ID',
  'viewer@demoretail.com',
  'Viewer User',
  'Viewer',
  'User',
  'VIEWER_ROLE_ID',
  true
) ON CONFLICT DO NOTHING;
```

### Step 3.5: Create Sample Warehouses

**In SQL Editor, run:**

```sql
-- Main Warehouse
INSERT INTO public.warehouses (organization_id, code, name, description, capacity, is_default, warehouse_type, created_by)
VALUES (
  'ORGANIZATION_ID',
  'WH-001',
  'Main Distribution Center',
  'Primary warehouse for distribution',
  50000,
  true,
  'distribution',
  'AUTH_UID_FOR_ADMIN'
) RETURNING id AS warehouse_1_id;

-- Secondary Warehouse
INSERT INTO public.warehouses (organization_id, code, name, description, capacity, is_default, warehouse_type, created_by)
VALUES (
  'ORGANIZATION_ID',
  'WH-002',
  'Regional Storage',
  'Secondary storage facility',
  30000,
  false,
  'storage',
  'AUTH_UID_FOR_ADMIN'
) RETURNING id AS warehouse_2_id;
```

**Action:** Copy the returned warehouse IDs

### Step 3.6: Create Sample Products

**In SQL Editor, run:**

```sql
-- Product 1
INSERT INTO public.products (organization_id, sku, name, category, brand, pricing, created_by)
VALUES (
  'ORGANIZATION_ID',
  'PROD-001',
  'Premium Widget',
  'Electronics',
  'TechBrand',
  '{"cost": 20.00, "retail_price": 49.99, "margin": 0.60, "currency": "USD"}'::jsonb,
  'AUTH_UID_FOR_ADMIN'
) RETURNING id AS product_1_id;

-- Product 2
INSERT INTO public.products (organization_id, sku, name, category, brand, pricing, created_by)
VALUES (
  'ORGANIZATION_ID',
  'PROD-002',
  'Standard Widget',
  'Electronics',
  'TechBrand',
  '{"cost": 15.00, "retail_price": 34.99, "margin": 0.57, "currency": "USD"}'::jsonb,
  'AUTH_UID_FOR_ADMIN'
) RETURNING id AS product_2_id;

-- Product 3
INSERT INTO public.products (organization_id, sku, name, category, brand, pricing, created_by)
VALUES (
  'ORGANIZATION_ID',
  'PROD-003',
  'Deluxe Gadget',
  'Accessories',
  'GadgetCorp',
  '{"cost": 50.00, "retail_price": 129.99, "margin": 0.62, "currency": "USD"}'::jsonb,
  'AUTH_UID_FOR_ADMIN'
) RETURNING id AS product_3_id;

-- Product 4
INSERT INTO public.products (organization_id, sku, name, category, brand, pricing, created_by)
VALUES (
  'ORGANIZATION_ID',
  'PROD-004',
  'Basic Gadget',
  'Accessories',
  'GadgetCorp',
  '{"cost": 30.00, "retail_price": 79.99, "margin": 0.63, "currency": "USD"}'::jsonb,
  'AUTH_UID_FOR_ADMIN'
) RETURNING id AS product_4_id;

-- Product 5
INSERT INTO public.products (organization_id, sku, name, category, brand, pricing, created_by)
VALUES (
  'ORGANIZATION_ID',
  'PROD-005',
  'Bulk Component',
  'Components',
  'CompSupply',
  '{"cost": 5.00, "retail_price": 12.99, "margin": 0.61, "currency": "USD"}'::jsonb,
  'AUTH_UID_FOR_ADMIN'
) RETURNING id AS product_5_id;
```

**Action:** Copy all returned product IDs

### Step 3.7: Create Sample Inventory

**In SQL Editor, run:**

```sql
-- Inventory for Product 1 in Warehouse 1
INSERT INTO public.inventory (organization_id, product_id, warehouse_id, quantity_on_hand, quantity_reserved, reorder_point, reorder_quantity)
VALUES (
  'ORGANIZATION_ID',
  'PRODUCT_1_ID',
  'WAREHOUSE_1_ID',
  250,
  25,
  50,
  200
);

-- Inventory for Product 2 in Warehouse 1
INSERT INTO public.inventory (organization_id, product_id, warehouse_id, quantity_on_hand, quantity_reserved, reorder_point, reorder_quantity)
VALUES (
  'ORGANIZATION_ID',
  'PRODUCT_2_ID',
  'WAREHOUSE_1_ID',
  500,
  50,
  100,
  300
);

-- Inventory for Product 3 in Warehouse 1
INSERT INTO public.inventory (organization_id, product_id, warehouse_id, quantity_on_hand, quantity_reserved, reorder_point, reorder_quantity)
VALUES (
  'ORGANIZATION_ID',
  'PRODUCT_3_ID',
  'WAREHOUSE_1_ID',
  100,
  10,
  20,
  80
);

-- Inventory for Product 1 in Warehouse 2
INSERT INTO public.inventory (organization_id, product_id, warehouse_id, quantity_on_hand, quantity_reserved, reorder_point, reorder_quantity)
VALUES (
  'ORGANIZATION_ID',
  'PRODUCT_1_ID',
  'WAREHOUSE_2_ID',
  150,
  15,
  40,
  150
);

-- Inventory for Product 4 in Warehouse 2
INSERT INTO public.inventory (organization_id, product_id, warehouse_id, quantity_on_hand, quantity_reserved, reorder_point, reorder_quantity)
VALUES (
  'ORGANIZATION_ID',
  'PRODUCT_4_ID',
  'WAREHOUSE_2_ID',
  300,
  30,
  60,
  200
);

-- Inventory for Product 5 in Warehouse 1
INSERT INTO public.inventory (organization_id, product_id, warehouse_id, quantity_on_hand, quantity_reserved, reorder_point, reorder_quantity)
VALUES (
  'ORGANIZATION_ID',
  'PRODUCT_5_ID',
  'WAREHOUSE_1_ID',
  1000,
  100,
  200,
  500
);
```

---

## PHASE 4: TEST RLS & SECURITY

### Step 4.1: Verify RLS Policies

**In SQL Editor, run:**

```sql
-- Test 1: User can view their organization's inventory
SELECT COUNT(*) FROM public.inventory
WHERE organization_id = 'ORGANIZATION_ID';

-- Test 2: Stock movements are immutable (should fail)
UPDATE public.stock_movements SET quantity_changed = 999
WHERE id = ANY(ARRAY(SELECT id FROM public.stock_movements LIMIT 1));
-- Expected: Error - policy violation or immutable constraint

-- Test 3: Audit logs are immutable (should fail)
UPDATE public.audit_logs SET action = 'delete'
WHERE id = ANY(ARRAY(SELECT id FROM public.audit_logs LIMIT 1));
-- Expected: Error - policy violation or immutable constraint
```

### Step 4.2: Verify User Roles

**In SQL Editor, run:**

```sql
-- Check roles exist
SELECT name, permissions FROM public.roles
WHERE organization_id = 'ORGANIZATION_ID';

-- Check users linked to roles
SELECT u.email, r.name as role_name FROM public.users u
JOIN public.roles r ON u.role_id = r.id
WHERE u.organization_id = 'ORGANIZATION_ID';
```

---

## PHASE 5: GET CREDENTIALS

### Step 5.1: Get API Keys

**In Supabase Dashboard:**

1. Go to **Settings** → **API**
2. Copy and save:

**Anon Key (for frontend):**

```
NEXT_PUBLIC_SUPABASE_ANON_KEY: [copy from "Anon public" field]
```

**Service Role Key (for backend only - keep secret!):**

```
SUPABASE_SERVICE_ROLE_KEY: [copy from "Service role secret" field]
```

**URL:**

```
NEXT_PUBLIC_SUPABASE_URL: https://[project-id].supabase.co
```

### Step 5.2: Get Database Connection String

**In Supabase Dashboard:**

1. Go to **Settings** → **Database** → **Connection String**
2. Select "Postgres" tab (if not already selected)
3. Copy the connection string:

```
postgres://postgres:REDACTED@[host]:5432/postgres
```

**Extract values:**

```
SUPABASE_DB_HOST: [host-from-connection-string]
SUPABASE_DB_PORT: 5432
SUPABASE_DB_NAME: postgres
SUPABASE_DB_USER: postgres
SUPABASE_DB_PASSWORD: [your-database-password]
```

---

## PHASE 6: ENVIRONMENT SETUP

### Step 6.1: Create .env.local

**In project root, create `.env.local`:**

```env
# Supabase Configuration (Frontend)
NEXT_PUBLIC_SUPABASE_URL=https://[project-id].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[your-anon-key]

# Supabase Configuration (Backend Only - Secret!)
SUPABASE_SERVICE_ROLE_KEY=[your-service-role-key]

# Database Connection (Backend Only)
SUPABASE_DB_HOST=[host]
SUPABASE_DB_PORT=5432
SUPABASE_DB_NAME=postgres
SUPABASE_DB_USER=postgres
SUPABASE_DB_PASSWORD=[password]

# JWT Secret (Optional)
SUPABASE_JWT_SECRET=[from-settings]

# Organization Details
NEXT_PUBLIC_ORG_ID=[ORGANIZATION_ID]
NEXT_PUBLIC_ORG_NAME=Demo Retail Corp
```

### Step 6.2: Verify Connection

**After updating .env.local:**

```bash
npm run dev
```

Visit: `http://localhost:3000/inventory-v2`

If it loads without errors, your database is connected! ✅

---

## ✅ FINAL VERIFICATION CHECKLIST

- [ ] Supabase project created
- [ ] All 8 tables visible in Database → Tables
- [ ] Organization created
- [ ] 4 system roles created (admin, manager, user, viewer)
- [ ] 4 auth users created via Authentication
- [ ] 4 user records created in database
- [ ] 2 warehouses created
- [ ] 5 products created
- [ ] 6 inventory records created
- [ ] RLS policies applied and tested
- [ ] Immutable constraints working (updates fail as expected)
- [ ] API keys copied
- [ ] Database credentials extracted
- [ ] .env.local created with all values
- [ ] npm run dev executes without errors
- [ ] Inventory dashboard loads

---

## 📊 WHAT YOU NOW HAVE

✅ **Production-Ready Database:**

- Multi-tenant architecture with complete isolation
- 8 optimized tables with proper relationships
- Row Level Security at database level
- Immutable audit trails
- System roles and permissions
- Sample data for testing

✅ **Ready for Integration:**

- Next.js app connected to Supabase
- API keys secured in environment variables
- Database accessible from backend/frontend
- All credentials documented

✅ **Next Steps:**

- Update Next.js API routes to use Supabase
- Build inventory dashboard features
- Add more sample data
- Deploy to production

---

**Your Supabase database is now production-ready! 🚀**
