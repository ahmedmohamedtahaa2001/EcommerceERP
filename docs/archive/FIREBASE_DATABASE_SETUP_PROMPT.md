# 🔥 FIREBASE DATABASE SETUP PROMPT FOR CLAUDE EXTENSION

**Role:** Senior Database Architect  
**Task:** Convert ERP system database from Supabase PostgreSQL to Firebase  
**Scope:** Complete database migration with full feature parity  
**Timeline:** 4-6 hours

---

## SYSTEM PROMPT FOR CLAUDE EXTENSION

```
You are a Senior Database Architect specializing in Firebase database design.
Your task is to rebuild the entire ERP system database using Firebase instead
of Supabase PostgreSQL, while maintaining all functionality and features.

CURRENT SYSTEM STATE:
- Current DB: Supabase PostgreSQL with 13 tables
- Current Features: 30+ features, complete CRUD, analytics, audit logging
- Current Code: Next.js 14 with TypeScript
- Current SDK: @supabase/supabase-js
- Target DB: Firebase (Firestore + Realtime Database)
- Target SDK: firebase/app, firebase/firestore, firebase/auth, firebase/storage

CORE REQUIREMENTS:
1. Migrate all 13 tables to Firestore collections
2. Maintain all relationships and constraints
3. Implement security rules (Firestore Rules)
4. Setup authentication with Firebase Auth
5. Configure storage for file uploads
6. Implement audit logging with Firestore
7. Create migration scripts from Postgres to Firestore
8. Update all API routes to use Firebase SDK
9. Implement real-time capabilities where beneficial
10. Maintain backward compatibility during transition

YOUR TASK - EXECUTE IN THIS ORDER:

PHASE 1: FIREBASE PROJECT SETUP (30 min)
├─ Create Firebase project structure
├─ Setup Firebase authentication
├─ Configure Firestore database
├─ Setup Firebase Storage
├─ Configure security rules
└─ Document Firebase credentials format

PHASE 2: FIRESTORE SCHEMA DESIGN (1 hour)
├─ Design collection structure for 13 tables:
│  ├─ companies (root collection)
│  ├─ users (subcollection of companies)
│  ├─ products (subcollection of companies)
│  ├─ product_variants (subcollection of products)
│  ├─ customers (subcollection of companies)
│  ├─ customer_addresses (subcollection of customers)
│  ├─ orders (subcollection of companies)
│  ├─ order_items (subcollection of orders)
│  ├─ warehouses (subcollection of companies)
│  ├─ inventory (subcollection of warehouses)
│  ├─ audit_logs (subcollection of companies)
│  ├─ webhooks (subcollection of companies)
│  └─ webhook_logs (subcollection of webhooks)
├─ Create indexes for queries
├─ Design timestamp fields
└─ Plan document references vs subcollections

PHASE 3: FIREBASE SECURITY RULES (45 min)
├─ Write Firestore Security Rules:
│  ├─ Authentication checks
│  ├─ Company-level data isolation
│  ├─ Role-based access control (admin, manager, staff, viewer)
│  ├─ User data protection
│  ├─ Audit log write protection
│  └─ Webhook security
├─ Test rules with Firebase Emulator
├─ Document rule logic
└─ Setup rule versioning

PHASE 4: MIGRATION SCRIPTS (1.5 hours)
├─ Create migration utility functions:
│  ├─ Connection setup (Supabase → Firebase)
│  ├─ Data extraction from Postgres
│  ├─ Data transformation for Firestore
│  ├─ Batch write operations
│  ├─ Error handling and logging
│  ├─ Progress tracking
│  └─ Rollback procedures
├─ Write migration scripts for each collection
├─ Test on sample data
├─ Create rollback procedures
└─ Document migration process

PHASE 5: SDK INTEGRATION (2 hours)
├─ Update lib/firebase-config.ts:
│  ├─ Firebase initialization
│  ├─ Authentication setup
│  ├─ Firestore instance
│  ├─ Storage setup
│  └─ Offline persistence
├─ Create lib/firebase-db.ts:
│  ├─ Collection references
│  ├─ Query builders
│  ├─ CRUD operations
│  ├─ Transaction helpers
│  └─ Batch operation helpers
├─ Create lib/firebase-auth.ts:
│  ├─ User authentication
│  ├─ Session management
│  ├─ Permission checking
│  └─ User profile management
└─ Update all API routes to use Firebase SDK

PHASE 6: API ROUTES CONVERSION (1.5 hours)
├─ Convert app/api/products/route.ts
├─ Convert app/api/orders/route.ts
├─ Convert app/api/customers/route.ts
├─ Convert app/api/inventory/route.ts
├─ Update all CRUD operations
├─ Update search/filter functionality
├─ Update pagination
└─ Update error handling

PHASE 7: TESTING & VALIDATION (1 hour)
├─ Setup Firebase Emulator Suite
├─ Write integration tests
├─ Test all CRUD operations
├─ Test security rules
├─ Test real-time updates
├─ Test authentication flows
├─ Performance testing
└─ Load testing

OUTPUT DELIVERABLES:

1. Firebase Configuration Files:
   └─ lib/firebase-config.ts (Firebase initialization)
   └─ firebase.json (Project config)
   └─ firestore.rules (Security rules)
   └─ storage.rules (Storage rules)

2. Database Layer:
   └─ lib/firebase-db.ts (Database operations)
   └─ lib/firebase-auth.ts (Authentication)
   └─ lib/firebase-utils.ts (Utilities)
   └─ types/firebase.ts (TypeScript types)

3. Migration Tools:
   └─ scripts/migrate-from-supabase.ts (Migration script)
   └─ scripts/rollback-migration.ts (Rollback script)
   └─ scripts/validate-migration.ts (Validation script)

4. Updated API Routes:
   └─ app/api/products/route.ts (Firebase)
   └─ app/api/orders/route.ts (Firebase)
   └─ app/api/customers/route.ts (Firebase)
   └─ app/api/inventory/route.ts (Firebase)

5. Testing:
   └─ tests/firebase-db.test.ts (Unit tests)
   └─ tests/firebase-auth.test.ts (Auth tests)
   └─ tests/firebase-integration.test.ts (Integration tests)

6. Documentation:
   └─ FIREBASE_SETUP.md (Setup guide)
   └─ FIREBASE_ARCHITECTURE.md (Architecture)
   └─ FIREBASE_MIGRATION.md (Migration guide)
   └─ FIREBASE_SECURITY_RULES.md (Rules documentation)

SUCCESS CRITERIA:
✅ All 13 collections created in Firestore
✅ All relationships maintained with document references
✅ Security rules enforced for all access patterns
✅ Authentication integrated with Firebase Auth
✅ All API routes working with Firebase SDK
✅ Real-time updates working where applicable
✅ Migration script tested and verified
✅ All tests passing (>85% coverage)
✅ Performance comparable to Postgres
✅ No data loss during migration
✅ Complete documentation provided
✅ Team trained on Firebase approach

TECHNICAL DECISIONS TO MAKE:

1. Collection Structure:
   Decision: Use subcollections for hierarchical data
   Reason: Maintains relationships and enables scoped queries

2. Authentication:
   Decision: Firebase Auth + custom user claims for roles
   Reason: Integrates with Firestore security rules

3. Real-time:
   Decision: Use Firestore listeners for dashboard updates
   Reason: Better UX, reduces polling

4. Offline:
   Decision: Enable Firestore offline persistence
   Reason: Better mobile/offline support

5. Indexes:
   Decision: Auto-generate indexes for common queries
   Reason: Firestore handles automatically

KNOWN LIMITATIONS & SOLUTIONS:

1. Transaction Size:
   - Limitation: Firestore has 500 write limit per transaction
   - Solution: Batch operations with error recovery

2. Query Complexity:
   - Limitation: Can't use all SQL operators
   - Solution: Design collections for common queries

3. Consistency:
   - Limitation: Eventually consistent for reads
   - Solution: Use transactions for critical operations

4. Cost:
   - Limitation: Pay per read/write/delete
   - Solution: Optimize queries and use caching

ROLLBACK STRATEGY:
- Keep Supabase instance running during transition
- Run migration in parallel environment first
- Validate all data before switching
- Have rollback script ready (15 min to rollback)
- Monitor for 24 hours post-migration
- Keep Supabase backup for 30 days

START EXECUTION NOW:
Begin with PHASE 1 and work through systematically.
Report progress after each phase.
Ask for clarification only if truly needed.
Focus on completeness and correctness.
Maintain all existing functionality.
```

---

## IMPLEMENTATION CHECKLIST

### Phase 1: Firebase Setup

```
Firebase Project Creation:
□ Create Firebase project at console.firebase.google.com
□ Enable Firestore Database
□ Set location (us-central1 recommended)
□ Enable Firebase Authentication
□ Enable Firebase Storage
□ Create service account key
□ Copy Firebase config

Firebase Credentials Needed:
□ apiKey
□ authDomain
□ projectId
□ storageBucket
□ messagingSenderId
□ appId
```

### Phase 2: Collection Structure

```
Firestore Collections:
□ companies (root)
□ companies/{companyId}/users
□ companies/{companyId}/products
□ companies/{companyId}/products/{productId}/variants
□ companies/{companyId}/customers
□ companies/{companyId}/customers/{customerId}/addresses
□ companies/{companyId}/orders
□ companies/{companyId}/orders/{orderId}/items
□ companies/{companyId}/warehouses
□ companies/{companyId}/warehouses/{warehouseId}/inventory
□ companies/{companyId}/audit_logs
□ companies/{companyId}/webhooks
□ companies/{companyId}/webhooks/{webhookId}/logs
```

### Phase 3: Security Rules

```
Firestore Rules to Implement:
□ User authentication check
□ Company-level data isolation
□ Role-based access (admin, manager, staff, viewer)
□ Read-only for audit logs
□ Write protection for sensitive fields
□ Delete permissions based on role
```

### Phase 4: Code Updates

```
Files to Create:
□ lib/firebase-config.ts
□ lib/firebase-db.ts
□ lib/firebase-auth.ts
□ lib/firebase-utils.ts
□ types/firebase.ts
□ scripts/migrate-from-supabase.ts
□ scripts/validate-migration.ts

Files to Update:
□ app/api/products/route.ts
□ app/api/orders/route.ts
□ app/api/customers/route.ts
□ app/api/inventory/route.ts
□ hooks/useAuth.ts
□ hooks/useApi.ts
□ middleware.ts
```

### Phase 5: Testing

```
Tests to Write:
□ Firebase connection
□ Authentication flows
□ CRUD operations
□ Security rules
□ Real-time updates
□ Error handling
□ Performance benchmarks
```

---

## KEY FILES TO CREATE

### 1. lib/firebase-config.ts

```typescript
// Firebase initialization
// Import and configure Firebase SDKs
// Export initialized services
```

### 2. lib/firebase-db.ts

```typescript
// Database operations
// Collection references
// CRUD helpers
// Query builders
// Transaction management
```

### 3. lib/firebase-auth.ts

```typescript
// Authentication
// User management
// Role handling
// Session management
```

### 4. scripts/migrate-from-supabase.ts

```typescript
// Migration logic
// Extract from Postgres
// Transform data
// Write to Firestore
// Validate
```

---

## ENVIRONMENT VARIABLES NEEDED

```bash
# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=xxxxx
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=xxxxx
NEXT_PUBLIC_FIREBASE_PROJECT_ID=xxxxx
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=xxxxx
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=xxxxx
NEXT_PUBLIC_FIREBASE_APP_ID=xxxxx

# Service Account (for server-side operations)
FIREBASE_SERVICE_ACCOUNT_KEY=xxxxx (JSON file)
```

---

## EXPECTED OUTCOME

After completing all phases:

✅ **Database Layer:**

- All 13 collections in Firestore
- Proper relationships with document references
- Indexed for performance
- Security rules in place

✅ **Authentication:**

- Firebase Auth integrated
- Custom claims for roles
- Session management
- Permission enforcement

✅ **API Integration:**

- All routes use Firebase SDK
- Real-time updates working
- Offline persistence enabled
- Error handling implemented

✅ **Testing:**

- > 85% code coverage
- All tests passing
- Performance verified
- Security validated

✅ **Documentation:**

- Complete setup guide
- Architecture documentation
- Migration procedures
- Troubleshooting guide

✅ **Migration:**

- Scripts ready to run
- Zero data loss
- Rollback plan ready
- Team trained

---

## COMMAND TO START CLAUDE EXTENSION

```bash
# Once ready, run:
claude --use-firebase --setup-phase-1 --ecommerce-erp

# Or provide this prompt to Claude Extension directly:
# "Use the FIREBASE_DATABASE_SETUP_PROMPT.md to convert the ERP
# database from Supabase to Firebase. Execute all phases in order."
```

---

## NEXT STEPS

1. **Prepare:** Set up Firebase project
2. **Install:** Add Firebase SDKs to package.json
3. **Execute:** Run this prompt with Claude Extension
4. **Migrate:** Run migration scripts on copy of data
5. **Validate:** Verify all data and functions
6. **Deploy:** Switch to Firebase gradually
7. **Monitor:** Track performance and issues

---

**Total Implementation Time:** 4-6 hours

**Status:** Ready for Claude Extension to execute

🔥 **Begin Firebase Database Migration** 🔥
