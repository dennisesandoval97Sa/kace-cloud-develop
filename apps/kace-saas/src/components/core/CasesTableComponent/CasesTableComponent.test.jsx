import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { CasesTableComponent } from "./CasesTableComponent";
import useConfigAgentData from "../../../hooks/useConfigAgentData";
import useCasesTableData from "../../../pages/Cases/hooks/useCasesTableData";
import { URL_AND_KEYS } from "../../../utils/urlAndKeys";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key) => key }),
}));

const { mockTranslateRef } = vi.hoisted(() => ({ mockTranslateRef: { current: (key) => key } }));

vi.mock("i18next", () => ({
    t: (key) => mockTranslateRef.current(key),
}));

vi.mock("../../../hooks/useConfigAgentData", () => ({
    default: vi.fn(),
}));

vi.mock("../../../pages/Cases/hooks/useCasesTableData", () => ({
    default: vi.fn(),
}));

vi.mock("../../../redux/state/filterCases", () => ({
    setCurrentColor: vi.fn(),
    setTitle: vi.fn(),
}));

vi.mock("@kace/ui-shared", () => ({
    createColumns: (headers) => headers,
}));

vi.mock("../../ui-shared/src/components/table-component/DataTableContainer", () => ({
    /* eslint-disable react/prop-types */
    DataTableContainer: ({ columns = [], dataTable = [], getRowId, showColumnsDropdown, view }) => (
        <div data-testid="data-table-container">
            <div data-testid="data-table-container-show-columns-dropdown">{String(showColumnsDropdown)}</div>
            <div data-testid="data-table-container-view-name">{view?.view ?? ""}</div>
            <div data-testid="data-table-container-resolved-filter">
                {JSON.stringify(view?.resolveFilterCriterion?.({ field: "fecha_vencimiento", value: "a, b" }))}
            </div>
            <div data-testid="data-table-container-transformed-filter">{view?.transformFilterField?.("nivel3")}</div>
            <div data-testid="data-table-container-classification-children">
                {JSON.stringify(dataTable[0]?.classificationChildren ?? [])}
            </div>
            <div data-testid="data-table-container-first-row-id">
                {dataTable[0] && getRowId ? getRowId(dataTable[0], 0) : ""}
            </div>
            {(columns || []).map((column) => (
                <div key={column.accessorKey} data-testid={`col_${column.accessorKey}`}>
                    {typeof column.header === "string" ? column.header : ""}
                </div>
            ))}
        </div>
    ),
}));

vi.mock("./hooks/useSubcasesPanel", () => ({
    default: vi.fn(() => ({
        subcasesPageByParent: {},
        loadingByParent: {},
        errorByParent: {},
        handleInitialLoadSubcases: vi.fn(),
        handleLoadMoreSubcases: vi.fn(),
    })),
}));

vi.mock("./utils/getAnsRowBackgroundStyle", () => ({
    getAnsRowBackgroundStyle: vi.fn(),
}));

vi.mock("../../../pages/Cases/data/Constants", () => ({
    HEADERS_CASES_TABLE: [
        { key: "reference", isVisible: true },
        { key: "estadoActual", isVisible: true },
    ],
}));

const CONTROLLED_HEADERS = [
    { column_name: "reference", label: "Reference", data_type: "string" },
    { column_name: "estadoActual", label: "Estado Actual", data_type: "string" },
];

const MOCK_USE_CASES_TABLE_DATA = {
    headers: CONTROLLED_HEADERS,
    dataTable: [],
    isFetching: false,
    isLoadingTable: false,
    refetch: vi.fn(),
    columnsToFilter: [],
    fieldsCustomerFilters: [],
    caseStatusCounter: [],
    showSubcasesButton: true,
};

beforeEach(() => {
    vi.clearAllMocks();
    mockTranslateRef.current = (key) => key;
    useCasesTableData.mockReturnValue(MOCK_USE_CASES_TABLE_DATA);
    useConfigAgentData.mockReturnValue({
        cases: { headers_labels: [{ key: "reference", label: "Consecutivo Custom" }] },
    });
});

describe("CasesTableComponent — headers_labels override", () => {
    it("uses the headers_labels override for matching columns", () => {
        const { getByTestId } = render(<CasesTableComponent keyQuery="test" />);

        expect(getByTestId("col_reference").textContent).toBe("Consecutivo Custom");
    });

    it("falls back to the i18n/toTitleCase chain when no override exists", () => {
        const { getByTestId } = render(<CasesTableComponent keyQuery="test" />);

        expect(getByTestId("col_estadoActual").textContent).toBe("Estado Actual");
    });

    it("treats whitespace-only override as no override and falls back", () => {
        useConfigAgentData.mockReturnValue({
            cases: { headers_labels: [{ key: "reference", label: "   " }] },
        });

        const { getByTestId } = render(<CasesTableComponent keyQuery="test" />);

        expect(getByTestId("col_reference").textContent).toBe("Reference");
    });

    it("treats empty string override as no override and falls back", () => {
        useConfigAgentData.mockReturnValue({
            cases: { headers_labels: [{ key: "reference", label: "" }] },
        });

        const { getByTestId } = render(<CasesTableComponent keyQuery="test" />);

        expect(getByTestId("col_reference").textContent).toBe("Reference");
    });

    it("ignores entries with empty or missing key", () => {
        useConfigAgentData.mockReturnValue({
            cases: {
                headers_labels: [
                    { key: "", label: "Should be ignored" },
                    { key: "reference", label: "Consecutivo Custom" },
                ],
            },
        });

        const { getByTestId } = render(<CasesTableComponent keyQuery="test" />);

        expect(getByTestId("col_reference").textContent).toBe("Consecutivo Custom");
    });

    it("falls back to defaults when headers_labels is not an array", () => {
        useConfigAgentData.mockReturnValue({
            cases: { headers_labels: null },
        });

        const { getByTestId } = render(<CasesTableComponent keyQuery="test" />);

        expect(getByTestId("col_reference").textContent).toBe("Reference");
    });

    it("applies the override to the subcasos column when showSubcasesColumn is true", () => {
        useConfigAgentData.mockReturnValue({
            cases: { headers_labels: [{ key: "subcasos", label: "My Subcases" }] },
        });

        const { getByTestId, queryByTestId } = render(
            <CasesTableComponent keyQuery="test" showSubcasesColumn={true} />,
        );

        expect(getByTestId("col_subcasos").textContent).toBe("My Subcases");
        expect(queryByTestId("col_subcasos").getAttribute("data-testid")).toBe("col_subcasos");
    });

    it("falls back to a non-empty label when no override is defined for subcasos", () => {
        useConfigAgentData.mockReturnValue({
            cases: { headers_labels: [] },
        });

        const { getByTestId } = render(<CasesTableComponent keyQuery="test" showSubcasesColumn={true} />);

        const subcasosText = getByTestId("col_subcasos").textContent;
        expect(subcasosText).toBeTruthy();
    });

    it("prefers the Cases-specific i18n copy over the shared gridMain.columns key when both translate", () => {
        useCasesTableData.mockReturnValue({
            ...MOCK_USE_CASES_TABLE_DATA,
            headers: [{ column_name: "created_at", label: "Created at", data_type: "date" }],
        });
        mockTranslateRef.current = (key) =>
            ({
                "gridMain.columnsCases.Created at": "Cuándo se creó el caso",
                "gridMain.columns.Created at": "Creado",
            })[key] ?? key;

        const { getByTestId } = render(<CasesTableComponent keyQuery="test" />);

        expect(getByTestId("col_created_at").textContent).toBe("Cuándo se creó el caso");
    });

    it("falls back to the shared gridMain.columns key when the Cases-specific namespace has no translation", () => {
        useCasesTableData.mockReturnValue({
            ...MOCK_USE_CASES_TABLE_DATA,
            headers: [{ column_name: "created_at", label: "Created at", data_type: "date" }],
        });
        mockTranslateRef.current = (key) => (key === "gridMain.columns.Created at" ? "Creado" : key);

        const { getByTestId } = render(<CasesTableComponent keyQuery="test" />);

        expect(getByTestId("col_created_at").textContent).toBe("Creado");
    });
});

describe("CasesTableComponent — show_columns_dropdown forwarding", () => {
    it("passes showColumnsDropdown=true to the table when the config flag is true", () => {
        useConfigAgentData.mockReturnValue({
            cases: { headers_labels: [], show_columns_dropdown: true },
        });

        const { getByTestId } = render(<CasesTableComponent keyQuery="test" />);

        expect(getByTestId("data-table-container-show-columns-dropdown").textContent).toBe("true");
    });

    it("passes showColumnsDropdown=false to the table when the config flag is false", () => {
        useConfigAgentData.mockReturnValue({
            cases: { headers_labels: [], show_columns_dropdown: false },
        });

        const { getByTestId } = render(<CasesTableComponent keyQuery="test" />);

        expect(getByTestId("data-table-container-show-columns-dropdown").textContent).toBe("false");
    });

    it("passes showColumnsDropdown=true by default when the configCases is missing", () => {
        useConfigAgentData.mockReturnValue({ cases: null });

        const { getByTestId } = render(<CasesTableComponent keyQuery="test" />);

        expect(getByTestId("data-table-container-show-columns-dropdown").textContent).toBe("true");
    });
});

describe("CasesTableComponent — classification expansion data", () => {
    it("derives exact classification children instead of reusing broad row children", () => {
        useCasesTableData.mockReturnValue({
            ...MOCK_USE_CASES_TABLE_DATA,
            dataTable: [
                {
                    id: 130,
                    nivel1: "Root",
                    nivel2: 200,
                    nivel10: "Leaf",
                    nivel_riesgo: "High",
                    children: [
                        { id: "nivel2", label: 200 },
                        { id: "nivel10", label: "Leaf" },
                        { id: "nivel_riesgo", label: "High" },
                    ],
                },
            ],
        });

        const { getByTestId } = render(<CasesTableComponent keyQuery="test" />);

        expect(JSON.parse(getByTestId("data-table-container-classification-children").textContent)).toEqual([
            { id: "nivel2", label: "200", value: "200" },
            { id: "nivel10", label: "Leaf", value: "Leaf" },
        ]);
        expect(getByTestId("data-table-container-first-row-id").textContent).toBe("130");
    });
});

describe("CasesTableComponent — cases filter resolver wiring", () => {
    it("passes the classic-view resolver, legacy field transformer and view name to the table", () => {
        const { getByTestId } = render(<CasesTableComponent keyQuery="test" />);

        expect(getByTestId("data-table-container-view-name").textContent).toBe("cases");
        expect(JSON.parse(getByTestId("data-table-container-resolved-filter").textContent)).toEqual({
            field: "cases.sla_due_date",
            value: "a, b",
        });
        expect(getByTestId("data-table-container-transformed-filter").textContent).toBe("clasificaciones.nivel3");
    });

    it("passes customEntity as view name when isCustomViewEnabled is true", () => {
        const { getByTestId } = render(<CasesTableComponent keyQuery="test" isCustomViewEnabled={true} />);

        expect(getByTestId("data-table-container-view-name").textContent).toBe(URL_AND_KEYS.cases.customEntity);
        expect(getByTestId("data-table-container-transformed-filter").textContent).toBe("nivel3");
    });
});
