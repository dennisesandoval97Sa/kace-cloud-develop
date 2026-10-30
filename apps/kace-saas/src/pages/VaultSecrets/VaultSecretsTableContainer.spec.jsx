import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import DataTable from "@/componentsV2/core/DataTable";
import useDataTable from "@/hooks/useDataTable";
import { dataTableConfig } from "./data/constants";
import { processColumns, processData, processFilters } from "./utils/datatableProcess";
import VaultSecretsTableContainer from "./VaultSecretsTableContainer";

vi.mock("@/hooks/useDataTable", () => ({
    default: vi.fn(),
}));

vi.mock("@/componentsV2/core/DataTable", () => ({
    default: vi.fn(() => <div data-testid="vault-secrets-data-table" />),
}));

describe("VaultSecretsTableContainer", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("renders Secrets Vault through DataTableV2 with its permitted actions", () => {
        const arrayAction = [{ name: "Editar" }];
        const tableState = {
            renderData: { processedHeader: [], rows: [] },
            query: { isLoading: false },
            filters: { isActive: false },
            pagination: { page: 1 },
            columnSelector: { columns: [] },
        };
        useDataTable.mockReturnValue(tableState);

        render(<VaultSecretsTableContainer arrayAction={arrayAction} />);

        expect(useDataTable).toHaveBeenCalledWith({
            dataTableConfig,
            actions: arrayAction,
            processFilters,
            processColumns,
            processData,
        });
        expect(DataTable).toHaveBeenCalledWith(tableState, {});
        expect(screen.getByTestId("vault-secrets-data-table")).toBeInTheDocument();
    });
});
