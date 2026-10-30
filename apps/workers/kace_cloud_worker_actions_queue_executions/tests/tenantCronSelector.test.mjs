import { jest } from '@jest/globals';

const fakeLogError = jest.fn();
jest.unstable_mockModule('@kace/core/src/shared/index.js', () => ({
    Helper: { logError: fakeLogError, logInfo: jest.fn(), logDebug: jest.fn() },
}));

const { FAST_SCHEDULE, ANS_SCHEDULE, BACKLOG_SCHEDULE, resolveTenantCron, createTenantCronSelector } =
    await import('../src/tenantCronSelector.mjs');

const tenant = (id, settings = {}) => ({
    id: { value: id },
    ...Object.fromEntries(Object.entries(settings).map(([field, value]) => [field, { value }])),
});
const at = (iso) => new Date(`2026-10-21T${iso}Z`);

describe('resolveTenantCron', () => {
    it('keeps the previous env defaults', () => {
        expect(FAST_SCHEDULE.defaultExpression).toBe('* * * * *');
        expect(ANS_SCHEDULE.defaultExpression).toBe('*/5 * * * *');
        expect(BACKLOG_SCHEDULE.defaultExpression).toBe('2-59/5 * * * *');
    });

    it.each([undefined, null, ''])('uses the default when the tenant has no value (%p)', (absent) => {
        const cron = resolveTenantCron(tenant('t', { [ANS_SCHEDULE.field]: absent }), ANS_SCHEDULE);
        expect(cron.getPattern()).toBe('*/5 * * * *');
    });

    it('uses the tenant value', () => {
        const cron = resolveTenantCron(tenant('t', { [FAST_SCHEDULE.field]: '*/2 * * * *' }), FAST_SCHEDULE);
        expect(cron.getPattern()).toBe('*/2 * * * *');
    });

    it.each(['61 * * * *', 'bad', 5])('rejects %p naming the tenant field', (value) => {
        expect(() => resolveTenantCron(tenant('t', { [FAST_SCHEDULE.field]: value }), FAST_SCHEDULE)).toThrow(
            /apps_worker_fast_cron_expression must be a valid cron expression/
        );
    });
});

describe('createTenantCronSelector', () => {
    beforeEach(() => jest.clearAllMocks());

    const ansSelector = (options = {}) =>
        createTenantCronSelector({
            resolveCron: (t) => resolveTenantCron(t, ANS_SCHEDULE),
            invalidLogKey: 'worker.schedule.invalid',
            ...options,
        });

    it('looks back one minute on its first evaluation', () => {
        const tenants = [tenant('a')];
        expect(ansSelector()(tenants, at('10:05:00.050'))).toEqual(tenants);
    });

    it('selects a tenant once per fire time across consecutive ticks', () => {
        const select = ansSelector();
        const tenants = [tenant('a')];
        const ticks = ['10:04:00.040', '10:05:00.030', '10:06:00.020', '10:09:59.990', '10:10:00.010'];

        expect(ticks.map((time) => select(tenants, at(time)).length)).toEqual([0, 1, 0, 1, 0]);
    });

    it('still selects a tenant when its tick arrives late, and only once', () => {
        const select = ansSelector();
        const tenants = [tenant('a')];

        select(tenants, at('10:04:00.040'));

        expect(select(tenants, at('10:06:20.000'))).toEqual(tenants);
        expect(select(tenants, at('10:06:21.000'))).toEqual([]);
    });

    // runIfIdle drops the batch while busy (and logs runner.skip): the fire must stay pending, not be lost.
    it('keeps returning a pending fire while the runner is busy until it is idle', () => {
        let busy = false;
        const select = ansSelector({ isBusy: () => busy });
        const tenants = [tenant('a')];

        select(tenants, at('10:04:00.040'));
        busy = true;
        const whileBusy = [select(tenants, at('10:05:00.030')), select(tenants, at('10:06:00.030'))];
        busy = false;
        const onceIdle = select(tenants, at('10:07:00.020'));

        expect(whileBusy).toEqual([tenants, tenants]);
        expect(onceIdle).toEqual(tenants);
        expect(select(tenants, at('10:08:00.010'))).toEqual([]);
    });

    // A timer that fires a few ms early must not push the fire to the next minute.
    it('treats a slightly early tick as its own minute', () => {
        const select = ansSelector();
        const tenants = [tenant('a')];

        select(tenants, at('10:03:59.999'));

        expect(select(tenants, at('10:04:59.998'))).toEqual(tenants);
        expect(select(tenants, at('10:06:00.004'))).toEqual([]);
    });

    // ANS can block the event loop: a tick 40 s late must not run the next minute's fire early.
    it('never selects a fire that is not due yet', () => {
        const select = ansSelector();
        const tenants = [tenant('a')];

        select(tenants, at('10:03:00.000'));

        expect(select(tenants, at('10:04:40.000'))).toEqual([]);
        expect(select(tenants, at('10:05:00.010'))).toEqual(tenants);
    });

    it('logs an invalid tenant once until its error changes', () => {
        const select = ansSelector();
        const broken = { id: { value: 'broken' }, [ANS_SCHEDULE.field]: { value: 'bad' } };

        const setCron = (value) => (broken[ANS_SCHEDULE.field] = { value });

        select([broken], at('10:05:00.000')); // logged
        select([broken], at('10:06:00.000')); // same error: silent
        setCron('*/5 * * * *');
        select([broken], at('10:07:00.000')); // valid again
        setCron('bad');
        select([broken], at('10:08:00.000')); // same error after a fix: logged again
        setCron('61 * * * *');
        select([broken], at('10:09:00.000')); // different error: logged

        expect(fakeLogError).toHaveBeenCalledTimes(3);
    });

    it('applies each tenant its own cron', () => {
        const everyMinute = tenant('a', { [ANS_SCHEDULE.field]: '* * * * *' });
        const byDefault = tenant('b');

        expect(ansSelector()([everyMinute, byDefault], at('10:06:00.000'))).toEqual([everyMinute]);
    });

    it('skips and logs a tenant with an invalid cron without affecting the others', () => {
        const broken = tenant('broken', { [ANS_SCHEDULE.field]: 'bad' });
        const healthy = tenant('ok');

        const due = ansSelector({ logContext: { job: 'AnsCalculateJob' } })([broken, healthy], at('10:05:00.000'));

        expect(due).toEqual([healthy]);
        expect(fakeLogError).toHaveBeenCalledTimes(1);
        expect(fakeLogError).toHaveBeenCalledWith(
            'worker.schedule.invalid',
            expect.objectContaining({ job: 'AnsCalculateJob', tenantId: 'broken', err: expect.stringMatching(/cron/) })
        );
    });
});
