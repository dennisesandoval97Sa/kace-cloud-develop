import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import useDataTable from "@/hooks/useDataTable";
import DataTable from "@/componentsV2/core/DataTable";
import HelpsTableContainer from "./HelpsTableContainer";
import { dataTableConfig } from "../data/Constants";
import { processColumns, processData, processFilters } from "../utils/datatableProcess";

vi.mock("@/hooks/useDataTable", () => ({
    default: vi.fn(),
}));

vi.mock("@/componentsV2/core/DataTable", () => ({
    default: vi.fn(() => <div data-testid="helps-data-table" />),
}));

describe("HelpsTableContainer", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("connects the Help configuration and processors to DataTableV2", () => {
        const arrayAction = [{ name: "HelpsUpdate" }];
        const tableState = {
            renderData: { processedHeader: [], rows: [] },
            query: { isLoading: false },
            filters: { isActive: false },
            pagination: { page: 1 },
            columnSelector: { columns: [] },
        };
        useDataTable.mockReturnValue(tableState);

        render(<HelpsTableContainer arrayAction={arrayAction} />);

        expect(useDataTable).toHaveBeenCalledWith({
            dataTableConfig,
            actions: arrayAction,
            processFilters,
            processColumns,
            processData,
        });
        expect(DataTable).toHaveBeenCalledWith(tableState, {});
        expect(screen.getByTestId("helps-data-table")).toBeInTheDocument();
    });
});
