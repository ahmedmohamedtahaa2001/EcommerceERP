import { NextRequest, NextResponse } from "next/server";
import { getUserContext, getProducts, createProduct } from "./supabase";

export async function GET(request: NextRequest) {
  try {
    const { user, org, error: authError } = await getUserContext(request);
    if (authError || !user || !org) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "0");
    const pageSize = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get("pageSize") || "20")),
    );
    const sortBy = searchParams.get("sortBy") || "created_at";
    const sortOrder = (searchParams.get("sortOrder") || "desc") as
      "asc" | "desc";
    const search = searchParams.get("search") || undefined;
    const category = searchParams.get("category") || undefined;
    const activeOnly = searchParams.get("activeOnly") === "true";

    const result = await getProducts(org.id, {
      page,
      pageSize,
      sortBy,
      sortOrder,
      search,
      category,
      activeOnly,
    });

    return NextResponse.json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error: any) {
    console.error("Error fetching products:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch products" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
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

    if (!name || !sku || !category) {
      return NextResponse.json(
        { error: "Missing required fields: name, sku, category" },
        { status: 400 },
      );
    }

    const data = await createProduct(org.id, user.id, {
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

    return NextResponse.json(
      {
        success: true,
        data,
      },
      { status: 201 },
    );
  } catch (error: any) {
    console.error("Error creating product:", error);
    const status = /already exists/i.test(error.message)
      ? 409
      : /required|negative/i.test(error.message)
        ? 400
        : 500;
    return NextResponse.json(
      { error: error.message || "Failed to create product" },
      { status },
    );
  }
}
