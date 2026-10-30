import { describe, expect, it } from "vitest";
import { escapeLikePattern } from "./likePattern";

describe("escapeLikePattern", () => {
    it.each([
        ["%", "\\%"],
        ["_", "\\_"],
        ["\\", "\\\\"],
        ["100%_off\\", "100\\%\\_off\\\\"],
        ["perez", "perez"],
    ])("escapes %j into %j", (input, expected) => {
        expect(escapeLikePattern(input)).toBe(expected);
    });

    it("coerces nullish values to an empty string", () => {
        expect(escapeLikePattern(null)).toBe("");
        expect(escapeLikePattern(undefined)).toBe("");
    });
});
