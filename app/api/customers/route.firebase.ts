import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserAsync } from '@/lib/firebase-auth';
import {
  getCustomersByCompany,
  setDocument,
  logAudit,
  userBelongsToCompany,
  getUserRole,
} from '@/lib/firebase-db';
import { Timestamp, doc, collection } from 'firebase/firestore';
import { db } from '@/lib/firebase-config';
import { Customer } from '@/types/firebase';

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

    const result = await getCustomersByCompany(companyId, page, limit);

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
    console.error('Error fetching customers:', error);
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
        { success: false, error: 'Only managers can create customers' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { name, email, phone, city, state, country, zip, companyId } = body;

    if (!name || !email || !companyId) {
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

    // Create customer document
    const docRef = doc(collection(db, `companies/${companyId}/customers`));
    const now = Timestamp.now();

    const customerData: Customer = {
      id: docRef.id,
      companyId,
      name,
      email,
      phone,
      city,
      state,
      country,
      zip,
      totalOrders: 0,
      totalSpent: 0,
      createdAt: now,
      updatedAt: now,
    };

    await setDocument(`companies/${companyId}/customers`, docRef.id, customerData, false);

    // Log audit
    await logAudit(companyId, user.uid, 'CREATE', 'customers', docRef.id, {
      name,
      email,
    });

    return NextResponse.json(
      {
        success: true,
        data: customerData,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Error creating customer:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
