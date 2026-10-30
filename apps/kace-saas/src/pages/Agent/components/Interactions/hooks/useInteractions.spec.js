import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import useGenericSearchQuery from "@/hooks/useGenericSearchQuery";
import { useInteractions } from "./useInteractions";

vi.mock("@/hooks/useGenericSearchQuery", () => ({
    default: vi.fn(() => ({ data: undefined, isLoading: false })),
}));

const baseProps = {
    selectedWorkspace: null,
    allWorkspaces: true,
    selectedType: "open",
    myReviewsOnly: false,
    currentUserId: "user-1",
    activeGroupId: "group-1",
    scopeReady: true,
    searchTerm: "",
};

describe("useInteractions agent scope", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("uses the Agent search route and keys the cache by active group", () => {
        const { rerender } = renderHook((props) => useInteractions(props), { initialProps: baseProps });

        expect(useGenericSearchQuery.mock.calls.at(-1)[0]).toEqual(
            expect.objectContaining({
                url: "/interactions/agent/search",
                enabled: true,
                keyQuery: expect.arrayContaining(["agent-interactions", "group-1"]),
            }),
        );

        rerender({ ...baseProps, activeGroupId: "group-2" });

        expect(useGenericSearchQuery.mock.calls.at(-1)[0].keyQuery).toEqual(
            expect.arrayContaining(["agent-interactions", "group-2"]),
        );
    });

    it.each([
        ["missing user identity", { currentUserId: null }],
        ["missing active group", { activeGroupId: null }],
        [
            "unresolved selected workspace",
            { allWorkspaces: false, selectedWorkspace: "workspace-1", scopeReady: false },
        ],
    ])("disables search for %s", (_label, overrides) => {
        renderHook(() => useInteractions({ ...baseProps, ...overrides }));

        expect(useGenericSearchQuery.mock.calls.at(-1)[0]).toEqual(expect.objectContaining({ enabled: false }));
    });
});
