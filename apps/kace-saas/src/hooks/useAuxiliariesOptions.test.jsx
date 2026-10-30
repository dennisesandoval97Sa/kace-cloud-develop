import { renderHook } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import useAuxiliariesOptions from "./useAuxiliariesOptions";
import useGenericViewQuery from "./useGenericViewQuery";
import useConfigAgentData from "./useConfigAgentData";
import { useQuery } from "@tanstack/react-query";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key) => key }),
}));

vi.mock("./useGenericViewQuery", () => ({
    default: vi.fn(),
}));

vi.mock("./useConfigAgentData", () => ({
    default: vi.fn(),
}));

vi.mock("@tanstack/react-query", () => ({
    useQuery: vi.fn(),
}));

describe("useAuxiliariesOptions", () => {
    const mockSchema = {
        id: "cases-schema-id",
        name: "cases",
        data_structure: {
            title: { type: "string" },
            tags: {
                type: "array",
                data_structure: {
                    label: { type: "string" },
                },
            },
        },
    };

    beforeEach(() => {
        vi.clearAllMocks();

        useGenericViewQuery.mockReturnValue({
            data: [{ name: "cases", schema_id: "cases-schema-id" }],
            isLoading: false,
            isFetching: false,
        });

        useConfigAgentData.mockReturnValue({
            sessionTime: { users_schema_id: null },
            groupsConfig: { groups_schema_id: null },
        });

        useQuery.mockReturnValue({
            data: mockSchema,
            isLoading: false,
            isError: false,
        });
    });

    it("includes array fields in options by default", () => {
        const { result } = renderHook(() => useAuxiliariesOptions(true));

        const casesRules = result.current.auxiliariesRules.find((r) => r.dataOrigin === "aux_cases");
        expect(casesRules).toBeDefined();

        const values = casesRules.options.map((o) => o.value);
        expect(values).toContain("aux_cases.title");
        expect(values).toContain("aux_cases.tags.label");
    });

    it("excludes array fields when includeArrays is false", () => {
        const { result } = renderHook(() => useAuxiliariesOptions(true, undefined, { includeArrays: false }));

        const casesRules = result.current.auxiliariesRules.find((r) => r.dataOrigin === "aux_cases");
        expect(casesRules).toBeDefined();

        const values = casesRules.options.map((o) => o.value);
        expect(values).toContain("aux_cases.title");
        expect(values).not.toContain("aux_cases.tags.label");
    });

    it("applies filterFn passed as second argument", () => {
        const isEmailField = (node) => node?.type === "string" && node?.email;
        useQuery.mockReturnValue({
            data: {
                id: "cases-schema-id",
                name: "cases",
                data_structure: {
                    email: { type: "string", email: true },
                    title: { type: "string" },
                },
            },
            isLoading: false,
            isError: false,
        });

        const { result } = renderHook(() => useAuxiliariesOptions(true, isEmailField));

        const casesRules = result.current.auxiliariesRules.find((r) => r.dataOrigin === "aux_cases");
        expect(casesRules).toBeDefined();

        const values = casesRules.options.map((o) => o.value);
        expect(values).toContain("aux_cases.email");
        expect(values).not.toContain("aux_cases.title");
    });
});
