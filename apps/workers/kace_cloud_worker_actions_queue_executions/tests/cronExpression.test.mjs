import { parseCronExpression, firesBetween } from '../src/cronExpression.mjs';

describe('parseCronExpression', () => {
    it.each(['* * * * *', '*/5 * * * *', '2-59/5 * * * *'])('accepts %s', (expression) => {
        expect(parseCronExpression(expression, 'X').getPattern()).toBe(expression);
    });

    it.each([
        ['bad'],
        ['61 * * * *'],
        ['* * *'],
        [''],
        [5],
        [null],
        ['2026-01-01T00:00:00'],
        ['*/30 * * * * *'],
        ['0 0 31 2 *'],
    ])('rejects %p naming the setting', (expression) => {
        expect(() => parseCronExpression(expression, 'CRON_EXPRESSION')).toThrow(
            /CRON_EXPRESSION must be a valid cron expression/
        );
    });
});

describe('firesBetween', () => {
    const every5From2 = parseCronExpression('2-59/5 * * * *', 'X');
    const at = (iso) => new Date(iso);

    it.each([
        ['on time', '2026-10-21T10:01:00.040Z', '2026-10-21T10:02:00.050Z', true],
        ['tick that arrives late', '2026-10-21T10:01:00.040Z', '2026-10-21T10:03:20.000Z', true],
        ['fire time exactly at the upper bound', '2026-10-21T10:01:00.000Z', '2026-10-21T10:02:00.000Z', true],
        [
            'fire time exactly at the lower bound (already evaluated)',
            '2026-10-21T10:02:00.000Z',
            '2026-10-21T10:03:00.000Z',
            false,
        ],
        ['tick slightly before the fire time', '2026-10-21T10:01:00.000Z', '2026-10-21T10:01:59.998Z', false],
        ['minute without a fire time', '2026-10-21T10:02:00.050Z', '2026-10-21T10:03:00.050Z', false],
    ])('%s', (_label, since, until, expected) => {
        expect(firesBetween(every5From2, at(since), at(until))).toBe(expected);
    });
});
