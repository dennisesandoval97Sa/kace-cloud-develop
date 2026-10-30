import { describe, expect, it } from "vitest";
import {
    SYSTEM_INBOX_WORKSPACE_ID,
    createSystemInboxInteractionExclusionFilter,
    createSystemInboxWorkspaceExclusionFilter,
    excludeSystemInboxWorkspaces,
    isSystemInboxWorkspaceId,
} from "./systemInboxWorkspace";

describe("systemInboxWorkspace", () => {
    it("matches only the canonical identifier", () => {
        expect(SYSTEM_INBOX_WORKSPACE_ID).toBe("dbcc5b5a-61bb-4b5a-95d0-9f6222749e54");
        expect(isSystemInboxWorkspaceId(SYSTEM_INBOX_WORKSPACE_ID)).toBe(true);
        expect(isSystemInboxWorkspaceId(SYSTEM_INBOX_WORKSPACE_ID.toUpperCase())).toBe(true);
        expect(isSystemInboxWorkspaceId("INBOX")).toBe(false);
        expect(isSystemInboxWorkspaceId({ id: SYSTEM_INBOX_WORKSPACE_ID })).toBe(false);
    });

    it("builds fresh endpoint-specific neq filters", () => {
        expect(createSystemInboxWorkspaceExclusionFilter()).toEqual({
            field: "id",
            operator: "neq",
            value: SYSTEM_INBOX_WORKSPACE_ID,
            type: "AND",
        });
        expect(createSystemInboxInteractionExclusionFilter()).toEqual({
            groupType: "AND",
            filters: [
                {
                    field: "workspace_id",
                    operator: "neq",
                    value: SYSTEM_INBOX_WORKSPACE_ID,
                    type: "AND",
                },
                {
                    field: "workspace_id",
                    operator: "null",
                    value: "null",
                    type: "OR",
                },
            ],
        });

        expect(createSystemInboxWorkspaceExclusionFilter()).not.toBe(createSystemInboxWorkspaceExclusionFilter());
    });

    it("filters rows only by canonical identifier without mutating the input", () => {
        const rows = [
            { id: SYSTEM_INBOX_WORKSPACE_ID, description: "Renamed system workspace" },
            { id: "workspace-1", description: "INBOX" },
            { id: "workspace-2", tag: "inbox" },
        ];

        expect(excludeSystemInboxWorkspaces(rows)).toEqual([rows[1], rows[2]]);
        expect(rows).toHaveLength(3);
    });
});
