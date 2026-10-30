import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useReactTable, getCoreRowModel } from "@tanstack/react-table";
import { buildRunColumns } from "./runColumns";
import { DataTableViewOptions } from "../../../components/ui-shared/src/components/table-component/data-table-view-options-props";

vi.mock("react-i18next", async () => {
    const actual = await vi.importActual("react-i18next");
    return { ...actual, useTranslation: () => ({ t: (key) => key }) };
});

vi.mock("@kace/ui-shared", () => ({
    Button: ({ children, variant: _variant, size: _size, ...props }) => <button {...props}>{children}</button>,
}));

// Simula i18n real: las claves conocidas "traducen" (devuelven la clave), las desconocidas caen al defaultValue.
const KNOWN_STATUS_KEYS = new Set([
    "assignmentMonitor.statuses.completed",
    "assignmentMonitor.statuses.no_actions",
    "assignmentMonitor.statuses.no_eligible_actions",
    "assignmentMonitor.statuses.already_running",
    "assignmentMonitor.statuses.error",
]);
const t = (key, opts) => (KNOWN_STATUS_KEYS.has(key) ? key : (opts?.defaultValue ?? key));

const getColumn = (columns, key) => columns.find((column) => column.accessorKey === key || column.id === key);

const renderCell = (column, original) => render(column.cell({ row: { original } }));

describe("buildRunColumns", () => {
    it("formats durations under a second in milliseconds", () => {
        const columns = buildRunColumns(t, vi.fn());
        renderCell(getColumn(columns, "duration_ms"), { duration_ms: 750 });

        expect(screen.getByText("750 ms")).toBeInTheDocument();
        expect(screen.queryByTestId("slow-run")).not.toBeInTheDocument();
    });

    it("marks durations of a minute or more as slow runs", () => {
        const columns = buildRunColumns(t, vi.fn());
        renderCell(getColumn(columns, "duration_ms"), { duration_ms: 60000 });

        expect(screen.getByTestId("slow-run")).toHaveTextContent("60.0 s");
    });

    it("renders the i18n key for a known status", () => {
        const columns = buildRunColumns(t, vi.fn());
        renderCell(getColumn(columns, "status"), { status: "completed" });

        expect(screen.getByText("assignmentMonitor.statuses.completed")).toBeInTheDocument();
    });

    it("renders unknown statuses with the raw value and neutral colors", () => {
        const columns = buildRunColumns(t, vi.fn());
        renderCell(getColumn(columns, "status"), { status: "brand_new_status" });

        const badge = screen.getByText("brand_new_status");
        expect(badge).toHaveStyle({ backgroundColor: "#F3F4F6", color: "#374151" });
    });

    it("renders groups_without_capacity 0 as plain text without a badge", () => {
        const columns = buildRunColumns(t, vi.fn());
        renderCell(getColumn(columns, "groups_without_capacity"), { groups_without_capacity: 0 });

        expect(screen.getByText("0")).toBeInTheDocument();
        expect(screen.queryByTestId("no-capacity-badge")).not.toBeInTheDocument();
    });

    it("renders groups_without_capacity above 0 as a red badge", () => {
        const columns = buildRunColumns(t, vi.fn());
        renderCell(getColumn(columns, "groups_without_capacity"), { groups_without_capacity: 3 });

        const badge = screen.getByTestId("no-capacity-badge");
        expect(badge).toHaveTextContent("3");
        expect(badge).toHaveStyle({ backgroundColor: "#FDE8E4", color: "#B42318" });
    });

    it("renders candidates_backlog_total and shows — when null", () => {
        const columns = buildRunColumns(t, () => {});
        const column = getColumn(columns, "candidates_backlog_total");

        const withValue = render(column.cell({ row: { original: { candidates_backlog_total: 8575 } } }));
        expect(withValue.getByText("8575")).toBeInTheDocument();
        withValue.unmount();

        const withNull = render(column.cell({ row: { original: { candidates_backlog_total: null } } }));
        expect(withNull.getByText("—")).toBeInTheDocument();
    });

    it("renders a real 0 backlog as 0, not —", () => {
        const columns = buildRunColumns(t, () => {});
        renderCell(getColumn(columns, "candidates_backlog_total"), { candidates_backlog_total: 0 });

        expect(screen.getByText("0")).toBeInTheDocument();
        expect(screen.queryByText("—")).not.toBeInTheDocument();
    });

    it("marks every data column as visible so the column toggle can hide/show it", () => {
        const columns = buildRunColumns(t, vi.fn());
        const dataColumns = columns.filter((column) => column.accessorKey);

        expect(dataColumns.length).toBeGreaterThan(0);
        dataColumns.forEach((column) => {
            expect(column.isVisible).toBe(true);
        });
    });

    it("leaves the actions column out of the toggle (no isVisible flag)", () => {
        const columns = buildRunColumns(t, vi.fn());

        expect(getColumn(columns, "actions").isVisible).toBeUndefined();
    });

    it("exposes exactly the data columns as toggles in the real column-visibility menu, excluding actions", async () => {
        const columns = buildRunColumns(t, vi.fn());
        const dataColumnIds = columns.filter((column) => column.accessorKey).map((column) => column.accessorKey);

        const TableHarness = () => {
            const table = useReactTable({ data: [], columns, getCoreRowModel: getCoreRowModel() });
            return <DataTableViewOptions table={table} />;
        };

        const user = userEvent.setup();
        render(<TableHarness />);
        await user.click(screen.getByTestId("view_column_options"));

        for (const id of dataColumnIds) {
            expect(await screen.findByTestId(`select_column_item_${id}`)).toBeInTheDocument();
        }
        expect(screen.queryByTestId("select_column_item_actions")).not.toBeInTheDocument();
    });

    it("calls onOpenDetail with the row when the detail button is clicked", () => {
        const onOpenDetail = vi.fn();
        const columns = buildRunColumns(t, onOpenDetail);
        const original = { id: "r9", status: "completed" };
        renderCell(getColumn(columns, "actions"), original);

        fireEvent.click(screen.getByTestId("btn_run_detail_r9"));

        expect(onOpenDetail).toHaveBeenCalledWith(original);
    });
});
