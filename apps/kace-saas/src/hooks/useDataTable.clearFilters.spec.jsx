import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import useDataTable from "./useDataTable";
import useUserInformation from "@/hooks/useUserInformation";
import { genericSearchService } from "@/services/genericSearchService";

vi.mock("@/services/genericSearchService", () => ({
    genericSearchService: vi.fn(),
}));

vi.mock("@/hooks/useDataTableColumns", () => ({
    useDataTableColumns: () => ({ columns: [], processedColumns: [] }),
}));

vi.mock("./useFilterTableHandler", () => ({
    useFilterTableHandler: () => ({
        promptConfirmation: vi.fn(),
        createNewFilter: vi.fn(),
    }),
}));

vi.mock("@/hooks/useSchemaFields", () => ({
    default: () => ({ getSchemaField: () => [] }),
}));

vi.mock("@/hooks/useUserInformation", () => ({
    default: vi.fn(),
}));

vi.mock("react-router-dom", () => ({
    useLocation: vi.fn(() => ({ state: undefined })),
}));

vi.mock("sonner", () => ({
    toast: { success: vi.fn(), error: vi.fn(), promise: vi.fn() },
}));

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (k) => k }),
}));

vi.mock("@tanstack/react-table", () => ({
    useReactTable: () => ({
        getHeaderGroups: () => [],
        getRowModel: () => ({ rows: [] }),
        getAllLeafColumns: () => [],
        getColumn: () => null,
    }),
    getCoreRowModel: vi.fn(),
    flexRender: vi.fn(),
}));

import { useLocation } from "react-router-dom";

const stableUserInformation = {
    user: { filters: { application: { admin: {} } } },
};

const dataTableConfig = {
    key: "interactions-test",
    url: "/interactions",
    view: "interactions-view",
    entity: "interactions",
    order: { field: "receipt_at", direction: "desc" },
};

const renderDataTableHook = ({ tableFilters = null, urlFilter = null } = {}) => {
    useLocation.mockReturnValue({ state: urlFilter ? { filter: urlFilter } : undefined });

    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
    const wrapper = ({ children }) => createElement(QueryClientProvider, { client: queryClient }, children);

    return renderHook(({ tableFilters }) => useDataTable({ dataTableConfig, tableFilters }), {
        wrapper,
        initialProps: { tableFilters },
    });
};

const expectFiltersToContainWorkspace = (filters, value) => {
    expect(filters).toEqual(expect.arrayContaining([expect.objectContaining({ field: "workspace_id", value })]));
};

beforeEach(() => {
    vi.clearAllMocks();
    useUserInformation.mockReturnValue(stableUserInformation);
    genericSearchService.mockResolvedValue({ data: [], total: { count: 0 } });
    useLocation.mockReturnValue({ state: undefined });
});

describe("useDataTable — clear filters preserves base filters", () => {
    it("preserves tableFilters-derived baseFilters when clearing", async () => {
        const tableFilters = [{ field: "workspace_id", operator: "eq", value: "ws-1", type: "AND" }];
        const { result } = renderDataTableHook({ tableFilters });

        await waitFor(() => expect(genericSearchService).toHaveBeenCalled());
        expectFiltersToContainWorkspace(genericSearchService.mock.calls.at(-1)[1], "ws-1");

        act(() => result.current.filters.onClear());

        await waitFor(() => {
            expectFiltersToContainWorkspace(genericSearchService.mock.calls.at(-1)[1], "ws-1");
        });
    });

    it("drops the urlFilter drill-in (Dashboard cards) when clearing", async () => {
        const urlFilter = [{ field: "estado_actual", operator: "eq", value: "vencido", type: "AND" }];
        const { result } = renderDataTableHook({ tableFilters: null, urlFilter });

        await waitFor(() => expect(genericSearchService).toHaveBeenCalled());
        expect(genericSearchService.mock.calls.at(-1)[1]).toEqual(
            expect.arrayContaining([expect.objectContaining({ field: "estado_actual", value: "vencido" })]),
        );

        act(() => result.current.filters.onClear());

        await waitFor(() => {
            expect(genericSearchService.mock.calls.at(-1)[1]).toEqual([]);
        });
    });

    it("keeps tableFilters scope but drops the urlFilter drill-in when both are present", async () => {
        const tableFilters = [{ field: "workspace_id", operator: "eq", value: "ws-1", type: "AND" }];
        const urlFilter = [{ field: "estado_actual", operator: "eq", value: "vencido", type: "AND" }];
        const { result } = renderDataTableHook({ tableFilters, urlFilter });

        await waitFor(() => expect(genericSearchService).toHaveBeenCalled());
        /*
         * BEFORE: con drill-in presente, `urlFilter` gobierna la consulta inicial
         * (getSynchronizedBaseFilters = urlFilter ?? tableFilters) y el scope de
         * `tableFilters` queda latente hasta que se pulsa "Limpiar filtros".
         */
        const initialFilters = genericSearchService.mock.calls.at(-1)[1];
        expect(initialFilters).toEqual(
            expect.arrayContaining([expect.objectContaining({ field: "estado_actual", value: "vencido" })]),
        );
        expect(initialFilters).not.toEqual(
            expect.arrayContaining([expect.objectContaining({ field: "workspace_id" })]),
        );

        act(() => result.current.filters.onClear());

        await waitFor(() => {
            const lastFilters = genericSearchService.mock.calls.at(-1)[1];
            expectFiltersToContainWorkspace(lastFilters, "ws-1");
            expect(lastFilters).not.toEqual(
                expect.arrayContaining([expect.objectContaining({ field: "estado_actual" })]),
            );
        });
    });

    it("treats an explicit empty tableFilters array the same as null on clear", async () => {
        const urlFilter = [{ field: "estado_actual", operator: "eq", value: "vencido", type: "AND" }];
        const { result } = renderDataTableHook({ tableFilters: [], urlFilter });

        await waitFor(() => expect(genericSearchService).toHaveBeenCalled());
        expect(genericSearchService.mock.calls.at(-1)[1]).toEqual(
            expect.arrayContaining([expect.objectContaining({ field: "estado_actual", value: "vencido" })]),
        );

        act(() => result.current.filters.onClear());

        await waitFor(() => {
            expect(genericSearchService.mock.calls.at(-1)[1]).toEqual([]);
        });
    });

    it("composes baseFilters and userFilters across a clear+apply cycle", async () => {
        const tableFilters = [{ field: "workspace_id", operator: "eq", value: "ws-1", type: "AND" }];
        const { result } = renderDataTableHook({ tableFilters });

        await waitFor(() => expect(genericSearchService).toHaveBeenCalled());

        act(() =>
            result.current.filters.onApply({
                status: { field: "status", operator: "eq", value: "closed", type: "AND" },
            }),
        );
        act(() => result.current.filters.onClear());
        act(() =>
            result.current.filters.onApply({
                status: { field: "status", operator: "eq", value: "open", type: "AND" },
            }),
        );

        await waitFor(() => {
            const lastFilters = genericSearchService.mock.calls.at(-1)[1];
            expect(lastFilters).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ field: "workspace_id", value: "ws-1" }),
                    expect.objectContaining({ field: "status", value: "open" }),
                ]),
            );
        });
    });

    it("isActive reflects userFilters only, not baseFilters", async () => {
        const tableFilters = [{ field: "workspace_id", operator: "eq", value: "ws-1", type: "AND" }];
        const { result } = renderDataTableHook({ tableFilters });

        await waitFor(() => expect(genericSearchService).toHaveBeenCalled());
        expect(result.current.filters.isActive).toBe(false);

        act(() =>
            result.current.filters.onApply({
                status: { field: "status", operator: "eq", value: "open", type: "AND" },
            }),
        );
        expect(result.current.filters.isActive).toBe(true);

        act(() => result.current.filters.onClear());
        expect(result.current.filters.isActive).toBe(false);
    });

    it("isActive stays false when only urlFilter is present and no user filters applied", async () => {
        const urlFilter = [{ field: "workspace_id", operator: "eq", value: "ws-1", type: "AND" }];
        const { result } = renderDataTableHook({ tableFilters: null, urlFilter });

        await waitFor(() => expect(genericSearchService).toHaveBeenCalled());
        expect(result.current.filters.isActive).toBe(false);
    });

    it("exposes hasClearableBaseFilters for a Dashboard drill-in and clears it back to false", async () => {
        const urlFilter = [{ field: "estado_actual", operator: "eq", value: "vencido", type: "AND" }];
        const { result } = renderDataTableHook({ tableFilters: null, urlFilter });

        await waitFor(() => expect(genericSearchService).toHaveBeenCalled());
        expect(result.current.filters.hasClearableBaseFilters).toBe(true);

        act(() => result.current.filters.onClear());

        await waitFor(() => expect(result.current.filters.hasClearableBaseFilters).toBe(false));
    });

    it("does not flag the context scope (tableFilters) as a clearable base filter", async () => {
        const tableFilters = [{ field: "workspace_id", operator: "eq", value: "ws-1", type: "AND" }];
        const { result } = renderDataTableHook({ tableFilters });

        await waitFor(() => expect(genericSearchService).toHaveBeenCalled());
        expect(result.current.filters.hasClearableBaseFilters).toBe(false);
    });

    it("keeps the selected page size when clearing filters", async () => {
        const { result } = renderDataTableHook({});

        await waitFor(() => expect(genericSearchService).toHaveBeenCalled());

        act(() => result.current.pagination.onPageSizeChange(75));
        await waitFor(() => expect(genericSearchService.mock.calls.at(-1)[2]).toEqual({ limit: 75, offset: 0 }));

        act(() => result.current.filters.onClear());

        await waitFor(() => {
            expect(genericSearchService.mock.calls.at(-1)[2]).toEqual({ limit: 75, offset: 0 });
        });
        expect(result.current.pagination.pageSize).toBe(75);
    });

    it("keeps the selected page size when applying filters without an explicit page size", async () => {
        const { result } = renderDataTableHook({});

        await waitFor(() => expect(genericSearchService).toHaveBeenCalled());

        act(() => result.current.pagination.onPageSizeChange(75));
        act(() =>
            result.current.filters.onApply({
                status: { field: "status", operator: "eq", value: "open", type: "AND" },
            }),
        );

        await waitFor(() => {
            expect(genericSearchService.mock.calls.at(-1)[1]).toEqual(
                expect.arrayContaining([expect.objectContaining({ field: "status", value: "open" })]),
            );
        });
        expect(genericSearchService.mock.calls.at(-1)[2]).toEqual({ limit: 75, offset: 0 });
        expect(result.current.pagination.pageSize).toBe(75);
    });

    it("applies an explicit page size passed with the filters", async () => {
        const { result } = renderDataTableHook({});

        await waitFor(() => expect(genericSearchService).toHaveBeenCalled());

        act(() => result.current.pagination.onPageSizeChange(75));
        act(() =>
            result.current.filters.onApply(
                { status: { field: "status", operator: "eq", value: "open", type: "AND" } },
                25,
            ),
        );

        await waitFor(() => expect(genericSearchService.mock.calls.at(-1)[2]).toEqual({ limit: 25, offset: 0 }));
        expect(result.current.pagination.pageSize).toBe(25);
    });

    it("re-derives baseFilters when the tableFilters prop changes", async () => {
        const { rerender } = renderDataTableHook({
            tableFilters: [{ field: "workspace_id", operator: "eq", value: "ws-A", type: "AND" }],
        });

        await waitFor(() => expect(genericSearchService).toHaveBeenCalled());
        expectFiltersToContainWorkspace(genericSearchService.mock.calls.at(-1)[1], "ws-A");

        rerender({
            tableFilters: [{ field: "workspace_id", operator: "eq", value: "ws-B", type: "AND" }],
        });

        await waitFor(() => {
            const lastFilters = genericSearchService.mock.calls.at(-1)[1];
            expectFiltersToContainWorkspace(lastFilters, "ws-B");
            expect(lastFilters).not.toEqual(expect.arrayContaining([expect.objectContaining({ value: "ws-A" })]));
        });
    });
});
