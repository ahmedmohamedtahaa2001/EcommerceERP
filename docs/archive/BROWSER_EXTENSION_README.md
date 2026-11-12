# Claude Browser Extension - Firebase Setup Guide

## 📋 Files to Use with Browser Extension

I've created 4 files for you to use with the Claude Browser Extension to build your complete Firebase database:

### 1. **FIREBASE_BROWSER_PROMPT.txt** ⭐ START HERE

**What it does:** Main detailed prompt with all requirements and specifications

**How to use:**

1. Copy the entire contents of `FIREBASE_BROWSER_PROMPT.txt`
2. Open Claude Browser Extension
3. Paste it into the chat
4. Let Claude guide you through the setup

**What you'll get:**

- Step-by-step Firebase project creation
- Detailed collection schema
- Sample data to add
- Security rules
- Index configuration

---

### 2. **FIREBASE_BROWSER_SETUP.md**

**What it does:** Detailed markdown guide with exact instructions

**How to use:**

- Reference document for detailed schema
- Follow along with Browser Extension guidance
- Copy exact field names and data types

**Contains:**

- Collection schemas with field descriptions
- Sample data in JavaScript format
- Index creation instructions
- Security rules
- Environment variables template

---

### 3. **firebase-schema.json**

**What it does:** Machine-readable schema specification

**Use when:**

- Browser Extension asks for specific data types
- You need to verify field names
- Setting up collections manually

**Contains:**

- All 7 collections with complete schema
- Field types and requirements
- Relationships between collections
- Multi-tenancy pattern
- Index definitions

---

### 4. **firestore-rules.txt**

**What it does:** Security rules ready to copy-paste

**How to use:**

1. After creating collections
2. Go to Firestore → Rules tab
3. Replace ALL rules with content from this file
4. Paste into Firebase Console
5. Click "Publish"

**Contains:**

- Multi-tenant isolation rules
- Read/write permissions
- Company-level data isolation
- Audit trail immutability

---

## 🚀 Step-by-Step Workflow

### Phase 1: Create Firebase Project

```
File: FIREBASE_BROWSER_SETUP.md (Step 1-2)
Action:
1. Copy STEP 1 section
2. Paste in Browser Extension
3. Follow Claude's guidance
4. Save the Firebase config
```

### Phase 2: Create Collections & Schema

```
File: FIREBASE_BROWSER_SETUP.md (Step 3)
Reference: firebase-schema.json
Action:
1. Copy STEP 3 section with collection schemas
2. Let Claude guide you through creating each one
3. Use firebase-schema.json for exact field definitions
4. Verify each collection is created
```

### Phase 3: Add Sample Data

```
File: FIREBASE_BROWSER_SETUP.md (Step 4)
Action:
1. Copy sample data code
2. Replace placeholder IDs (COMPANY_ID, PRODUCT_ID, etc.)
3. Paste in Firebase Console
4. Run to populate test data
```

### Phase 4: Create Indexes

```
File: FIREBASE_BROWSER_SETUP.md (Step 5)
Action:
1. Copy index definitions
2. Let Claude guide you creating each one
3. Wait for indexes to build (usually 1-5 minutes each)
```

### Phase 5: Set Security Rules

```
File: firestore-rules.txt
Action:
1. Go to Firestore → Rules tab
2. Copy ALL content from firestore-rules.txt
3. Paste and replace existing rules
4. Click "Publish"
```

### Phase 6: Get Credentials

```
File: FIREBASE_BROWSER_SETUP.md (Step 7)
Action:
1. Copy .env.local template
2. Get Firebase config from Console
3. Get Service Account Key JSON
4. Save both securely
```

---

## 📊 What You'll Have After Setup

✅ **7 Collections**

- companies
- warehouses
- products
- inventory
- stock_movements
- users
- audit_logs

✅ **Multi-Tenant Database**

- Company-level isolation
- Secure data boundaries
- RBAC ready

✅ **Production Features**

- Optimized indexes
- Security rules
- Audit trail
- Immutable logs

✅ **API Ready**

- Complete schema for Next.js APIs
- Sample data for testing
- Proper relationships
- Type-safe structure

---

## 💾 Credentials to Save

After setup, you'll have:

```
✅ Firebase API Key
✅ Auth Domain
✅ Project ID
✅ Storage Bucket
✅ Messaging Sender ID
✅ App ID
✅ Service Account Key (JSON)
```

**Save as:**

- `.env.local` in project root
- `firebase-service-account.json` in project root (backend use only)

---

## 🎯 Quick Reference

| File                        | Purpose        | When to Use             |
| --------------------------- | -------------- | ----------------------- |
| FIREBASE_BROWSER_PROMPT.txt | Main guidance  | Start here              |
| FIREBASE_BROWSER_SETUP.md   | Detailed steps | Reference guide         |
| firebase-schema.json        | Schema spec    | Field definitions       |
| firestore-rules.txt         | Security rules | After collections ready |

---

## ⚡ Browser Extension Tips

1. **Copy in sections** - Don't paste 10,000 words at once
2. **Ask Claude to verify** - Have it confirm each step completed
3. **Save progress** - Note IDs created (company ID, warehouse ID, etc.)
4. **Use exact names** - Copy collection/field names exactly from schema
5. **Test as you go** - Create one collection, add data, then next

---

## ✅ Verification Checklist

After setup, verify:

- [ ] Firebase project exists
- [ ] Firestore database active
- [ ] All 7 collections created
- [ ] Sample data in each collection
- [ ] Indexes created and ready
- [ ] Security rules published
- [ ] Can access Firebase Console
- [ ] API keys saved in `.env.local`
- [ ] Service Account JSON saved securely
- [ ] Ready to connect Next.js app

---

## 🔗 Connection to Next.js App

Once setup complete:

```bash
1. Add .env.local variables
2. Run: npm run dev
3. Visit: http://localhost:3000/inventory-v2
4. Test with sample data
```

---

## 📞 Need Help?

If Browser Extension needs clarification:

1. Reference the exact collection name from **firebase-schema.json**
2. Copy field definitions from **FIREBASE_BROWSER_SETUP.md**
3. Use **firestore-rules.txt** for security questions
4. Check **FIREBASE_BROWSER_SETUP.md** for sample data

---

## 🎉 You're Ready!

All the information Claude needs to build your database is in these 4 files. Just follow the workflow above and let the Browser Extension guide you through each step.

**Start with: FIREBASE_BROWSER_PROMPT.txt**

Happy building! 🚀
