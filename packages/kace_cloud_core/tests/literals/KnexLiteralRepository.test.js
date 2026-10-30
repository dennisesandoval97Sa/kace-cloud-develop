import { KnexLiteralRepository } from '../../src/literals/infrastructure/persistence/KnexLiteralRepository.js';

describe('KnexLiteralRepository', () => {
    it('schema-qualifies findActiveOptionByPath from and joins for non-public tenants', async () => {
        const tableCalls = [];
        const operations = [];

        const createBuilder = (tableName) => ({
            select(...args) {
                operations.push(['select', tableName, args]);
                return this;
            },
            join(...args) {
                operations.push(['join', tableName, args]);
                return this;
            },
            where(...args) {
                operations.push(['where', tableName, args]);
                return this;
            },
            whereNull(...args) {
                operations.push(['whereNull', tableName, args]);
                return this;
            },
            first() {
                operations.push(['first', tableName]);
                return Promise.resolve(null);
            },
        });

        const connection = (tableName) => {
            tableCalls.push(tableName);
            return createBuilder(tableName);
        };
        connection.client = {
            config: {
                client: 'pg',
                schema: 'tenant_schema',
            },
            on() {},
        };

        const repository = new KnexLiteralRepository(connection);

        await repository.findActiveOptionByPath('interactions', 'closed_observation', 'Cliente no responde');

        expect(tableCalls).toEqual(['tenant_schema.literales as option']);
        expect(operations).toContainEqual([
            'join',
            'tenant_schema.literales as option',
            ['tenant_schema.literales as field', 'option.tipo_literal', 'field.id'],
        ]);
        expect(operations).toContainEqual([
            'join',
            'tenant_schema.literales as option',
            ['tenant_schema.literales as model', 'field.tipo_literal', 'model.id'],
        ]);
    });
});
