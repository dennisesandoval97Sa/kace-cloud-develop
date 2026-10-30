import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiService } from "@kace/utils";
import { useLinkedInteractionCases } from "./useLinkedInteractionCases";

vi.mock("@kace/utils", () => ({
    apiService: { get: vi.fn() },
}));

const wrapper = ({ children }) => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
};

describe("useLinkedInteractionCases", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("loads linked case ids and summaries from the interactions association endpoint", async () => {
        apiService.get.mockResolvedValue({
            data: {
                data: {
                    case_ids: ["case-1"],
                    items: [{ id: "case-1", reference: 123 }],
                },
            },
        });

        const { result } = renderHook(() => useLinkedInteractionCases("interaction-1", { activeGroupId: "group-1" }), {
            wrapper,
        });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(apiService.get).toHaveBeenCalledWith("/interactions/agent/interaction-cases/interaction-1");
        expect(result.current.caseIds).toEqual(["case-1"]);
        expect(result.current.items).toEqual([{ id: "case-1", reference: 123 }]);
    });

    it("does not request linked cases without an interaction id", () => {
        const { result } = renderHook(() => useLinkedInteractionCases(null, { activeGroupId: "group-1" }), {
            wrapper,
        });

        expect(result.current.caseIds).toEqual([]);
        expect(result.current.items).toEqual([]);
        expect(apiService.get).not.toHaveBeenCalled();
    });

    it("does not request linked cases without an active group", () => {
        renderHook(() => useLinkedInteractionCases("interaction-1", { activeGroupId: null }), { wrapper });

        expect(apiService.get).not.toHaveBeenCalled();
    });
});
