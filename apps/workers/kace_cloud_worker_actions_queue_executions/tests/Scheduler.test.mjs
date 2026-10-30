import { jest } from '@jest/globals';
import { Scheduler } from '../src/Scheduler.mjs';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

describe('Scheduler', () => {
    let sut;

    afterEach(async () => {
        if (sut) {
            await sut.stop();
            sut = null;
        }
    });

    it('does not start a tick when isShuttingDown=true', async () => {
        const tick = jest.fn(async () => {});
        sut = new Scheduler({ tick, cronExpression: '* * * * *' });

        sut.beginShutdown();
        await sut.runTickNow();

        expect(tick).not.toHaveBeenCalled();
    });

    it('does not start a tick if a previous one is still in flight', async () => {
        let resolveFirst;
        const tick = jest.fn(() => new Promise((r) => (resolveFirst = r)));
        sut = new Scheduler({ tick, cronExpression: '* * * * *' });

        const first = sut.runTickNow();
        await sut.runTickNow();
        expect(tick).toHaveBeenCalledTimes(1);

        resolveFirst();
        await first;

        await sut.runTickNow();
        expect(tick).toHaveBeenCalledTimes(2);
    });

    it('isHealthy returns true while running and not shutting down', async () => {
        sut = new Scheduler({ tick: async () => {}, cronExpression: '* * * * *' });
        expect(sut.isHealthy()).toBe(false);
        sut.start();
        expect(sut.isHealthy()).toBe(true);
        sut.beginShutdown();
        expect(sut.isHealthy()).toBe(false);
    });

    it('drain() resolves when the in-flight tick finishes', async () => {
        let resolveTick;
        const tick = jest.fn(() => new Promise((r) => (resolveTick = r)));
        sut = new Scheduler({ tick, cronExpression: '* * * * *' });
        sut.start();

        const ran = sut.runTickNow();
        sut.beginShutdown();
        const drained = sut.drain();

        await wait(20);
        expect(tick).toHaveBeenCalledTimes(1);

        resolveTick();
        await ran;
        await drained;
    });

    it('drain() returns immediately if no tick is in flight', async () => {
        sut = new Scheduler({ tick: async () => {}, cronExpression: '* * * * *' });
        await expect(sut.drain()).resolves.toBeUndefined();
    });

    it('drain(timeoutMs) returns after timeout even if tick is hung', async () => {
        const tick = jest.fn(() => new Promise(() => {})); // never resolves
        sut = new Scheduler({ tick, cronExpression: '* * * * *' });

        // Start a tick that will hang.
        sut.runTickNow();

        const start = Date.now();
        await sut.drain(50);
        const elapsed = Date.now() - start;

        expect(elapsed).toBeGreaterThanOrEqual(40);
        expect(elapsed).toBeLessThan(500);
    });

    it('logs and swallows errors from tick', async () => {
        const tick = jest.fn().mockRejectedValue(new Error('boom'));
        sut = new Scheduler({ tick, cronExpression: '* * * * *' });

        await expect(sut.runTickNow()).resolves.toBeUndefined();
    });

    it('throws when tick is not a function', () => {
        expect(() => new Scheduler({ tick: 'not-a-function', cronExpression: '* * * * *' })).toThrow(/tick/);
    });

    it('throws when cronExpression is not a string', () => {
        expect(() => new Scheduler({ tick: async () => {}, cronExpression: 123 })).toThrow(/cronExpression/);
    });

    it('accepts a `runners` array (default empty) without breaking existing API', () => {
        expect(() => new Scheduler({ tick: async () => {}, cronExpression: '* * * * *' })).not.toThrow();
        expect(
            () =>
                new Scheduler({
                    tick: async () => {},
                    cronExpression: '* * * * *',
                    runners: [],
                })
        ).not.toThrow();
    });

    it('beginShutdown propagates to all runners', () => {
        const r1 = { beginShutdown: jest.fn(), inFlight: null };
        const r2 = { beginShutdown: jest.fn(), inFlight: null };
        sut = new Scheduler({
            tick: async () => {},
            cronExpression: '* * * * *',
            runners: [r1, r2],
        });

        sut.beginShutdown();

        expect(r1.beginShutdown).toHaveBeenCalledTimes(1);
        expect(r2.beginShutdown).toHaveBeenCalledTimes(1);
    });

    it('drain waits for every runner inFlight promise', async () => {
        let releaseSlow;
        const slow = new Promise((r) => (releaseSlow = r));
        const r1 = { beginShutdown: jest.fn(), inFlight: Promise.resolve() };
        const r2 = { beginShutdown: jest.fn(), inFlight: slow };
        sut = new Scheduler({
            tick: async () => {},
            cronExpression: '* * * * *',
            runners: [r1, r2],
        });

        let drained = false;
        const drainP = sut.drain().then(() => {
            drained = true;
        });

        await wait(20);
        expect(drained).toBe(false);

        releaseSlow();
        await drainP;
        expect(drained).toBe(true);
    });

    it('drain returns after timeout even if a runner hangs', async () => {
        const r1 = { beginShutdown: jest.fn(), inFlight: new Promise(() => {}) };
        sut = new Scheduler({
            tick: async () => {},
            cronExpression: '* * * * *',
            runners: [r1],
        });

        const start = Date.now();
        await sut.drain(50);
        const elapsed = Date.now() - start;

        expect(elapsed).toBeGreaterThanOrEqual(40);
        expect(elapsed).toBeLessThan(500);
    });
});
