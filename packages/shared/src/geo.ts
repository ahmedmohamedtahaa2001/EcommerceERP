/**
 * Egyptian geo reference data: governorates and common districts.
 *
 * Canonical codes are short stable identifiers used by the rest of the
 * system (locations, addresses, routing). Spelling variants let callers
 * resolve free-text input such as "Gizeh" or "الجيزة" to a canonical code.
 */

export interface Governorate {
  code: string;
  nameAr: string;
  nameEn: string;
  variants: string[];
}

export interface District {
  code: string;
  governorateCode: string;
  nameAr: string;
  nameEn: string;
  variants: string[];
}

function norm(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

const GOVERNORATES: Governorate[] = [
  { code: "CAI", nameAr: "القاهرة", nameEn: "Cairo", variants: ["cairo", "al qahira", "al-qahira", "القاهرة", "قاهرة", "el qahira"] },
  { code: "GIZ", nameAr: "الجيزة", nameEn: "Giza", variants: ["giza", "gizeh", "el giza", "al giza", "الجيزة", "جيزة", "gizah"] },
  { code: "ALX", nameAr: "الإسكندرية", nameEn: "Alexandria", variants: ["alexandria", "alex", "al iskandariya", "الإسكندرية", "اسكندرية", "إسكندرية"] },
  { code: "DKH", nameAr: "الدقهلية", nameEn: "Dakahlia", variants: ["dakahlia", "dakahliah", "الدقهلية", "دقهلية"] },
  { code: "SHR", nameAr: "الشرقية", nameEn: "Sharqia", variants: ["sharqia", "sharkia", "el sharqia", "الشرقية", "شرقية"] },
  { code: "QAL", nameAr: "القليوبية", nameEn: "Qalyubia", variants: ["qalyubia", "qualyubia", "القليوبية", "قليوبية"] },
  { code: "KFS", nameAr: "كفر الشيخ", nameEn: "Kafr El Sheikh", variants: ["kafr el sheikh", "kafr elsheikh", "كفر الشيخ", "كفرالشيخ"] },
  { code: "GH", nameAr: "الغربية", nameEn: "Gharbia", variants: ["gharbia", "gharbiya", "الغربية", "غربية"] },
  { code: "MNF", nameAr: "المنوفية", nameEn: "Menofia", variants: ["menofia", "monufia", "المنوفية", "منوفية"] },
  { code: "BEH", nameAr: "البحيرة", nameEn: "Beheira", variants: ["beheira", "behera", "البحيرة", "بحيرة"] },
  { code: "IS", nameAr: "الإسماعيلية", nameEn: "Ismailia", variants: ["ismailia", "ismailiya", "الإسماعيلية", "اسماعيلية", "إسماعيلية"] },
  { code: "PTS", nameAr: "بورسعيد", nameEn: "Port Said", variants: ["port said", "portsaid", "بورسعيد"] },
  { code: "SUZ", nameAr: "السويس", nameEn: "Suez", variants: ["suez", "السويس", "سويس"] },
  { code: "NS", nameAr: "شمال سيناء", nameEn: "North Sinai", variants: ["north sinai", "shamal sina", "شمال سيناء"] },
  { code: "SS", nameAr: "جنوب سيناء", nameEn: "South Sinai", variants: ["south sinai", "janub sina", "جنوب سيناء"] },
  { code: "FYM", nameAr: "الفيوم", nameEn: "Fayoum", variants: ["fayoum", "faiyum", "fayum", "الفيوم", "فيوم"] },
  { code: "BNS", nameAr: "بني سويف", nameEn: "Beni Suef", variants: ["beni suef", "beni sueif", "bani suwaif", "بني سويف", "بني سويف"] },
  { code: "MNY", nameAr: "المنيا", nameEn: "Minya", variants: ["minya", "el minya", "المنيا", "منيا"] },
  { code: "AST", nameAr: "أسيوط", nameEn: "Assiut", variants: ["assiut", "asyut", "أسيوط", "اسيوط"] },
  { code: "SOH", nameAr: "سوهاج", nameEn: "Sohag", variants: ["sohag", "sohag", "سوهاج"] },
  { code: "QNA", nameAr: "قنا", nameEn: "Qena", variants: ["qena", "qina", "قنا"] },
  { code: "LUX", nameAr: "الأقصر", nameEn: "Luxor", variants: ["luxor", "al uqsur", "الأقصر", "اقصر"] },
  { code: "ASN", nameAr: "أسوان", nameEn: "Aswan", variants: ["aswan", "assuan", "أسوان", "اسوان"] },
  { code: "RED", nameAr: "البحر الأحمر", nameEn: "Red Sea", variants: ["red sea", "al bahr al ahmar", "البحر الأحمر", "بحر احمر"] },
  { code: "MAT", nameAr: "مطروح", nameEn: "Matrouh", variants: ["matrouh", "matruh", "مطروح"] },
  { code: "WAD", nameAr: "الوادي الجديد", nameEn: "New Valley", variants: ["new valley", "al wadi al jadid", "الوادي الجديد", "وادي جديد"] },
  { code: "DAM", nameAr: "دمياط", nameEn: "Damietta", variants: ["damietta", "dumyat", "دمياط"] },
];

const DISTRICTS: District[] = [
  // Cairo
  { code: "CAI-NASR", governorateCode: "CAI", nameAr: "مدينة نصر", nameEn: "Nasr City", variants: ["nasr city", "مدينة نصر", "nasr"] },
  { code: "CAI-HEL", governorateCode: "CAI", nameAr: "حلوان", nameEn: "Helwan", variants: ["helwan", "حلوان"] },
  { code: "CAI-MAA", governorateCode: "CAI", nameAr: "المعادي", nameEn: "Maadi", variants: ["maadi", "المعادي"] },
  { code: "CAI-ZAM", governorateCode: "CAI", nameAr: "الزمالك", nameEn: "Zamalek", variants: ["zamalek", "الزمالك"] },
  { code: "CAI-HLI", governorateCode: "CAI", nameAr: "مصر الجديدة", nameEn: "Heliopolis", variants: ["heliopolis", "مصر الجديدة", "masr el gedida"] },
  { code: "CAI-SBR", governorateCode: "CAI", nameAr: "شبرا", nameEn: "Shubra", variants: ["shubra", "شبرا"] },
  // Giza
  { code: "GIZ-6OCT", governorateCode: "GIZ", nameAr: "6 أكتوبر", nameEn: "6th of October", variants: ["6th of october", "6 october", "6 أكتوبر", "أكتوبر"] },
  { code: "GIZ-SHP", governorateCode: "GIZ", nameAr: "الشيخ زايد", nameEn: "Sheikh Zayed", variants: ["sheikh zayed", "الشيخ زايد"] },
  { code: "GIZ-HRM", governorateCode: "GIZ", nameAr: "الهرم", nameEn: "Haram", variants: ["haram", "الهرم"] },
  { code: "GIZ-IMB", governorateCode: "GIZ", nameAr: "إمبابة", nameEn: "Imbaba", variants: ["imbaba", "إمبابة"] },
  { code: "GIZ-DKR", governorateCode: "GIZ", nameAr: "الدقى", nameEn: "Dokki", variants: ["dokki", "الدقى"] },
  // Alexandria
  { code: "ALX-SMO", governorateCode: "ALX", nameAr: "سموحة", nameEn: "Smouha", variants: ["smouha", "سموحة"] },
  { code: "ALX-MNT", governorateCode: "ALX", nameAr: "المنتزه", nameEn: "Montaza", variants: ["montaza", "المنتزه"] },
  { code: "ALX-AGM", governorateCode: "ALX", nameAr: "أجامي", nameEn: "Agami", variants: ["agami", "أجامي"] },
  // Sharqia
  { code: "SHR-ZAG", governorateCode: "SHR", nameAr: "الزقازيق", nameEn: "Zagazig", variants: ["zagazig", "الزقازيق"] },
  { code: "SHR-10RAM", governorateCode: "SHR", nameAr: "العاشر من رمضان", nameEn: "10th of Ramadan", variants: ["10th of ramadan", "العاشر من رمضان"] },
  // Dakahlia
  { code: "DKH-MNS", governorateCode: "DKH", nameAr: "المنصورة", nameEn: "Mansoura", variants: ["mansoura", "المنصورة"] },
  { code: "DKH-MIT", governorateCode: "DKH", nameAr: "ميت غمر", nameEn: "Mit Ghamr", variants: ["mit ghamr", "ميت غمر"] },
  // Qalyubia
  { code: "QAL-BAN", governorateCode: "QAL", nameAr: "بنها", nameEn: "Banha", variants: ["banha", "بنها"] },
  { code: "QAL-SHB", governorateCode: "QAL", nameAr: "شبرا الخيمة", nameEn: "Shubra El Kheima", variants: ["shubra el kheima", "شبرا الخيمة"] },
  // Beheira
  { code: "BEH-DAM", governorateCode: "BEH", nameAr: "دمنهور", nameEn: "Damanhour", variants: ["damanhour", "دمنهور"] },
  // Gharbia
  { code: "GH-TAN", governorateCode: "GH", nameAr: "طنطا", nameEn: "Tanta", variants: ["tanta", "طنطا"] },
  // Menofia
  { code: "MNF-SHB", governorateCode: "MNF", nameAr: "شبين الكوم", nameEn: "Shibin El Kom", variants: ["shibin el kom", "شبين الكوم"] },
  // Fayoum
  { code: "FYM-FYM", governorateCode: "FYM", nameAr: "الفيوم", nameEn: "Fayoum", variants: ["fayoum", "الفيوم"] },
  // Beni Suef
  { code: "BNS-BNS", governorateCode: "BNS", nameAr: "بني سويف", nameEn: "Beni Suef", variants: ["beni suef", "بني سويف"] },
  // Minya
  { code: "MNY-MNY", governorateCode: "MNY", nameAr: "المنيا", nameEn: "Minya", variants: ["minya", "المنيا"] },
  // Assiut
  { code: "AST-AST", governorateCode: "AST", nameAr: "أسيوط", nameEn: "Assiut", variants: ["assiut", "أسيوط"] },
  // Sohag
  { code: "SOH-SOH", governorateCode: "SOH", nameAr: "سوهاج", nameEn: "Sohag", variants: ["sohag", "سوهاج"] },
  // Qena
  { code: "QNA-QNA", governorateCode: "QNA", nameAr: "قنا", nameEn: "Qena", variants: ["qena", "قنا"] },
  // Aswan
  { code: "ASN-ASN", governorateCode: "ASN", nameAr: "أسوان", nameEn: "Aswan", variants: ["aswan", "أسوان"] },
  // Luxor
  { code: "LUX-LUX", governorateCode: "LUX", nameAr: "الأقصر", nameEn: "Luxor", variants: ["luxor", "الأقصر"] },
  // Ismailia
  { code: "IS-IS", governorateCode: "IS", nameAr: "الإسماعيلية", nameEn: "Ismailia", variants: ["ismailia", "الإسماعيلية"] },
  // Suez
  { code: "SUZ-SUZ", governorateCode: "SUZ", nameAr: "السويس", nameEn: "Suez", variants: ["suez", "السويس"] },
  // Port Said
  { code: "PTS-PTS", governorateCode: "PTS", nameAr: "بورسعيد", nameEn: "Port Said", variants: ["port said", "بورسعيد"] },
  // Damietta
  { code: "DAM-DAM", governorateCode: "DAM", nameAr: "دمياط", nameEn: "Damietta", variants: ["damietta", "دمياط"] },
  // Matrouh
  { code: "MAT-MAT", governorateCode: "MAT", nameAr: "مطروح", nameEn: "Matrouh", variants: ["matrouh", "مطروح"] },
];

const GOVERNORATE_BY_CODE = new Map(GOVERNORATES.map((g) => [g.code, g]));
const GOVERNORATE_VARIANTS = new Map<string, string>();
for (const g of GOVERNORATES) {
  GOVERNORATE_VARIANTS.set(norm(g.code), g.code);
  GOVERNORATE_VARIANTS.set(norm(g.nameEn), g.code);
  GOVERNORATE_VARIANTS.set(norm(g.nameAr), g.code);
  for (const v of g.variants) {
    GOVERNORATE_VARIANTS.set(norm(v), g.code);
  }
}

const DISTRICT_BY_CODE = new Map(DISTRICTS.map((d) => [d.code, d]));
const DISTRICT_VARIANTS = new Map<string, string>();
for (const d of DISTRICTS) {
  DISTRICT_VARIANTS.set(norm(d.code), d.code);
  DISTRICT_VARIANTS.set(norm(d.nameEn), d.code);
  DISTRICT_VARIANTS.set(norm(d.nameAr), d.code);
  for (const v of d.variants) {
    DISTRICT_VARIANTS.set(norm(v), d.code);
  }
}

export function listGovernorates(): Governorate[] {
  return GOVERNORATES;
}

export function listDistricts(governorateCode?: string): District[] {
  if (!governorateCode) return DISTRICTS;
  const code = resolveGovernorate(governorateCode) ?? governorateCode;
  return DISTRICTS.filter((d) => d.governorateCode === code);
}

export function resolveGovernorate(input: string): string | null {
  if (typeof input !== "string") return null;
  const key = norm(input);
  if (key === "") return null;
  return GOVERNORATE_VARIANTS.get(key) ?? null;
}

export function resolveDistrict(input: string): string | null {
  if (typeof input !== "string") return null;
  const key = norm(input);
  if (key === "") return null;
  return DISTRICT_VARIANTS.get(key) ?? null;
}

export function getGovernorate(code: string): Governorate | null {
  return GOVERNORATE_BY_CODE.get(code) ?? null;
}

export function getDistrict(code: string): District | null {
  return DISTRICT_BY_CODE.get(code) ?? null;
}
