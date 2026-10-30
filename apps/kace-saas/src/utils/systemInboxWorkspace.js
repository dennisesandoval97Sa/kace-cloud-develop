export const SYSTEM_INBOX_WORKSPACE_ID = "dbcc5b5a-61bb-4b5a-95d0-9f6222749e54";

export const isSystemInboxWorkspaceId = (workspaceId) =>
    typeof workspaceId === "string" && workspaceId.toLowerCase() === SYSTEM_INBOX_WORKSPACE_ID;

export const createSystemInboxWorkspaceExclusionFilter = () => ({
    field: "id",
    operator: "neq",
    value: SYSTEM_INBOX_WORKSPACE_ID,
    type: "AND",
});

export const createSystemInboxInteractionExclusionFilter = () => ({
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

export const excludeSystemInboxWorkspaces = (rows) =>
    Array.isArray(rows) ? rows.filter(({ id }) => !isSystemInboxWorkspaceId(id)) : [];
