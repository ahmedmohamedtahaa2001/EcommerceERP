# Firebase Setup - Quick Start

## 1. Create Firebase Project
- Go to firebase.google.com/console
- Create new project: "operix-erp"
- Enable Firestore Database (test mode)

## 2. Get Config from Firebase Console
- Project Settings → Web App
- Copy API key, Project ID, Auth Domain, etc.

## 3. Add to .env.local
```
NEXT_PUBLIC_FIREBASE_API_KEY=your_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

## 4. Create Firestore Collections
- inventory
- warehouses
- stock_movements
- products
- orders
- customers

## 5. Test
```bash
npm run build
npm run dev
```

## APIs Ready
- `/api/inventory` - CRUD inventory
- `/api/inventory/adjust` - Stock adjustments
- `/api/inventory/transfer` - Transfer stock
- `/api/inventory/movements` - Audit trail
- `/api/warehouses` - Warehouse management
