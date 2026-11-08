import { NextRequest, NextResponse } from 'next/server';
import { getUserContext, adjustInventory } from '../supabase';

export async function POST(request: NextRequest) {
  try {
    const { user, org, error: authError } = await getUserContext(request);
    if (authError || !user || !org) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { inventoryId, quantity, reason = 'Manual adjustment' } = body;

    if (!inventoryId || quantity === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: inventoryId, quantity' },
        { status: 400 }
      );
    }

    const adjustment = parseInt(String(quantity));
    const data = await adjustInventory(org.id, user.id, inventoryId, adjustment, reason);

    return NextResponse.json(
      {
        success: true,
        data: {
          inventoryId,
          newQuantity: data.quantity,
          available: data.available,
          timestamp: new Date().toISOString(),
        },
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error adjusting inventory:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to adjust inventory' },
      { status: 500 }
    );
  }
}
