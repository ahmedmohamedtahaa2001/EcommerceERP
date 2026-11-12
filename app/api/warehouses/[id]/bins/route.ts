import { NextRequest, NextResponse } from "next/server";
import {
  getUserContext,
  getBinLocations,
  createBinLocation,
} from "../../supabase";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const { user, org, error: authError } = await getUserContext(request);
    if (authError || !user || !org) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const data = await getBinLocations(org.id, params.id);

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error("Error fetching bin locations:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch bin locations" },
      { status: 500 },
    );
  }
}

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
    const {
      code,
      zone,
      aisle,
      rack,
      shelf,
      bin,
      locationType,
      capacity,
      isPickable,
    } = body;

    const data = await createBinLocation(org.id, user.id, params.id, {
      code,
      zone,
      aisle,
      rack,
      shelf,
      bin,
      locationType,
      capacity,
      isPickable,
    });

    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (error: any) {
    console.error("Error creating bin location:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create bin location" },
      { status: 500 },
    );
  }
}
