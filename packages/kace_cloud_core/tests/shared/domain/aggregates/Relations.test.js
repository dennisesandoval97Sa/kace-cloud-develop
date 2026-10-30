import {Relations} from '../../../../src/shared/domain/aggregates/Relations.js';

describe('Relations Aggregate', () => {
    test('should create a valid Relations aggregate', () => {
        const dto = {
            entity: 'users',
            relation: 'orders',
            join_condition: {
                left: 'users.id',
                operatos: 'eq',
                right: 'orders.user_id'
            },
            alias: 'users_orders'
        };

        const relationAgg = Relations.create(dto);

        expect(relationAgg.entity.value).toBe('users');
        expect(relationAgg.relation.value).toBe('orders');
        expect(relationAgg.join_condition.value).toEqual({
            left: 'users.id',
            operatos: 'eq',
            right: 'orders.user_id'
        });
        expect(relationAgg.alias.value).toBe('users_orders');
    });

    test('should update values through setters', () => {
        const dto = {
            entity: 'users',
            relation: 'orders',
            join_condition: {
                left: 'users.id',
                operatos: 'eq',
                right: 'orders.user_id'
            },
            alias: 'users_orders'
        };

        const relationAgg = Relations.create(dto);
        relationAgg.entity = 'customers';
        relationAgg.relation = 'invoices';
        relationAgg.join_condition = {
            left: 'customers.id',
            operator: 'eq',
            right: 'invoices.customer_id'
        };
        relationAgg.alias = 'customers_orders';

        expect(relationAgg.entity.value).toBe('customers');
        expect(relationAgg.relation.value).toBe('invoices');
        expect(relationAgg.join_condition.value).toEqual({
          left: 'customers.id',
          operator: 'eq',
          right: 'invoices.customer_id'
        });
        expect(relationAgg.alias.value).toBe('customers_orders');
    });

    test('should throw error for invalid join condition', () => {
        const dto = {
            entity: 'users',
            relation: 'orders',
            join_condition: 'invalid condition',
            alias: 'users_orders'
        };

        expect(() => Relations.create(dto)).toThrow();
    });
});
