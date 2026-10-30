import { describe, expect, it } from "vitest";
import { normalizeForSearch } from "./textNormalize";

describe("normalizeForSearch", () => {
    it("returns an empty string for null and undefined", () => {
        expect(normalizeForSearch(null)).toBe("");
        expect(normalizeForSearch(undefined)).toBe("");
    });

    it("strips diacritics and lowercases", () => {
        expect(normalizeForSearch("CÓDIGO")).toBe("codigo");
        expect(normalizeForSearch("cliente.días_mora")).toBe("cliente.dias_mora");
        expect(normalizeForSearch("Ñandú Ágil")).toBe("nandu agil");
    });

    it("trims surrounding whitespace", () => {
        expect(normalizeForSearch("   codigo   ")).toBe("codigo");
        expect(normalizeForSearch("   ")).toBe("");
    });

    it("coerces non-string values", () => {
        expect(normalizeForSearch(42)).toBe("42");
        expect(normalizeForSearch(false)).toBe("false");
    });
});
