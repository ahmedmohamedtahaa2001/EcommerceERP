import { getServerClient } from '@/lib/supabase';
import { NextRequest } from 'next/server';

// Get user and organization from request (via Supabase auth)
export async function getUserContext(request: NextRequest) {
  try {
    const supabase = getServerClient();
    
    // Get auth token from cookies
    const token = request.cookies.get('auth_token')?.value;
    if (!token) {
      return { user: null, org: null, error: 'No auth token' };
    }

    // In a real app, decode the token and get user info
    // For now, we'll fetch from Supabase using the service role
    const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers();
    
    if (usersError || !users || users.length === 0) {
      return { user: null, org: null, error: 'User not found' };
    }

    // Get the first user (in production, decode the JWT to get the specific user)
    const user = users[0];
    
    // Get user's organization
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

export async function getInventory(
  organizationId: string,
  options: {
    warehouseId?: string;
    productId?: string;
    page?: number;
    pageSize?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  } = {}
) {
  const supabase = getServerClient();
  const {
    warehouseId,
    productId,
    page = 0,
    pageSize = 20,
    sortBy = 'created_at',
    sortOrder = 'desc',
  } = options;

  let query = supabase
    .from('inventory')
    .select('*', { count: 'exact' })
    .eq('organization_id', organizationId);

  if (warehouseId) {
    query = query.eq('warehouse_id', warehouseId);
  }

  if (productId) {
    query = query.eq('product_id', productId);
  }

  const validSortFields = ['created_at', 'updated_at', 'quantity', 'reorder_level'];
  const finalSortBy = validSortFields.includes(sortBy) ? sortBy : 'created_at';

  query = query
    .order(finalSortBy, { ascending: sortOrder === 'asc' })
    .range(page * pageSize, (page + 1) * pageSize - 1);

  const { data, error, count } = await query;

  if (error) {
    throw error;
  }

  return {
    data: data || [],
    pagination: {
      page,
      pageSize,
      total: count || 0,
      hasMore: (count || 0) > (page + 1) * pageSize,
    },
  };
}

export async function createInventory(
  organizationId: string,
  userId: string,
  payload: {
    productId: string;
    warehouseId: string;
    quantity: number;
    reserved?: number;
    reorderLevel?: number;
  }
) {
  const supabase = getServerClient();
  const {
    productId,
    warehouseId,
    quantity,
    reserved = 0,
    reorderLevel = 10,
  } = payload;

  // Validation
  if (!productId || !warehouseId || quantity === undefined) {
    throw new Error('Missing required fields: productId, warehouseId, quantity');
  }

  if (quantity < 0) {
    throw new Error('Quantity cannot be negative');
  }

  const now = new Date().toISOString();
  const newInventory = {
    organization_id: organizationId,
    product_id: productId,
    warehouse_id: warehouseId,
    quantity,
    reserved,
    available: Math.max(0, quantity - reserved),
    reorder_level: reorderLevel,
    last_restocked: now,
    created_at: now,
    updated_at: now,
    created_by: userId,
  };

  const { data, error } = await supabase
    .from('inventory')
    .insert([newInventory])
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function updateInventory(
  organizationId: string,
  inventoryId: string,
  payload: Partial<{
    quantity: number;
    reserved: number;
    reorderLevel: number;
  }>
) {
  const supabase = getServerClient();

  const updateData: any = {
    ...payload,
    updated_at: new Date().toISOString(),
  };

  // Recalculate available if quantity or reserved changes
  if (payload.quantity !== undefined || payload.reserved !== undefined) {
    const { data: current } = await supabase
      .from('inventory')
      .select('quantity, reserved')
      .eq('id', inventoryId)
      .eq('organization_id', organizationId)
      .single();

    if (current) {
      const qty = payload.quantity ?? current.quantity;
      const res = payload.reserved ?? current.reserved;
      updateData.available = Math.max(0, qty - res);
    }
  }

  const { data, error } = await supabase
    .from('inventory')
    .update(updateData)
    .eq('id', inventoryId)
    .eq('organization_id', organizationId)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function adjustInventory(
  organizationId: string,
  userId: string,
  inventoryId: string,
  adjustment: number,
  reason: string
) {
  const supabase = getServerClient();

  // Get current inventory
  const { data: current, error: fetchError } = await supabase
    .from('inventory')
    .select('quantity, reserved')
    .eq('id', inventoryId)
    .eq('organization_id', organizationId)
    .single();

  if (fetchError || !current) {
    throw new Error('Inventory item not found');
  }

  const newQuantity = Math.max(0, current.quantity + adjustment);

  // Update inventory
  const { data: updated, error: updateError } = await supabase
    .from('inventory')
    .update({
      quantity: newQuantity,
      available: Math.max(0, newQuantity - current.reserved),
      updated_at: new Date().toISOString(),
    })
    .eq('id', inventoryId)
    .select()
    .single();

  if (updateError) {
    throw updateError;
  }

  // Log movement
  const { error: movementError } = await supabase.from('stock_movements').insert([
    {
      organization_id: organizationId,
      inventory_id: inventoryId,
      movement_type: adjustment > 0 ? 'addition' : 'reduction',
      quantity: Math.abs(adjustment),
      reason,
      created_by: userId,
      created_at: new Date().toISOString(),
    },
  ]);

  if (movementError) {
    console.error('Failed to log movement:', movementError);
  }

  return updated;
}

export async function transferInventory(
  organizationId: string,
  userId: string,
  payload: {
    fromInventoryId: string;
    toInventoryId: string;
    quantity: number;
    reason?: string;
  }
) {
  const supabase = getServerClient();
  const { fromInventoryId, toInventoryId, quantity, reason = 'Transfer' } = payload;

  // Get both inventory items
  const { data: fromInv, error: fromError } = await supabase
    .from('inventory')
    .select('quantity, reserved')
    .eq('id', fromInventoryId)
    .eq('organization_id', organizationId)
    .single();

  if (fromError || !fromInv) {
    throw new Error('Source inventory not found');
  }

  const availableToTransfer = Math.max(0, fromInv.quantity - fromInv.reserved);
  if (availableToTransfer < quantity) {
    throw new Error(`Insufficient inventory. Available: ${availableToTransfer}, Requested: ${quantity}`);
  }

  const { data: toInv, error: toError } = await supabase
    .from('inventory')
    .select('quantity, reserved')
    .eq('id', toInventoryId)
    .eq('organization_id', organizationId)
    .single();

  if (toError || !toInv) {
    throw new Error('Destination inventory not found');
  }

  // Update both inventories
  const now = new Date().toISOString();

  await supabase
    .from('inventory')
    .update({
      quantity: fromInv.quantity - quantity,
      available: Math.max(0, fromInv.quantity - quantity - fromInv.reserved),
      updated_at: now,
    })
    .eq('id', fromInventoryId);

  await supabase
    .from('inventory')
    .update({
      quantity: toInv.quantity + quantity,
      available: Math.max(0, toInv.quantity + quantity - toInv.reserved),
      updated_at: now,
    })
    .eq('id', toInventoryId);

  // Log movements
  await supabase.from('stock_movements').insert([
    {
      organization_id: organizationId,
      inventory_id: fromInventoryId,
      movement_type: 'transfer_out',
      quantity,
      reason: `${reason} (to another location)`,
      created_by: userId,
      created_at: now,
    },
    {
      organization_id: organizationId,
      inventory_id: toInventoryId,
      movement_type: 'transfer_in',
      quantity,
      reason: `${reason} (from another location)`,
      created_by: userId,
      created_at: now,
    },
  ]);

  return { success: true, message: `Transferred ${quantity} units` };
}

export async function getStockMovements(
  organizationId: string,
  inventoryId?: string,
  options: { page?: number; pageSize?: number } = {}
) {
  const supabase = getServerClient();
  const { page = 0, pageSize = 50 } = options;

  let query = supabase
    .from('stock_movements')
    .select('*', { count: 'exact' })
    .eq('organization_id', organizationId);

  if (inventoryId) {
    query = query.eq('inventory_id', inventoryId);
  }

  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(page * pageSize, (page + 1) * pageSize - 1);

  if (error) {
    throw error;
  }

  return {
    data: data || [],
    pagination: {
      page,
      pageSize,
      total: count || 0,
    },
  };
}
