import { NextRequest, NextResponse } from 'next/server';
import { getUserContext, getStockMovements } from '../supabase';

export async function GET(request: NextRequest) {
  try {
    const { user, org, error: authError } = await getUserContext(request);
    if (authError || !user || !org) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const inventoryId = searchParams.get('inventoryId') || undefined;
    const page = parseInt(searchParams.get('page') || '0');
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') || '50')));

    const result = await getStockMovements(org.id, inventoryId, {
      page,
      pageSize,
    });

    return NextResponse.json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    console.error('Error fetching stock movements:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stock movements' },
      { status: 500 }
    );
  }
}
