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

export async function getOrders(
  organizationId: string,
  options: {
    page?: number;
    pageSize?: number;
    status?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  } = {}
) {
  const supabase = getServerClient();
  const {
    page = 0,
    pageSize = 20,
    status,
    sortBy = 'created_at',
    sortOrder = 'desc',
  } = options;

  let query = supabase
    .from('orders')
    .select('*', { count: 'exact' })
    .eq('organization_id', organizationId);

  if (status) {
    query = query.eq('status', status);
  }

  const validSortFields = ['created_at', 'updated_at', 'total', 'status'];
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

export async function getOrder(organizationId: string, orderId: string) {
  const supabase = getServerClient();

  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .eq('organization_id', organizationId)
    .single();

  if (error || !data) {
    throw new Error('Order not found');
  }

  return data;
}

export async function createOrder(
  organizationId: string,
  userId: string,
  payload: {
    customerId: string;
    total: number;
    status?: string;
    notes?: string;
  }
) {
  const supabase = getServerClient();
  const { customerId, total, status = 'pending', notes } = payload;

  if (!customerId || total === undefined) {
    throw new Error('Missing required fields: customerId, total');
  }

  if (total < 0) {
    throw new Error('Total cannot be negative');
  }

  const now = new Date().toISOString();
  const newOrder = {
    organization_id: organizationId,
    customer_id: customerId,
    total,
    status,
    notes: notes || '',
    created_at: now,
    updated_at: now,
    created_by: userId,
  };

  const { data, error } = await supabase
    .from('orders')
    .insert([newOrder])
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function updateOrder(
  organizationId: string,
  orderId: string,
  payload: Partial<{
    status: string;
    total: number;
    notes: string;
  }>
) {
  const supabase = getServerClient();

  const updateData: any = {
    ...payload,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('orders')
    .update(updateData)
    .eq('id', orderId)
    .eq('organization_id', organizationId)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function deleteOrder(organizationId: string, orderId: string) {
  const supabase = getServerClient();

  const { error } = await supabase
    .from('orders')
    .delete()
    .eq('id', orderId)
    .eq('organization_id', organizationId);

  if (error) {
    throw error;
  }

  return { success: true };
}

export async function getOrdersByStatus(
  organizationId: string,
  status: string,
  limit: number = 10
) {
  const supabase = getServerClient();

  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('status', status)
    .limit(limit)
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return data || [];
}

export async function getOrdersByCustomer(
  organizationId: string,
  customerId: string,
  limit: number = 20
) {
  const supabase = getServerClient();

  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('customer_id', customerId)
    .limit(limit)
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return data || [];
}
