import { jest } from '@jest/globals';
import { UserContextBatchLoader } from '../../src/actions-queue-executions/domain/services/UserContextBatchLoader.js';

const makeUser = (id, grupoActivo) => ({
    id: { value: id },
    grupo_activo: { value: grupoActivo },
});

const makeGroup = (id, configurationId) => ({
    id: { value: id },
    configuration_id: { value: configurationId },
});

const makeConfig = (id, activeSessionLimit) => ({
    id: { value: id },
    settings: {
        behaviors: {
            getConfig: (mod, sub) =>
                mod === 'agente' && sub === 'casos' ? { assignment_active_session_limit: activeSessionLimit } : null,
        },
    },
});

describe('UserContextBatchLoader', () => {
    it('returns empty Map when no users have grupo_activo', async () => {
        const loader = new UserContextBatchLoader({
            groupsRepository: { findByIds: jest.fn() },
            globalConfigurationRepository: { findByIds: jest.fn() },
        });

        const result = await loader.load([makeUser('u1', null), makeUser('u2', undefined)]);

        expect(result.size).toBe(0);
    });

    it('precarga activeSessionLimit per user via batched repo calls', async () => {
        const groupsRepo = {
            findByIds: jest.fn().mockResolvedValue([makeGroup('g1', 'c1'), makeGroup('g2', 'c2')]),
        };
        const configRepo = {
            findByIds: jest.fn().mockResolvedValue([makeConfig('c1', 7), makeConfig('c2', 10)]),
        };
        const loader = new UserContextBatchLoader({
            groupsRepository: groupsRepo,
            globalConfigurationRepository: configRepo,
        });

        const result = await loader.load([makeUser('u1', 'g1'), makeUser('u2', 'g2'), makeUser('u3', 'g1')]);

        expect(groupsRepo.findByIds).toHaveBeenCalledTimes(1);
        expect([...groupsRepo.findByIds.mock.calls[0][0]].sort()).toEqual(['g1', 'g2']);
        expect(configRepo.findByIds).toHaveBeenCalledTimes(1);
        expect([...configRepo.findByIds.mock.calls[0][0]].sort()).toEqual(['c1', 'c2']);

        expect(result.get('u1')).toEqual({ activeSessionLimit: 7 });
        expect(result.get('u2')).toEqual({ activeSessionLimit: 10 });
        expect(result.get('u3')).toEqual({ activeSessionLimit: 7 });
    });

    it('uses default activeSessionLimit when group has no configuration', async () => {
        const groupsRepo = {
            findByIds: jest.fn().mockResolvedValue([{ id: { value: 'g1' }, configuration_id: { value: null } }]),
        };
        const configRepo = { findByIds: jest.fn().mockResolvedValue([]) };
        const loader = new UserContextBatchLoader({
            groupsRepository: groupsRepo,
            globalConfigurationRepository: configRepo,
            defaultActiveSessionLimit: 2,
        });

        const result = await loader.load([makeUser('u1', 'g1')]);

        expect(result.get('u1')).toEqual({ activeSessionLimit: 2 });
    });

    it('uses default activeSessionLimit when assignment_active_session_limit is 0', async () => {
        const groupsRepo = {
            findByIds: jest.fn().mockResolvedValue([makeGroup('g1', 'c1')]),
        };
        const configRepo = {
            findByIds: jest.fn().mockResolvedValue([makeConfig('c1', 0)]),
        };
        const loader = new UserContextBatchLoader({
            groupsRepository: groupsRepo,
            globalConfigurationRepository: configRepo,
            defaultActiveSessionLimit: 2,
        });

        const result = await loader.load([makeUser('u1', 'g1')]);

        expect(result.get('u1')).toEqual({ activeSessionLimit: 2 });
    });

    it('returns empty Map and does NOT throw when groupsRepository.findByIds throws', async () => {
        const loader = new UserContextBatchLoader({
            groupsRepository: { findByIds: jest.fn().mockRejectedValue(new Error('boom')) },
            globalConfigurationRepository: { findByIds: jest.fn() },
        });

        const result = await loader.load([makeUser('u1', 'g1')]);

        expect(result.size).toBe(0);
    });
});
