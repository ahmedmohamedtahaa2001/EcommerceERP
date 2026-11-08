import { NextRequest, NextResponse } from 'next/server';
import { getUserContext, getCustomers, createCustomer } from './supabase';

export async function GET(request: NextRequest) {
  try {
    const { user, org, error: authError } = await getUserContext(request);
    if (authError || !user || !org) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '0');
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') || '20')));
    const sortBy = searchParams.get('sortBy') || 'created_at';
    const sortOrder = (searchParams.get('sortOrder') || 'desc') as 'asc' | 'desc';
    const search = searchParams.get('search') || undefined;

    const result = await getCustomers(org.id, {
      page,
      pageSize,
      sortBy,
      sortOrder,
      search,
    });

    return NextResponse.json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error: any) {
    console.error('Error fetching customers:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch customers' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, org, error: authError } = await getUserContext(request);
    if (authError || !user || !org) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, email, phone, company, address, city, state, zip, notes } = body;

    const data = await createCustomer(org.id, user.id, {
      name,
      email,
      phone,
      company,
      address,
      city,
      state,
      zip,
      notes,
    });

    return NextResponse.json(
      {
        success: true,
        data,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Error creating customer:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create customer' },
      { status: 500 }
    );
  }
}
