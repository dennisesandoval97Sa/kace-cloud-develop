import { describe, expect, it } from "vitest";
import { mergeAndLimitResults } from "./mergeSearchResults";

describe("mergeAndLimitResults", () => {
    it("merges the pages preserving their order", () => {
        const merged = mergeAndLimitResults(
            [{ data: [{ id: "a" }] }, { data: [{ id: "b" }] }, { data: [{ id: "c" }] }],
            10,
        );

        expect(merged.map((item) => item.id)).toEqual(["a", "b", "c"]);
    });

    it("de-duplicates by id, keeping the first occurrence", () => {
        const merged = mergeAndLimitResults(
            [
                { data: [{ id: "a", from: "nombres" }] },
                { data: [{ id: "a", from: "apellido1" }] },
                { data: [{ id: "b", from: "apellido2" }] },
            ],
            10,
        );

        expect(merged).toEqual([
            { id: "a", from: "nombres" },
            { id: "b", from: "apellido2" },
        ]);
    });

    it("caps the merged list to the limit", () => {
        const page = (prefix) => ({ data: Array.from({ length: 25 }, (_, i) => ({ id: `${prefix}-${i}` })) });

        const merged = mergeAndLimitResults([page("a"), page("b"), page("c")], 20);

        expect(merged).toHaveLength(20);
    });

    it("tolerates null/undefined results and missing data arrays", () => {
        const merged = mergeAndLimitResults([null, undefined, {}, { data: null }, { data: [{ id: "a" }] }], 5);

        expect(merged).toEqual([{ id: "a" }]);
    });

    it("skips items without an id", () => {
        const merged = mergeAndLimitResults([{ data: [{ id: null }, { id: undefined }, { id: "a" }] }], 5);

        expect(merged).toEqual([{ id: "a" }]);
    });

    it("returns every merged item when the limit is not a finite number", () => {
        const merged = mergeAndLimitResults([{ data: [{ id: "a" }, { id: "b" }] }], Infinity);

        expect(merged).toHaveLength(2);
    });
});
