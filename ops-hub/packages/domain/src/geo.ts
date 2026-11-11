export interface Governorate {
  /** Canonical, stable short code for this governorate. */
  code: string;
  nameEn: string;
  nameAr: string;
  /** Alternate spellings/transliterations that should still resolve here. */
  aliases: readonly string[];
}

export interface District {
  code: string;
  governorateCode: string;
  nameEn: string;
  nameAr: string;
  aliases: readonly string[];
}

/**
 * Egypt's 27 governorates. Codes are short, stable mnemonics chosen for this
 * project — they are NOT a claim of ISO 3166-2:EG conformance. If an
 * integration ever needs the official ISO codes, verify and remap there;
 * do not assume these match.
 */
export const GOVERNORATES: readonly Governorate[] = [
  {
    code: "CAI",
    nameEn: "Cairo",
    nameAr: "القاهرة",
    aliases: ["cairo", "al qahirah"],
  },
  {
    code: "ALX",
    nameEn: "Alexandria",
    nameAr: "الإسكندرية",
    aliases: ["alexandria", "alex"],
  },
  {
    code: "GIZ",
    nameEn: "Giza",
    nameAr: "الجيزة",
    aliases: ["giza", "gizeh", "el giza"],
  },
  {
    code: "QLY",
    nameEn: "Qalyubia",
    nameAr: "القليوبية",
    aliases: ["qalyubia", "kalyubia"],
  },
  {
    code: "PTS",
    nameEn: "Port Said",
    nameAr: "بورسعيد",
    aliases: ["port said", "bor said"],
  },
  { code: "SUZ", nameEn: "Suez", nameAr: "السويس", aliases: ["suez"] },
  {
    code: "DKH",
    nameEn: "Dakahlia",
    nameAr: "الدقهلية",
    aliases: ["dakahlia", "daqahlia"],
  },
  {
    code: "SHR",
    nameEn: "Sharqia",
    nameAr: "الشرقية",
    aliases: ["sharqia", "al sharqia"],
  },
  {
    code: "GHR",
    nameEn: "Gharbia",
    nameAr: "الغربية",
    aliases: ["gharbia", "gharbeya"],
  },
  {
    code: "MNF",
    nameEn: "Monufia",
    nameAr: "المنوفية",
    aliases: ["monufia", "menoufia"],
  },
  {
    code: "KFS",
    nameEn: "Kafr el-Sheikh",
    nameAr: "كفر الشيخ",
    aliases: ["kafr el sheikh", "kafr al-sheikh"],
  },
  {
    code: "BHR",
    nameEn: "Beheira",
    nameAr: "البحيرة",
    aliases: ["beheira", "buhayra"],
  },
  {
    code: "ISM",
    nameEn: "Ismailia",
    nameAr: "الإسماعيلية",
    aliases: ["ismailia", "isma'iliyya"],
  },
  {
    code: "DMT",
    nameEn: "Damietta",
    nameAr: "دمياط",
    aliases: ["damietta", "dumyat"],
  },
  {
    code: "FYM",
    nameEn: "Faiyum",
    nameAr: "الفيوم",
    aliases: ["faiyum", "fayoum"],
  },
  {
    code: "BNS",
    nameEn: "Beni Suef",
    nameAr: "بني سويف",
    aliases: ["beni suef", "bani suwayf"],
  },
  {
    code: "MNY",
    nameEn: "Minya",
    nameAr: "المنيا",
    aliases: ["minya", "al minya"],
  },
  {
    code: "AST",
    nameEn: "Asyut",
    nameAr: "أسيوط",
    aliases: ["asyut", "assiut"],
  },
  {
    code: "SOH",
    nameEn: "Sohag",
    nameAr: "سوهاج",
    aliases: ["sohag", "souhag"],
  },
  { code: "QNA", nameEn: "Qena", nameAr: "قنا", aliases: ["qena", "qina"] },
  {
    code: "LXR",
    nameEn: "Luxor",
    nameAr: "الأقصر",
    aliases: ["luxor", "al luxor"],
  },
  { code: "ASN", nameEn: "Aswan", nameAr: "أسوان", aliases: ["aswan"] },
  {
    code: "RSA",
    nameEn: "Red Sea",
    nameAr: "البحر الأحمر",
    aliases: ["red sea", "bahr al ahmar"],
  },
  {
    code: "WAD",
    nameEn: "New Valley",
    nameAr: "الوادي الجديد",
    aliases: ["new valley", "wadi el gedid"],
  },
  {
    code: "MAT",
    nameEn: "Matrouh",
    nameAr: "مطروح",
    aliases: ["matrouh", "matruh"],
  },
  {
    code: "NSI",
    nameEn: "North Sinai",
    nameAr: "شمال سيناء",
    aliases: ["north sinai"],
  },
  {
    code: "SSI",
    nameEn: "South Sinai",
    nameAr: "جنوب سيناء",
    aliases: ["south sinai"],
  },
];

/**
 * A small, representative starter set — not exhaustive. Add districts as
 * real order data demands them; this is reference data, not a closed list.
 */
export const DISTRICTS: readonly District[] = [
  {
    code: "CAI-NSC",
    governorateCode: "CAI",
    nameEn: "Nasr City",
    nameAr: "مدينة نصر",
    aliases: ["nasr city"],
  },
  {
    code: "CAI-HLW",
    governorateCode: "CAI",
    nameEn: "Helwan",
    nameAr: "حلوان",
    aliases: ["helwan"],
  },
  {
    code: "CAI-MSR-GDD",
    governorateCode: "CAI",
    nameEn: "New Cairo",
    nameAr: "القاهرة الجديدة",
    aliases: ["new cairo"],
  },
  {
    code: "GIZ-6OCT",
    governorateCode: "GIZ",
    nameEn: "6th of October",
    nameAr: "٦ أكتوبر",
    aliases: ["6th of october", "6 october", "sixth of october"],
  },
  {
    code: "GIZ-DOK",
    governorateCode: "GIZ",
    nameEn: "Dokki",
    nameAr: "الدقي",
    aliases: ["dokki", "dokky"],
  },
  {
    code: "GIZ-MOH",
    governorateCode: "GIZ",
    nameEn: "Mohandessin",
    nameAr: "المهندسين",
    aliases: ["mohandessin", "mohandeseen"],
  },
  {
    code: "ALX-MNT",
    governorateCode: "ALX",
    nameEn: "Montaza",
    nameAr: "المنتزه",
    aliases: ["montaza", "montazah"],
  },
  {
    code: "ALX-SID",
    governorateCode: "ALX",
    nameEn: "Sidi Gaber",
    nameAr: "سيدي جابر",
    aliases: ["sidi gaber"],
  },
];

function normalize(value: string): string {
  return (
    value
      .trim()
      .toLowerCase()
      // Strip Arabic diacritics (tashkeel) so variants compare equal.
      .replace(/[ً-ْ]/g, "")
      .replace(/\s+/g, " ")
  );
}

function matches(
  normalizedInput: string,
  entry: {
    code: string;
    nameEn: string;
    nameAr: string;
    aliases: readonly string[];
  },
): boolean {
  if (normalize(entry.code) === normalizedInput) return true;
  if (normalize(entry.nameEn) === normalizedInput) return true;
  if (normalize(entry.nameAr) === normalizedInput) return true;
  return entry.aliases.some((alias) => normalize(alias) === normalizedInput);
}

/** Resolves free-text input (English, Arabic, or a known alias/typo) to the
 * canonical governorate code, or `null` if nothing matches. */
export function resolveGovernorate(input: string): string | null {
  const normalized = normalize(input);
  if (normalized === "") return null;
  const found = GOVERNORATES.find((governorate) =>
    matches(normalized, governorate),
  );
  return found?.code ?? null;
}

/** Resolves free-text input to the canonical district code, or `null`. */
export function resolveDistrict(input: string): string | null {
  const normalized = normalize(input);
  if (normalized === "") return null;
  const found = DISTRICTS.find((district) => matches(normalized, district));
  return found?.code ?? null;
}
