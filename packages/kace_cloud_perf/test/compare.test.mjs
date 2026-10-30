import { compareResults, computeDelta } from '../reporter/compare.mjs';

describe('computeDelta', () => {
    it('returns percentage delta b vs a', () => {
        expect(computeDelta(100, 110)).toBeCloseTo(10, 5);
        expect(computeDelta(100, 90)).toBeCloseTo(-10, 5);
    });

    it('returns 0 when both values are 0', () => {
        expect(computeDelta(0, 0)).toBe(0);
    });

    it('returns Infinity when a=0 and b>0', () => {
        expect(computeDelta(0, 50)).toBe(Infinity);
    });
});

describe('compareResults', () => {
    const f1 = {
        results: [
            { id: 'cases-view-by-id', p50: 314, p95: 630, p99: 1394, errorRate: 0, rps: 48 },
            { id: 'cases-view-list', p50: 5000, p95: 7000, p99: 12000, errorRate: 0.004, rps: 35 },
        ],
    };
    const f2 = {
        results: [
            { id: 'cases-view-by-id', p50: 320, p95: 645, p99: 1400, errorRate: 0, rps: 48 },
            { id: 'cases-view-list', p50: 4900, p95: 6800, p99: 11000, errorRate: 0.004, rps: 35 },
            { id: 'cases-comments', p50: 200, p95: 400, p99: 700, errorRate: 0, rps: 50 },
        ],
    };

    it('intersects results by id, returns common endpoints', () => {
        const out = compareResults(f1, f2);
        expect(out.commonEndpoints).toHaveLength(2);
        expect(out.commonEndpoints.map((e) => e.id)).toEqual(['cases-view-by-id', 'cases-view-list']);
    });

    it('reports endpoints exclusive to each baseline', () => {
        const out = compareResults(f1, f2);
        expect(out.onlyInB).toEqual(['cases-comments']);
        expect(out.onlyInA).toEqual([]);
    });

    it('marks endpoint as drift when |delta| > 10%', () => {
        const f1Drift = { results: [{ id: 'x', p50: 100, p95: 200, p99: 300, errorRate: 0, rps: 50 }] };
        const f2Drift = { results: [{ id: 'x', p50: 200, p95: 250, p99: 350, errorRate: 0, rps: 50 }] };
        const out = compareResults(f1Drift, f2Drift);

        expect(out.commonEndpoints[0].verdict).toBe('drift');
    });

    it('marks endpoint as stable when |delta| <= 10%', () => {
        const out = compareResults(f1, f2);
        expect(out.commonEndpoints[0].verdict).toBe('stable');
    });
});
