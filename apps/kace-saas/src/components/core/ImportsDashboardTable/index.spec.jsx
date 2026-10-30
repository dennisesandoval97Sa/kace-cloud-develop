import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import DataTable from "@/componentsV2/core/DataTable";
import useDataTable from "@/hooks/useDataTable";
import { SPECIAL_FIELDS } from "@/services/createSchemaFilter";
import {
    createImportFileFilterTransformations,
    dataTableConfigImportFile,
    processData,
    processFilters,
} from "./config";
import { ImportsDashboardTable } from "./index";

vi.mock("@/hooks/useDataTable", () => ({
    default: vi.fn(),
}));

vi.mock("@/componentsV2/core/DataTable", () => ({
    default: vi.fn(() => <div data-testid="imports-data-table" />),
}));

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key) => key }),
}));

const tableState = {
    renderData: { processedHeader: [], rows: [] },
    query: { isLoading: false },
    filters: { isActive: false },
    pagination: { page: 1 },
    columnSelector: { columns: [] },
};

describe("ImportsDashboardTable", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        useDataTable.mockReturnValue(tableState);
    });

    it("renders the imports dashboard through DataTableV2", () => {
        const arrayAction = [{ name: "Ver" }];

        render(<ImportsDashboardTable arrayAction={arrayAction} />);

        expect(useDataTable).toHaveBeenCalledWith(
            expect.objectContaining({
                dataTableConfig: dataTableConfigImportFile,
                actions: arrayAction,
                processFilters,
                processData,
                processColumns: expect.any(Function),
            }),
        );
        expect(DataTable).toHaveBeenCalledWith(tableState, {});
        expect(screen.getByTestId("imports-data-table")).toBeInTheDocument();
    });

    it("formats created_at and last_updated_at as dd/MM/yyyy HH:mm:ss in the browser time zone", async () => {
        const { resolvedOptions } = Intl.DateTimeFormat.prototype;
        const resolvedOptionsSpy = vi
            .spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions")
            .mockImplementation(function () {
                return { ...resolvedOptions.call(this), timeZone: "America/Bogota" };
            });

        try {
            // dateUtils fija la zona del navegador al cargarse (ya lo carga vitest.setup): se reevalúa con la zona simulada.
            vi.resetModules();
            const { processData: processDataInBogota } = await import("./config");

            // Mismo instante: created_at ya pasó por convertTimestamps (offset local) y last_updated_at llega en UTC.
            const [row] = processDataInBogota([
                {
                    status: "completed",
                    created_at: "2026-10-05 10:30:00-05:00",
                    last_updated_at: "2026-10-05T15:30:00.000Z",
                },
            ]);

            expect(row.created_at).toBe("05/10/2026 10:30:00");
            expect(row.last_updated_at).toBe("05/10/2026 10:30:00");
            expect(row.status).toBe("completed");
        } finally {
            resolvedOptionsSpy.mockRestore();
        }
    });

    it("declares status as a list filter with the backend status values", () => {
        expect(processFilters([])).toContainEqual({ column_name: "status", field: SPECIAL_FIELDS.list });

        const statusColumn = createImportFileFilterTransformations((key) => key).status({ column_name: "status" });

        expect(statusColumn.filterData).toEqual({
            field: "s3_import_files.status",
            operator: "eq",
            type: "AND",
            value: "",
        });
        expect(statusColumn.options.map(({ value }) => value)).toEqual([
            "pending",
            "processing",
            "completed",
            "incompleted",
            "rejected",
            "failed",
        ]);
    });

    it("activates refetchInterval (4000ms ± 500ms jitter) when rows have pending or processing status, and disables when terminal", () => {
        const randomSpy = vi.spyOn(Math, "random");
        render(<ImportsDashboardTable />);

        const callConfig = useDataTable.mock.calls[0][0];
        expect(callConfig.refetchInterval).toEqual(expect.any(Function));

        const intervalFn = callConfig.refetchInterval;
        const pendingQuery = { state: { data: { data: [{ status: "pending" }] } } };
        const processingQuery = { state: { data: { data: [{ status: "processing" }] } } };

        // Jitter bounds -> [3500, 4500]
        randomSpy.mockReturnValue(0);
        expect(intervalFn(pendingQuery)).toBe(3500);
        randomSpy.mockReturnValue(0.5);
        expect(intervalFn(processingQuery)).toBe(4000);
        randomSpy.mockReturnValue(1);
        expect(intervalFn(pendingQuery)).toBe(4500);

        // Terminal items (completed, rejected) -> false
        expect(intervalFn({ state: { data: { data: [{ status: "completed" }, { status: "rejected" }] } } })).toBe(
            false,
        );

        // Empty or missing data -> false
        expect(intervalFn({ state: { data: { data: [] } } })).toBe(false);
        expect(intervalFn(null)).toBe(false);

        randomSpy.mockRestore();
    });
});
