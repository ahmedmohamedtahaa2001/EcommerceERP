import { NextRequest, NextResponse } from "next/server";
import {
  getUserContext,
  updateBinLocation,
  deleteBinLocation,
} from "../../../supabase";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; binId: string } },
) {
  try {
    const { user, org, error: authError } = await getUserContext(request);
    if (authError || !user || !org) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const data = await updateBinLocation(org.id, params.id, params.binId, body);

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error("Error updating bin location:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update bin location" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; binId: string } },
) {
  try {
    const { user, org, error: authError } = await getUserContext(request);
    if (authError || !user || !org) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const data = await deleteBinLocation(org.id, params.id, params.binId);

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error("Error deleting bin location:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete bin location" },
      { status: 500 },
    );
  }
}
