import { jest } from '@jest/globals';
import { CasesProcessor } from '../../src/actions-queue-executions/domain/services/CasesProcessor.js';

const fakeCase = (id) => ({
    id: { value: id },
    cliente_id: { value: 'cli' },
    clasificacion_id: { value: 'cla' },
    transicion_id: { value: 'tr' },
    toJson: () => ({ id }),
});

const fakeAction = (id) => ({
    id: { value: id },
    conditions: { value: { id: 'c', combinator: 'and', rules: [] } },
    entity: { value: 'case' },
});

// Phase 2 (loading Case instances for SQL pre-filter candidates) must never hand a single
// `WHERE id IN (...)` the full candidate set: with tens of thousands of ids this risks
// Postgres' bind-parameter ceiling and forces a full seq-scan plan. CasesProcessor chunks
// at 1000 ids/query with max 4 concurrent queries, mirroring CaseContextBatchLoader.
describe('CasesProcessor candidate id chunking (Phase 2)', () => {
    it('splits a large candidate id set into <=1000-id chunks and merges the results', async () => {
        const ids = Array.from({ length: 2500 }, (_, i) => `c${i}`);
        const finder = { find: jest.fn().mockResolvedValue(new Set(ids)) };
        const loader = {
            load: jest.fn().mockResolvedValue(new Map(ids.map((id) => [id, { cases: { id } }]))),
        };
        const validator = { validateWithContext: jest.fn().mockResolvedValue(true) };
        const findAllActive = {
            execute: jest.fn(async (_filters, options) => options.restrictToIds.map(fakeCase)),
        };

        const processor = new CasesProcessor(findAllActive, validator, finder, loader, 50);
        await processor.processCasesWithActions([fakeAction('a1')]);

        // ceil(2500 / 1000) = 3 chunk queries
        expect(findAllActive.execute).toHaveBeenCalledTimes(3);

        const requestedChunks = findAllActive.execute.mock.calls.map((call) => call[1].restrictToIds);
        requestedChunks.forEach((chunk) => expect(chunk.length).toBeLessThanOrEqual(1000));

        const requestedIds = requestedChunks.flat();
        expect(requestedIds).toHaveLength(2500);
        expect(new Set(requestedIds).size).toBe(2500); // no duplicates/gaps across chunks
        expect(requestedIds.sort()).toEqual([...ids].sort());

        // Every candidate must have been validated, proving the per-chunk results were merged
        // back into a single candidateCases pool (Phase 4 sees all 2500, not just one chunk).
        expect(validator.validateWithContext).toHaveBeenCalledTimes(2500);
        expect(processor.getSuccessOperations()).toHaveLength(2500);
    });

    it('never issues more than 4 concurrent candidate-loading queries', async () => {
        let inFlight = 0;
        let maxInFlight = 0;
        const ids = Array.from({ length: 4500 }, (_, i) => `c${i}`); // 5 chunks of <=1000
        const finder = { find: jest.fn().mockResolvedValue(new Set(ids)) };
        const loader = {
            load: jest.fn().mockResolvedValue(new Map(ids.map((id) => [id, { cases: { id } }]))),
        };
        const validator = { validateWithContext: jest.fn().mockResolvedValue(true) };
        const findAllActive = {
            execute: jest.fn(async (_filters, options) => {
                inFlight += 1;
                maxInFlight = Math.max(maxInFlight, inFlight);
                await new Promise((resolve) => setTimeout(resolve, 5));
                inFlight -= 1;
                return options.restrictToIds.map(fakeCase);
            }),
        };

        const processor = new CasesProcessor(findAllActive, validator, finder, loader, 50);
        await processor.processCasesWithActions([fakeAction('a1')]);

        expect(findAllActive.execute).toHaveBeenCalledTimes(5);
        expect(maxInFlight).toBeGreaterThan(0);
        expect(maxInFlight).toBeLessThanOrEqual(4);
    });

    it.each([
        [1000, 1],
        [1001, 2],
    ])('issues %i-id candidate set as %i chunk query/queries', async (idCount, expectedCalls) => {
        const ids = Array.from({ length: idCount }, (_, i) => `c${i}`);
        const finder = { find: jest.fn().mockResolvedValue(new Set(ids)) };
        const loader = {
            load: jest.fn().mockResolvedValue(new Map(ids.map((id) => [id, { cases: { id } }]))),
        };
        const validator = { validateWithContext: jest.fn().mockResolvedValue(true) };
        const findAllActive = {
            execute: jest.fn(async (_filters, options) => options.restrictToIds.map(fakeCase)),
        };

        const processor = new CasesProcessor(findAllActive, validator, finder, loader, 50);
        await processor.processCasesWithActions([fakeAction('a1')]);

        expect(findAllActive.execute).toHaveBeenCalledTimes(expectedCalls);
    });

    it('does not chunk when the candidate set fits in a single query', async () => {
        const ids = ['c0', 'c1', 'c2'];
        const finder = { find: jest.fn().mockResolvedValue(new Set(ids)) };
        const loader = {
            load: jest.fn().mockResolvedValue(new Map(ids.map((id) => [id, { cases: { id } }]))),
        };
        const validator = { validateWithContext: jest.fn().mockResolvedValue(true) };
        const findAllActive = {
            execute: jest.fn(async (_filters, options) => options.restrictToIds.map(fakeCase)),
        };

        const processor = new CasesProcessor(findAllActive, validator, finder, loader, 50);
        await processor.processCasesWithActions([fakeAction('a1')]);

        expect(findAllActive.execute).toHaveBeenCalledTimes(1);
        expect([...findAllActive.execute.mock.calls[0][1].restrictToIds].sort()).toEqual([...ids].sort());
    });
});
