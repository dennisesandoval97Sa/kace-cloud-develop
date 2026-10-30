import { describe, expect, it } from "vitest";
import { normalizeTableDateRangeFilter } from "./normalizeTableDateRangeFilter";

const LATAM_ZONES = [
    { country: "Colombia", timeZone: "America/Bogota", singleDayOffset: "-05:00" },
    { country: "Mexico", timeZone: "America/Mexico_City", singleDayOffset: "-06:00" },
    { country: "Chile", timeZone: "America/Santiago", singleDayOffset: "-04:00" }, // 2026-07 winter
    { country: "Argentina", timeZone: "America/Argentina/Buenos_Aires", singleDayOffset: "-03:00" },
    { country: "Peru", timeZone: "America/Lima", singleDayOffset: "-05:00" },
    { country: "Brazil", timeZone: "America/Sao_Paulo", singleDayOffset: "-03:00" },
    { country: "Uruguay", timeZone: "America/Montevideo", singleDayOffset: "-03:00" },
    { country: "Ecuador", timeZone: "America/Guayaquil", singleDayOffset: "-05:00" },
];

describe("normalizeTableDateRangeFilter", () => {
    describe.each(LATAM_ZONES)("$country ($timeZone)", ({ timeZone, singleDayOffset }) => {
        it("normalizes a single calendar day from picker fake-Z input", () => {
            const input = "2026-07-23T00:00:00.000Z, 2026-07-23T23:59:59.999Z";
            const result = normalizeTableDateRangeFilter(input, timeZone, { mode: "date" });
            expect(result).toBe(`2026-07-23T00:00:00.000${singleDayOffset}, 2026-07-23T23:59:59.999${singleDayOffset}`);
        });

        it("normalizes a multi-day range", () => {
            const input = "2026-07-23T00:00:00.000Z, 2026-07-25T23:59:59.999Z";
            const result = normalizeTableDateRangeFilter(input, timeZone, { mode: "date" });
            expect(result).toBe(`2026-07-23T00:00:00.000${singleDayOffset}, 2026-07-25T23:59:59.999${singleDayOffset}`);
        });

        it("treats a single side as a full calendar day", () => {
            const input = "2026-07-23T00:00:00.000Z";
            const result = normalizeTableDateRangeFilter(input, timeZone, { mode: "date" });
            expect(result).toBe(`2026-07-23T00:00:00.000${singleDayOffset}, 2026-07-23T23:59:59.999${singleDayOffset}`);
        });
    });

    it("Bogota midnight boundary is not treated as UTC day", () => {
        const result = normalizeTableDateRangeFilter(
            "2026-07-23T00:00:00.000Z, 2026-07-23T23:59:59.999Z",
            "America/Bogota",
        );
        expect(result.startsWith("2026-07-23T00:00:00.000-05:00")).toBe(true);
        expect(result).not.toContain("2026-07-23T00:00:00.000Z");
    });

    it("Mexico City midnight boundary uses -06:00", () => {
        const result = normalizeTableDateRangeFilter(
            "2026-07-23T00:00:00.000Z, 2026-07-23T23:59:59.999Z",
            "America/Mexico_City",
        );
        expect(result).toContain("-06:00");
        expect(result).not.toContain("-05:00");
    });

    it("clamps a nonexistent Santiago midnight to the first instant of the selected day", () => {
        const result = normalizeTableDateRangeFilter("2026-09-06T00:00:00.000Z", "America/Santiago");

        expect(result).toBe("2026-09-06T01:00:00.000-03:00, 2026-09-06T23:59:59.999-03:00");
    });

    it("preserves wall-clock times in datetime mode", () => {
        // Absolute UTC for 2026-07-23 10:15:00 in Bogota (-05) = 15:15Z
        const input = "2026-07-23T15:15:00.000Z, 2026-07-23T20:30:59.999Z";
        const result = normalizeTableDateRangeFilter(input, "America/Bogota", { mode: "datetime" });
        expect(result).toBe("2026-07-23T10:15:00.000-05:00, 2026-07-23T15:30:59.999-05:00");
    });

    it("returns null for empty / invalid / inverted ranges", () => {
        expect(normalizeTableDateRangeFilter("", "America/Bogota")).toBeNull();
        expect(normalizeTableDateRangeFilter("not-a-date", "America/Bogota")).toBeNull();
        expect(
            normalizeTableDateRangeFilter("2026-07-25T00:00:00.000Z, 2026-07-23T23:59:59.999Z", "America/Bogota"),
        ).toBeNull();
    });

    it("returns null for impossible calendar dates in date mode", () => {
        expect(normalizeTableDateRangeFilter("2026-02-30T00:00:00.000Z", "America/Bogota")).toBeNull();
        expect(normalizeTableDateRangeFilter("2026-13-01T00:00:00.000Z", "America/Bogota")).toBeNull();
    });

    it("returns null for calendar years below 1000 in date mode", () => {
        expect(normalizeTableDateRangeFilter("0099-01-01T00:00:00.000Z", "America/Bogota")).toBeNull();
        expect(normalizeTableDateRangeFilter("0001-01-01T00:00:00.000Z", "America/Bogota")).toBeNull();
    });

    it("throws for invalid timeZone", () => {
        expect(() => normalizeTableDateRangeFilter("2026-07-23T00:00:00.000Z", "Not/A_Zone")).toThrow();
    });
});
