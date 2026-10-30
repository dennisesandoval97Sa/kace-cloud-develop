import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import useGenericGetQuery from "@/hooks/useGenericGetQuery";
import useUserInformation from "@/hooks/useUserInformation";
import { SYSTEM_INBOX_WORKSPACE_ID } from "@/utils/systemInboxWorkspace";
import {
    agentMoveWorkspaceDestinationsKey,
    useAgentMoveWorkspaceDestinations,
} from "./useAgentMoveWorkspaceDestinations";

vi.mock("@/hooks/useGenericGetQuery", () => ({
    default: vi.fn(() => ({ data: [], isFetched: true })),
}));
vi.mock("@/hooks/useUserInformation", () => ({
    default: vi.fn(),
}));

describe("useAgentMoveWorkspaceDestinations", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        useUserInformation.mockReturnValue({ user: { id: "user-1" } });
        useGenericGetQuery.mockReturnValue({
            data: [
                { id: SYSTEM_INBOX_WORKSPACE_ID, description: "System Inbox" },
                { id: "other-group-workspace", description: "Other group" },
            ],
            isFetched: true,
        });
    });

    it("uses the move-only endpoint and a source-bound cache key", () => {
        const { result } = renderHook(() =>
            useAgentMoveWorkspaceDestinations({ interactionId: "interaction-1", activeGroupId: "group-1" }),
        );

        expect(agentMoveWorkspaceDestinationsKey("user-1", "group-1", "interaction-1")).toEqual([
            "agent-move-workspace-destinations",
            "user-1",
            "group-1",
            "interaction-1",
        ]);
        expect(useGenericGetQuery).toHaveBeenCalledWith(
            expect.objectContaining({
                url: "/interactions-bulk/agent/interaction-1/move-destinations",
                keyQuery: ["agent-move-workspace-destinations", "user-1", "group-1", "interaction-1"],
                enabled: true,
            }),
        );
        expect(result.current.workspaces).toEqual([{ id: "other-group-workspace", description: "Other group" }]);
    });

    it("does not discover destinations without a complete source scope", () => {
        renderHook(() => useAgentMoveWorkspaceDestinations({ interactionId: null, activeGroupId: "group-1" }));

        expect(useGenericGetQuery.mock.calls.at(-1)[0]).toEqual(expect.objectContaining({ enabled: false }));
    });
});
