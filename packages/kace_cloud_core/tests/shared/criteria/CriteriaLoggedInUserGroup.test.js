import { Criteria, KnexRepository } from '../../../src/shared/index.js';
import { knexConfig } from '../../knexfile.js';

describe('Criteria - logged_in_user_group filter', () => {
    let repository;

    beforeAll(async () => {
        repository = new KnexRepository(knexConfig);
    });

    it('should generate WHERE field = value (AND) for logged_in_user_group filter', () => {
        const groupId = 'group-abc-123';

        const filters = [
            {
                field: 'casos.grupo_id',
                operator: 'eq',
                type: 'and',
                value: {
                    function: 'logged_in_user_group',
                    value: groupId,
                },
            },
        ];

        const criteria = new Criteria(filters, null, 10, 0, null, 'casos');
        const query = criteria.convertToKnex(repository.connection('casos').select('*'));
        const sql = query.toQuery();

        expect(sql).toContain('"casos"."grupo_id"');
        expect(sql).toContain(groupId);
    });

    it('should generate OR WHERE condition for logged_in_user_group filter with type OR', () => {
        const groupId = 'group-abc-123';

        const filters = [
            {
                field: 'casos.status',
                operator: 'eq',
                value: 'open',
                type: 'and',
            },
            {
                field: 'casos.grupo_id',
                operator: 'eq',
                type: 'or',
                value: {
                    function: 'logged_in_user_group',
                    value: groupId,
                },
            },
        ];

        const criteria = new Criteria(filters, null, 10, 0, null, 'casos');
        const query = criteria.convertToKnex(repository.connection('casos').select('*'));
        const sql = query.toQuery();

        expect(sql).toContain('"casos"."status"');
        expect(sql).toContain('"casos"."grupo_id"');
        expect(sql).toContain(groupId);
        expect(sql.toLowerCase()).toContain('or');
    });

    it('should generate WHERE field != value for logged_in_user_group with neq operator', () => {
        const groupId = 'group-456';

        const filters = [
            {
                field: 'casos.grupo_id',
                operator: 'neq',
                type: 'and',
                value: {
                    function: 'logged_in_user_group',
                    value: groupId,
                },
            },
        ];

        const criteria = new Criteria(filters, null, 10, 0, null, 'casos');
        const query = criteria.convertToKnex(repository.connection('casos').select('*'));
        const sql = query.toQuery();

        expect(sql).toContain('"casos"."grupo_id"');
        expect(sql).toContain('!=');
        expect(sql).toContain(groupId);
    });

    it('should throw error when logged_in_user_group filter has no group ID value', () => {
        const filters = [
            {
                field: 'casos.grupo_id',
                operator: 'eq',
                type: 'and',
                value: {
                    function: 'logged_in_user_group',
                    value: undefined,
                },
            },
        ];

        const criteria = new Criteria(filters, null, 10, 0, null, 'casos');

        expect(() => {
            criteria.convertToKnex(repository.connection('casos').select('*'));
        }).toThrow('logged_in_user filter requires a user ID value');
    });

    it('should combine logged_in_user_group with other standard filters correctly', () => {
        const groupId = 'group-789';

        const filters = [
            {
                field: 'casos.status',
                operator: 'eq',
                value: 'active',
                type: 'and',
            },
            {
                field: 'casos.grupo_id',
                operator: 'eq',
                type: 'and',
                value: {
                    function: 'logged_in_user_group',
                    value: groupId,
                },
            },
        ];

        const criteria = new Criteria(filters, null, 10, 0, null, 'casos');
        const query = criteria.convertToKnex(repository.connection('casos').select('*'));
        const sql = query.toQuery();

        expect(sql).toContain('"casos"."status"');
        expect(sql).toContain('active');
        expect(sql).toContain('"casos"."grupo_id"');
        expect(sql).toContain(groupId);
    });

    it('should combine logged_in_user and logged_in_user_group filters in the same query', () => {
        const userId = 'user-abc';
        const groupId = 'group-abc';

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
            {
                field: 'casos.grupo_id',
                operator: 'eq',
                type: 'or',
                value: {
                    function: 'logged_in_user_group',
                    value: groupId,
                },
            },
        ];

        const criteria = new Criteria(filters, null, 10, 0, null, 'casos');
        const query = criteria.convertToKnex(repository.connection('casos').select('*'));
        const sql = query.toQuery();

        expect(sql).toContain('"casos"."responsable_id"');
        expect(sql).toContain(userId);
        expect(sql).toContain('"casos"."grupo_id"');
        expect(sql).toContain(groupId);
    });
});
