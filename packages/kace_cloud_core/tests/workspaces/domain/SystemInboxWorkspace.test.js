import {
    SYSTEM_INBOX_WORKSPACE_ID,
    isSystemInboxWorkspaceId,
} from '../../../src/workspaces/domain/SystemInboxWorkspace.js';

describe('SystemInboxWorkspace', () => {
    it('recognizes only the canonical System Inbox Workspace identifier', () => {
        expect(SYSTEM_INBOX_WORKSPACE_ID).toBe('dbcc5b5a-61bb-4b5a-95d0-9f6222749e54');
        expect(isSystemInboxWorkspaceId('dbcc5b5a-61bb-4b5a-95d0-9f6222749e54')).toBe(true);
        expect(isSystemInboxWorkspaceId('DBCC5B5A-61BB-4B5A-95D0-9F6222749E54')).toBe(true);
        expect(isSystemInboxWorkspaceId({ value: 'dbcc5b5a-61bb-4b5a-95d0-9f6222749e54' })).toBe(true);
        expect(isSystemInboxWorkspaceId('INBOX')).toBe(false);
        expect(isSystemInboxWorkspaceId('inbox')).toBe(false);
        expect(isSystemInboxWorkspaceId(null)).toBe(false);
    });
});
