import { ValueObjectTimeFilter } from '../../../../src/csv-export-views/domain/value-objects/ValueObjectTimeFilter.js';
import { ValidationFailError } from '../../../../src/shared/index.js';

const validValue = () => ({ field: 'created_at', interval: 12, unit: 'hours', reference: 'now' });

describe('ValueObjectTimeFilter', () => {
    describe('nullability', () => {
        it('throws when the value is missing and the field is not nullable', () => {
            expect(() => new ValueObjectTimeFilter('time_filter', null)).toThrow(
                'time_filter: The value cannot be null'
            );
        });

        it('throws when the value is missing and nullable is explicitly false', () => {
            expect(() => new ValueObjectTimeFilter('time_filter', undefined, false)).toThrow(
                'time_filter: The value cannot be null'
            );
        });

        it('returns without validating when the value is missing but the field is nullable', () => {
            const vo = new ValueObjectTimeFilter('time_filter', null, true);
            expect(vo.value).toBeNull();
        });

        it('validates normally when a value is present, regardless of the nullable flag', () => {
            const vo = new ValueObjectTimeFilter('time_filter', validValue(), true);
            expect(vo.value).toEqual(validValue());
        });
    });

    describe('shape validation', () => {
        it('throws ValidationFailError for an invalid field', () => {
            expect(() => new ValueObjectTimeFilter('time_filter', { ...validValue(), field: 'not_a_field' })).toThrow(
                ValidationFailError
            );
        });

        it('throws ValidationFailError for a non-positive interval', () => {
            expect(() => new ValueObjectTimeFilter('time_filter', { ...validValue(), interval: 0 })).toThrow(
                ValidationFailError
            );
        });

        it('throws ValidationFailError for an invalid unit', () => {
            expect(() => new ValueObjectTimeFilter('time_filter', { ...validValue(), unit: 'seconds' })).toThrow(
                ValidationFailError
            );
        });

        it('throws ValidationFailError for an invalid reference', () => {
            expect(() => new ValueObjectTimeFilter('time_filter', { ...validValue(), reference: 'yesterday' })).toThrow(
                ValidationFailError
            );
        });

        it('accepts a valid value for every allowed field/unit/reference combination', () => {
            const vo = new ValueObjectTimeFilter('time_filter', {
                field: 'fecha',
                interval: '5',
                unit: 'months',
                reference: 'start_of_month',
            });
            expect(vo.value.field).toBe('fecha');
        });
    });

    describe('toSQL', () => {
        it('builds the "now" reference clause using NOW() when no currentDate is given', () => {
            const vo = new ValueObjectTimeFilter('time_filter', validValue());
            expect(vo.toSQL()).toBe("(NOW()) - INTERVAL '12 hours'");
        });

        it('builds the "now" reference clause using a formatted currentDate when given', () => {
            const vo = new ValueObjectTimeFilter('time_filter', validValue());
            const currentDate = { format: () => '2026-01-01 00:00:00' };
            expect(vo.toSQL(currentDate)).toBe("(2026-01-01 00:00:00) - INTERVAL '12 hours'");
        });

        it('builds the "start_of_day" reference clause with DATE_TRUNC', () => {
            const vo = new ValueObjectTimeFilter('time_filter', { ...validValue(), reference: 'start_of_day' });
            expect(vo.toSQL()).toBe("DATE_TRUNC('day', NOW()) - INTERVAL '12 hours'");
        });

        it('builds the "start_of_month" reference clause with DATE_TRUNC', () => {
            const vo = new ValueObjectTimeFilter('time_filter', { ...validValue(), reference: 'start_of_month' });
            expect(vo.toSQL()).toBe("DATE_TRUNC('month', NOW()) - INTERVAL '12 hours'");
        });

        it('throws for a reference that is not one of the three known cases', () => {
            // The constructor rejects an invalid reference outright, so the only way to reach the
            // switch's `default` branch through the public API is via the nullable early-return:
            // an empty string is falsy (skips validation) yet is still stored as `this.value`, so
            // `this.value.reference` reads as `undefined` at toSQL()-time instead of throwing.
            const vo = new ValueObjectTimeFilter('time_filter', '', true);
            expect(() => vo.toSQL()).toThrow('Invalid time reference');
        });
    });

    describe('toSQLite', () => {
        it('builds the "now" reference clause using CURRENT_TIMESTAMP when no currentDate is given', () => {
            const vo = new ValueObjectTimeFilter('time_filter', validValue());
            expect(vo.toSQLite()).toBe("DATETIME(CURRENT_TIMESTAMP, '-12 hours')");
        });

        it('builds the "now" reference clause using a formatted currentDate when given', () => {
            const vo = new ValueObjectTimeFilter('time_filter', validValue());
            const currentDate = { format: () => '2026-01-01 00:00:00' };
            expect(vo.toSQLite(currentDate)).toBe("DATETIME(2026-01-01 00:00:00, '-12 hours')");
        });

        it('builds the "start_of_day" reference clause with STRFTIME', () => {
            const vo = new ValueObjectTimeFilter('time_filter', { ...validValue(), reference: 'start_of_day' });
            expect(vo.toSQLite()).toBe(`STRFTIME("%Y-%m-%d 00:00:00", CURRENT_TIMESTAMP) - INTERVAL '12 hours'`);
        });

        it('builds the "start_of_month" reference clause with STRFTIME', () => {
            const vo = new ValueObjectTimeFilter('time_filter', { ...validValue(), reference: 'start_of_month' });
            expect(vo.toSQLite()).toBe(`STRFTIME("%Y-%m-01 00:00:00", CURRENT_TIMESTAMP) - INTERVAL '12 hours'`);
        });

        it('throws for a reference that is not one of the three known cases', () => {
            const vo = new ValueObjectTimeFilter('time_filter', '', true);
            expect(() => vo.toSQLite()).toThrow('Invalid time reference');
        });
    });
});
