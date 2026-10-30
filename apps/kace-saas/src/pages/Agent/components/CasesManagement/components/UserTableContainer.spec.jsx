import { render } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { UserTableContainer } from "./UserTableContainer";
import { setFilterCases } from "../../../../../redux/state/filterCases";

const mockDispatch = vi.fn();
const mockCasesTableComponent = vi.fn(() => null);

const OPEN_CASES_FILTERS = [
    { column: "cases.cliente_id", value: "client-1", type: "AND", operator: "eq" },
    { column: "cases.fecha_resolucion", value: "null", type: "AND", operator: "null" },
    { column: "cases.parent_id", value: "null", type: "AND", operator: "null" },
];

vi.mock("react-redux", () => ({
    useDispatch: () => mockDispatch,
}));

vi.mock("react-router-dom", () => ({
    useNavigate: () => vi.fn(),
}));

vi.mock("../../../context/AgentContext", () => ({
    useAgentContext: () => ({ configAgent: { cases: {} } }),
}));

vi.mock("../../../../../components/core/CasesTableComponent/CasesTableComponent", () => ({
    CasesTableComponent: (props) => {
        mockCasesTableComponent(props);
        return null;
    },
}));

vi.mock("../../Interactions/utils/openCaseAction", () => ({
    openCaseAction: vi.fn(),
}));

vi.mock("../../../../../redux/state/filterCases", () => ({
    setFilterCases: vi.fn((filters) => ({ type: "filterCases/setFilterCases", payload: filters })),
}));

describe("UserTableContainer", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("passes baseFilters to CasesTableComponent and dispatches them on mount", () => {
        render(<UserTableContainer searchCasesParamsProps={OPEN_CASES_FILTERS} isCustomViewEnabled={false} />);

        expect(mockCasesTableComponent).toHaveBeenCalledWith(
            expect.objectContaining({
                baseFilters: OPEN_CASES_FILTERS,
                onClearFilters: expect.any(Function),
            }),
        );
        expect(setFilterCases).toHaveBeenCalledWith(OPEN_CASES_FILTERS);
        expect(mockDispatch).toHaveBeenCalledWith({
            type: "filterCases/setFilterCases",
            payload: OPEN_CASES_FILTERS,
        });
    });

    it("onClearFilters restores base filters in redux", () => {
        render(<UserTableContainer searchCasesParamsProps={OPEN_CASES_FILTERS} isCustomViewEnabled={false} />);

        const { onClearFilters } = mockCasesTableComponent.mock.calls[0][0];
        onClearFilters();

        expect(setFilterCases).toHaveBeenLastCalledWith(OPEN_CASES_FILTERS);
    });

    it("re-dispatches base filters when searchCasesParamsProps change", () => {
        const closedFilters = [
            { column: "cases.cliente_id", value: "client-2", type: "AND", operator: "eq" },
            { column: "cases.fecha_resolucion", value: "null", type: "AND", operator: "notNull" },
        ];

        const { rerender } = render(
            <UserTableContainer searchCasesParamsProps={OPEN_CASES_FILTERS} isCustomViewEnabled={false} />,
        );

        rerender(<UserTableContainer searchCasesParamsProps={closedFilters} isCustomViewEnabled={false} />);

        expect(setFilterCases).toHaveBeenLastCalledWith(closedFilters);
    });
});
