import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { DataTableContainer } from "./DataTableContainer";

// Only peripheral deps are mocked; the real @tanstack/react-table row model stays in play,
// since the internal client-side pagination is exactly what these tests exercise.
vi.mock("react-redux", () => ({ useSelector: () => undefined }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key) => key }) }));
vi.mock("../ui/table", () => ({
    Table: ({ children, ...props }) => <table {...props}>{children}</table>,
    TableHeader: ({ children, ...props }) => <thead {...props}>{children}</thead>,
    TableBody: ({ children, ...props }) => <tbody {...props}>{children}</tbody>,
    TableRow: ({ children, ...props }) => <tr {...props}>{children}</tr>,
    TableHead: ({ children, ...props }) => <th {...props}>{children}</th>,
    TableCell: ({ children, ...props }) => <td {...props}>{children}</td>,
}));
vi.mock("./pagination", () => ({ default: () => <div data-testid="pagination" /> }));
vi.mock("../ui/button", () => ({ Button: ({ children, ...props }) => <button {...props}>{children}</button> }));
vi.mock("./data-table-view-options-props", () => ({ DataTableViewOptions: () => null }));
vi.mock("./CaseStatusCounterModal", () => ({ CaseStatusCounterModal: () => null }));
vi.mock("../general-loader", () => ({ GeneralLoader: () => <div>loading</div> }));
vi.mock("./AllButtonsFilters", () => ({ AllButtonsFilters: () => null }));
vi.mock("../../../../core/ErrorPage/ErrorGetData", () => ({ ErrorGetData: () => <div>error</div> }));
vi.mock("./FilterCustomization", () => ({ FilterCustomization: () => null }));
vi.mock("../CaseStatusCounter", () => ({ CaseStatusCounter: () => null }));
vi.mock("./SortableHeader", () => ({ SortableHeader: ({ children }) => <span>{children}</span> }));
vi.mock("lucide-react", async (importOriginal) => ({
    ...(await importOriginal()),
    EyeIcon: () => <span />,
}));

const columns = [{ accessorKey: "name", header: "Name", cell: ({ row }) => row.original.name }];
const makeRows = (n) => Array.from({ length: n }, (_, i) => ({ id: `r${i}`, name: `Run ${i}` }));
const countRows = (container) => container.querySelectorAll('[data-testid^="row_"]').length;

describe("DataTableContainer pageSize", () => {
    it("renders all supplied rows when pageSize matches the row count (server-side pagination)", () => {
        const { container } = render(
            <DataTableContainer columns={columns} dataTable={makeRows(25)} isPagination={false} pageSize={25} />,
        );
        expect(countRows(container)).toBe(25);
    });

    it("clips to the internal page size when pageSize is left at the default of 10", () => {
        const { container } = render(
            <DataTableContainer columns={columns} dataTable={makeRows(25)} isPagination={false} />,
        );
        expect(countRows(container)).toBe(10);
    });

    it("re-syncs the rendered row count when the pageSize prop changes", () => {
        const { container, rerender } = render(
            <DataTableContainer columns={columns} dataTable={makeRows(100)} isPagination={false} pageSize={10} />,
        );
        expect(countRows(container)).toBe(10);

        rerender(
            <DataTableContainer columns={columns} dataTable={makeRows(100)} isPagination={false} pageSize={100} />,
        );
        expect(countRows(container)).toBe(100);
    });
});
