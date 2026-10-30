import { beforeEach, describe, expect, it, vi } from "vitest";
import { SPECIAL_FIELDS } from "../../../services/createSchemaFilter";
import { dataTableConfig } from "../data/Constants";
import { handleState, handleStateTimer } from "../../../utils/main";
import { processColumns, processData, processFilters } from "./datatableProcess";

vi.mock("../../../utils/main", () => ({
    handleState: vi.fn((data) => data.map((item) => ({ ...item, stateHandled: true }))),
    handleStateTimer: vi.fn((data) => data.map((item) => ({ ...item, datesHandled: true }))),
}));

describe("Help DataTable processing", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("keeps the legacy visible columns and explicitly allowlists useful hidden filters", () => {
        expect(dataTableConfig.genericColumns).toEqual(["titulo", "color", "is_active", "created_at", "updated_at"]);
        expect(dataTableConfig.filterColumns).toEqual([
            "titulo",
            "descripcion",
            "color",
            "is_active",
            "created_by",
            "updated_by",
            "created_at",
            "updated_at",
        ]);
    });

    it("uses the translatable Help title label and builds a case-insensitive title filter", () => {
        const titleColumn = { column_name: "titulo", data_type: "String", label: "undefined" };
        const transform = processColumns({}).titulo;

        expect(transform(titleColumn)).toEqual({
            ...titleColumn,
            label: "Title",
            filterData: {
                field: "helps.titulo",
                operator: "ilike",
                type: "AND",
                value: "",
            },
        });
    });

    it("keeps the color column available to the V2 color cell and color selector filter", () => {
        const colorColumn = { column_name: "color", data_type: "String", label: "Color" };
        const transform = processColumns({}).color;

        expect(transform(colorColumn)).toEqual({
            ...colorColumn,
            filterData: {
                field: "helps.color",
                operator: "ilike",
                type: "AND",
                value: "",
            },
        });
    });

    it("keeps description filterable without exposing it as a table column", () => {
        const descriptionColumn = { column_name: "descripcion", data_type: "String", label: "Description" };
        const transform = processColumns({}).descripcion;

        expect(dataTableConfig.genericColumns).not.toContain("descripcion");
        expect(dataTableConfig.filterColumns).toContain("descripcion");
        expect(transform(descriptionColumn)).toEqual({
            ...descriptionColumn,
            filterData: {
                field: "helps.descripcion",
                operator: "ilike",
                type: "AND",
                value: "",
            },
        });
    });

    it("uses the color selector and All/Active/Inactive state filter controls", () => {
        const defaults = [{ column_name: "titulo", field: SPECIAL_FIELDS.string }];

        expect(processFilters(defaults)).toEqual([
            ...defaults,
            {
                column_name: "color",
                field: SPECIAL_FIELDS.select_colors,
            },
            {
                column_name: "is_active",
                field: SPECIAL_FIELDS.switch_state,
            },
        ]);
    });

    it("builds the Help status filter against the boolean is_active field", () => {
        const statusColumn = { column_name: "is_active", data_type: "Boolean", label: "State" };
        const transform = processColumns({}).is_active;

        expect(transform(statusColumn)).toEqual({
            ...statusColumn,
            filterData: {
                field: "helps.is_active",
                operator: "eq",
                type: "AND",
                value: "",
            },
        });
    });

    it.each(["created_by", "updated_by"])("keeps the hidden %s user filter scoped to Helps", (columnName) => {
        const auditColumn = { column_name: columnName, data_type: "String", label: columnName };
        const transform = processColumns({
            [columnName]: (row) => ({ ...row, filterData: { field: "helps.reference" } }),
        })[columnName];

        expect(dataTableConfig.genericColumns).not.toContain(columnName);
        expect(dataTableConfig.filterColumns).toContain(columnName);
        expect(transform(auditColumn)).toEqual({
            ...auditColumn,
            filterData: {
                field: `helps.${columnName}`,
                operator: "eq",
                type: "AND",
                value: "",
            },
        });
    });

    it("normalizes nested response rows before formatting state and audit dates", async () => {
        const rows = [{ id: "help-id", is_active: true, created_at: "2026-07-16T12:00:00.000Z" }];

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
