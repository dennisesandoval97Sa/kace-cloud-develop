import { v4 as uuidv4 } from 'uuid';
import { createSchema } from '../src/schemas.mjs';

function validItem(overrides = {}) {
    return {
        channel_id: 'email',
        client_identifier: uuidv4(),
        external_identifier: `ext-${uuidv4().substring(0, 8)}`,
        priority: 'normal',
        workspace_id: uuidv4(),
        conversation_id: uuidv4(),
        ...overrides,
    };
}

describe('interactions batch create schema', () => {
    it('accepts a coherent migrated closed state', () => {
        const payload = [
            validItem({
                is_migrated: true,
                is_closed: true,
                in_review: false,
                closed_at: '2026-01-02T14:22:14.000Z',
                closed_by: uuidv4(),
            }),
        ];

        expect(createSchema.validate(payload, { abortEarly: false }).error).toBeUndefined();
    });

    it('rejects non-migrated imported state', () => {
        const payload = [
            validItem({
                is_migrated: false,
                is_closed: true,
                closed_at: '2026-01-02T14:22:14.000Z',
                closed_by: uuidv4(),
            }),
        ];

        expect(createSchema.validate(payload, { abortEarly: false }).error?.message).toContain('is_migrated is true');
    });

    it('requires review metadata for migrated in-review state', () => {
        const payload = [validItem({ is_migrated: true, in_review: true })];

        expect(createSchema.validate(payload, { abortEarly: false }).error?.message).toContain(
            'requires start_review_at and start_review_by'
        );
    });

    it('rejects a migrated interaction that is both closed and in review', () => {
        const payload = [
            validItem({
                is_migrated: true,
                is_closed: true,
                in_review: true,
                closed_at: '2026-01-02T14:22:14.000Z',
                closed_by: uuidv4(),
                start_review_at: '2026-01-02T14:20:02.000Z',
                start_review_by: uuidv4(),
            }),
        ];

        expect(createSchema.validate(payload, { abortEarly: false }).error?.message).toContain('closed and in review');
    });
});
