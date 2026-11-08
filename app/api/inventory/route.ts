import { NextRequest, NextResponse } from 'next/server';
import {
  getUserContext,
  getInventory,
  createInventory,
} from './supabase';

export async function GET(request: NextRequest) {
  try {
    const { user, org, error: authError } = await getUserContext(request);
    if (authError || !user || !org) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const warehouseId = searchParams.get('warehouseId') || undefined;
    const productId = searchParams.get('productId') || undefined;
    const page = parseInt(searchParams.get('page') || '0');
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') || '20')));
    const sortBy = searchParams.get('sortBy') || 'created_at';
    const sortOrder = (searchParams.get('sortOrder') || 'desc') as 'asc' | 'desc';

    const result = await getInventory(org.id, {
      warehouseId,
      productId,
      page,
      pageSize,
      sortBy,
      sortOrder,
    });

    return NextResponse.json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    console.error('Error fetching inventory:', error);
    return NextResponse.json(
      { error: 'Failed to fetch inventory' },
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
    const { productId, warehouseId, quantity, reserved, reorderLevel } = body;

    const data = await createInventory(org.id, user.id, {
      productId,
      warehouseId,
      quantity,
      reserved,
      reorderLevel,
    });

    return NextResponse.json(
      {
        success: true,
        data,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Error creating inventory:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create inventory record' },
      { status: 500 }
    );
  }
}
