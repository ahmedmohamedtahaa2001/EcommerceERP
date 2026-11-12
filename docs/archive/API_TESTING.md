# Operix ERP - Complete API Testing Guide

## Setup

### Prerequisites

- Dev server running: `npm run dev`
- Supabase connected and RLS policies applied
- Demo data created
- Auth cookie from login session

### Base URL

```
http://localhost:3001
```

### Authentication

Login first to get auth cookie:

```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@test.local",
    "password": "ChangeMe#2026"
  }'
```

---

## 1. INVENTORY API TESTS

### List All Inventory

```bash
curl http://localhost:3001/api/inventory
```

**Expected**: Array of inventory items for your organization

**Options**:

- `?page=0&pageSize=20` - Pagination
- `?sortBy=quantity&sortOrder=asc` - Sorting
- `?warehouseId=UUID` - Filter by warehouse
- `?productId=UUID` - Filter by product

### Create Inventory

```bash
curl -X POST http://localhost:3001/api/inventory \
  -H "Content-Type: application/json" \
  -d '{
    "productId": "PRODUCT_UUID",
    "warehouseId": "WAREHOUSE_UUID",
    "quantity": 100,
    "reorderLevel": 10
  }'
```

**Expected**: 201 Created with inventory object

### Adjust Stock

```bash
curl -X POST http://localhost:3001/api/inventory/adjust \
  -H "Content-Type: application/json" \
  -d '{
    "inventoryId": "INVENTORY_UUID",
    "quantity": 25,
    "reason": "Restock"
  }'
```

**Expected**: 200 OK with updated inventory

### Transfer Between Warehouses

```bash
curl -X POST http://localhost:3001/api/inventory/transfer \
  -H "Content-Type: application/json" \
  -d '{
    "fromInventoryId": "FROM_UUID",
    "toInventoryId": "TO_UUID",
    "quantity": 50,
    "reason": "Inter-warehouse transfer"
  }'
```

**Expected**: 200 OK with transfer confirmation

### Get Stock Movements

```bash
curl 'http://localhost:3001/api/inventory/movements?inventoryId=INVENTORY_UUID'
```

**Expected**: Array of stock movement records

---

## 2. PRODUCTS API TESTS

### List All Products

```bash
curl http://localhost:3001/api/products
```

**Options**:

- `?search=laptop` - Search by name/SKU
- `?page=0&pageSize=20` - Pagination
- `?sortBy=price&sortOrder=desc` - Sorting

### Create Product

```bash
curl -X POST http://localhost:3001/api/products \
  -H "Content-Type: application/json" \
  -d '{
    "name": "New Product",
    "sku": "NEWPROD-001",
    "description": "Product description",
    "price": 99.99,
    "category": "electronics"
  }'
```

**Expected**: 201 Created

### Get Product Details

```bash
curl http://localhost:3001/api/products/PRODUCT_UUID
```

**Expected**: Single product object

### Update Product

```bash
curl -X PUT http://localhost:3001/api/products/PRODUCT_UUID \
  -H "Content-Type: application/json" \
  -d '{
    "price": 119.99,
    "description": "Updated description"
  }'
```

**Expected**: 200 OK with updated product

### Delete Product

```bash
curl -X DELETE http://localhost:3001/api/products/PRODUCT_UUID
```

**Expected**: 200 OK

---

## 3. ORDERS API TESTS

### List All Orders

```bash
curl http://localhost:3001/api/orders
```

**Options**:

- `?status=pending` - Filter by status
- `?page=0&pageSize=20` - Pagination
- `?sortBy=created_at&sortOrder=desc` - Sorting

### Create Order

```bash
curl -X POST http://localhost:3001/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": "CUSTOMER_UUID",
    "total": 1299.99,
    "status": "pending",
    "notes": "Customer request"
  }'
```

**Expected**: 201 Created

### Get Order Details

```bash
curl http://localhost:3001/api/orders/ORDER_UUID
```

**Expected**: Single order object

### Update Order Status

```bash
curl -X PUT http://localhost:3001/api/orders/ORDER_UUID \
  -H "Content-Type: application/json" \
  -d '{
    "status": "shipped"
  }'
```

**Expected**: 200 OK

---

## 4. CUSTOMERS API TESTS

### List All Customers

```bash
curl http://localhost:3001/api/customers
```

**Options**:

- `?search=john` - Search by name/email
- `?page=0&pageSize=20` - Pagination

### Create Customer

```bash
curl -X POST http://localhost:3001/api/customers \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Jane Doe",
    "email": "jane@company.com",
    "phone": "+1-555-0123",
    "company": "Acme Inc",
    "city": "Boston",
    "state": "MA",
    "zip": "02101"
  }'
```

**Expected**: 201 Created

### Get Customer Details

```bash
curl http://localhost:3001/api/customers/CUSTOMER_UUID
```

**Expected**: Single customer object

### Update Customer

```bash
curl -X PUT http://localhost:3001/api/customers/CUSTOMER_UUID \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+1-555-9876",
    "company": "New Company"
  }'
```

**Expected**: 200 OK

---

## 5. WAREHOUSES API TESTS

### List All Warehouses

```bash
curl http://localhost:3001/api/warehouses
```

**Expected**: Array of all warehouses

### Create Warehouse

```bash
curl -X POST http://localhost:3001/api/warehouses \
  -H "Content-Type: application/json" \
  -d '{
    "name": "New Warehouse",
    "location": "Miami",
    "address": "100 Logistics Dr",
    "city": "Miami",
    "state": "FL",
    "zip": "33101",
    "capacity": 5000
  }'
```

**Expected**: 201 Created

### Get Warehouse Details

```bash
curl http://localhost:3001/api/warehouses/WAREHOUSE_UUID
```

**Expected**: Single warehouse object

---

## 6. AGENT API TESTS

### Send Task to Backend Agent

```bash
curl -X POST http://localhost:3001/api/agents \
  -H "Content-Type: application/json" \
  -d '{
    "task": "Design an API endpoint for inventory reports with aggregated stock levels",
    "agent": "backend",
    "sessionId": "test-session-001"
  }'
```

**Expected**: Agent response with recommendations

### Send Task to Database Agent

```bash
curl -X POST http://localhost:3001/api/agents \
  -H "Content-Type: application/json" \
  -d '{
    "task": "Optimize queries for getting low-stock products across all warehouses",
    "agent": "database",
    "sessionId": "test-session-001"
  }'
```

**Expected**: Database optimization recommendations

---

## Test Checklist

### Authentication

- [ ] Login returns auth cookie
- [ ] Cookie persists across requests
- [ ] Unauthorized requests return 401

### Inventory Module

- [ ] GET /api/inventory returns list
- [ ] POST creates new inventory
- [ ] POST adjust updates stock
- [ ] POST transfer moves between warehouses
- [ ] GET movements returns history

### Products Module

- [ ] GET /api/products returns list
- [ ] POST creates new product
- [ ] GET /api/products/:id returns single
- [ ] PUT updates product
- [ ] DELETE removes product

### Orders Module

- [ ] GET /api/orders returns list
- [ ] POST creates new order
- [ ] PUT updates order status
- [ ] GET filters by status

### Customers Module

- [ ] GET /api/customers returns list
- [ ] POST creates new customer
- [ ] GET /api/customers/:id returns single
- [ ] PUT updates customer info
- [ ] Search works correctly

### Warehouses Module

- [ ] GET /api/warehouses returns list
- [ ] POST creates new warehouse
- [ ] GET /api/warehouses/:id returns single

### Security (RLS)

- [ ] Can only access own organization data
- [ ] Cannot access other organization's data
- [ ] Cannot bypass organization_id check

### Pagination

- [ ] Default pageSize is 20
- [ ] Page parameter works
- [ ] hasMore flag accurate

### Agents

- [ ] Backend agent responds
- [ ] Frontend agent responds
- [ ] Database agent responds
- [ ] DevOps agent responds
- [ ] Memory persists across requests

---

## Expected Responses

### Success Response Format

```json
{
  "success": true,
  "data": [],
  "pagination": {
    "page": 0,
    "pageSize": 20,
    "total": 100,
    "hasMore": true
  }
}
```

### Error Response Format

```json
{
  "error": "Descriptive error message",
  "status": 400
}
```

### Agent Response Format

```json
{
  "success": true,
  "agent": "Backend Agent",
  "response": "Detailed response...",
  "model": "claude-opus-5-5",
  "tokensUsed": 1234
}
```

---

## Common Issues

### 401 Unauthorized

- Verify login worked
- Check auth cookie is being sent
- Restart dev server if needed

### 404 Not Found

- Check UUID is correct
- Verify item exists in your organization
- Check spelling of endpoint

### Validation Errors

- Ensure required fields are provided
- Check data types match expected format
- Verify price/quantity are positive

### RLS Errors

- Verify RLS policies are applied
- Check organization_id matches user's org
- Ensure user exists in users table

---

## Performance Testing

### Load Test Inventory

```bash
for i in {1..100}; do
  curl http://localhost:3001/api/inventory?page=$((i%5)) &
done
wait
```

### Pagination Test

```bash
# Test different page sizes
curl 'http://localhost:3001/api/products?pageSize=10&page=0'
curl 'http://localhost:3001/api/products?pageSize=50&page=0'
curl 'http://localhost:3001/api/products?pageSize=100&page=0'
```

---

## Integration Test Workflow

### Complete End-to-End Flow

```bash
# 1. Create organization (done in demo data)
# 2. Create warehouses
curl -X POST http://localhost:3001/api/warehouses ...

# 3. Create products
curl -X POST http://localhost:3001/api/products ...

# 4. Create inventory
curl -X POST http://localhost:3001/api/inventory ...

# 5. Create customers
curl -X POST http://localhost:3001/api/customers ...

# 6. Create orders
curl -X POST http://localhost:3001/api/orders ...

# 7. Adjust inventory
curl -X POST http://localhost:3001/api/inventory/adjust ...

# 8. Check stock movements
curl http://localhost:3001/api/inventory/movements

# 9. Use agents for optimization
curl -X POST http://localhost:3001/api/agents ...
```
