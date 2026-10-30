import { ValidationFailError } from '../../../../src/shared';
import { ValueObjectCronExpression } from '../../../../src/shared/domain/value-object/ValueObjectCronExpression';

describe('ValueObjectCronExpression', () => {
    describe('Constructor', () => {
        it('should create instance with valid cron expression', () => {
            const cron = new ValueObjectCronExpression('testField', '0 12 * * *');
            expect(cron).toBeInstanceOf(ValueObjectCronExpression);
        });

        it('should throw error when value is null and not nullable', () => {
            expect(() => {
                new ValueObjectCronExpression('testField', null);
            }).toThrow(ValidationFailError);
        });

        it('should throw error when value is empty string and not nullable', () => {
            expect(() => {
                new ValueObjectCronExpression('testField', '');
            }).toThrow(ValidationFailError);
        });

        it('should return early when value is null and nullable', () => {
            const cron = new ValueObjectCronExpression('testField', null, true);
            expect(cron).toBeInstanceOf(ValueObjectCronExpression);
        });

        it('should return early when value is empty and nullable', () => {
            const cron = new ValueObjectCronExpression('testField', '', true);
            expect(cron).toBeInstanceOf(ValueObjectCronExpression);
        });
    });

    describe('Field count validation', () => {
        it('should accept 5 field cron expression', () => {
            expect(() => {
                new ValueObjectCronExpression('testField', '0 12 * * *');
            }).not.toThrow();
        });

        it('should accept 6 field cron expression with year', () => {
            expect(() => {
                new ValueObjectCronExpression('testField', '0 12 * * * 2024');
            }).not.toThrow();
        });

        it('should reject cron expression with less than 5 fields', () => {
            expect(() => {
                new ValueObjectCronExpression('testField', '0 12 *');
            }).toThrow('Cron expression must have 5 or 6 fields, got 3');
        });

        it('should reject cron expression with more than 6 fields', () => {
            expect(() => {
                new ValueObjectCronExpression('testField', '0 12 * * * 2024 extra');
            }).toThrow('Cron expression must have 5 or 6 fields, got 7');
        });

        it('should reject empty cron expression', () => {
            expect(() => {
                new ValueObjectCronExpression('testField', '   ');
            }).toThrow('Cron expression cannot be empty');
        });
    });

    describe('Minutes field validation', () => {
        it('should accept valid minute values', () => {
            expect(() => {
                new ValueObjectCronExpression('testField', '0 12 * * *');
            }).not.toThrow();

            expect(() => {
                new ValueObjectCronExpression('testField', '59 12 * * *');
            }).not.toThrow();
        });

        it('should accept wildcard for minutes', () => {
            expect(() => {
                new ValueObjectCronExpression('testField', '* 12 * * *');
            }).not.toThrow();
        });

        it('should reject invalid minute values', () => {
            expect(() => {
                new ValueObjectCronExpression('testField', '60 12 * * *');
            }).toThrow('minutes value 60 is out of range [0-59]');

            expect(() => {
                new ValueObjectCronExpression('testField', '-1 12 * * *');
            }).toThrow('Invalid range values in minutes: -1');
        });
    });

    describe('Hours field validation', () => {
        it('should accept valid hour values', () => {
            expect(() => {
                new ValueObjectCronExpression('testField', '0 0 * * *');
            }).not.toThrow();

            expect(() => {
                new ValueObjectCronExpression('testField', '0 23 * * *');
            }).not.toThrow();
        });

        it('should reject invalid hour values', () => {
            expect(() => {
                new ValueObjectCronExpression('testField', '0 24 * * *');
            }).toThrow('hours value 24 is out of range [0-23]');

            expect(() => {
                new ValueObjectCronExpression('testField', '0 -1 * * *');
            }).toThrow('Invalid range values in hours: -1');
        });
    });

    describe('Day of month field validation', () => {
        it('should accept valid day values', () => {
            expect(() => {
                new ValueObjectCronExpression('testField', '0 12 1 * *');
            }).not.toThrow();

            expect(() => {
                new ValueObjectCronExpression('testField', '0 12 31 * *');
            }).not.toThrow();
        });

        it('should reject invalid day values', () => {
            expect(() => {
                new ValueObjectCronExpression('testField', '0 12 0 * *');
            }).toThrow('day-of-month value 0 is out of range [1-31]');

            expect(() => {
                new ValueObjectCronExpression('testField', '0 12 32 * *');
            }).toThrow('day-of-month value 32 is out of range [1-31]');
        });
    });

    describe('Month field validation', () => {
        it('should accept valid month values', () => {
            expect(() => {
                new ValueObjectCronExpression('testField', '0 12 * 1 *');
            }).not.toThrow();

            expect(() => {
                new ValueObjectCronExpression('testField', '0 12 * 12 *');
            }).not.toThrow();
        });

        it('should reject invalid month values', () => {
            expect(() => {
                new ValueObjectCronExpression('testField', '0 12 * 0 *');
            }).toThrow('month value 0 is out of range [1-12]');

            expect(() => {
                new ValueObjectCronExpression('testField', '0 12 * 13 *');
            }).toThrow('month value 13 is out of range [1-12]');
        });
    });

    describe('Day of week field validation', () => {
        it('should accept valid day of week values', () => {
            expect(() => {
                new ValueObjectCronExpression('testField', '0 12 * * 0');
            }).not.toThrow();

            expect(() => {
                new ValueObjectCronExpression('testField', '0 12 * * 7');
            }).not.toThrow();
        });

        it('should reject invalid day of week values', () => {
            expect(() => {
                new ValueObjectCronExpression('testField', '0 12 * * 8');
            }).toThrow('day-of-week value 8 is out of range [0-7]');

            expect(() => {
                new ValueObjectCronExpression('testField', '0 12 * * -1');
            }).toThrow('Invalid range values in day-of-week: -1');
        });
    });

    describe('Year field validation', () => {
        it('should accept valid year values', () => {
            expect(() => {
                new ValueObjectCronExpression('testField', '0 12 * * * 1970');
            }).not.toThrow();

            expect(() => {
                new ValueObjectCronExpression('testField', '0 12 * * * 2099');
            }).not.toThrow();
        });

        it('should reject invalid year values', () => {
            expect(() => {
                new ValueObjectCronExpression('testField', '0 12 * * * 1969');
            }).toThrow('year value 1969 is out of range [1970-2099]');

            expect(() => {
                new ValueObjectCronExpression('testField', '0 12 * * * 2100');
            }).toThrow('year value 2100 is out of range [1970-2099]');
        });
    });

    describe('Range validation', () => {
        it('should accept valid ranges', () => {
            expect(() => {
                new ValueObjectCronExpression('testField', '0-30 12 * * *');
            }).not.toThrow();

            expect(() => {
                new ValueObjectCronExpression('testField', '0 9-17 * * *');
            }).not.toThrow();
        });

        it('should reject invalid range format', () => {
            expect(() => {
                new ValueObjectCronExpression('testField', '0-30-45 12 * * *');
            }).toThrow('Invalid range format in minutes: 0-30-45');
        });

        it('should reject ranges with invalid values', () => {
            expect(() => {
                new ValueObjectCronExpression('testField', '0-abc 12 * * *');
            }).toThrow('Invalid range values in minutes: 0-abc');
        });

        it('should reject ranges where start > end', () => {
            expect(() => {
                new ValueObjectCronExpression('testField', '30-15 12 * * *');
            }).toThrow('Invalid range in minutes: start (30) must be <= end (15)');
        });

        it('should reject ranges with out-of-bound values', () => {
            expect(() => {
                new ValueObjectCronExpression('testField', '0-60 12 * * *');
            }).toThrow('minutes value 60 is out of range [0-59]');
        });
    });

    describe('Step validation', () => {
        it('should accept valid step expressions', () => {
            expect(() => {
                new ValueObjectCronExpression('testField', '*/5 12 * * *');
            }).not.toThrow();

            expect(() => {
                new ValueObjectCronExpression('testField', '10/5 12 * * *');
            }).not.toThrow();
        });

        it('should reject invalid step format', () => {
            expect(() => {
                new ValueObjectCronExpression('testField', '*/5/10 12 * * *');
            }).toThrow('Invalid step format in minutes: */5/10');
        });

        it('should reject invalid step values', () => {
            expect(() => {
                new ValueObjectCronExpression('testField', '*/0 12 * * *');
            }).toThrow('Invalid step value in minutes: 0');

            expect(() => {
                new ValueObjectCronExpression('testField', '*/abc 12 * * *');
            }).toThrow('Invalid step value in minutes: abc');
        });

        it('should reject negative step values', () => {
            expect(() => {
                new ValueObjectCronExpression('testField', '*/-5 12 * * *');
            }).toThrow('Invalid range values in minutes: */-5');
        });
    });

    describe('List validation', () => {
        it('should accept valid list expressions', () => {
            expect(() => {
                new ValueObjectCronExpression('testField', '0,15,30,45 12 * * *');
            }).not.toThrow();
        });

        it('should reject lists with invalid values', () => {
            expect(() => {
                new ValueObjectCronExpression('testField', '0,60 12 * * *');
            }).toThrow('minutes value 60 is out of range [0-59]');

            expect(() => {
                new ValueObjectCronExpression('testField', '0,abc 12 * * *');
            }).toThrow('Invalid numeric value in minutes: abc');
        });
    });

    describe('Non-numeric values', () => {
        it('should reject non-numeric single values', () => {
            expect(() => {
                new ValueObjectCronExpression('testField', 'abc 12 * * *');
            }).toThrow('Invalid numeric value in minutes: abc');
        });

        it('should reject special characters', () => {
            expect(() => {
                new ValueObjectCronExpression('testField', '@ 12 * * *');
            }).toThrow('Invalid numeric value in minutes: @');
        });
    });

    describe('Whitespace handling', () => {
        it('should handle extra whitespace', () => {
            expect(() => {
                new ValueObjectCronExpression('testField', '  0   12   *   *   *  ');
            }).not.toThrow();
        });

        it('should handle tabs', () => {
            expect(() => {
                new ValueObjectCronExpression('testField', '0\t12\t*\t*\t*');
            }).not.toThrow();
        });

        it('should handle mixed whitespace', () => {
            expect(() => {
                new ValueObjectCronExpression('testField', '0  12    *  *    *');
            }).not.toThrow();
        });
    });

    describe('getFields method', () => {
        it('should return correct fields for 5-field expression', () => {
            const cron = new ValueObjectCronExpression('testField', '0 12 15 6 1');

            const fields = cron.getFields();
            expect(fields).toEqual({
                minutes: '0',
                hours: '12',
                dayOfMonth: '15',
                month: '6',
                dayOfWeek: '1',
            });
        });

        it('should return correct fields for 6-field expression with year', () => {
            const cron = new ValueObjectCronExpression('testField', '0 12 15 6 1 2024');

            const fields = cron.getFields();
            expect(fields).toEqual({
                minutes: '0',
                hours: '12',
                dayOfMonth: '15',
                month: '6',
                dayOfWeek: '1',
                year: '2024',
            });
        });
    });

    describe('getDescription method', () => {
        it('should generate description for basic expression', () => {
            const cron = new ValueObjectCronExpression('testField', '30 14 * * *');

            const description = cron.getDescription();
            expect(description).toBe('At 30 minutes past 14 hour(s)');
        });

        it('should include day of month in description', () => {
            const cron = new ValueObjectCronExpression('testField', '0 12 15 * *');

            const description = cron.getDescription();
            expect(description).toBe('At 0 minutes past 12 hour(s) on day 15 of the month');
        });

        it('should include month in description', () => {
            const cron = new ValueObjectCronExpression('testField', '0 12 * 6 *');

            const description = cron.getDescription();
            expect(description).toBe('At 0 minutes past 12 hour(s) in month 6');
        });

        it('should include day of week in description', () => {
            const cron = new ValueObjectCronExpression('testField', '0 12 * * 1');

            const description = cron.getDescription();
            expect(description).toBe('At 0 minutes past 12 hour(s) on 1 day(s) of the week');
        });

        it('should include year in description', () => {
            const cron = new ValueObjectCronExpression('testField', '0 12 * * * 2024');

            const description = cron.getDescription();
            expect(description).toBe('At 0 minutes past 12 hour(s) in year 2024');
        });

        it('should generate complete description', () => {
            const cron = new ValueObjectCronExpression('testField', '30 14 15 6 1 2024');

            const description = cron.getDescription();
            expect(description).toBe(
                'At 30 minutes past 14 hour(s) on day 15 of the month in month 6 on 1 day(s) of the week in year 2024'
            );
        });
    });

    describe('isValid static method', () => {
        it('should return true for valid expressions', () => {
            expect(ValueObjectCronExpression.isValid('0 12 * * *')).toBe(true);
            expect(ValueObjectCronExpression.isValid('*/15 * * * *')).toBe(true);
            expect(ValueObjectCronExpression.isValid('0 9-17 * * 1-5')).toBe(true);
            expect(ValueObjectCronExpression.isValid('0,30 * * * *')).toBe(true);
            expect(ValueObjectCronExpression.isValid('0 12 * * * 2024')).toBe(true);
        });

        it('should return false for invalid expressions', () => {
            expect(ValueObjectCronExpression.isValid('60 12 * * *')).toBe(false);
            expect(ValueObjectCronExpression.isValid('* 25 * * *')).toBe(false);
            expect(ValueObjectCronExpression.isValid('* * 32 * *')).toBe(false);
            expect(ValueObjectCronExpression.isValid('* * * 13 *')).toBe(false);
            expect(ValueObjectCronExpression.isValid('* * * * 8')).toBe(false);
            expect(ValueObjectCronExpression.isValid('')).toBe(false);
            expect(ValueObjectCronExpression.isValid('* *')).toBe(false);
            expect(ValueObjectCronExpression.isValid('* * * * * * *')).toBe(false);
        });

        it('should return false for null/undefined expressions', () => {
            expect(ValueObjectCronExpression.isValid(null)).toBe(false);
            expect(ValueObjectCronExpression.isValid(undefined)).toBe(false);
        });
    });

    describe('Edge cases and error scenarios', () => {
        it('should handle leading zeros in numbers', () => {
            expect(() => {
                new ValueObjectCronExpression('testField', '05 012 * * *');
            }).not.toThrow();
        });

        it('should handle empty parts in lists', () => {
            expect(() => {
                new ValueObjectCronExpression('testField', '0, ,30 12 * * *');
            }).toThrow();
        });

        it('should handle complex expressions', () => {
            expect(() => {
                new ValueObjectCronExpression('testField', '0,15,30,45 9-17 * * 1-5');
            }).not.toThrow();
        });

        it('should handle step expressions with ranges', () => {
            expect(() => {
                new ValueObjectCronExpression('testField', '0-30/5 * * * *');
            }).not.toThrow();
        });

        it('should reject malformed expressions gracefully', () => {
            const malformedExpressions = [
                '@ # $ % ^',
                '1,2,3,',
                ',1,2,3',
                '1,,3',
                '10-',
                '-10',
                '10--20',
                '*/',
                '/5',
                '*//',
                'L W # ?',
            ];

            malformedExpressions.forEach((expr) => {
                expect(() => {
                    new ValueObjectCronExpression('testField', expr);
                }).toThrow();
            });
        });
    });
});
