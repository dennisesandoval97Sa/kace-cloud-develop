import { beforeEach, describe, expect, it, vi } from "vitest";
import { SPECIAL_FIELDS } from "../../../services/createSchemaFilter";
import { FILTER_TRANSFORMATIONS, dataTableConfig } from "../data/constants";
import { processColumns, processData, processFilters } from "./datatableProcess";
import { handleState, handleStateTimer } from "../../../utils/main";

vi.mock("i18next", () => ({
    t: (key) => key,
}));

vi.mock("../../../utils/main", () => ({
    handleState: vi.fn((data) => data.map((item) => ({ ...item, stateHandled: true }))),
    handleStateTimer: vi.fn((data) => data.map((item) => ({ ...item, timerHandled: true }))),
}));

describe("Agenda DataTable processing", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("keeps visible columns separate from the explicit filter allowlist", () => {
        expect(dataTableConfig.genericColumns).toEqual([
            "description",
            "daily_limit",
            "is_for_weekend",
            "is_active",
            "created_at",
            "updated_at",
        ]);
        expect(dataTableConfig.filterColumns).toEqual([
            "description",
            "daily_limit",
            "is_for_weekend",
            "is_active",
            "created_by",
            "updated_by",
            "created_at",
            "updated_at",
        ]);
    });

    it("adds Agenda filter transformations without removing the shared defaults", () => {
        const defaults = { created_at: vi.fn() };

        expect(processColumns(defaults)).toEqual({
            ...defaults,
            ...FILTER_TRANSFORMATIONS,
        });

        expect(processColumns(defaults).is_active({ column_name: "is_active" })).toEqual(
            expect.objectContaining({
                field_type: "boolean",
                filterData: {
                    field: "agendas.is_active",
                    operator: "eq",
                    type: "AND",
                    value: "",
                },
            }),
        );
        expect(processColumns(defaults).is_for_weekend({ column_name: "is_for_weekend" })).toEqual(
            expect.objectContaining({
                field_type: "boolean",
                filterData: {
                    field: "agendas.is_for_weekend",
                    operator: "eq",
                    type: "AND",
                    value: "",
                },
            }),
        );
        expect(processColumns(defaults).created_by({ column_name: "created_by" })).toEqual(
            expect.objectContaining({
                filterData: {
                    field: "agendas.created_by",
                    operator: "eq",
                    type: "AND",
                    value: "",
                },
            }),
        );
        expect(processColumns(defaults).updated_by({ column_name: "updated_by" })).toEqual(
            expect.objectContaining({
                filterData: {
                    field: "agendas.updated_by",
                    operator: "eq",
                    type: "AND",
                    value: "",
                },
            }),
        );
    });

    it("renders both Agenda boolean fields as All, Active, and Inactive selectors", () => {
        const defaults = [{ column_name: "description", field: "string" }];

        expect(processFilters(defaults)).toEqual([
            ...defaults,
            {
                column_name: "is_active",
                field: SPECIAL_FIELDS.switch_state,
            },
            {
                column_name: "is_for_weekend",
                field: SPECIAL_FIELDS.switch_state,
            },
        ]);
    });

    it("normalizes nested response rows before applying state processors", async () => {
        const rows = [{ id: "agenda-id", is_active: true, is_for_weekend: false }];

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
