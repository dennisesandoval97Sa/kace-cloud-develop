import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import DataTable from "@/componentsV2/core/DataTable";
import useDataTable from "@/hooks/useDataTable";
import { dataTableConfig } from "./data/constants";
import { processColumns, processData, processFilters } from "./utils/datatableProcess";
import AllowedConnectionsTableContainer from "./AllowedConnectionsTableContainer";

vi.mock("@/hooks/useDataTable", () => ({
    default: vi.fn(),
}));

vi.mock("@/componentsV2/core/DataTable", () => ({
    default: vi.fn(() => <div data-testid="allowed-connections-data-table" />),
}));

describe("AllowedConnectionsTableContainer", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("renders Allowed Connections through DataTableV2", () => {
        const arrayAction = [{ name: "Editar" }];
        const tableState = {
            renderData: { processedHeader: [], rows: [] },
            query: { isLoading: false },
            filters: { isActive: false },
            pagination: { page: 1 },
            columnSelector: { columns: [] },
        };
        useDataTable.mockReturnValue(tableState);

        render(<AllowedConnectionsTableContainer arrayAction={arrayAction} />);

        expect(useDataTable).toHaveBeenCalledWith({
            dataTableConfig,
            actions: arrayAction,
            processFilters,
            processColumns,
            processData,
        });
        expect(DataTable).toHaveBeenCalledWith(tableState, {});
        expect(screen.getByTestId("allowed-connections-data-table")).toBeInTheDocument();
    });

    it("keeps the react-query key used by the delete mutation", () => {
        expect(dataTableConfig.key).toBe("allowedConnections");
        expect(dataTableConfig.url).toBe("/allowed-connections");
        expect(dataTableConfig.view).toBe("allowed_connections");
        expect(dataTableConfig.entity).toBe("allowed_connections");
    });
});
