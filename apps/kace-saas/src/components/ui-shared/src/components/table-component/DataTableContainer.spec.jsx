import { fireEvent, render, screen, within } from "@testing-library/react";
import { configureStore } from "@reduxjs/toolkit";
import { Provider } from "react-redux";
import { describe, expect, it, vi } from "vitest";
import { DataTableContainer } from "./DataTableContainer";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key) => key }),
}));

vi.mock("./FilterCustomization", () => ({
    FilterCustomization: ({ children }) => (
        <div data-testid="filter_customization_toolbar">
            {typeof children === "function" ? children(<div data-testid="filter_customization_actions" />) : null}
            <div data-testid="filter_customization_chips" />
        </div>
    ),
}));

const store = configureStore({
    reducer: {
        filterCases: (state = { currentColor: "" }) => state,
    },
});

const columns = [
    {
        accessorKey: "nivel1",
        header: "Classification",
        cell: ({ row, table }) => {
            const contentType = table.options.meta.getExpandedContentType(row.id);

            return (
                <div>
                    <span data-testid={`content_type_${row.original.id}`}>{contentType ?? "none"}</span>
                    <button
                        type="button"
                        onClick={() => {
                            if (row.getIsExpanded() && contentType === "classification") {
                                row.toggleExpanded(false);
                                return;
                            }

                            table.options.meta.setExpandedContentType(row.id, "classification");
                            if (!row.getIsExpanded()) row.toggleExpanded(true);
                        }}
                    >
                        Show classifications
                    </button>
                </div>
            );
        },
    },
    {
        accessorKey: "subcasos",
        header: "Subcases",
        cell: () => null,
    },
];

const createCase = (id, onLoadSubcases = vi.fn(), overrides = {}) => ({
    id,
    nivel1: `Classification ${id}`,
    subcasos: 1,
    classificationChildren: [{ id: "nivel2", label: `Child ${id}` }],
    onLoadSubcases,
    ...overrides,
});

const buildTable = (props = {}) => (
    <Provider store={store}>
        <DataTableContainer
            columns={columns}
            dataTable={[createCase("case-a")]}
            getRowCanExpand={() => true}
            getRowId={(row) => row.id}
            isPagination={false}
            showColumnsButton={false}
            showFilterGeneric={false}
            showUpdateButton={false}
            renderSubComponent={({ row }) => <div>{`Subcases ${row.original.id}`}</div>}
            {...props}
        />
    </Provider>
);

const renderTable = (props = {}) => render(buildTable(props));

const clickClassification = (caseId) => {
    const row = screen.getByTestId(`row_${caseId}`);
    fireEvent.click(within(row).getByRole("button", { name: "Show classifications" }));
};

const clickSubcases = (caseId) => {
    const row = screen.getByTestId(`row_${caseId}`);
    fireEvent.click(within(row).getByRole("button", { name: "gridMain.columns.subcases" }));
};

describe("DataTableContainer pagination after filter shrink", () => {
    it("resets to the first page when a narrower dataset leaves the current page empty", () => {
        const manyRows = Array.from({ length: 15 }, (_, index) => createCase(`case-${index + 1}`));
        const fewRows = [createCase("case-1"), createCase("case-2"), createCase("case-3")];

        const { rerender } = renderTable({
            dataTable: manyRows,
            pageSize: 10,
            isPagination: true,
            autoResetPageIndex: false,
        });

        expect(screen.getByTestId("row_case-1")).toBeInTheDocument();
        expect(screen.queryByTestId("row_case-11")).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "button.next" }));

        expect(screen.getByTestId("row_case-11")).toBeInTheDocument();
        expect(screen.queryByTestId("row_case-1")).not.toBeInTheDocument();

        rerender(
            buildTable({
                dataTable: fewRows,
                pageSize: 10,
                isPagination: true,
                autoResetPageIndex: false,
            }),
        );

        expect(screen.getByTestId("row_case-1")).toBeInTheDocument();
        expect(screen.getByTestId("row_case-3")).toBeInTheDocument();
        expect(screen.queryByTestId("row_case-11")).not.toBeInTheDocument();
    });
});

describe("DataTableContainer toolbar layout", () => {
    it("keeps the original header row intact and renders filter chips below it", () => {
        renderTable({
            caseStatusCounter: [
                { title: "EN GESTION", number: 2, color: "#f59e0b" },
                { title: "ESCALADO", number: 1, color: "#22c55e" },
            ],
            showColumnsButton: true,
            showUpdateButton: true,
        });

        const header = screen.getByTestId("data_table_container_header");
        const chips = screen.getByTestId("filter_customization_chips");

        expect(header.className).toMatch(/sm:flex-row/);
        expect(screen.getByTestId("data_table_container_case_status_counter")).toBeInTheDocument();
        expect(screen.getByTestId("data_table_container_header_actions")).toBeInTheDocument();
        expect(header.compareDocumentPosition(chips) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });
});

describe("DataTableContainer expanded content", () => {
    it("renders the complete canonical Classification Path in numerical order", () => {
        const fullPathCase = createCase("full-path", vi.fn(), {
            nivel1: "Level 1",
            nivel2: "Level 2",
            nivel3: "Level 3",
            nivel4: "Level 4",
            nivel5: "Level 5",
            nivel6: "Level 6",
            classificationChildren: [
                { id: "nivel2", label: "Level 2" },
                { id: "nivel3", label: "Level 3" },
                { id: "nivel4", label: "Level 4" },
                { id: "nivel5", label: "Level 5" },
                { id: "nivel6", label: "Level 6" },
            ],
        });

        renderTable({ dataTable: [fullPathCase] });
        clickClassification("full-path");

        const expandedRow = screen.getByTestId("data_table_container_row_expanded_full-path");
        const pathText = expandedRow.textContent;
        const pathLabels = ["Level 1", "Level 2", "Level 3", "Level 4", "Level 5", "Level 6"];

        pathLabels.forEach((label) => {
            expect(within(expandedRow).getByText(label)).toBeInTheDocument();
        });
        expect(pathLabels.map((label) => pathText.indexOf(label))).toEqual(
            [...pathLabels].map((label) => pathText.indexOf(label)).sort((left, right) => left - right),
        );
    });

    it("normalizes, orders, and filters the legacy root-plus-descendants fallback", () => {
        const fallbackCase = createCase("fallback-path", vi.fn(), {
            nivel1: "Root",
            classificationChildren: [
                { id: "nivel6", label: "Level 6" },
                { id: "nivel2", label: "Level 2" },
                { id: "nivel2", label: "Duplicate Level 2" },
                { id: "nivel_riesgo", label: "Risk" },
                { id: "nivel11", label: "Unsupported" },
            ],
        });

        renderTable({ dataTable: [fallbackCase] });
        clickClassification("fallback-path");

        const expandedRow = screen.getByTestId("data_table_container_row_expanded_fallback-path");
        const pathText = expandedRow.textContent;

        expect(within(expandedRow).getByText("Root")).toBeInTheDocument();
        expect(within(expandedRow).getByText("Level 2")).toBeInTheDocument();
        expect(within(expandedRow).getByText("Level 6")).toBeInTheDocument();
        expect(pathText.indexOf("Root")).toBeLessThan(pathText.indexOf("Level 2"));
        expect(pathText.indexOf("Level 2")).toBeLessThan(pathText.indexOf("Level 6"));
        expect(within(expandedRow).queryByText("Duplicate Level 2")).not.toBeInTheDocument();
        expect(within(expandedRow).queryByText("Risk")).not.toBeInTheDocument();
        expect(within(expandedRow).queryByText("Unsupported")).not.toBeInTheDocument();
    });

    it("switches an expanded classification row to subcases without collapsing it", () => {
        const onLoadSubcases = vi.fn();
        renderTable({ dataTable: [createCase("case-a", onLoadSubcases)] });

        clickClassification("case-a");
        expect(screen.getByText("Child case-a")).toBeInTheDocument();

        clickSubcases("case-a");

        expect(screen.getByText("Subcases case-a")).toBeInTheDocument();
        expect(screen.queryByText("Child case-a")).not.toBeInTheDocument();
        expect(onLoadSubcases).toHaveBeenCalledTimes(1);
    });

    it("collapses an expanded subcases row without loading subcases again", () => {
        const onLoadSubcases = vi.fn();
        renderTable({ dataTable: [createCase("case-a", onLoadSubcases)] });

        clickSubcases("case-a");
        expect(screen.getByText("Subcases case-a")).toBeInTheDocument();
        expect(onLoadSubcases).toHaveBeenCalledTimes(1);

        clickSubcases("case-a");

        expect(screen.queryByText("Subcases case-a")).not.toBeInTheDocument();
        expect(onLoadSubcases).toHaveBeenCalledTimes(1);
    });

    it("preserves expansion across new data references and prunes it when an identity disappears", () => {
        const caseA = createCase("case-a");
        const caseB = createCase("case-b");
        const { rerender } = renderTable({ dataTable: [caseA, caseB] });

        clickClassification("case-a");
        expect(screen.getByText("Child case-a")).toBeInTheDocument();

        rerender(buildTable({ dataTable: [{ ...caseB }, { ...caseA }] }));

        expect(screen.getByText("Child case-a")).toBeInTheDocument();
        expect(screen.queryByText("Child case-b")).not.toBeInTheDocument();

        rerender(buildTable({ dataTable: [caseB] }));
        rerender(buildTable({ dataTable: [caseA, caseB] }));

        expect(screen.queryByText("Child case-a")).not.toBeInTheDocument();
        expect(screen.getByTestId("content_type_case-a")).toHaveTextContent("none");
    });

    /*
     * Regresión: al aplicar un filtro, useHookFilter deja en caché un objeto
     * { data, count, total, metadata } en vez de un array. Antes esto lanzaba
     * "dataTable.map is not a function" y tumbaba la ruta entera vía RouteErrorBoundary.
     */
    it("renders an empty table instead of throwing when dataTable is not an array", () => {
        expect(() => renderTable({ dataTable: { data: [], count: 0, total: 0, metadata: {} } })).not.toThrow();
        expect(screen.getByTestId("data_table_container")).toBeInTheDocument();
        expect(screen.queryByTestId("row_case-a")).not.toBeInTheDocument();
    });
});
