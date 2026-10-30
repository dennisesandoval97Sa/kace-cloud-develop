import {
    classifyPreflightResult,
    classifyResult,
    buildOutputPaths,
    buildRefreshCommand,
    parseSummary,
    phaseToOutDirSlug,
    shouldRetryAtLowerRps,
    shouldSkipCompletedScenario,
} from '../runner/run-baseline.mjs';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('classifyResult', () => {
    it('returns FAILED when k6 exit code is non-zero', () => {
        expect(classifyResult({ exitCode: 99, summary: null })).toBe('FAILED');
    });

    it('returns THRESHOLD_BREACH when summary thresholds failed (legacy { ok: false } format)', () => {
        const summary = { metrics: { http_req_duration: { thresholds: { 'p(95)<2000': { ok: false } } } } };
        expect(classifyResult({ exitCode: 0, summary })).toBe('THRESHOLD_BREACH');
    });

    it('returns THRESHOLD_BREACH when summary thresholds crossed (k6 v0.50 bare boolean format)', () => {
        const summary = { metrics: { http_req_failed: { thresholds: { 'rate<0.01': true } } } };
        expect(classifyResult({ exitCode: 0, summary })).toBe('THRESHOLD_BREACH');
    });

    it('returns OK when legacy thresholds pass', () => {
        const summary = { metrics: { http_req_duration: { thresholds: { 'p(95)<2000': { ok: true } } } } };
        expect(classifyResult({ exitCode: 0, summary })).toBe('OK');
    });

    it('returns OK when k6 v0.50 thresholds did not cross (false)', () => {
        const summary = { metrics: { http_req_duration: { thresholds: { 'p(95)<2000': false } } } };
        expect(classifyResult({ exitCode: 0, summary })).toBe('OK');
    });
});

describe('buildOutputPaths', () => {
    it('places raw json under <outDir>/raw/<id>.json', () => {
        const paths = buildOutputPaths('/tmp/baseline', 'cases-search');
        expect(paths.rawJson).toBe('/tmp/baseline/raw/cases-search.json');
    });
});

describe('buildRefreshCommand', () => {
    it('targets auth/refresh-tokens.mjs under the package root', () => {
        const cmd = buildRefreshCommand('/path/to/pkg');

        expect(cmd.command).toBe('node');
        expect(cmd.args).toEqual(['/path/to/pkg/auth/refresh-tokens.mjs']);
        expect(cmd.cwd).toBe('/path/to/pkg');
    });

    it('overrides PERF_TOKEN_REFRESH_THRESHOLD_MS to 30 minutes by default', () => {
        const cmd = buildRefreshCommand('/path/to/pkg');

        expect(cmd.env.PERF_TOKEN_REFRESH_THRESHOLD_MS).toBe(String(30 * 60 * 1000));
    });

    it('honors a custom threshold', () => {
        const cmd = buildRefreshCommand('/path/to/pkg', 60_000);

        expect(cmd.env.PERF_TOKEN_REFRESH_THRESHOLD_MS).toBe('60000');
    });
});

describe('parseSummary', () => {
    it('extracts metrics from legacy k6 format (values nested)', () => {
        const summary = {
            metrics: {
                http_req_duration: {
                    values: { 'p(50)': 100, 'p(95)': 500, 'p(99)': 900 },
                    thresholds: {},
                },
                http_req_failed: { values: { rate: 0.005 } },
                http_reqs: { values: { rate: 49.8 } },
            },
        };

        const result = parseSummary(summary);

        expect(result.p50).toBe(100);
        expect(result.p95).toBe(500);
        expect(result.p99).toBe(900);
        expect(result.errorRate).toBe(0.005);
        expect(result.rps).toBe(49.8);
    });

    it('extracts metrics from k6 v0.50 format (flat structure with med + value)', () => {
        const summary = {
            metrics: {
                http_req_duration: {
                    avg: 96.33,
                    min: 86.52,
                    med: 93.28,
                    max: 1854.95,
                    'p(90)': 114.07,
                    'p(95)': 117.42,
                },
                http_req_failed: { fails: 0, passes: 30302, value: 1 },
                http_reqs: { count: 30302, rate: 48.09 },
            },
        };

        const result = parseSummary(summary);

        expect(result.p50).toBe(93.28); // falls back to .med
        expect(result.p95).toBe(117.42);
        expect(result.p99).toBeUndefined(); // not in summary unless summaryTrendStats overridden
        expect(result.errorRate).toBe(1); // falls back to .value
        expect(result.rps).toBe(48.09);
    });
});

describe('shouldRetryAtLowerRps', () => {
    it('returns true when errorRate exceeds 5%', () => {
        expect(shouldRetryAtLowerRps({ errorRate: 0.06, p95: 100 })).toBe(true);
    });

    it('returns true when p95 exceeds 4000ms', () => {
        expect(shouldRetryAtLowerRps({ errorRate: 0, p95: 4500 })).toBe(true);
    });

    it('returns false when both metrics are clean', () => {
        expect(shouldRetryAtLowerRps({ errorRate: 0, p95: 800 })).toBe(false);
    });

    it('returns false when result has no metrics (k6 crashed)', () => {
        expect(shouldRetryAtLowerRps({})).toBe(false);
    });

    it('treats undefined errorRate/p95 as 0/0 (clean)', () => {
        expect(shouldRetryAtLowerRps({ errorRate: undefined, p95: undefined })).toBe(false);
    });
});

describe('shouldSkipCompletedScenario', () => {
    let dir;
    beforeEach(() => {
        dir = join(tmpdir(), `f2r-skip-${Date.now()}`);
        mkdirSync(dir, { recursive: true });
    });
    afterEach(() => rmSync(dir, { recursive: true, force: true }));

    it('returns false when summary file does not exist', () => {
        expect(shouldSkipCompletedScenario({ summaryJson: join(dir, 'missing.json') })).toBe(false);
    });

    it('returns true when summary file exists and is valid JSON', () => {
        const file = join(dir, 'present.json');
        writeFileSync(file, '{"metrics":{}}');
        expect(shouldSkipCompletedScenario({ summaryJson: file })).toBe(true);
    });

    it('returns false when summary file exists but is not valid JSON', () => {
        const file = join(dir, 'corrupt.json');
        writeFileSync(file, 'not-json');
        expect(shouldSkipCompletedScenario({ summaryJson: file })).toBe(false);
    });
});

describe('phaseToOutDirSlug', () => {
    it('maps F1-R to f1-read', () => {
        expect(phaseToOutDirSlug('F1-R')).toBe('f1-read');
    });

    it('maps F2-R to f2-read', () => {
        expect(phaseToOutDirSlug('F2-R')).toBe('f2-read');
    });

    it('maps F4-W to f4-write', () => {
        expect(phaseToOutDirSlug('F4-W')).toBe('f4-write');
    });

    it('falls back to f1-read for malformed phase', () => {
        expect(phaseToOutDirSlug('Phase 1')).toBe('f1-read');
        expect(phaseToOutDirSlug('')).toBe('f1-read');
        expect(phaseToOutDirSlug(undefined)).toBe('f1-read');
        expect(phaseToOutDirSlug(null)).toBe('f1-read');
    });
});

describe('classifyPreflightResult', () => {
    it('returns OK when all scenarios respond 2xx', () => {
        const results = [
            { id: 'a', status: 200 },
            { id: 'b', status: 204 },
        ];
        expect(classifyPreflightResult(results)).toEqual({ verdict: 'OK', failing: [] });
    });

    it('returns GAPS_FOUND when any scenario returns 401/403/404', () => {
        const results = [
            { id: 'a', status: 200 },
            { id: 'b', status: 403 },
            { id: 'c', status: 404 },
        ];
        const result = classifyPreflightResult(results);

        expect(result.verdict).toBe('GAPS_FOUND');
        expect(result.failing).toHaveLength(2);
        expect(result.failing[0].id).toBe('b');
    });

    it('returns ENV_ERROR when any scenario returns 5xx', () => {
        const results = [
            { id: 'a', status: 200 },
            { id: 'b', status: 502 },
        ];
        expect(classifyPreflightResult(results).verdict).toBe('ENV_ERROR');
    });

    it('prioritizes ENV_ERROR over GAPS_FOUND when both present', () => {
        const results = [
            { id: 'a', status: 403 },
            { id: 'b', status: 503 },
        ];
        expect(classifyPreflightResult(results).verdict).toBe('ENV_ERROR');
    });
});
