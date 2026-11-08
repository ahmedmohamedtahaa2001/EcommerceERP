# Supabase Row Level Security (RLS) Policies

## Overview

RLS policies enforce data access control at the database level. Only users from the same organization can access that organization's data.

## How to Apply These Policies

1. Go to your Supabase Dashboard
2. Click on "SQL Editor" in the left sidebar
3. Click "New Query" 
4. Copy each SQL statement below and run it

---

## 1. Enable RLS on All Tables

```sql
-- Enable RLS on inventory table
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;

-- Enable RLS on stock_movements table
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;

-- Enable RLS on products table
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Enable RLS on orders table
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Enable RLS on customers table
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

-- Enable RLS on warehouses table
ALTER TABLE warehouses ENABLE ROW LEVEL SECURITY;

-- Enable RLS on users table
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Enable RLS on organizations table
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

-- Enable RLS on roles table
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;

-- Enable RLS on audit_logs table
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
```

---

## 2. Create Helper Function

This function gets the user's organization ID from the JWT:

```sql
CREATE OR REPLACE FUNCTION current_user_org_id() 
RETURNS UUID AS $$
  SELECT (auth.jwt() ->> 'user_metadata')::UUID AS org_id
$$ LANGUAGE SQL STABLE;

-- Alternative: get from users table
CREATE OR REPLACE FUNCTION get_user_org_id(user_id UUID)
RETURNS UUID AS $$
  SELECT organization_id FROM users WHERE id = user_id
$$ LANGUAGE SQL STABLE;
```

---

## 3. Inventory Table Policies

```sql
-- Allow users to view their organization's inventory
CREATE POLICY "Users can view own organization inventory"
  ON inventory
  FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM users WHERE id = auth.uid()
  ));

-- Allow users to insert inventory in their organization
CREATE POLICY "Users can insert inventory in own organization"
  ON inventory
  FOR INSERT
  WITH CHECK (organization_id IN (
    SELECT organization_id FROM users WHERE id = auth.uid()
  ));

-- Allow users to update inventory in their organization
CREATE POLICY "Users can update inventory in own organization"
  ON inventory
  FOR UPDATE
  USING (organization_id IN (
    SELECT organization_id FROM users WHERE id = auth.uid()
  ))
  WITH CHECK (organization_id IN (
    SELECT organization_id FROM users WHERE id = auth.uid()
  ));

-- Allow users to delete inventory in their organization
CREATE POLICY "Users can delete inventory in own organization"
  ON inventory
  FOR DELETE
  USING (organization_id IN (
    SELECT organization_id FROM users WHERE id = auth.uid()
  ));
```

---

## 4. Stock Movements Table Policies

```sql
-- Allow users to view stock movements in their organization
CREATE POLICY "Users can view own organization stock movements"
  ON stock_movements
  FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM users WHERE id = auth.uid()
  ));

-- Allow users to insert stock movements in their organization
CREATE POLICY "Users can insert stock movements in own organization"
  ON stock_movements
  FOR INSERT
  WITH CHECK (organization_id IN (
    SELECT organization_id FROM users WHERE id = auth.uid()
  ));
```

---

## 5. Products Table Policies

```sql
-- Allow users to view products in their organization
CREATE POLICY "Users can view own organization products"
  ON products
  FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM users WHERE id = auth.uid()
  ));

-- Allow users to insert products in their organization
CREATE POLICY "Users can insert products in own organization"
  ON products
  FOR INSERT
  WITH CHECK (organization_id IN (
    SELECT organization_id FROM users WHERE id = auth.uid()
  ));

-- Allow users to update products in their organization
CREATE POLICY "Users can update products in own organization"
  ON products
  FOR UPDATE
  USING (organization_id IN (
    SELECT organization_id FROM users WHERE id = auth.uid()
  ))
  WITH CHECK (organization_id IN (
    SELECT organization_id FROM users WHERE id = auth.uid()
  ));
```

---

## 6. Orders Table Policies

```sql
-- Allow users to view orders in their organization
CREATE POLICY "Users can view own organization orders"
  ON orders
  FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM users WHERE id = auth.uid()
  ));

-- Allow users to insert orders in their organization
CREATE POLICY "Users can insert orders in own organization"
  ON orders
  FOR INSERT
  WITH CHECK (organization_id IN (
    SELECT organization_id FROM users WHERE id = auth.uid()
  ));

-- Allow users to update orders in their organization
CREATE POLICY "Users can update orders in own organization"
  ON orders
  FOR UPDATE
  USING (organization_id IN (
    SELECT organization_id FROM users WHERE id = auth.uid()
  ))
  WITH CHECK (organization_id IN (
    SELECT organization_id FROM users WHERE id = auth.uid()
  ));
```

---

## 7. Customers Table Policies

```sql
-- Allow users to view customers in their organization
CREATE POLICY "Users can view own organization customers"
  ON customers
  FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM users WHERE id = auth.uid()
  ));

-- Allow users to insert customers in their organization
CREATE POLICY "Users can insert customers in own organization"
  ON customers
  FOR INSERT
  WITH CHECK (organization_id IN (
    SELECT organization_id FROM users WHERE id = auth.uid()
  ));

-- Allow users to update customers in their organization
CREATE POLICY "Users can update customers in own organization"
  ON customers
  FOR UPDATE
  USING (organization_id IN (
    SELECT organization_id FROM users WHERE id = auth.uid()
  ))
  WITH CHECK (organization_id IN (
    SELECT organization_id FROM users WHERE id = auth.uid()
  ));
```

---

## 8. Warehouses Table Policies

```sql
-- Allow users to view warehouses in their organization
CREATE POLICY "Users can view own organization warehouses"
  ON warehouses
  FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM users WHERE id = auth.uid()
  ));

-- Allow users to insert warehouses in their organization
CREATE POLICY "Users can insert warehouses in own organization"
  ON warehouses
  FOR INSERT
  WITH CHECK (organization_id IN (
    SELECT organization_id FROM users WHERE id = auth.uid()
  ));

-- Allow users to update warehouses in their organization
CREATE POLICY "Users can update warehouses in own organization"
  ON warehouses
  FOR UPDATE
  USING (organization_id IN (
    SELECT organization_id FROM users WHERE id = auth.uid()
  ))
  WITH CHECK (organization_id IN (
    SELECT organization_id FROM users WHERE id = auth.uid()
  ));
```

---

## 9. Audit Logs Table Policies

```sql
-- Allow users to view audit logs for their organization (read-only)
CREATE POLICY "Users can view own organization audit logs"
  ON audit_logs
  FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM users WHERE id = auth.uid()
  ));

-- Only service role can insert audit logs
CREATE POLICY "Service role can insert audit logs"
  ON audit_logs
  FOR INSERT
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');
```

---

## 10. Users Table Policies

```sql
-- Allow users to view their own user record
CREATE POLICY "Users can view own user record"
  ON users
  FOR SELECT
  USING (id = auth.uid());

-- Allow users to update their own user record
CREATE POLICY "Users can update own user record"
  ON users
  FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid() AND organization_id IN (
    SELECT organization_id FROM users WHERE id = auth.uid()
  ));

-- Organization admins can view all users in their organization
CREATE POLICY "Admins can view organization users"
  ON users
  FOR SELECT
  USING (organization_id IN (
    SELECT u.organization_id FROM users u 
    WHERE u.id = auth.uid() AND u.role_id IN (
      SELECT id FROM roles WHERE name = 'admin'
    )
  ));
```

---

## 11. Organizations Table Policies

```sql
-- Allow users to view their organization
CREATE POLICY "Users can view own organization"
  ON organizations
  FOR SELECT
  USING (id IN (
    SELECT organization_id FROM users WHERE id = auth.uid()
  ));

-- Only organization owner can update
CREATE POLICY "Org owner can update organization"
  ON organizations
  FOR UPDATE
  USING (id IN (
    SELECT organization_id FROM users WHERE id = auth.uid() AND role_id IN (
      SELECT id FROM roles WHERE name IN ('owner', 'admin')
    )
  ));
```

---

## Verification

After applying policies, test them:

```sql
-- Test as authenticated user (should return their org data only)
SELECT * FROM inventory LIMIT 1;

-- Test accessing another org (should fail)
SELECT * FROM inventory WHERE organization_id != (
  SELECT organization_id FROM users WHERE id = auth.uid()
);

-- View all policies
SELECT * FROM pg_policies WHERE tablename = 'inventory';
```

---

## Important Notes

1. **Authentication Required**: RLS only works when authenticated via Supabase Auth
2. **Service Role Bypass**: Service role key bypasses RLS (safe for API routes)
3. **Admin Access**: Consider adding admin-level policies if needed
4. **Performance**: Index `organization_id` and `id` for better performance
5. **Testing**: Test policies with different users to verify isolation

---

## Common Issues

### Policy Not Working?
- Ensure RLS is enabled on the table
- Check that the user's JWT contains correct data
- Verify the organization_id in the users table

### Can't Insert Data?
- Check WITH CHECK clause in INSERT policy
- Verify organization_id matches user's organization
- Ensure user has insert permission

### Slow Queries?
- Add indexes on organization_id
- Ensure policies use indexed columns
- Consider query optimization

