import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SPECIAL_FIELDS } from "@/services/createSchemaFilter";
import { genericSearchService } from "@/services/genericSearchService";
import useDataTable from "./useDataTable";
import useUserInformation from "./useUserInformation";

const mocks = vi.hoisted(() => ({
    schemaFields: [
        { column_name: "description", data_type: "String", label: "Description" },
        { column_name: "is_active", data_type: "Integer", label: "Status" },
        { column_name: "password", data_type: "String", label: "Password" },
    ],
}));

vi.mock("@/services/genericSearchService", () => ({
    genericSearchService: vi.fn(),
}));

vi.mock("./useFilterTableHandler", () => ({
    useFilterTableHandler: () => ({
        promptConfirmation: vi.fn(),
        createNewFilter: vi.fn(),
    }),
}));

vi.mock("@/hooks/useSchemaFields", () => ({
    default: () => ({ getSchemaField: () => mocks.schemaFields }),
}));

vi.mock("./useUserInformation", () => ({
    default: vi.fn(),
}));

vi.mock("react-router-dom", () => ({
    useLocation: () => ({ state: undefined }),
}));

vi.mock("sonner", () => ({
    toast: { success: vi.fn(), error: vi.fn(), promise: vi.fn() },
}));

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key) => key }),
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
    key: "mail-accounts",
    url: "/mail-accounts",
    view: "mail_accounts",
    entity: "mail_accounts",
    genericColumns: ["description"],
    filterColumns: ["description", "is_active"],
};

const processColumns = (defaults) => ({
    ...defaults,
    description: (row) => ({
        ...row,
        filterData: {
            field: "mail_accounts.description",
            operator: "ilike",
            type: "AND",
            value: "",
        },
    }),
    is_active: (row) => ({
        ...row,
        filterData: {
            field: "mail_accounts.is_active",
            operator: "eq",
            type: "AND",
            value: "",
        },
    }),
});

const processFilters = (defaults) => [
    ...defaults,
    {
        column_name: "is_active",
        field: SPECIAL_FIELDS.switch_state,
    },
];

const renderDataTable = (savedFilter) => {
    useUserInformation.mockReturnValue({
        user: {
            filters: {
                application: {
                    admin: {
                        mail_accounts: {
                            legacy: savedFilter,
                        },
                    },
                },
            },
        },
    });

    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
    const wrapper = ({ children }) => createElement(QueryClientProvider, { client: queryClient }, children);

    return renderHook(
        () =>
            useDataTable({
                dataTableConfig,
                processColumns,
                processFilters,
            }),
        { wrapper },
    );
};

describe("useDataTable legacy compatibility", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        genericSearchService.mockResolvedValue({ data: [], total: { count: 0 } });
    });

    it("keeps explicit hidden filters without exposing them as table columns", async () => {
        const { result } = renderDataTable({});

        await waitFor(() => expect(genericSearchService).toHaveBeenCalled());

        expect(result.current.schema.map((column) => column.column_name)).toEqual(["description"]);
        expect(result.current.filters.schema.map((column) => column.column_name)).toEqual(["description", "is_active"]);
    });

    it("normalizes primitive legacy presets before applying them", async () => {
        const { result } = renderDataTable({
            description: "SMTP",
            is_active: 0,
        });

        await waitFor(() => expect(result.current.filters.savedFilterList).toEqual(["legacy"]));

        act(() => result.current.filters.onFilterSelect("legacy"));

        expect(result.current.filters.currentFiltersValues).toEqual({
            description: {
                field: "mail_accounts.description",
                operator: "ilike",
                type: "AND",
                value: "SMTP",
            },
            is_active: {
                field: "mail_accounts.is_active",
                operator: "neq",
                type: "AND",
                value: 1,
            },
        });

        act(() => result.current.filters.onApply(result.current.filters.currentFiltersValues));

        await waitFor(() => {
            expect(genericSearchService.mock.calls.at(-1)[1]).toEqual([
                {
                    field: "mail_accounts.description",
                    operator: "ilike",
                    type: "AND",
                    value: "SMTP",
                },
                {
                    field: "mail_accounts.is_active",
                    operator: "neq",
                    type: "AND",
                    value: 1,
                },
            ]);
        });
    });

    it("keeps DataTableV2 filter descriptors unchanged", async () => {
        const descriptor = {
            field: "mail_accounts.is_active",
            operator: "eq",
            type: "AND",
            value: "true",
        };
        const { result } = renderDataTable({ is_active: descriptor });

        await waitFor(() => expect(result.current.filters.savedFilterList).toEqual(["legacy"]));

        act(() => result.current.filters.onFilterSelect("legacy"));

        expect(result.current.filters.currentFiltersValues).toEqual({ is_active: descriptor });
    });
});
