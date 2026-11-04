# 🗄️ SUPABASE PRODUCTION SETUP GUIDE

**Status:** 📋 Step-by-Step Configuration  
**Estimated Time:** 20-30 minutes  

---

## STEP 1: CREATE PRODUCTION PROJECT

### 1.1 Go to Supabase Dashboard

```
URL: https://supabase.com/dashboard
1. Log in to your Supabase account
2. Click: "New Project"
3. Configure:
   - Organization: [Select your org]
   - Name: erp-production
   - Database Password: [Generate 32+ char password - SAVE IT!]
   - Region: [Closest to target users]
   - Pricing: Pro ($25/month minimum)
4. Click: "Create New Project"
5. Wait: 2-3 minutes for initialization
```

### 1.2 Verify Project Creation

```
When ready, you should see:
✅ Project name: erp-production
✅ Status: "Healthy"
✅ Database connected
✅ Authentication ready
```

---

## STEP 2: GET PRODUCTION CREDENTIALS

### 2.1 Retrieve API Keys

```
In Supabase Dashboard:
1. Go to: Settings (bottom left) → API
2. Under "Project API keys":
   - Copy: Project URL
   - Copy: anon public (NEXT_PUBLIC_SUPABASE_ANON_KEY)
   - Copy: service_role secret (SUPABASE_SERVICE_ROLE_KEY)
```

**Example credentials (DO NOT USE - for reference only):**
```
NEXT_PUBLIC_SUPABASE_URL=https://abc123def456.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 2.2 Retrieve Database Connection String

```
In Supabase Dashboard:
1. Go to: Settings → Database
2. Look for "Connection string"
3. Format:
   postgresql://postgres:REDACTED@[HOST]:5432/postgres
```

---

## STEP 3: CONFIGURE DATABASE

### 3.1 Connect to Database

**Option A: Using psql command line**
```bash
# Install PostgreSQL tools if needed
# macOS: brew install postgresql
# Linux: apt-get install postgresql-client

# Connect to production database
psql postgresql://postgres:REDACTED@[HOST]:5432/postgres

# Verify connection
SELECT version();
```

**Option B: Using Supabase Dashboard SQL Editor**
```
1. In Supabase Dashboard
2. Go to: SQL Editor
3. Click: "New Query"
4. Paste SQL commands
5. Click: "Run"
```

### 3.2 Run Database Migrations

**Migration 1: Initial Schema**

```sql
-- Run this first:
-- File: db/migrations/001_init_schema.sql

-- Create companies table
CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  email VARCHAR(255) NOT NULL UNIQUE,
  first_name VARCHAR(255),
  last_name VARCHAR(255),
  role VARCHAR(50) DEFAULT 'viewer',
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  last_login TIMESTAMP
);

-- Create products table
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  sku VARCHAR(100) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price NUMERIC(10, 2),
  cost NUMERIC(10, 2),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create customers table
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(20),
  city VARCHAR(100),
  country VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create orders table
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  customer_id UUID NOT NULL REFERENCES customers(id),
  order_number VARCHAR(50) UNIQUE,
  total NUMERIC(10, 2),
  status VARCHAR(50) DEFAULT 'pending',
  payment_status VARCHAR(50) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create order_items table
CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id),
  product_id UUID NOT NULL REFERENCES products(id),
  quantity INTEGER,
  price NUMERIC(10, 2),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create warehouses table
CREATE TABLE IF NOT EXISTS warehouses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  name VARCHAR(255) NOT NULL,
  location VARCHAR(255),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create inventory table
CREATE TABLE IF NOT EXISTS inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id),
  warehouse_id UUID NOT NULL REFERENCES warehouses(id),
  quantity INTEGER DEFAULT 0,
  reserved INTEGER DEFAULT 0,
  available INTEGER DEFAULT 0,
  reorder_level INTEGER DEFAULT 10,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create audit_logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  action VARCHAR(50),
  resource_type VARCHAR(100),
  resource_id VARCHAR(100),
  changes JSONB,
  ip_address VARCHAR(50),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create product_variants table
CREATE TABLE IF NOT EXISTS product_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id),
  name VARCHAR(255),
  sku VARCHAR(100),
  price NUMERIC(10, 2),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create customer_addresses table
CREATE TABLE IF NOT EXISTS customer_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id),
  address_line1 VARCHAR(255),
  address_line2 VARCHAR(255),
  city VARCHAR(100),
  state VARCHAR(100),
  postal_code VARCHAR(20),
  country VARCHAR(100),
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create webhooks table
CREATE TABLE IF NOT EXISTS webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url VARCHAR(500) NOT NULL,
  events TEXT[] NOT NULL,
  active BOOLEAN DEFAULT true,
  secret VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create webhook_logs table
CREATE TABLE IF NOT EXISTS webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id UUID REFERENCES webhooks(id),
  event VARCHAR(100),
  status VARCHAR(50),
  retries INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Migration 2: Performance Optimization**

```sql
-- Run this second:
-- File: db/migrations/002_production_optimization.sql

-- CREATE INDEXES (from the file provided earlier)
CREATE INDEX idx_products_sku ON products(sku) WHERE active = true;
CREATE INDEX idx_products_company_id ON products(company_id, active);
CREATE INDEX idx_orders_customer_id ON orders(customer_id);
CREATE INDEX idx_orders_status ON orders(status, created_at DESC);
CREATE INDEX idx_customers_email ON customers(email);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id, created_at DESC);

-- ANALYZE TABLES
ANALYZE;

-- CREATE MATERIALIZED VIEW FOR DASHBOARD
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

-- VERIFY INDEXES
SELECT * FROM pg_indexes WHERE schemaname = 'public';
```

---

## STEP 4: ENABLE SECURITY FEATURES

### 4.1 Enable Row-Level Security (RLS)

```sql
-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Create policies for users
CREATE POLICY "Users see only their company data"
  ON users FOR SELECT
  USING (company_id IN (
    SELECT company_id FROM users WHERE id = auth.uid()
  ));

CREATE POLICY "Admins can manage users"
  ON users FOR ALL
  USING (
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );

-- Verify RLS enabled
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public';
```

### 4.2 Setup Authentication

**In Supabase Dashboard:**

```
1. Go to: Authentication → Providers
2. Verify Email is enabled
3. Go to: Authentication → URL Configuration
4. Add redirects:
   - http://localhost:3000 (development)
   - https://yourdomain.com (production)
5. Go to: Email Templates
6. Customize if needed
```

---

## STEP 5: CREATE PRODUCTION DATA

### 5.1 Create First Company

```sql
INSERT INTO companies (name, description, active)
VALUES ('Your Company Name', 'Production Company', true)
RETURNING id;

-- Note the company_id (will use in next step)
```

### 5.2 Create First Admin User

```sql
-- For production, use Supabase Auth
-- Go to: Authentication → Users in Supabase Dashboard
-- Click: Add User
-- Email: admin@yourdomain.com
-- Password: [Generate strong password]

-- Then in SQL:
INSERT INTO users (
  company_id,
  email,
  first_name,
  last_name,
  role,
  active
) VALUES (
  '[COMPANY_ID]',
  'admin@yourdomain.com',
  'Admin',
  'User',
  'admin',
  true
);
```

### 5.3 Create Sample Warehouse (Optional)

```sql
INSERT INTO warehouses (
  company_id,
  name,
  location,
  active
) VALUES (
  '[COMPANY_ID]',
  'Main Warehouse',
  'New York, NY',
  true
);
```

---

## STEP 6: BACKUP CONFIGURATION

### 6.1 Enable Automated Backups

**In Supabase Dashboard:**

```
1. Go to: Settings → Database → Backups
2. Verify: "Automated backups are enabled"
3. Set: "Point in time recovery" to 7 days
4. Backup timing: Off-peak hours recommended
```

### 6.2 Manual Backup (First Backup)

```bash
# Before going live, create manual backup
# In Supabase Dashboard:
1. Settings → Database → Backups
2. Click: "Create a manual backup"
3. Wait for completion
4. Download backup file and store securely
```

---

## STEP 7: MONITORING & LOGGING

### 7.1 Enable Query Performance Insights

```sql
-- Check slow queries (log slow queries >1s)
ALTER SYSTEM SET log_min_duration_statement = 1000;
SELECT pg_reload_conf();

-- View slow queries
SELECT query, calls, mean_time 
FROM pg_stat_statements 
WHERE mean_time > 1000
ORDER BY mean_time DESC;
```

### 7.2 Setup Realtime (Optional)

```
In Supabase Dashboard:
1. Go to: Realtime
2. Enable on specific tables if needed
3. Configure filters
```

---

## STEP 8: CONNECTION POOLING

### 8.1 Enable PgBouncer (Built-in)

**In Supabase Dashboard:**

```
1. Settings → Database
2. Connection pooling: Enabled
3. Pool mode: Transaction
4. Connection limit: 15 (for production)
```

---

## STEP 9: VERIFY SETUP

### 9.1 Test Database Connection

```bash
# From terminal
psql postgresql://postgres:REDACTED@[HOST]:5432/postgres

# Should connect successfully
# Run test queries:
SELECT count(*) FROM users;
SELECT count(*) FROM products;
SELECT count(*) FROM orders;
```

### 9.2 Verify Tables

```sql
-- List all tables
\dt

-- Should show:
audit_logs
companies
customers
customer_addresses
inventory
order_items
orders
product_variants
products
users
warehouses
webhooks
webhook_logs
```

### 9.3 Check Indexes

```sql
-- Verify indexes created
SELECT * FROM pg_indexes WHERE schemaname = 'public' LIMIT 20;

-- Should show 15+ indexes
```

---

## STEP 10: PRODUCTION READINESS

### 10.1 Pre-Go-Live Checklist

```
Database:
□ All tables created
□ All indexes created
□ RLS policies in place
□ First company created
□ Admin user created
□ Backups enabled
□ Monitoring enabled
□ Connection pooling enabled

Security:
□ All credentials secure
□ No passwords in code
□ Environment variables set
□ SSL/TLS enabled
□ Firewall rules set

Testing:
□ Connection test passed
□ Query performance good
□ Backups completing
□ Restore tested
□ No errors in logs
```

### 10.2 Documentation

```
Save securely:
□ Admin credentials
□ Database password
□ API keys
□ Backup location
□ Recovery procedures
□ Support contacts
```

---

## 📋 PRODUCTION DATABASE STATUS

**Status:** ✅ **READY FOR PRODUCTION**

**Database:**
- Project: erp-production
- Region: [Your region]
- Version: PostgreSQL 14+
- Tables: 13 created
- Indexes: 15+ created
- RLS: Enabled
- Backups: Automated
- Monitoring: Active

**Connection:**
- URL: https://[your-project].supabase.co
- Pool: Enabled (15 connections)
- SSL: Enforced
- Status: Ready

**Credentials:**
- Saved securely: ✅
- Not in code: ✅
- Rotated: ✅

---

## ✅ NEXT STEP: Deploy to Vercel

Follow: VERCEL_DEPLOYMENT_GUIDE.md

**System is production-ready!** 🚀
