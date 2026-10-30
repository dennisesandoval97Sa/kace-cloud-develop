import { Frequency } from '../../../src/csv-export-views/domain/Frequency.js';

describe('Frequency', () => {
    describe('fromValue', () => {
        it('returns the matching singleton for each known value', () => {
            expect(Frequency.fromValue('hours')).toBe(Frequency.HOURS);
            expect(Frequency.fromValue('days')).toBe(Frequency.DAYS);
            expect(Frequency.fromValue('weeks')).toBe(Frequency.WEEKS);
            expect(Frequency.fromValue('months')).toBe(Frequency.MONTHS);
        });

        it('throws for an unknown value', () => {
            expect(() => Frequency.fromValue('years')).toThrow('Invalid frequency value: years');
        });
    });

    describe('constructor validation', () => {
        it('throws when constructed with a value outside the known set', () => {
            expect(() => new Frequency('CUSTOM', 'fortnights')).toThrow(
                'The value must be a valid Frequency value: fortnights'
            );
        });
    });

    describe('toJson', () => {
        it('serializes every static Frequency instance to {KEY: value}', () => {
            const json = Frequency.toJson();

            expect(json).toEqual({
                HOURS: 'hours',
                DAYS: 'days',
                WEEKS: 'weeks',
                MONTHS: 'months',
            });
        });

        it('skips static members that are not Frequency instances', () => {
            // Frequency only ever exposes Frequency-instance static fields in production, so the
            // `instanceof Frequency` false branch in toJson()'s filter has nothing else to hit it
            // through the public API. Adding then removing a non-Frequency static property is the
            // only way to exercise that branch without touching src/.
            Frequency.NOT_A_FREQUENCY = 'plain-string';
            try {
                const json = Frequency.toJson();
                expect(json).not.toHaveProperty('NOT_A_FREQUENCY');
                expect(json).toEqual({
                    HOURS: 'hours',
                    DAYS: 'days',
                    WEEKS: 'weeks',
                    MONTHS: 'months',
                });
            } finally {
                delete Frequency.NOT_A_FREQUENCY;
            }
        });
    });
});
