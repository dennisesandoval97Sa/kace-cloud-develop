import { beforeEach, describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { DataTable } from "./data-table";
import { createColumns } from "./columns";

const dataTableMock = vi.hoisted(() => ({ rows: [] }));

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key) => key }),
}));

vi.mock("./hooks/useDataTable", () => ({
    default: () => ({
        dataTable: dataTableMock.rows,
        isLoading: false,
        refetch: vi.fn(),
        isRefetching: false,
        setNextCountItems: vi.fn(),
    }),
}));

vi.mock("../ui/dropdown-menu", () => ({
    DropdownMenu: ({ children }) => <div>{children}</div>,
    DropdownMenuTrigger: ({ children }) => <div>{children}</div>,
    DropdownMenuContent: ({ children }) => <div>{children}</div>,
    DropdownMenuLabel: ({ children }) => <div>{children}</div>,
    DropdownMenuSeparator: () => <div />,
    DropdownMenuCheckboxItem: ({ children }) => <div>{children}</div>,
}));

vi.mock("./filter-customization", () => ({
    FilterCustomization: () => <div data-testid="filter-customization" />,
}));

vi.mock("./AllButtonsFilters", () => ({
    AllButtonsFilters: () => <div />,
}));

vi.mock("./DropdownActions", () => ({
    DropdownActions: () => <div />,
}));

vi.mock("./pagination", () => ({
    default: () => <div />,
}));

vi.mock("../general-loader", () => ({
    GeneralLoader: () => <div />,
}));

const baseColumns = [
    {
        accessorKey: "id",
        accessorFn: (row) => row?.id,
        header: "Id",
        isVisible: true,
        getCanHide: () => true,
    },
];

describe("DataTable - showColumnsDropdown prop", () => {
    beforeEach(() => {
        dataTableMock.rows = [];
    });

    it("renders the columns dropdown by default (showColumnsDropdown defaults to true)", () => {
        render(<DataTable nameTable="test" keyQueryData="test" columns={baseColumns} />);

        expect(screen.getByTestId("view_column_options")).toBeInTheDocument();
    });

    it("does not render the columns dropdown when showColumnsDropdown is false", () => {
        render(<DataTable nameTable="test" keyQueryData="test" columns={baseColumns} showColumnsDropdown={false} />);

        expect(screen.queryByTestId("view_column_options")).toBeNull();
    });

    it("does not crash when date fields contain malformed object values", () => {
        dataTableMock.rows = [
            {
                id: "f9dc8be6-ed59-423b-95a9-5c007b8819ad",
                description: "TestCronJob",
                frequency: "30 2 * * *",
                created_at: { field: "created at" },
                updated_at: { field: "updated at" },
            },
        ];
        const columns = createColumns(
            [
                { accessorKey: "description", header: "Description" },
                { accessorKey: "frequency", header: "Frequency" },
                { accessorKey: "created_at", header: "Created at" },
                { accessorKey: "updated_at", header: "Updated at" },
            ],
            false,
        );

        expect(() =>
            render(
                <DataTable
                    nameTable="automation-settings"
                    keyQueryData="automationSettingsData"
                    columns={columns}
                    showColumnsDropdown={false}
                />,
            ),
        ).not.toThrow();
        expect(screen.getByText("TestCronJob")).toBeInTheDocument();
    });
});
