# Firebase Architecture - ERP System

## Overview

This document describes the complete Firestore database architecture for the ERP system, including collection structure, relationships, security rules, and best practices.

## Collection Structure

### Root Collections

```
companies/                          # Root collection for all companies
├── {companyId}/
│   ├── users/                     # Company users
│   ├── products/                  # Company products
│   ├── customers/                 # Company customers
│   ├── orders/                    # Company orders
│   ├── warehouses/                # Company warehouses
│   ├── auditLogs/                 # Company audit logs
│   ├── webhooks/                  # Company webhooks
│   └── {other collections}
```

### Detailed Structure

#### 1. Companies (Root)
```javascript
companies/{companyId}
{
  name: string,
  slug: string (unique),
  email: string,
  phone: string,
  website: string,
  logoUrl: string,
  description: string,
  active: boolean,
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

#### 2. Users (Root)
```javascript
users/{userId}
{
  email: string (from Firebase Auth),
  firstName: string,
  lastName: string,
  companyId: string (reference to companies),
  role: 'admin' | 'manager' | 'staff' | 'viewer',
  active: boolean,
  lastLogin: Timestamp,
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

#### 3. Products (Subcollection of Companies)
```javascript
companies/{companyId}/products/{productId}
{
  companyId: string,
  sku: string,
  name: string,
  description: string,
  categoryId: string,
  price: number,
  cost: number,
  active: boolean,
  createdAt: Timestamp,
  updatedAt: Timestamp
}

// Subcollection: Product Variants
companies/{companyId}/products/{productId}/variants/{variantId}
{
  productId: string,
  name: string,
  sku: string,
  price: number,
  active: boolean,
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

#### 4. Customers (Subcollection of Companies)
```javascript
companies/{companyId}/customers/{customerId}
{
  companyId: string,
  name: string,
  email: string,
  phone: string,
  city: string,
  state: string,
  country: string,
  zip: string,
  totalOrders: number,
  totalSpent: number,
  createdAt: Timestamp,
  updatedAt: Timestamp
}

// Subcollection: Customer Addresses
companies/{companyId}/customers/{customerId}/addresses/{addressId}
{
  customerId: string,
  street: string,
  city: string,
  state: string,
  country: string,
  zip: string,
  isDefault: boolean,
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

#### 5. Orders (Subcollection of Companies)
```javascript
companies/{companyId}/orders/{orderId}
{
  companyId: string,
  customerId: string (reference),
  orderNumber: string,
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled',
  paymentStatus: 'pending' | 'paid' | 'failed' | 'refunded',
  total: number,
  shippingAddress: object,
  notes: string,
  createdAt: Timestamp,
  updatedAt: Timestamp
}

// Subcollection: Order Items
companies/{companyId}/orders/{orderId}/items/{itemId}
{
  orderId: string,
  productId: string (reference),
  quantity: number,
  price: number,
  total: number,
  createdAt: Timestamp
}
```

#### 6. Warehouses (Subcollection of Companies)
```javascript
companies/{companyId}/warehouses/{warehouseId}
{
  companyId: string,
  name: string,
  location: string,
  isDefault: boolean,
  createdAt: Timestamp,
  updatedAt: Timestamp
}

// Subcollection: Inventory
companies/{companyId}/warehouses/{warehouseId}/inventory/{inventoryId}
{
  productId: string (reference),
  warehouseId: string,
  quantity: number,
  reserved: number,
  reorderLevel: number,
  lastRestocked: Timestamp,
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

#### 7. Audit Logs (Subcollection of Companies)
```javascript
companies/{companyId}/auditLogs/{logId}
{
  companyId: string,
  userId: string,
  action: string,
  resource: string,
  resourceId: string,
  changes: object,
  ipAddress: string,
  userAgent: string,
  createdAt: Timestamp
}
```

#### 8. Webhooks (Subcollection of Companies)
```javascript
companies/{companyId}/webhooks/{webhookId}
{
  companyId: string,
  url: string,
  events: string[],
  active: boolean,
  secret: string,
  headers: object,
  createdAt: Timestamp,
  updatedAt: Timestamp
}

// Subcollection: Webhook Logs
companies/{companyId}/webhooks/{webhookId}/webhookLogs/{logId}
{
  webhookId: string,
  event: string,
  status: number,
  payload: object,
  response: string,
  error: string,
  createdAt: Timestamp
}
```

## Data Relationships

### Document References
Instead of storing foreign keys as UUIDs, Firestore uses document references:

```typescript
// Instead of: customerId: "uuid-string"
// Use reference paths for cross-document queries:
const orderQuery = query(
  collection(db, 'companies', companyId, 'orders'),
  where('customerId', '==', customerId)
);
```

### Denormalization Strategy
For frequently accessed data, consider denormalizing:

```javascript
// Order document includes customer name for quick display
companies/{companyId}/orders/{orderId}
{
  customerId: string,
  customerName: string,      // Denormalized for display
  customerEmail: string,     // Denormalized for contact
  // ... other fields
}
```

## Indexing Strategy

### Composite Indexes Required
Create these indexes in Firebase Console or let Firestore auto-create them:

```
Collection: companies/{companyId}/products
  - companyId, status (for filtering by company and status)
  - companyId, createdAt DESC (for pagination)

Collection: companies/{companyId}/orders
  - companyId, status (for status filtering)
  - companyId, createdAt DESC (for pagination)

Collection: companies/{companyId}/inventory
  - warehouseId, quantity (for low stock alerts)
```

## Security Rules

See [firestore.rules](./firestore.rules) for complete implementation.

**Key Principles:**
- Company-level data isolation: users can only access their company's data
- Role-based access control (RBAC):
  - **Admin**: Full read/write for all resources
  - **Manager**: Create/update for most resources, delete only for certain items
  - **Staff**: Read + create for some resources
  - **Viewer**: Read-only access
- Audit logs are write-only (server-side)
- Webhooks are admin-only

## Query Patterns

### Common Queries

```typescript
// Get all products for a company (with pagination)
const productsQuery = query(
  collection(db, 'companies', companyId, 'products'),
  where('active', '==', true),
  orderBy('createdAt', 'desc'),
  limit(10)
);

// Get orders for a customer
const orderQuery = query(
  collection(db, 'companies', companyId, 'orders'),
  where('customerId', '==', customerId),
  orderBy('createdAt', 'desc')
);

// Get low stock inventory
const lowStockQuery = query(
  collection(db, 'companies', companyId, 'warehouses', warehouseId, 'inventory'),
  where('quantity', '<', 20)
);
```

### Full-Text Search
Firestore doesn't support full-text search. For product/customer search, use:

**Option 1: Client-side filtering** (for small datasets)
```typescript
const products = await getProductsByCompany(companyId);
const filtered = products.filter(p => 
  p.name.toLowerCase().includes(searchTerm)
);
```

**Option 2: Algolia integration** (recommended for production)
```typescript
import algoliasearch from 'algoliasearch';

const client = algoliasearch(appId, apiKey);
const results = await client.search([
  {
    indexName: 'products',
    query: searchTerm,
    facetFilters: [`companyId:${companyId}`]
  }
]);
```

## Scalability Considerations

### Write Throughput
Firestore has per-document write limits. For high-volume updates:

- **Use batch writes** for multiple operations
- **Distribute documents** across multiple collections if one collection exceeds limits
- **Use document sharding** for counters:
  ```javascript
  // Instead of: totalOrders: 100
  // Use: totalOrders_{0-9}: 10 (sharded across 10 documents)
  ```

### Read Throughput
Optimize with:

- **Proper indexing** for queries
- **Pagination** to limit document reads
- **Caching** frequently accessed data
- **Denormalization** to avoid joins

### Storage Size
Keep documents lean:

- Move large text to separate documents
- Archive old audit logs quarterly
- Use references instead of embedding large objects

## Backup & Recovery

### Daily Automatic Backups
Firebase automatically backs up your data. To restore:

1. Go to Firebase Console → Firestore
2. Click **"Backups"** tab
3. Select backup and click **"Restore"**

### Manual Backup
```bash
# Using Firebase CLI
firebase firestore:export gs://my-bucket/backup-$(date +%Y%m%d)

# Using Cloud Storage
gsutil -m cp -r gs://my-bucket/backup-* ./local-backup/
```

## Monitoring & Optimization

### Key Metrics
- **Read/Write Usage**: Firebase Console → Usage tab
- **Storage**: Firestore → Storage breakdown
- **Real-time monitoring**: Cloud Monitoring dashboard

### Optimization Tips
1. Review slow queries in Cloud Logging
2. Create indexes for frequently used queries
3. Implement pagination for large result sets
4. Use limit queries to avoid reading unnecessary data
5. Archive old data periodically

## Migration Notes

When migrating from PostgreSQL:

1. **UUIDs → Document IDs**: Firestore document IDs are limited to 1500 bytes (usually < 40 chars)
2. **JSON fields**: Firestore natively supports nested objects
3. **Arrays**: Use Firestore arrays instead of junction tables
4. **Transactions**: Limited to 500 writes per transaction (use batch operations for more)
5. **Relationships**: Use document references or denormalization instead of JOIN queries

---

**Last Updated**: 2024-11-04
**Firestore Mode**: Native Mode
**Location**: us-central1
