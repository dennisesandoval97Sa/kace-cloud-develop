import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import useSelectedInteractions, { getSelectedInteractionsKey } from "./useSelectedInteractions";

const createWrapper = () => {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: { retry: false },
        },
    });

    return {
        queryClient,
        wrapper: ({ children }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>,
    };
};

describe("useSelectedInteractions", () => {
    it("scopes selected interactions by workspace", async () => {
        const { wrapper } = createWrapper();
        const { result, rerender } = renderHook(({ scope }) => useSelectedInteractions(scope), {
            wrapper,
            initialProps: { scope: "workspace-1" },
        });

        act(() => {
            result.current.setSelectedInteractions([{ id: "interaction-1" }]);
        });

        await waitFor(() => {
            expect(result.current.selectedInteractions).toEqual([{ id: "interaction-1" }]);
        });

        rerender({ scope: "workspace-2" });

        await waitFor(() => {
            expect(result.current.selectedInteractions).toEqual([]);
        });

        act(() => {
            result.current.setSelectedInteractions([{ id: "interaction-2" }]);
        });

        await waitFor(() => {
            expect(result.current.selectedInteractions).toEqual([{ id: "interaction-2" }]);
        });

        rerender({ scope: "workspace-1" });

        await waitFor(() => {
            expect(result.current.selectedInteractions).toEqual([{ id: "interaction-1" }]);
        });
    });

    it("clears cached selections when the interactions table unmounts", async () => {
        const { queryClient, wrapper } = createWrapper();
        const { result, unmount } = renderHook(() => useSelectedInteractions("workspace-1"), { wrapper });

        act(() => {
            result.current.setSelectedInteractions([{ id: "interaction-1" }]);
            queryClient.setQueryData(getSelectedInteractionsKey("workspace-2"), [{ id: "interaction-2" }]);
        });

        await waitFor(() => {
            expect(result.current.selectedInteractions).toEqual([{ id: "interaction-1" }]);
        });

        unmount();

        expect(queryClient.getQueryData(getSelectedInteractionsKey("workspace-1"))).toEqual([]);
        expect(queryClient.getQueryData(getSelectedInteractionsKey("workspace-2"))).toEqual([]);

        const { result: remountedResult } = renderHook(() => useSelectedInteractions("workspace-1"), { wrapper });

        await waitFor(() => {
            expect(remountedResult.current.selectedInteractions).toEqual([]);
        });
    });

    it("normalizes empty scope keys to all", () => {
        expect(getSelectedInteractionsKey(null)).toEqual(["selectedInteractions", "all"]);
        expect(getSelectedInteractionsKey(undefined)).toEqual(["selectedInteractions", "all"]);
        expect(getSelectedInteractionsKey("workspace-1")).toEqual(["selectedInteractions", "workspace-1"]);
    });
});
