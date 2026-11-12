import { createServerClient } from "@/lib/supabase";
import { NextRequest } from "next/server";

export async function getUserContext(request: NextRequest) {
  try {
    const supabase = createServerClient();

    const token = request.cookies.get("auth_token")?.value;
    if (!token) {
      return { user: null, org: null, error: "No auth token" };
    }

    const {
      data: { user: authUser },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !authUser) {
      return { user: null, org: null, error: "Invalid or expired session" };
    }

    const { data: orgUser, error: orgError } = await supabase
      .from("users")
      .select("id, organization_id, role_id")
      .eq("id", authUser.id)
      .single();

    if (orgError || !orgUser) {
      return { user: authUser, org: null, error: "Organization not found" };
    }

    const { data: org } = await supabase
      .from("organizations")
      .select("*")
      .eq("id", orgUser.organization_id)
      .single();

    return { user: authUser, org, error: null };
  } catch (error) {
    return { user: null, org: null, error: String(error) };
  }
}

const SORT_FIELD_MAP: Record<string, string> = {
  created_at: "created_at",
  updated_at: "updated_at",
  name: "name",
  sku: "sku",
  price: "pricing->retail_price",
};

export interface ProductPricing {
  cost?: number;
  currency?: string;
  retail_price: number;
}

export interface ProductPayload {
  name: string;
  sku: string;
  description?: string;
  category: string;
  subcategory?: string;
  brand?: string;
  barcode?: string;
  weight?: number;
  tags?: string[];
  is_active?: boolean;
  price: number;
  cost?: number;
  currency?: string;
}

function toPricing(
  payload: Partial<ProductPayload>,
): ProductPricing | undefined {
  if (
    payload.price === undefined &&
    payload.cost === undefined &&
    payload.currency === undefined
  ) {
    return undefined;
  }
  return {
    retail_price: payload.price ?? 0,
    cost: payload.cost,
    currency: payload.currency || "USD",
  };
}

function isUniqueViolation(error: any) {
  return error?.code === "23505";
}

export async function getProducts(
  organizationId: string,
  options: {
    page?: number;
    pageSize?: number;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
    search?: string;
    category?: string;
    activeOnly?: boolean;
  } = {},
) {
  const supabase = createServerClient();
  const {
    page = 0,
    pageSize = 20,
    sortBy = "created_at",
    sortOrder = "desc",
    search,
    category,
    activeOnly,
  } = options;

  let query = supabase
    .from("products")
    .select("*, inventory(quantity_available)", { count: "exact" })
    .eq("organization_id", organizationId);

  if (search) {
    const escaped = search.replace(/[%,]/g, "");
    query = query.or(
      `name.ilike.%${escaped}%,sku.ilike.%${escaped}%,description.ilike.%${escaped}%,barcode.ilike.%${escaped}%`,
    );
  }

  if (category) {
    query = query.eq("category", category);
  }

  if (activeOnly) {
    query = query.eq("is_active", true);
  }

  const finalSortBy = SORT_FIELD_MAP[sortBy] || "created_at";

  query = query
    .order(finalSortBy, { ascending: sortOrder === "asc" })
    .range(page * pageSize, (page + 1) * pageSize - 1);

  const { data, error, count } = await query;

  if (error) {
    throw error;
  }

  return {
    data: data || [],
    pagination: {
      page,
      pageSize,
      total: count || 0,
      hasMore: (count || 0) > (page + 1) * pageSize,
    },
  };
}

export async function getProduct(organizationId: string, productId: string) {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("products")
    .select("*, inventory(quantity_available, warehouse_id)")
    .eq("id", productId)
    .eq("organization_id", organizationId)
    .single();

  if (error || !data) {
    throw new Error("Product not found");
  }

  return data;
}

export async function createProduct(
  organizationId: string,
  userId: string,
  payload: ProductPayload,
) {
  const supabase = createServerClient();
  const {
    name,
    sku,
    description,
    category,
    subcategory,
    brand,
    barcode,
    weight,
    tags,
    is_active,
    price,
    cost,
    currency,
  } = payload;

  if (!name || !sku || !category) {
    throw new Error("Missing required fields: name, sku, category");
  }

  if (price === undefined || price < 0) {
    throw new Error("Price must be a non-negative number");
  }

  if (cost !== undefined && cost < 0) {
    throw new Error("Cost cannot be negative");
  }

  const now = new Date().toISOString();
  const newProduct = {
    organization_id: organizationId,
    name,
    sku,
    description: description || null,
    category,
    subcategory: subcategory || null,
    brand: brand || null,
    barcode: barcode || null,
    weight: weight ?? null,
    tags: tags || [],
    is_active: is_active ?? true,
    pricing: { retail_price: price, cost, currency: currency || "USD" },
    created_by: userId,
    created_at: now,
    updated_at: now,
  };

  const { data, error } = await supabase
    .from("products")
    .insert([newProduct])
    .select()
    .single();

  if (error) {
    if (isUniqueViolation(error)) {
      throw new Error("A product with this SKU already exists");
    }
    throw error;
  }

  return data;
}

export async function updateProduct(
  organizationId: string,
  productId: string,
  payload: Partial<ProductPayload>,
) {
  const supabase = createServerClient();

  if (payload.price !== undefined && payload.price < 0) {
    throw new Error("Price must be a non-negative number");
  }
  if (payload.cost !== undefined && payload.cost < 0) {
    throw new Error("Cost cannot be negative");
  }

  const { price, cost, currency, ...rest } = payload;

  const updateData: Record<string, unknown> = {
    ...rest,
    updated_at: new Date().toISOString(),
  };

  if (price !== undefined || cost !== undefined || currency !== undefined) {
    const { data: existing, error: fetchError } = await supabase
      .from("products")
      .select("pricing")
      .eq("id", productId)
      .eq("organization_id", organizationId)
      .single();

    if (fetchError || !existing) {
      throw new Error("Product not found");
    }

    const currentPricing: Partial<ProductPricing> = existing.pricing || {};
    updateData.pricing = {
      retail_price: price !== undefined ? price : currentPricing.retail_price,
      cost: cost !== undefined ? cost : currentPricing.cost,
      currency: currency || currentPricing.currency || "USD",
    };
  }

  const { data, error } = await supabase
    .from("products")
    .update(updateData)
    .eq("id", productId)
    .eq("organization_id", organizationId)
    .select()
    .single();

  if (error) {
    if (isUniqueViolation(error)) {
      throw new Error("A product with this SKU already exists");
    }
    throw error;
  }

  if (!data) {
    throw new Error("Product not found");
  }

  return data;
}

export async function deleteProduct(organizationId: string, productId: string) {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("products")
    .delete()
    .eq("id", productId)
    .eq("organization_id", organizationId)
    .select()
    .single();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error("Product not found");
  }

  return { success: true };
}

export async function searchProducts(
  organizationId: string,
  query: string,
  limit: number = 10,
) {
  const supabase = createServerClient();
  const escaped = query.replace(/[%,]/g, "");

  const { data, error } = await supabase
    .from("products")
    .select("id, name, sku, pricing")
    .eq("organization_id", organizationId)
    .or(`name.ilike.%${escaped}%,sku.ilike.%${escaped}%`)
    .limit(limit);

  if (error) {
    throw error;
  }

  return data || [];
}

export async function getProductsBySku(organizationId: string, sku: string) {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("sku", sku)
    .single();

  if (error) {
    return null;
  }

  return data;
}
