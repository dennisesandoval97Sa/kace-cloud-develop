import dayjs from 'dayjs';
import { ValueComparator } from '../../src/actions/domain/QueryTranslator/ValueComparator.js';
import { InvalidArgumentError } from '../../src/shared/index.js';

describe('ValueComparator', () => {
    describe('compareEquals', () => {
        it('should compare equality for dates', () => {
            const d1 = dayjs('2024-01-01');
            const d2 = dayjs('2024-01-01');
            expect(ValueComparator.compareEquals(d1, d2, 'date')).toBe(true);
        });

        it('should compare equality for primitives', () => {
            expect(ValueComparator.compareEquals(5, 5, 'number')).toBe(true);
            expect(ValueComparator.compareEquals('test', 'test', 'string')).toBe(true);
        });
    });

    describe('compareLessThan', () => {
        it('should return true if date is before', () => {
            expect(ValueComparator.compareLessThan(dayjs('2024-01-01'), dayjs('2024-01-02'), 'date')).toBe(true);
        });

        it('should return true if number is less', () => {
            expect(ValueComparator.compareLessThan(4, 5, 'number')).toBe(true);
        });
    });

    describe('compareGreaterThan', () => {
        it('should return true if date is after', () => {
            expect(ValueComparator.compareGreaterThan(dayjs('2024-01-03'), dayjs('2024-01-02'), 'date')).toBe(true);
        });

        it('should return true if number is greater', () => {
            expect(ValueComparator.compareGreaterThan(10, 5, 'number')).toBe(true);
        });
    });

    describe('compareLessThanOrEqual', () => {
        it('should return true if date is same or before', () => {
            expect(ValueComparator.compareLessThanOrEqual(dayjs('2024-01-01'), dayjs('2024-01-01'), 'date')).toBe(true);
        });

        it('should return true if number is less or equal', () => {
            expect(ValueComparator.compareLessThanOrEqual(5, 5, 'number')).toBe(true);
        });
    });

    describe('compareGreaterThanOrEqual', () => {
        it('should return true if date is same or after', () => {
            expect(ValueComparator.compareGreaterThanOrEqual(dayjs('2024-01-02'), dayjs('2024-01-01'), 'date')).toBe(
                true
            );
        });

        it('should return true if number is greater or equal', () => {
            expect(ValueComparator.compareGreaterThanOrEqual(10, 10, 'number')).toBe(true);
        });
    });

    describe('compareContains', () => {
        it('should return true if fieldValue contains ruleValue', () => {
            expect(ValueComparator.compareContains('hello world', 'world')).toBe(true);
        });
    });

    describe('compareBeginsWith', () => {
        it('should return true if fieldValue starts with ruleValue', () => {
            expect(ValueComparator.compareBeginsWith('hello', 'he')).toBe(true);
        });
    });

    describe('compareEndsWith', () => {
        it('should return true if fieldValue ends with ruleValue', () => {
            expect(ValueComparator.compareEndsWith('hello', 'lo')).toBe(true);
        });
    });

    describe('compareIn', () => {
        it('should return true if fieldValue is in list (string)', () => {
            expect(ValueComparator.compareIn('apple', 'banana, apple, orange', 'string')).toBe(true);
        });

        it('should return true if number is in list', () => {
            expect(ValueComparator.compareIn(5, '4,5,6', 'number')).toBe(true);
        });

        it('should return true if date is in list', () => {
            const date = ValueComparator.processValue('2024-05-01', 'date');
            expect(ValueComparator.compareIn(date, '2024-04-01,2024-05-01', 'date')).toBe(true);
        });
    });

    describe('compareBetween', () => {
        it('should return true if number is in range', () => {
            expect(ValueComparator.compareBetween(5, '4,6', 'number')).toBe(true);
        });

        it('should return true if string is in range', () => {
            expect(ValueComparator.compareBetween('m', 'a,z', 'string')).toBe(true);
        });

        it('should return true if date is in range', () => {
            const date = ValueComparator.processValue('2024-05-01', 'date');
            expect(ValueComparator.compareBetween(date, '2024-05-01,2024-05-31', 'date')).toBe(true);
        });

        it('should throw if less than 2 values provided', () => {
            expect(() => {
                ValueComparator.compareBetween(5, 'onlyOne', 'number');
            }).toThrow(InvalidArgumentError);
        });

        it('should throw if more than 2 values provided', () => {
            expect(() => {
                ValueComparator.compareBetween(5, '1,2,3', 'number');
            }).toThrow(InvalidArgumentError);
        });
    });
});
