/**
 * Domain dictionary owned by the agents page agent. The agents catalog is
 * a designed direction page (FEATURES.md module 12) — no live automation
 * exists yet, so all copy is honest about the roadmap.
 */
export const dict = {
  ar: {
    "agents.description":
      "وكلاء أتمتة بيشتغلوا في الخلفية على المهام المتكررة — دي خريطة الاتجاه، مش متاحة للتشغيل بعد.",
    "agents.statusBadge": "قريباً",
    "agents.phaseNote":
      "الأتمتة تُبنى في Phase 3–4 (خطة P3-S12 / P4-S14) — الحجات دي اتجاه التصميم مش ميزات شغالة.",
    "agents.cta": "تهيئة الوكيل",
    "agents.ctaDisabled": "متاح بعد Phase 3",
    "agents.card.restock.title": "وكيل إعادة الطلب",
    "agents.card.restock.desc":
      "بينذر طلب شراء أول ما رصيد أي منتج يوصل للحد الأدنى، ويسلمه جاهز للاعتماد بضغطة واحدة.",
    "agents.card.exceptions.title": "وكيل رصد الاستثناءات",
    "agents.card.exceptions.desc":
      "بيلقط طلبات العناوين الناقصة والأرقام الغلط ويحاول يصلحها تلقائيًا قبل ما توصل لطابور العمليات.",
    "agents.card.cod.title": "وكيل تأكيد COD",
    "agents.card.cod.desc":
      "بيكلم العميل قبل الشحن للتأكد من الطلب والدفع كاش عند الاستلام، ويحدّث حالة الطلب على طول.",
    "agents.card.priorities.title": "وكيل ترتيب الأولويات",
    "agents.card.priorities.desc":
      "بيرتب طابور التجهيز حسب أولوية الشحن والمناطق، عشان الفريق يبدأ بالطلبات الأقرب إنجاز.",
  },
  en: {
    "agents.description":
      "Automation agents that handle repetitive work in the background — this is the roadmap direction, not live functionality yet.",
    "agents.statusBadge": "Coming soon",
    "agents.phaseNote":
      "Automation ships in Phase 3–4 (plan P3-S12 / P4-S14) — the items below are design direction, not working features.",
    "agents.cta": "Configure agent",
    "agents.ctaDisabled": "Available after Phase 3",
    "agents.card.restock.title": "Reorder agent",
    "agents.card.restock.desc":
      "Drafts a purchase order the moment any SKU hits its reorder point, ready for one-click approval.",
    "agents.card.exceptions.title": "Exception monitor",
    "agents.card.exceptions.desc":
      "Catches incomplete-address and invalid-phone orders and attempts automatic fixes before they reach the ops queue.",
    "agents.card.cod.title": "COD confirmer",
    "agents.card.cod.desc":
      "Contacts the customer before shipping to confirm the order and cash-on-delivery payment, then updates the order status.",
    "agents.card.priorities.title": "Priority sorter",
    "agents.card.priorities.desc":
      "Ranks the picking queue by shipping priority and district so the team starts with the fastest wins.",
  },
} as const;
