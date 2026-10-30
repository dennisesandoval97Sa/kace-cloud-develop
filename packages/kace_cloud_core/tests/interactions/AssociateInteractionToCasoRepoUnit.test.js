import { jest } from '@jest/globals';
import { KnexAssociateInteractionToCasoRepo } from '../../src/interactions/infrastructure/persistence/KnexAssociateInteractionToCasoRepo.js';

const buildSchemaRecordingConnection = () => {
    const tableNames = [];
    const operations = [];

    class FakeQueryBuilder {
        constructor(tableName) {
            this.tableName = tableName;
        }

        insert(payload) {
            operations.push(['insert', this.tableName, payload]);
            return Promise.resolve();
        }

        where(condition) {
            operations.push(['where', this.tableName, condition]);
            return this;
        }

        whereNull(column) {
            operations.push(['whereNull', this.tableName, column]);
            return this;
        }

        first() {
            operations.push(['first', this.tableName]);
            return Promise.resolve({ caso_id: 'case-id' });
        }

        select(...columns) {
            operations.push(['select', this.tableName, columns]);
            return this;
        }

        then(resolve, reject) {
            return Promise.resolve([{ caso_id: 'case-id' }]).then(resolve, reject);
        }
    }

    const connection = jest.fn((tableName) => {
        tableNames.push(tableName);
        return new FakeQueryBuilder(tableName);
    });

    connection.client = {
        config: {
            client: 'pg',
            schema: 'tenant_schema',
        },
        on: jest.fn(),
    };

    return { connection, tableNames, operations };
};

describe('KnexAssociateInteractionToCasoRepo', () => {
    it('uses the tenant-qualified interaction_casos table for all queries', async () => {
        const { connection, tableNames } = buildSchemaRecordingConnection();
        const repository = new KnexAssociateInteractionToCasoRepo(connection);
        const criteria = { convertToKnex: jest.fn() };

        await repository.save({
            interaction_id: 'interaction-id',
            caso_id: 'case-id',
            created_by: 'user-id',
            created_at: '2026-06-01T00:00:00.000Z',
        });
        await repository.exists('interaction-id', 'case-id');
        await repository.findByInteractionId('interaction-id');
        await repository.search(criteria);

        expect(tableNames).toEqual([
            'tenant_schema.interaction_casos',
            'tenant_schema.interaction_casos',
            'tenant_schema.interaction_casos',
            'tenant_schema.interaction_casos',
        ]);
        expect(criteria.convertToKnex).toHaveBeenCalledTimes(1);
    });
});
