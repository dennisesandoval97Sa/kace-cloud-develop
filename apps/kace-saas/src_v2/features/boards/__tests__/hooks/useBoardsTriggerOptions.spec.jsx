import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@kace/hooks/useGeneralMutation", () => ({
    default: () => ({
        mutate: vi.fn().mockResolvedValue(undefined),
        isPending: false,
    }),
}));

const navigateMock = vi.fn();

vi.mock("react-router-dom", () => ({
    useNavigate: () => navigateMock,
}));

import useBoardsTriggerOptions from "@kace_v2/features/boards/hooks/useBoardsTriggerOptions.hook";

const createWrapper = () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return ({ children }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
};

describe("useBoardsTriggerOptions", () => {
    const originalUrl = window.location.href;

    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        window.history.replaceState({}, "", originalUrl);
    });

    it("setSelectedEntity updates selectedEntity in state", () => {
        const { result } = renderHook(() => useBoardsTriggerOptions(), { wrapper: createWrapper() });

        expect(result.current.selectedEntity).toBeNull();

        act(() => {
            result.current.setSelectedEntity("new-entity-id");
        });

        expect(result.current.selectedEntity).toBe("new-entity-id");
    });

    it("VIEWCASE navigates to the agent case route remembering the board view as origin", async () => {
        window.history.replaceState({}, "", "/agent/client-uuid-9?foo=bar");
        const { result } = renderHook(() => useBoardsTriggerOptions(), { wrapper: createWrapper() });

        await act(async () => {
            await result.current.triggerOption("VIEWCASE", null, "case-uuid-1", "board-1");
        });

        expect(navigateMock).toHaveBeenCalledWith(
            "/agent/update/case-uuid-1?action=edit&role=agente&board_id=board-1",
            { state: { boardReturnTo: "/agent/client-uuid-9?foo=bar" } },
        );
    });

    it("VIEWCASE from the admin board navigates without remembering the origin", async () => {
        window.history.replaceState({}, "", "/boards/board-1");
        const { result } = renderHook(() => useBoardsTriggerOptions(), { wrapper: createWrapper() });

        await act(async () => {
            await result.current.triggerOption("VIEWCASE", null, "case-uuid-1", "board-1");
        });

        expect(navigateMock).toHaveBeenCalledWith(
            "/cases/update/case-uuid-1?role=administrador&board_id=board-1",
            undefined,
        );
    });
});
