/** Domain dictionary owned by the analytics page agent. Keys are global (no prefix needed). */
export const dict = {
  ar: {
    "analytics.more.title": "مؤشرات التشغيل التفصيلية",
    "analytics.more.description":
      "معدل تحصيل الدفع عند الاستلام، والالتزام بمواعيد الشحن، ومدة الاستلام حتى الرف، ومؤشرات الدعم موجودة في صفحة التقارير لأي يوم تختاره.",
    "analytics.more.link": "فتح التقارير",
    "analytics.title": "التحليلات",
    "analytics.description":
      "أرقام فعلية محسوبة من بيانات النظام اليوم — والمؤشرات التي لم تتوفر بياناتها بعد مُعلنة بوضوح، بلا أرقام وهمية.",

    "analytics.section.realKpis": "مؤشرات فعلية",
    "analytics.kpi.openExceptions": "مشكلات مفتوحة",
    "analytics.kpi.openExceptionsHint": "تجاوزت موعد الحل {count}",
    "analytics.kpi.overdueExceptions": "مشكلات متأخرة عن الموعد",
    "analytics.kpi.overdueExceptionsHint": "من إجمالي {total} مشكلة مفتوحة",
    "analytics.kpi.products": "المنتجات",
    "analytics.kpi.productsHint":
      "نشط {active} · مسودة {draft} · مؤرشف {archived}",
    "analytics.kpi.locations": "المخازن",
    "analytics.kpi.locationsHint": "موقع تشغيل مسجل",
    "analytics.kpi.loadFailed": "تعذر تحميل هذا المؤشر",
    "analytics.kpi.unknownStatus": "حالات أخرى",

    "analytics.section.charts": "توزيعات من البيانات الفعلية",
    "analytics.chart.exceptions.title": "المشكلات المفتوحة حسب السبب",
    "analytics.chart.exceptions.aria":
      "مخطط شريطي أفقي: {count} مشكلة مفتوحة موزعة حسب سبب المشكلة، والأكثر تكرارًا {top} بعدد {topCount}.",
    "analytics.chart.exceptions.summary":
      "إجمالي {count} مشكلة مفتوحة — الأكثر تكرارًا: {top} ({topCount}).",
    "analytics.chart.exceptions.empty":
      "لا مشكلات مفتوحة حاليًا — كل الطلبات تمر بسلاسة.",
    "analytics.chart.products.title": "المنتجات حسب الحالة",
    "analytics.chart.products.aria":
      "مخطط شريطي أفقي: توزيع {total} منتجًا حسب الحالة — نشط {active}، مسودة {draft}، مؤرشف {archived}.",
    "analytics.chart.products.summary":
      "إجمالي {total} منتج — نشط {active} · مسودة {draft} · مؤرشف {archived}.",
    "analytics.chart.products.empty":
      "لا منتجات بعد — أضف منتجاتك من صفحة الكتالوج.",

    "analytics.productStatus.active": "نشط",
    "analytics.productStatus.draft": "مسودة",
    "analytics.productStatus.archived": "مؤرشف",

    "analytics.reason.duplicate": "طلب مكرر مشتبه به",
    "analytics.reason.unknown": "سبب آخر ({code})",
  },
  en: {
    "analytics.more.title": "Detailed operating indicators",
    "analytics.more.description":
      "COD collection rate, on-time shipping, receipt-to-shelf time and support indicators are on the Reports page, for any day you choose.",
    "analytics.more.link": "Open reports",
    "analytics.title": "Analytics",
    "analytics.description":
      "Real numbers computed from today's system data — KPIs whose data doesn't exist yet are clearly announced, never faked.",

    "analytics.section.realKpis": "Live KPIs",
    "analytics.kpi.openExceptions": "Open exceptions",
    "analytics.kpi.openExceptionsHint": "{count} past their due time",
    "analytics.kpi.overdueExceptions": "Overdue exceptions",
    "analytics.kpi.overdueExceptionsHint": "of {total} open exceptions",
    "analytics.kpi.products": "Products",
    "analytics.kpi.productsHint":
      "active {active} · draft {draft} · archived {archived}",
    "analytics.kpi.locations": "Locations",
    "analytics.kpi.locationsHint": "registered operating site",
    "analytics.kpi.loadFailed": "Could not load this KPI",
    "analytics.kpi.unknownStatus": "Other statuses",

    "analytics.section.charts": "Distributions from live data",
    "analytics.chart.exceptions.title": "Open exceptions by reason",
    "analytics.chart.exceptions.aria":
      "Horizontal bar chart: {count} open exceptions by reason, most frequent is {top} with {topCount}.",
    "analytics.chart.exceptions.summary":
      "{count} open exceptions in total — most frequent: {top} ({topCount}).",
    "analytics.chart.exceptions.empty":
      "No open exceptions right now — every order is moving.",
    "analytics.chart.products.title": "Products by status",
    "analytics.chart.products.aria":
      "Horizontal bar chart: {total} products by status — active {active}, draft {draft}, archived {archived}.",
    "analytics.chart.products.summary":
      "{total} products in total — active {active} · draft {draft} · archived {archived}.",
    "analytics.chart.products.empty":
      "No products yet — add them from the catalog page.",

    "analytics.productStatus.active": "Active",
    "analytics.productStatus.draft": "Draft",
    "analytics.productStatus.archived": "Archived",

    "analytics.reason.duplicate": "Suspected duplicate order",
    "analytics.reason.unknown": "Other reason ({code})",
  },
} as const;
