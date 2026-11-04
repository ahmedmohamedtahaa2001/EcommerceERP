import { createClient } from '@supabase/supabase-js';
import * as admin from 'firebase-admin';
import * as fs from 'fs';

/**
 * Migration script: Supabase PostgreSQL → Firebase Firestore
 *
 * Run with: npx ts-node scripts/migrate-from-supabase.ts
 *
 * Prerequisites:
 * - Supabase connection credentials in .env
 * - Firebase service account key in FIREBASE_SERVICE_ACCOUNT_KEY env var
 * - Firebase project created and Firestore enabled
 */

// Initialize Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase credentials in environment variables');
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Initialize Firebase Admin
const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
if (!serviceAccountPath) {
  throw new Error('Missing FIREBASE_SERVICE_ACCOUNT_KEY in environment variables');
}

const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const firebaseDb = admin.firestore();

// Migration state
interface MigrationState {
  startTime: Date;
  companies: number;
  users: number;
  products: number;
  productVariants: number;
  customers: number;
  customerAddresses: number;
  orders: number;
  orderItems: number;
  warehouses: number;
  inventory: number;
  errors: Array<{ table: string; error: string }>;
}

const state: MigrationState = {
  startTime: new Date(),
  companies: 0,
  users: 0,
  products: 0,
  productVariants: 0,
  customers: 0,
  customerAddresses: 0,
  orders: 0,
  orderItems: 0,
  warehouses: 0,
  inventory: 0,
  errors: [],
};

// Utility functions
async function logProgress(message: string) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
}

async function migrateTable<T>(
  tableName: string,
  transform: (row: any) => T,
  firestorePath: (doc: T) => { collection: string; docId: string }
): Promise<number> {
  try {
    await logProgress(`Starting migration of ${tableName}...`);

    // Fetch all data from Supabase
    const { data, error } = await supabase.from(tableName).select('*');

    if (error) {
      throw error;
    }

    if (!data || data.length === 0) {
      await logProgress(`No data found in ${tableName}`);
      return 0;
    }

    let successCount = 0;
    const batchSize = 100;

    for (let i = 0; i < data.length; i += batchSize) {
      const batch = firebaseDb.batch();
      const chunk = data.slice(i, i + batchSize);

      for (const row of chunk) {
        try {
          const transformedData = transform(row);
          const { collection, docId } = firestorePath(transformedData);
          const docRef = firebaseDb.collection(collection).doc(docId);
          batch.set(docRef, transformedData);
          successCount++;
        } catch (error) {
          state.errors.push({
            table: tableName,
            error: `Row ${i}: ${error instanceof Error ? error.message : String(error)}`,
          });
        }
      }

      await batch.commit();
      await logProgress(
        `${tableName}: Migrated ${Math.min(i + batchSize, data.length)}/${data.length} records`
      );
    }

    await logProgress(`✓ Completed ${tableName}: ${successCount} records`);
    return successCount;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    state.errors.push({ table: tableName, error: errorMsg });
    await logProgress(`✗ Error migrating ${tableName}: ${errorMsg}`);
    return 0;
  }
}

// Transform functions
function transformCompany(row: any) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    email: row.email,
    phone: row.phone,
    website: row.website,
    logoUrl: row.logo_url,
    description: row.description,
    active: row.active,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function transformUser(row: any) {
  return {
    id: row.id,
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    companyId: row.company_id,
    role: row.role || 'staff',
    active: row.active,
    lastLogin: row.last_login ? new Date(row.last_login) : null,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function transformProduct(row: any) {
  return {
    id: row.id,
    companyId: row.company_id,
    sku: row.sku,
    name: row.name,
    description: row.description,
    categoryId: row.category_id,
    price: Number(row.price),
    cost: row.cost ? Number(row.cost) : null,
    active: row.active,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function transformProductVariant(row: any) {
  return {
    id: row.id,
    productId: row.product_id,
    name: row.name,
    sku: row.sku,
    price: row.price ? Number(row.price) : null,
    active: row.active,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function transformCustomer(row: any) {
  return {
    id: row.id,
    companyId: row.company_id,
    email: row.email,
    name: row.name,
    phone: row.phone,
    city: row.city,
    state: row.state,
    country: row.country,
    zip: row.zip,
    totalOrders: row.total_orders || 0,
    totalSpent: Number(row.total_spent) || 0,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function transformCustomerAddress(row: any) {
  return {
    id: row.id,
    customerId: row.customer_id,
    street: row.street,
    city: row.city,
    state: row.state,
    country: row.country,
    zip: row.zip,
    isDefault: row.is_default,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function transformOrder(row: any) {
  return {
    id: row.id,
    companyId: row.company_id,
    customerId: row.customer_id,
    orderNumber: row.order_number,
    status: row.status,
    paymentStatus: row.payment_status,
    total: Number(row.total),
    shippingAddress: row.shipping_address,
    notes: row.notes,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function transformOrderItem(row: any) {
  return {
    id: row.id,
    orderId: row.order_id,
    productId: row.product_id,
    quantity: row.quantity,
    price: Number(row.price),
    total: Number(row.total),
    createdAt: new Date(row.created_at),
  };
}

function transformWarehouse(row: any) {
  return {
    id: row.id,
    companyId: row.company_id,
    name: row.name,
    location: row.location,
    isDefault: row.is_default,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function transformInventory(row: any) {
  return {
    id: row.id,
    productId: row.product_id,
    warehouseId: row.warehouse_id,
    quantity: row.quantity,
    reserved: row.reserved,
    reorderLevel: row.reorder_level,
    lastRestocked: row.last_restocked ? new Date(row.last_restocked) : null,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

// Main migration function
async function runMigration() {
  try {
    await logProgress('🚀 Starting Firebase migration from Supabase...\n');

    // Migrate tables in order (respecting foreign key relationships)
    state.companies += await migrateTable('companies', transformCompany, (doc) => ({
      collection: 'companies',
      docId: doc.id,
    }));

    state.users += await migrateTable('users', transformUser, (doc) => ({
      collection: 'users',
      docId: doc.id,
    }));

    state.products += await migrateTable('products', transformProduct, (doc) => ({
      collection: `companies/${doc.companyId}/products`,
      docId: doc.id,
    }));

    state.productVariants += await migrateTable('product_variants', transformProductVariant, (doc) => ({
      collection: `companies/DEFAULT_COMPANY/products/${doc.productId}/variants`,
      docId: doc.id,
    }));

    state.customers += await migrateTable('customers', transformCustomer, (doc) => ({
      collection: `companies/${doc.companyId}/customers`,
      docId: doc.id,
    }));

    state.customerAddresses += await migrateTable(
      'customer_addresses',
      transformCustomerAddress,
      (doc) => ({
        collection: `companies/DEFAULT_COMPANY/customers/${doc.customerId}/addresses`,
        docId: doc.id,
      })
    );

    state.orders += await migrateTable('orders', transformOrder, (doc) => ({
      collection: `companies/${doc.companyId}/orders`,
      docId: doc.id,
    }));

    state.orderItems += await migrateTable('order_items', transformOrderItem, (doc) => ({
      collection: `companies/DEFAULT_COMPANY/orders/${doc.orderId}/items`,
      docId: doc.id,
    }));

    state.warehouses += await migrateTable('warehouses', transformWarehouse, (doc) => ({
      collection: `companies/${doc.companyId}/warehouses`,
      docId: doc.id,
    }));

    state.inventory += await migrateTable('inventory', transformInventory, (doc) => ({
      collection: `companies/DEFAULT_COMPANY/warehouses/DEFAULT_WAREHOUSE/inventory`,
      docId: doc.id,
    }));

    // Final report
    await logProgress('\n✅ Migration complete!\n');
    console.log('='.repeat(60));
    console.log('MIGRATION SUMMARY');
    console.log('='.repeat(60));
    console.log(`Duration: ${Date.now() - state.startTime.getTime()}ms`);
    console.log(`Companies: ${state.companies}`);
    console.log(`Users: ${state.users}`);
    console.log(`Products: ${state.products}`);
    console.log(`Product Variants: ${state.productVariants}`);
    console.log(`Customers: ${state.customers}`);
    console.log(`Customer Addresses: ${state.customerAddresses}`);
    console.log(`Orders: ${state.orders}`);
    console.log(`Order Items: ${state.orderItems}`);
    console.log(`Warehouses: ${state.warehouses}`);
    console.log(`Inventory: ${state.inventory}`);

    if (state.errors.length > 0) {
      console.log('\nERRORS:');
      state.errors.forEach((error) => {
        console.log(`  - ${error.table}: ${error.error}`);
      });
    }

    console.log('='.repeat(60));

    process.exit(0);
  } catch (error) {
    console.error('Fatal migration error:', error);
    process.exit(1);
  }
}

// Run migration
runMigration();
