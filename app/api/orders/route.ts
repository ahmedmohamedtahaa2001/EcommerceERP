import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const status = searchParams.get('status');

    const offset = (page - 1) * limit;

    let query = supabaseAdmin.from('orders').select('*, customers(name, email)', { count: 'exact' });

    if (status) {
      query = query.eq('status', status);
    }

    const { data, count, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      data,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { customerId, items, shippingAddress, notes } = body;

    if (!customerId || !items || items.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Calculate total
    const total = items.reduce((sum: number, item: any) => sum + item.total, 0);

    // Generate order number
    const orderNumber = `ORD-${Date.now()}`;

    const { data, error } = await supabaseAdmin
      .from('orders')
      .insert([
        {
          order_number: orderNumber,
          customer_id: customerId,
          status: 'pending',
          payment_status: 'pending',
          total,
          shipping_address: shippingAddress,
          notes,
          company_id: '11111111-1111-1111-1111-111111111111', // TODO: Get from auth
        },
      ])
      .select();

    if (error) throw error;

    // Insert order items
    if (data && data[0]) {
      const orderItems = items.map((item: any) => ({
        order_id: data[0].id,
        product_id: item.productId,
        quantity: item.quantity,
        price: item.price,
        total: item.total,
      }));

      await supabaseAdmin.from('order_items').insert(orderItems);
    }

    return NextResponse.json({ success: true, data: data?.[0] }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
