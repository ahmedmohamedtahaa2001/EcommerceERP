import { db } from "@/lib/firebase-config";
import { NextRequest, NextResponse } from "next/server";
import {
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  Timestamp,
} from "firebase/firestore";
import { getAuth as getAuthHandler } from "@/lib/firebase-auth";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, userCompanyId } = await getAuthHandler(request);
    if (!user || !userCompanyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const docRef = doc(db, "inventory", params.id);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return NextResponse.json(
        { error: "Inventory record not found" },
        { status: 404 }
      );
    }

    const data = docSnap.data();

    // Check company access
    if (data.companyId !== userCompanyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json({
      success: true,
      data: {
        id: docSnap.id,
        ...data,
        createdAt: data.createdAt?.toDate?.().toISOString(),
        updatedAt: data.updatedAt?.toDate?.().toISOString(),
        lastRestocked: data.lastRestocked?.toDate?.().toISOString(),
      },
    });
  } catch (error) {
    console.error("Error fetching inventory item:", error);
    return NextResponse.json(
      { error: "Failed to fetch inventory record" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, userCompanyId } = await getAuthHandler(request);
    if (!user || !userCompanyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const docRef = doc(db, "inventory", params.id);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return NextResponse.json(
        { error: "Inventory record not found" },
        { status: 404 }
      );
    }

    const data = docSnap.data();
    if (data.companyId !== userCompanyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { quantity, reserved, reorderLevel } = body;

    // Validation
    if (quantity !== undefined && quantity < 0) {
      return NextResponse.json(
        { error: "Quantity cannot be negative" },
        { status: 400 }
      );
    }

    if (reserved !== undefined && reserved < 0) {
      return NextResponse.json(
        { error: "Reserved cannot be negative" },
        { status: 400 }
      );
    }

    // Calculate new available quantity
    const newQuantity = quantity !== undefined ? quantity : data.quantity;
    const newReserved = reserved !== undefined ? reserved : data.reserved;
    const newAvailable = Math.max(0, newQuantity - newReserved);

    const updateData: any = {
      updatedAt: Timestamp.now(),
      updatedBy: user.uid,
    };

    if (quantity !== undefined) updateData.quantity = newQuantity;
    if (reserved !== undefined) updateData.reserved = newReserved;
    if (reorderLevel !== undefined) updateData.reorderLevel = reorderLevel;
    if (quantity !== undefined || reserved !== undefined) {
      updateData.available = newAvailable;
    }

    // Set lastRestocked if quantity was increased significantly
    if (quantity !== undefined && newQuantity > data.quantity) {
      updateData.lastRestocked = Timestamp.now();
    }

    await updateDoc(docRef, updateData);

    const updatedSnap = await getDoc(docRef);
    const updatedData = updatedSnap.data();

    return NextResponse.json({
      success: true,
      data: {
        id: updatedSnap.id,
        ...updatedData,
        createdAt: updatedData?.createdAt?.toDate?.().toISOString(),
        updatedAt: updatedData?.updatedAt?.toDate?.().toISOString(),
        lastRestocked: updatedData?.lastRestocked?.toDate?.().toISOString(),
      },
    });
  } catch (error) {
    console.error("Error updating inventory:", error);
    return NextResponse.json(
      { error: "Failed to update inventory record" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, userCompanyId } = await getAuthHandler(request);
    if (!user || !userCompanyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const docRef = doc(db, "inventory", params.id);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return NextResponse.json(
        { error: "Inventory record not found" },
        { status: 404 }
      );
    }

    const data = docSnap.data();
    if (data.companyId !== userCompanyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Log deletion to audit trail
    await deleteDoc(docRef);

    return NextResponse.json({
      success: true,
      message: "Inventory record deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting inventory:", error);
    return NextResponse.json(
      { error: "Failed to delete inventory record" },
      { status: 500 }
    );
  }
}
