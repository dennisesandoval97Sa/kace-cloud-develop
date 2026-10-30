import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const DATE_RANGE = "2026-08-12T19:00:00.000-05, 2026-08-29T18:59:59.999-05";

const mockUseHookFilter = vi.fn(() => ({ onSubmit: vi.fn() }));
let mockColumnsToFilter = [];

vi.mock("../../../components/ui-shared/src/components/table-component/hooks/useHookFilter", () => ({
    default: (...args) => mockUseHookFilter(...args),
}));
vi.mock("../../../components/ui-shared/src/components/table-component/InputValueDepend", () => ({
    InputValueDepend: () => null,
}));
vi.mock("../../../components/ui-shared/src/components/general-loader", () => ({
    GeneralLoader: () => null,
}));
vi.mock("@kace/ui-shared", () => ({
    Button: (props) => <button {...props} />,
    Label: (props) => <label {...props} />,
}));
vi.mock("@/pages/MassiveExecution/components/MassiveExecutionSelectType", () => ({
    default: () => null,
}));
vi.mock("../hooks/useMassiveExecutionCasesTable", () => ({
    default: () => ({ columnsToFilter: mockColumnsToFilter, dataTable: [] }),
}));
vi.mock("../hooks/useMassiveExecutionCasesForm", () => ({
    default: () => ({
        handleChangeExecutionData: vi.fn(),
        handleExecutionActions: vi.fn(),
        handleClearCasesFilter: vi.fn(),
        isPendingCases: false,
    }),
}));
vi.mock("../hooks/useMassiveExecutionClientsFileForm", () => ({
    default: () => ({ handleClearClientsFilter: vi.fn() }),
}));
vi.mock("react-redux", () => ({ useSelector: () => [] }));
vi.mock("@tanstack/react-query", () => ({
    useQueryClient: () => ({
        setQueryData: vi.fn(),
        invalidateQueries: vi.fn(),
        removeQueries: vi.fn(),
    }),
}));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key) => key }) }));

const { default: MassiveExecutionCasesFilterForm } = await import("./MassiveExecutionCasesFilterForm");

const getNameTable = () => mockUseHookFilter.mock.calls.at(-1)[0].nameTable;

describe("MassiveExecutionCasesFilterForm", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockColumnsToFilter = [];
    });

    it("renders each filter label with the header provided by the hook", () => {
        mockColumnsToFilter = [
            { column_name: "nivel1", header: "Niveles", data_type: "classification_levels", options: [] },
            { column_name: "reference", header: "Caso", data_type: "number", options: [] },
        ];
        render(<MassiveExecutionCasesFilterForm />);

        expect(screen.getByTestId("massivefilter_nivel1_label").textContent).toBe("Niveles");
        expect(screen.getByTestId("massivefilter_reference_label").textContent).toBe("Caso");
    });

    it("injects the cases criterion resolver into useHookFilter", () => {
        render(<MassiveExecutionCasesFilterForm />);

        expect(typeof getNameTable().resolveFilterCriterion).toBe("function");
    });

    /*
     * transformFilterField y fieldsCustomerFilters quedan anulados por el resolvedor en
     * buildFilterCriteriaFromForm, asi que declararlos aqui solo confundiria a quien venga despues.
     */
    it("does not declare configuration that the criterion resolver overrides", () => {
        render(<MassiveExecutionCasesFilterForm />);

        const call = mockUseHookFilter.mock.calls.at(-1)[0];
        expect(call.nameTable.transformFilterField).toBeUndefined();
        expect(call.fieldsCustomerFilters).toEqual([]);
    });

    /*
     * fecha_vencimiento es un alias de view_casos sobre cases.sla_due_date. Sin el resolvedor el
     * filtro salia como cases.fecha_vencimiento y /cases/search fallaba con "column does not exist".
     */
    it("resolves fecha_vencimiento to the real cases column", () => {
        render(<MassiveExecutionCasesFilterForm />);

        const resolved = getNameTable().resolveFilterCriterion({
            field: "fecha_vencimiento",
            value: DATE_RANGE,
        });

        expect(resolved).toEqual({
            field: "cases.sla_due_date",
            value: DATE_RANGE,
        });
    });

    it("keeps the classic view mapping for nivel columns", () => {
        render(<MassiveExecutionCasesFilterForm />);

        expect(getNameTable().resolveFilterCriterion({ field: "nivel1", value: "nivel2/Foo" })).toEqual({
            field: "clasificaciones.nivel2",
            value: "Foo",
        });
    });
});
