# Supabase Setup for Claude Browser Extension

## 📋 Files to Use with Browser Extension

I've created 4 files for you to use with the Claude Browser Extension to build your complete Supabase database:

### 1. **SUPABASE_BROWSER_PROMPT.txt** ⭐ START HERE

**What it does:** Main detailed prompt with all database requirements and specifications

**How to use:**

1. Copy the entire contents of `SUPABASE_BROWSER_PROMPT.txt`
2. Open Claude Browser Extension
3. Paste it into the chat
4. Let Claude guide you through the setup

**What you'll get:**

- Step-by-step Supabase project creation
- Complete PostgreSQL schema in SQL
- Sample data creation
- RLS (Row Level Security) policies
- Connection string configuration

---

### 2. **SUPABASE_SETUP_GUIDE.md**

**What it does:** Detailed markdown guide with exact instructions and SQL commands

**How to use:**

- Reference document for detailed schema
- Follow along with Browser Extension guidance
- Copy exact SQL commands as needed
- Verify each step completion

**Contains:**

- Supabase project creation steps
- SQL schema creation
- Sample data INSERT statements
- RLS policy setup
- Environment variables template
- Verification checklist

---

### 3. **SUPABASE_SCHEMA.sql**

**What it does:** Complete SQL file with all table definitions

**Use when:**

- Browser Extension asks for SQL to create tables
- You need to verify table structures
- Running SQL in Supabase SQL Editor

**Contains:**

- All 7 tables with fields and data types
- Foreign key relationships
- Indexes for performance
- Constraints and validation
- Enable RLS commands

**How to use:**

1. Copy entire content
2. Go to Supabase → SQL Editor
3. Click "New Query"
4. Paste the SQL
5. Click "Run"

---

### 4. **SUPABASE_RLS_POLICIES.sql**

**What it does:** Row Level Security policies for multi-tenant data isolation

**Use when:**

- You're ready to enable RLS policies
- Setting up security rules
- After creating tables and data

**How to use:**

1. Go to Supabase → SQL Editor
2. Click "New Query"
3. Copy entire content of SUPABASE_RLS_POLICIES.sql
4. Paste into SQL editor
5. Click "Run"

**Contains:**

- Helper functions for auth checks
- RLS policies for each table
- Multi-tenant isolation rules
- Immutable audit trail enforcement
- Role-based access control

---

## 🚀 Step-by-Step Workflow

### Phase 1: Create Supabase Project

```
File: SUPABASE_SETUP_GUIDE.md (STEP 1)
Or: SUPABASE_BROWSER_PROMPT.txt (project creation section)

Action:
1. Go to supabase.com/dashboard
2. Create new project named "operix-erp"
3. Save database password securely
4. Wait for project initialization (2-5 minutes)
5. Copy connection details
```

### Phase 2: Create Database Tables

```
File: SUPABASE_SCHEMA.sql
Reference: SUPABASE_SETUP_GUIDE.md (STEP 2)

Action:
1. Go to Supabase → SQL Editor
2. Click "New Query"
3. Copy all of SUPABASE_SCHEMA.sql
4. Paste into editor
5. Click "Run"
6. Verify all 7 tables appear
```

### Phase 3: Add Sample Data

```
File: SUPABASE_SETUP_GUIDE.md (STEP 4)
Action:
1. Run SQL for sample company (get company_id)
2. Run SQL for sample warehouse (use company_id, get warehouse_id)
3. Run SQL for sample product (use company_id, get product_id)
4. Run SQL for sample inventory (use all IDs)
```

### Phase 4: Setup Authentication

```
File: SUPABASE_SETUP_GUIDE.md (STEP 5)
Action:
1. Go to Supabase → Authentication → Users
2. Create user via invite (demo@example.com)
3. Copy Auth UID
4. Create user record in database linking to company
```

### Phase 5: Enable RLS Policies

```
File: SUPABASE_RLS_POLICIES.sql
Reference: SUPABASE_SETUP_GUIDE.md (STEP 3)

Action:
1. Go to Supabase → SQL Editor
2. Click "New Query"
3. Copy all of SUPABASE_RLS_POLICIES.sql
4. Paste into editor
5. Click "Run"
6. Verify RLS enabled on all tables
```

### Phase 6: Test RLS & Get Credentials

```
File: SUPABASE_SETUP_GUIDE.md (STEP 6 & 7)

Action:
1. Test RLS policies work correctly
2. Go to Settings → API
3. Copy anon key and service role key
4. Go to Settings → Database → Connection string
5. Copy connection info
```

### Phase 7: Configure Environment

```
File: SUPABASE_SETUP_GUIDE.md (STEP 8)

Action:
1. Create/edit .env.local in project root
2. Add all Supabase environment variables
3. Save securely
```

---

## 📊 What You'll Have After Setup

✅ **7 Tables**

- companies (multi-tenant root)
- warehouses (physical locations)
- products (product catalog)
- inventory (stock levels)
- stock_movements (immutable audit trail)
- users (linked to Supabase Auth)
- audit_logs (immutable system logs)

✅ **Multi-Tenant Database**

- Company-level isolation
- Secure data boundaries
- RBAC ready (admin/manager/user)

✅ **PostgreSQL Features**

- Foreign key relationships
- Composite indexes
- Computed columns
- Constraints
- Triggers (ready for stored procedures)

✅ **Security Features**

- Row Level Security (RLS)
- Company isolation
- Role-based access
- Immutable audit trails
- Secure password policies

✅ **Production Ready**

- Optimized indexes
- Proper data types
- Relationships
- Sample data
- RLS policies
- Connection pooling support

---

## 💾 Credentials You'll Get

After setup, you'll have:

```
✅ Supabase Project URL
✅ Supabase Anon Key (client-side)
✅ Supabase Service Role Key (backend only)
✅ Database Host
✅ Database Port (5432)
✅ Database Name
✅ Database Username & Password
✅ JWT Secret
```

**Save as:**

- `.env.local` in project root (frontend + backend)
- Keep service role key secret!
- Don't commit .env.local to git

---

## 🎯 Quick Reference

| File                        | Purpose        | When to Use        |
| --------------------------- | -------------- | ------------------ |
| SUPABASE_BROWSER_PROMPT.txt | Main guidance  | Start here         |
| SUPABASE_SETUP_GUIDE.md     | Detailed steps | Reference guide    |
| SUPABASE_SCHEMA.sql         | Create tables  | Run in SQL Editor  |
| SUPABASE_RLS_POLICIES.sql   | Security rules | After tables ready |

---

## ⚡ Browser Extension Tips

1. **Start with SUPABASE_BROWSER_PROMPT.txt** - Let Claude guide you
2. **Copy entire SQL files** - Don't paste partial SQL
3. **Follow step-by-step** - Create tables before RLS policies
4. **Save IDs from each step** - You need them for next steps
5. **Verify in Supabase dashboard** - Check each phase completes
6. **Test RLS policies** - Make sure security works
7. **Use exact credentials** - Don't mix anon and service keys

---

## ✅ Verification Checklist

After setup, verify:

- [ ] Supabase project created
- [ ] All 7 tables created and visible
- [ ] Foreign key relationships working
- [ ] Indexes created and optimized
- [ ] RLS enabled on all tables
- [ ] Helper functions created
- [ ] RLS policies applied
- [ ] Sample data in each table
- [ ] Auth user created
- [ ] User linked to company
- [ ] RLS policies working (test queries)
- [ ] Environment variables saved
- [ ] Connection string copied
- [ ] API keys in .env.local
- [ ] Ready for Next.js integration

---

## 🔗 Connection to Next.js App

Once setup complete:

```bash
1. Add .env.local variables (all Supabase credentials)
2. Run: npm run dev
3. Visit: http://localhost:3000/inventory-v2
4. Test inventory dashboard
5. Begin building features
```

---

## 📞 If Browser Extension Needs Clarification

1. Reference exact table/field names from **SUPABASE_SCHEMA.sql**
2. Copy exact SQL from **SUPABASE_SETUP_GUIDE.md**
3. Use exact RLS policies from **SUPABASE_RLS_POLICIES.sql**
4. Check **SUPABASE_BROWSER_PROMPT.txt** for comprehensive requirements

---

## 🎉 You're Ready!

All the information Claude needs to build your database is in these 4 files.

**Start with: SUPABASE_BROWSER_PROMPT.txt**

Happy building! 🚀
