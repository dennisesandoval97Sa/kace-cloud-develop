import { describe, it, expect } from "vitest";
import { transformNivelField, createNivelFieldTransformer, transformNivelFilters } from "./transformNivelFilters";

describe("transformNivelField", () => {
    it("prefixes with clasificaciones. in classic view", () => {
        expect(transformNivelField("nivel3", { isCustomView: false })).toBe("clasificaciones.nivel3");
    });

    it("leaves the field flat in custom view when no maxLevel is given", () => {
        expect(transformNivelField("nivel3", { isCustomView: true })).toBe("nivel3");
    });

    it("leaves the field flat in custom view when within maxLevel", () => {
        expect(transformNivelField("nivel3", { isCustomView: true, maxLevel: 5 })).toBe("nivel3");
    });

    it("returns null in custom view when the level exceeds maxLevel", () => {
        expect(transformNivelField("nivel7", { isCustomView: true, maxLevel: 5 })).toBeNull();
    });

    it("ignores maxLevel in classic view (clasificaciones join always has all 10 levels)", () => {
        expect(transformNivelField("nivel9", { isCustomView: false, maxLevel: 3 })).toBe("clasificaciones.nivel9");
    });

    it("returns non-nivel fields untouched", () => {
        expect(transformNivelField("reference", { isCustomView: true, maxLevel: 2 })).toBe("reference");
    });
});

describe("createNivelFieldTransformer", () => {
    it("builds a transformer that drops out-of-range levels for custom views", () => {
        const transform = createNivelFieldTransformer({ isCustomView: true, maxLevel: 2 });
        expect(transform("nivel1")).toBe("nivel1");
        expect(transform("nivel2")).toBe("nivel2");
        expect(transform("nivel3")).toBeNull();
    });
});

describe("transformNivelFilters (unaffected by the maxLevel addition to transformNivelField)", () => {
    it("still prefixes nivel columns for classic view", () => {
        const filters = [{ field: "nivel4", value: "x", operator: "eq", type: "AND" }];
        expect(transformNivelFilters(filters, { isCustomView: false })).toEqual([
            { field: "clasificaciones.nivel4", value: "x", operator: "eq", type: "AND" },
        ]);
    });

    it("handles fields that already have the clasificaciones. prefix", () => {
        const filters = [{ field: "clasificaciones.nivel3", value: "Foo", operator: "eq", type: "AND" }];
        expect(transformNivelFilters(filters, { isCustomView: false })).toEqual([
            { field: "clasificaciones.nivel3", value: "Foo", operator: "eq", type: "AND" },
        ]);
    });
});
