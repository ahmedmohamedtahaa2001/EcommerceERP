import { getServerClient } from '@/lib/supabase';
import { NextRequest } from 'next/server';

export async function getUserContext(request: NextRequest) {
  try {
    const supabase = getServerClient();
    
    const token = request.cookies.get('auth_token')?.value;
    if (!token) {
      return { user: null, org: null, error: 'No auth token' };
    }

    const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers();
    
    if (usersError || !users || users.length === 0) {
      return { user: null, org: null, error: 'User not found' };
    }

    const user = users[0];
    
    const { data: orgUser, error: orgError } = await supabase
      .from('users')
      .select('id, organization_id')
      .eq('id', user.id)
      .single();

    if (orgError || !orgUser) {
      return { user, org: null, error: 'Organization not found' };
    }

    const { data: org } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', orgUser.organization_id)
      .single();

    return { user, org, error: null };
  } catch (error) {
    return { user: null, org: null, error: String(error) };
  }
}

export async function getWarehouses(
  organizationId: string,
  options: { sortBy?: string; sortOrder?: 'asc' | 'desc' } = {}
) {
  const supabase = getServerClient();
  const { sortBy = 'created_at', sortOrder = 'desc' } = options;

  const validSortFields = ['created_at', 'name'];
  const finalSortBy = validSortFields.includes(sortBy) ? sortBy : 'created_at';

  const { data, error } = await supabase
    .from('warehouses')
    .select('*')
    .eq('organization_id', organizationId)
    .order(finalSortBy, { ascending: sortOrder === 'asc' });

  if (error) {
    throw error;
  }

  return data || [];
}

export async function getWarehouse(organizationId: string, warehouseId: string) {
  const supabase = getServerClient();

  const { data, error } = await supabase
    .from('warehouses')
    .select('*')
    .eq('id', warehouseId)
    .eq('organization_id', organizationId)
    .single();

  if (error || !data) {
    throw new Error('Warehouse not found');
  }

  return data;
}

export async function createWarehouse(
  organizationId: string,
  userId: string,
  payload: {
    name: string;
    location: string;
    address?: string;
    city?: string;
    state?: string;
    zip?: string;
    capacity?: number;
    notes?: string;
  }
) {
  const supabase = getServerClient();
  const { name, location, address, city, state, zip, capacity, notes } = payload;

  if (!name || !location) {
    throw new Error('Missing required fields: name, location');
  }

  const now = new Date().toISOString();
  const newWarehouse = {
    organization_id: organizationId,
    name,
    location,
    address: address || '',
    city: city || '',
    state: state || '',
    zip: zip || '',
    capacity: capacity || 0,
    notes: notes || '',
    created_at: now,
    updated_at: now,
    created_by: userId,
  };

  const { data, error } = await supabase
    .from('warehouses')
    .insert([newWarehouse])
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function updateWarehouse(
  organizationId: string,
  warehouseId: string,
  payload: Partial<{
    name: string;
    location: string;
    address: string;
    city: string;
    state: string;
    zip: string;
    capacity: number;
    notes: string;
  }>
) {
  const supabase = getServerClient();

  const updateData: any = {
    ...payload,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('warehouses')
    .update(updateData)
    .eq('id', warehouseId)
    .eq('organization_id', organizationId)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function deleteWarehouse(organizationId: string, warehouseId: string) {
  const supabase = getServerClient();

  const { error } = await supabase
    .from('warehouses')
    .delete()
    .eq('id', warehouseId)
    .eq('organization_id', organizationId);

  if (error) {
    throw error;
  }

  return { success: true };
}

export async function getWarehouseCapacityStats(
  organizationId: string,
  warehouseId: string
) {
  const supabase = getServerClient();

  const { data, error } = await supabase
    .from('inventory')
    .select('quantity')
    .eq('organization_id', organizationId)
    .eq('warehouse_id', warehouseId);

  if (error) {
    throw error;
  }

  const totalQuantity = (data || []).reduce((sum, item) => sum + item.quantity, 0);

  const warehouse = await getWarehouse(organizationId, warehouseId);

  return {
    warehouse_id: warehouseId,
    capacity: warehouse.capacity || 0,
    used: totalQuantity,
    available: (warehouse.capacity || 0) - totalQuantity,
    utilization: warehouse.capacity ? (totalQuantity / warehouse.capacity) * 100 : 0,
  };
}
