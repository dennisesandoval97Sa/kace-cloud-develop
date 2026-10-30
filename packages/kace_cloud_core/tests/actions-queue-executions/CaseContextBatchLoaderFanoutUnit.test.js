import { CaseContextBatchLoader } from '../../src/actions-queue-executions/domain/services/CaseContextBatchLoader.js';

const fakeCase = (i) => ({
    id: { value: `case-${i}` },
    cliente_id: { value: `cli-${i}` },
    clasificacion_id: { value: `cla-${i}` },
    transicion_id: { value: `tr-${i}` },
    toJson: () => ({ id: `case-${i}` }),
});

/**
 * Builds a fake caseRepository whose every query tracks the concurrent in-flight
 * count via the provided hooks, mirroring the CaseContextBatchLoaderConcurrency
 * test's harness pattern.
 */
const makeTrackingRepo = (runQuery) => {
    const builder = () => {
        const b = {
            leftJoin: () => b,
            whereIn: () => b,
            select: () => runQuery(),
        };
        return b;
    };
    return {
        read: { table: () => builder() },
        qualifiedName: (name) => name,
    };
};

describe('CaseContextBatchLoader fan-out concurrency invariant', () => {
    it('keeps in-flight <= maxConcurrency even with small chunks (more queries)', async () => {
        let inFlight = 0;
        let maxInFlight = 0;

        const runQuery = async () => {
            inFlight += 1;
            maxInFlight = Math.max(maxInFlight, inFlight);
            await new Promise((resolve) => setTimeout(resolve, 5));
            inFlight -= 1;
            return [];
        };

        const repo = makeTrackingRepo(runQuery);
        // 10 cases + chunkSize 2 => each of the 5 branches issues 5 chunk queries (50 total).
        // The shared pLimit(4) must keep concurrent queries <= 4 at all times.
        const cases = Array.from({ length: 10 }, (_, i) => fakeCase(i));
        const loader = new CaseContextBatchLoader(repo, { chunkSize: 2, maxConcurrency: 4 });

        await loader.load(cases);

        expect(maxInFlight).toBeGreaterThan(0);
        expect(maxInFlight).toBeLessThanOrEqual(4);
    });

    it('respects a custom (lower) maxConcurrency', async () => {
        let inFlight = 0;
        let maxInFlight = 0;

        const runQuery = async () => {
            inFlight += 1;
            maxInFlight = Math.max(maxInFlight, inFlight);
            await new Promise((resolve) => setTimeout(resolve, 5));
            inFlight -= 1;
            return [];
        };

        const repo = makeTrackingRepo(runQuery);
        // 10 cases + chunkSize 1 => 10 chunk queries per branch (50 total).
        // A maxConcurrency of 2 must hold throughout the entire load.
        const cases = Array.from({ length: 10 }, (_, i) => fakeCase(i));
        const loader = new CaseContextBatchLoader(repo, { chunkSize: 1, maxConcurrency: 2 });

        await loader.load(cases);

        expect(maxInFlight).toBeGreaterThan(0);
        expect(maxInFlight).toBeLessThanOrEqual(2);
    });
});
