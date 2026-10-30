import { describe, it, expect } from "vitest";
import { DEFAULT_FIELDS_OPTIONS } from "./constants";

describe("DEFAULT_FIELDS_OPTIONS", () => {
    it("contains the states entry between classifications and aux_cases", () => {
        const statesIndex = DEFAULT_FIELDS_OPTIONS.findIndex((o) => o.text === "states");
        const classificationsIndex = DEFAULT_FIELDS_OPTIONS.findIndex((o) => o.text === "classifications");
        const auxCasesIndex = DEFAULT_FIELDS_OPTIONS.findIndex((o) => o.text === "aux_cases");

        expect(statesIndex).toBeGreaterThan(classificationsIndex);
        expect(statesIndex).toBeLessThan(auxCasesIndex);

        const states = DEFAULT_FIELDS_OPTIONS[statesIndex];
        expect(states).toEqual({ text: "states", schema: "estados", url: "estados" });
    });
});
