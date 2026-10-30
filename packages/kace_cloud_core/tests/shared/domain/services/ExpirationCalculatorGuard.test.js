import { ExpirationCalculator } from '../../../../src/shared/domain/services/ExpirationCalculator.js';
import dayjs from 'dayjs';

// Regression: a shift with no working days (or an ANS remainder that lands exactly on the
// `remainingTime === 1` hole) makes ExpirationCalculator's while loops never terminate, freezing
// the single Node event loop until the ECS health check kills the task ~30 min later. The loops
// must bound their iterations and fail loudly instead of hanging, so the bad case can be skipped.
const makeItems = (medicion, vencido, workDays = {}) => ({
    ans: { medicion_ans_id: { value: medicion }, vencido: { value: vencido } },
    shift: { holiday_dates: { value: [] }, work_days: { value: workDays } },
});

describe('ExpirationCalculator — infinite-loop guard', () => {
    const ref = '2026-06-01T10:00:00Z';
    const now = dayjs('2026-06-03T10:00:00Z');

    it('throws instead of hanging when the shift has no working days (Minutes)', () => {
        expect(() => new ExpirationCalculator(makeItems('Minutes', 60, {}), now, ref)).toThrow(/iteration/i);
    });

    it('throws instead of hanging when the shift has no working days (Hours)', () => {
        expect(() => new ExpirationCalculator(makeItems('Hours', 5, {}), now, ref)).toThrow(/iteration/i);
    });

    it('throws instead of hanging when the shift has no working days (Days)', () => {
        expect(() => new ExpirationCalculator(makeItems('Days', 3, {}), now, ref)).toThrow(/iteration/i);
    });
});
