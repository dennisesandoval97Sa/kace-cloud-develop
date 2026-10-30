import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { PUBLIC_ERROR_CODES } from "@kace/error-codes";
import useRelationshipAction from "./useRelationshipAction";

const mocks = vi.hoisted(() => ({
    cancelQueries: vi.fn(),
    getQueryData: vi.fn(),
    setQueryData: vi.fn(),
    mutate: vi.fn(),
    toastError: vi.fn(),
    mutationOptions: undefined,
}));

vi.mock("@tanstack/react-query", () => ({
    useQueryClient: () => ({
        cancelQueries: mocks.cancelQueries,
        getQueryData: mocks.getQueryData,
        setQueryData: mocks.setQueryData,
    }),
    useMutation: (options) => {
        mocks.mutationOptions = options;

        return {
            mutate: mocks.mutate,
            isPending: false,
        };
    },
}));

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key) => key,
    }),
}));

vi.mock("sonner", () => ({
    toast: {
        error: mocks.toastError,
    },
}));

vi.mock("../../../services/generic-send-information", () => ({
    sendInformation: vi.fn(),
}));

describe("useRelationshipAction", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.mutationOptions = undefined;
        mocks.cancelQueries.mockResolvedValue();
    });

    it("snapshots and restores classification assignment data when delete fails", async () => {
        const previousClassifications = { data: [{ group_id: "group-1" }] };
        mocks.getQueryData.mockReturnValue(previousClassifications);
        renderHook(() => useRelationshipAction("classification-1"));

        const context = await mocks.mutationOptions.onMutate();
        mocks.mutationOptions.onError(
            {
                response: {
                    data: {
                        data: { code: PUBLIC_ERROR_CODES.CLASSIFICATION_GROUP_RELATION_NOT_FOUND },
                        errors: [{ message: "backend detail" }],
                    },
                },
            },
            null,
            context,
        );

        expect(mocks.cancelQueries).toHaveBeenCalledWith(["classificationAssignData"]);
        expect(context).toEqual({ previousClassifications });
        expect(mocks.setQueryData).toHaveBeenCalledWith(["classificationAssignData"], previousClassifications);
        expect(mocks.toastError).toHaveBeenCalledWith("app.alerts.relationclassificationGroup");
    });

    it("does not throw when React Query has no rollback context", () => {
        renderHook(() => useRelationshipAction("classification-1"));

        expect(() => {
            mocks.mutationOptions.onError(
                {
                    response: {
                        data: {
                            errors: [{ message: "Delete failed" }],
                        },
                    },
                },
                null,
                undefined,
            );
        }).not.toThrow();
        expect(mocks.setQueryData).not.toHaveBeenCalled();
        expect(mocks.toastError).toHaveBeenCalledWith("app.errors.generic");
    });

    it("does not throw when the delete request fails before receiving a response", () => {
        renderHook(() => useRelationshipAction("classification-1"));

        expect(() => {
            mocks.mutationOptions.onError(new Error("Network Error"), null, undefined);
        }).not.toThrow();
        expect(mocks.toastError).toHaveBeenCalledWith("Network Error");
    });

    it("sends the classification-group relationship delete payload", () => {
        const { result } = renderHook(() => useRelationshipAction("classification-1"));

        act(() => {
            result.current.handleDeleteGroup("group-1");
        });

        expect(mocks.mutate).toHaveBeenCalledWith({
            id: null,
            url: "classifications-groups-relationships-batch-delete",
            dataPost: [
                {
                    group_id: "group-1",
                    classification_id: "classification-1",
                },
            ],
        });
    });
});
