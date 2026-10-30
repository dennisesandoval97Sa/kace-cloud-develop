import { describe, expect, it } from "vitest";
import { QUERY_KEYS } from "./query-keys.constants";

describe("QUERY_KEYS.BOARDS.RESOURCES", () => {
    it("keeps the three-argument key when no client is loaded", () => {
        expect(QUERY_KEYS.BOARDS.RESOURCES("b1", 1, { filter: [] })).toEqual([
            "boards",
            "resources",
            "b1",
            1,
            { filter: [] },
        ]);
    });

    it("appends the loaded client id so switching clients refetches", () => {
        expect(QUERY_KEYS.BOARDS.RESOURCES("b1", 1, { filter: [] }, "client-1")).toEqual([
            "boards",
            "resources",
            "b1",
            1,
            { filter: [] },
            "client-1",
        ]);
    });

    it("does not append an empty string active client id", () => {
        expect(QUERY_KEYS.BOARDS.RESOURCES("b1", 1, { filter: [] }, "")).toEqual([
            "boards",
            "resources",
            "b1",
            1,
            { filter: [] },
        ]);
    });

    it("does not append a non-string active client id", () => {
        expect(QUERY_KEYS.BOARDS.RESOURCES("b1", 1, { filter: [] }, 1)).toEqual([
            "boards",
            "resources",
            "b1",
            1,
            { filter: [] },
        ]);
        expect(QUERY_KEYS.BOARDS.RESOURCES("b1", 1, { filter: [] }, {})).toEqual([
            "boards",
            "resources",
            "b1",
            1,
            { filter: [] },
        ]);
    });
});
