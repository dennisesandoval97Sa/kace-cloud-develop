import { describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import useGenericSearchQuery from "@/hooks/useGenericSearchQuery";
import { SYSTEM_INBOX_WORKSPACE_ID } from "@/utils/systemInboxWorkspace";
import useInteractionBulkOptions from "./useInteractionBulkOptions";

vi.mock("@/hooks/useGenericSearchQuery", () => ({ default: vi.fn() }));

describe("useInteractionBulkOptions", () => {
    it("excludes only the canonical Inbox from move destinations", () => {
        useGenericSearchQuery.mockImplementation(({ url, filter = [], select }) => {
            if (url === "/workspaces/search") {
                expect(filter.at(-1)).toEqual({
                    field: "id",
                    operator: "neq",
                    value: SYSTEM_INBOX_WORKSPACE_ID,
                    type: "AND",
                });
                const response = {
                    data: [
                        { id: SYSTEM_INBOX_WORKSPACE_ID, description: "System Inbox" },
                        { id: "workspace-2", description: "Inbox" },
                    ],
                };
                return { data: select(response), isLoading: false };
            }
            return { data: [], isLoading: false };
        });

        const { result } = renderHook(() => useInteractionBulkOptions());

        expect(result.current.workspaceOptions).toEqual([{ label: "Inbox", value: "workspace-2" }]);
    });
});
