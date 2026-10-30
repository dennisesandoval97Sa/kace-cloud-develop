import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import useDataTable from "@/hooks/useDataTable";
import DataTable from "@/componentsV2/core/DataTable";
import { GeneralSetupTableContainer } from "./GeneralSetupTableContainer";
import { dataTableConfig } from "../data/constants";
import { processColumns, processData, processFilters } from "../utils/datatableProcess";

vi.mock("@/hooks/useDataTable", () => ({
    default: vi.fn(),
}));

vi.mock("@/componentsV2/core/DataTable", () => ({
    default: vi.fn(() => <div data-testid="general-setup-data-table" />),
}));

describe("GeneralSetupTableContainer", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("connects the General Setup configuration and processors to DataTableV2", () => {
        const arrayAction = [{ name: "GlobalConfigurationsUpdate" }];
        const tableState = {
            renderData: { columns: [], rows: [] },
            query: { isLoading: false },
            filters: { isFiltered: false },
            pagination: { pageIndex: 0 },
            columnSelector: { selectedColumns: [] },
        };
        useDataTable.mockReturnValue(tableState);

        render(<GeneralSetupTableContainer arrayAction={arrayAction} />);

        expect(useDataTable).toHaveBeenCalledWith({
            dataTableConfig,
            actions: arrayAction,
            processFilters,
            processColumns,
            processData,
        });
        expect(DataTable).toHaveBeenCalledWith(tableState, {});
        expect(screen.getByTestId("general-setup-data-table")).toBeInTheDocument();
    });
});
