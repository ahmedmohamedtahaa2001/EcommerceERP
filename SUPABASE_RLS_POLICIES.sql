-- Operix ERP - Row Level Security (RLS) Policies
-- Multi-tenant data isolation and access control
-- Apply these policies after schema creation

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.auth_user_company_id() RETURNS UUID AS $$
  SELECT company_id FROM public.users WHERE id = auth.uid()
$$ LANGUAGE SQL STABLE;

CREATE OR REPLACE FUNCTION public.auth_user_role() RETURNS TEXT AS $$
  SELECT role FROM public.users WHERE id = auth.uid()
$$ LANGUAGE SQL STABLE;

-- ============================================================================
-- COMPANIES - Only admins of company can view/edit
-- ============================================================================
CREATE POLICY "Companies: Admins can view own company" ON public.companies
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.company_id = companies.id
        AND users.id = auth.uid()
        AND users.role = 'admin'
    )
  );

CREATE POLICY "Companies: Admins can update own company" ON public.companies
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.company_id = companies.id
        AND users.id = auth.uid()
        AND users.role = 'admin'
    )
  );

-- ============================================================================
-- WAREHOUSES - Company members can view, admins can edit
-- ============================================================================
CREATE POLICY "Warehouses: Company members can view" ON public.warehouses
  FOR SELECT USING (
    company_id = public.auth_user_company_id()
  );

CREATE POLICY "Warehouses: Users can insert in their company" ON public.warehouses
  FOR INSERT WITH CHECK (
    company_id = public.auth_user_company_id()
  );

CREATE POLICY "Warehouses: Admins can update" ON public.warehouses
  FOR UPDATE USING (
    company_id = public.auth_user_company_id()
    AND public.auth_user_role() = 'admin'
  );

CREATE POLICY "Warehouses: Admins can delete" ON public.warehouses
  FOR DELETE USING (
    company_id = public.auth_user_company_id()
    AND public.auth_user_role() = 'admin'
  );

-- ============================================================================
-- PRODUCTS - Company members can view, admins/managers can edit
-- ============================================================================
CREATE POLICY "Products: Company members can view" ON public.products
  FOR SELECT USING (
    company_id = public.auth_user_company_id()
  );

CREATE POLICY "Products: Managers can insert" ON public.products
  FOR INSERT WITH CHECK (
    company_id = public.auth_user_company_id()
    AND public.auth_user_role() IN ('admin', 'manager')
  );

CREATE POLICY "Products: Managers can update" ON public.products
  FOR UPDATE USING (
    company_id = public.auth_user_company_id()
    AND public.auth_user_role() IN ('admin', 'manager')
  );

CREATE POLICY "Products: Admins can delete" ON public.products
  FOR DELETE USING (
    company_id = public.auth_user_company_id()
    AND public.auth_user_role() = 'admin'
  );

-- ============================================================================
-- INVENTORY - Company members can view, managers can edit
-- ============================================================================
CREATE POLICY "Inventory: Company members can view" ON public.inventory
  FOR SELECT USING (
    company_id = public.auth_user_company_id()
  );

CREATE POLICY "Inventory: Users can insert in their company" ON public.inventory
  FOR INSERT WITH CHECK (
    company_id = public.auth_user_company_id()
  );

CREATE POLICY "Inventory: Managers can update" ON public.inventory
  FOR UPDATE USING (
    company_id = public.auth_user_company_id()
    AND public.auth_user_role() IN ('admin', 'manager')
  );

CREATE POLICY "Inventory: Admins can delete" ON public.inventory
  FOR DELETE USING (
    company_id = public.auth_user_company_id()
    AND public.auth_user_role() = 'admin'
  );

-- ============================================================================
-- STOCK_MOVEMENTS (Audit Trail - Read-only for users, System creates)
-- ============================================================================
CREATE POLICY "Stock Movements: Company members can view" ON public.stock_movements
  FOR SELECT USING (
    company_id = public.auth_user_company_id()
  );

CREATE POLICY "Stock Movements: System can insert" ON public.stock_movements
  FOR INSERT WITH CHECK (
    company_id = public.auth_user_company_id()
  );

-- Prevent any updates or deletes (immutable audit trail)
CREATE POLICY "Stock Movements: No updates allowed" ON public.stock_movements
  FOR UPDATE USING (false);

CREATE POLICY "Stock Movements: No deletes allowed" ON public.stock_movements
  FOR DELETE USING (false);

-- ============================================================================
-- USERS - Users can view company members, admins can edit
-- ============================================================================
CREATE POLICY "Users: Company members can view each other" ON public.users
  FOR SELECT USING (
    company_id = public.auth_user_company_id()
  );

CREATE POLICY "Users: Users can view their own profile" ON public.users
  FOR SELECT USING (
    id = auth.uid()
  );

CREATE POLICY "Users: Users can update own profile" ON public.users
  FOR UPDATE USING (
    id = auth.uid()
  );

CREATE POLICY "Users: Admins can insert users" ON public.users
  FOR INSERT WITH CHECK (
    company_id = public.auth_user_company_id()
    AND public.auth_user_role() = 'admin'
  );

CREATE POLICY "Users: Admins can update users" ON public.users
  FOR UPDATE USING (
    company_id = public.auth_user_company_id()
    AND public.auth_user_role() = 'admin'
  );

CREATE POLICY "Users: Admins can delete users" ON public.users
  FOR DELETE USING (
    company_id = public.auth_user_company_id()
    AND public.auth_user_role() = 'admin'
  );

-- ============================================================================
-- AUDIT_LOGS (Read-only for viewing, System creates new entries)
-- ============================================================================
CREATE POLICY "Audit Logs: Company members can view" ON public.audit_logs
  FOR SELECT USING (
    company_id = public.auth_user_company_id()
  );

CREATE POLICY "Audit Logs: System can insert" ON public.audit_logs
  FOR INSERT WITH CHECK (
    company_id = public.auth_user_company_id()
  );

-- Prevent any updates or deletes (immutable logs)
CREATE POLICY "Audit Logs: No updates allowed" ON public.audit_logs
  FOR UPDATE USING (false);

CREATE POLICY "Audit Logs: No deletes allowed" ON public.audit_logs
  FOR DELETE USING (false);

-- ============================================================================
-- PUBLIC ACCESS POLICIES (for unauthenticated users - restrictive)
-- ============================================================================

CREATE POLICY "Default: Deny all for unauthenticated users" ON public.companies
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Default: Deny all for unauthenticated users" ON public.warehouses
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Default: Deny all for unauthenticated users" ON public.products
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Default: Deny all for unauthenticated users" ON public.inventory
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Default: Deny all for unauthenticated users" ON public.stock_movements
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Default: Deny all for unauthenticated users" ON public.users
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Default: Deny all for unauthenticated users" ON public.audit_logs
  FOR ALL USING (auth.role() = 'authenticated');
