# 🚀 PHASE 2 EXECUTION GUIDE - Week by Week

**Focus:** Complete Frontend + Real-Time Features  
**Duration:** 2-4 weeks  
**Start:** Now  
**Target:** Full-featured, production ERP

---

## ⚡ PHASE 2 QUICK START (Next 30 Minutes)

### 1. Install Dependencies
```bash
cd /Users/ahmedaboelsnoon/Desktop/PROjects/ERP

# Core UI/Form libraries
npm install react-hook-form zod @hookform/resolvers zustand

# Data fetching & caching
npm install @tanstack/react-query axios

# Real-time
npm install socket.io-client

# Charts & Analytics
npm install recharts

# Notifications
npm install react-hot-toast sonner

# Additional utilities
npm install clsx tailwind-merge date-fns

# Dev dependencies
npm install -D @types/node @types/react
```

### 2. Verify Build Still Works
```bash
npm run build
npm run dev
```

### 3. Start Development
```bash
npm run dev
# Open http://localhost:3000 in browser
```

---

## 📅 WEEK 1: FRONTEND FOUNDATION

### Day 1-2: Project Setup & Hooks

#### Task 1.1: Create API Client Hook
**File:** `lib/hooks/useApi.ts`
```typescript
import { useQuery, useMutation } from '@tanstack/react-query';

// Generic hook for GET requests
export function useApiData<T>(
  endpoint: string,
  options?: any
) {
  return useQuery({
    queryKey: [endpoint],
    queryFn: async () => {
      const response = await fetch(`/api${endpoint}`);
      if (!response.ok) throw new Error('API error');
      return response.json();
    },
    ...options
  });
}

// Generic hook for POST/PUT/DELETE
export function useApiMutation(method = 'POST') {
  return useMutation({
    mutationFn: async ({ endpoint, data }) => {
      const response = await fetch(`/api${endpoint}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error('API error');
      return response.json();
    }
  });
}
```

**Time:** 2-3 hours

#### Task 1.2: Create State Management
**File:** `lib/store/useAppStore.ts`
```typescript
import { create } from 'zustand';

interface AppState {
  selectedOrgId?: string;
  setSelectedOrgId: (id: string) => void;
  
  filters: Record<string, any>;
  setFilters: (filters: Record<string, any>) => void;
  
  notifications: Notification[];
  addNotification: (notification: Notification) => void;
  removeNotification: (id: string) => void;
}

export const useAppStore = create<AppState>((set) => ({
  selectedOrgId: undefined,
  setSelectedOrgId: (id) => set({ selectedOrgId: id }),
  
  filters: {},
  setFilters: (filters) => set({ filters }),
  
  notifications: [],
  addNotification: (notification) => set((state) => ({
    notifications: [...state.notifications, notification]
  })),
  removeNotification: (id) => set((state) => ({
    notifications: state.notifications.filter(n => n.id !== id)
  }))
}));
```

**Time:** 2-3 hours

#### Task 1.3: Create Reusable Table Component
**File:** `components/tables/DataTable.tsx`
```typescript
import React from 'react';
import { useState } from 'react';

interface Column<T> {
  key: keyof T;
  label: string;
  sortable?: boolean;
  render?: (value: any, row: T) => React.ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  isLoading: boolean;
  onEdit?: (item: T) => void;
  onDelete?: (item: T) => void;
}

export function DataTable<T>({
  columns,
  data,
  isLoading,
  onEdit,
  onDelete
}: DataTableProps<T>) {
  const [sortBy, setSortBy] = useState<keyof T | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Implement sorting, pagination, etc.
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b">
            {columns.map((col) => (
              <th key={String(col.key)} className="text-left p-4 font-semibold">
                {col.sortable ? (
                  <button onClick={() => {
                    setSortBy(col.key);
                    setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                  }}>
                    {col.label} {sortBy === col.key && (sortOrder === 'asc' ? '↑' : '↓')}
                  </button>
                ) : (
                  col.label
                )}
              </th>
            ))}
            <th className="text-left p-4">Actions</th>
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            <tr><td colSpan={columns.length + 1} className="p-4 text-center">Loading...</td></tr>
          ) : data.length === 0 ? (
            <tr><td colSpan={columns.length + 1} className="p-4 text-center">No data</td></tr>
          ) : (
            data.map((row, idx) => (
              <tr key={idx} className="border-b hover:bg-gray-50">
                {columns.map((col) => (
                  <td key={String(col.key)} className="p-4">
                    {col.render ? col.render(row[col.key], row) : String(row[col.key])}
                  </td>
                ))}
                <td className="p-4">
                  {onEdit && <button onClick={() => onEdit(row)} className="mr-2">Edit</button>}
                  {onDelete && <button onClick={() => onDelete(row)} className="text-red-600">Delete</button>}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
```

**Time:** 4-5 hours

**Total Day 1-2:** 8-11 hours

### Day 3-4: Connect First Pages

#### Task 1.4: Wire Inventory List Page
**File:** `app/dashboard/inventory/page.tsx`
```typescript
'use client';

import { useState } from 'react';
import { DataTable } from '@/components/tables/DataTable';
import { useApiData } from '@/lib/hooks/useApi';

export default function InventoryPage() {
  const { data, isLoading } = useApiData('/inventory?page=0&pageSize=20');
  
  return (
    <div className="p-6">
      <div className="flex justify-between mb-6">
        <h1 className="text-3xl font-bold">Inventory</h1>
        <button className="bg-blue-600 text-white px-4 py-2 rounded">
          Add Item
        </button>
      </div>
      
      <DataTable
        columns={[
          { key: 'name', label: 'Product', sortable: true },
          { key: 'sku', label: 'SKU', sortable: true },
          { key: 'quantity', label: 'Quantity', sortable: true },
          { key: 'warehouse_id', label: 'Warehouse' },
          { key: 'created_at', label: 'Created', sortable: true },
        ]}
        data={data?.data || []}
        isLoading={isLoading}
        onEdit={(item) => console.log('Edit', item)}
        onDelete={(item) => console.log('Delete', item)}
      />
    </div>
  );
}
```

**Time:** 2-3 hours

#### Task 1.5: Repeat for Products
**File:** `app/dashboard/products/page.tsx`
- Same pattern as inventory
- Connect to GET /api/products

**Time:** 1-2 hours

#### Task 1.6: Repeat for Orders
**File:** `app/dashboard/orders/page.tsx`
- Connect to GET /api/orders
- Display order details

**Time:** 1-2 hours

#### Task 1.7: Repeat for Customers
**File:** `app/dashboard/customers/page.tsx`
- Connect to GET /api/customers
- Show customer contact info

**Time:** 1-2 hours

#### Task 1.8: Repeat for Warehouses
**File:** `app/dashboard/warehouses/page.tsx`
- Connect to GET /api/warehouses
- Show warehouse capacity

**Time:** 1-2 hours

**Total Day 3-4:** 7-12 hours

### Day 5: Forms & Modals

#### Task 1.9: Create Generic Form Component
**File:** `components/forms/FormBuilder.tsx`
```typescript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ZodSchema } from 'zod';

export function FormBuilder<T>({
  schema,
  onSubmit,
  fields
}: {
  schema: ZodSchema;
  onSubmit: (data: T) => void;
  fields: Array<{ name: string; label: string; type: string; placeholder?: string }>;
}) {
  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(schema)
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {fields.map(field => (
        <div key={field.name}>
          <label className="block text-sm font-medium mb-1">{field.label}</label>
          <input
            {...register(field.name)}
            type={field.type}
            placeholder={field.placeholder}
            className="w-full border rounded px-3 py-2"
          />
          {errors[field.name as keyof typeof errors] && (
            <span className="text-red-600 text-sm">
              {String(errors[field.name as keyof typeof errors]?.message)}
            </span>
          )}
        </div>
      ))}
      <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded w-full">
        Submit
      </button>
    </form>
  );
}
```

**Time:** 3-4 hours

#### Task 1.10: Add Create/Edit Modals
**File:** `components/modals/EntityModal.tsx`
- Generic modal component
- Wraps form builder
- Handles create/edit flows

**Time:** 2-3 hours

**Total Day 5:** 5-7 hours

**WEEK 1 TOTAL:** 20-30 hours

---

## 📅 WEEK 2: REAL-TIME FEATURES

### Day 1-2: WebSocket Setup

#### Task 2.1: Create WebSocket Endpoint
**File:** `app/api/ws/route.ts`
```typescript
import { WebSocketServer } from 'ws';
import type { NextApiRequest, NextApiResponse } from 'next';

export async function GET(req: NextApiRequest, res: NextApiResponse) {
  if (req.headers.upgrade !== 'websocket') {
    return res.status(400).json({ error: 'Expected websocket upgrade' });
  }

  // WebSocket server logic
  const wss = new WebSocketServer({ noServer: true });

  wss.on('connection', (ws) => {
    console.log('Client connected');

    // Broadcast inventory updates
    // Listen for database changes
    // Send to all clients

    ws.on('close', () => {
      console.log('Client disconnected');
    });
  });

  // Upgrade connection
  const socket = ws || null;
  // ...
}
```

**Time:** 4-5 hours

#### Task 2.2: Create WebSocket Hook
**File:** `lib/hooks/useRealTime.ts`
```typescript
import { useEffect, useState } from 'react';

export function useRealTime<T>(channel: string) {
  const [data, setData] = useState<T | null>(null);
  const [isLive, setIsLive] = useState(false);

  useEffect(() => {
    const ws = new WebSocket(`ws://localhost:3000/api/ws?channel=${channel}`);

    ws.onopen = () => {
      setIsLive(true);
      console.log(`Connected to ${channel}`);
    };

    ws.onmessage = (event) => {
      const newData = JSON.parse(event.data);
      setData(newData);
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setIsLive(false);
    };

    return () => {
      ws.close();
    };
  }, [channel]);

  return { data, isLive };
}
```

**Time:** 3-4 hours

**Total Day 1-2:** 7-9 hours

### Day 3-4: Real-Time Syncing

#### Task 2.3: Implement Real-Time Inventory
- Update Inventory page to use useRealTime hook
- Show live stock changes
- Highlight updated items

**Time:** 3-4 hours

#### Task 2.4: Implement Real-Time Orders
- Update Orders page with live status updates
- Highlight new orders
- Real-time total updates

**Time:** 2-3 hours

#### Task 2.5: Implement Real-Time Products
- Live price updates
- New product notifications
- Stock changes reflected immediately

**Time:** 2-3 hours

**Total Day 3-4:** 7-10 hours

### Day 5: Notifications

#### Task 2.6: Add Toast Notifications
```typescript
import { toast } from 'react-hot-toast';

// On real-time update
toast.success('Inventory updated!');
toast.error('Failed to update');
toast.loading('Updating...');
```

**Time:** 2-3 hours

#### Task 2.7: Add Notification Center
- Bell icon with notification count
- Show recent notifications
- Mark as read/unread

**Time:** 3-4 hours

**WEEK 2 TOTAL:** 16-25 hours

---

## 📅 WEEK 3: ANALYTICS & POLISH

### Day 1-2: Analytics Dashboard

#### Task 3.1: Create Dashboard Page
**File:** `app/dashboard/analytics/page.tsx`
```typescript
'use client';

import { LineChart, BarChart, PieChart } from 'recharts';

export default function AnalyticsPage() {
  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Analytics</h1>
      
      <div className="grid grid-cols-4 gap-4 mb-6">
        <MetricCard title="Total Revenue" value="$XX,XXX" change="+12%" />
        <MetricCard title="Total Orders" value="XXX" change="+8%" />
        <MetricCard title="Total Inventory" value="XXX items" change="-3%" />
        <MetricCard title="Active Customers" value="XXX" change="+15%" />
      </div>

      <div className="grid grid-cols-2 gap-6">
        <ChartCard title="Order Trends" chart={<LineChart />} />
        <ChartCard title="Product Sales" chart={<BarChart />} />
        <ChartCard title="Warehouse Distribution" chart={<PieChart />} />
        <ChartCard title="Inventory Health" chart={<BarChart />} />
      </div>
    </div>
  );
}
```

**Time:** 5-6 hours

#### Task 3.2: Create Metric Cards
- Revenue, Orders, Inventory, Customers
- Show trends (up/down)
- Last 30-day comparison

**Time:** 3-4 hours

**Total Day 1-2:** 8-10 hours

### Day 3-4: Reports

#### Task 3.3: Create Reports Pages
- Inventory Reports
- Sales Reports
- Customer Reports

**Time:** 8-10 hours

#### Task 3.4: Add Export Functionality
- Export to CSV
- Export to PDF
- Export to Excel

**Time:** 4-5 hours

**Total Day 3-4:** 12-15 hours

### Day 5: UI Polish

#### Task 3.5: Responsive Design
- Mobile menu
- Touch-friendly buttons
- Responsive tables

**Time:** 4-5 hours

#### Task 3.6: Dark Mode
- Toggle in settings
- All components themed
- Persist user preference

**Time:** 2-3 hours

**WEEK 3 TOTAL:** 26-33 hours

---

## 🎯 WEEK 4: FINAL POLISH & OPTIMIZATION

### Optional Tasks (if time permits)

#### Task 4.1: Accessibility (A11y)
- ARIA labels
- Keyboard navigation
- Screen reader support

**Time:** 3-4 hours

#### Task 4.2: Performance Optimization
- Code splitting
- Image optimization
- Lazy loading
- Caching strategies

**Time:** 4-5 hours

#### Task 4.3: Testing & Bug Fixes
- Manual testing all features
- Bug fixes
- Edge case handling

**Time:** 5-7 hours

**WEEK 4 TOTAL:** 12-16 hours

---

## ✅ PHASE 2 COMPLETION CHECKLIST

### Week 1 ✅
- [ ] API hooks created
- [ ] State management set up
- [ ] Reusable table component built
- [ ] All 5 list pages connected to APIs
- [ ] Forms and modals working
- [ ] Create/edit flows functional

### Week 2 ✅
- [ ] WebSocket server running
- [ ] Real-time hook implemented
- [ ] Inventory updates in real-time
- [ ] Orders update in real-time
- [ ] Toast notifications working
- [ ] Notification center implemented

### Week 3 ✅
- [ ] Analytics dashboard complete
- [ ] Key metrics displaying
- [ ] Charts rendering
- [ ] Reports working
- [ ] Export functionality (CSV, PDF, Excel)
- [ ] Responsive design verified
- [ ] Dark mode working

### Week 4 ✅
- [ ] Accessibility improvements
- [ ] Performance optimized
- [ ] All tests passing
- [ ] No console errors
- [ ] Ready for deployment

---

## 🚀 DEPLOYMENT CHECKLIST

Before going to production:

```bash
# Build for production
npm run build

# Run production server
npm start

# Test all features
- Create item in each module
- Edit item in each module
- Delete item in each module
- Check real-time updates
- Verify analytics dashboard
- Test exports
- Check responsive design
- Verify dark mode
```

---

## 📊 EXPECTED EFFORT

**Total Phase 2 Time:** 74-120 hours (2-4 weeks)
**Assuming 10-30 hours/week:** 2-4 weeks

**If you can dedicate full-time (40 hours/week):** 2 weeks

---

## 🎉 AFTER PHASE 2

You'll have:
✅ Complete frontend connected to all APIs  
✅ Real-time data updates across the system  
✅ Professional analytics & reporting  
✅ Responsive, accessible UI  
✅ Production-ready ERP system  
✅ Ready for user onboarding  

**Next:** Phase 3 (Mobile app, enterprise features)

---

## 🚀 START NOW!

**Next Step:** Install dependencies and create first hook

```bash
npm install react-hook-form zod @hookform/resolvers zustand @tanstack/react-query
npm run dev
# Create lib/hooks/useApi.ts (Task 1.1)
```

**Let's build the best ERP frontend! 💪**

