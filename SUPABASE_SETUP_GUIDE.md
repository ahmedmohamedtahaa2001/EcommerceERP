# Supabase Database Setup Guide for Claude Browser Extension

## 🎯 Objective
Build a complete, production-ready Supabase PostgreSQL database for the Operix ERP system with proper schema, relationships, RLS policies, and security.

---

## STEP 1: Create Supabase Project

**Prompt for Claude Browser Extension:**
```
Go to supabase.com/dashboard
1. Click "New project"
2. Project Name: "operix-erp"
3. Database Password: Generate strong password and save it securely
4. Region: Select closest to your location
5. Click "Create new project"

Wait for project to initialize (2-5 minutes)

After creation:
- Go to Settings → Database → Connection info
- Copy and save:
  - Host
  - Port
  - Database name
  - Username
  - Password
```

**What you'll get:**
```
Connection details:
- Database Host: <project>.supabase.co
- Port: 5432
- Database: postgres
- Username: postgres
- Password: (your generated password)
```

---

## STEP 2: Create Database Tables

**In Supabase SQL Editor:**

### Step 2a: Copy and Run Complete Schema

1. Go to Supabase Dashboard → SQL Editor
2. Click "New Query"
3. Copy the entire content of `SUPABASE_SCHEMA.sql`
4. Paste into SQL editor
5. Click "Run"
6. Wait for completion (check for green checkmark)

**This will create:**
- 7 tables (companies, warehouses, products, inventory, stock_movements, users, audit_logs)
- All fields with correct data types
- Foreign key relationships
- Composite indexes
- Calculated columns (e.g., available = quantity - reserved)

### Step 2b: Verify Tables Created

1. Go to Supabase → Database → Tables
2. Verify all 7 tables appear:
   - [ ] companies
   - [ ] warehouses
   - [ ] products
   - [ ] inventory
   - [ ] stock_movements
   - [ ] users
   - [ ] audit_logs

---

## STEP 3: Enable Row Level Security (RLS)

**In Supabase SQL Editor:**

1. Click "New Query"
2. Copy the entire content of `SUPABASE_RLS_POLICIES.sql`
3. Paste into SQL editor
4. Click "Run"
5. Wait for completion

**This will:**
- Enable RLS on all 7 tables
- Create helper functions for auth checks
- Create all security policies
- Enforce multi-tenant isolation
- Make audit trails immutable

**Verify in Supabase:**
1. Go to Database → Tables
2. For each table, verify "RLS is enabled" shows as enabled

---

## STEP 4: Add Sample Data

**In Supabase SQL Editor:**

### Create Sample Company

```sql
INSERT INTO public.companies (name, email, industry, website, country, active, subscription)
VALUES (
  'Demo Retail Co',
  'demo@example.com',
  'Retail',
  'https://demo.example.com',
  'US',
  true,
  'premium'
) RETURNING id;
```

**Save the returned company_id** - you'll need it for other inserts.

### Create Sample Warehouse

```sql
INSERT INTO public.warehouses (company_id, name, location, address, city, state, zip_code, country, is_default, capacity, current_utilization, created_by, created_at, updated_at)
VALUES (
  'COMPANY_ID_HERE',  -- Replace with company_id from above
  'Main Warehouse',
  'Downtown',
  '123 Main St',
  'New York',
  'NY',
  '10001',
  'US',
  true,
  50000,
  12000,
  'system',
  NOW(),
  NOW()
) RETURNING id;
```

**Save the returned warehouse_id**.

### Create Sample Product

```sql
INSERT INTO public.products (company_id, sku, name, description, category, price, cost, margin, weight, dimensions, active, barcode, created_at, updated_at)
VALUES (
  'COMPANY_ID_HERE',  -- Replace with company_id
  'WIDGET-001',
  'Premium Widget',
  'High quality widget for retail',
  'Electronics',
  49.99,
  20.00,
  0.60,
  1.5,
  '{"length": 12, "width": 8, "height": 6}'::jsonb,
  true,
  '123456789012',
  NOW(),
  NOW()
) RETURNING id;
```

**Save the returned product_id**.

### Create Sample Inventory

```sql
INSERT INTO public.inventory (company_id, product_id, warehouse_id, quantity, reserved, reorder_level, reorder_quantity, created_by, created_at, updated_at)
VALUES (
  'COMPANY_ID_HERE',      -- Replace with company_id
  'PRODUCT_ID_HERE',      -- Replace with product_id
  'WAREHOUSE_ID_HERE',    -- Replace with warehouse_id
  250,
  25,
  50,
  200,
  'system',
  NOW(),
  NOW()
);
```

---

## STEP 5: Create Supabase Auth User

**In Supabase Dashboard:**

1. Go to Authentication → Users
2. Click "Invite"
3. Enter: demo@example.com
4. Click "Send invite"
5. User will receive email with signup link

**After user signs up:**
1. Copy their Auth UID
2. Create user record in users table:

```sql
INSERT INTO public.users (id, company_id, email, name, role, active, created_at, updated_at, permissions)
VALUES (
  'AUTH_UID_HERE',        -- Replace with auth UID
  'COMPANY_ID_HERE',      -- Replace with company_id
  'demo@example.com',
  'Demo User',
  'admin',
  true,
  NOW(),
  NOW(),
  '["inventory.read", "inventory.write", "warehouse.read", "warehouse.write"]'::jsonb
);
```

---

## STEP 6: Test RLS Policies

**In Supabase SQL Editor:**

```sql
-- Test 1: Verify authenticated user sees their company data
SELECT * FROM public.inventory WHERE company_id = 'COMPANY_ID_HERE' LIMIT 1;

-- Test 2: Verify immutable stock_movements (should error on update)
UPDATE public.stock_movements SET quantity_changed = 999 WHERE id = 'SOME_ID';
-- Expected: Error - violates policy

-- Test 3: Verify audit logs immutable
UPDATE public.audit_logs SET action = 'delete' WHERE id = 'SOME_ID';
-- Expected: Error - violates policy
```

---

## STEP 7: Get Connection Credentials

**In Supabase Dashboard:**

### Get API Keys

1. Go to Settings → API
2. Under "Project API keys"
3. Copy:
   - `anonKey` (for client-side)
   - `serviceRoleKey` (for server-side - keep secret!)

### Get Connection String

1. Go to Settings → Database
2. Copy the connection string:

```
postgresql://postgres:REDACTED@[host]:5432/postgres
```

### Download Service Account Key

1. Go to Project Settings → Service Accounts
2. Generate new key
3. Download JSON file (keep secure!)

---

## STEP 8: Configure Environment Variables

**Create or update `.env.local` in your Next.js project root:**

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://[project-id].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[your-anon-key]

# Server-side only (backend API routes)
SUPABASE_SERVICE_ROLE_KEY=[your-service-role-key]
SUPABASE_DB_HOST=[host]
SUPABASE_DB_PORT=5432
SUPABASE_DB_NAME=postgres
SUPABASE_DB_USER=postgres
SUPABASE_DB_PASSWORD=[your-database-password]

# Backend integration
SUPABASE_JWT_SECRET=[from-supabase-settings]
```

---

## ✅ Verification Checklist

After setup, verify:

- [ ] Supabase project created
- [ ] All 7 tables created successfully
- [ ] Foreign key relationships working
- [ ] All indexes created
- [ ] RLS enabled on all tables
- [ ] Helper functions created (auth_user_company_id, auth_user_role)
- [ ] RLS policies applied
- [ ] Sample company created
- [ ] Sample warehouse created
- [ ] Sample product created
- [ ] Sample inventory created
- [ ] Sample user created via Auth
- [ ] User record linked to company
- [ ] RLS policies tested
- [ ] Auth integration working
- [ ] Environment variables saved
- [ ] Connection strings verified
- [ ] API keys securely stored

---

## 🚀 Next Steps

1. ✅ Complete this setup in Supabase
2. ✅ Save environment variables to `.env.local`
3. ✅ Update Next.js app to use Supabase (we'll do this next)
4. ✅ Test connection with: `npm run dev`
5. ✅ Visit: http://localhost:3000/inventory-v2
6. ✅ Start building inventory features

---

## 📊 Table Relationships

```
companies (root)
├── warehouses (many)
├── products (many)
├── users (many)
├── stock_movements (many)
└── audit_logs (many)

products + warehouses = inventory (unique combo)
  └── stock_movements (audit trail)
```

---

## 🔒 Security Policies Summary

| Table | Select | Insert | Update | Delete |
|-------|--------|--------|--------|--------|
| companies | Admin only | ✗ | Admin only | ✗ |
| warehouses | Company members | Company members | Managers+ | Admins |
| products | Company members | Company members | Managers+ | Admins |
| inventory | Company members | Company members | Managers+ | Admins |
| stock_movements | Company members | System | ✗ | ✗ |
| users | Company members | Admins | Admins | Admins |
| audit_logs | Company members | System | ✗ | ✗ |

---

## 💡 Key Points

✓ Multi-tenant from the start (company isolation)
✓ RLS enforces security at database level
✓ Immutable audit trails prevent tampering
✓ Computed columns for calculated fields
✓ Optimized indexes for common queries
✓ Role-based access control (admin/manager/user)
✓ Fully auditable system actions
✓ Production-ready schema
✓ PostgreSQL reliability and power

---

**You now have a complete, production-ready Supabase database!**
