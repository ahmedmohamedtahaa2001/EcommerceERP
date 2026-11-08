import { NextRequest, NextResponse } from 'next/server';
import { getUserContext, transferInventory } from '../supabase';

export async function POST(request: NextRequest) {
  try {
    const { user, org, error: authError } = await getUserContext(request);
    if (authError || !user || !org) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { fromInventoryId, toInventoryId, quantity, reason } = body;

    if (!fromInventoryId || !toInventoryId || quantity === undefined) {
      return NextResponse.json(
        {
          error: 'Missing required fields: fromInventoryId, toInventoryId, quantity',
        },
        { status: 400 }
      );
    }

    if (quantity <= 0) {
      return NextResponse.json(
        { error: 'Transfer quantity must be greater than 0' },
        { status: 400 }
      );
    }

    if (fromInventoryId === toInventoryId) {
      return NextResponse.json(
        { error: 'Cannot transfer to the same inventory location' },
        { status: 400 }
      );
    }

    await transferInventory(org.id, user.id, {
      fromInventoryId,
      toInventoryId,
      quantity,
      reason: reason || 'Warehouse transfer',
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          transfer: {
            fromInventoryId,
            toInventoryId,
            quantity,
            timestamp: new Date().toISOString(),
          },
        },
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error transferring inventory:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to transfer inventory' },
      { status: 500 }
    );
  }
}
