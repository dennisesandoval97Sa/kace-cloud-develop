import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useNavigate, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";

import useGenericSearchQuery from "@kace/hooks/useGenericSearchQuery";
import useGenericViewQuery from "@kace/hooks/useGenericViewQuery";
import useGeneralDelete from "@kace/hooks/useGeneralDelete";
import useGeneralMutation from "@kace/hooks/useGeneralMutation";
import { genericHandleSendInformation } from "../../../services/genericHandleSendInformation";

import { WS_REST_STEPS_SERVICE, WS_REST_FLOWS_SERVICE } from "@kace/urls";
import { NAME_LOCATION_FILTER } from "@kace/utils";

import { INITIAL_VALUES_WS_REST_FLOWS } from "../data/constants";
import useRestFlowCreate from "./useRestFlowCreate";

let mockParamsReturn = {};
vi.mock("react-router-dom", () => ({
    useNavigate: vi.fn(),
    useParams: vi.fn(() => mockParamsReturn),
}));

vi.mock("@tanstack/react-query", () => ({
    useQueryClient: vi.fn(),
}));

vi.mock("@kace/hooks/useGenericSearchQuery", () => ({
    default: vi.fn(),
}));
vi.mock("@kace/hooks/useGenericViewQuery", () => ({
    default: vi.fn(),
}));
vi.mock("@kace/hooks/useGeneralDelete", () => ({
    default: vi.fn(),
}));

let mockMainFlowMutationState = {
    mutate: vi.fn(),
    isPending: false,
    isSuccess: false,
};
let mockStepsMutationState = {
    mutateAsync: vi.fn(),
    isPending: false,
    isSuccess: false,
};

/*
 * IMPORTANT: Mock useGeneralMutation to always return a consistent structure.
 * We will then spy on and modify these states in beforeEach or in individual tests.
 */
vi.mock("@kace/hooks/useGeneralMutation", () => ({
    default: vi.fn((options) => {
        /*
         * Return different mock state objects based on the keyQuery or call order if needed.
         * For this hook, it's called first for 'wsRestFlowsData', then for 'wsFlowStepsSearch'.
         */
        if (options.keyQuery === "wsRestFlowsData") {
            return mockMainFlowMutationState;
        } else if (options.keyQuery === "wsFlowStepsSearch") {
            return mockStepsMutationState;
        }
        return { mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false, isSuccess: false };
    }),
}));

vi.mock("@kace/urls", () => ({
    WS_REST_STEPS_SERVICE: "/mock-ws-rest-steps",
    WS_REST_FLOWS_SERVICE: "/mock-ws-rest-flows",
}));
vi.mock("@kace/utils", () => ({
    NAME_LOCATION_FILTER: {
        WS_REST_WORFLOW_STEPS: {
            schemaFields: "mock_schema_fields",
        },
    },
}));

vi.mock("../data/constants", () => ({
    INITIAL_VALUES_WS_REST_FLOWS: {
        id: null,
        name: "",
        description: "",
    },
}));
vi.mock("../../../services/genericHandleSendInformation", () => ({
    genericHandleSendInformation: vi.fn(),
}));


describe("useRestFlowCreate", () => {
    let mockNavigate;
    let mockQueryClient;
    let mockInvalidateQueries;
    let mockDeleteStepMutate;
    let mockUseGenericViewQueryReturn;
    let mockUseGenericSearchQueryReturn;

    beforeEach(() => {
        mockParamsReturn = {};

        mockNavigate = vi.fn();
        useNavigate.mockReturnValue(mockNavigate);

        mockInvalidateQueries = vi.fn();
        mockQueryClient = {
            invalidateQueries: mockInvalidateQueries,
        };
        useQueryClient.mockReturnValue(mockQueryClient);

        mockDeleteStepMutate = vi.fn();
        useGeneralDelete.mockReturnValue({
            mutate: mockDeleteStepMutate,
        });

        mockUseGenericViewQueryReturn = { data: null, isLoading: false };
        useGenericViewQuery.mockReturnValue(mockUseGenericViewQueryReturn);

        mockUseGenericSearchQueryReturn = { data: null, refetch: vi.fn() };
        useGenericSearchQuery.mockReturnValue(mockUseGenericSearchQueryReturn);

        mockMainFlowMutationState = {
            mutate: vi.fn(),
            isPending: false,
            isSuccess: false,
        };
        mockStepsMutationState = {
            mutateAsync: vi.fn(),
            isPending: false,
            isSuccess: false,
        };

        useGeneralMutation.mockClear();
        useGeneralMutation
            .mockImplementation((options) => {
                if (options.keyQuery === "wsRestFlowsData") {
                    return mockMainFlowMutationState;
                } else if (options.keyQuery === "wsFlowStepsSearch") {
                    return mockStepsMutationState;
                }
                return { mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false, isSuccess: false };
            });

        genericHandleSendInformation.mockClear();
        genericHandleSendInformation.mockImplementation(({ values, urlService, options = {} }) => {
            return {
                dataPost: {
                    ...values,
                    id: options.isCreate ? `new-id-${Math.random()}` : values.id,
                    ...(options.isCreate ? {} : { id: values.id }),
                },
                urlService,
                method: options.isCreate ? "post" : "put",
            };
        });
    });

    afterEach(() => {
        vi.clearAllMocks();
    });


    it("should return initial state values and functions", () => {
        const { result } = renderHook(() => useRestFlowCreate());

        expect(result.current.restFlows).toEqual(INITIAL_VALUES_WS_REST_FLOWS);
        expect(result.current.isPending).toBe(false);
        expect(result.current.isLoading).toBe(false);
        expect(typeof result.current.handleRestFlow).toBe("function");
    });

    it("should call useParams and useNavigate", () => {
        renderHook(() => useRestFlowCreate());
        expect(useParams).toHaveBeenCalledTimes(1);
        expect(useNavigate).toHaveBeenCalledTimes(1);
    });

    it("should call useQueryClient", () => {
        renderHook(() => useRestFlowCreate());
        expect(useQueryClient).toHaveBeenCalledTimes(1);
    });

    it("should call useGeneralDelete with correct keyQuery", () => {
        renderHook(() => useRestFlowCreate());
        expect(useGeneralDelete).toHaveBeenCalledWith({ keyQuery: "wsRestStepDelete" });
    });

    it("should call useGenericViewQuery with correct parameters when id is present", () => {
        mockParamsReturn = { id: "123" };
        renderHook(() => useRestFlowCreate());
        expect(useGenericViewQuery).toHaveBeenCalledWith(
            expect.objectContaining({
                keyQuery: "wsRestFlowsData",
                url: `${WS_REST_FLOWS_SERVICE}/123`,
                searchById: "123",
                enabled: true,
            }),
        );
    });

    it("should call useGenericViewQuery with enabled: false when id is not present", () => {
        mockParamsReturn = { id: "" };
        renderHook(() => useRestFlowCreate());
        expect(useGenericViewQuery).toHaveBeenCalledWith(
            expect.objectContaining({
                enabled: false,
            }),
        );
    });

    it("should call useGenericSearchQuery with correct parameters when id is present", () => {
        mockParamsReturn = { id: "123" };
        renderHook(() => useRestFlowCreate());
        expect(useGenericSearchQuery).toHaveBeenCalledWith(
            expect.objectContaining({
                url: `${WS_REST_STEPS_SERVICE}/search`,
                keyQuery: "wsFlowStepsSearch",
                enabled: true,
                table: NAME_LOCATION_FILTER.WS_REST_WORFLOW_STEPS.schemaFields,
                filter: [
                    {
                        field: `${NAME_LOCATION_FILTER.WS_REST_WORFLOW_STEPS.schemaFields}.flow_id`,
                        operator: "eq",
                        value: "123",
                        type: "AND",
                    },
                ],
            }),
        );
    });

    it("should call useGenericSearchQuery with enabled: false when id is not present", () => {
        mockParamsReturn = { id: "" };
        renderHook(() => useRestFlowCreate());
        expect(useGenericSearchQuery).toHaveBeenCalledWith(
            expect.objectContaining({
                enabled: false,
            }),
        );
    });

    it("should call useGeneralMutation twice with correct keyQueries", () => {
        renderHook(() => useRestFlowCreate());
        expect(useGeneralMutation).toHaveBeenCalledWith({ keyQuery: "wsRestFlowsData" });
        expect(useGeneralMutation).toHaveBeenCalledWith({ keyQuery: "wsFlowStepsSearch", invalidateQueries: false });
        expect(useGeneralMutation).toHaveBeenCalledTimes(2);
    });

    it("should update restFlows state when data is loaded and id is present", () => {
        const mockFlowData = { id: "123", name: "Fetched Flow", description: "Desc" };
        mockParamsReturn = { id: "123" };
        mockUseGenericViewQueryReturn.data = mockFlowData;

        const { result } = renderHook(() => useRestFlowCreate());

        expect(result.current.restFlows).toEqual(mockFlowData);
    });

    it("should refetch steps when id is present", async () => {
        mockParamsReturn = { id: "test-id" };
        mockUseGenericSearchQueryReturn.refetch.mockClear();

        renderHook(() => useRestFlowCreate());

        expect(mockUseGenericSearchQueryReturn.refetch).toHaveBeenCalledTimes(1);
    });

    it("should not refetch steps when id is not present", async () => {
        mockParamsReturn = { id: "" };
        mockUseGenericSearchQueryReturn.refetch.mockClear();

        renderHook(() => useRestFlowCreate());

        expect(mockUseGenericSearchQueryReturn.refetch).not.toHaveBeenCalled();
    });

    it("handleRestFlow should call genericHandleSendInformation and mutate", () => {
        const { result } = renderHook(() => useRestFlowCreate());
        const mockValues = { name: "New Flow" };
        const mockPath = [{ order: 1 }];

        act(() => {
            result.current.handleRestFlow(mockPath, mockValues);
        });

        expect(genericHandleSendInformation).toHaveBeenCalledTimes(1);
        expect(genericHandleSendInformation).toHaveBeenCalledWith(
            expect.objectContaining({
                values: mockValues,
                urlService: WS_REST_FLOWS_SERVICE,
                pending: false,
            }),
        );
        expect(mockMainFlowMutationState.mutate).toHaveBeenCalledTimes(1);
        expect(mockMainFlowMutationState.mutate).toHaveBeenCalledWith(
            expect.objectContaining({
                dataPost: expect.objectContaining(mockValues),
                urlService: WS_REST_FLOWS_SERVICE,
            }),
        );
    });

    it("handleRestFlow should set finalFlow and sequentialFlow state", async () => {
        const { result } = renderHook(() => useRestFlowCreate());
        const mockValues = { name: "New Flow Test" };
        const mockPath = [{ order: 1 }];

        const expectedFinalFlow = {
            dataPost: { ...mockValues, id: "new-id-123" },
            urlService: WS_REST_FLOWS_SERVICE,
            method: "post",
        };
        genericHandleSendInformation.mockReturnValue(expectedFinalFlow);

        act(() => {
            result.current.handleRestFlow(mockPath, mockValues);
        });
    });

    it("should call updateSteps when isSuccess is true and sequentialFlow is set", async () => {
        mockUseGenericSearchQueryReturn.data = { data: [] };

        const mockFlowData = { name: "Test Flow", id: "flow-abc" };
        const mockPath = [
            { id: "step-1", order: 1, flow_id: "flow-abc" },
            { id: "step-2", order: 2, flow_id: "flow-abc" },
        ];

        const { result, rerender } = renderHook(() => useRestFlowCreate());

        genericHandleSendInformation.mockClear();
        genericHandleSendInformation
            .mockImplementationOnce(({ values, urlService, options = {} }) => {
                return {
                    dataPost: { id: mockFlowData.id, name: mockFlowData.name },
                    urlService,
                    method: "post",
                };
            })
            .mockImplementation(({ values, urlService, options = {} }) => {
                return {
                    dataPost: { ...values, id: `new-id-${Math.random()}`, flow_id: mockFlowData.id },
                    urlService,
                    method: "post",
                };
            });

        act(() => {
            result.current.handleRestFlow(mockPath, mockFlowData);
        });

        mockMainFlowMutationState.isSuccess = true;
        rerender();

        await waitFor(() => {
            expect(mockStepsMutationState.mutateAsync).toHaveBeenCalledTimes(2);
            expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ["wsFlowStepsSearch"], exact: false });
            expect(mockNavigate).toHaveBeenCalledWith("/rest-flows", { replace: true });
        });

        expect(mockStepsMutationState.mutateAsync).toHaveBeenCalledWith(
            expect.objectContaining({
                dataPost: expect.objectContaining({
                    flow_id: mockFlowData.id,
                    id: expect.stringContaining("new-id-"),
                    order: 1,
                }),
                urlService: WS_REST_STEPS_SERVICE,
                method: "post",
            }),
        );
        expect(mockStepsMutationState.mutateAsync).toHaveBeenCalledWith(
            expect.objectContaining({
                dataPost: expect.objectContaining({
                    flow_id: mockFlowData.id,
                    id: expect.stringContaining("new-id-"),
                    order: 2,
                }),
                urlService: WS_REST_STEPS_SERVICE,
                method: "post",
            }),
        );
    });

    it("should handle step deletion correctly during updateSteps", async () => {
        mockParamsReturn = { id: "existing-flow-id" };

        mockUseGenericSearchQueryReturn.data = {
            data: [
                { id: "step-a", order: 1, flow_id: "existing-flow-id" },
                { id: "step-b", order: 2, flow_id: "existing-flow-id" },
                { id: "step-c", order: 3, flow_id: "existing-flow-id" },
            ],
        };
        mockUseGenericSearchQueryReturn.refetch.mockClear();

        const { result, rerender } = renderHook(() => useRestFlowCreate());

        const mockValues = { name: "Updated Flow", id: "existing-flow-id" };
        const mockPath = [
            { id: "step-a", order: 1, flow_id: "existing-flow-id" },
            { id: "step-b", order: 2, flow_id: "existing-flow-id" },
            { id: "step-d", order: 4, flow_id: "existing-flow-id" },
        ];

        genericHandleSendInformation.mockClear();
        genericHandleSendInformation
            .mockImplementationOnce(({ values, urlService, options = {} }) => {
                return {
                    dataPost: { id: mockValues.id, name: mockValues.name },
                    urlService,
                    method: "put",
                };
            })
            .mockImplementation(({ values, urlService, options = {} }) => {
                if (values.id === "step-d") {
                    return { dataPost: { ...values, id: `new-id-${Math.random()}`, flow_id: mockValues.id }, urlService, method: "post" };
                }
                return { dataPost: { ...values, flow_id: mockValues.id }, urlService, method: "put" };
            });

        act(() => {
            result.current.handleRestFlow(mockPath, mockValues);
        });

        mockMainFlowMutationState.isSuccess = true;
        rerender();

        await waitFor(() => {
            expect(mockDeleteStepMutate).toHaveBeenCalledTimes(1);
            expect(mockDeleteStepMutate).toHaveBeenCalledWith({
                id: "step-c",
                url: WS_REST_STEPS_SERVICE,
            });

            expect(mockStepsMutationState.mutateAsync).toHaveBeenCalledTimes(1);
            expect(mockStepsMutationState.mutateAsync).toHaveBeenCalledWith(
                expect.objectContaining({
                    dataPost: expect.objectContaining({
                        flow_id: mockValues.id,
                        order: 4,
                        id: expect.stringContaining("new-id-"),
                    }),
                    urlService: WS_REST_STEPS_SERVICE,
                    method: "post",
                }),
            );

            expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ["wsFlowStepsSearch"], exact: false });
            expect(mockNavigate).toHaveBeenCalledWith("/rest-flows", { replace: true });
        });
    });

    it("should update existing steps only if order changes or it's a new step", async () => {
        mockParamsReturn = { id: "existing-flow-id" };

        const existingSteps = [
            { id: "step-a", order: 1, flow_id: "existing-flow-id" },
            { id: "step-b", order: 2, flow_id: "existing-flow-id" },
        ];
        mockUseGenericSearchQueryReturn.data = { data: existingSteps };

        const { result, rerender } = renderHook(() => useRestFlowCreate());

        const mockValues = { name: "Updated Flow", id: "existing-flow-id" };
        const mockPath = [
            { id: "step-a", order: 1, flow_id: "existing-flow-id" },
            { id: "step-b", order: 3, flow_id: "existing-flow-id" },
            { id: "step-c", order: 4, flow_id: "existing-flow-id" },
        ];

        act(() => {
            genericHandleSendInformation.mockImplementation(({ values, urlService, options = {} }) => {
                if (values.id === "step-b") return { dataPost: { ...values, flow_id: mockValues.id }, urlService, method: "put" };
                if (values.id === "step-c") return { dataPost: { ...values, id: `new-id-${Math.random()}`, flow_id: mockValues.id }, urlService, method: "post" };
                return { dataPost: { id: mockValues.id, name: mockValues.name }, urlService, method: "put" };
            });

            result.current.handleRestFlow(mockPath, mockValues);
        });

        mockMainFlowMutationState.isSuccess = true;
        rerender();

        await waitFor(() => {
            expect(mockStepsMutationState.mutateAsync).toHaveBeenCalledTimes(2);

            expect(mockStepsMutationState.mutateAsync).toHaveBeenCalledWith(
                expect.objectContaining({
                    dataPost: expect.objectContaining({
                        id: "step-b",
                        flow_id: mockValues.id,
                        order: 3,
                    }),
                    urlService: WS_REST_STEPS_SERVICE,
                    method: "put",
                }),
            );

            expect(mockStepsMutationState.mutateAsync).toHaveBeenCalledWith(
                expect.objectContaining({
                    dataPost: expect.objectContaining({
                        flow_id: mockValues.id,
                        id: expect.stringContaining("new-id-"),
                        order: 4,
                    }),
                    urlService: WS_REST_STEPS_SERVICE,
                    method: "post",
                }),
            );
        });
    });

    it("should not call mutateSteps if sequentialFlow is empty", async () => {
        mockParamsReturn = { id: "existing-flow-id" };
        mockUseGenericSearchQueryReturn.data = { data: [] };

        const { result, rerender } = renderHook(() => useRestFlowCreate());

        const mockValues = { name: "Updated Flow", id: "existing-flow-id" };
        const mockPath = [];

        act(() => {
            genericHandleSendInformation.mockReturnValue({
                dataPost: { id: mockValues.id, name: mockValues.name },
                urlService: WS_REST_FLOWS_SERVICE,
                method: "put",
            });
            result.current.handleRestFlow(mockPath, mockValues);
        });

        mockMainFlowMutationState.isSuccess = true;
        rerender();

        await waitFor(() => {
            expect(mockStepsMutationState.mutateAsync).not.toHaveBeenCalled();
            expect(mockDeleteStepMutate).not.toHaveBeenCalled();
            expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ["wsFlowStepsSearch"], exact: false });
            expect(mockNavigate).toHaveBeenCalledWith("/rest-flows", { replace: true });
        });
    });

    it("should return isLoading from useGenericViewQuery", () => {
        mockUseGenericViewQueryReturn.isLoading = true;
        const { result } = renderHook(() => useRestFlowCreate());
        expect(result.current.isLoading).toBe(true);
    });

    it("should return isPending from useGeneralMutation (main flow)", () => {
        mockMainFlowMutationState.isPending = true;

        const { result } = renderHook(() => useRestFlowCreate());
        expect(result.current.isPending).toBe(true);
    });
});
