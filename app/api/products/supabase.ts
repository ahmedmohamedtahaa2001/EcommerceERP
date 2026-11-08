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

export async function getProducts(
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
    .from('products')
    .select('*', { count: 'exact' })
    .eq('organization_id', organizationId);

  if (search) {
    query = query.or(`name.ilike.%${search}%,sku.ilike.%${search}%,description.ilike.%${search}%`);
  }

  const validSortFields = ['created_at', 'updated_at', 'price', 'name'];
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

export async function getProduct(organizationId: string, productId: string) {
  const supabase = getServerClient();

  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('id', productId)
    .eq('organization_id', organizationId)
    .single();

  if (error || !data) {
    throw new Error('Product not found');
  }

  return data;
}

export async function createProduct(
  organizationId: string,
  userId: string,
  payload: {
    name: string;
    sku: string;
    description?: string;
    price: number;
    category?: string;
    image_url?: string;
  }
) {
  const supabase = getServerClient();
  const { name, sku, description, price, category, image_url } = payload;

  if (!name || !sku || price === undefined) {
    throw new Error('Missing required fields: name, sku, price');
  }

  if (price < 0) {
    throw new Error('Price cannot be negative');
  }

  const now = new Date().toISOString();
  const newProduct = {
    organization_id: organizationId,
    name,
    sku,
    description: description || '',
    price,
    category: category || 'general',
    image_url: image_url || null,
    created_at: now,
    updated_at: now,
    created_by: userId,
  };

  const { data, error } = await supabase
    .from('products')
    .insert([newProduct])
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function updateProduct(
  organizationId: string,
  productId: string,
  payload: Partial<{
    name: string;
    sku: string;
    description: string;
    price: number;
    category: string;
    image_url: string;
  }>
) {
  const supabase = getServerClient();

  const updateData: any = {
    ...payload,
    updated_at: new Date().toISOString(),
  };

  // Validate price if being updated
  if (payload.price !== undefined && payload.price < 0) {
    throw new Error('Price cannot be negative');
  }

  const { data, error } = await supabase
    .from('products')
    .update(updateData)
    .eq('id', productId)
    .eq('organization_id', organizationId)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function deleteProduct(organizationId: string, productId: string) {
  const supabase = getServerClient();

  const { error } = await supabase
    .from('products')
    .delete()
    .eq('id', productId)
    .eq('organization_id', organizationId);

  if (error) {
    throw error;
  }

  return { success: true };
}

export async function searchProducts(
  organizationId: string,
  query: string,
  limit: number = 10
) {
  const supabase = getServerClient();

  const { data, error } = await supabase
    .from('products')
    .select('id, name, sku, price')
    .eq('organization_id', organizationId)
    .or(`name.ilike.%${query}%,sku.ilike.%${query}%`)
    .limit(limit);

  if (error) {
    throw error;
  }

  return data || [];
}

export async function getProductsBySku(organizationId: string, sku: string) {
  const supabase = getServerClient();

  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('sku', sku)
    .single();

  if (error) {
    return null;
  }

  return data;
}
