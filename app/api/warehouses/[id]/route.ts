import { db } from "@/lib/firebase-config";
import { NextRequest, NextResponse } from "next/server";
import {
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  Timestamp,
  query,
  collection,
  where,
  getDocs,
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

    const docRef = doc(db, "warehouses", params.id);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return NextResponse.json(
        { error: "Warehouse not found" },
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
      },
    });
  } catch (error) {
    console.error("Error fetching warehouse:", error);
    return NextResponse.json(
      { error: "Failed to fetch warehouse" },
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

    const docRef = doc(db, "warehouses", params.id);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return NextResponse.json(
        { error: "Warehouse not found" },
        { status: 404 }
      );
    }

    const data = docSnap.data();

    // Check company access
    if (data.companyId !== userCompanyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, location, isDefault } = body;

    const updateData: any = {
      updatedAt: Timestamp.now(),
      updatedBy: user.uid,
    };

    if (name !== undefined) updateData.name = name;
    if (location !== undefined) updateData.location = location;
    if (isDefault !== undefined) updateData.isDefault = isDefault;

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
      },
    });
  } catch (error) {
    console.error("Error updating warehouse:", error);
    return NextResponse.json(
      { error: "Failed to update warehouse" },
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

    const docRef = doc(db, "warehouses", params.id);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return NextResponse.json(
        { error: "Warehouse not found" },
        { status: 404 }
      );
    }

    const data = docSnap.data();

    // Check company access
    if (data.companyId !== userCompanyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if warehouse has inventory
    const q = query(
      collection(db, "inventory"),
      where("companyId", "==", userCompanyId),
      where("warehouseId", "==", params.id)
    );

    const snapshot = await getDocs(q);

    if (snapshot.docs.length > 0) {
      return NextResponse.json(
        { error: "Cannot delete warehouse with existing inventory" },
        { status: 400 }
      );
    }

    await deleteDoc(docRef);

    return NextResponse.json({
      success: true,
      message: "Warehouse deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting warehouse:", error);
    return NextResponse.json(
      { error: "Failed to delete warehouse" },
      { status: 500 }
    );
  }
}
