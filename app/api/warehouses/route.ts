import { NextRequest, NextResponse } from 'next/server';
import { getUserContext, getWarehouses, createWarehouse } from './supabase';

export async function GET(request: NextRequest) {
  try {
    const { user, org, error: authError } = await getUserContext(request);
    if (authError || !user || !org) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data = await getWarehouses(org.id);

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error: any) {
    console.error('Error fetching warehouses:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch warehouses' },
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
    const { name, location, address, city, state, zip, capacity, notes } = body;

    const data = await createWarehouse(org.id, user.id, {
      name,
      location,
      address,
      city,
      state,
      zip,
      capacity,
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
    console.error('Error creating warehouse:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create warehouse' },
      { status: 500 }
    );
  }
}
