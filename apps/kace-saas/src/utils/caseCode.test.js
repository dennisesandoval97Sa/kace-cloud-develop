import { describe, it, expect } from "vitest";
import { getCaseCode, getCaseCodeSuffix } from "./caseCode.js";

describe("getCaseCode", () => {
    it("returns the external code when the case has one", () => {
        expect(getCaseCode({ external_code: "202630070000001", folio: "AS-0001" })).toBe("202630070000001");
    });

    it("falls back to the folio when the external code is null", () => {
        expect(getCaseCode({ external_code: null, folio: "AS-0001" })).toBe("AS-0001");
    });

    it("falls back to the folio when the external code is an empty string", () => {
        expect(getCaseCode({ external_code: "", folio: "AS-0001" })).toBe("AS-0001");
    });

    it("returns an empty string when the case has neither", () => {
        expect(getCaseCode({ external_code: null, folio: null })).toBe("");
    });

    it("returns an empty string for a missing case", () => {
        expect(getCaseCode(undefined)).toBe("");
    });
});

describe("getCaseCodeSuffix", () => {
    it("prefixes the code with a separator", () => {
        expect(getCaseCodeSuffix({ external_code: "202630070000001" })).toBe(" - 202630070000001");
    });

    it("uses the folio when there is no external code", () => {
        expect(getCaseCodeSuffix({ folio: "AS-0001" })).toBe(" - AS-0001");
    });

    it("returns an empty string when there is no code, so no dangling separator is rendered", () => {
        expect(getCaseCodeSuffix({ external_code: null, folio: null })).toBe("");
    });
});
