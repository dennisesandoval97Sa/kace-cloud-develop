import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAssociateInteractionCases } from "./useAssociateInteractionCases";
import useGeneralMutation from "@/hooks/useGeneralMutation";
import { genericHandleSendInformation } from "@/services/genericHandleSendInformation";
import useUserInformation from "@/hooks/useUserInformation";

vi.mock("@/hooks/useGeneralMutation", () => ({
    default: vi.fn(),
}));

vi.mock("@/services/genericHandleSendInformation", () => ({
    genericHandleSendInformation: vi.fn(),
}));
vi.mock("@/hooks/useUserInformation", () => ({
    default: vi.fn(() => ({ active_group_id: "group-1" })),
}));

describe("useAssociateInteractionCases", () => {
    const mutate = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        useGeneralMutation.mockReturnValue({
            mutate,
            isPending: false,
        });
        genericHandleSendInformation.mockReturnValue({
            urlService: "/interactions/agent/interaction-cases",
            dataPost: {
                interaction_id: "interaction-1",
                caso_id: "case-1",
            },
        });
    });

    it("uses the active-group-keyed agent route when associating a case", () => {
        const { result } = renderHook(() => useAssociateInteractionCases("interaction-1"));
        const options = { onSuccess: vi.fn() };

        result.current.associateInteractionCases({ caso_id: "case-1" }, options);

        expect(useGeneralMutation).toHaveBeenCalledWith({
            keyQuery: ["associateInteractionCases", "group-1"],
            path: "/interactions/agent/interaction-cases",
        });
        expect(genericHandleSendInformation).toHaveBeenCalledWith({
            values: {
                caso_id: "case-1",
                interaction_id: "interaction-1",
            },
            urlService: "/interactions/agent/interaction-cases",
            pending: false,
            options: { generateId: false },
        });
        expect(mutate).toHaveBeenCalledWith(
            {
                urlService: "/interactions/agent/interaction-cases",
                dataPost: {
                    interaction_id: "interaction-1",
                    caso_id: "case-1",
                },
            },
            options,
        );
    });

    it("passes mutation configuration through to the generic mutation hook", () => {
        renderHook(() => useAssociateInteractionCases("interaction-1", { onSuccessToast: false }));

        expect(useGeneralMutation).toHaveBeenCalledWith({
            keyQuery: ["associateInteractionCases", "group-1"],
            path: "/interactions/agent/interaction-cases",
            onSuccessToast: false,
        });
    });

    it("allows callers to disable the default success navigation path", () => {
        renderHook(() => useAssociateInteractionCases("interaction-1", { onSuccessToast: false, path: null }));

        expect(useGeneralMutation).toHaveBeenCalledWith({
            keyQuery: ["associateInteractionCases", "group-1"],
            path: null,
            onSuccessToast: false,
        });
    });

    it("does not mutate without an interaction id", () => {
        const { result } = renderHook(() => useAssociateInteractionCases(null));

        result.current.associateInteractionCases({ caso_id: "case-1" });

        expect(genericHandleSendInformation).not.toHaveBeenCalled();
        expect(mutate).not.toHaveBeenCalled();
    });

    it("does not mutate without an active group", () => {
        useUserInformation.mockReturnValueOnce({ active_group_id: null });
        const { result } = renderHook(() => useAssociateInteractionCases("interaction-1"));

        result.current.associateInteractionCases({ caso_id: "case-1" });

        expect(mutate).not.toHaveBeenCalled();
    });
});
