import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import useDataTable from "@/hooks/useDataTable";
import DataTable from "@/componentsV2/core/DataTable";
import { dataTableConfig } from "../data/constants";
import { processColumns, processData, processFilters } from "../utils/datatableProcess";
import { TimeSlotsTableContainer } from "./TimeSlotsTableContainer";

vi.mock("@/hooks/useDataTable", () => ({
    default: vi.fn(),
}));

vi.mock("@/componentsV2/core/DataTable", () => ({
    default: vi.fn(() => <div data-testid="time-slots-data-table" />),
}));

describe("TimeSlotsTableContainer", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("connects the Appointment Time Slots configuration and processors to DataTableV2", () => {
        const arrayAction = [{ name: "AppointmentTimeSlotsUpdate" }];
        const tableState = {
            renderData: { processedHeader: [], rows: [] },
            query: { isLoading: false },
            filters: { isActive: false },
            pagination: { page: 1 },
            columnSelector: { columns: [] },
        };
        useDataTable.mockReturnValue(tableState);

        render(<TimeSlotsTableContainer arrayAction={arrayAction} />);

        expect(useDataTable).toHaveBeenCalledWith({
            dataTableConfig,
            actions: arrayAction,
            processFilters,
            processColumns,
            processData,
        });
        expect(DataTable).toHaveBeenCalledWith(tableState, {});
        expect(screen.getByTestId("time-slots-data-table")).toBeInTheDocument();
    });
});
