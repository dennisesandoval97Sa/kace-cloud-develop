import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import useGenericGetQuery from "@/hooks/useGenericGetQuery";
import useUserInformation from "@/hooks/useUserInformation";
import { SYSTEM_INBOX_WORKSPACE_ID } from "@/utils/systemInboxWorkspace";
import { useAvailableAgentWorkspaces } from "./useAvailableAgentWorkspaces";

vi.mock("@/hooks/useGenericGetQuery", () => ({
    default: vi.fn(() => ({ data: [], isFetched: true })),
}));
vi.mock("@/hooks/useUserInformation", () => ({
    default: vi.fn(),
}));

describe("useAvailableAgentWorkspaces", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        useUserInformation.mockReturnValue({ user: { id: "user-1" }, active_group_id: "group-1" });
        useGenericGetQuery.mockReturnValue({
            data: [
                { id: SYSTEM_INBOX_WORKSPACE_ID, description: "INBOX" },
                { id: "workspace-1", description: "Support" },
            ],
            isFetched: true,
        });
    });

    it("uses only /workspaces/available and keys it by active group", () => {
        const { result } = renderHook(() => useAvailableAgentWorkspaces());

        expect(useGenericGetQuery).toHaveBeenCalledWith(
            expect.objectContaining({
                url: "/workspaces/available",
                keyQuery: ["agent-workspaces-available", "group-1"],
                enabled: true,
            }),
        );
        expect(result.current.workspaces).toEqual([{ id: "workspace-1", description: "Support" }]);
    });

    it("disables availability without both identity and an active group", () => {
        useUserInformation.mockReturnValue({ user: { id: "user-1" }, active_group_id: null });

        renderHook(() => useAvailableAgentWorkspaces());

        expect(useGenericGetQuery.mock.calls.at(-1)[0]).toEqual(expect.objectContaining({ enabled: false }));
    });
});
