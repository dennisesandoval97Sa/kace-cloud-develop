import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { filterBuilder } from "./filterBuilder.util";

describe("filterBuilder identity columns", () => {
    it("filters string UUID id columns with eq, not ilike", () => {
        expect(filterBuilder("string", "responsable_id", "uuid-1")).toMatchObject({
            field: "responsable_id",
            operator: "eq",
            value: "uuid-1",
        });
        expect(filterBuilder("string", "cases.id", "uuid-2")).toMatchObject({
            field: "cases.id",
            operator: "eq",
        });
        expect(filterBuilder("string", "nombres", "Ana")).toMatchObject({
            operator: "ilike",
        });
    });
});

describe("filterBuilder date", () => {
    beforeEach(() => {
        vi.spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions").mockReturnValue({
            timeZone: "America/Bogota",
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("normalizes date between value with browser timezone helper", () => {
        const result = filterBuilder("date", "created_at", "2026-07-23T00:00:00.000Z, 2026-07-23T23:59:59.999Z");

        expect(result).toEqual({
            field: "created_at",
            operator: "between",
            type: "AND",
            value: "2026-07-23T00:00:00.000-05:00, 2026-07-23T23:59:59.999-05:00",
        });
    });

    it.each([
        ["empty value", ""],
        ["malformed value", "not-a-date"],
        ["reversed range", "2026-07-25T00:00:00.000Z, 2026-07-23T23:59:59.999Z"],
    ])("returns null for invalid input (%s)", (_label, value) => {
        expect(filterBuilder("date", "created_at", value)).toBeNull();
    });
});
