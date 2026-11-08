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

export async function getCustomers(
  organizationId: string,
  options: {
    page?: number;
    pageSize?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    search?: string;
  } = {}
) {
  const supabase = getServerClient();
  const {
    page = 0,
    pageSize = 20,
    sortBy = 'created_at',
    sortOrder = 'desc',
    search,
  } = options;

  let query = supabase
    .from('customers')
    .select('*', { count: 'exact' })
    .eq('organization_id', organizationId);

  if (search) {
    query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`);
  }

  const validSortFields = ['created_at', 'updated_at', 'name', 'email'];
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

export async function getCustomer(organizationId: string, customerId: string) {
  const supabase = getServerClient();

  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('id', customerId)
    .eq('organization_id', organizationId)
    .single();

  if (error || !data) {
    throw new Error('Customer not found');
  }

  return data;
}

export async function createCustomer(
  organizationId: string,
  userId: string,
  payload: {
    name: string;
    email: string;
    phone?: string;
    company?: string;
    address?: string;
    city?: string;
    state?: string;
    zip?: string;
    notes?: string;
  }
) {
  const supabase = getServerClient();
  const { name, email, phone, company, address, city, state, zip, notes } = payload;

  if (!name || !email) {
    throw new Error('Missing required fields: name, email');
  }

  const now = new Date().toISOString();
  const newCustomer = {
    organization_id: organizationId,
    name,
    email,
    phone: phone || '',
    company: company || '',
    address: address || '',
    city: city || '',
    state: state || '',
    zip: zip || '',
    notes: notes || '',
    created_at: now,
    updated_at: now,
    created_by: userId,
  };

  const { data, error } = await supabase
    .from('customers')
    .insert([newCustomer])
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function updateCustomer(
  organizationId: string,
  customerId: string,
  payload: Partial<{
    name: string;
    email: string;
    phone: string;
    company: string;
    address: string;
    city: string;
    state: string;
    zip: string;
    notes: string;
  }>
) {
  const supabase = getServerClient();

  const updateData: any = {
    ...payload,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('customers')
    .update(updateData)
    .eq('id', customerId)
    .eq('organization_id', organizationId)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function deleteCustomer(organizationId: string, customerId: string) {
  const supabase = getServerClient();

  const { error } = await supabase
    .from('customers')
    .delete()
    .eq('id', customerId)
    .eq('organization_id', organizationId);

  if (error) {
    throw error;
  }

  return { success: true };
}

export async function searchCustomers(
  organizationId: string,
  query: string,
  limit: number = 10
) {
  const supabase = getServerClient();

  const { data, error } = await supabase
    .from('customers')
    .select('id, name, email')
    .eq('organization_id', organizationId)
    .or(`name.ilike.%${query}%,email.ilike.%${query}%`)
    .limit(limit);

  if (error) {
    throw error;
  }

  return data || [];
}
