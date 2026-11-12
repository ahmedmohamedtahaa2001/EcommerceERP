/**
 * Domain dictionary owned by the dashboard page agent. Keys are global
 * (flat, `dashboard.*` namespaced); they are merged into the global key
 * space by `lib/i18n/index.ts` and must stay unique across domains.
 */
export const dict = {
  ar: {
    "dashboard.title": "لوحة التحكم",
    "dashboard.description":
      "نظرة سريعة على تشغيل اليوم: الطلبات والمشكلات والمخزون",
    "dashboard.kpi.openExceptions": "مشكلات مفتوحة",
    "dashboard.kpi.openExceptionsHint": "بحاجة لمراجعة فريق العمليات",
    "dashboard.kpi.onHoldOrders": "طلبات معلّقة",
    "dashboard.kpi.lowStock": "تنبيهات مخزون منخفض",
    "dashboard.kpi.ordersToday": "طلبات اليوم",
    "dashboard.kpi.comingSoon": "قريباً",
    "dashboard.kpi.comingSoonHint": "بانتظار نقطة نهاية القوائم على الـ API",
    "dashboard.attention.title": "طلبات تحتاج تدخل",
    "dashboard.attention.description": "أحدث المشكلات المفتوحة على الطلبات",
    "dashboard.attention.viewAll": "كل المشكلات",
    "dashboard.attention.empty.title": "لا توجد مشكلات مفتوحة",
    "dashboard.attention.empty.hint":
      "كل شيء تحت السيطرة — المشكلات الجديدة ستظهر هنا فور إنشائها.",
    "dashboard.attention.orderLabel": "الطلب",
    "dashboard.attention.dueLabel": "الاستحقاق",
    "dashboard.attention.overdue": "متأخرة",
    "dashboard.viewOrder": "عرض الطلب",
    "dashboard.quick.createOrder": "إنشاء طلب",
    "dashboard.quick.goToOrders": "الانتقال إلى الطلبات",
    "dashboard.quick.goToExceptions": "الانتقال إلى المشكلات",
  },
  en: {
    "dashboard.title": "Dashboard",
    "dashboard.description":
      "A quick view of today's run: orders, exceptions, and stock",
    "dashboard.kpi.openExceptions": "Open exceptions",
    "dashboard.kpi.openExceptionsHint": "Waiting on the ops team",
    "dashboard.kpi.onHoldOrders": "On-hold orders",
    "dashboard.kpi.lowStock": "Low stock alerts",
    "dashboard.kpi.ordersToday": "Orders today",
    "dashboard.kpi.comingSoon": "Coming soon",
    "dashboard.kpi.comingSoonHint": "Waiting on the list endpoints on the API",
    "dashboard.attention.title": "Orders needing attention",
    "dashboard.attention.description": "The latest open exceptions on orders",
    "dashboard.attention.viewAll": "All exceptions",
    "dashboard.attention.empty.title": "No open exceptions",
    "dashboard.attention.empty.hint":
      "All clear — new exceptions will appear here as soon as they're raised.",
    "dashboard.attention.orderLabel": "Order",
    "dashboard.attention.dueLabel": "Due",
    "dashboard.attention.overdue": "Overdue",
    "dashboard.viewOrder": "View order",
    "dashboard.quick.createOrder": "New order",
    "dashboard.quick.goToOrders": "Go to orders",
    "dashboard.quick.goToExceptions": "Go to exceptions",
  },
} as const;
