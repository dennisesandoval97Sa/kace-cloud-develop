import { jest } from '@jest/globals';
import { JobRunner } from '../src/JobRunner.mjs';

const noopJob = () => ({ name: 'NoopJob', run: jest.fn().mockResolvedValue(undefined) });

describe('JobRunner — constructor', () => {
    it('exposes the wrapped job name via `name`', () => {
        const sut = new JobRunner({ job: noopJob(), concurrency: 3 });
        expect(sut.name).toBe('NoopJob');
    });

    it('starts with no in-flight execution', () => {
        const sut = new JobRunner({ job: noopJob(), concurrency: 3 });
        expect(sut.inFlight).toBeNull();
    });

    it.each([
        { job: null },
        { job: {} },
        { job: { name: 'X' } },
        { job: { run: () => {} } },
        { job: { name: 123, run: () => {} } },
    ])('throws when job is invalid (%p)', ({ job }) => {
        expect(() => new JobRunner({ job, concurrency: 1 })).toThrow(/job must expose/);
    });

    it.each([0, -1, 1.5, NaN, '2', null, undefined])('throws when concurrency is invalid (%p)', (invalid) => {
        expect(() => new JobRunner({ job: noopJob(), concurrency: invalid })).toThrow(
            /concurrency must be a positive integer/
        );
    });
});

const fakeTenant = (id) => ({
    id: { value: id },
    apps_debug: { value: 'false' },
    apps_debug_level: { value: '1' },
});

describe('JobRunner — runIfIdle happy path', () => {
    it('invokes job.run once per tenant and resolves inFlight when done', async () => {
        const job = { name: 'Job', run: jest.fn().mockResolvedValue({ status: 'ok' }) };
        const sut = new JobRunner({ job, concurrency: 2 });
        const tenants = [fakeTenant('t-1'), fakeTenant('t-2'), fakeTenant('t-3')];

        sut.runIfIdle({ tenants });
        expect(sut.inFlight).not.toBeNull();

        await sut.inFlight;

        expect(job.run).toHaveBeenCalledTimes(3);
        expect(job.run).toHaveBeenCalledWith(tenants[0]);
        expect(job.run).toHaveBeenCalledWith(tenants[1]);
        expect(job.run).toHaveBeenCalledWith(tenants[2]);
        expect(sut.inFlight).toBeNull();
    });

    it('returns immediately (synchronous return value is undefined)', () => {
        const job = { name: 'Job', run: jest.fn().mockResolvedValue(undefined) };
        const sut = new JobRunner({ job, concurrency: 1 });
        const result = sut.runIfIdle({ tenants: [fakeTenant('t-1')] });
        expect(result).toBeUndefined();
    });
});

describe('JobRunner — overlap-skip', () => {
    const flushMicrotasks = () => new Promise((r) => setImmediate(r));

    it('skips when an execution is already in flight; runs after the first resolves', async () => {
        let releaseFirst;
        const first = new Promise((r) => (releaseFirst = r));
        const run = jest.fn(() => first);
        const job = { name: 'Job', run };
        const sut = new JobRunner({ job, concurrency: 1 });

        sut.runIfIdle({ tenants: [fakeTenant('t-1')] });
        sut.runIfIdle({ tenants: [fakeTenant('t-1')] });
        sut.runIfIdle({ tenants: [fakeTenant('t-1')] });

        await flushMicrotasks();
        expect(run).toHaveBeenCalledTimes(1);

        releaseFirst({ status: 'ok' });
        await sut.inFlight;

        sut.runIfIdle({ tenants: [fakeTenant('t-1')] });
        await sut.inFlight;

        expect(run).toHaveBeenCalledTimes(2);
    });
});

describe('JobRunner — error isolation', () => {
    it('one tenant failing does not abort the others; inFlight still resolves', async () => {
        const job = {
            name: 'Job',
            run: jest.fn(async (tenant) => {
                if (tenant.id.value === 't-bad') throw new Error('boom');
                return { status: 'ok' };
            }),
        };
        const sut = new JobRunner({ job, concurrency: 2 });
        const tenants = [fakeTenant('t-good-1'), fakeTenant('t-bad'), fakeTenant('t-good-2')];

        sut.runIfIdle({ tenants });
        await expect(sut.inFlight).resolves.toBeUndefined();

        expect(job.run).toHaveBeenCalledTimes(3);
        expect(sut.inFlight).toBeNull();
    });

    it('inFlight never rejects, even when every tenant fails', async () => {
        const job = { name: 'Job', run: jest.fn().mockRejectedValue(new Error('all fail')) };
        const sut = new JobRunner({ job, concurrency: 1 });

        sut.runIfIdle({ tenants: [fakeTenant('t-1'), fakeTenant('t-2')] });
        await expect(sut.inFlight).resolves.toBeUndefined();
    });
});

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

describe('JobRunner — concurrency limit', () => {
    it('never runs more than `concurrency` tenant invocations in parallel', async () => {
        const inflight = { current: 0, peak: 0 };
        const job = {
            name: 'SlowJob',
            run: async () => {
                inflight.current += 1;
                inflight.peak = Math.max(inflight.peak, inflight.current);
                await wait(15);
                inflight.current -= 1;
                return { status: 'ok' };
            },
        };
        const tenants = Array.from({ length: 10 }, (_, i) => fakeTenant(`t-${i}`));
        const sut = new JobRunner({ job, concurrency: 3 });

        sut.runIfIdle({ tenants });
        await sut.inFlight;

        expect(inflight.peak).toBeLessThanOrEqual(3);
        expect(inflight.peak).toBeGreaterThan(1);
    });
});

describe('JobRunner — beginShutdown', () => {
    it('makes subsequent runIfIdle calls a no-op', () => {
        const job = { name: 'Job', run: jest.fn().mockResolvedValue(undefined) };
        const sut = new JobRunner({ job, concurrency: 1 });

        sut.beginShutdown();
        sut.runIfIdle({ tenants: [fakeTenant('t-1')] });

        expect(job.run).not.toHaveBeenCalled();
        expect(sut.inFlight).toBeNull();
    });

    it('lets a currently in-flight execution complete', async () => {
        let release;
        const run = jest.fn(() => new Promise((r) => (release = r)));
        const job = { name: 'Job', run };
        const sut = new JobRunner({ job, concurrency: 1 });

        sut.runIfIdle({ tenants: [fakeTenant('t-1')] });
        expect(sut.inFlight).not.toBeNull();

        sut.beginShutdown();
        expect(sut.inFlight).not.toBeNull();

        // p-limit dequeues tasks after one microtask tick; wait for job.run to be called
        await Promise.resolve();
        release();
        await sut.inFlight;
        expect(run).toHaveBeenCalledTimes(1);
    });
});
