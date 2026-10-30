import { describe, expect, it } from "vitest";
import { formatTableDateTime } from "./dateUtils";

describe("formatTableDateTime", () => {
    const formattedDatePattern = /^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}:\d{2}$/;

    it("formats ISO timestamps to dd/MM/yyyy HH:mm:ss", () => {
        expect(formatTableDateTime("2026-07-15T16:20:56.000Z")).toMatch(formattedDatePattern);
    });

    it("formats postgres timestamps without timezone", () => {
        expect(formatTableDateTime("2026-09-07 11:21:53")).toMatch(formattedDatePattern);
        expect(formatTableDateTime("2026-09-07 11:21:53")).not.toMatch(/^\d{4}-\d{2}-\d{2}/);
    });

    it("formats postgres timestamps with timezone offset", () => {
        expect(formatTableDateTime("2026-07-15 10:17:10-05:00")).toMatch(formattedDatePattern);
    });

    it("keeps already localized values", () => {
        expect(formatTableDateTime("15/07/2026 16:20:56")).toBe("15/07/2026 16:20:56");
    });

    it("returns empty string for empty values", () => {
        expect(formatTableDateTime(null)).toBe("");
        expect(formatTableDateTime("")).toBe("");
        expect(formatTableDateTime("null")).toBe("");
    });
});
