import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DataTableViewOptions } from "./data-table-view-options-props";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key) => key }),
}));

vi.mock("../ui/dropdown-menu", () => ({
    DropdownMenu: ({ children }) => <div>{children}</div>,
    DropdownMenuTrigger: ({ children }) => <div>{children}</div>,
    DropdownMenuContent: ({ children }) => <div>{children}</div>,
    DropdownMenuLabel: ({ children }) => <div>{children}</div>,
    DropdownMenuSeparator: () => <div />,
    DropdownMenuCheckboxItem: ({ children, checked, onCheckedChange, ...props }) => (
        <button role="checkbox" aria-checked={checked} onClick={() => onCheckedChange(!checked)} {...props}>
            {children}
        </button>
    ),
}));

const makeColumn = ({ id, header, accessor = true, canHide = true, isVisible, visible = true }) => ({
    id,
    columnDef: { header, isVisible },
    accessorFn: accessor ? () => null : undefined,
    getCanHide: () => canHide,
    getIsVisible: () => visible,
    toggleVisibility: vi.fn(),
});

const renderMenu = (columns) => render(<DataTableViewOptions table={{ getAllColumns: () => columns }} />);

describe("DataTableViewOptions", () => {
    it("lists only columns flagged isVisible in the toggle menu", () => {
        renderMenu([
            makeColumn({ id: "started_at", header: "Started at", isVisible: true }),
            makeColumn({ id: "status", header: "Status", isVisible: true }),
            makeColumn({ id: "legacy", header: "Legacy", isVisible: undefined }),
        ]);

        expect(screen.getByTestId("select_column_item_started_at")).toBeInTheDocument();
        expect(screen.getByTestId("select_column_item_status")).toBeInTheDocument();
        expect(screen.queryByTestId("select_column_item_legacy")).not.toBeInTheDocument();
    });

    it("excludes display columns without an accessor even when isVisible is set", () => {
        renderMenu([makeColumn({ id: "actions", header: "Detail", accessor: false, isVisible: true })]);

        expect(screen.queryByTestId("select_column_item_actions")).not.toBeInTheDocument();
    });

    it("excludes columns that cannot be hidden", () => {
        renderMenu([makeColumn({ id: "pinned", header: "Pinned", canHide: false, isVisible: true })]);

        expect(screen.queryByTestId("select_column_item_pinned")).not.toBeInTheDocument();
    });

    it("toggles a column's visibility when its menu item is clicked", () => {
        const column = makeColumn({ id: "errors", header: "Errors", isVisible: true, visible: true });
        renderMenu([column]);

        fireEvent.click(screen.getByTestId("select_column_item_errors"));

        expect(column.toggleVisibility).toHaveBeenCalledWith(false);
    });

    it("excludes columns explicitly marked isVisible: false", () => {
        renderMenu([
            makeColumn({ id: "started_at", header: "Started at", isVisible: true }),
            makeColumn({ id: "hidden_by_default", header: "Hidden", isVisible: false }),
        ]);

        expect(screen.getByTestId("select_column_item_started_at")).toBeInTheDocument();
        expect(screen.queryByTestId("select_column_item_hidden_by_default")).not.toBeInTheDocument();
    });

    it("renders the column header as the visible toggle label", () => {
        renderMenu([makeColumn({ id: "started_at", header: "Started at", isVisible: true })]);

        expect(screen.getByTestId("select_column_item_started_at")).toHaveTextContent("Started at");
    });

    it("falls back to column.id when the header is not a string", () => {
        renderMenu([makeColumn({ id: "with_jsx_header", header: <span>JSX</span>, isVisible: true })]);

        expect(screen.getByTestId("select_column_item_with_jsx_header")).toHaveTextContent("with_jsx_header");
    });
});
