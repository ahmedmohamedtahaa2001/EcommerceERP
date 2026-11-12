/** Domain dictionary for the bulk changes page (/bulk). */
export const dict = {
  ar: {
    "bulk.title": "العمليات الجماعية",
    "bulk.description":
      "اختر منتجات، ثم غيّر حالتها أو أسعارها دفعة واحدة. تعرض النتيجة كل منتج على حدة.",
    "bulk.select": "المنتجات",
    "bulk.selectAll": "تحديد الكل",
    "bulk.selectedCount": "محدد: {count}",
    "bulk.apply": "تطبيق",
    "bulk.done": "اكتملت العملية",
    "bulk.failed": "تعذر تنفيذ العملية",
    "bulk.result":
      "من {total}: نجح {succeeded}، تم تخطي {skipped}، فشل {failed}",
    "bulk.outcome.skipped": "تم تخطيه",
    "bulk.outcome.not-found": "غير موجود",
    "bulk.status.title": "تغيير الحالة",
    "bulk.status.body":
      "غيّر حالة المنتجات المحددة. الأرشفة تخفي المنتج من البيع دون حذف بياناته.",
    "bulk.status.to": "الحالة الجديدة",
    "bulk.prices.title": "تغيير الأسعار",
    "bulk.prices.body":
      "يُطبَّق التغيير على كل متغير مُسعَّر في المنتجات المحددة. المنتجات بلا أسعار تُتخطى.",
    "bulk.prices.mode": "طريقة التغيير",
    "bulk.prices.mode.percent": "نسبة مئوية (+ زيادة، - خفض)",
    "bulk.prices.mode.set": "سعر ثابت",
    "bulk.prices.percent": "النسبة المئوية",
    "bulk.prices.fixed": "السعر الجديد (جنيه)",
    "bulk.prices.error.number": "أدخل رقمًا",
    "bulk.prices.error.percentRange": "النسبة بين -90 و +1000",
    "bulk.prices.error.price": "أدخل سعرًا موجبًا بحد أقصى رقمين عشريين",
    "bulk.archive.title": "أرشفة المنتجات المحددة؟",
    "bulk.archive.body":
      "ستُخفى {count} منتج من البيع. يمكن إعادة تفعيلها لاحقًا.",
    "bulk.archive.confirm": "أرشفة",
  },
  en: {
    "bulk.title": "Bulk changes",
    "bulk.description":
      "Choose products, then change their status or prices in one go. The result reports each product.",
    "bulk.select": "Products",
    "bulk.selectAll": "Select all",
    "bulk.selectedCount": "Selected: {count}",
    "bulk.apply": "Apply",
    "bulk.done": "Change applied",
    "bulk.failed": "The change could not be applied",
    "bulk.result":
      "Of {total}: {succeeded} changed, {skipped} skipped, {failed} failed",
    "bulk.outcome.skipped": "Skipped",
    "bulk.outcome.not-found": "Not found",
    "bulk.status.title": "Change status",
    "bulk.status.body":
      "Change the status of the selected products. Archiving hides a product from sale without deleting its data.",
    "bulk.status.to": "New status",
    "bulk.prices.title": "Change prices",
    "bulk.prices.body":
      "The change applies to every priced variant of the selected products. Products without prices are skipped.",
    "bulk.prices.mode": "How to change",
    "bulk.prices.mode.percent": "Percentage (+ raise, - cut)",
    "bulk.prices.mode.set": "Fixed price",
    "bulk.prices.percent": "Percentage",
    "bulk.prices.fixed": "New price",
    "bulk.prices.error.number": "Enter a number",
    "bulk.prices.error.percentRange":
      "Percentage must be between -90 and +1000",
    "bulk.prices.error.price":
      "Enter a positive price with at most two decimals",
    "bulk.archive.title": "Archive the selected products?",
    "bulk.archive.body":
      "{count} products will be hidden from sale. You can reactivate them later.",
    "bulk.archive.confirm": "Archive",
  },
};
