import { describe, expect, it } from "vitest";
import { normalizeAppliedTableDateFilters } from "./normalizeAppliedTableDateFilters";

describe("normalizeAppliedTableDateFilters", () => {
    const schema = [
        {
            column_name: "created_at",
            data_type: "date",
            filterData: { field: "created_at", operator: "between", type: "AND" },
        },
        {
            column_name: "receipt_at",
            data_type: "datetime",
            filterData: { field: "receipt_at", operator: "between", type: "AND" },
        },
        {
            column_name: "status",
            data_type: "string",
            filterData: { field: "status", operator: "eq", type: "AND" },
        },
    ];

    it("normalizes date fields with calendar-day bounds", () => {
        const input = {
            created_at: {
                field: "created_at",
                operator: "between",
                type: "AND",
                value: "2026-07-23T00:00:00.000Z, 2026-07-23T23:59:59.999Z",
            },
            status: { field: "status", operator: "eq", type: "AND", value: "open" },
        };

        const result = normalizeAppliedTableDateFilters(input, schema, "America/Bogota");

        expect(result.created_at.value).toBe("2026-07-23T00:00:00.000-05:00, 2026-07-23T23:59:59.999-05:00");
        expect(result.status).toEqual(input.status);
    });

    it("normalizes datetime fields preserving wall clock", () => {
        const input = {
            receipt_at: {
                field: "receipt_at",
                operator: "between",
                type: "AND",
                value: "2026-07-23T15:15:00.000Z, 2026-07-23T20:30:59.999Z",
            },
        };

        const result = normalizeAppliedTableDateFilters(input, schema, "America/Bogota");

        expect(result.receipt_at.value).toBe("2026-07-23T10:15:00.000-05:00, 2026-07-23T15:30:59.999-05:00");
    });

    it.each(["not-a-date", "0099-01-01T00:00:00.000Z"])("omits invalid date filter %s", (value) => {
        const input = {
            created_at: {
                field: "created_at",
                operator: "between",
                type: "AND",
                value,
            },
        };

        const result = normalizeAppliedTableDateFilters(input, schema, "America/Bogota");

        expect(result.created_at).toBeUndefined();
    });
});
