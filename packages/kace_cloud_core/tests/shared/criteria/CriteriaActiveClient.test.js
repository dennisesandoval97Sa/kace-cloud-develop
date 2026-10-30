import { Criteria, KnexRepository } from '../../../src/shared/index.js';
import { knexConfig } from '../../knexfile.js';

describe('Criteria - active_client filter', () => {
    let repository;

    beforeAll(async () => {
        repository = new KnexRepository(knexConfig);
    });

    it('should generate WHERE field = value (AND) for active_client filter', () => {
        const clientId = '11111111-1111-4111-8111-111111111111';

        const filters = [
            {
                field: 'cases.cliente_id',
                operator: 'eq',
                type: 'and',
                value: {
                    function: 'active_client',
                    value: clientId,
                },
            },
        ];

        const criteria = new Criteria(filters, null, 10, 0, null, 'cases');
        const query = criteria.convertToKnex(repository.connection('cases').select('*'));
        const sql = query.toQuery();

        expect(sql).toContain('"cases"."cliente_id"');
        expect(sql).toContain(clientId);
    });

    it('should generate OR WHERE condition for active_client filter with type OR', () => {
        const clientId = '11111111-1111-4111-8111-111111111111';

        const filters = [
            {
                field: 'cases.status',
                operator: 'eq',
                value: 'open',
                type: 'and',
            },
            {
                field: 'cases.cliente_id',
                operator: 'eq',
                type: 'or',
                value: {
                    function: 'active_client',
                    value: clientId,
                },
            },
        ];

        const criteria = new Criteria(filters, null, 10, 0, null, 'cases');
        const query = criteria.convertToKnex(repository.connection('cases').select('*'));
        const sql = query.toQuery();

        expect(sql).toContain('"cases"."status"');
        expect(sql).toContain('"cases"."cliente_id"');
        expect(sql).toContain(clientId);
        expect(sql.toLowerCase()).toContain('or');
    });

    it('should generate WHERE field != value for active_client with neq operator', () => {
        const clientId = '22222222-2222-4222-8222-222222222222';

        const filters = [
            {
                field: 'cases.cliente_id',
                operator: 'neq',
                type: 'and',
                value: {
                    function: 'active_client',
                    value: clientId,
                },
            },
        ];

        const criteria = new Criteria(filters, null, 10, 0, null, 'cases');
        const query = criteria.convertToKnex(repository.connection('cases').select('*'));
        const sql = query.toQuery();

        expect(sql).toContain('"cases"."cliente_id"');
        expect(sql).toContain('!=');
        expect(sql).toContain(clientId);
    });

    it('should combine active_client with other standard filters', () => {
        const clientId = '33333333-3333-4333-8333-333333333333';

        const filters = [
            {
                field: 'cases.status',
                operator: 'eq',
                value: 'active',
                type: 'and',
            },
            {
                field: 'cases.cliente_id',
                operator: 'eq',
                type: 'and',
                value: {
                    function: 'active_client',
                    value: clientId,
                },
            },
        ];

        const criteria = new Criteria(filters, null, 10, 0, null, 'cases');
        const query = criteria.convertToKnex(repository.connection('cases').select('*'));
        const sql = query.toQuery();

        expect(sql).toContain('"cases"."status"');
        expect(sql).toContain('active');
        expect(sql).toContain('"cases"."cliente_id"');
        expect(sql).toContain(clientId);
    });
});
