import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useWorkSpaceMove } from "./useWorkSpaceMove";
import useGeneralMutation from "@/hooks/useGeneralMutation";
import { SYSTEM_INBOX_WORKSPACE_ID } from "@/utils/systemInboxWorkspace";

vi.mock("@/hooks/useGeneralMutation", () => ({
    default: vi.fn(),
}));

describe("useWorkSpaceMove", () => {
    const mutate = vi.fn();
    beforeEach(() => {
        vi.clearAllMocks();
        useGeneralMutation.mockReturnValue({
            mutate,
            isPending: false,
        });
    });

    it("does not pass a navigation path so moving keeps the agent on /agent", () => {
        /*
         * `path` is useGeneralMutation's success-navigation target; passing
         * "/interactions" redirected the agent to the Admin module after a move.
         */
        renderHook(() => useWorkSpaceMove("interaction-1", "group-1"));

        expect(useGeneralMutation).toHaveBeenCalledWith({
            keyQuery: ["agent-interactions", "group-1"],
            invalidateQueries: false,
            optimisticListUpdate: false,
        });
        expect(useGeneralMutation.mock.calls[0][0]).not.toHaveProperty("path");
    });

    it("uses the agent bulk move endpoint with one interaction id and forwards options", () => {
        const { result } = renderHook(() => useWorkSpaceMove("interaction-1", "group-1"));
        const options = { onSuccess: vi.fn() };

        result.current.moveInteractionToWorkspace({ workspaceId: "ws-2" }, options);

        expect(mutate).toHaveBeenCalledWith(
            {
                id: "interaction-1",
                url: "/interactions-bulk/agent/move",
                dataPost: { interaction_ids: ["interaction-1"], workspace_id: "ws-2" },
            },
            { onSuccess: expect.any(Function) },
        );
    });

    it("returns the mutation promise and leaves post-success state to the caller", async () => {
        const { result } = renderHook(() => useWorkSpaceMove("interaction-1", "group-1"));
        const onSuccess = vi.fn();
        const response = { data: { data: { updated: 1 } } };
        mutate.mockResolvedValueOnce(response);

        const promise = result.current.moveInteractionToWorkspace({ workspaceId: "ws-2" }, { onSuccess });

        expect(promise).toBeInstanceOf(Promise);
        await expect(promise).resolves.toBe(response);
        expect(mutate).toHaveBeenCalledWith(expect.any(Object), { onSuccess });
    });

    it("does not mutate without an interaction id", () => {
        const { result } = renderHook(() => useWorkSpaceMove(null, "group-1"));

        result.current.moveInteractionToWorkspace({ workspaceId: "ws-2" });

        expect(mutate).not.toHaveBeenCalled();
    });

    it("does not mutate to the canonical Inbox workspace", () => {
        const { result } = renderHook(() => useWorkSpaceMove("interaction-1", "group-1"));

        result.current.moveInteractionToWorkspace({ workspaceId: SYSTEM_INBOX_WORKSPACE_ID });

        expect(mutate).not.toHaveBeenCalled();
    });

    it("allows an unrelated workspace named Inbox", () => {
        const { result } = renderHook(() => useWorkSpaceMove("interaction-1", "group-1"));

        result.current.moveInteractionToWorkspace({ workspaceId: "named-inbox" });

        expect(mutate).toHaveBeenCalled();
    });
});
