import { jest } from '@jest/globals';
import { UsersProcessor } from '../../src/actions-queue-executions/domain/services/UsersProcessor.js';
import { NO_PREFILTER } from '../../src/actions-queue-executions/domain/services/EntityCandidateFinder.js';

const fakeUser = (id, grupoActivo = null) => ({
    id: { value: id },
    grupo_activo: { value: grupoActivo },
    toJson: () => ({ id }),
    toRulesContext: () => ({ id }),
});

const fakeAction = (id) => ({
    id: { value: id },
    conditions: { value: { id: 'c', combinator: 'and', rules: [] } },
});

describe('UsersProcessor', () => {
    it('processes only candidates from SQL pre-filter when all actions translatable', async () => {
        const finder = {
            find: jest
                .fn()
                .mockResolvedValueOnce(new Set(['u1', 'u2']))
                .mockResolvedValueOnce(new Set(['u2', 'u3'])),
        };
        const usersRepository = {
            findActiveByIds: jest.fn().mockResolvedValue([fakeUser('u1'), fakeUser('u2'), fakeUser('u3')]),
            findAllActive: jest.fn(),
        };
        const loader = {
            load: jest.fn().mockResolvedValue(
                new Map([
                    ['u1', { activeSessionLimit: 2 }],
                    ['u2', { activeSessionLimit: 2 }],
                    ['u3', { activeSessionLimit: 2 }],
                ])
            ),
        };
        const validator = { validateWithContext: jest.fn().mockResolvedValue(true) };

        const processor = new UsersProcessor({
            usersRepository,
            entityActionValidator: validator,
            candidateFinder: finder,
            userContextBatchLoader: loader,
            concurrencyLimit: 50,
        });

        await processor.processEntitiesWithActions([fakeAction('a1'), fakeAction('a2')]);

        expect(finder.find).toHaveBeenCalledTimes(2);
        expect(usersRepository.findAllActive).not.toHaveBeenCalled();
        expect(usersRepository.findActiveByIds).toHaveBeenCalledTimes(1);
        expect([...usersRepository.findActiveByIds.mock.calls[0][0]].sort()).toEqual(['u1', 'u2', 'u3']);
        expect(loader.load).toHaveBeenCalledTimes(1);
        expect(validator.validateWithContext).toHaveBeenCalledTimes(4);
        expect(processor.getSuccessOperations()).toHaveLength(4);
    });

    it('reuses universe loaded in fallback (does not call findActiveByIds)', async () => {
        const finder = {
            find: jest
                .fn()
                .mockResolvedValueOnce(NO_PREFILTER)
                .mockResolvedValueOnce(new Set(['u2'])),
        };
        const usersRepository = {
            findActiveByIds: jest.fn(),
            findAllActive: jest.fn().mockResolvedValue([fakeUser('u1'), fakeUser('u2')]),
        };
        const loader = {
            load: jest.fn().mockResolvedValue(
                new Map([
                    ['u1', { activeSessionLimit: 2 }],
                    ['u2', { activeSessionLimit: 2 }],
                ])
            ),
        };
        const validator = { validateWithContext: jest.fn().mockResolvedValue(true) };

        const processor = new UsersProcessor({
            usersRepository,
            entityActionValidator: validator,
            candidateFinder: finder,
            userContextBatchLoader: loader,
        });

        await processor.processEntitiesWithActions([fakeAction('a1'), fakeAction('a2')]);

        expect(usersRepository.findAllActive).toHaveBeenCalledTimes(1);
        expect(usersRepository.findActiveByIds).not.toHaveBeenCalled();
        expect(validator.validateWithContext).toHaveBeenCalledTimes(3);
        expect(processor.getMetrics().universe_loaded).toBe(true);
    });

    it('returns early when no candidates', async () => {
        const finder = { find: jest.fn().mockResolvedValue(new Set()) };
        const usersRepository = { findActiveByIds: jest.fn(), findAllActive: jest.fn() };
        const loader = { load: jest.fn() };
        const validator = { validateWithContext: jest.fn() };

        const processor = new UsersProcessor({
            usersRepository,
            entityActionValidator: validator,
            candidateFinder: finder,
            userContextBatchLoader: loader,
        });

        await processor.processEntitiesWithActions([fakeAction('a1')]);

        expect(loader.load).not.toHaveBeenCalled();
        expect(validator.validateWithContext).not.toHaveBeenCalled();
        expect(usersRepository.findActiveByIds).not.toHaveBeenCalled();
    });

    it('routes thrown validations to errorOperations (mutual exclusion)', async () => {
        const finder = { find: jest.fn().mockResolvedValue(new Set(['u1', 'u2'])) };
        const usersRepository = {
            findActiveByIds: jest.fn().mockResolvedValue([fakeUser('u1'), fakeUser('u2')]),
            findAllActive: jest.fn(),
        };
        const loader = {
            load: jest.fn().mockResolvedValue(
                new Map([
                    ['u1', { activeSessionLimit: 2 }],
                    ['u2', { activeSessionLimit: 2 }],
                ])
            ),
        };
        const validator = {
            validateWithContext: jest.fn().mockResolvedValueOnce(true).mockRejectedValueOnce(new Error('boom')),
        };

        const processor = new UsersProcessor({
            usersRepository,
            entityActionValidator: validator,
            candidateFinder: finder,
            userContextBatchLoader: loader,
        });
        await processor.processEntitiesWithActions([fakeAction('a1')]);

        expect(processor.getSuccessOperations()).toHaveLength(1);
        expect(processor.getErrorOperations()).toHaveLength(1);
        expect(processor.getFailedOperations()).toHaveLength(0);
    });

    it('separates success, ruleFalse and errored buckets', async () => {
        const finder = { find: jest.fn().mockResolvedValue(new Set(['u1', 'u2', 'u3'])) };
        const usersRepository = {
            findActiveByIds: jest.fn().mockResolvedValue([fakeUser('u1'), fakeUser('u2'), fakeUser('u3')]),
            findAllActive: jest.fn(),
        };
        const loader = {
            load: jest.fn().mockResolvedValue(
                new Map([
                    ['u1', { activeSessionLimit: 2 }],
                    ['u2', { activeSessionLimit: 2 }],
                    ['u3', { activeSessionLimit: 2 }],
                ])
            ),
        };
        const validator = {
            validateWithContext: jest
                .fn()
                .mockResolvedValueOnce(true)
                .mockResolvedValueOnce(false)
                .mockRejectedValueOnce(new Error('boom')),
        };

        const processor = new UsersProcessor({
            usersRepository,
            entityActionValidator: validator,
            candidateFinder: finder,
            userContextBatchLoader: loader,
        });
        await processor.processEntitiesWithActions([fakeAction('a1')]);

        expect(processor.getSuccessOperations()).toHaveLength(1);
        expect(processor.getFailedOperations()).toHaveLength(1);
        expect(processor.getErrorOperations()).toHaveLength(1);
    });

    it('exposes metrics with prefilter, bulk_context and runtime_validation durations', async () => {
        const finder = {
            find: jest
                .fn()
                .mockResolvedValueOnce(new Set(['u1']))
                .mockResolvedValueOnce(NO_PREFILTER),
        };
        const usersRepository = {
            findActiveByIds: jest.fn(),
            findAllActive: jest.fn().mockResolvedValue([fakeUser('u1')]),
        };
        const loader = { load: jest.fn().mockResolvedValue(new Map([['u1', { activeSessionLimit: 2 }]])) };
        const validator = { validateWithContext: jest.fn().mockResolvedValue(true) };

        const processor = new UsersProcessor({
            usersRepository,
            entityActionValidator: validator,
            candidateFinder: finder,
            userContextBatchLoader: loader,
        });
        await processor.processEntitiesWithActions([fakeAction('a1'), fakeAction('a2')]);

        const metrics = processor.getMetrics();
        expect(metrics.actions_total).toBe(2);
        expect(metrics.actions_with_sql_prefilter).toBe(1);
        expect(metrics.actions_without_prefilter).toBe(1);
        expect(metrics.universe_loaded).toBe(true);
        expect(metrics.runtime_validations).toBeGreaterThanOrEqual(1);
        expect(metrics.bulk_context_queries).toBe(2);
        expect(metrics.duration_ms.prefilter).toBeGreaterThanOrEqual(0);
        expect(metrics.duration_ms.bulk_context).toBeGreaterThanOrEqual(0);
        expect(metrics.duration_ms.runtime_validation).toBeGreaterThanOrEqual(0);
    });
});
