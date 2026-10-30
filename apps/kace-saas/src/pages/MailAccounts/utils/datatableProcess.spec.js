import { beforeEach, describe, expect, it, vi } from "vitest";
import { SPECIAL_FIELDS } from "@/services/createSchemaFilter";
import { handleState, handleStateTimer } from "@/utils/main";
import { FILTER_TRANSFORMATIONS } from "../data/constants";
import { processColumns, processData, processFilters } from "./datatableProcess";

vi.mock("@/utils/main", () => ({
    handleState: vi.fn((rows) => rows.map((row) => ({ ...row, stateHandled: true }))),
    handleStateTimer: vi.fn((rows) => rows.map((row) => ({ ...row, timerHandled: true }))),
}));

describe("Mail Accounts DataTableV2 processing", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("preserves defaults and applies Mail Account filter transformations", () => {
        const defaults = { created_at: vi.fn() };

        expect(processColumns(defaults)).toEqual({
            ...defaults,
            ...FILTER_TRANSFORMATIONS,
        });

        const stateColumn = processColumns(defaults).is_active({
            column_name: "is_active",
            field_type: "integer",
        });
        expect(stateColumn.field_type).toBe("integer");
        expect(stateColumn.filterData).toEqual({
            field: "mail_accounts.is_active",
            operator: "eq",
            type: "AND",
            value: "",
        });
    });

    it("exposes is_active as a three-state filter", () => {
        expect(processFilters([])).toEqual([
            {
                column_name: "is_active",
                field: SPECIAL_FIELDS.switch_state,
            },
        ]);
    });

    it("normalizes state and audit dates", async () => {
        const rows = [{ id: "mail-account-id", is_active: true }];

        await expect(processData({ data: rows })).resolves.toEqual([
            {
                ...rows[0],
                stateHandled: true,
                timerHandled: true,
            },
        ]);
        expect(handleState).toHaveBeenCalledWith(rows);
        expect(handleStateTimer).toHaveBeenCalledWith([{ ...rows[0], stateHandled: true }]);
    });
});
