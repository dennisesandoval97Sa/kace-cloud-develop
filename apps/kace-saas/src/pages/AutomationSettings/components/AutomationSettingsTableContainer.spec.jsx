import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import DataTable from "@/componentsV2/core/DataTable";
import useDataTable from "@/hooks/useDataTable";
import { dataTableConfig } from "../data/constants";
import { processColumns, processData } from "../utils/datatableProcess";
import { AutomationSettingsTableContainer } from "./AutomationSettingsTableContainer";

vi.mock("@/hooks/useDataTable", () => ({
    default: vi.fn(),
}));

vi.mock("@/componentsV2/core/DataTable", () => ({
    default: vi.fn(() => <div data-testid="automation-settings-data-table" />),
}));

describe("AutomationSettingsTableContainer", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("renders Automation Settings through DataTableV2", () => {
        const arrayAction = [{ name: "AutomationSettingsDelete" }];
        const tableState = {
            renderData: { processedHeader: [], rows: [] },
            query: { isLoading: false },
            filters: { isActive: false },
            pagination: { page: 1 },
            columnSelector: { columns: [] },
        };
        useDataTable.mockReturnValue(tableState);

        render(<AutomationSettingsTableContainer arrayAction={arrayAction} />);

        expect(useDataTable).toHaveBeenCalledWith({
            dataTableConfig,
            actions: arrayAction,
            processColumns,
            processData,
        });
        expect(DataTable).toHaveBeenCalledWith(tableState, {});
        expect(screen.getByTestId("automation-settings-data-table")).toBeInTheDocument();
    });

    it("keeps the react-query key used by the delete mutation", () => {
        expect(dataTableConfig.key).toBe("automationSettingsData");
    });
});
