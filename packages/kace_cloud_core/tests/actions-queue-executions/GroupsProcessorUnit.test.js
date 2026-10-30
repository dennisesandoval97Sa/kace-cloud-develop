import { jest } from '@jest/globals';
import { GroupsProcessor } from '../../src/actions-queue-executions/domain/services/GroupsProcessor.js';
import { NO_PREFILTER } from '../../src/actions-queue-executions/domain/services/EntityCandidateFinder.js';

const fakeGroup = (id) => ({
    id: { value: id },
    toJson: () => ({ id }),
});

const fakeAction = (id) => ({
    id: { value: id },
    conditions: { value: { id: 'c', combinator: 'and', rules: [] } },
});

describe('GroupsProcessor', () => {
    it('skips Phase 3 (bulk context) entirely', async () => {
        const finder = { find: jest.fn().mockResolvedValue(new Set(['g1'])) };
        const groupsRepository = {
            findActiveByIds: jest.fn().mockResolvedValue([fakeGroup('g1')]),
            findAllActive: jest.fn(),
        };
        const validator = { validateWithContext: jest.fn().mockResolvedValue(true) };

        const processor = new GroupsProcessor({
            groupsRepository,
            entityActionValidator: validator,
            candidateFinder: finder,
        });

        await processor.processEntitiesWithActions([fakeAction('a1')]);

        // validateWithContext called with null resolvedContext (no bulk loader for groups).
        const callArgs = validator.validateWithContext.mock.calls[0];
        expect(callArgs[2]).toBeNull();
        expect(processor.getMetrics().bulk_context_queries).toBe(0);
    });

    it('reuses universe in fallback', async () => {
        const finder = {
            find: jest
                .fn()
                .mockResolvedValueOnce(NO_PREFILTER)
                .mockResolvedValueOnce(new Set(['g2'])),
        };
        const groupsRepository = {
            findActiveByIds: jest.fn(),
            findAllActive: jest.fn().mockResolvedValue([fakeGroup('g1'), fakeGroup('g2')]),
        };
        const validator = { validateWithContext: jest.fn().mockResolvedValue(true) };

        const processor = new GroupsProcessor({
            groupsRepository,
            entityActionValidator: validator,
            candidateFinder: finder,
        });
        await processor.processEntitiesWithActions([fakeAction('a1'), fakeAction('a2')]);

        expect(groupsRepository.findAllActive).toHaveBeenCalledTimes(1);
        expect(groupsRepository.findActiveByIds).not.toHaveBeenCalled();
        expect(validator.validateWithContext).toHaveBeenCalledTimes(3);
        expect(processor.getMetrics().universe_loaded).toBe(true);
    });
});
