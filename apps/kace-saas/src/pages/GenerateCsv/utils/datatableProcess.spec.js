import { beforeEach, describe, expect, it, vi } from "vitest";
import { getSchemaFilter, SPECIAL_FIELDS } from "@/services/createSchemaFilter";
import { handleState, handleStateTimer } from "@/utils/main";
import { GENERATE_CSV_FILTER_COLUMNS, HEADERS_CONST_GENERATECSV } from "../data/constants";
import { processColumns, processData, processFilters } from "./datatableProcess";

vi.mock("i18next", () => ({
    t: (key) => key,
}));

vi.mock("@/utils/main", () => ({
    handleState: vi.fn((rows) => rows.map((row) => ({ ...row, stateHandled: true }))),
    handleStateTimer: vi.fn((rows) => rows.map((row) => ({ ...row, timerHandled: true }))),
}));

const rawSchema = [
    { column_name: "description", data_type: "String", label: "Description" },
    { column_name: "is_active", data_type: "Boolean", label: "Is active" },
    { column_name: "frequency", data_type: "String", label: "Frequency" },
    { column_name: "interval", data_type: "Number", label: "Interval" },
    { column_name: "storage_path", data_type: "String", label: "Storage path" },
    { column_name: "last_execution_at", data_type: "Date", label: "Last execution at" },
    { column_name: "next_execution_at", data_type: "Date", label: "Next execution at" },
    { column_name: "created_by", data_type: "String", label: "Created by" },
    { column_name: "created_at", data_type: "Date", label: "Created at" },
    { column_name: "updated_by", data_type: "String", label: "Updated by" },
    { column_name: "updated_at", data_type: "Date", label: "Updated at" },
];

const expectedFilterContract = [
    ["description", SPECIAL_FIELDS.string, "csv_export_views.description", "ilike"],
    ["is_active", SPECIAL_FIELDS.switch_state, "csv_export_views.is_active", "eq"],
    ["frequency", SPECIAL_FIELDS.string, "csv_export_views.frequency", "ilike"],
    ["interval", SPECIAL_FIELDS.number, "csv_export_views.interval", "eq"],
    ["storage_path", SPECIAL_FIELDS.string, "csv_export_views.storage_path", "ilike"],
    ["last_execution_at", SPECIAL_FIELDS.date, "csv_export_views.last_execution_at", "between"],
    ["next_execution_at", SPECIAL_FIELDS.date, "csv_export_views.next_execution_at", "between"],
    ["created_by", SPECIAL_FIELDS.search_users, "csv_export_views.created_by", "eq"],
    ["created_at", SPECIAL_FIELDS.date, "csv_export_views.created_at", "between"],
    ["updated_by", SPECIAL_FIELDS.search_users, "csv_export_views.updated_by", "eq"],
    ["updated_at", SPECIAL_FIELDS.date, "csv_export_views.updated_at", "between"],
];

describe("CSV Generator DataTableV2 processing", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("preserves the ten working legacy filters and adds an explicit three-state active filter", () => {
        const columnTransforms = processColumns({ unrelated: vi.fn() });
        const processedSchema = rawSchema.map((column) => columnTransforms[column.column_name](column));
        const filterSchema = getSchemaFilter(processedSchema, processFilters([]));

        expect(GENERATE_CSV_FILTER_COLUMNS).toEqual(rawSchema.map((column) => column.column_name));
        expect(columnTransforms.unrelated).toBeTypeOf("function");
        expect(
            filterSchema.map(({ column_name, data_type, filterData }) => [
                column_name,
                data_type,
                filterData.field,
                filterData.operator,
            ]),
        ).toEqual(expectedFilterContract);
        expect(filterSchema.find((column) => column.column_name === "is_active").schema_column_type).toBe("boolean");
    });

    it("keeps the eight legacy visible columns in their existing order", () => {
        expect(HEADERS_CONST_GENERATECSV).toEqual([
            "description",
            "frequency",
            "interval",
            "storage_path",
            "next_execution_at",
            "is_active",
            "created_at",
            "updated_at",
        ]);
    });

    it("keeps state and audit-date display formatting", async () => {
        const rows = [{ id: "csv-export-view-id", is_active: true }];

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
