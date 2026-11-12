import { NextRequest, NextResponse } from "next/server";
import {
  getUserContext,
  getProduct,
  updateProduct,
  deleteProduct,
} from "../supabase";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const { user, org, error: authError } = await getUserContext(request);
    if (authError || !user || !org) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const data = await getProduct(org.id, params.id);

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error("Error fetching product:", error);
    return NextResponse.json(
      { error: error.message || "Product not found" },
      { status: 404 },
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const { user, org, error: authError } = await getUserContext(request);
    if (authError || !user || !org) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      name,
      sku,
      description,
      price,
      cost,
      currency,
      category,
      subcategory,
      brand,
      barcode,
      weight,
      tags,
      is_active,
    } = body;

    const data = await updateProduct(org.id, params.id, {
      name,
      sku,
      description,
      price,
      cost,
      currency,
      category,
      subcategory,
      brand,
      barcode,
      weight,
      tags,
      is_active,
    });

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error("Error updating product:", error);
    const status = /already exists/i.test(error.message)
      ? 409
      : /not found/i.test(error.message)
        ? 404
        : /negative/i.test(error.message)
          ? 400
          : 500;
    return NextResponse.json(
      { error: error.message || "Failed to update product" },
      { status },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const { user, org, error: authError } = await getUserContext(request);
    if (authError || !user || !org) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await deleteProduct(org.id, params.id);

    return NextResponse.json({ success: true, message: "Product deleted" });
  } catch (error: any) {
    console.error("Error deleting product:", error);
    const status = /not found/i.test(error.message) ? 404 : 500;
    return NextResponse.json(
      { error: error.message || "Failed to delete product" },
      { status },
    );
  }
}
