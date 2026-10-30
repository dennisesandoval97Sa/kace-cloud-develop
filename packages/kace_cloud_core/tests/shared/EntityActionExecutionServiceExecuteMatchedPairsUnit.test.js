import { jest } from '@jest/globals';
import { EntityActionExecutionService } from '../../src/shared/domain/services/EntityActionExecutionService.js';

const makeAction = (id) => ({ id: { value: id } });
const makeEntity = (id) => ({ id: { value: id } });

const buildService = (executor) => {
    const actionRepository = {};
    return new EntityActionExecutionService(actionRepository, executor);
};

describe('EntityActionExecutionService.executeMatchedPairs', () => {
    it('executes each pair and counts executed/failed', async () => {
        const executor = { execute: jest.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(false) };
        const svc = buildService(executor);

        const counters = await svc.executeMatchedPairs(
            [
                { entity: makeEntity('e1'), action: makeAction('a1') },
                { entity: makeEntity('e2'), action: makeAction('a2') },
            ],
            { concurrency: 5 }
        );

        expect(counters).toEqual({ processed: 2, matched: 2, executed: 1, failed: 1 });
        expect(executor.execute).toHaveBeenCalledTimes(2);
    });

    it('counts a throwing pair as failed, does NOT abort the batch', async () => {
        const executor = {
            execute: jest
                .fn()
                .mockResolvedValueOnce(true)
                .mockRejectedValueOnce(new Error('boom'))
                .mockResolvedValueOnce(true),
        };
        const svc = buildService(executor);

        const counters = await svc.executeMatchedPairs([
            { entity: makeEntity('e1'), action: makeAction('a1') },
            { entity: makeEntity('e2'), action: makeAction('a2') },
            { entity: makeEntity('e3'), action: makeAction('a3') },
        ]);

        expect(counters).toEqual({ processed: 3, matched: 3, executed: 2, failed: 1 });
    });

    it('returns zero counters when pairs is empty', async () => {
        const svc = buildService({ execute: jest.fn() });
        const counters = await svc.executeMatchedPairs([]);
        expect(counters).toEqual({ processed: 0, matched: 0, executed: 0, failed: 0 });
    });
});
