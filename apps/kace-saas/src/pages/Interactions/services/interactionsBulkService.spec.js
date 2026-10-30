import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiService } from "@kace/utils";
import { SYSTEM_INBOX_WORKSPACE_ID } from "@/utils/systemInboxWorkspace";
import { moveInteractions } from "./interactionsBulkService";

vi.mock("@kace/utils", () => ({ apiService: { post: vi.fn() } }));

describe("moveInteractions", () => {
    beforeEach(() => vi.clearAllMocks());

    it("does not submit moves to the canonical Inbox workspace", async () => {
        await moveInteractions({ interaction_ids: ["interaction-1"], workspace_id: SYSTEM_INBOX_WORKSPACE_ID });
        expect(apiService.post).not.toHaveBeenCalled();
    });

    it("does not block workspaces merely named Inbox", async () => {
        await moveInteractions({ interaction_ids: ["interaction-1"], workspace_id: "Inbox" });
        expect(apiService.post).toHaveBeenCalledWith("/interactions-bulk/move", {
            interaction_ids: ["interaction-1"],
            workspace_id: "Inbox",
        });
    });
});
