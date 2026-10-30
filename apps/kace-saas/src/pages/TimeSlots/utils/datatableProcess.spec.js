import { beforeEach, describe, expect, it, vi } from "vitest";
import { SPECIAL_FIELDS } from "@/services/createSchemaFilter";
import { handleState, handleStateTimer } from "@/utils/main";
import { dataTableConfig, FILTER_TRANSFORMATIONS } from "../data/constants";
import { processColumns, processData, processFilters } from "./datatableProcess";

vi.mock("@/utils/main", () => ({
    handleState: vi.fn((data) => data.map((item) => ({ ...item, stateHandled: true }))),
    handleStateTimer: vi.fn((data) => data.map((item) => ({ ...item, timerHandled: true }))),
}));

describe("Appointment Time Slots DataTable processing", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("adds every Appointment Time Slot filter transformation without removing defaults", () => {
        const defaults = { created_at: vi.fn() };

        expect(processColumns(defaults)).toEqual({
            ...defaults,
            ...FILTER_TRANSFORMATIONS,
        });

        expect(FILTER_TRANSFORMATIONS.description({ column_name: "description" })).toMatchObject({
            filterData: {
                field: "appointment_time_slots.description",
                operator: "ilike",
                type: "AND",
                value: "",
            },
        });
        expect(FILTER_TRANSFORMATIONS.start_time({ column_name: "start_time" })).toMatchObject({
            filterData: { field: "appointment_time_slots.start_time", operator: "eq" },
        });
        expect(FILTER_TRANSFORMATIONS.end_time({ column_name: "end_time" })).toMatchObject({
            filterData: { field: "appointment_time_slots.end_time", operator: "eq" },
        });
        expect(FILTER_TRANSFORMATIONS.max_appointments({ column_name: "max_appointments" })).toMatchObject({
            filterData: { field: "appointment_time_slots.max_appointments", operator: "eq" },
        });
        expect(FILTER_TRANSFORMATIONS.is_active({ column_name: "is_active" })).toMatchObject({
            field_type: "boolean",
            filterData: { field: "appointment_time_slots.is_active", operator: "eq" },
        });
        expect(FILTER_TRANSFORMATIONS.created_by({ column_name: "created_by" })).toMatchObject({
            filterData: { field: "appointment_time_slots.created_by", operator: "eq" },
        });
        expect(FILTER_TRANSFORMATIONS.updated_by({ column_name: "updated_by" })).toMatchObject({
            filterData: { field: "appointment_time_slots.updated_by", operator: "eq" },
        });
    });

    it("keeps legacy hidden filters, including start and end times", () => {
        expect(dataTableConfig.filterColumns).toEqual([
            "description",
            "start_time",
            "end_time",
            "max_appointments",
            "is_active",
            "created_by",
            "updated_by",
            "created_at",
            "updated_at",
        ]);
    });

    it("exposes is_active as the All, Active, and Inactive state filter", () => {
        const defaults = [{ column_name: "description", field: SPECIAL_FIELDS.string }];

        expect(processFilters(defaults)).toEqual([
            ...defaults,
            {
                column_name: "is_active",
                field: SPECIAL_FIELDS.switch_state,
            },
        ]);
    });

    it("normalizes nested response data before applying state and date processors", async () => {
        const rows = [{ id: "time-slot-id", is_active: true }];

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
