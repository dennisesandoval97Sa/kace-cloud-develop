import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import CaseDataTable from "./index";
import { getSchemaFilter } from "@/services/createSchemaFilter";

// Mock all dependencies
vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key) => key }),
}));

vi.mock("@/hooks/useDataTable", () => ({
    default: vi.fn(),
}));
import useDataTable from "@/hooks/useDataTable";

vi.mock("@/hooks/useConfigAgentData", () => ({
    default: vi.fn(() => ({
        cases: { ans_display_mode: "row" },
    })),
}));

vi.mock("@/hooks/useSchemaFields", () => ({
    default: () => ({ getSchemaField: () => [] }),
}));

vi.mock("./hooks/useIncludeCasesColumns", () => ({
    default: vi.fn(() => ({ includeCasesColumns: [] })),
}));

vi.mock("./hooks/useCasesFiltersConfig", () => ({
    default: vi.fn(() => ({ casesFiltersConfig: [] })),
}));

vi.mock("../../hooks/useSelectedCases", () => ({
    default: vi.fn(() => ({
        selectedCases: [],
        setSelectedCases: vi.fn(),
        clearSelectedCases: vi.fn(),
        getCaseFromRow: vi.fn(),
        toggleCase: vi.fn(),
        toggleAll: vi.fn(),
    })),
}));

vi.mock("@/components/core/CasesTableComponent/hooks/useSubcasesPanel", () => ({
    default: vi.fn(() => ({
        subcasesPageByParent: {},
        loadingByParent: {},
        errorByParent: {},
        handleInitialLoadSubcases: vi.fn(),
        handleLoadMoreSubcases: vi.fn(),
    })),
}));

vi.mock("@/componentsV2/core/DataTable", () => ({
    default: () => <div data-testid="data-table" />,
}));

vi.mock("@/componentsV2/core/GeneralLoader", () => ({
    GeneralLoader: () => <div data-testid="loader" />,
}));

vi.mock("@/components/ui-shared", () => ({
    GeneralLoader: () => <div data-testid="loader" />,
}));

vi.mock("@/components/core/CasesTableComponent/utils/getAnsRowBackgroundStyle", () => ({
    getAnsRowBackgroundStyle: vi.fn(),
}));

vi.mock("@/components/core/CasesTableComponent/SubcasesPanel", () => ({
    default: () => <div />,
}));

vi.mock("@/services/createSchemaFilter", () => ({
    getSchemaFilter: vi.fn((schema, _fields = [], fieldsNoShow = []) =>
        schema.filter((column) => !fieldsNoShow.includes(column.column_name)),
    ),
    getCasesHeaderNamespace: vi.fn(() => "columnsCases"),
    SPECIAL_FIELDS: { classification_levels: "classification_levels" },
}));

const mockUseDataTableReturn = {
    renderData: { rows: [], processedHeader: [] },
    query: { isLoading: false, isError: false },
    filters: { onApply: vi.fn(), onClear: vi.fn() },
    pagination: {},
    columnSelector: { columns: [], onToggleVisibility: vi.fn() },
    schema: null,
};

beforeEach(() => {
    vi.clearAllMocks();
    useDataTable.mockReturnValue(mockUseDataTableReturn);
});

const TEST_SCHEMA = [
    { column_name: "reference", label: "Ref", data_type: "string" },
    { column_name: "estadoactual", label: "Estado", data_type: "string" },
    { column_name: "nombres", label: "Nombres", data_type: "string" },
    { column_name: "id", label: "Id", data_type: "number" },
];

describe("CaseDataTable column filtering", () => {
    it("processSchema is null when isCustomViewEnabled is false, ignoring visibleColumns", () => {
        render(
            <CaseDataTable
                isCustomViewEnabled={false}
                customViewName="view_case_details"
                visibleColumns={[{ column_name: "reference", header_label: "Ref", cell_type: "default" }]}
            />,
        );
        const { processSchema } = useDataTable.mock.calls[0][0];
        expect(processSchema).toBeNull();
    });

    it("processSchema returns full schema when visibleColumns is empty", () => {
        render(<CaseDataTable isCustomViewEnabled={true} customViewName="view_case_details" visibleColumns={[]} />);
        const { processSchema } = useDataTable.mock.calls[0][0];
        const result = processSchema(TEST_SCHEMA);
        expect(result).toHaveLength(3);
    });

    it("processSchema filters schema to visibleColumns when non-empty", () => {
        const visibleColumns = [
            { column_name: "reference", header_label: "Ref", cell_type: "default" },
            { column_name: "estadoactual", header_label: "Estado", cell_type: "estado" },
        ];
        render(
            <CaseDataTable
                isCustomViewEnabled={true}
                customViewName="view_case_details"
                visibleColumns={visibleColumns}
            />,
        );
        const { processSchema } = useDataTable.mock.calls[0][0];
        const result = processSchema(TEST_SCHEMA);
        expect(result).toHaveLength(2);
        expect(result.map((c) => c.column_name)).toEqual(["reference", "estadoactual"]);
    });

    it("processSchema includes id when configured in visibleColumns", () => {
        const visibleColumns = [{ column_name: "id", header_label: "id", cell_type: "default" }];

        render(
            <CaseDataTable
                isCustomViewEnabled={true}
                customViewName="view_case_details"
                visibleColumns={visibleColumns}
            />,
        );

        const { processSchema } = useDataTable.mock.calls[0][0];
        const result = processSchema(TEST_SCHEMA);

        expect(result).toHaveLength(1);
        expect(result[0].column_name).toBe("id");
    });

    it("resolves the custom-view filters schema headers through the Cases i18n namespace", () => {
        useDataTable.mockReturnValue({
            ...mockUseDataTableReturn,
            schema: [{ column_name: "reference", label: "Reference", data_type: "string" }],
            rawSchema: [{ column_name: "reference", label: "Reference", data_type: "string" }],
        });

        render(
            <CaseDataTable
                isCustomViewEnabled={true}
                customViewName="view_case_details"
                visibleColumns={[{ column_name: "reference", header_label: "Ref", cell_type: "default" }]}
            />,
        );

        expect(getSchemaFilter).toHaveBeenCalledWith(
            expect.anything(),
            expect.anything(),
            expect.anything(),
            "columnsCases",
        );
    });

    it("shows loader when schema is empty and does not render the table", () => {
        useDataTable.mockReturnValue({
            ...mockUseDataTableReturn,
            schema: [],
        });

        const { getByTestId, queryByTestId } = render(
            <CaseDataTable
                isCustomViewEnabled={true}
                customViewName="view_case_details"
                visibleColumns={[{ column_name: "id", header_label: "id", cell_type: "default" }]}
            />,
        );

        expect(getByTestId("loader")).toBeTruthy();
        expect(queryByTestId("data-table")).toBeNull();
    });
});
