import { beforeEach, describe, expect, it, vi } from "vitest";
import { getSchemaFilter, SPECIAL_FIELDS } from "@/services/createSchemaFilter";
import { handleStateTimer } from "@/utils/main";
import { genericFilters } from "@/utils/genericFilters";
import { AUTOMATION_SETTINGS_FILTER_COLUMNS, dataTableConfig } from "../data/constants";
import { processColumns, processData } from "./datatableProcess";

vi.mock("i18next", () => ({
    t: (key) => key,
}));

vi.mock("@/utils/main", () => ({
    handleStateTimer: vi.fn((rows) => rows.map((row) => ({ ...row, timerHandled: true }))),
}));

const rawSchema = [
    { column_name: "description", data_type: "String", label: "Description" },
    { column_name: "frequency", data_type: "String", label: "Frequency" },
    { column_name: "start_date", data_type: "Date", label: "Start date" },
    { column_name: "end_date", data_type: "Date", label: "End date" },
    { column_name: "created_at", data_type: "Date", label: "Created at" },
    { column_name: "updated_at", data_type: "Date", label: "Updated at" },
];

const expectedFilterContract = [
    ["description", SPECIAL_FIELDS.string, "automation_settings.description", "ilike"],
    ["frequency", SPECIAL_FIELDS.string, "automation_settings.frequency", "ilike"],
    ["start_date", SPECIAL_FIELDS.date, "automation_settings.start_date", "between"],
    ["end_date", SPECIAL_FIELDS.date, "automation_settings.end_date", "between"],
    ["created_at", SPECIAL_FIELDS.date, "automation_settings.created_at", "between"],
    ["updated_at", SPECIAL_FIELDS.date, "automation_settings.updated_at", "between"],
];

const buildFilterSchema = () => {
    const columnTransforms = processColumns(genericFilters(dataTableConfig.view));
    const processedSchema = rawSchema.map((column) => columnTransforms[column.column_name](column));
    return getSchemaFilter(processedSchema, []);
};

describe("Automation Settings DataTableV2 processing", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("filters every date column with between instead of ilike", () => {
        const filterSchema = buildFilterSchema();

        expect(AUTOMATION_SETTINGS_FILTER_COLUMNS).toEqual(rawSchema.map((column) => column.column_name));
        expect(
            filterSchema.map(({ column_name, data_type, filterData }) => [
                column_name,
                data_type,
                filterData.field,
                filterData.operator,
            ]),
        ).toEqual(expectedFilterContract);
    });

    it("never emits ilike on a timestamp column", () => {
        const dateOperators = buildFilterSchema()
            .filter(({ data_type }) => data_type === SPECIAL_FIELDS.date)
            .map(({ filterData }) => filterData.operator);

        expect(dateOperators).not.toContain("ilike");
        expect(dateOperators).toEqual(["between", "between", "between", "between"]);
    });

    it("exposes start_date as filterable without adding it to the visible columns", () => {
        expect(dataTableConfig.filterColumns).toContain("start_date");
        expect(dataTableConfig.genericColumns).not.toContain("start_date");
    });

    it("delegates row post-processing to handleStateTimer", async () => {
        const rows = [{ id: "automation-setting-id", end_date: "2027-10-22T23:59:59.999Z" }];

        await expect(processData({ data: rows })).resolves.toEqual([{ ...rows[0], timerHandled: true }]);
        expect(handleStateTimer).toHaveBeenCalledWith(rows);
    });
});
