export const SYSTEM_INBOX_WORKSPACE_ID = 'dbcc5b5a-61bb-4b5a-95d0-9f6222749e54';

export const isSystemInboxWorkspaceId = (workspaceId) => {
    const value = typeof workspaceId === 'object' && workspaceId !== null ? workspaceId.value : workspaceId;
    return typeof value === 'string' && value.toLowerCase() === SYSTEM_INBOX_WORKSPACE_ID;
};
