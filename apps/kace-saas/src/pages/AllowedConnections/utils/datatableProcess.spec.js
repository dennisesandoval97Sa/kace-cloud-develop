import { beforeEach, describe, expect, it, vi } from "vitest";
import { SPECIAL_FIELDS } from "@/services/createSchemaFilter";
import { handleState, handleStateTimer } from "@/utils/main";
import { ALLOWED_CONNECTIONS_FILTER_COLUMNS, FILTER_TRANSFORMATIONS } from "../data/constants";
import { processColumns, processData, processFilters } from "./datatableProcess";

vi.mock("@/utils/main", () => ({
    handleState: vi.fn((rows) => rows.map((row) => ({ ...row, stateHandled: true }))),
    handleStateTimer: vi.fn((rows) => rows.map((row) => ({ ...row, timerHandled: true }))),
}));

describe("Allowed Connections DataTableV2 processing", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("preserves defaults and applies Allowed Connection filter transformations", () => {
        const defaults = { created_at: vi.fn() };

        expect(processColumns(defaults)).toEqual({
            ...defaults,
            ...FILTER_TRANSFORMATIONS,
        });

        const connectionColumn = processColumns(defaults).connection({
            column_name: "connection",
            field_type: "character varying",
        });
        expect(connectionColumn.field_type).toBe("character varying");
        expect(connectionColumn.filterData).toEqual({
            field: "allowed_connections.connection",
            operator: "ilike",
            type: "AND",
            value: "",
        });
    });

    it("qualifies the state filter with the view and uses an equality operator", () => {
        const stateColumn = processColumns({}).is_active({
            column_name: "is_active",
            field_type: "boolean",
        });

        expect(stateColumn.filterData).toEqual({
            field: "allowed_connections.is_active",
            operator: "eq",
            type: "AND",
            value: "",
        });
    });

    it("never emits ilike on a timestamp column", () => {
        ALLOWED_CONNECTIONS_FILTER_COLUMNS.filter((column) => column.endsWith("_at")).forEach((column) => {
            expect(FILTER_TRANSFORMATIONS[column]).toBeUndefined();
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
        const rows = [{ id: "allowed-connection-id", is_active: true }];

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
