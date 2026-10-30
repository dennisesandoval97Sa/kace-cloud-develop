import { describe, expect, it } from "vitest";
import { getSynchronizedBaseFilters, getTableFiltersKey } from "./dataTableFilterSync";

describe("dataTableFilterSync", () => {
    it("uses table filters as the synchronized base filters when no URL filter is present", () => {
        const tableFilters = [{ field: "state", operator: "eq", value: "closed", type: "AND" }];

        expect(getSynchronizedBaseFilters({ urlFilter: undefined, tableFilters })).toBe(tableFilters);
    });

    it("keeps URL filters ahead of table filters", () => {
        const urlFilter = [{ field: "workspace_id", operator: "eq", value: "workspace-1", type: "AND" }];
        const tableFilters = [{ field: "state", operator: "eq", value: "closed", type: "AND" }];

        expect(getSynchronizedBaseFilters({ urlFilter, tableFilters })).toBe(urlFilter);
    });

    it("produces a different key when table filters change so React Query refetches without manual invalidation", () => {
        const initialFilters = [{ field: "state", operator: "eq", value: "open", type: "AND" }];
        const nextFilters = [{ field: "state", operator: "eq", value: "closed", type: "AND" }];

        expect(getTableFiltersKey(initialFilters)).not.toBe(getTableFiltersKey(nextFilters));
        expect(getTableFiltersKey(null)).toBe("[]");
    });
});
