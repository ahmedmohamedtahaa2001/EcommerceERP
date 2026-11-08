import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
);

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const warehouseId = searchParams.get("warehouseId");
    const productId = searchParams.get("productId");
    const page = parseInt(searchParams.get("page") || "0");
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") || "20")));
    const offset = page * pageSize;

    let query = supabase
      .from("inventory")
      .select("*", { count: "exact" });

    if (warehouseId) {
      query = query.eq("warehouse_id", warehouseId);
    }
    if (productId) {
      query = query.eq("product_id", productId);
    }

    const { data, count, error } = await query
      .order("updated_at", { ascending: false })

    if (error) throw error;

    return NextResponse.json({
      success: true,
      data: data || [],
      pagination: {
        page,
        pageSize,
        total: count || 0,
        hasMore: (count || 0) > offset + pageSize,
      },
    });
  } catch (error) {
    console.error("Error fetching inventory:", error);
    return NextResponse.json(
      { error: "Failed to fetch inventory" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { product_id, warehouse_id, quantity, reserved = 0, reorder_level } = body;

    if (!product_id || !warehouse_id || quantity === undefined) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const available = Math.max(0, quantity - reserved);

    const { data, error } = await supabase.from("inventory").insert({
      product_id,
      warehouse_id,
      quantity,
      reserved,
      available,
      reorder_level: reorder_level || 10,
      last_restocked: new Date().toISOString(),
    });

    if (error) throw error;

    return NextResponse.json(
      { success: true, data: data?.[0] },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating inventory:", error);
    return NextResponse.json(
      { error: "Failed to create inventory" },
      { status: 500 }
    );
  }
}
