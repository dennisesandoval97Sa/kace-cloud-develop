import { ValueObjectJoinCondition } from '../../../../src/shared/domain/value-object/ValueObjectJoinCondition.js';

describe('ValueObjectJoinCondition', () => {
    test('should create a valid join condition', () => {
        const condition = new ValueObjectJoinCondition('join condition', 'users.id = cases.user_id');
        expect(condition.value).toBe('users.id = cases.user_id');
    });

    test('should throw error if format is invalid', () => {
        const invalidCases = [
            'usersid = orders_user_id',
            'users.id=orders',
            'users.id == cases.user_id',
            'users = cases.user_id',
            'users.id cases.user_id'
        ];

        for (const c of invalidCases) {
            expect(() => new ValueObjectJoinCondition(c)).toThrow();
        }
    });

    test('should throw error when missing "="', () => {
        expect(() => new ValueObjectJoinCondition('join condition', 'users.id cases.user_id')).toThrow();
    });

    test('should throw error on empty value', () => {
        expect(() => new ValueObjectJoinCondition('join condition', '')).toThrow();
    });
});
