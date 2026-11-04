import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  offset,
  Query,
  QueryConstraint,
  writeBatch,
  runTransaction,
  Timestamp,
  QueryFieldFilterConstraint,
  OrderByDirection,
} from 'firebase/firestore';
import { db } from './firebase-config';
import {
  Product,
  Order,
  Customer,
  Warehouse,
  Inventory,
  Company,
  User,
  AuditLog,
} from '@/types/firebase';

// Collection references
export const COLLECTIONS = {
  COMPANIES: 'companies',
  USERS: 'users',
  PRODUCTS: 'products',
  PRODUCT_VARIANTS: 'variants',
  CUSTOMERS: 'customers',
  CUSTOMER_ADDRESSES: 'addresses',
  ORDERS: 'orders',
  ORDER_ITEMS: 'items',
  WAREHOUSES: 'warehouses',
  INVENTORY: 'inventory',
  AUDIT_LOGS: 'auditLogs',
  WEBHOOKS: 'webhooks',
  WEBHOOK_LOGS: 'webhookLogs',
};

// Generic read functions
export async function getDocument<T>(collectionPath: string, docId: string): Promise<T | null> {
  try {
    const docRef = doc(db, collectionPath, docId);
    const docSnap = await getDoc(docRef);
    return (docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null) as T | null;
  } catch (error) {
    console.error(`Error getting document: ${error}`);
    throw error;
  }
}

export async function getDocuments<T>(
  collectionPath: string,
  constraints: QueryConstraint[] = []
): Promise<T[]> {
  try {
    const q = query(collection(db, collectionPath), ...constraints);
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as T));
  } catch (error) {
    console.error(`Error getting documents: ${error}`);
    throw error;
  }
}

// Create/Update
export async function setDocument<T>(
  collectionPath: string,
  docId: string,
  data: Partial<T>,
  merge = true
): Promise<void> {
  try {
    const docRef = doc(db, collectionPath, docId);
    await setDoc(docRef, data, { merge });
  } catch (error) {
    console.error(`Error setting document: ${error}`);
    throw error;
  }
}

export async function updateDocument<T>(
  collectionPath: string,
  docId: string,
  data: Partial<T>
): Promise<void> {
  try {
    const docRef = doc(db, collectionPath, docId);
    await updateDoc(docRef, data);
  } catch (error) {
    console.error(`Error updating document: ${error}`);
    throw error;
  }
}

// Delete
export async function deleteDocument(collectionPath: string, docId: string): Promise<void> {
  try {
    const docRef = doc(db, collectionPath, docId);
    await deleteDoc(docRef);
  } catch (error) {
    console.error(`Error deleting document: ${error}`);
    throw error;
  }
}

// Pagination helper
export async function getPaginatedDocuments<T>(
  collectionPath: string,
  pageNum: number = 1,
  pageSize: number = 10,
  constraints: QueryConstraint[] = []
): Promise<{ data: T[]; total: number; page: number; pages: number }> {
  try {
    const skip = (pageNum - 1) * pageSize;

    // Get total count
    const countQuery = query(collection(db, collectionPath), ...constraints);
    const countSnapshot = await getDocs(countQuery);
    const total = countSnapshot.size;

    // Get paginated data
    const dataQuery = query(
      collection(db, collectionPath),
      ...constraints,
      offset(skip),
      limit(pageSize)
    );
    const dataSnapshot = await getDocs(dataQuery);
    const data = dataSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as T));

    return {
      data,
      total,
      page: pageNum,
      pages: Math.ceil(total / pageSize),
    };
  } catch (error) {
    console.error(`Error getting paginated documents: ${error}`);
    throw error;
  }
}

// Batch operations
export async function batchWrite(
  operations: Array<{
    type: 'set' | 'update' | 'delete';
    collection: string;
    docId: string;
    data?: any;
  }>
): Promise<void> {
  try {
    const batch = writeBatch(db);

    for (const op of operations) {
      const docRef = doc(db, op.collection, op.docId);
      if (op.type === 'set') {
        batch.set(docRef, op.data);
      } else if (op.type === 'update') {
        batch.update(docRef, op.data);
      } else if (op.type === 'delete') {
        batch.delete(docRef);
      }
    }

    await batch.commit();
  } catch (error) {
    console.error(`Error batch writing: ${error}`);
    throw error;
  }
}

// Transaction helper
export async function runDbTransaction<T>(
  callback: (transaction: any) => Promise<T>
): Promise<T> {
  try {
    return await runTransaction(db, callback as any);
  } catch (error) {
    console.error(`Error running transaction: ${error}`);
    throw error;
  }
}

// Product operations
export async function getProductsByCompany(
  companyId: string,
  pageNum: number = 1,
  pageSize: number = 10,
  search?: string
): Promise<{
  data: Product[];
  total: number;
  page: number;
  pages: number;
}> {
  try {
    const constraints: QueryConstraint[] = [where('companyId', '==', companyId)];

    if (search) {
      // Note: Firestore doesn't support full-text search, implement on client side
      // or use a search service like Algolia
    }

    constraints.push(orderBy('createdAt', 'desc' as OrderByDirection));

    return getPaginatedDocuments<Product>(
      COLLECTIONS.PRODUCTS,
      pageNum,
      pageSize,
      constraints
    );
  } catch (error) {
    console.error(`Error getting products: ${error}`);
    throw error;
  }
}

export async function createProduct(
  companyId: string,
  product: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  try {
    const docRef = doc(collection(db, COLLECTIONS.PRODUCTS));
    const now = Timestamp.now();

    await setDoc(docRef, {
      ...product,
      companyId,
      createdAt: now,
      updatedAt: now,
    });

    return docRef.id;
  } catch (error) {
    console.error(`Error creating product: ${error}`);
    throw error;
  }
}

// Order operations
export async function getOrdersByCompany(
  companyId: string,
  pageNum: number = 1,
  pageSize: number = 10
): Promise<{
  data: Order[];
  total: number;
  page: number;
  pages: number;
}> {
  try {
    const constraints: QueryConstraint[] = [
      where('companyId', '==', companyId),
      orderBy('createdAt', 'desc' as OrderByDirection),
    ];

    return getPaginatedDocuments<Order>(COLLECTIONS.ORDERS, pageNum, pageSize, constraints);
  } catch (error) {
    console.error(`Error getting orders: ${error}`);
    throw error;
  }
}

export async function createOrder(
  companyId: string,
  order: Omit<Order, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  try {
    const docRef = doc(collection(db, COLLECTIONS.ORDERS));
    const now = Timestamp.now();

    await setDoc(docRef, {
      ...order,
      companyId,
      createdAt: now,
      updatedAt: now,
    });

    return docRef.id;
  } catch (error) {
    console.error(`Error creating order: ${error}`);
    throw error;
  }
}

// Customer operations
export async function getCustomersByCompany(
  companyId: string,
  pageNum: number = 1,
  pageSize: number = 10
): Promise<{
  data: Customer[];
  total: number;
  page: number;
  pages: number;
}> {
  try {
    const constraints: QueryConstraint[] = [
      where('companyId', '==', companyId),
      orderBy('createdAt', 'desc' as OrderByDirection),
    ];

    return getPaginatedDocuments<Customer>(
      COLLECTIONS.CUSTOMERS,
      pageNum,
      pageSize,
      constraints
    );
  } catch (error) {
    console.error(`Error getting customers: ${error}`);
    throw error;
  }
}

// Inventory operations
export async function getInventoryByWarehouse(
  warehouseId: string
): Promise<Inventory[]> {
  try {
    const constraints: QueryConstraint[] = [
      where('warehouseId', '==', warehouseId),
    ];

    return getDocuments<Inventory>(COLLECTIONS.INVENTORY, constraints);
  } catch (error) {
    console.error(`Error getting inventory: ${error}`);
    throw error;
  }
}

export async function updateInventory(
  inventoryId: string,
  data: Partial<Inventory>
): Promise<void> {
  try {
    const now = Timestamp.now();
    await updateDocument<Inventory>(COLLECTIONS.INVENTORY, inventoryId, {
      ...data,
      updatedAt: now,
    });
  } catch (error) {
    console.error(`Error updating inventory: ${error}`);
    throw error;
  }
}

// Audit logging
export async function logAudit(
  companyId: string,
  userId: string,
  action: string,
  resource: string,
  resourceId: string,
  changes?: Record<string, any>
): Promise<void> {
  try {
    const docRef = doc(collection(db, COLLECTIONS.AUDIT_LOGS));
    const now = Timestamp.now();

    await setDoc(docRef, {
      companyId,
      userId,
      action,
      resource,
      resourceId,
      changes,
      ipAddress: process.env.NODE_ENV === 'development' ? '127.0.0.1' : undefined,
      createdAt: now,
    });
  } catch (error) {
    console.error(`Error logging audit: ${error}`);
    throw error;
  }
}
