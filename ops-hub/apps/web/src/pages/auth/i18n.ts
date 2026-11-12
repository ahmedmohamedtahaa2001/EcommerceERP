/**
 * Domain dictionary owned by the auth page agent (login + the 404 page,
 * whose `pages/system/` folder carries no i18n file). Keys are global —
 * `login.*` and `state.*` basenames already exist in lib/i18n/{ar,en}.ts
 * and are reused, not redefined.
 */
export const dict = {
  ar: {
    // Cinematic panel (depth-4 copy)
    "login.headline": "مركز عمليات متجرك كله في مكان واحد",
    "login.subheadline":
      "من الطلب لحد التسليم — لوحة واحدة تشتغل بيها الفريق كله.",
    "login.brandTagline": "منصة تشغيل التجارة الإلكترونية",
    "login.feature.orders": "طلبات لحظة بلحظة",
    "login.feature.inventory": "مخزون محدَّث على طول",
    "login.feature.cod": "تحصيل كاش عند الاستلام",
    // Form card
    "login.cardTitle": "أهلاً بيك تاني",
    "login.cardSubtitle": "سجّل دخولك للوصول للوحة التحكم.",
    "login.emailPlaceholder": "name@store.com",
    "login.secureNote":
      "بيانات الدخول بتتبعت مشفّرة — جلسة موثوقة لمدة ٨ ساعات.",
    // 404 (pages/system/NotFoundPage.tsx)
    "notFound.title": "الصفحة دي مش موجودة",
    "notFound.description":
      "الرابط اللي فتحته غلط أو عنوانه اتغيّر. جرّب ترجع للوحة التحكم من هنا.",
    "notFound.cta": "الرجوع للوحة التحكم",
    "notFound.ariaLabel": "خطأ 404 — الصفحة غير موجودة",
  },
  en: {
    "login.headline": "Your store's entire operations center in one place",
    "login.subheadline":
      "From order to delivery — one console the whole team works from.",
    "login.brandTagline": "The e-commerce operations platform",
    "login.feature.orders": "Real-time orders",
    "login.feature.inventory": "Always-current inventory",
    "login.feature.cod": "Cash-on-delivery collection",
    "login.cardTitle": "Welcome back",
    "login.cardSubtitle": "Sign in to reach your operations console.",
    "login.emailPlaceholder": "name@store.com",
    "login.secureNote":
      "Credentials are sent encrypted — trusted session for 8 hours.",
    "notFound.title": "This page doesn't exist",
    "notFound.description":
      "The link you followed is wrong or has moved. Head back to the console from here.",
    "notFound.cta": "Back to the console",
    "notFound.ariaLabel": "404 error — page not found",
  },
} as const;
