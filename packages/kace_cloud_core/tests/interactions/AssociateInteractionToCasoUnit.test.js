import { KnexAssociateInteractionToCasoRepo } from '../../src/interactions/infrastructure/persistence/KnexAssociateInteractionToCasoRepo.js';

describe('KnexAssociateInteractionToCasoRepo schema qualification', () => {
    function createRecordingKnex({ result = null } = {}) {
        const tables = [];
        const calls = [];
        const createBuilder = (tableName) => {
            const builder = {};
            const chain = (method) => {
                builder[method] = (...args) => {
                    calls.push([method, tableName, args]);
                    return builder;
                };
            };

            ['insert', 'where', 'whereNull', 'select', 'first'].forEach(chain);
            builder.then = (resolve, reject) => Promise.resolve(result).then(resolve, reject);
            builder.catch = (reject) => Promise.resolve(result).catch(reject);

            return builder;
        };
        const knex = (tableName) => {
            tables.push(tableName);
            return createBuilder(tableName);
        };
        knex.client = {
            config: { client: 'pg', schema: 'tenant_schema' },
            on: () => {},
        };

        return { knex, tables, calls };
    }

    it('schema-qualifies existence checks', async () => {
        const { knex, tables, calls } = createRecordingKnex({ result: { interaction_id: 'interaction-1' } });
        const repository = new KnexAssociateInteractionToCasoRepo(knex);

        await repository.exists('interaction-1', 'case-1');

        expect(tables).toEqual(['tenant_schema.interaction_casos']);
        expect(calls).toContainEqual([
            'where',
            'tenant_schema.interaction_casos',
            [{ interaction_id: 'interaction-1', caso_id: 'case-1' }],
        ]);
    });

    it('schema-qualifies inserts and reads', async () => {
        const { knex, tables } = createRecordingKnex({ result: [] });
        const repository = new KnexAssociateInteractionToCasoRepo(knex);

        await repository.save({
            interaction_id: 'interaction-1',
            caso_id: 'case-1',
            created_by: 'user-1',
            created_at: '2026-06-01T00:00:00.000Z',
        });
        await repository.findByInteractionId('interaction-1');
        await repository.search({
            convertToKnex: (queryBuilder) => queryBuilder,
        });

        expect(tables).toEqual([
            'tenant_schema.interaction_casos',
            'tenant_schema.interaction_casos',
            'tenant_schema.interaction_casos',
        ]);
    });
});
