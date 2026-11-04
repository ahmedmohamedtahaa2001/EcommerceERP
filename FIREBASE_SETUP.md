# 🔥 Firebase Setup Guide - Phase 1

## Step 1: Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click **"Create a project"**
3. Enter project name: `operix-erp` (or your preferred name)
4. Accept the terms and **Create project**
5. Wait for project to be ready

## Step 2: Enable Required Services

### Firestore Database
1. In Firebase Console, go to **Build** → **Firestore Database**
2. Click **Create database**
3. Select: **Start in production mode**
4. Select location: **us-central1** (or closest to you)
5. Click **Create**

### Firebase Authentication
1. Go to **Build** → **Authentication**
2. Click **Get started**
3. Enable **Email/Password** provider:
   - Click **Email/Password**
   - Toggle **Enable**
   - Click **Save**

### Firebase Storage
1. Go to **Build** → **Storage**
2. Click **Get started**
3. Accept default security rules
4. Choose location: **us-central1** (match Firestore)
5. Click **Done**

## Step 3: Get Firebase Config

1. Go to **Project Settings** (⚙️ icon, top right)
2. Under **Your apps**, click **Web** icon (if none, create one)
3. Copy the Firebase config object:

```javascript
{
  "apiKey": "YOUR_API_KEY",
  "authDomain": "your-project.firebaseapp.com",
  "projectId": "your-project-id",
  "storageBucket": "your-project.appspot.com",
  "messagingSenderId": "YOUR_SENDER_ID",
  "appId": "YOUR_APP_ID"
}
```

## Step 4: Create Service Account Key

1. Still in **Project Settings**, go to **Service accounts** tab
2. Click **Generate New Private Key**
3. Save the JSON file safely: `firebase-service-account.json`
4. ⚠️ **KEEP THIS SECRET** - Add to `.gitignore`

## Step 5: Update Environment Variables

Add to your `.env.local`:

```bash
# Firebase Public Config
NEXT_PUBLIC_FIREBASE_API_KEY=YOUR_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=YOUR_SENDER_ID
NEXT_PUBLIC_FIREBASE_APP_ID=YOUR_APP_ID

# Firebase Admin SDK (Server-side only)
FIREBASE_SERVICE_ACCOUNT_KEY=/path/to/firebase-service-account.json

# Keep Supabase for fallback during migration
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## Step 6: Install Firebase SDKs

```bash
npm install firebase firebase-admin
```

## Step 7: Setup Firestore Indexes

After running migration scripts, Firestore will suggest creating indexes.
- Go to **Firestore Database** → **Indexes**
- Create any suggested indexes

## Step 8: Verify Setup

After creating the config files, run:

```bash
npm run test:firebase-setup
```

---

## Troubleshooting

### "Firestore is not initialized"
- Check all Firebase config variables are set in `.env.local`
- Verify `NEXT_PUBLIC_*` variables are accessible from browser

### "Authentication failed"
- Ensure Firebase Authentication is enabled
- Check email/password provider is turned on

### "Storage error"
- Verify Storage bucket is created
- Check security rules in `storage.rules`

---

## ✅ Checklist

- [ ] Firebase project created
- [ ] Firestore Database enabled
- [ ] Authentication enabled
- [ ] Storage enabled
- [ ] Service account key generated
- [ ] Config variables in `.env.local`
- [ ] Firebase SDKs installed
- [ ] Setup verified

**Once complete, come back and paste your Firebase config credentials.**
