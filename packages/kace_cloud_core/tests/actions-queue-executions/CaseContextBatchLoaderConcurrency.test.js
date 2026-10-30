import { CaseContextBatchLoader } from '../../src/actions-queue-executions/domain/services/CaseContextBatchLoader.js';

const fakeCase = (i) => ({
    id: { value: `case-${i}` },
    cliente_id: { value: `cli-${i}` },
    clasificacion_id: { value: `cla-${i}` },
    transicion_id: { value: `tr-${i}` },
    toJson: () => ({ id: `case-${i}` }),
});

/**
 * Builds a fake caseRepository whose every query goes through `runQuery`, letting
 * the test observe how many queries are in flight at the same time.
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

describe('CaseContextBatchLoader concurrency bounding', () => {
    it('never runs more queries in flight than maxConcurrency', async () => {
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
        // 6 cases with distinct ids + chunkSize 1 => each of the 5 branches fans out
        // into 6 chunk queries (30 total), which the loader must throttle to maxConcurrency.
        const cases = Array.from({ length: 6 }, (_, i) => fakeCase(i));
        const loader = new CaseContextBatchLoader(repo, { chunkSize: 1, maxConcurrency: 4 });

        await loader.load(cases);

        expect(maxInFlight).toBeGreaterThan(0);
        expect(maxInFlight).toBeLessThanOrEqual(4);
    });
});
