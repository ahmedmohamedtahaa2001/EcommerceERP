import { NextRequest, NextResponse } from "next/server";
import {
  getUserContext,
  getInventoryBins,
  suggestPutawayBins,
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

    const includeSuggestions =
      request.nextUrl.searchParams.get("suggest") === "true";

    const breakdown = await getInventoryBins(org.id, params.id);
    const suggestions = includeSuggestions
      ? await suggestPutawayBins(org.id, params.id)
      : undefined;

    return NextResponse.json({
      success: true,
      data: { ...breakdown, suggestions },
    });
  } catch (error: any) {
    console.error("Error fetching inventory bin breakdown:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch inventory bin breakdown" },
      { status: 500 },
    );
  }
}
