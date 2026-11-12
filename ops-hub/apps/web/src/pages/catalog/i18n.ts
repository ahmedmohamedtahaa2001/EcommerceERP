/**
 * Domain dictionary owned by the catalog page agent. Keys are global
 * (no prefix needed). Covers /products, /products/:id, /products/import.
 */
export const dict = {
  ar: {
    // ── ProductsPage ──────────────────────────────────────────────
    "products.title": "المنتجات",
    "products.description":
      "كتالوج المنتجات ومتغيراتها — بسيطة أو حزم، بحالات مسودة ونشط ومؤرشف.",
    "products.searchPlaceholder": "ابحث بالاسم العربي أو الإنجليزي…",
    "products.newProduct": "منتج جديد",
    "products.ariaTable": "جدول المنتجات",
    "products.col.name": "الاسم",
    "products.col.kind": "النوع",
    "products.col.status": "الحالة",
    "products.col.created": "أُنشئ في",
    "products.emptyTitle": "لا توجد منتجات بعد",
    "products.emptyHint":
      "ابدأ بإضافة أول منتج للكتالوج، أو استورد ملف منتجات جاهز.",
    "products.rowHint": "عرض تفاصيل المنتج",
    "products.created": "تم إنشاء المنتج بنجاح",
    "products.createFailed": "تعذر إنشاء المنتج",

    "kind.simple": "بسيط",
    "kind.bundle": "حزمة",
    "kind.aria": "نوع المنتج",

    "productStatus.draft": "مسودة",
    "productStatus.active": "نشط",
    "productStatus.archived": "مؤرشف",
    "productStatus.aria": "حالة المنتج",

    // ── Product form modal (create + edit) ────────────────────────
    "productForm.createTitle": "منتج جديد",
    "productForm.editTitle": "تعديل بيانات المنتج",
    "productForm.nameAr": "الاسم بالعربي",
    "productForm.nameEn": "الاسم بالإنجليزي",
    "productForm.descriptionAr": "الوصف بالعربي",
    "productForm.descriptionEn": "الوصف بالإنجليزي",
    "productForm.descriptionHint": "اختياري.",
    "productForm.kind": "النوع",
    "productForm.status": "الحالة",
    "productForm.kindHint":
      "الحزمة تجمع أكثر من منتج — إدارة مكوناتها ستتوفر لاحقًا.",
    "productForm.required": "هذا الحقل مطلوب",

    // ── ProductDetailPage ─────────────────────────────────────────
    "detail.breadcrumbs": "المنتج",
    "detail.infoTitle": "بيانات المنتج",
    "detail.edit": "تعديل",
    "detail.notFoundTitle": "المنتج غير موجود",
    "detail.notFoundHint": "قد يكون المحذوف أو الرابط غير صحيح.",
    "detail.bundleAlert":
      "هذا المنتج من نوع حزمة (bundle). إدارة مكوّنات الحزمة غير متاحة بعد في الـ API — ستُضاف هذه الشاشة عند توفّر نقطة النهاية.",
    "detail.variantsTitle": "المتغيرات",
    "detail.addVariant": "إضافة متغير",
    "detail.variantsAria": "جدول المتغيرات",
    "detail.variantsEmptyTitle": "لا توجد متغيرات لهذا المنتج",
    "detail.variantsEmptyHint":
      "أضف أول متغير (SKU) ليصبح المنتج قابلًا للتخزين والبيع.",
    "detail.variantsCount": "{count} متغير",
    "detail.col.sku": "الـ SKU",
    "detail.col.attributes": "الخصائص",
    "detail.col.images": "الصور",
    "detail.col.created": "أُنشئ في",
    "detail.imagesCount": "{count} صورة",
    "detail.noAttributes": "بدون خصائص",
    "detail.availabilityBtn": "عرض التوفر",
    "detail.hideAvailability": "إخفاء التوفر",
    "detail.skuImmutableNote": "الـ SKU غير قابل للتعديل بعد الإنشاء.",

    "variantForm.createTitle": "متغير جديد",
    "variantForm.sku": "الـ SKU",
    "variantForm.skuHint":
      "مثال: OPS-TSHIRT-RED-M — أحرف لاتينية وأرقام وشرطات فقط.",
    "variantForm.attributes": "الخصائص",
    "variantForm.attributesHint": "مثل: اللون = أحمر، المقاس = M.",
    "variantForm.attrKey": "اسم الخاصية",
    "variantForm.attrValue": "القيمة",
    "variantForm.addPair": "إضافة خاصية",
    "variantForm.removePair": "إزالة الخاصية",
    "variantForm.images": "روابط الصور",
    "variantForm.imagesHint": "روابط مفصولة بفاصلة، اختياري.",
    "variantForm.created": "تم إنشاء المتغير بنجاح",
    "variantForm.createFailed": "تعذر إنشاء المتغير",

    // ── Availability popover (shared with inventory pages) ────────
    "availability.popoverTitle": "توفر المخزون",
    "bucket.on_hand": "الرصيد الفعلي",
    "bucket.reserved": "محجوز",
    "bucket.quarantined": "معزول",
    "bucket.damaged": "تالف",
    "bucket.in_transit": "في الطريق",
    "bucket.availableToPromise": "متاح للوعد (ATP)",

    // ── ProductImportPage ─────────────────────────────────────────
    "import.title": "استيراد المنتجات",
    "import.description":
      "رفع ملف منتجات بصيغة CSV أو XLSX — نبدأ دائمًا بتنفيذ تجريبي (dry-run) لعرض التقرير قبل الإدخال الفعلي.",
    "import.step1": "رفع الملف",
    "import.step2": "التقرير",
    "import.stepsAria": "خطوات الاستيراد",
    "import.format": "الصيغة",
    "import.file": "الملف",
    "import.chooseFile": "اختيار ملف",
    "import.fileHint": "ملف {format} يحتوي أعمدة: nameAr, nameEn, kind.",
    "import.fileSelected": "الملف المختار: {name} ({size})",
    "import.fileMissing": "اختر ملفًا أولًا",
    "import.wrongExtension": "الملف المختار لا يطابق الصيغة {format}",
    "import.readFailed": "تعذر قراءة الملف",
    "import.executeActually": "تنفيذ فعلي (إدخال البيانات)",
    "import.executeHint": "بدون هذا الخيار يتم التحقق فقط دون إدخال أي بيانات.",
    "import.runDry": "تشغيل التحقق",
    "import.runReal": "التنفيذ الفعلي",
    "import.next": "التالي",
    "import.confirmRealTitle": "تأكيد التنفيذ الفعلي",
    "import.confirmRealBody":
      "بهذا الخيار ستُضاف صفوف الملف فعليًا إلى الكتالوج، وليس مجرد تحقق. راجع تقرير التحقق أولًا إن لم تفعل. متابعة؟",
    "import.running": "جارٍ المعالجة…",
    "import.reportTitle": "تقرير الاستيراد",
    "import.badge.dryRun": "تحقق فقط",
    "import.badge.real": "تنفيذ فعلي",
    "import.totalRows": "إجمالي الصفوف",
    "import.createdCount": "صفوف أُنشئت",
    "import.errorsCount": "أخطاء",
    "import.progressLabel": "نسبة الصفوف المقبولة",
    "import.successBanner": "تمت المعالجة بنجاح — كل الصفوف سليمة وبدون أخطاء.",
    "import.partialBanner":
      "اكتملت المعالجة: {created} من {total} صفًا. صحّح الصفوف الفاسحة وارفع الملف مرة أخرى.",
    "import.errorsTitle": "صفوف بها أخطاء",
    "import.errorsHint":
      "هذه الصفوف لن تُستورد؛ صحّح الأسباب التالية في ملفك ثم أعد الرفع.",
    "import.errorsAria": "جدول أخطاء الاستيراد",
    "import.col.row": "الصف",
    "import.col.reason": "السبب",
    "import.startOver": "استيراد ملف آخر",
    "import.importFailed": "فشل الاستيراد",
    "import.backToProducts": "رجوع إلى المنتجات",
  },
  en: {
    // ── ProductsPage ──────────────────────────────────────────────
    "products.title": "Products",
    "products.description":
      "Product catalog and variants — simple or bundles, with draft / active / archived states.",
    "products.searchPlaceholder": "Search by Arabic or English name…",
    "products.newProduct": "New product",
    "products.ariaTable": "Products table",
    "products.col.name": "Name",
    "products.col.kind": "Kind",
    "products.col.status": "Status",
    "products.col.created": "Created",
    "products.emptyTitle": "No products yet",
    "products.emptyHint":
      "Start by adding your first product, or import a ready product file.",
    "products.rowHint": "View product details",
    "products.created": "Product created successfully",
    "products.createFailed": "Could not create the product",

    "kind.simple": "Simple",
    "kind.bundle": "Bundle",
    "kind.aria": "Product kind",

    "productStatus.draft": "Draft",
    "productStatus.active": "Active",
    "productStatus.archived": "Archived",
    "productStatus.aria": "Product status",

    // ── Product form modal (create + edit) ────────────────────────
    "productForm.createTitle": "New product",
    "productForm.editTitle": "Edit product details",
    "productForm.nameAr": "Arabic name",
    "productForm.nameEn": "English name",
    "productForm.descriptionAr": "Arabic description",
    "productForm.descriptionEn": "English description",
    "productForm.descriptionHint": "Optional.",
    "productForm.kind": "Kind",
    "productForm.status": "Status",
    "productForm.kindHint":
      "A bundle groups several products — component management arrives later.",
    "productForm.required": "This field is required",

    // ── ProductDetailPage ─────────────────────────────────────────
    "detail.breadcrumbs": "Product",
    "detail.infoTitle": "Product details",
    "detail.edit": "Edit",
    "detail.notFoundTitle": "Product not found",
    "detail.notFoundHint":
      "It may have been deleted, or the link is incorrect.",
    "detail.bundleAlert":
      "This product is a bundle. Bundle component management is not exposed by the API yet — this section ships once the endpoint exists.",
    "detail.variantsTitle": "Variants",
    "detail.addVariant": "Add variant",
    "detail.variantsAria": "Variants table",
    "detail.variantsEmptyTitle": "No variants for this product",
    "detail.variantsEmptyHint":
      "Add the first variant (SKU) to make the product storable and sellable.",
    "detail.variantsCount": "{count} variants",
    "detail.col.sku": "SKU",
    "detail.col.attributes": "Attributes",
    "detail.col.images": "Images",
    "detail.col.created": "Created",
    "detail.imagesCount": "{count} images",
    "detail.noAttributes": "No attributes",
    "detail.availabilityBtn": "Show availability",
    "detail.hideAvailability": "Hide availability",
    "detail.skuImmutableNote": "The SKU cannot be changed after creation.",

    "variantForm.createTitle": "New variant",
    "variantForm.sku": "SKU",
    "variantForm.skuHint":
      "e.g. OPS-TSHIRT-RED-M — Latin letters, digits and dashes only.",
    "variantForm.attributes": "Attributes",
    "variantForm.attributesHint": "e.g. color = red, size = M.",
    "variantForm.attrKey": "Attribute name",
    "variantForm.attrValue": "Value",
    "variantForm.addPair": "Add attribute",
    "variantForm.removePair": "Remove attribute",
    "variantForm.images": "Image URLs",
    "variantForm.imagesHint": "Comma-separated URLs, optional.",
    "variantForm.created": "Variant created successfully",
    "variantForm.createFailed": "Could not create the variant",

    // ── Availability popover (shared with inventory pages) ────────
    "availability.popoverTitle": "Stock availability",
    "bucket.on_hand": "On hand",
    "bucket.reserved": "Reserved",
    "bucket.quarantined": "Quarantined",
    "bucket.damaged": "Damaged",
    "bucket.in_transit": "In transit",
    "bucket.availableToPromise": "Available to promise (ATP)",

    // ── ProductImportPage ─────────────────────────────────────────
    "import.title": "Product import",
    "import.description":
      "Upload a CSV or XLSX product file — we always start with a dry-run to show the report before any real insert.",
    "import.step1": "Upload file",
    "import.step2": "Report",
    "import.stepsAria": "Import steps",
    "import.format": "Format",
    "import.file": "File",
    "import.chooseFile": "Choose file",
    "import.fileHint": "A {format} file with columns: nameAr, nameEn, kind.",
    "import.fileSelected": "Selected file: {name} ({size})",
    "import.fileMissing": "Choose a file first",
    "import.wrongExtension":
      "The selected file does not match the {format} format",
    "import.readFailed": "Could not read the file",
    "import.executeActually": "Execute for real (insert data)",
    "import.executeHint":
      "Without this option the run only validates and inserts nothing.",
    "import.runDry": "Run dry-run",
    "import.runReal": "Run for real",
    "import.next": "Next",
    "import.confirmRealTitle": "Confirm real execution",
    "import.confirmRealBody":
      "With this option the file rows will be actually inserted into the catalog, not merely validated. Review the dry-run report first if you haven't. Continue?",
    "import.running": "Processing…",
    "import.reportTitle": "Import report",
    "import.badge.dryRun": "Dry run",
    "import.badge.real": "Real execution",
    "import.totalRows": "Total rows",
    "import.createdCount": "Rows created",
    "import.errorsCount": "Errors",
    "import.progressLabel": "Accepted rows percentage",
    "import.successBanner":
      "Processing succeeded — all rows are clean with no errors.",
    "import.partialBanner":
      "Processing finished: {created} of {total} rows. Fix the failing rows and upload the file again.",
    "import.errorsTitle": "Rows with errors",
    "import.errorsHint":
      "These rows will not be imported; fix the reasons below in your file and re-upload.",
    "import.errorsAria": "Import errors table",
    "import.col.row": "Row",
    "import.col.reason": "Reason",
    "import.startOver": "Import another file",
    "import.importFailed": "Import failed",
    "import.backToProducts": "Back to products",
  },
} as const;
