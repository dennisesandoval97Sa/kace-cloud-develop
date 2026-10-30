import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import useDataTable from "./useDataTable";
import useUserInformation from "@/hooks/useUserInformation";
import { genericSearchService } from "@/services/genericSearchService";
import { useFilterTableHandler } from "./useFilterTableHandler";

vi.mock("@/services/genericSearchService", () => ({
    genericSearchService: vi.fn(),
}));

vi.mock("@/hooks/useDataTableColumns", () => ({
    useDataTableColumns: () => ({ columns: [], processedColumns: [] }),
}));

vi.mock("./useFilterTableHandler", () => ({
    useFilterTableHandler: vi.fn(),
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
    toast: { success: vi.fn(), error: vi.fn(), promise: vi.fn((p) => p) },
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

const dataTableConfig = {
    key: "admin-users-test",
    url: "/users",
    view: "usuarios",
    entity: "usuarios",
};

describe("useDataTable — delete filter", () => {
    let mockCreateNewFilter;

    beforeEach(() => {
        vi.clearAllMocks();
        mockCreateNewFilter = vi.fn().mockResolvedValue({ status: 200 });
        useFilterTableHandler.mockReturnValue({
            promptConfirmation: vi.fn(),
            createNewFilter: mockCreateNewFilter,
        });
        genericSearchService.mockResolvedValue({ data: [], total: { count: 0 } });
    });

    const renderDataTable = (userFilters) => {
        useUserInformation.mockReturnValue({
            user: {
                id: "user-123",
                account_type: 1,
                grupo_activo: "group-1",
                filters: userFilters,
            },
        });

        const queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false, gcTime: 0 } },
        });
        const wrapper = ({ children }) => createElement(QueryClientProvider, { client: queryClient }, children);

        return renderHook(() => useDataTable({ dataTableConfig }), { wrapper });
    };

    it("deletes a saved filter from admin view and updates savedFilterList", async () => {
        const initialFilters = {
            application: {
                admin: {
                    usuarios: {
                        Activos: { is_active: 1 },
                        Inactivos: { is_active: 0 },
                    },
                },
            },
        };

        const { result } = renderDataTable(initialFilters);

        expect(result.current.filters.savedFilterList).toEqual(["Activos", "Inactivos"]);

        let deleteSuccess;
        await act(async () => {
            deleteSuccess = await result.current.filters.handleDeleteFilter("Activos");
        });

        expect(deleteSuccess).toBe(true);
        expect(mockCreateNewFilter).toHaveBeenCalledWith(
            expect.objectContaining({
                filters: {
                    application: {
                        admin: {
                            usuarios: {
                                Inactivos: { is_active: 0 },
                            },
                        },
                    },
                },
            }),
        );
        expect(result.current.filters.savedFilterList).toEqual(["Inactivos"]);
    });

    it("resets selectedFilter when deleting the currently selected filter", async () => {
        const initialFilters = {
            application: {
                admin: {
                    usuarios: {
                        Activos: { is_active: 1 },
                    },
                },
            },
        };

        const { result } = renderDataTable(initialFilters);

        act(() => {
            result.current.filters.onFilterSelect("Activos");
        });
        expect(result.current.filters.selectedFilter).toBe("Activos");

        await act(async () => {
            await result.current.filters.handleDeleteFilter("Activos");
        });

        expect(result.current.filters.selectedFilter).toBe("");
    });

    it("returns false and does not call createNewFilter if filter does not exist", async () => {
        const initialFilters = {
            application: {
                admin: {
                    usuarios: {
                        Activos: { is_active: 1 },
                    },
                },
            },
        };

        const { result } = renderDataTable(initialFilters);

        let deleteSuccess;
        await act(async () => {
            deleteSuccess = await result.current.filters.handleDeleteFilter("NonExistent");
        });

        expect(deleteSuccess).toBe(false);
        expect(mockCreateNewFilter).not.toHaveBeenCalled();
    });
});
