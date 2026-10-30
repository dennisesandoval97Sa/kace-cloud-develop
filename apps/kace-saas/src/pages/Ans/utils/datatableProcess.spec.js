import { beforeEach, describe, expect, it, vi } from "vitest";
import { SPECIAL_FIELDS } from "@/services/createSchemaFilter";
import { handleState, handleStateTimer } from "@/utils/main";
import { dataTableConfig } from "../data/constants";
import { processColumns, processData, processFilters } from "./datatableProcess";

vi.mock("@/utils/main", () => ({
    handleState: vi.fn((data) => data.map((item) => ({ ...item, stateHandled: true }))),
    handleStateTimer: vi.fn((data) => data.map((item) => ({ ...item, datesHandled: true }))),
}));

describe("ANS DataTable processing", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("keeps the legacy visible columns and all twelve existing filters", () => {
        expect(dataTableConfig.genericColumns).toEqual([
            "nombre",
            "color_ans_inicial",
            "color_ans_intermedio",
            "color_ans_final",
            "status",
            "created_at",
            "updated_at",
        ]);
        expect(dataTableConfig.filterColumns).toEqual([
            "id",
            "nombre",
            "intermedio",
            "vencido",
            "color_ans_inicial",
            "color_ans_intermedio",
            "color_ans_final",
            "status",
            "created_at",
            "updated_at",
            "created_by",
            "updated_by",
        ]);
        expect(dataTableConfig.filterColumns).not.toContain("medicion_ans_id");
        expect(dataTableConfig.filterColumns).not.toContain("deleted_at");
        expect(dataTableConfig.filterColumns).not.toContain("deleted_by");
    });

    it.each([
        ["id", "ID", "ans.id", "eq"],
        ["nombre", "Name", "ans.nombre", "ilike"],
        ["intermedio", "Intermediate", "ans.intermedio", "eq"],
        ["vencido", "Expired", "ans.vencido", "eq"],
        ["color_ans_inicial", "Initial ANS color", "ans.color_ans_inicial", "ilike"],
        ["color_ans_intermedio", "Intermediate ANS color", "ans.color_ans_intermedio", "ilike"],
        ["color_ans_final", "Final ANS color", "ans.color_ans_final", "ilike"],
        ["status", "Status", "ans.status", "eq"],
        ["created_by", "Created by", "ans.created_by", "eq"],
        ["updated_by", "Updated by", "ans.updated_by", "eq"],
    ])("keeps the %s label and submits its legacy field/operator", (columnName, label, field, operator) => {
        const column = { column_name: columnName, data_type: "String", label };
        const transform = processColumns({})[columnName];

        expect(transform(column)).toEqual({
            ...column,
            filterData: {
                field,
                operator,
                type: "AND",
                value: "",
            },
        });
    });

    it("preserves the generic date filter transformations", () => {
        const createdAt = vi.fn();
        const updatedAt = vi.fn();

        expect(processColumns({ created_at: createdAt, updated_at: updatedAt })).toMatchObject({
            created_at: createdAt,
            updated_at: updatedAt,
        });
    });

    it("uses color selectors and the All, Active, Inactive status control", () => {
        const defaults = [{ column_name: "created_at", field: SPECIAL_FIELDS.date }];

        expect(processFilters(defaults)).toEqual([
            ...defaults,
            { column_name: "color_ans_inicial", field: SPECIAL_FIELDS.select_colors },
            { column_name: "color_ans_intermedio", field: SPECIAL_FIELDS.select_colors },
            { column_name: "color_ans_final", field: SPECIAL_FIELDS.select_colors },
            { column_name: "status", field: SPECIAL_FIELDS.switch_state },
        ]);
    });

    it("normalizes nested rows before formatting status and audit dates", async () => {
        const rows = [{ id: "ans-id", status: 1, created_at: "2026-07-22T12:00:00.000Z" }];

        await expect(processData({ data: rows })).resolves.toEqual([
            {
                ...rows[0],
                stateHandled: true,
                datesHandled: true,
            },
        ]);
        expect(handleState).toHaveBeenCalledWith(rows);
        expect(handleStateTimer).toHaveBeenCalledWith([{ ...rows[0], stateHandled: true }]);
    });
});
