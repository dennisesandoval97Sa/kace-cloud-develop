import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import useGeneralMutation from "@/hooks/useGeneralMutation";
import { useInteractionActions } from "./useInteractionActions";

vi.mock("@/hooks/useGeneralMutation", () => ({
    default: vi.fn(),
}));

describe("useInteractionActions", () => {
    const mutate = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        mutate.mockResolvedValue({});
        useGeneralMutation.mockReturnValue({ mutate, isPending: false });
    });

    it("closes one interaction through the active-group-keyed Agent route", () => {
        const { result } = renderHook(() => useInteractionActions("interaction-1", "group-1"));

        result.current.closeInteraction({ motive: "resolved" });

        expect(useGeneralMutation).toHaveBeenCalledWith({
            keyQuery: ["agent-interactions", "group-1"],
            invalidateQueries: false,
            optimisticListUpdate: false,
        });
        expect(mutate).toHaveBeenCalledWith({
            id: "interaction-1",
            url: "/interactions-bulk/agent/close",
            dataPost: { interaction_ids: ["interaction-1"], motive: "resolved" },
        });
    });

    it("does not close without an active group", () => {
        const { result } = renderHook(() => useInteractionActions("interaction-1", null));

        result.current.closeInteraction({ motive: "resolved" });

        expect(mutate).not.toHaveBeenCalled();
    });
});
