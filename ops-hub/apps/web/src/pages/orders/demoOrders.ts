import type { Order } from "../../lib/api/orders";

/**
 * Row shape for the orders list. The real `GET /v1/orders` payload (when
 * P1-S3-T07 ships) returns bare `Order` records; the demo rows extend them
 * with the customer/government/total display fields the API is expected to
 * add. Missing fields render as "—" in the real-data path.
 */
export interface OrderListRow extends Order {
  customerName?: string;
  customerPhone?: string;
  governorate?: string;
  itemsCount?: number;
  totalMinor?: number;
  /** "cod" | "prepaid" on real deployments. */
  method?: string;
}

interface DemoSeed {
  hoursAgo: number;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  governorate: string;
  channel: string;
  status: string;
  method: "cod" | "prepaid";
  itemsCount: number;
  totalMinor: number;
}

const HOURS_AGO = 3_600_000;

const DEMO_SEEDS: readonly DemoSeed[] = [
  {
    hoursAgo: 2,
    orderNumber: "ORD-2026-004512",
    customerName: "محمد عبد الرحمن",
    customerPhone: "+201001234567",
    governorate: "القاهرة",
    channel: "web",
    status: "on_hold",
    method: "cod",
    itemsCount: 2,
    totalMinor: 34900,
  },
  {
    hoursAgo: 3,
    orderNumber: "ORD-2026-004511",
    customerName: "سارة حسن علي",
    customerPhone: "+201102223344",
    governorate: "الجيزة",
    channel: "mobile_app",
    status: "pending",
    method: "cod",
    itemsCount: 1,
    totalMinor: 12900,
  },
  {
    hoursAgo: 5,
    orderNumber: "ORD-2026-004508",
    customerName: "أحمد مصطفى",
    customerPhone: "+201223334455",
    governorate: "الإسكندرية",
    channel: "whatsapp",
    status: "validated",
    method: "prepaid",
    itemsCount: 4,
    totalMinor: 87250,
  },
  {
    hoursAgo: 7,
    orderNumber: "ORD-2026-004505",
    customerName: "منى إبراهيم",
    customerPhone: "+201556667788",
    governorate: "المنصورة",
    channel: "web",
    status: "confirmed",
    method: "cod",
    itemsCount: 3,
    totalMinor: 54300,
  },
  {
    hoursAgo: 9,
    orderNumber: "ORD-2026-004501",
    customerName: "خالد السيد",
    customerPhone: "+201098765432",
    governorate: "القاهرة",
    channel: "retail",
    status: "allocated",
    method: "prepaid",
    itemsCount: 1,
    totalMinor: 24900,
  },
  {
    hoursAgo: 12,
    orderNumber: "ORD-2026-004497",
    customerName: "هبة فؤاد",
    customerPhone: "+201277888999",
    governorate: "أسيوط",
    channel: "mobile_app",
    status: "picking",
    method: "cod",
    itemsCount: 2,
    totalMinor: 41500,
  },
  {
    hoursAgo: 16,
    orderNumber: "ORD-2026-004490",
    customerName: "عمرو الشناوي",
    customerPhone: "+201144556677",
    governorate: "بورسعيد",
    channel: "web",
    status: "label_created",
    method: "prepaid",
    itemsCount: 5,
    totalMinor: 112800,
  },
  {
    hoursAgo: 20,
    orderNumber: "ORD-2026-004483",
    customerName: "دينا رشاد",
    customerPhone: "+201010998877",
    governorate: "الجيزة",
    channel: "whatsapp",
    status: "carrier_accepted",
    method: "cod",
    itemsCount: 1,
    totalMinor: 18900,
  },
  {
    hoursAgo: 27,
    orderNumber: "ORD-2026-004478",
    customerName: "محمود عزت",
    customerPhone: "+201233445566",
    governorate: "القاهرة",
    channel: "web",
    status: "shipped",
    method: "prepaid",
    itemsCount: 2,
    totalMinor: 62000,
  },
  {
    hoursAgo: 34,
    orderNumber: "ORD-2026-004471",
    customerName: "نهى سليم",
    customerPhone: "+201199887766",
    governorate: "طنطا",
    channel: "mobile_app",
    status: "delivered",
    method: "cod",
    itemsCount: 3,
    totalMinor: 47700,
  },
  {
    hoursAgo: 46,
    orderNumber: "ORD-2026-004465",
    customerName: "طارق الجندي",
    customerPhone: "+201555443322",
    governorate: "الإسكندرية",
    channel: "retail",
    status: "cancelled",
    method: "prepaid",
    itemsCount: 1,
    totalMinor: 9900,
  },
  {
    hoursAgo: 58,
    orderNumber: "ORD-2026-004459",
    customerName: "ياسمين حاتم",
    customerPhone: "+201288776655",
    governorate: "القاهرة",
    channel: "web",
    status: "returned",
    method: "cod",
    itemsCount: 2,
    totalMinor: 26400,
  },
];

/** Deterministic demo dataset for the design-preview path (404 until P1-S3-T07). */
export function buildDemoOrders(): OrderListRow[] {
  return DEMO_SEEDS.map((seed, index) => ({
    id: `demo-order-${index + 1}`,
    tenantId: "demo-tenant",
    orderNumber: seed.orderNumber,
    customerId: `demo-customer-${index + 1}`,
    addressId: `demo-address-${index + 1}`,
    status: seed.status,
    currency: "EGP",
    channel: seed.channel,
    externalOrderId: null,
    idempotencyKey: null,
    idempotencyBodyHash: null,
    createdAt: new Date(Date.now() - seed.hoursAgo * HOURS_AGO).toISOString(),
    updatedAt: new Date(
      Date.now() - Math.max(0, seed.hoursAgo - 1) * HOURS_AGO,
    ).toISOString(),
    customerName: seed.customerName,
    customerPhone: seed.customerPhone,
    governorate: seed.governorate,
    itemsCount: seed.itemsCount,
    totalMinor: seed.totalMinor,
    method: seed.method,
  }));
}

/** Channels surfaced in the filter; the demo dataset covers all of them. */
export const DEMO_CHANNELS = [
  "web",
  "mobile_app",
  "whatsapp",
  "retail",
] as const;
