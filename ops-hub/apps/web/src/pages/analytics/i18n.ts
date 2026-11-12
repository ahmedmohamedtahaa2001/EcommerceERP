/** Domain dictionary owned by the analytics page agent. Keys are global (no prefix needed). */
export const dict = {
  ar: {
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

    "analytics.roadmap.title": "مؤشرات قادمة",
    "analytics.roadmap.description":
      "هذه المؤشرات تحتاج مسارات بيانات تُبنى في المرحلة P3-S12-T06 (سجل شحن، محصّلات COD، وأحداث التسليم). لن نعرض أرقامًا تجريبية قبل توفرها.",
    "analytics.roadmap.badge": "قريباً",
    "analytics.roadmap.phase": "P3-S12-T06",
    "analytics.roadmap.phaseLabel": "تُحتسب مع مسار",
    "analytics.roadmap.codRate.title": "معدل تحصيل الدفع عند الاستلام",
    "analytics.roadmap.codRate.description":
      "نسبة مبالغ COD المحصّلة فعليًا من إجمالي المبالغ المسلّمة للتحصيل خلال الفترة.",
    "analytics.roadmap.rtoRate.title": "نسبة المرتجعات (RTO)",
    "analytics.roadmap.rtoRate.description":
      "نسبة الشحنات التي رُجعت للمخزن دون تسليم من إجمالي المشحون للعميل.",
    "analytics.roadmap.onTimeDelivery.title": "الالتزام بمواعيد التسليم",
    "analytics.roadmap.onTimeDelivery.description":
      "نسبة الطلبات المسلّمة خلال المدة الموعودة للعميل من إجمالي المشحون.",
    "analytics.roadmap.dockToStock.title": "من الرصيف إلى الرف",
    "analytics.roadmap.dockToStock.description":
      "الزمن من استلام شحنة المورّد حتى إتاحة كمياتها للبيع في المخزن.",
    "analytics.roadmap.sellThrough.title": "معدل تصريف المخزون",
    "analytics.roadmap.sellThrough.description":
      "نسبة الكميات المبيعة خلال الفترة إلى الكميات المتاحة في بدايتها — لمؤشر ما الذي يبيع وما الذي يكدس.",
  },
  en: {
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

    "analytics.roadmap.title": "Coming-soon KPIs",
    "analytics.roadmap.description":
      "These KPIs need data pipelines built in phase P3-S12-T06 (shipment ledger, COD collections, delivery events). No demo numbers until then.",
    "analytics.roadmap.badge": "Soon",
    "analytics.roadmap.phase": "P3-S12-T06",
    "analytics.roadmap.phaseLabel": "Computed in track",
    "analytics.roadmap.codRate.title": "COD collection rate",
    "analytics.roadmap.codRate.description":
      "Share of COD amounts actually collected out of all amounts dispatched for collection in the period.",
    "analytics.roadmap.rtoRate.title": "Return-to-origin rate (RTO)",
    "analytics.roadmap.rtoRate.description":
      "Share of shipments returned to stock without delivery, out of all shipped orders.",
    "analytics.roadmap.onTimeDelivery.title": "On-time delivery",
    "analytics.roadmap.onTimeDelivery.description":
      "Share of orders delivered within the promised window, out of all shipped.",
    "analytics.roadmap.dockToStock.title": "Dock-to-stock",
    "analytics.roadmap.dockToStock.description":
      "Time from receiving a supplier shipment to its quantities being sellable in stock.",
    "analytics.roadmap.sellThrough.title": "Sell-through rate",
    "analytics.roadmap.sellThrough.description":
      "Share of units sold in the period out of the units available at its start — what's selling vs. what's sitting.",
  },
} as const;
