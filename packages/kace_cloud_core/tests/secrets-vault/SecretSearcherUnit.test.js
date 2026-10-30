import { jest } from '@jest/globals';
import { SecretSearcher } from '../../src/secrets-vault';

describe('Secret search', () => {
    it('reports the filtered total instead of the unfiltered collection total', async () => {
        const matchingSecret = {
            id: { value: 'matching-secret-id' },
            descripcion: { value: 'Only matching secret' },
            referencia: { value: 'ONLY_MATCH' },
            secreto: { value: 'must-not-be-returned' },
            created_at: { value: '2026-07-22T12:00:00.000Z' },
            created_by: { value: 'creator-id' },
            updated_at: { value: null },
            updated_by: { value: null },
        };
        const repository = {
            tableName: 'boveda_secretos',
            search: jest.fn().mockResolvedValue([matchingSecret]),
            count: jest.fn().mockImplementation(async (criteria) => ({
                count: criteria.filters?.toJson().length ? 1 : 2,
            })),
        };

        const response = await new SecretSearcher(repository).execute({
            filter: [
                {
                    field: 'boveda_secretos.descripcion',
                    operator: 'ilike',
                    value: 'Only matching',
                    type: 'AND',
                },
            ],
            relationship: null,
            limit: 10,
            offset: 0,
            order: { field: 'created_at', direction: 'desc' },
        });

        expect(response.toJson()).toMatchObject({
            data: { items: [{ id: matchingSecret.id.value, secreto: '***' }] },
            metadata: { count: { count: 1 } },
        });
    });
});
