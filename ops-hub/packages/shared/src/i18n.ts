export type Locale = "en" | "ar";

const en = {
  "errors.invalid_phone": "Enter a valid Egyptian mobile number.",
  "errors.invalid_money": "Amounts must be whole piastres.",
  "errors.currency_mismatch": "Currencies must match.",
} as const;

const ar: Record<keyof typeof en, string> = {
  "errors.invalid_phone": "أدخل رقم موبايل مصري صحيح.",
  "errors.invalid_money": "يجب أن تكون المبالغ بالقرش الصحيح.",
  "errors.currency_mismatch": "يجب أن تتطابق العملات.",
};

export type MessageKey = keyof typeof en;

export const messages: Record<Locale, Record<MessageKey, string>> = { en, ar };

export function translate(locale: Locale, key: MessageKey): string {
  return messages[locale][key];
}
