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
      .select("id, organization_id")
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

export async function getWarehouses(
  organizationId: string,
  options: { sortBy?: string; sortOrder?: "asc" | "desc" } = {},
) {
  const supabase = createServerClient();
  const { sortBy = "created_at", sortOrder = "desc" } = options;

  const validSortFields = ["created_at", "name"];
  const finalSortBy = validSortFields.includes(sortBy) ? sortBy : "created_at";

  const { data, error } = await supabase
    .from("warehouses")
    .select("*")
    .eq("organization_id", organizationId)
    .order(finalSortBy, { ascending: sortOrder === "asc" });

  if (error) {
    throw error;
  }

  return data || [];
}

export async function getWarehouse(
  organizationId: string,
  warehouseId: string,
) {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("warehouses")
    .select("*")
    .eq("id", warehouseId)
    .eq("organization_id", organizationId)
    .single();

  if (error || !data) {
    throw new Error("Warehouse not found");
  }

  return data;
}

export async function createWarehouse(
  organizationId: string,
  userId: string,
  payload: {
    name: string;
    location: string;
    address?: string;
    city?: string;
    state?: string;
    zip?: string;
    capacity?: number;
    notes?: string;
  },
) {
  const supabase = createServerClient();
  const { name, location, address, city, state, zip, capacity, notes } =
    payload;

  if (!name || !location) {
    throw new Error("Missing required fields: name, location");
  }

  const now = new Date().toISOString();
  const newWarehouse = {
    organization_id: organizationId,
    name,
    address: {
      street: address || "",
      city: city || location,
      state: state || "",
      zip: zip || "",
    },
    description: notes || null,
    capacity: capacity || 0,
    current_utilization: 0,
    utilization_percentage: 0,
    created_at: now,
    updated_at: now,
    created_by: userId,
  };

  const { data, error } = await supabase
    .from("warehouses")
    .insert([newWarehouse])
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function updateWarehouse(
  organizationId: string,
  warehouseId: string,
  payload: Partial<{
    name: string;
    location: string;
    address: string;
    city: string;
    state: string;
    zip: string;
    capacity: number;
    notes: string;
  }>,
) {
  const supabase = createServerClient();

  const updateData: any = {
    ...payload,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("warehouses")
    .update(updateData)
    .eq("id", warehouseId)
    .eq("organization_id", organizationId)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function deleteWarehouse(
  organizationId: string,
  warehouseId: string,
) {
  const supabase = createServerClient();

  const { error } = await supabase
    .from("warehouses")
    .delete()
    .eq("id", warehouseId)
    .eq("organization_id", organizationId);

  if (error) {
    throw error;
  }

  return { success: true };
}

export async function getBinLocations(
  organizationId: string,
  warehouseId: string,
) {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("bin_locations")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("warehouse_id", warehouseId)
    .order("code", { ascending: true });

  if (error) {
    throw error;
  }

  return data || [];
}

export async function createBinLocation(
  organizationId: string,
  userId: string,
  warehouseId: string,
  payload: {
    code: string;
    zone?: string;
    aisle?: string;
    rack?: string;
    shelf?: string;
    bin?: string;
    locationType?: string;
    capacity?: number;
    isPickable?: boolean;
  },
) {
  const supabase = createServerClient();
  const {
    code,
    zone,
    aisle,
    rack,
    shelf,
    bin,
    locationType = "storage",
    capacity,
    isPickable = true,
  } = payload;

  if (!code) {
    throw new Error("Missing required field: code");
  }

  // Warehouse must belong to this organization.
  await getWarehouse(organizationId, warehouseId);

  const { data, error } = await supabase
    .from("bin_locations")
    .insert([
      {
        organization_id: organizationId,
        warehouse_id: warehouseId,
        code,
        zone: zone || null,
        aisle: aisle || null,
        rack: rack || null,
        shelf: shelf || null,
        bin: bin || null,
        location_type: locationType,
        capacity: capacity ?? null,
        is_pickable: isPickable,
        created_by: userId,
      },
    ])
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function updateBinLocation(
  organizationId: string,
  warehouseId: string,
  binLocationId: string,
  payload: Partial<{
    code: string;
    zone: string;
    aisle: string;
    rack: string;
    shelf: string;
    bin: string;
    locationType: string;
    capacity: number;
    isPickable: boolean;
    isActive: boolean;
  }>,
) {
  const supabase = createServerClient();

  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (payload.code !== undefined) updateData.code = payload.code;
  if (payload.zone !== undefined) updateData.zone = payload.zone;
  if (payload.aisle !== undefined) updateData.aisle = payload.aisle;
  if (payload.rack !== undefined) updateData.rack = payload.rack;
  if (payload.shelf !== undefined) updateData.shelf = payload.shelf;
  if (payload.bin !== undefined) updateData.bin = payload.bin;
  if (payload.locationType !== undefined)
    updateData.location_type = payload.locationType;
  if (payload.capacity !== undefined) updateData.capacity = payload.capacity;
  if (payload.isPickable !== undefined)
    updateData.is_pickable = payload.isPickable;
  if (payload.isActive !== undefined) updateData.is_active = payload.isActive;

  const { data, error } = await supabase
    .from("bin_locations")
    .update(updateData)
    .eq("id", binLocationId)
    .eq("warehouse_id", warehouseId)
    .eq("organization_id", organizationId)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function deleteBinLocation(
  organizationId: string,
  warehouseId: string,
  binLocationId: string,
) {
  const supabase = createServerClient();

  const { data: stock } = await supabase
    .from("inventory_bin_stock")
    .select("id")
    .eq("bin_location_id", binLocationId)
    .gt("quantity", 0)
    .limit(1);

  if (stock && stock.length > 0) {
    throw new Error("Cannot delete a bin location that still holds stock");
  }

  const { error } = await supabase
    .from("bin_locations")
    .delete()
    .eq("id", binLocationId)
    .eq("warehouse_id", warehouseId)
    .eq("organization_id", organizationId);

  if (error) {
    throw error;
  }

  return { success: true };
}

export async function getWarehouseCapacityStats(
  organizationId: string,
  warehouseId: string,
) {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("inventory")
    .select("quantity_on_hand")
    .eq("organization_id", organizationId)
    .eq("warehouse_id", warehouseId);

  if (error) {
    throw error;
  }

  const totalQuantity = (data || []).reduce(
    (sum, item) => sum + item.quantity_on_hand,
    0,
  );

  const warehouse = await getWarehouse(organizationId, warehouseId);

  return {
    warehouse_id: warehouseId,
    capacity: warehouse.capacity || 0,
    used: totalQuantity,
    available: (warehouse.capacity || 0) - totalQuantity,
    utilization: warehouse.capacity
      ? (totalQuantity / warehouse.capacity) * 100
      : 0,
  };
}
