import { jest } from '@jest/globals';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import {
    dateFunctions,
    fromUTCToLocal,
    fromLocalToUTC,
} from '../../../../src/shared/calculator/functions/dateFunctions.js';
import { ValidationFailError } from '../../../../src/shared/errors/ValidationFailError.js';
import { TenantContext } from '../../../../src/shared/infrastructure/context/TenantContext.js';

dayjs.extend(utc);

describe('dateFunctions', () => {
    const baseDate = '2025-10-17T00:00:00Z';

    describe('addDays / subDays', () => {
        it('addDays with timezone param outputs in that timezone', () => {
            expect(dateFunctions.addDays(baseDate, 5, 'America/Mexico_City')).toBe('2025-10-21T18:00:00.000-06:00');
        });

        it('addDays interprets date without timezone using timezone param and outputs in that timezone', () => {
            expect(dateFunctions.addDays('2025-10-17 00:00:00', 5, 'America/Mexico_City')).toBe(
                '2025-10-22T00:00:00.000-06:00'
            );
        });

        it('addDays interprets date-only using timezone param and outputs in that timezone', () => {
            expect(dateFunctions.addDays('2025-10-17', 5, 'America/Mexico_City')).toBe('2025-10-22T00:00:00.000-06:00');
        });

        it('addDays respects embedded offset and outputs in provided timezone', () => {
            expect(dateFunctions.addDays('2025-10-17T00:00:00-06:00', 5, 'America/Mexico_City')).toBe(
                '2025-10-22T00:00:00.000-06:00'
            );
        });

        it('addDays respects embedded offset and converts to different timezone', () => {
            expect(dateFunctions.addDays('2025-10-17T00:00:00-06:00', 5, 'America/Bogota')).toBe(
                '2025-10-22T01:00:00.000-05:00'
            );
        });

        it('addDays without timezone return in utc', () => {
            expect(dateFunctions.addDays('2025-10-17T00:00:00', 5)).toBe('2025-10-22T00:00:00.000Z');
        });

        it('addDays with timezone return in utc', () => {
            expect(dateFunctions.addDays('2025-10-17T00:00:00-06:00', 5)).toBe('2025-10-22T06:00:00.000Z');
        });

        it('subDays subtracts days correctly', () => {
            expect(dateFunctions.subDays(baseDate, 5)).toBe('2025-10-12T00:00:00.000Z');
        });

        it('addDays crosses month boundary', () => {
            expect(dateFunctions.addDays('2025-01-31T00:00:00Z', 1)).toBe('2025-02-01T00:00:00.000Z');
        });

        it('subDays crosses month boundary backwards', () => {
            expect(dateFunctions.subDays('2025-03-01T00:00:00Z', 1)).toBe('2025-02-28T00:00:00.000Z');
        });
    });

    describe('addMonths / subMonths', () => {
        it('addMonths adds months correctly', () => {
            expect(dateFunctions.addMonths(baseDate, 2)).toBe('2025-12-17T00:00:00.000Z');
        });

        it('subMonths subtracts months correctly', () => {
            expect(dateFunctions.subMonths(baseDate, 2)).toBe('2025-08-17T00:00:00.000Z');
        });
    });

    describe('addYears / subYears', () => {
        it('addYears adds years correctly', () => {
            const result = dateFunctions.addYears(baseDate, 3);
            expect(dayjs.utc(result).year()).toBe(2028);
            expect(dayjs.utc(result).month()).toBe(9);
            expect(dayjs.utc(result).date()).toBe(17);
        });

        it('subYears subtracts years correctly', () => {
            const result = dateFunctions.subYears(baseDate, 3);
            expect(dayjs.utc(result).year()).toBe(2022);
            expect(dayjs.utc(result).month()).toBe(9);
            expect(dayjs.utc(result).date()).toBe(17);
        });

        it('addYears handles leap year (Feb 29 → Feb 28)', () => {
            const leapDate = '2024-02-29T00:00:00Z';
            const result = dateFunctions.addYears(leapDate, 1);
            expect(dayjs.utc(result).month()).toBe(1);
            expect(dayjs.utc(result).date()).toBe(28);
        });
    });

    describe('startOfMonth / endOfMonth', () => {
        it('startOfMonth returns first day of month', () => {
            expect(dateFunctions.startOfMonth(baseDate)).toBe('2025-10-01T00:00:00.000Z');
        });

        it('endOfMonth returns last day of month', () => {
            expect(dateFunctions.endOfMonth(baseDate)).toBe('2025-10-31T23:59:59.999Z');
        });

        it('endOfMonth handles February in leap year', () => {
            expect(dateFunctions.endOfMonth('2024-02-15T00:00:00Z')).toBe('2024-02-29T23:59:59.999Z');
        });

        it('endOfMonth handles February in non-leap year', () => {
            expect(dateFunctions.endOfMonth('2025-02-15T00:00:00Z')).toBe('2025-02-28T23:59:59.999Z');
        });
    });

    describe('diffDays', () => {
        it('calculates difference in full days correctly', () => {
            const a = '2025-10-20T00:00:00Z';
            const b = '2025-10-17T00:00:00Z';
            expect(dateFunctions.diffDays(a, b)).toBe(3);

            const c = '2025-10-15T00:00:00Z';
            expect(dateFunctions.diffDays(c, b)).toBe(-2);
        });

        it('returns 0 for same date', () => {
            expect(dateFunctions.diffDays(baseDate, baseDate)).toBe(0);
        });

        it('handles cross-month difference', () => {
            expect(dateFunctions.diffDays('2025-11-01T00:00:00Z', '2025-10-30T00:00:00Z')).toBe(2);
        });
    });

    describe('addMinutes', () => {
        it('addMinutes adds minutes correctly', () => {
            const result = dateFunctions.addMinutes(baseDate, 90);
            const d = dayjs.utc(result);

            expect(d.hour()).toBe(1);
            expect(d.minute()).toBe(30);
        });
    });

    describe('subMinutes', () => {
        it('subMinutes subtracts minutes correctly', () => {
            const result = dateFunctions.subMinutes(baseDate, 30);
            const d = dayjs.utc(result);

            expect(d.hour()).toBe(23);
            expect(d.minute()).toBe(30);
        });
    });

    describe('addHours', () => {
        it('addHours adds hours correctly', () => {
            const result = dateFunctions.addHours(baseDate, 5);
            const d = dayjs.utc(result);

            expect(d.hour()).toBe(5);
            expect(d.date()).toBe(17);
        });
    });

    describe('subHours', () => {
        it('subHours subtracts hours correctly', () => {
            const result = dateFunctions.subHours(baseDate, 3);
            const d = dayjs.utc(result);

            expect(d.hour()).toBe(21);
            expect(d.date()).toBe(16);
        });
    });

    describe('now', () => {
        it('returns current date in UTC ISO format', () => {
            const result = dateFunctions.now();
            const d = dayjs.utc(result);

            expect(d.isValid()).toBe(true);
            expect(result.endsWith('Z')).toBe(true);
        });
    });

    describe('date-only string normalization', () => {
        it('addDays handles date-only string input', () => {
            expect(dateFunctions.addDays('2025-10-17', 1)).toBe('2025-10-18T00:00:00.000Z');
        });

        it('diffDays handles date-only strings', () => {
            expect(dateFunctions.diffDays('2025-10-20', '2025-10-17')).toBe(3);
        });

        it('startOfMonth handles date-only string', () => {
            expect(dateFunctions.startOfMonth('2025-10-17')).toBe('2025-10-01T00:00:00.000Z');
        });

        it('subMonths handles date-only string', () => {
            expect(dateFunctions.subMonths('2025-10-17', 1)).toBe('2025-09-17T00:00:00.000Z');
        });
    });

    describe('numeric timestamp normalization', () => {
        it('addDays handles numeric string timestamp', () => {
            const ts = '1729123200000';
            const result = dateFunctions.addDays(ts, 1);
            expect(dayjs.utc(result).date()).toBe(18);
        });

        it('addDays handles numeric timestamp (number type)', () => {
            const ts = 1729123200000;
            const result = dateFunctions.addDays(ts, 1);
            expect(dayjs.utc(result).date()).toBe(18);
        });

        it('diffDays handles numeric timestamps', () => {
            const a = 1729123200000;
            const b = 1729036800000;
            expect(dateFunctions.diffDays(a, b)).toBe(1);
        });
    });

    describe('ISO string with milliseconds', () => {
        it('addDays handles ISO string with milliseconds', () => {
            const isoMs = '2025-10-17T12:30:45.123Z';
            const result = dateFunctions.addDays(isoMs, 1);
            const d = dayjs.utc(result);

            expect(d.date()).toBe(18);
            expect(d.hour()).toBe(12);
            expect(d.minute()).toBe(30);
        });
    });

    describe('fromUTCToLocal', () => {
        let tenantSpy;

        afterEach(() => {
            if (tenantSpy) tenantSpy.mockRestore();
        });

        it('converts UTC to tenant timezone', () => {
            tenantSpy = jest.spyOn(TenantContext, 'getTenant').mockReturnValue({
                timezone: { value: 'America/New_York' },
            });

            const result = fromUTCToLocal('2025-10-17T15:00:00Z');
            expect(result.hour()).toBe(11);
            expect(result.date()).toBe(17);
        });

        it('uses fallback timezone (America/Bogota) when tenant has no timezone', () => {
            tenantSpy = jest.spyOn(TenantContext, 'getTenant').mockReturnValue(undefined);

            const result = fromUTCToLocal('2025-10-17T15:00:00Z');
            expect(result.hour()).toBe(10);
        });

        it('throws ValidationFailError for invalid date', () => {
            tenantSpy = jest.spyOn(TenantContext, 'getTenant').mockReturnValue(undefined);

            expect(() => fromUTCToLocal('not-a-date')).toThrow(ValidationFailError);
        });

        it('handles date-only string input', () => {
            tenantSpy = jest.spyOn(TenantContext, 'getTenant').mockReturnValue({
                timezone: { value: 'America/Bogota' },
            });

            const result = fromUTCToLocal('2025-10-17');
            expect(result.date()).toBe(16);
            expect(result.hour()).toBe(19);
        });
    });

    describe('fromLocalToUTC', () => {
        let tenantSpy;

        afterEach(() => {
            if (tenantSpy) tenantSpy.mockRestore();
        });

        it('converts local time to UTC', () => {
            tenantSpy = jest.spyOn(TenantContext, 'getTenant').mockReturnValue({
                timezone: { value: 'America/New_York' },
            });

            const result = fromLocalToUTC('2025-10-17T11:00:00');
            expect(result.hour()).toBe(15);
        });

        it('uses fallback timezone (America/Bogota) when tenant has no timezone', () => {
            tenantSpy = jest.spyOn(TenantContext, 'getTenant').mockReturnValue(undefined);

            const result = fromLocalToUTC('2025-10-17T10:00:00');
            expect(result.hour()).toBe(15);
        });

        it('throws ValidationFailError for invalid date', () => {
            tenantSpy = jest.spyOn(TenantContext, 'getTenant').mockReturnValue(undefined);

            expect(() => fromLocalToUTC('invalid-date')).toThrow(ValidationFailError);
        });
    });

    describe('validation errors', () => {
        const invalidDate = 'not-a-date';
        const validDate = '2025-10-17T00:00:00Z';

        it('throws ValidationFailError for invalid date string', () => {
            expect(() => dateFunctions.addDays('not-a-date', 1)).toThrow('Invalid date');
        });

        it('throws ValidationFailError for invalid number', () => {
            expect(() => dateFunctions.addDays('2025-10-17', 'abc')).toThrow('Invalid number');
        });

        describe('addMonths', () => {
            it('throws for invalid date', () => {
                expect(() => dateFunctions.addMonths(invalidDate, 1)).toThrow(ValidationFailError);
            });

            it('throws for invalid number', () => {
                expect(() => dateFunctions.addMonths(validDate, 'x')).toThrow(ValidationFailError);
            });
        });

        describe('addYears', () => {
            it('throws for invalid date', () => {
                expect(() => dateFunctions.addYears(invalidDate, 1)).toThrow(ValidationFailError);
            });

            it('throws for invalid number', () => {
                expect(() => dateFunctions.addYears(validDate, null)).toThrow(ValidationFailError);
            });
        });

        describe('subDays', () => {
            it('throws for invalid date', () => {
                expect(() => dateFunctions.subDays(invalidDate, 1)).toThrow(ValidationFailError);
            });

            it('throws for invalid number', () => {
                expect(() => dateFunctions.subDays(validDate, undefined)).toThrow(ValidationFailError);
            });
        });

        describe('subMonths', () => {
            it('throws for invalid date', () => {
                expect(() => dateFunctions.subMonths(invalidDate, 1)).toThrow(ValidationFailError);
            });

            it('throws for invalid number', () => {
                expect(() => dateFunctions.subMonths(validDate, 'x')).toThrow(ValidationFailError);
            });
        });

        describe('subYears', () => {
            it('throws for invalid date', () => {
                expect(() => dateFunctions.subYears(invalidDate, 1)).toThrow(ValidationFailError);
            });

            it('throws for invalid number', () => {
                expect(() => dateFunctions.subYears(validDate, NaN)).toThrow(ValidationFailError);
            });
        });

        describe('addHours', () => {
            it('throws for invalid date', () => {
                expect(() => dateFunctions.addHours(invalidDate, 1)).toThrow(ValidationFailError);
            });

            it('throws for invalid number', () => {
                expect(() => dateFunctions.addHours(validDate, 'x')).toThrow(ValidationFailError);
            });
        });

        describe('addMinutes', () => {
            it('throws for invalid date', () => {
                expect(() => dateFunctions.addMinutes(invalidDate, 1)).toThrow(ValidationFailError);
            });

            it('throws for invalid number', () => {
                expect(() => dateFunctions.addMinutes(validDate, false)).toThrow(ValidationFailError);
            });
        });

        describe('subHours', () => {
            it('throws for invalid date', () => {
                expect(() => dateFunctions.subHours(invalidDate, 1)).toThrow(ValidationFailError);
            });

            it('throws for invalid number', () => {
                expect(() => dateFunctions.subHours(validDate, 'x')).toThrow(ValidationFailError);
            });
        });

        describe('subMinutes', () => {
            it('throws for invalid date', () => {
                expect(() => dateFunctions.subMinutes(invalidDate, 1)).toThrow(ValidationFailError);
            });

            it('throws for invalid number', () => {
                expect(() => dateFunctions.subMinutes(validDate, {})).toThrow(ValidationFailError);
            });
        });

        describe('startOfMonth', () => {
            it('throws for invalid date', () => {
                expect(() => dateFunctions.startOfMonth(invalidDate)).toThrow(ValidationFailError);
            });
        });

        describe('endOfMonth', () => {
            it('throws for invalid date', () => {
                expect(() => dateFunctions.endOfMonth(invalidDate)).toThrow(ValidationFailError);
            });
        });

        describe('diffDays', () => {
            it('throws when first date is invalid', () => {
                expect(() => dateFunctions.diffDays(invalidDate, validDate)).toThrow(ValidationFailError);
            });

            it('throws when second date is invalid', () => {
                expect(() => dateFunctions.diffDays(validDate, invalidDate)).toThrow(ValidationFailError);
            });

            it('throws when both dates are invalid', () => {
                expect(() => dateFunctions.diffDays(invalidDate, 'also-bad')).toThrow(ValidationFailError);
            });
        });
    });
});
