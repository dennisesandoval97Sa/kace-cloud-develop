import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
    dispatch: vi.fn(),
    schemaFields: [{ column_name: "reference", label: "Reference", data_type: "string" }],
}));

vi.mock("react-redux", () => ({
    useDispatch: () => mocks.dispatch,
    useSelector: () => undefined,
}));
vi.mock("@/hooks/useSchemaFields", () => ({
    default: () => ({ getSchemaField: () => mocks.schemaFields }),
}));
vi.mock("@/hooks/useConfigAgentData", () => ({
    default: () => ({}),
}));
vi.mock("@/services/genericSearchService", () => ({ genericSearchService: vi.fn() }));
vi.mock("../../../hooks/useGenericSearchQuery", () => ({
    default: () => ({ data: undefined, isLoading: false, refetch: vi.fn(), isFetching: false, isError: false }),
}));

const { getSchemaFilterSpy } = vi.hoisted(() => ({ getSchemaFilterSpy: vi.fn() }));

vi.mock("@/services/createSchemaFilter", async (importOriginal) => {
    const actual = await importOriginal();
    getSchemaFilterSpy.mockImplementation(actual.getSchemaFilter);
    return { ...actual, getSchemaFilter: getSchemaFilterSpy };
});

const { default: useCasesTableData } = await import("./useCasesTableData");

describe("useCasesTableData Cases header namespace", () => {
    beforeEach(() => {
        getSchemaFilterSpy.mockClear();
    });

    it("resolves the filter-form column headers through the Cases i18n namespace", () => {
        renderHook(() => useCasesTableData({ keyQuery: "cases" }));

        expect(getSchemaFilterSpy).toHaveBeenCalledWith(
            expect.anything(),
            expect.anything(),
            expect.anything(),
            "columnsCases",
        );
    });
});
