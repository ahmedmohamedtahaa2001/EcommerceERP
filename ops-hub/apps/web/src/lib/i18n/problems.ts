/** Server error codes (the end of a problem `type` URL) in the reader's language. */
const entries: Array<[code: string, ar: string, en: string]> = [
  [
    "network",
    "تعذر الاتصال بالخادم. تحقق من الاتصال وحاول مرة أخرى.",
    "Could not reach the server. Check your connection and try again.",
  ],
  ["api-key-not-found", "مفتاح الـ API غير موجود.", "API key not found."],
  [
    "bin-capacity-exceeded",
    "الكمية أكبر من السعة المتبقية في الرف.",
    "That quantity exceeds the bin's remaining capacity.",
  ],
  ["bin-not-found", "الرف غير موجود.", "Bin not found."],
  ["customer-not-found", "العميل غير موجود.", "Customer not found."],
  [
    "duplicate-barcode",
    "هذا الباركود مستخدم لمنتج آخر.",
    "That barcode is already used by another product.",
  ],
  [
    "duplicate-bin-code",
    "يوجد رف بهذا الكود بالفعل في هذا المخزن.",
    "A bin with that code already exists in this location.",
  ],
  [
    "duplicate-email",
    "هذا البريد الإلكتروني مستخدم بالفعل.",
    "That email is already in use.",
  ],
  [
    "duplicate-location-code",
    "يوجد مخزن بهذا الكود بالفعل.",
    "A location with that code already exists.",
  ],
  [
    "duplicate-phone",
    "يوجد عميل بهذا الرقم بالفعل.",
    "A customer with that phone number already exists.",
  ],
  [
    "duplicate-sku",
    "هذا الـ SKU مستخدم بالفعل.",
    "That SKU is already in use.",
  ],
  [
    "email-taken",
    "يوجد حساب بهذا البريد الإلكتروني بالفعل.",
    "An account with that email already exists.",
  ],
  [
    "exception-already-resolved",
    "تم حل هذه المشكلة بالفعل.",
    "This exception is already resolved.",
  ],
  ["exception-not-found", "المشكلة غير موجودة.", "Exception not found."],
  [
    "export-too-large",
    "عدد الصفوف أكبر من الحد المسموح للتصدير. ضيّق نطاق التاريخ.",
    "Too many rows to export. Narrow the date range.",
  ],
  [
    "forbidden",
    "ليست لديك صلاحية لتنفيذ هذا الإجراء.",
    "You don't have permission to do that.",
  ],
  [
    "idempotency-conflict",
    "تم إرسال هذا الطلب بالفعل ببيانات مختلفة. حدّث الصفحة وحاول مرة أخرى.",
    "This request was already sent with different data. Refresh and try again.",
  ],
  [
    "insufficient-stock",
    "المخزون المتاح غير كافٍ.",
    "Not enough stock available.",
  ],
  [
    "insufficient-unassigned-stock",
    "لا توجد كمية كافية غير موزعة على الرفوف.",
    "Not enough stock left unassigned to bins.",
  ],
  ["invalid-api-key", "مفتاح الـ API غير صالح.", "Invalid API key."],
  [
    "invalid-credentials",
    "البريد الإلكتروني أو كلمة المرور غير صحيحة.",
    "Incorrect email or password.",
  ],
  [
    "invalid-request",
    "بعض البيانات غير صحيحة. راجع الحقول وحاول مرة أخرى.",
    "Some of the data is invalid. Check the fields and try again.",
  ],
  [
    "invalid-transition",
    "لا يمكن نقل الطلب إلى هذه الحالة من حالته الحالية.",
    "The order can't move to that status from its current one.",
  ],
  [
    "ip-not-allowed",
    "هذا العنوان غير مسموح له بالدخول.",
    "Access from this address is not allowed.",
  ],
  [
    "last-owner",
    "يجب أن يبقى مالك نشط واحد على الأقل.",
    "At least one active owner must remain.",
  ],
  [
    "location-has-stock",
    "لا يمكن تعطيل مخزن به مخزون.",
    "A location that still holds stock can't be deactivated.",
  ],
  ["location-not-found", "المخزن غير موجود.", "Location not found."],
  ["member-not-found", "العضو غير موجود.", "Team member not found."],
  [
    "missing-scope",
    "هذا المفتاح لا يملك الصلاحية المطلوبة.",
    "This key lacks the required scope.",
  ],
  [
    "not-a-duplicate-exception",
    "هذه المشكلة ليست طلبًا مكررًا.",
    "This exception is not a duplicate order.",
  ],
  ["order-not-found", "الطلب غير موجود.", "Order not found."],
  ["product-not-found", "المنتج غير موجود.", "Product not found."],
  [
    "rate-limited",
    "محاولات كثيرة. انتظر قليلًا ثم حاول مرة أخرى.",
    "Too many attempts. Wait a moment and try again.",
  ],
  [
    "reservation-already-closed",
    "هذا الحجز مغلق بالفعل.",
    "This reservation is already closed.",
  ],
  ["reservation-not-found", "الحجز غير موجود.", "Reservation not found."],
  [
    "self-change-not-allowed",
    "لا يمكنك تغيير دورك أو تعطيل حسابك.",
    "You can't change your own role or deactivate yourself.",
  ],
  [
    "sku-immutable",
    "لا يمكن تغيير الـ SKU بعد إنشائه.",
    "A SKU can't be changed once created.",
  ],
  ["sku-not-found", "الـ SKU غير موجود.", "SKU not found."],
  [
    "stock-reference-not-found",
    "المنتج أو المخزن غير موجود.",
    "The product or location was not found.",
  ],
  [
    "unauthenticated",
    "انتهت الجلسة. سجّل الدخول مرة أخرى.",
    "Your session has ended. Sign in again.",
  ],
  [
    "unknown-sku",
    "يوجد SKU غير معروف في البيانات.",
    "The data contains an unknown SKU.",
  ],
  ["variant-not-found", "المنتج غير موجود.", "Product variant not found."],
];

export const dict = {
  ar: Object.fromEntries(entries.map(([code, ar]) => [`problem.${code}`, ar])),
  en: Object.fromEntries(
    entries.map(([code, , en]) => [`problem.${code}`, en]),
  ),
};
