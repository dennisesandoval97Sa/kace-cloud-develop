import { ExpirationCalculator } from '../../../../src/shared/domain/services/ExpirationCalculator.js';
import createDayjsInstance from '../../../../src/shared/factories/DayjsFactory.js';

const dayjs = createDayjsInstance({});

// Real shift-management rows pulled from production (kace.shift_management). The goal is to prove
// these actual configs compute a valid expiration without hanging (infinite loop) or tripping the
// MAX_EXPIRATION_ITERATIONS guard. The Monday-only "test" shift is the realistic edge: it has very
// few working days, so the loops must still terminate.
const SHIFTS = {
    // 3824c61a / c28431e9 — "Horario inicial": Mon–Fri 09:00–17:00
    monToFri: {
        friday: { end: '17:00', start: '09:00' },
        monday: { end: '17:00', start: '09:00' },
        tuesday: { end: '17:00', start: '09:00' },
        thursday: { end: '17:00', start: '09:00' },
        wednesday: { end: '17:00', start: '09:00' },
    },
    // c9add33c — "Conf general horario": all 7 days 00:00–23:59
    full247: {
        friday: { end: '23:59', start: '00:00' },
        monday: { end: '23:59', start: '00:00' },
        sunday: { end: '23:59', start: '00:00' },
        tuesday: { end: '23:59', start: '00:00' },
        saturday: { end: '23:59', start: '00:00' },
        thursday: { end: '23:59', start: '00:00' },
        wednesday: { end: '23:59', start: '00:00' },
    },
    // 11f8e157 — "test": ONLY monday 08:00–18:00
    mondayOnly: { monday: { end: '18:00', start: '08:00' } },
};

const HOLIDAYS_INICIAL = ['2024-09-03', '2024-12-29'];
const HOLIDAYS_247 = [
    '2025-10-13',
    '2025-11-03',
    '2025-11-17',
    '2025-12-08',
    '2025-12-25',
    '2026-01-01',
    '2026-01-12',
    '2026-03-23',
    '2026-04-02',
    '2026-04-03',
    '2026-05-01',
    '2026-05-18',
    '2026-06-08',
    '2026-06-15',
    '2026-06-29',
    '2026-07-20',
    '2026-08-07',
    '2026-08-17',
    '2026-10-12',
    '2026-11-02',
    '2026-11-16',
    '2026-12-08',
    '2026-12-25',
];

const WEEKDAY_NUM = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };
const workingDayNumbers = (workDays) => Object.keys(workDays).map((d) => WEEKDAY_NUM[d]);

const makeItems = (medicion, vencido, workDays, holidays = []) => ({
    ans: { medicion_ans_id: { value: medicion }, vencido: { value: vencido } },
    shift: { holiday_dates: { value: holidays }, work_days: { value: workDays } },
});

// Reference (case created) on Monday 2026-06-01 10:00 UTC; "now" a week later.
const REF = '2026-06-01T10:00:00.000Z';
const NOW = dayjs('2026-06-08T10:00:00.000Z');

const expectValidExpiration = (items, { workDays, holidays }) => {
    let calc;
    expect(() => {
        calc = new ExpirationCalculator(items, NOW, REF);
    }).not.toThrow();

    const expiredAt = dayjs(calc.expiredAt);
    expect(expiredAt.isValid()).toBe(true);
    expect(expiredAt.isAfter(dayjs(REF))).toBe(true);

    // The expiration must land on a working day that is not a holiday.
    const allowed = workingDayNumbers(workDays);
    expect(allowed).toContain(expiredAt.day());
    expect(holidays).not.toContain(expiredAt.format('YYYY-MM-DD'));
};

describe('ExpirationCalculator — production shift configurations', () => {
    describe('Mon–Fri 09:00–17:00 (Horario inicial)', () => {
        for (const [medicion, vencido] of [
            ['Days', 3],
            ['Hours', 5],
            ['Minutes', 90],
        ]) {
            it(`computes a valid expiration for ${medicion}=${vencido}`, () => {
                expectValidExpiration(makeItems(medicion, vencido, SHIFTS.monToFri, HOLIDAYS_INICIAL), {
                    workDays: SHIFTS.monToFri,
                    holidays: HOLIDAYS_INICIAL,
                });
            });
        }
    });

    describe('24/7 with holidays (Conf general horario)', () => {
        for (const [medicion, vencido] of [
            ['Days', 2],
            ['Hours', 10],
            ['Minutes', 480],
        ]) {
            it(`computes a valid expiration for ${medicion}=${vencido}`, () => {
                expectValidExpiration(makeItems(medicion, vencido, SHIFTS.full247, HOLIDAYS_247), {
                    workDays: SHIFTS.full247,
                    holidays: HOLIDAYS_247,
                });
            });
        }
    });

    describe('Minutes ANS that leaves a 1-minute remainder (regression: used to infinite-loop)', () => {
        // Mon–Fri 09:00–17:00 = 480 working minutes/day. A vencido of 480·N + 1 lands exactly on
        // the old `remainingTime === 1` hole. These must now compute a valid expiration, not hang
        // and not be skipped by the iteration guard.
        for (const vencido of [481, 961, 1441]) {
            it(`computes a valid expiration for Minutes=${vencido}`, () => {
                expectValidExpiration(makeItems('Minutes', vencido, SHIFTS.monToFri, HOLIDAYS_INICIAL), {
                    workDays: SHIFTS.monToFri,
                    holidays: HOLIDAYS_INICIAL,
                });
            });
        }
    });

    describe('Monday-only 08:00–18:00 (test) — the realistic edge', () => {
        for (const [medicion, vencido] of [
            ['Days', 2],
            ['Hours', 4],
            ['Minutes', 120],
        ]) {
            it(`terminates and computes a valid expiration for ${medicion}=${vencido}`, () => {
                expectValidExpiration(makeItems(medicion, vencido, SHIFTS.mondayOnly, []), {
                    workDays: SHIFTS.mondayOnly,
                    holidays: [],
                });
            });
        }
    });
});
