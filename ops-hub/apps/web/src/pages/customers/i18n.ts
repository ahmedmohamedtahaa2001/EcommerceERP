/** Domain dictionary owned by the customers page agent. Keys are global (no prefix needed). */
export const dict = {
  ar: {
    "customers.title": "العملاء",
    "customers.description":
      "سجل موحّد لكل عميل: الطلبات، العناوين، وتاريخ الدفع عند الاستلام. بيانات العميل متاحة حاليًا داخل تفاصيل الطلب فقط — وواجهة العملاء الموحّدة قيد البناء.",

    "customers.search.sectionTitle": "ابحث برقم الهاتف",
    "customers.search.label": "رقم هاتف العميل",
    "customers.search.placeholder": "+2010XXXXXXXX",
    "customers.search.hint":
      "اكتب الرقم بأي صيغة — التطبيع يتم على الخادم عند تفعيل البحث.",
    "customers.search.infoTitle": "لا يوجد بحث مباشر بعد",
    "customers.search.infoBody":
      "البحث في العملاء سيُفعّل مع واجهة العملاء الموحّدة (P3-S12-T01). حتى ذلك الحين، بيانات العميل تظهر داخل صفحة تفاصيل كل طلب.",
    "customers.search.phoneLabel": "الهاتف المُدخل:",

    "customers.empty.title": "سجل موحّد لكل عميل",
    "customers.empty.description":
      "كل عميل في صفحة واحدة: طلباته، عناوينه، وسجل الدفع عند الاستلام — لقرارات دعم ومبيعات أسرع من تجميع الإيميلات القديمة.",

    "customers.roadmap.title": "قائمة العملاء الموحّدة",
    "customers.roadmap.body":
      "قائمة بكل عملاء المتجر مع سجلهم الكامل (طلبات، عناوين، تاريخ COD) تُبنى مع P3-S12-T01. لن تُعرض بيانات تجريبية قبل توفرها.",
    "customers.roadmap.badge": "قريباً",
    "customers.roadmap.phase": "P3-S12-T01",
    "customers.roadmap.phaseLabel": "تُبنى مع",
  },
  en: {
    "customers.title": "Customers",
    "customers.description":
      "One unified record per customer: orders, addresses, and COD history. Customer data is currently only embedded in order details — the unified customers module is being built.",

    "customers.search.sectionTitle": "Search by phone",
    "customers.search.label": "Customer phone number",
    "customers.search.placeholder": "+2010XXXXXXXX",
    "customers.search.hint":
      "Enter the number in any format — the server normalizes once search is live.",
    "customers.search.infoTitle": "No direct search yet",
    "customers.search.infoBody":
      "Customer search goes live with the unified customers module (P3-S12-T01). Until then, customer data appears inside each order's detail page.",
    "customers.search.phoneLabel": "Entered phone:",

    "customers.empty.title": "One unified record per customer",
    "customers.empty.description":
      "Every customer on a single page: their orders, addresses, and COD history — so support and sales decisions don't rely on piecing together old emails.",

    "customers.roadmap.title": "Unified customer list",
    "customers.roadmap.body":
      "A list of every store customer with their full history (orders, addresses, COD record), built with P3-S12-T01. No demo data before it exists.",
    "customers.roadmap.badge": "Soon",
    "customers.roadmap.phase": "P3-S12-T01",
    "customers.roadmap.phaseLabel": "Built with",
  },
} as const;
