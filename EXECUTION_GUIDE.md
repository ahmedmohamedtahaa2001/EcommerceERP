# 🚀 Operix ERP - Final Execution Guide

**Status:** Ready to execute  
**Total Time:** 3-4 hours  
**Start Time:** Now  

---

## STEP 1: Apply RLS Security Policies (5-10 minutes)

### What This Does
- Enables Row Level Security on 10 database tables
- Creates 38 security policies
- Enforces organization-level data isolation at database level
- **This is CRITICAL for production security**

### How to Execute

**1. Open Supabase Dashboard**
```
URL: https://app.supabase.com
Project: nhalhrwoiyqurndsbujz
```

**2. Navigate to SQL Editor**
- Left sidebar → SQL Editor
- Click "New Query"

**3. Copy the RLS Setup Script**
```bash
# Option A: Copy from terminal
cat /Users/ahmedaboelsnoon/Desktop/PROjects/ERP/RLS_SETUP.sql
```

**4. Paste into SQL Editor**
- Select all the SQL output above
- Paste into Supabase SQL Editor
- **DO NOT modify anything**

**5. Execute the Script**
- Click the "RUN" button (bottom right)
- Wait for completion (should be instant)

**6. Verify RLS Was Applied**

Paste this verification query into a new SQL query:
```sql
SELECT tablename, policyname 
FROM pg_policies 
WHERE tablename IN ('inventory', 'products', 'orders', 'customers', 'warehouses', 'users', 'organizations', 'audit_logs', 'stock_movements', 'roles')
ORDER BY tablename;
```

**Expected Result:** Should show 38+ policies

**Example Output:**
```
tablename      | policyname
───────────────┼───────────────────────────────────────
inventory      | Users can view own organization inventory
inventory      | Users can insert inventory in own organization
inventory      | Users can update inventory in own organization
inventory      | Users can delete inventory in own organization
products       | Users can view own organization products
... (38 total)
```

### ✅ Success Indicators
- [ ] Query returned 38+ policies
- [ ] No errors during execution
- [ ] All table names are present
- [ ] RLS is now ENABLED

---

## STEP 2: Create Demo Data (30 minutes)

### What This Creates
- 1 demo organization ("Demo Corp")
- 3 warehouses (New York, California, Texas)
- 5 products (Laptop, Monitor, Keyboard, Mouse, USB Hub)
- 7 inventory records (stock distributed across warehouses)
- 4 customers (John Doe, Jane Smith, Bob Johnson, Alice Williams)
- 4 orders (various statuses: pending, processing, completed)
- 7 stock movements (fully logged)

### How to Execute

**1. Get the Demo Data Script**
```bash
cat /Users/ahmedaboelsnoon/Desktop/PROjects/ERP/DEMO_DATA.sql | head -50
```

**2. Open New SQL Query in Supabase**
- SQL Editor → "New Query"

**3. Copy and Paste Demo Data**

**Option A: Direct Paste (Easiest)**
```bash
cat /Users/ahmedaboelsnoon/Desktop/PROjects/ERP/DEMO_DATA.sql
```
- Copy entire output
- Paste into Supabase SQL Editor

**Option B: With Custom UUIDs (Optional)**

If you want to use custom UUIDs instead of the defaults:

Generate new UUIDs:
```bash
python3 -c "import uuid; [print(uuid.uuid4()) for _ in range(2)]"
```

Example output:
```
550e8400-e29b-41d4-a716-446655440099
550e8400-e29b-41d4-a716-446655440098
```

Then edit the file and replace placeholders:
```bash
# Replace YOUR_ORG_ID_HERE with your org UUID
sed -i '' "s/550e8400-e29b-41d4-a716-446655440000/YOUR_NEW_ORG_UUID/g" \
  /Users/ahmedaboelsnoon/Desktop/PROjects/ERP/DEMO_DATA.sql
```

**4. Execute in Supabase**
- Paste the SQL (entire script)
- Click "RUN"
- Wait for completion

**5. Verify Data Was Created**

Run these verification queries one by one:

```sql
-- Check organizations
SELECT id, name, created_at FROM organizations LIMIT 5;
```
Expected: Shows "Demo Corp" with UUID

```sql
-- Check warehouses
SELECT id, name, location, capacity FROM warehouses LIMIT 5;
```
Expected: Shows NY, CA, TX warehouses

```sql
-- Check products
SELECT id, name, sku, price FROM products LIMIT 5;
```
Expected: Shows Laptop, Monitor, Keyboard, etc.

```sql
-- Check inventory
SELECT product_id, warehouse_id, quantity FROM inventory LIMIT 10;
```
Expected: Shows 7 inventory records

```sql
-- Check customers
SELECT id, name, email FROM customers LIMIT 5;
```
Expected: Shows 4 customers

```sql
-- Check orders
SELECT id, status, total FROM orders LIMIT 5;
```
Expected: Shows 4 orders

### ✅ Success Indicators
- [ ] Organizations table has 1 demo record
- [ ] Warehouses table has 3 records
- [ ] Products table has 5 records
- [ ] Inventory table has 7 records
- [ ] Customers table has 4 records
- [ ] Orders table has 4 records

---

## STEP 3: Start Local Development Server (5 minutes)

### Prerequisites
- Node.js installed
- npm/yarn installed
- All dependencies installed

### How to Start

**1. Navigate to Project**
```bash
cd /Users/ahmedaboelsnoon/Desktop/PROjects/ERP
```

**2. Install Dependencies (if not done)**
```bash
npm install
```

**3. Start Development Server**
```bash
npm run dev
```

**Expected Output:**
```
> next dev
  ▲ Next.js 14.0.0
  - Local:        http://localhost:3000
  - Environments: .env.local

Ready in 2.5s
```

**4. Verify Server is Running**
```bash
curl http://localhost:3000 | head -20
```

Should return HTML content

**5. Open in Browser**
```
http://localhost:3000
```

### ✅ Success Indicators
- [ ] Server started without errors
- [ ] Console shows "Ready in X.Xs"
- [ ] Browser can access http://localhost:3000
- [ ] No 500 errors in console

---

## STEP 4: Test Authentication & APIs (1-2 hours)

### Test 1: Login Page
```
URL: http://localhost:3000/auth/login
```

**Steps:**
1. Open the URL
2. Check no console errors (DevTools → Console)
3. Page should load with email/password inputs

### Test 2: Create Test User in Supabase

Run this in Supabase SQL Editor:
```sql
-- Create test user in auth
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at)
VALUES (
  '550e8400-e29b-41d4-a716-446655440001',
  'testuser@demo.com',
  crypt('Demo12345!', gen_salt('bf')),
  now()
)
ON CONFLICT (id) DO NOTHING;

-- Create user record in users table
INSERT INTO users (id, email, organization_id)
VALUES (
  '550e8400-e29b-41d4-a716-446655440001',
  'testuser@demo.com',
  '550e8400-e29b-41d4-a716-446655440000'
)
ON CONFLICT (id) DO NOTHING;
```

### Test 3: Login with Test User

**In Browser:**
1. Go to http://localhost:3000/auth/login
2. Email: `testuser@demo.com`
3. Password: `Demo12345!`
4. Click Login

**Expected Result:**
- Redirects to dashboard
- No errors in console
- Cookies set (check DevTools → Application → Cookies)

### Test 4: API Endpoints

**Use the API testing guide:**
```bash
open /Users/ahmedaboelsnoon/Desktop/PROjects/ERP/API_TESTING.md
```

**Or run these quick tests:**

**Test Inventory API:**
```bash
curl -X GET http://localhost:3000/api/inventory \
  -H "Content-Type: application/json"
```

**Test Products API:**
```bash
curl -X GET http://localhost:3000/api/products \
  -H "Content-Type: application/json"
```

**Test Orders API:**
```bash
curl -X GET http://localhost:3000/api/orders \
  -H "Content-Type: application/json"
```

**Test Customers API:**
```bash
curl -X GET http://localhost:3000/api/customers \
  -H "Content-Type: application/json"
```

**Test Warehouses API:**
```bash
curl -X GET http://localhost:3000/api/warehouses \
  -H "Content-Type: application/json"
```

**Expected Response:**
```json
{
  "success": true,
  "data": [...],
  "pagination": {...}
}
```

### Test 5: Multi-Tenant Isolation Verification

Create a second organization and user to verify data isolation:

**1. In Supabase SQL Editor:**
```sql
-- Create second organization
INSERT INTO organizations (id, name)
VALUES ('550e8400-e29b-41d4-a716-446655440999', 'Test Org 2');

-- Create second user auth
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at)
VALUES (
  '550e8400-e29b-41d4-a716-446655440998',
  'testuser2@demo.com',
  crypt('Demo12345!', gen_salt('bf')),
  now()
)
ON CONFLICT (id) DO NOTHING;

-- Create second user record
INSERT INTO users (id, email, organization_id)
VALUES (
  '550e8400-e29b-41d4-a716-446655440998',
  'testuser2@demo.com',
  '550e8400-e29b-41d4-a716-446655440999'
)
ON CONFLICT (id) DO NOTHING;
```

**2. In Browser (Incognito Window):**
- Go to http://localhost:3000/auth/login
- Login with: `testuser2@demo.com` / `Demo12345!`

**3. Test Data Isolation:**
- Query `/api/inventory` as Org 2 user
- Should return empty or 0 records (Org 2 has no inventory)
- Should NOT see Org 1's 7 inventory records

**✅ If Org 2 user sees Org 1 data → RLS is NOT working**

### ✅ Success Indicators
- [ ] Login works without errors
- [ ] Cookies are set after login
- [ ] All 5 API modules respond
- [ ] Responses have `success: true`
- [ ] Org 2 user cannot see Org 1 data
- [ ] RLS isolation is confirmed

---

## STEP 5: Prepare for Production Deployment

### Option A: Deploy to Vercel (Recommended)

**1. Push to GitHub**
```bash
cd /Users/ahmedaboelsnoon/Desktop/PROjects/ERP
git add .
git commit -m "feat: complete production setup with RLS and demo data

- Applied RLS security policies (38 policies on 10 tables)
- Created demo data (5 products, 7 inventory, 4 orders)
- Verified all API endpoints working
- Confirmed multi-tenant isolation
- Ready for production deployment

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>"
git push origin main
```

**2. Go to Vercel**
- https://vercel.com/dashboard
- Click "Add New..." → "Project"
- Import your GitHub repository
- Select project from list

**3. Set Environment Variables**
- Click "Environment Variables"
- Add these 3 variables:
```
NEXT_PUBLIC_SUPABASE_URL = https://nhalhrwoiyqurndsbujz.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY = sb_publishable_FY8bTYe3-RCMgDpxTMbYWg_Mpsf4aRK
SUPABASE_SERVICE_ROLE_KEY = REDACTED_SUPABASE_SECRET
```

**4. Click "Deploy"**
- Wait for build to complete (~3-5 minutes)
- Get your production URL (e.g., operix-erp.vercel.app)

**5. Configure Supabase CORS**
- Go to Supabase Project Settings
- API Settings
- Add your Vercel domain to CORS allowed origins

### Option B: Deploy with Docker

**1. Create Dockerfile**
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

**2. Build and Run**
```bash
docker build -t operix-erp .
docker run -p 3000:3000 \
  -e NEXT_PUBLIC_SUPABASE_URL=https://nhalhrwoiyqurndsbujz.supabase.co \
  -e NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_FY8bTYe3-RCMgDpxTMbYWg_Mpsf4aRK \
  -e SUPABASE_SERVICE_ROLE_KEY=REDACTED_SUPABASE_SECRET \
  operix-erp
```

### Option C: Deploy to VPS (Advanced)

```bash
# SSH into server
ssh user@your-server.com

# Clone and setup
git clone https://github.com/yourusername/operix-erp.git
cd operix-erp
npm install
npm run build

# Run with PM2
npm install -g pm2
pm2 start npm --name "operix-erp" -- start
pm2 save
```

---

## STEP 6: Verify Production Deployment

### Test Endpoints on Production

**Get your production URL:**
```
Example: https://operix-erp.vercel.app
```

**Test endpoints:**
```bash
# Test products endpoint
curl https://your-production-url/api/products

# Expected response:
# {"success":true,"data":[...],"pagination":{...}}
```

### Monitor Performance

**Vercel Dashboard:**
- https://vercel.com/dashboard
- Select your project
- Check Analytics tab
- Monitor performance metrics

**Supabase Dashboard:**
- https://app.supabase.com
- Project: nhalhrwoiyqurndsbujz
- Check Database Performance
- Monitor query performance

---

## Quick Reference Commands

### Check if Server is Running
```bash
curl http://localhost:3000/api/products | jq .
```

### View Recent Logs
```bash
# Last 50 lines
tail -50 /var/log/operix-erp.log
```

### Restart Server
```bash
# Kill current process
pkill -f "npm run dev"

# Restart
npm run dev
```

### Test Database Connection
```bash
# In SQL Editor, run:
SELECT COUNT(*) as total_records FROM inventory;
```

---

## Success Checklist

✅ **RLS Security Applied**
- [ ] 38 policies created
- [ ] Verified with SQL query
- [ ] No errors during setup

✅ **Demo Data Created**
- [ ] 1 organization
- [ ] 3 warehouses
- [ ] 5 products
- [ ] 7 inventory records
- [ ] 4 customers
- [ ] 4 orders

✅ **Local Testing Complete**
- [ ] Server starts without errors
- [ ] Login works
- [ ] All 5 APIs respond
- [ ] Data isolation verified
- [ ] No console errors

✅ **Production Ready**
- [ ] Code pushed to GitHub
- [ ] Deployed to production
- [ ] Environment variables set
- [ ] Production URL accessible
- [ ] APIs responding on production

---

## Troubleshooting

### RLS Not Applied
**Problem:** SQL ran but policies not showing

**Solution:**
1. Verify script completed without errors
2. Run verification query again
3. Check pg_policies table directly:
   ```sql
   SELECT COUNT(*) FROM pg_policies;
   ```
4. Restart Supabase connection if needed

### Demo Data Not Visible
**Problem:** Data inserted but queries return empty

**Solution:**
1. Check UUIDs match in INSERT statements
2. Verify RLS policies are allowing SELECT
3. Check organization_id in all records
4. Re-run verification queries

### API Returning 401
**Problem:** Authenticated endpoints return Unauthorized

**Solution:**
1. Verify user exists in database:
   ```sql
   SELECT * FROM users WHERE email = 'testuser@demo.com';
   ```
2. Check cookies in browser DevTools
3. Verify getUserContext() is working
4. Check middleware configuration

### Deployment Failed
**Problem:** Vercel build fails

**Solution:**
1. Check build logs in Vercel dashboard
2. Verify environment variables are set
3. Run local build: `npm run build`
4. Check for TypeScript errors: `npm run type-check`

---

## Timeline

**NOW (0 min):** Start this guide
**5-10 min:** Apply RLS policies
**40-50 min:** Create demo data
**55 min:** Start local server
**2-3 hours:** Test APIs
**3-4 hours:** Deploy to production

**TOTAL TIME:** 3-4 hours to 100% production ready

---

## You're Ready! 🚀

All the pieces are in place. Just follow these steps in order and you'll have a fully production-ready ERP system.

**Questions?** Refer back to:
- QUICK_START.md for overview
- FINAL_PRODUCTION_STEPS.md for detailed info
- API_TESTING.md for endpoint reference

**Let's go!**

