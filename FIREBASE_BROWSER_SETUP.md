# Firebase Database Setup Guide for Claude Browser Extension

## 🎯 Objective
Build a complete, production-ready Firestore database for the Operix ERP system with proper schema, data types, relations, and security rules.

---

## STEP 1: Create Firebase Project

**Prompt for Claude Browser Extension:**
```
Go to firebase.google.com/console
1. Click "Add Project"
2. Project Name: "operix-erp"
3. Enable Google Analytics: YES
4. Select region closest to you
5. Create project

After project is created:
- Go to Settings (gear icon) → Project Settings
- Under "Your apps" → Click "Web"
- Copy the entire Firebase config object
```

**What you'll get:**
```javascript
{
  apiKey: "YOUR_API_KEY",
  authDomain: "operix-erp-xxxxx.firebaseapp.com",
  projectId: "operix-erp-xxxxx",
  storageBucket: "operix-erp-xxxxx.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef123456"
}
```

---

## STEP 2: Enable Firestore Database

**Prompt:**
```
1. In Firebase Console, go to Firestore Database (left menu)
2. Click "Create Database"
3. Select "Start in test mode" (we'll fix security rules later)
4. Choose region: same as project
5. Click "Enable"

Wait for database to be ready (2-3 minutes)
```

---

## STEP 3: Create Collections & Schema

**Copy this EXACT schema structure in Firestore:**

### Collection 1: `companies`
```
Document ID: Auto-generated
Fields:
- name (string): "Acme Corp"
- email (string): "contact@acme.com"
- industry (string): "Retail"
- website (string): "https://acme.com"
- country (string): "US"
- active (boolean): true
- subscription (string): "premium"
- createdAt (timestamp): Current timestamp
- updatedAt (timestamp): Current timestamp
```

### Collection 2: `warehouses`
```
Document ID: Auto-generated
Fields:
- companyId (string): [Reference to companies doc]
- name (string): "Main Warehouse"
- location (string): "Downtown"
- address (string): "123 Main St"
- city (string): "New York"
- state (string): "NY"
- zipCode (string): "10001"
- country (string): "US"
- isDefault (boolean): true
- capacity (number): 10000
- currentUtilization (number): 4500
- createdAt (timestamp): Current timestamp
- updatedAt (timestamp): Current timestamp
- createdBy (string): [User UID]
```

### Collection 3: `products`
```
Document ID: Auto-generated
Fields:
- companyId (string): [Reference to companies doc]
- sku (string): "PROD-001"
- name (string): "Widget A"
- description (string): "High quality widget"
- category (string): "Widgets"
- price (number): 29.99
- cost (number): 15.00
- margin (number): 0.50
- weight (number): 2.5 (kg)
- dimensions (map):
  - length: 10
  - width: 5
  - height: 8
- active (boolean): true
- barcode (string): "123456789"
- createdAt (timestamp): Current timestamp
- updatedAt (timestamp): Current timestamp
```

### Collection 4: `inventory`
```
Document ID: Auto-generated
Fields:
- companyId (string): [Reference to companies doc]
- productId (string): [Reference to products doc]
- warehouseId (string): [Reference to warehouses doc]
- quantity (number): 100
- reserved (number): 10
- available (number): 90
- reorderLevel (number): 20
- reorderQuantity (number): 50
- lastRestocked (timestamp): Current timestamp
- lastChecked (timestamp): Current timestamp
- createdAt (timestamp): Current timestamp
- updatedAt (timestamp): Current timestamp
- createdBy (string): [User UID]
```

### Collection 5: `stock_movements`
```
Document ID: Auto-generated
Fields:
- companyId (string): [Reference to companies doc]
- inventoryId (string): [Reference to inventory doc]
- productId (string): [Reference to products doc]
- warehouseId (string): [Reference to warehouses doc]
- type (string): "add" | "remove" | "adjust" | "transfer_in" | "transfer_out"
- quantityBefore (number): 100
- quantityAfter (number): 150
- quantityChanged (number): 50
- reason (string): "purchase_order"
- notes (string): "PO#12345"
- fromWarehouseId (string): [For transfers only]
- toWarehouseId (string): [For transfers only]
- createdAt (timestamp): Current timestamp
- createdBy (string): [User UID]
```

### Collection 6: `users`
```
Document ID: [Firebase Auth UID]
Fields:
- companyId (string): [Reference to companies doc]
- email (string): "user@example.com"
- name (string): "John Doe"
- role (string): "admin" | "manager" | "user"
- department (string): "Operations"
- phone (string): "+1234567890"
- avatar (string): "https://..."
- active (boolean): true
- lastLogin (timestamp): Current timestamp
- createdAt (timestamp): Current timestamp
- updatedAt (timestamp): Current timestamp
- permissions (array): ["inventory.read", "inventory.write"]
```

### Collection 7: `audit_logs`
```
Document ID: Auto-generated
Fields:
- companyId (string): [Reference to companies doc]
- userId (string): [Reference to users doc]
- action (string): "create" | "update" | "delete"
- resource (string): "inventory" | "warehouse" | "product"
- resourceId (string): [ID of affected resource]
- changes (map): {before: {...}, after: {...}}
- ipAddress (string): "192.168.1.1"
- createdAt (timestamp): Current timestamp
```

---

## STEP 4: Add Sample Data

**Run this in Firebase Console's "Firestore" tab:**

```javascript
// Add sample company
db.collection("companies").add({
  name: "Demo Retail Co",
  email: "demo@example.com",
  industry: "Retail",
  website: "https://demo.example.com",
  country: "US",
  active: true,
  subscription: "premium",
  createdAt: firebase.firestore.Timestamp.now(),
  updatedAt: firebase.firestore.Timestamp.now()
})

// Add sample warehouse (replace COMPANY_ID)
db.collection("warehouses").add({
  companyId: "COMPANY_ID",
  name: "Main Warehouse",
  location: "New York",
  address: "123 Main St",
  city: "New York",
  state: "NY",
  zipCode: "10001",
  country: "US",
  isDefault: true,
  capacity: 50000,
  currentUtilization: 12000,
  createdAt: firebase.firestore.Timestamp.now(),
  updatedAt: firebase.firestore.Timestamp.now(),
  createdBy: "system"
})

// Add sample product (replace COMPANY_ID)
db.collection("products").add({
  companyId: "COMPANY_ID",
  sku: "WIDGET-001",
  name: "Premium Widget",
  description: "High quality widget for retail",
  category: "Electronics",
  price: 49.99,
  cost: 20.00,
  margin: 0.60,
  weight: 1.5,
  dimensions: { length: 12, width: 8, height: 6 },
  active: true,
  barcode: "123456789012",
  createdAt: firebase.firestore.Timestamp.now(),
  updatedAt: firebase.firestore.Timestamp.now()
})

// Add sample inventory (replace IDs)
db.collection("inventory").add({
  companyId: "COMPANY_ID",
  productId: "PRODUCT_ID",
  warehouseId: "WAREHOUSE_ID",
  quantity: 250,
  reserved: 25,
  available: 225,
  reorderLevel: 50,
  reorderQuantity: 200,
  lastRestocked: firebase.firestore.Timestamp.now(),
  lastChecked: firebase.firestore.Timestamp.now(),
  createdAt: firebase.firestore.Timestamp.now(),
  updatedAt: firebase.firestore.Timestamp.now(),
  createdBy: "system"
})
```

---

## STEP 5: Create Firestore Indexes

**Prompt:**
```
In Firebase Console → Firestore Database → Indexes tab

Create these composite indexes:

1. Collection: inventory
   Fields:
   - companyId (Ascending)
   - warehouseId (Ascending)
   - quantity (Ascending)

2. Collection: inventory
   Fields:
   - companyId (Ascending)
   - updatedAt (Descending)

3. Collection: stock_movements
   Fields:
   - companyId (Ascending)
   - createdAt (Descending)

4. Collection: stock_movements
   Fields:
   - warehouseId (Ascending)
   - createdAt (Descending)

5. Collection: products
   Fields:
   - companyId (Ascending)
   - active (Ascending)
```

---

## STEP 6: Set Security Rules

**In Firestore → Rules tab, replace with:**

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Allow authenticated users
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
    
    // Specific rules for companies
    match /companies/{companyId} {
      allow read, write: if request.auth != null && 
        exists(/databases/$(database)/documents/users/$(request.auth.uid)) &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.companyId == companyId;
    }
    
    // Inventory rules
    match /inventory/{inventoryId} {
      allow read, write: if request.auth != null &&
        get(/databases/$(database)/documents/inventory/$(inventoryId)).data.companyId == 
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.companyId;
    }
    
    // Stock movements (audit trail)
    match /stock_movements/{movementId} {
      allow read: if request.auth != null &&
        get(/databases/$(database)/documents/stock_movements/$(movementId)).data.companyId ==
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.companyId;
      allow create: if request.auth != null;
    }
    
    // Similar rules for other collections
    match /warehouses/{warehouseId} {
      allow read, write: if request.auth != null;
    }
    
    match /products/{productId} {
      allow read, write: if request.auth != null;
    }
    
    match /users/{userId} {
      allow read, write: if request.auth != null;
    }
    
    match /audit_logs/{logId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
    }
  }
}
```

---

## STEP 7: Get API Keys & Environment Variables

**Final Prompt:**
```
In Firebase Console:
1. Go to Settings (gear icon) → Project Settings
2. Under "Your apps" → Web app
3. Copy all values shown in config

Also get Service Account Key:
1. Settings → Service Accounts → Generate new private key
2. Download JSON file (KEEP SAFE - contains credentials)

You now have:
✅ API Key
✅ Auth Domain
✅ Project ID
✅ Storage Bucket
✅ Messaging Sender ID
✅ App ID
✅ Service Account JSON (for backend)
```

---

## Files to Save

After Firebase setup, save these credentials:

**`.env.local`** (for frontend):
```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key_here
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=operix-erp-xxxxx.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=operix-erp-xxxxx
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=operix-erp-xxxxx.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abcdef123456
```

**Service Account Key** (save as `firebase-service-account.json` - KEEP SAFE):
```json
{
  "type": "service_account",
  "project_id": "operix-erp-xxxxx",
  "private_key_id": "xxxxx",
  "private_key": "REDACTED_PRIVATE_KEY\n",
  "client_email": "firebase-adminsdk-xxxxx@operix-erp-xxxxx.iam.gserviceaccount.com",
  "client_id": "123456789",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/..."
}
```

---

## ✅ Verification Checklist

After setup, verify:
- [ ] Firebase project created
- [ ] Firestore database active
- [ ] 7 collections created with proper schema
- [ ] Sample data added
- [ ] Indexes created
- [ ] Security rules deployed
- [ ] Environment variables saved
- [ ] Service account key saved
- [ ] Can connect from Next.js app

---

## 🎯 Next Steps

1. ✅ Complete this setup in Firebase
2. ✅ Save environment variables to `.env.local`
3. ✅ Test connection with: `npm run dev`
4. ✅ Visit: http://localhost:3000/inventory-v2
5. ✅ Start building inventory data

**You now have a complete, production-ready database!**
