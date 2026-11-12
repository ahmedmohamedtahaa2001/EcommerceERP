import { NextRequest, NextResponse } from "next/server";
import { getUserContext, putawayInventory } from "../../supabase";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const { user, org, error: authError } = await getUserContext(request);
    if (authError || !user || !org) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { binLocationId, quantity } = body;

    if (!binLocationId || !quantity) {
      return NextResponse.json(
        { error: "Missing required fields: binLocationId, quantity" },
        { status: 400 },
      );
    }

    const data = await putawayInventory(
      org.id,
      user.id,
      params.id,
      binLocationId,
      quantity,
    );

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error("Error putting away inventory:", error);
    return NextResponse.json(
      { error: error.message || "Failed to put away inventory" },
      { status: 500 },
    );
  }
}
