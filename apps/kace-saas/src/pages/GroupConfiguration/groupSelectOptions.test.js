import { describe, expect, it } from "vitest";
import { buildGroupSelectOptions } from "./groupSelectOptions";

const groups = [
    { id: "2", nombre: "Zebra" },
    { id: "1", nombre: "Alpha" },
    { id: "3", nombre: "beta" },
];

describe("buildGroupSelectOptions", () => {
    it("maps id/nombre and sorts alphabetically by label", () => {
        expect(buildGroupSelectOptions(groups)).toEqual([
            { value: "1", label: "Alpha" },
            { value: "3", label: "beta" },
            { value: "2", label: "Zebra" },
        ]);
    });

    it("filters by case-insensitive substring on label", () => {
        expect(buildGroupSelectOptions(groups, "BE")).toEqual([{ value: "3", label: "beta" }]);
    });

    it("returns full sorted list when search is blank or whitespace", () => {
        expect(buildGroupSelectOptions(groups, "   ")).toEqual([
            { value: "1", label: "Alpha" },
            { value: "3", label: "beta" },
            { value: "2", label: "Zebra" },
        ]);
    });

    it("returns empty array for empty or non-array groups", () => {
        expect(buildGroupSelectOptions([])).toEqual([]);
        expect(buildGroupSelectOptions(null)).toEqual([]);
        expect(buildGroupSelectOptions(undefined)).toEqual([]);
    });
});
