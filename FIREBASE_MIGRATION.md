# Firebase Migration Guide

Complete step-by-step guide for migrating from Supabase PostgreSQL to Firebase Firestore.

## Pre-Migration Checklist

- [ ] Firebase project created
- [ ] Firestore Database enabled (production mode)
- [ ] Firebase Authentication enabled
- [ ] Firebase Storage enabled
- [ ] Service account key generated
- [ ] Environment variables configured (.env.local)
- [ ] Firebase SDKs installed (`npm install firebase firebase-admin`)
- [ ] Backup of Supabase database created
- [ ] Team notified of migration
- [ ] Maintenance window scheduled (optional downtime minimized)

## Phase 1: Preparation (1-2 hours)

### Step 1.1: Create Backup of Supabase Data

```bash
# Export Supabase data to local SQL backup
pg_dump --host=$DB_HOST --username=$DB_USER --password $DB_NAME > backup.sql

# Or use Supabase CLI
supabase db pull
```

### Step 1.2: Verify Firebase Setup

```bash
# Test Firebase config
npm run test:firebase-setup

# Expected output:
# ✓ Firebase initialized
# ✓ Firestore connected
# ✓ Authentication enabled
# ✓ Storage connected
```

### Step 1.3: Review Security Rules

1. Go to Firebase Console → Firestore → Rules
2. Review [firestore.rules](./firestore.rules)
3. Verify role-based access control is appropriate for your needs

## Phase 2: Running Migration (30-45 minutes)

### Step 2.1: Install Dependencies

```bash
npm install firebase firebase-admin @supabase/supabase-js
```

### Step 2.2: Configure Migration Script

Ensure these environment variables are set:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Firebase
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
FIREBASE_SERVICE_ACCOUNT_KEY=/path/to/firebase-service-account.json
```

### Step 2.3: Run Migration

```bash
# Test migration on sample data first (recommended)
npm run migrate:test

# Run full migration (this will take 5-30 minutes depending on data size)
npm run migrate:full

# Expected output:
# 🚀 Starting Firebase migration from Supabase...
# ✓ Migrated companies: 5 records
# ✓ Migrated users: 25 records
# ✓ Migrated products: 150 records
# ... (more tables)
# ✅ Migration complete!
```

### Step 2.4: Validate Migration

```bash
# Run validation script
npm run migrate:validate

# Expected output:
# ✓ Companies: 5/5 records migrated
# ✓ Users: 25/25 records migrated
# ✓ Products: 150/150 records migrated
# ... (all tables)
# ✅ All data successfully migrated!
```

## Phase 3: Code Updates (2-3 hours)

### Step 3.1: Update API Routes

Replace all API route files with Firebase versions:

```bash
# Products API
cp app/api/products/route.firebase.ts app/api/products/route.ts

# Orders API
cp app/api/orders/route.firebase.ts app/api/orders/route.ts

# Customers API
cp app/api/customers/route.firebase.ts app/api/customers/route.ts

# ... (repeat for all API routes)
```

### Step 3.2: Update Imports

Replace all Supabase imports:

```typescript
// Before
import { supabase, supabaseAdmin } from '@/lib/supabase';

// After
import { auth, db } from '@/lib/firebase-config';
import { getDocument, setDocument, getDocuments } from '@/lib/firebase-db';
import { getCurrentUserAsync, getUserRole } from '@/lib/firebase-auth';
```

### Step 3.3: Update Middleware/Auth

Update `middleware.ts` to use Firebase Auth:

```typescript
import { auth } from '@/lib/firebase-config';

export async function middleware(request: NextRequest) {
  const user = await getCurrentUserAsync();
  if (!user && isProtectedRoute(request.pathname)) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
}
```

### Step 3.4: Update React Hooks

Update `hooks/useAuth.ts`:

```typescript
import { onAuthChange, getCurrentUserAsync } from '@/lib/firebase-auth';

export function useAuth() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthChange(setUser);
    return unsubscribe;
  }, []);

  return { user };
}
```

## Phase 4: Testing (1-2 hours)

### Step 4.1: Run Test Suite

```bash
# Unit tests
npm run test

# Integration tests
npm run test:integration

# E2E tests
npm run test:e2e

# All tests
npm run test:full
```

### Step 4.2: Manual Testing

Test critical workflows:

- [ ] User login/logout
- [ ] Create product
- [ ] Create order
- [ ] Update inventory
- [ ] View reports/analytics
- [ ] Download/export data

### Step 4.3: Performance Testing

```bash
# Benchmark common queries
npm run test:performance

# Check document read/write counts
# Go to Firebase Console → Usage tab
```

## Phase 5: Deployment (1-2 hours)

### Step 5.1: Deploy to Staging

```bash
# Build for staging
npm run build

# Deploy to Vercel staging
vercel --prod --env staging

# Run smoke tests
npm run test:smoke
```

### Step 5.2: Update Production Environment

```bash
# Update .env.production with Firebase config
NEXT_PUBLIC_FIREBASE_PROJECT_ID=production-project-id
# ... (all Firebase env vars)

# Optionally keep Supabase for fallback
NEXT_PUBLIC_SUPABASE_URL=backup-url
SUPABASE_SERVICE_ROLE_KEY=backup-key
```

### Step 5.3: Deploy to Production

```bash
# Create release tag
git tag -a v2.0-firebase -m "Firebase migration release"

# Deploy
vercel --prod

# Monitor deployment
firebase_console_url/overview
```

## Phase 6: Post-Migration (Ongoing)

### Step 6.1: Monitor Performance

```bash
# Check Firestore metrics
# Firebase Console → Usage tab → Filter by date

# Key metrics to watch:
# - Read/Write count (should match expected usage)
# - Storage size
# - Document count per collection
```

### Step 6.2: Optimize Queries

If you notice high read counts:

1. Review slow queries in Cloud Logging
2. Add missing indexes
3. Implement caching for frequently accessed data
4. Consider read/write reduction opportunities

### Step 6.3: Archive Old Data (Optional)

After migration succeeds, optionally archive Supabase data:

```bash
# Export to cold storage
pg_dump --host=$DB_HOST --username=$DB_USER $DB_NAME | \
  gzip > supabase-archive-$(date +%Y%m%d).sql.gz

# Upload to Cloud Storage
gsutil cp supabase-archive-*.sql.gz gs://archive-bucket/

# Keep Supabase running for 30 days as fallback
# Then: Delete Supabase project
```

## Rollback Procedure (If Needed)

If critical issues occur after migration:

### Rollback to Supabase (within 30 days)

```bash
# Step 1: Update environment to use Supabase
NEXT_PUBLIC_SUPABASE_URL=restore-url
SUPABASE_SERVICE_ROLE_KEY=restore-key
# Comment out Firebase vars

# Step 2: Update API routes back to Supabase
git checkout supabase-backup -- app/api/

# Step 3: Redeploy
git push
vercel --prod

# Step 4: Verify rollback
npm run test:integration
```

### Data Sync During Rollback
During rollback, ensure Supabase data is up-to-date:

```bash
# If Supabase was kept current during transition:
# Just switch config and redeploy

# If Supabase data is stale:
# 1. Stop Firebase operations
# 2. Export latest data from Firebase
# 3. Import into Supabase
# 4. Switch config
# 5. Redeploy
```

## Troubleshooting

### Issue: "Firestore is not initialized"

**Solution:**
```bash
# Check environment variables
echo $NEXT_PUBLIC_FIREBASE_PROJECT_ID

# Verify .env.local has all Firebase vars
grep FIREBASE .env.local

# Rebuild and restart dev server
npm run build
npm run dev
```

### Issue: "Authentication failed"

**Solution:**
```bash
# Verify Firebase Auth is enabled
firebase_console_url/authentication/providers

# Check email/password provider is enabled

# Clear browser storage and retry login
localStorage.clear()
```

### Issue: "High read/write costs"

**Solution:**
1. Review query patterns in `lib/firebase-db.ts`
2. Add pagination to list queries
3. Implement result caching:
   ```typescript
   import { useQuery } from '@tanstack/react-query';
   
   const { data } = useQuery({
     queryKey: ['products', companyId],
     queryFn: () => getProducts(companyId),
     staleTime: 5 * 60 * 1000, // Cache 5 minutes
   });
   ```

### Issue: "Security rule denying access"

**Solution:**
1. Check `firestore.rules` for role-based restrictions
2. Verify user's company ID matches resource's company ID
3. Check user's role in Firestore (admin/manager/staff/viewer)
4. Review audit logs for denied access attempts

## Performance Baseline

After migration, compare these metrics:

| Metric | Supabase | Firebase | Target |
|--------|----------|----------|--------|
| Products list load time | 200ms | <150ms | <150ms |
| Create order | 150ms | <100ms | <100ms |
| Search functionality | 300ms | 200-500ms* | <500ms |
| Concurrent users | 50 | Unlimited | Unlimited |
| Monthly cost | $X | $Y | Optimize |

*Firebase client-side search is slower; consider Algolia for production

## Support & Resources

- [Firestore Documentation](https://firebase.google.com/docs/firestore)
- [Firebase CLI Reference](https://firebase.google.com/docs/cli)
- [Firestore Best Practices](https://firebase.google.com/docs/firestore/best-practices)
- [Security Rules Guide](https://firebase.google.com/docs/rules)

## Success Criteria

✅ Migration is successful when:

- All 13 collections created in Firestore
- All data migrated without loss
- Security rules enforced correctly
- All API routes working with Firebase
- Tests passing (>85% coverage)
- Performance metrics acceptable
- Team trained on Firebase
- Supabase safely archived

---

**Migration Date**: [Your Date]
**Migration Duration**: [Actual Time]
**Data Integrity**: ✓ Verified
**Team Sign-off**: [ ] Ready for production

---

For questions or issues, refer to [FIREBASE_ARCHITECTURE.md](./FIREBASE_ARCHITECTURE.md) and [FIREBASE_SETUP.md](./FIREBASE_SETUP.md).
