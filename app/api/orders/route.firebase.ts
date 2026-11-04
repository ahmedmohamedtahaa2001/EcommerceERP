import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserAsync } from '@/lib/firebase-auth';
import {
  getOrdersByCompany,
  createOrder,
  logAudit,
  userBelongsToCompany,
  getUserRole,
} from '@/lib/firebase-db';
import { Timestamp } from 'firebase/firestore';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUserAsync();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const companyId = searchParams.get('companyId') || '';

    if (!companyId) {
      return NextResponse.json(
        { success: false, error: 'Company ID is required' },
        { status: 400 }
      );
    }

    // Check if user belongs to company
    const belongsToCompany = await userBelongsToCompany(user.uid, companyId);
    if (!belongsToCompany) {
      return NextResponse.json(
        { success: false, error: 'Access denied' },
        { status: 403 }
      );
    }

    const result = await getOrdersByCompany(companyId, page, limit);

    return NextResponse.json({
      success: true,
      data: result.data,
      pagination: {
        page: result.page,
        limit,
        total: result.total,
        totalPages: result.pages,
      },
    });
  } catch (error: any) {
    console.error('Error fetching orders:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUserAsync();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is manager or admin
    const role = await getUserRole(user.uid);
    if (!role || !['admin', 'manager'].includes(role)) {
      return NextResponse.json(
        { success: false, error: 'Only managers can create orders' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { orderNumber, customerId, status, paymentStatus, total, shippingAddress, notes, companyId } = body;

    if (!orderNumber || !total || !companyId) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Check if user belongs to company
    const belongsToCompany = await userBelongsToCompany(user.uid, companyId);
    if (!belongsToCompany) {
      return NextResponse.json(
        { success: false, error: 'Access denied' },
        { status: 403 }
      );
    }

    const orderId = await createOrder(companyId, {
      id: '',
      companyId,
      customerId,
      orderNumber,
      status: status || 'pending',
      paymentStatus: paymentStatus || 'pending',
      total: Number(total),
      shippingAddress,
      notes,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });

    // Log audit
    await logAudit(companyId, user.uid, 'CREATE', 'orders', orderId, {
      orderNumber,
      total,
      status,
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          id: orderId,
          companyId,
          customerId,
          orderNumber,
          status: status || 'pending',
          paymentStatus: paymentStatus || 'pending',
          total: Number(total),
          shippingAddress,
          notes,
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Error creating order:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
