import { describe, expect, it } from "vitest";
import { resolveSafePageIndex } from "./resolveSafePageIndex";

describe("resolveSafePageIndex", () => {
    it("keeps the current page when it still has rows", () => {
        expect(resolveSafePageIndex(2, 30, 10)).toBe(2);
    });

    it("resets to the first page when filters leave the page out of range", () => {
        expect(resolveSafePageIndex(4, 5, 10)).toBe(0);
        expect(resolveSafePageIndex(3, 10, 10)).toBe(0);
    });

    it("resets to the first page when there are no rows", () => {
        expect(resolveSafePageIndex(2, 0, 10)).toBe(0);
    });

    it("treats invalid page indexes as the first page", () => {
        expect(resolveSafePageIndex(-1, 30, 10)).toBe(0);
        expect(resolveSafePageIndex(Number.NaN, 30, 10)).toBe(0);
    });
});
