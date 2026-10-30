import { schemaBulkClose, schemaBulkDelete, schemaBulkMove } from '../src/schemas.mjs';

const interactionId = '11111111-1111-4111-8111-111111111111';
const workspaceId = '22222222-2222-4222-8222-222222222222';

describe('interactions bulk request schemas', () => {
    it('accepts a valid move payload', () => {
        const { error, value } = schemaBulkMove.validate({
            interaction_ids: [interactionId],
            workspace_id: workspaceId,
        });

        expect(error).toBeUndefined();
        expect(value).toEqual({
            interaction_ids: [interactionId],
            workspace_id: workspaceId,
        });
    });

    it('rejects move payloads without interaction ids', () => {
        const { error } = schemaBulkMove.validate({
            interaction_ids: [],
            workspace_id: workspaceId,
        });

        expect(error).toBeDefined();
        expect(error.details[0].path).toEqual(['interaction_ids']);
    });

    it('trims and accepts a non-empty close motive', () => {
        const { error, value } = schemaBulkClose.validate({
            interaction_ids: [interactionId],
            motive: '  resolved  ',
        });

        expect(error).toBeUndefined();
        expect(value.motive).toBe('resolved');
    });

    it('rejects an empty delete motive after trimming', () => {
        const { error } = schemaBulkDelete.validate({
            interaction_ids: [interactionId],
            motive: '   ',
        });

        expect(error).toBeDefined();
        expect(error.details[0].path).toEqual(['motive']);
    });
});
