import { beforeEach, describe, expect, it, vi } from "vitest";
import { SPECIAL_FIELDS } from "../../../services/createSchemaFilter";
import { FILTER_TRANSFORMATIONS } from "../data/constants";
import { processColumns, processData, processFilters } from "./datatableProcess";
import { handleState, handleStateTimer } from "../../../utils/main";

vi.mock("i18next", () => ({
    t: (key) => key,
}));

vi.mock("../../../utils/main", () => ({
    handleState: vi.fn((data) => data.map((item) => ({ ...item, stateHandled: true }))),
    handleStateTimer: vi.fn((data) => data.map((item) => ({ ...item, timerHandled: true }))),
}));

describe("General Setup DataTable processing", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("adds the feature filter transformations without removing defaults", () => {
        const defaults = { name: vi.fn() };

        expect(processColumns(defaults)).toEqual({
            ...defaults,
            ...FILTER_TRANSFORMATIONS,
        });
    });

    it("adds the is_active switch-state filter", () => {
        const defaults = [{ column_name: "description", field: "string" }];

        expect(processFilters(defaults)).toEqual([
            ...defaults,
            {
                column_name: "is_active",
                field: SPECIAL_FIELDS.switch_state,
            },
        ]);
    });

    it("normalizes nested response data before applying state processors", async () => {
        const rows = [{ id: "configuration-id", is_active: true }];

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
