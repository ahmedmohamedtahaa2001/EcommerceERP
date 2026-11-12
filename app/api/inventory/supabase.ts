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

export async function getInventory(
  organizationId: string,
  options: {
    warehouseId?: string;
    productId?: string;
    page?: number;
    pageSize?: number;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
  } = {},
) {
  const supabase = createServerClient();
  const {
    warehouseId,
    productId,
    page = 0,
    pageSize = 20,
    sortBy = "created_at",
    sortOrder = "desc",
  } = options;

  let query = supabase
    .from("inventory")
    .select("*", { count: "exact" })
    .eq("organization_id", organizationId);

  if (warehouseId) {
    query = query.eq("warehouse_id", warehouseId);
  }

  if (productId) {
    query = query.eq("product_id", productId);
  }

  const validSortFields = [
    "created_at",
    "updated_at",
    "quantity_on_hand",
    "reorder_point",
  ];
  const finalSortBy = validSortFields.includes(sortBy) ? sortBy : "created_at";

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

export async function createInventory(
  organizationId: string,
  userId: string,
  payload: {
    productId: string;
    warehouseId: string;
    quantity: number;
    reserved?: number;
    reorderLevel?: number;
  },
) {
  const supabase = createServerClient();
  const {
    productId,
    warehouseId,
    quantity,
    reserved = 0,
    reorderLevel = 10,
  } = payload;

  // Validation
  if (!productId || !warehouseId || quantity === undefined) {
    throw new Error(
      "Missing required fields: productId, warehouseId, quantity",
    );
  }

  if (quantity < 0) {
    throw new Error("Quantity cannot be negative");
  }

  const now = new Date().toISOString();
  const newInventory = {
    organization_id: organizationId,
    product_id: productId,
    warehouse_id: warehouseId,
    quantity_on_hand: quantity,
    quantity_reserved: reserved,
    quantity_available: Math.max(0, quantity - reserved),
    reorder_point: reorderLevel,
    last_restocked: now,
    created_at: now,
    updated_at: now,
    created_by: userId,
  };

  const { data, error } = await supabase
    .from("inventory")
    .insert([newInventory])
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function updateInventory(
  organizationId: string,
  inventoryId: string,
  payload: Partial<{
    quantity: number;
    reserved: number;
    reorderLevel: number;
  }>,
) {
  const supabase = createServerClient();

  const updateData: any = {
    updated_at: new Date().toISOString(),
  };
  if (payload.quantity !== undefined)
    updateData.quantity_on_hand = payload.quantity;
  if (payload.reserved !== undefined)
    updateData.quantity_reserved = payload.reserved;
  if (payload.reorderLevel !== undefined)
    updateData.reorder_point = payload.reorderLevel;

  // Recalculate available if quantity or reserved changes
  if (payload.quantity !== undefined || payload.reserved !== undefined) {
    const { data: current } = await supabase
      .from("inventory")
      .select("quantity_on_hand, quantity_reserved")
      .eq("id", inventoryId)
      .eq("organization_id", organizationId)
      .single();

    if (current) {
      const qty = payload.quantity ?? current.quantity_on_hand;
      const res = payload.reserved ?? current.quantity_reserved;
      updateData.quantity_available = Math.max(0, qty - res);
    }
  }

  const { data, error } = await supabase
    .from("inventory")
    .update(updateData)
    .eq("id", inventoryId)
    .eq("organization_id", organizationId)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function adjustInventory(
  organizationId: string,
  userId: string,
  inventoryId: string,
  adjustment: number,
  reason: string,
) {
  const supabase = createServerClient();

  // Get current inventory
  const { data: current, error: fetchError } = await supabase
    .from("inventory")
    .select("quantity_on_hand, quantity_reserved")
    .eq("id", inventoryId)
    .eq("organization_id", organizationId)
    .single();

  if (fetchError || !current) {
    throw new Error("Inventory item not found");
  }

  const newQuantity = Math.max(0, current.quantity_on_hand + adjustment);

  // Update inventory
  const { data: updated, error: updateError } = await supabase
    .from("inventory")
    .update({
      quantity_on_hand: newQuantity,
      quantity_available: Math.max(0, newQuantity - current.quantity_reserved),
      updated_at: new Date().toISOString(),
    })
    .eq("id", inventoryId)
    .select()
    .single();

  if (updateError) {
    throw updateError;
  }

  // Log movement
  const { error: movementError } = await supabase
    .from("stock_movements")
    .insert([
      {
        organization_id: organizationId,
        inventory_id: inventoryId,
        movement_type: adjustment > 0 ? "addition" : "reduction",
        quantity: Math.abs(adjustment),
        reason,
        created_by: userId,
        created_at: new Date().toISOString(),
      },
    ]);

  if (movementError) {
    console.error("Failed to log movement:", movementError);
  }

  return updated;
}

export async function transferInventory(
  organizationId: string,
  userId: string,
  payload: {
    fromInventoryId: string;
    toInventoryId: string;
    quantity: number;
    reason?: string;
  },
) {
  const supabase = createServerClient();
  const {
    fromInventoryId,
    toInventoryId,
    quantity,
    reason = "Transfer",
  } = payload;

  // Get both inventory items
  const { data: fromInv, error: fromError } = await supabase
    .from("inventory")
    .select("quantity_on_hand, quantity_reserved")
    .eq("id", fromInventoryId)
    .eq("organization_id", organizationId)
    .single();

  if (fromError || !fromInv) {
    throw new Error("Source inventory not found");
  }

  const availableToTransfer = Math.max(
    0,
    fromInv.quantity_on_hand - fromInv.quantity_reserved,
  );
  if (availableToTransfer < quantity) {
    throw new Error(
      `Insufficient inventory. Available: ${availableToTransfer}, Requested: ${quantity}`,
    );
  }

  const { data: toInv, error: toError } = await supabase
    .from("inventory")
    .select("quantity_on_hand, quantity_reserved")
    .eq("id", toInventoryId)
    .eq("organization_id", organizationId)
    .single();

  if (toError || !toInv) {
    throw new Error("Destination inventory not found");
  }

  // Update both inventories
  const now = new Date().toISOString();

  await supabase
    .from("inventory")
    .update({
      quantity_on_hand: fromInv.quantity_on_hand - quantity,
      quantity_available: Math.max(
        0,
        fromInv.quantity_on_hand - quantity - fromInv.quantity_reserved,
      ),
      updated_at: now,
    })
    .eq("id", fromInventoryId);

  await supabase
    .from("inventory")
    .update({
      quantity_on_hand: toInv.quantity_on_hand + quantity,
      quantity_available: Math.max(
        0,
        toInv.quantity_on_hand + quantity - toInv.quantity_reserved,
      ),
      updated_at: now,
    })
    .eq("id", toInventoryId);

  // Log movements
  await supabase.from("stock_movements").insert([
    {
      organization_id: organizationId,
      inventory_id: fromInventoryId,
      movement_type: "transfer_out",
      quantity,
      reason: `${reason} (to another location)`,
      created_by: userId,
      created_at: now,
    },
    {
      organization_id: organizationId,
      inventory_id: toInventoryId,
      movement_type: "transfer_in",
      quantity,
      reason: `${reason} (from another location)`,
      created_by: userId,
      created_at: now,
    },
  ]);

  return { success: true, message: `Transferred ${quantity} units` };
}

export async function getInventoryBins(
  organizationId: string,
  inventoryId: string,
) {
  const supabase = createServerClient();

  const { data: inventory, error: invError } = await supabase
    .from("inventory")
    .select("id, quantity_on_hand")
    .eq("id", inventoryId)
    .eq("organization_id", organizationId)
    .single();

  if (invError || !inventory) {
    throw new Error("Inventory item not found");
  }

  const { data, error } = await supabase
    .from("inventory_bin_stock")
    .select(
      "id, quantity, bin_location_id, bin_locations(code, zone, aisle, rack, shelf, bin, location_type, capacity)",
    )
    .eq("organization_id", organizationId)
    .eq("inventory_id", inventoryId)
    .gt("quantity", 0);

  if (error) {
    throw error;
  }

  const bins = data || [];
  const putAway = bins.reduce((sum, row: any) => sum + row.quantity, 0);

  return {
    quantityOnHand: inventory.quantity_on_hand,
    quantityPutAway: putAway,
    quantityUnassigned: Math.max(0, inventory.quantity_on_hand - putAway),
    bins,
  };
}

/**
 * Guided putaway: suggest bins for a unit of stock that still needs a
 * location, ranked so an existing bin already holding this product (to
 * consolidate it) comes before an empty bin, and bins with more free
 * capacity come before tighter ones.
 */
export async function suggestPutawayBins(
  organizationId: string,
  inventoryId: string,
  limit = 5,
) {
  const supabase = createServerClient();

  const { data: inventory, error: invError } = await supabase
    .from("inventory")
    .select("id, warehouse_id, product_id")
    .eq("id", inventoryId)
    .eq("organization_id", organizationId)
    .single();

  if (invError || !inventory) {
    throw new Error("Inventory item not found");
  }

  const { data: binRows, error: binError } = await supabase
    .from("bin_locations")
    .select("id, code, zone, aisle, rack, shelf, bin, location_type, capacity")
    .eq("organization_id", organizationId)
    .eq("warehouse_id", inventory.warehouse_id)
    .eq("is_active", true)
    .eq("is_pickable", true);

  if (binError) {
    throw binError;
  }

  const bins = binRows || [];
  if (bins.length === 0) {
    return [];
  }

  const { data: stockRows, error: stockError } = await supabase
    .from("inventory_bin_stock")
    .select("bin_location_id, quantity, inventory_id")
    .in(
      "bin_location_id",
      bins.map((b) => b.id),
    );

  if (stockError) {
    throw stockError;
  }

  const occupied = new Map<string, number>();
  const holdsThisProduct = new Set<string>();
  for (const row of stockRows || []) {
    occupied.set(
      row.bin_location_id,
      (occupied.get(row.bin_location_id) || 0) + row.quantity,
    );
    if (row.inventory_id === inventoryId && row.quantity > 0) {
      holdsThisProduct.add(row.bin_location_id);
    }
  }

  const candidates = bins.map((bin) => {
    const used = occupied.get(bin.id) || 0;
    const freeCapacity =
      bin.capacity != null ? Math.max(0, bin.capacity - used) : null;
    return {
      ...bin,
      usedCapacity: used,
      freeCapacity,
      alreadyHoldsProduct: holdsThisProduct.has(bin.id),
    };
  });

  return candidates
    .filter((bin) => bin.freeCapacity === null || bin.freeCapacity > 0)
    .sort((a, b) => {
      if (a.alreadyHoldsProduct !== b.alreadyHoldsProduct) {
        return a.alreadyHoldsProduct ? -1 : 1;
      }
      const aFree = a.freeCapacity ?? Infinity;
      const bFree = b.freeCapacity ?? Infinity;
      return bFree - aFree;
    })
    .slice(0, limit);
}

export async function putawayInventory(
  organizationId: string,
  userId: string,
  inventoryId: string,
  binLocationId: string,
  quantity: number,
) {
  if (!quantity || quantity <= 0) {
    throw new Error("Quantity must be greater than zero");
  }

  const supabase = createServerClient();

  const { data: inventory, error: invError } = await supabase
    .from("inventory")
    .select("id, warehouse_id, product_id, quantity_on_hand")
    .eq("id", inventoryId)
    .eq("organization_id", organizationId)
    .single();

  if (invError || !inventory) {
    throw new Error("Inventory item not found");
  }

  const { data: bin, error: binError } = await supabase
    .from("bin_locations")
    .select("id, warehouse_id, capacity")
    .eq("id", binLocationId)
    .eq("organization_id", organizationId)
    .single();

  if (binError || !bin) {
    throw new Error("Bin location not found");
  }

  if (bin.warehouse_id !== inventory.warehouse_id) {
    throw new Error(
      "Bin location belongs to a different warehouse than this inventory record",
    );
  }

  const { data: existingStock } = await supabase
    .from("inventory_bin_stock")
    .select("id, quantity")
    .eq("bin_location_id", binLocationId)
    .eq("inventory_id", inventoryId)
    .maybeSingle();

  if (bin.capacity != null) {
    const { data: otherStock } = await supabase
      .from("inventory_bin_stock")
      .select("quantity")
      .eq("bin_location_id", binLocationId);

    const used = (otherStock || []).reduce((sum, row) => sum + row.quantity, 0);
    const usedByOthers = used - (existingStock?.quantity || 0);
    if (
      usedByOthers + (existingStock?.quantity || 0) + quantity >
      bin.capacity
    ) {
      throw new Error(
        `Bin capacity exceeded. Capacity: ${bin.capacity}, already used: ${used}, requested: ${quantity}`,
      );
    }
  }

  const now = new Date().toISOString();

  if (existingStock) {
    await supabase
      .from("inventory_bin_stock")
      .update({ quantity: existingStock.quantity + quantity, updated_at: now })
      .eq("id", existingStock.id);
  } else {
    await supabase.from("inventory_bin_stock").insert([
      {
        organization_id: organizationId,
        inventory_id: inventoryId,
        bin_location_id: binLocationId,
        quantity,
        updated_at: now,
      },
    ]);
  }

  await supabase.from("stock_movements").insert([
    {
      organization_id: organizationId,
      inventory_id: inventoryId,
      product_id: inventory.product_id,
      warehouse_id: inventory.warehouse_id,
      movement_type: "adjust",
      quantity_before: inventory.quantity_on_hand,
      quantity_after: inventory.quantity_on_hand,
      quantity_changed: 0,
      reason: "Putaway to bin location",
      to_bin_location_id: binLocationId,
      created_by: userId,
      created_at: now,
    },
  ]);

  return getInventoryBins(organizationId, inventoryId);
}

export async function getStockMovements(
  organizationId: string,
  inventoryId?: string,
  options: { page?: number; pageSize?: number } = {},
) {
  const supabase = createServerClient();
  const { page = 0, pageSize = 50 } = options;

  let query = supabase
    .from("stock_movements")
    .select("*", { count: "exact" })
    .eq("organization_id", organizationId);

  if (inventoryId) {
    query = query.eq("inventory_id", inventoryId);
  }

  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .range(page * pageSize, (page + 1) * pageSize - 1);

  if (error) {
    throw error;
  }

  return {
    data: data || [],
    pagination: {
      page,
      pageSize,
      total: count || 0,
    },
  };
}
