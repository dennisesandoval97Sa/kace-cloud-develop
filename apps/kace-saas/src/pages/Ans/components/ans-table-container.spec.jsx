import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import DataTable from "@/componentsV2/core/DataTable";
import useDataTable from "@/hooks/useDataTable";
import { dataTableConfig } from "../data/constants";
import { processColumns, processData, processFilters } from "../utils/datatableProcess";
import { AnsTableContainer } from "./ans-table-container";

vi.mock("@/hooks/useDataTable", () => ({
    default: vi.fn(),
}));

vi.mock("@/componentsV2/core/DataTable", () => ({
    default: vi.fn(() => <div data-testid="ans-data-table" />),
}));

describe("AnsTableContainer", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("renders ANS through DataTableV2 with the permitted row actions", () => {
        const arrayAction = [{ name: "Editar" }, { name: "Eliminar" }, { name: "Ver" }];
        const tableState = {
            renderData: { processedHeader: [], rows: [] },
            query: { isLoading: false },
            filters: { isActive: false },
            pagination: { page: 1 },
            columnSelector: { columns: [] },
        };
        useDataTable.mockReturnValue(tableState);

        render(<AnsTableContainer arrayAction={arrayAction} />);

        expect(useDataTable).toHaveBeenCalledWith({
            dataTableConfig,
            actions: arrayAction,
            processFilters,
            processColumns,
            processData,
        });
        expect(DataTable).toHaveBeenCalledWith(tableState, {});
        expect(screen.getByTestId("ans-data-table")).toBeInTheDocument();
    });
});
