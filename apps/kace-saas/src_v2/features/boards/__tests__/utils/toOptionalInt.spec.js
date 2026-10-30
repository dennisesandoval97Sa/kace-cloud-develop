import { describe, it, expect } from "vitest";
import { toOptionalInt } from "@kace_v2/features/boards/utils/toOptionalInt.util";

describe("toOptionalInt", () => {
    it.each([
        ["", "empty string"],
        [null, "null"],
        [undefined, "undefined"],
    ])("returns the fallback for %p (%s)", (input) => {
        expect(toOptionalInt(input, "FALLBACK")).toBe("FALLBACK");
    });

    it.each([
        ["7", 7],
        [" 7 ", 7],
        [7, 7],
        ["0", 0],
        ["-3", -3],
    ])("converts %p to %p", (input, expected) => {
        expect(toOptionalInt(input, "FALLBACK")).toBe(expected);
    });

    it.each([["abc"], ["1.5"], [1.5], [NaN], ["12px"]])("returns the fallback for the non-integer %p", (input) => {
        expect(toOptionalInt(input, "FALLBACK")).toBe("FALLBACK");
    });

    it("supports different fallbacks for the form and for the API payload", () => {
        expect(toOptionalInt("", "")).toBe("");
        expect(toOptionalInt("", null)).toBeNull();
        expect(toOptionalInt("", 25)).toBe(25);
    });
});
