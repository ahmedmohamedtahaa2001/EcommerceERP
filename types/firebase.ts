import { Timestamp } from 'firebase/firestore';

// Company
export interface Company {
  id: string;
  name: string;
  slug: string;
  email?: string;
  phone?: string;
  website?: string;
  logoUrl?: string;
  description?: string;
  active: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// User
export interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  companyId: string;
  role: 'admin' | 'manager' | 'staff' | 'viewer';
  active: boolean;
  lastLogin?: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Product
export interface Product {
  id: string;
  companyId: string;
  sku: string;
  name: string;
  description?: string;
  categoryId?: string;
  price: number;
  cost?: number;
  active: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Product Variant
export interface ProductVariant {
  id: string;
  productId: string;
  name: string;
  sku?: string;
  price?: number;
  active: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Customer
export interface Customer {
  id: string;
  companyId: string;
  email: string;
  name: string;
  phone?: string;
  city?: string;
  state?: string;
  country?: string;
  zip?: string;
  totalOrders: number;
  totalSpent: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Customer Address
export interface CustomerAddress {
  id: string;
  customerId: string;
  street?: string;
  city?: string;
  state?: string;
  country?: string;
  zip?: string;
  isDefault: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Order
export interface Order {
  id: string;
  companyId: string;
  customerId?: string;
  orderNumber: string;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  paymentStatus: 'pending' | 'paid' | 'failed' | 'refunded';
  total: number;
  shippingAddress?: Record<string, any>;
  notes?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Order Item
export interface OrderItem {
  id: string;
  orderId: string;
  productId?: string;
  quantity: number;
  price: number;
  total: number;
  createdAt: Timestamp;
}

// Warehouse
export interface Warehouse {
  id: string;
  companyId: string;
  name: string;
  location?: string;
  isDefault: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Inventory
export interface Inventory {
  id: string;
  productId: string;
  warehouseId: string;
  quantity: number;
  reserved: number;
  reorderLevel: number;
  lastRestocked?: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Audit Log
export interface AuditLog {
  id: string;
  companyId: string;
  userId: string;
  action: string;
  resource: string;
  resourceId: string;
  changes?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Timestamp;
}

// Webhook
export interface Webhook {
  id: string;
  companyId: string;
  url: string;
  events: string[];
  active: boolean;
  secret?: string;
  headers?: Record<string, string>;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Webhook Log
export interface WebhookLog {
  id: string;
  webhookId: string;
  event: string;
  status: number;
  payload: Record<string, any>;
  response?: string;
  error?: string;
  createdAt: Timestamp;
}

// Firestore Document Type Helper
export type FirestoreDoc<T> = T & { id: string };
