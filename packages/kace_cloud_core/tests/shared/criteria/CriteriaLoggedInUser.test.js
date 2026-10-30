import { Criteria, KnexRepository } from '../../../src/shared/index.js';
import { knexConfig } from '../../knexfile.js';

describe('Criteria - logged_in_user filter', () => {
    let repository;

    beforeAll(async () => {
        repository = new KnexRepository(knexConfig);
    });

    test('should generate WHERE field = value (AND) for logged_in_user filter', () => {
        const userId = 'abc-123-user-id';

        const filters = [
            {
                field: 'casos.responsable_id',
                operator: 'eq',
                type: 'and',
                value: {
                    function: 'logged_in_user',
                    value: userId,
                },
            },
        ];

        const criteria = new Criteria(filters, null, 10, 0, null, 'casos');
        const query = criteria.convertToKnex(repository.connection('casos').select('*'));
        const sql = query.toQuery();

        expect(sql).toContain('"casos"."responsable_id"');
        expect(sql).toContain(userId);
    });

    test('should generate OR WHERE condition for logged_in_user filter with type OR', () => {
        const userId = 'abc-123-user-id';

        const filters = [
            {
                field: 'casos.status',
                operator: 'eq',
                value: 'open',
                type: 'and',
            },
            {
                field: 'casos.responsable_id',
                operator: 'eq',
                type: 'or',
                value: {
                    function: 'logged_in_user',
                    value: userId,
                },
            },
        ];

        const criteria = new Criteria(filters, null, 10, 0, null, 'casos');
        const query = criteria.convertToKnex(repository.connection('casos').select('*'));
        const sql = query.toQuery();

        expect(sql).toContain('"casos"."status"');
        expect(sql).toContain('"casos"."responsable_id"');
        expect(sql).toContain(userId);
        expect(sql.toLowerCase()).toContain('or');
    });

    test('should generate WHERE field != value for logged_in_user with neq operator', () => {
        const userId = 'user-456';

        const filters = [
            {
                field: 'casos.responsable_id',
                operator: 'neq',
                type: 'and',
                value: {
                    function: 'logged_in_user',
                    value: userId,
                },
            },
        ];

        const criteria = new Criteria(filters, null, 10, 0, null, 'casos');
        const query = criteria.convertToKnex(repository.connection('casos').select('*'));
        const sql = query.toQuery();

        expect(sql).toContain('"casos"."responsable_id"');
        expect(sql).toContain('!=');
        expect(sql).toContain(userId);
    });

    test('should throw error when logged_in_user filter has no user ID value', () => {
        const filters = [
            {
                field: 'casos.responsable_id',
                operator: 'eq',
                type: 'and',
                value: {
                    function: 'logged_in_user',
                    value: undefined,
                },
            },
        ];

        const criteria = new Criteria(filters, null, 10, 0, null, 'casos');

        expect(() => {
            criteria.convertToKnex(repository.connection('casos').select('*'));
        }).toThrow('logged_in_user filter requires a user ID value');
    });

    test('should combine logged_in_user with other standard filters correctly', () => {
        const userId = 'user-789';

        const filters = [
            {
                field: 'casos.status',
                operator: 'eq',
                value: 'active',
                type: 'and',
            },
            {
                field: 'casos.responsable_id',
                operator: 'eq',
                type: 'and',
                value: {
                    function: 'logged_in_user',
                    value: userId,
                },
            },
        ];

        const criteria = new Criteria(filters, null, 10, 0, null, 'casos');
        const query = criteria.convertToKnex(repository.connection('casos').select('*'));
        const sql = query.toQuery();

        expect(sql).toContain('"casos"."status"');
        expect(sql).toContain('active');
        expect(sql).toContain('"casos"."responsable_id"');
        expect(sql).toContain(userId);
    });
});
