import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import useUserInformation from "@/hooks/useUserInformation";
import { claimInteractionReview, releaseInteractionReview } from "../services/interactionReviewService";
import { useInteractionReviewActions } from "./useInteractionReviewActions";

vi.mock("../services/interactionReviewService", () => ({
    claimInteractionReview: vi.fn(),
    releaseInteractionReview: vi.fn(),
}));

vi.mock("sonner", () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn(),
    },
}));

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key, options) => {
            const translations = {
                "interactions.detail.modal.manage": "Gestionar",
                "interactions.detail.modal.release": "Liberar",
                "interactions.detail.underReview": "En revision",
                "interactions.review.claimSuccess": "Interacción en revisión",
                "interactions.review.releaseSuccess": "Interacción liberada",
                "interactions.review.conflict": "La interacción ya está en revisión por otro agente.",
                "interactions.review.forbidden": "No tienes permiso para liberar esta interacción.",
                "interactions.review.manageForbidden": "No tienes permiso para gestionar esta interacción.",
                "interactions.review.tooltipOther": "En revision por otro agente",
                "interactions.review.tooltipNoPermission": "No tienes permiso para gestionar esta interacción",
                "interactions.review.tooltipReviewer": `En revision por ${options?.reviewer}`,
            };

            return translations[key] ?? key;
        },
    }),
}));

vi.mock("@/hooks/useUserInformation", () => ({
    default: vi.fn(),
}));

const defaultUserInformation = {
    user: { id: "agent-1" },
    permissionsAdmin: [],
    permissionsAgent: [{ module_id: "interactions", name: "InteractionsCreate", granted: true }],
};

const createInteraction = (overrides = {}) => ({
    id: "interaction-1",
    in_review: false,
    start_review_by: null,
    ...overrides,
});

const renderUseInteractionReviewActions = ({ interaction = createInteraction(), onSuccess = vi.fn() } = {}) => {
    const queryClient = new QueryClient({
        defaultOptions: {
            mutations: { retry: false },
            queries: { retry: false },
        },
    });

    const wrapper = ({ children }) => createElement(QueryClientProvider, { client: queryClient }, children);

    return {
        queryClient,
        onSuccess,
        ...renderHook(() => useInteractionReviewActions({ interaction, onSuccess }), { wrapper }),
    };
};

describe("useInteractionReviewActions", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        useUserInformation.mockReturnValue(defaultUserInformation);
        claimInteractionReview.mockResolvedValue({ status: 200 });
        releaseInteractionReview.mockResolvedValue({ status: 200 });
    });

    it("returns a disabled Gestionar button for a read-only user and does not claim", () => {
        useUserInformation.mockReturnValue({
            user: { id: "agent-1" },
            permissionsAdmin: [],
            permissionsAgent: [],
        });

        const { result } = renderUseInteractionReviewActions();

        expect(result.current.button).toMatchObject({
            label: "Gestionar",
            disabled: true,
            title: "No tienes permiso para gestionar esta interacción",
        });
        expect(result.current.button.onClick).toBeUndefined();
        expect(claimInteractionReview).not.toHaveBeenCalled();
    });

    it("returns an enabled Gestionar button for an agent with InteractionsCreate and claims it", async () => {
        const claimResponse = {
            status: 200,
            data: {
                data: createInteraction({
                    in_review: true,
                    start_review_by: "agent-1",
                }),
            },
        };
        claimInteractionReview.mockResolvedValueOnce(claimResponse);
        const { result, onSuccess } = renderUseInteractionReviewActions();

        expect(result.current.button).toMatchObject({
            label: "Gestionar",
            disabled: false,
        });

        act(() => {
            result.current.button.onClick();
        });

        await waitFor(() => {
            expect(claimInteractionReview).toHaveBeenCalledWith("interaction-1");
        });
        await waitFor(() => {
            expect(onSuccess).toHaveBeenCalledWith(claimResponse.data.data, claimResponse);
        });
        expect(toast.success).toHaveBeenCalledWith("Interacción en revisión");
    });

    it("uses the Agent review route contract and active-group cache key when explicitly scoped", async () => {
        const queryClient = new QueryClient({
            defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
        });
        const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries").mockResolvedValue();

        const scopedResult = renderHook(
            () =>
                useInteractionReviewActions({
                    interaction: createInteraction(),
                    agentScoped: true,
                    activeGroupId: "group-1",
                }),
            {
                wrapper: ({ children }) => createElement(QueryClientProvider, { client: queryClient }, children),
            },
        );

        act(() => {
            scopedResult.result.current.button.onClick();
        });

        await waitFor(() => {
            expect(claimInteractionReview).toHaveBeenCalledWith("interaction-1", { agentScoped: true });
        });
        await waitFor(() => {
            expect(invalidateQueries).toHaveBeenCalledWith({
                queryKey: [["agent-interactions", "group-1"]],
                exact: false,
            });
        });
    });

    it("notifies the open detail before background interaction refresh failures", async () => {
        const claimResponse = {
            status: 200,
            data: {
                data: createInteraction({
                    in_review: true,
                    start_review_by: "agent-1",
                }),
            },
        };
        claimInteractionReview.mockResolvedValueOnce(claimResponse);
        const { result, onSuccess, queryClient } = renderUseInteractionReviewActions();
        vi.spyOn(queryClient, "invalidateQueries").mockRejectedValueOnce(new Error("refresh failed"));

        act(() => {
            result.current.button.onClick();
        });

        await waitFor(() => {
            expect(onSuccess).toHaveBeenCalledWith(claimResponse.data.data, claimResponse);
        });
        expect(toast.success).toHaveBeenCalledWith("Interacción en revisión");
    });

    it("returns an enabled Liberar button for the current reviewer and releases it", async () => {
        const { result } = renderUseInteractionReviewActions({
            interaction: createInteraction({
                in_review: true,
                start_review_by: "agent-1",
            }),
        });

        expect(result.current.button).toMatchObject({
            label: "Liberar",
            disabled: false,
        });

        act(() => {
            result.current.button.onClick();
        });

        await waitFor(() => {
            expect(releaseInteractionReview).toHaveBeenCalledWith("interaction-1");
        });
    });

    it("returns an enabled Liberar button for the current reviewer without manage permission", async () => {
        useUserInformation.mockReturnValue({
            user: { id: "agent-1" },
            permissionsAdmin: [],
            permissionsAgent: [],
        });
        const { result } = renderUseInteractionReviewActions({
            interaction: createInteraction({
                in_review: true,
                start_review_by: "agent-1",
            }),
        });

        expect(result.current.button).toMatchObject({
            label: "Liberar",
            disabled: false,
        });

        act(() => {
            result.current.button.onClick();
        });

        await waitFor(() => {
            expect(releaseInteractionReview).toHaveBeenCalledWith("interaction-1");
        });
    });

    it("returns an enabled Liberar button for another reviewer when the user can update interactions", async () => {
        useUserInformation.mockReturnValue({
            user: { id: "agent-1" },
            permissionsAdmin: [{ module_id: "interactions", name: "InteractionsUpdate", granted: true }],
        });
        const { result } = renderUseInteractionReviewActions({
            interaction: createInteraction({
                in_review: true,
                start_review_by: "agent-2",
            }),
        });

        expect(result.current.button).toMatchObject({
            label: "Liberar",
            disabled: false,
        });

        act(() => {
            result.current.button.onClick();
        });

        await waitFor(() => {
            expect(releaseInteractionReview).toHaveBeenCalledWith("interaction-1");
        });
    });

    it("returns a disabled En revision button with tooltip for another reviewer without release permission", () => {
        const { result } = renderUseInteractionReviewActions({
            interaction: createInteraction({
                in_review: true,
                start_review_by: "agent-2",
            }),
        });

        expect(result.current.button).toMatchObject({
            label: "En revision",
            disabled: true,
            title: "En revision por otro agente",
        });
        expect(result.current.button.onClick).toBeUndefined();
    });

    it("shows conflict and forbidden toasts for review action errors", async () => {
        claimInteractionReview.mockRejectedValueOnce({
            response: { status: 409 },
        });
        releaseInteractionReview.mockRejectedValueOnce({
            response: { status: 403 },
        });

        const { result: claimResult } = renderUseInteractionReviewActions();

        act(() => {
            claimResult.current.button.onClick();
        });

        await waitFor(() => {
            expect(toast.error).toHaveBeenCalledWith("La interacción ya está en revisión por otro agente.");
        });

        const { result: releaseResult } = renderUseInteractionReviewActions({
            interaction: createInteraction({
                in_review: true,
                start_review_by: "agent-1",
            }),
        });

        act(() => {
            releaseResult.current.button.onClick();
        });

        await waitFor(() => {
            expect(toast.error).toHaveBeenCalledWith("No tienes permiso para liberar esta interacción.");
        });
    });

    it("uses the manage forbidden toast when claim receives a 403", async () => {
        claimInteractionReview.mockRejectedValueOnce({
            response: { status: 403 },
        });

        const { result } = renderUseInteractionReviewActions();

        act(() => {
            result.current.button.onClick();
        });

        await waitFor(() => {
            expect(toast.error).toHaveBeenCalledWith("No tienes permiso para gestionar esta interacción.");
        });
    });
});
