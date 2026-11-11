import { describe, expect, it } from "vitest";

import {
  DISTRICTS,
  GOVERNORATES,
  resolveDistrict,
  resolveGovernorate,
} from "../src/geo";

describe("resolveGovernorate", () => {
  it("resolves the canonical code from English, Arabic, and known spelling variants", () => {
    expect(resolveGovernorate("Giza")).toBe("GIZ");
    expect(resolveGovernorate("gizeh")).toBe("GIZ");
    expect(resolveGovernorate("الجيزة")).toBe("GIZ");
    expect(resolveGovernorate("GIZ")).toBe("GIZ");
  });

  it("is case-insensitive and tolerant of surrounding whitespace", () => {
    expect(resolveGovernorate("  CAIRO  ")).toBe("CAI");
    expect(resolveGovernorate("cAiRo")).toBe("CAI");
  });

  it("strips Arabic diacritics before comparing", () => {
    expect(resolveGovernorate("القاهِرة")).toBe("CAI");
  });

  it("returns null for unknown input", () => {
    expect(resolveGovernorate("Atlantis")).toBeNull();
    expect(resolveGovernorate("")).toBeNull();
  });

  it("has exactly 27 governorates, each with a unique code", () => {
    expect(GOVERNORATES).toHaveLength(27);
    expect(new Set(GOVERNORATES.map((g) => g.code)).size).toBe(27);
  });
});

describe("resolveDistrict", () => {
  it("resolves a known district by English, Arabic, or alias", () => {
    expect(resolveDistrict("6th of October")).toBe("GIZ-6OCT");
    expect(resolveDistrict("6 october")).toBe("GIZ-6OCT");
    expect(resolveDistrict("الدقي")).toBe("GIZ-DOK");
  });

  it("returns null for unknown input", () => {
    expect(resolveDistrict("Nowhereville")).toBeNull();
  });

  it("every district points at a real governorate code", () => {
    const codes = new Set(GOVERNORATES.map((g) => g.code));
    for (const district of DISTRICTS) {
      expect(codes.has(district.governorateCode)).toBe(true);
    }
  });
});
