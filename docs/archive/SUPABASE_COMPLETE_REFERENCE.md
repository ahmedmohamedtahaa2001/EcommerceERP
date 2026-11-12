# COMPLETE SUPABASE SETUP REFERENCE

## Operix ERP - Production-Ready Database

---

## 📋 FILES YOU HAVE

### 1. **SUPABASE_MASTER_PROMPT.txt** ⭐ MOST IMPORTANT

- **What it is:** Comprehensive master prompt covering entire architecture
- **What to do:** Copy entire content → Paste into Claude Browser Extension
- **Claude will:** Guide you through all 10 phases of setup
- **Use when:** You want step-by-step guidance

### 2. **SUPABASE_COMPLETE_SCHEMA.sql**

- **What it is:** Complete SQL for all 8 tables, functions, triggers, and RLS
- **What to do:** Copy → Paste into Supabase SQL Editor → Run
- **Creates:**
  - organizations, roles, users, warehouses, products
  - inventory, stock_movements, audit_logs
  - Helper functions for auth
  - Immutability triggers
  - All indexes
  - RLS policies
  - Sample organization
- **Run:** Once, at the beginning

### 3. **SUPABASE_EXECUTION_GUIDE.md**

- **What it is:** Step-by-step execution walkthrough
- **What to do:** Follow each phase in order
- **Covers:**
  - Phase 1: Project setup
  - Phase 2: Schema creation
  - Phase 3: Sample data with exact SQL
  - Phase 4: Testing RLS
  - Phase 5: Getting credentials
  - Phase 6: Environment setup
- **Use when:** You need exact SQL commands

### 4. **SUPABASE_MASTER_PROMPT.txt**

- **What it is:** Architecture and requirements documentation
- **What to do:** Reference for design decisions and best practices
- **Explains:**
  - Why each table exists
  - Why each policy exists
  - Scalability and extensibility
  - Security principles
  - Role/permission model
- **Use when:** You want to understand the "why"

---

## 🚀 QUICK START (3 STEPS)

### Step 1: Copy Master Prompt

```
File: SUPABASE_MASTER_PROMPT.txt
Action: Select All (Ctrl+A) → Copy (Ctrl+C)
```

### Step 2: Paste into Claude Browser Extension

```
1. Open Claude Browser Extension (on any website)
2. Paste the entire prompt (Ctrl+V)
3. Let Claude guide you through setup
```

### Step 3: Follow Claude's Guidance

```
Claude will tell you:
1. Create Supabase project at supabase.com
2. Go to SQL Editor
3. Copy SUPABASE_COMPLETE_SCHEMA.sql
4. Paste and run
5. Add sample data (exact SQL provided)
6. Get credentials
7. Save to .env.local
```

---

## 📊 WHAT WILL BE CREATED

### 8 Core Tables

**ORGANIZATIONS** - Multi-tenant root

- Stores company information
- Subscription tier, features, settings
- Root of all data isolation

**ROLES** - Permission definitions

- System roles: admin, manager, user, viewer
- Custom roles can be created
- Defines permissions as JSON array

**USERS** - Application users

- Linked to Supabase Auth (auth.uid())
- Role assigned per organization
- Preferences and metadata

**WAREHOUSES** - Physical locations

- Storage facilities
- Manager assignment
- Capacity tracking
- Addresses and contact info

**PRODUCTS** - Product catalog

- SKU, name, category, brand
- Pricing, dimensions, weight
- Barcode and QR code support
- Hazard and storage requirements

**INVENTORY** - Stock levels

- Quantity on hand, reserved, damaged
- Calculated available quantity
- Reorder points and lead time
- Last counted, restocked, sold timestamps

**STOCK_MOVEMENTS** - Immutable audit trail

- Every inventory change logged
- Movement type (add, remove, adjust, transfer, etc.)
- Before/after quantities
- User, cost, and document tracking
- **CANNOT BE UPDATED OR DELETED**

**AUDIT_LOGS** - System audit trail

- Every API action logged
- Resource type and resource ID
- Old and new values
- IP address and session ID
- **CANNOT BE UPDATED OR DELETED**

---

## 🔐 SECURITY ARCHITECTURE

### Multi-Tenancy

- Every table has `organization_id`
- RLS policies enforce org isolation
- User can only see data from their org
- No user can see another org's data

### Role-Based Access

```
admin   → All permissions
manager → Inventory, warehouse, product management + read users
user    → Inventory operations, view warehouse & products
viewer  → Read-only access to inventory, warehouse, products, audit
```

### Immutable Records

- Stock movements cannot be edited/deleted
- Audit logs cannot be edited/deleted
- Prevents tampering with audit trail
- Compliant with regulations

### Row Level Security

- Enforced at database level (not application level)
- Prevents data leaks even if app has bug
- Helper functions for auth checks
- Policies on every table

---

## 📈 SCALABILITY FEATURES

### Performance Optimization

- Composite indexes on (organization_id, field)
- Indexes on common query patterns
- Computed columns (e.g., quantity_available)
- Index on low stock detection

### Extensibility

- JSONB fields for custom data
- Tags array for flexible categorization
- Metadata fields on all tables
- Easy to add new tables without breaking RLS

### Future-Ready

- Foundation for Orders, Suppliers, POs
- Notification system ready
- Webhook support possible
- API integration patterns established

---

## 🔑 CREDENTIALS YOU'LL GET

### Frontend (.env.local)

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

### Backend (.env.local - Secret!)

```env
SUPABASE_SERVICE_ROLE_KEY=eyJ...
SUPABASE_DB_HOST=xxx.supabase.co
SUPABASE_DB_PORT=5432
SUPABASE_DB_NAME=postgres
SUPABASE_DB_USER=postgres
SUPABASE_DB_PASSWORD=xxx
```

---

## ✅ VERIFICATION STEPS

### After Schema Creation

```sql
SELECT COUNT(*) FROM information_schema.tables
WHERE table_schema = 'public';
-- Should return 8
```

### After RLS Setup

```sql
SELECT table_name, row_security_enabled
FROM information_schema.tables
WHERE table_schema = 'public';
-- All should show true
```

### After Sample Data

```sql
SELECT COUNT(*) FROM public.organizations;     -- 1
SELECT COUNT(*) FROM public.roles;             -- 4+
SELECT COUNT(*) FROM public.users;             -- 4+
SELECT COUNT(*) FROM public.warehouses;        -- 2+
SELECT COUNT(*) FROM public.products;          -- 5+
SELECT COUNT(*) FROM public.inventory;         -- 6+
```

### Test RLS Policies

```sql
-- As authenticated user, should see own org data
SELECT * FROM public.inventory
WHERE organization_id = current_user_org_id();

-- Try to update stock movement (should fail)
UPDATE public.stock_movements SET quantity_changed = 0;
-- Error: violates policy

-- Try to update audit log (should fail)
UPDATE public.audit_logs SET action = 'delete';
-- Error: violates policy
```

---

## 🎯 USAGE FLOW

### For Claude Browser Extension

1. **Input:** SUPABASE_MASTER_PROMPT.txt
2. **Process:** Claude reads and understands requirements
3. **Output:** Step-by-step guidance to create database
4. **Result:** Complete production database

### For SQL Execution

1. **Input:** SUPABASE_COMPLETE_SCHEMA.sql
2. **Process:** Copy → Paste → Run in Supabase SQL Editor
3. **Output:** All tables, functions, policies created
4. **Result:** Ready for data and testing

### For Reference

1. **Input:** SUPABASE_EXECUTION_GUIDE.md
2. **Process:** Follow each phase with exact SQL
3. **Output:** Sample data, credentials, environment setup
4. **Result:** Ready to connect from Next.js

---

## 🔄 RECOMMENDED SEQUENCE

### Day 1: Setup

1. **5 min:** Copy SUPABASE_MASTER_PROMPT.txt
2. **20 min:** Use Claude Browser Extension to setup project
3. **10 min:** Run SUPABASE_COMPLETE_SCHEMA.sql
4. **Result:** Empty database with schema ready

### Day 2: Configuration

5. **30 min:** Follow SUPABASE_EXECUTION_GUIDE.md Phase 3-4
6. **20 min:** Add sample data with exact SQL
7. **10 min:** Test RLS policies
8. **Result:** Database populated and tested

### Day 3: Integration

9. **20 min:** Get credentials (Phase 5)
10. **10 min:** Create .env.local (Phase 6)
11. **5 min:** Test connection from Next.js app
12. **Result:** App connected to database

---

## 📞 IF YOU GET STUCK

### Schema Creation Issues

- Use: SUPABASE_COMPLETE_SCHEMA.sql
- Run in: Supabase SQL Editor
- Check: All tables appear in Database → Tables

### Data Population Issues

- Use: SUPABASE_EXECUTION_GUIDE.md (Phase 3)
- Exact SQL provided for each step
- Save IDs from each insert for next step

### RLS Policy Issues

- Use: SUPABASE_MASTER_PROMPT.txt (Part 6)
- Run test queries in SQL Editor
- Check: RLS enabled on all tables

### Connection Issues

- Use: SUPABASE_EXECUTION_GUIDE.md (Phase 6)
- Verify all .env.local variables are correct
- Check: Anon key for frontend, Service Role for backend

---

## 🎓 LEARNING RESOURCES

### Architecture Understanding

- Read: SUPABASE_MASTER_PROMPT.txt (Part 1-6)
- Understand: Why each design decision was made

### SQL Reference

- File: SUPABASE_COMPLETE_SCHEMA.sql
- Study: Table definitions and relationships

### Step-by-Step Guide

- File: SUPABASE_EXECUTION_GUIDE.md
- Follow: Each phase in order

### Design Patterns

- Multi-tenant: organization_id on all tables
- Security: RLS policies on every table
- Auditability: Immutable audit trails
- Extensibility: JSONB fields, tags arrays

---

## 🚀 AFTER SETUP

### Next Steps

1. Connect from Next.js app (API routes)
2. Build inventory dashboard
3. Implement features:
   - Stock adjustments
   - Warehouse transfers
   - Low stock alerts
   - Audit reports
4. Add more modules:
   - Orders
   - Suppliers
   - Purchase orders

### Deployment

1. Backup database
2. Set up replication/backups
3. Monitor performance
4. Set up alerts
5. Document custom roles
6. Train team on permissions

---

## 📋 COMPREHENSIVE CHECKLIST

### Setup Phase

- [ ] Read SUPABASE_MASTER_PROMPT.txt
- [ ] Create Supabase project
- [ ] Run SUPABASE_COMPLETE_SCHEMA.sql
- [ ] Verify 8 tables created
- [ ] Verify RLS enabled on all tables

### Data Population Phase

- [ ] Create organization
- [ ] Create 4 system roles
- [ ] Create 4 auth users
- [ ] Create 4 user records
- [ ] Create 2 warehouses
- [ ] Create 5 products
- [ ] Create 6 inventory records

### Testing Phase

- [ ] Test RLS policies work
- [ ] Test stock movements are immutable
- [ ] Test audit logs are immutable
- [ ] Test different user roles can see appropriate data
- [ ] Verify org isolation (user A cannot see org B data)

### Credentials Phase

- [ ] Copy API keys (Anon + Service Role)
- [ ] Copy database URL and credentials
- [ ] Create .env.local with all values
- [ ] Verify values are correct

### Integration Phase

- [ ] npm run dev starts without errors
- [ ] Visit /inventory-v2 loads without errors
- [ ] Can query database from API routes
- [ ] Sample data visible in dashboard

---

## 🎉 YOU'RE READY!

All the information needed to build a production-ready Supabase database is in these files.

**Start here:** SUPABASE_MASTER_PROMPT.txt

**Expected time:** 2-3 hours total (including Supabase project creation)

**Result:** Production-ready, scalable, secure multi-tenant ERP database

Good luck! 🚀
