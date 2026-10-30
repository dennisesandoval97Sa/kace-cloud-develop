import { jest } from '@jest/globals';
import { loadConfig } from '../src/config.mjs';

describe('loadConfig', () => {
    const original = { ...process.env };
    beforeEach(() => {
        process.env = { ...original };
    });

    it('returns defaults when no env vars are set', () => {
        delete process.env.WORKER_CONCURRENCY;
        delete process.env.WORKER_MODE;
        delete process.env.SHUTDOWN_GRACE_SECONDS;
        delete process.env.LOCK_STALENESS_MINUTES;
        delete process.env.HEALTH_PORT;
        delete process.env.DEBUG_OVERRIDE_PARAMETER_NAME;
        delete process.env.AWS_REGION;
        delete process.env.TARGET_DYNAMODB_REGION;

        const cfg = loadConfig();

        expect(cfg).toEqual({
            workerConcurrency: 5,
            workerMode: 'fast',
            shutdownGraceSeconds: 1800,
            lockStalenessMinutes: 30,
            healthPort: 8080,
            debugOverrideParameterName: '',
            awsRegion: 'us-east-1',
        });
    });

    // Schedules are per tenant (DynamoDB tenant record), not process env.
    it('ignores the removed cron env vars', () => {
        const cfg = loadConfig({
            CRON_EXPRESSION: 'bad',
            ANS_CRON_EXPRESSION: 'bad',
            BACKLOG_CRON_EXPRESSION: 'bad',
            BACKLOG_STATEMENT_TIMEOUT_MS: '0',
        });
        for (const key of [
            'cronExpression',
            'ansCronExpression',
            'backlogCronExpression',
            'backlogStatementTimeoutMs',
        ]) {
            expect(cfg).not.toHaveProperty(key);
        }
    });

    it('defaults WORKER_MODE to fast and accepts fast|ans|all (case-insensitive)', () => {
        expect(loadConfig({}).workerMode).toBe('fast');
        expect(loadConfig({ WORKER_MODE: 'ans' }).workerMode).toBe('ans');
        expect(loadConfig({ WORKER_MODE: 'ALL' }).workerMode).toBe('all');
    });

    it('throws when WORKER_MODE is not one of the allowed values', () => {
        expect(() => loadConfig({ WORKER_MODE: 'turbo' })).toThrow(/WORKER_MODE/);
    });

    it('falls back to TARGET_DYNAMODB_REGION when AWS_REGION is unset', () => {
        delete process.env.AWS_REGION;
        process.env.TARGET_DYNAMODB_REGION = 'eu-west-1';

        const cfg = loadConfig();

        expect(cfg.awsRegion).toBe('eu-west-1');
    });

    it('throws when WORKER_CONCURRENCY is not a positive integer', () => {
        process.env.WORKER_CONCURRENCY = '0';
        expect(() => loadConfig()).toThrow(/WORKER_CONCURRENCY/);
        process.env.WORKER_CONCURRENCY = 'abc';
        expect(() => loadConfig()).toThrow(/WORKER_CONCURRENCY/);
    });
});
