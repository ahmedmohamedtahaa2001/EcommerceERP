import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserAsync } from '@/lib/firebase-auth';
import {
  getProductsByCompany,
  createProduct,
  logAudit,
  userBelongsToCompany,
  getUserRole,
} from '@/lib/firebase-db';
import { Timestamp } from 'firebase/firestore';

/**
 * Firebase version of products API route
 * Replace the current route.ts with this implementation
 */

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

    const result = await getProductsByCompany(companyId, page, limit);

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
    console.error('Error fetching products:', error);
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
        { success: false, error: 'Only managers can create products' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { name, sku, description, price, cost, categoryId, companyId } = body;

    if (!name || !sku || !price || !companyId) {
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

    // Validate SKU uniqueness (you might want to add this as a Firestore check)
    // For now, we'll let Firestore handle duplicate SKUs through custom logic

    const productId = await createProduct(companyId, {
      id: '',
      sku,
      name,
      description,
      price: Number(price),
      cost: cost ? Number(cost) : undefined,
      categoryId,
      active: true,
      companyId,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });

    // Log audit
    await logAudit(companyId, user.uid, 'CREATE', 'products', productId, {
      name,
      sku,
      price,
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          id: productId,
          sku,
          name,
          description,
          price: Number(price),
          cost: cost ? Number(cost) : null,
          categoryId,
          active: true,
          companyId,
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Error creating product:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
