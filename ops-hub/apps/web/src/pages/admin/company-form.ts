export interface CompanyProfile {
  name: string;
  timezone: string;
  defaultCurrency: string;
  countryCode: string;
  allowNegativeStock: boolean;
}

export const TIMEZONES = [
  "Africa/Cairo",
  "Asia/Riyadh",
  "Asia/Dubai",
  "Asia/Kuwait",
  "Asia/Qatar",
  "Asia/Amman",
  "Europe/London",
  "America/New_York",
  "UTC",
] as const;

export const CURRENCIES = ["EGP", "USD", "EUR", "SAR", "AED"] as const;
export const COUNTRIES = [
  "EG",
  "SA",
  "AE",
  "KW",
  "QA",
  "JO",
  "US",
  "GB",
] as const;

/** Only the fields that differ from the saved profile are sent, so an unchanged field can't overwrite a concurrent edit. */
export function changedFields(
  saved: CompanyProfile,
  draft: CompanyProfile,
): Partial<CompanyProfile> {
  const patch: Partial<CompanyProfile> = {};
  if (draft.name.trim() !== saved.name) patch.name = draft.name.trim();
  if (draft.timezone !== saved.timezone) patch.timezone = draft.timezone;
  if (draft.defaultCurrency !== saved.defaultCurrency)
    patch.defaultCurrency = draft.defaultCurrency;
  if (draft.countryCode !== saved.countryCode)
    patch.countryCode = draft.countryCode;
  if (draft.allowNegativeStock !== saved.allowNegativeStock)
    patch.allowNegativeStock = draft.allowNegativeStock;
  return patch;
}
