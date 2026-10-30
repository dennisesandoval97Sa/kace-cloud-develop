import { jest } from '@jest/globals';
import { GroupUpdater } from '../../src/grupos/application/update/GroupUpdater.js';
import { Groups } from '../../src/grupos/domain/Groups.js';
import { ExternalCodeGroupResolver } from '../../src/actions-queue-executions/domain/services/ExternalCodeGroupResolver.js';
import { StatusEnum } from '../../src/shared/domain/enum/StatusEnum.js';
import { GroupsMother } from './domain/GroupsMother.js';

/**
 * The automated-assignment tick caches external-code → ACTIVE group resolutions for
 * 5 minutes. A status change must invalidate that cache in both directions, otherwise
 * a just-deactivated group keeps receiving cases (or a just-activated one stays
 * invisible) until the TTL expires.
 */
describe('GroupUpdater — external-code cache invalidation', () => {
    let clearCacheSpy;

    beforeEach(() => {
        clearCacheSpy = jest.spyOn(ExternalCodeGroupResolver, 'clearCache').mockImplementation(() => {});
    });

    afterEach(() => {
        clearCacheSpy.mockRestore();
    });

    const buildUpdater = (status, overrides = {}) => {
        const group = Groups.create(GroupsMother.dto({ status, ...overrides }));
        const repository = {
            find: jest.fn().mockResolvedValue(group),
            withTransaction: jest.fn((callback) => callback({})),
            update: jest.fn().mockResolvedValue(undefined),
            saveHistory: jest.fn().mockResolvedValue(undefined),
        };
        return { updater: new GroupUpdater(repository, null), repository, group };
    };

    it('clears the cache when the group is deactivated', async () => {
        const { updater, group } = buildUpdater(StatusEnum.ACTIVE.value);

        await updater.execute({ status: StatusEnum.INACTIVE.value }, group.id.value);

        expect(clearCacheSpy).toHaveBeenCalledTimes(1);
    });

    it('clears the cache when the group is reactivated', async () => {
        const { updater, group } = buildUpdater(StatusEnum.INACTIVE.value);

        await updater.execute({ status: StatusEnum.ACTIVE.value }, group.id.value);

        expect(clearCacheSpy).toHaveBeenCalledTimes(1);
    });

    it('does not clear the cache when status is re-sent unchanged', async () => {
        const { updater, group } = buildUpdater(StatusEnum.ACTIVE.value);

        await updater.execute({ status: StatusEnum.ACTIVE.value }, group.id.value);

        expect(clearCacheSpy).not.toHaveBeenCalled();
    });

    it('does not clear the cache on an update that touches none of the resolution fields', async () => {
        const { updater, group } = buildUpdater(StatusEnum.ACTIVE.value);

        await updater.execute({ descripcion: 'nueva descripción' }, group.id.value);

        expect(clearCacheSpy).not.toHaveBeenCalled();
    });

    it('clears the cache when codigo_externo is reassigned without touching status', async () => {
        const { updater, group } = buildUpdater(StatusEnum.ACTIVE.value, { codigo_externo: 'CODE_A' });

        await updater.execute({ codigo_externo: 'CODE_B' }, group.id.value);

        expect(clearCacheSpy).toHaveBeenCalledTimes(1);
    });

    it('clears the cache when codigos_externos changes', async () => {
        const { updater, group } = buildUpdater(StatusEnum.ACTIVE.value, {
            codigos_externos: { CODE_A: 'CODE_A' },
        });

        await updater.execute({ codigos_externos: { CODE_B: 'CODE_B' } }, group.id.value);

        expect(clearCacheSpy).toHaveBeenCalledTimes(1);
    });

    it('does not clear the cache when codigos_externos is re-sent with the same content', async () => {
        const { updater, group } = buildUpdater(StatusEnum.ACTIVE.value, {
            codigos_externos: { CODE_A: 'CODE_A' },
        });

        await updater.execute({ codigos_externos: { CODE_A: 'CODE_A' } }, group.id.value);

        expect(clearCacheSpy).not.toHaveBeenCalled();
    });

    it('clears the cache only once when status and codigo_externo change together', async () => {
        const { updater, group } = buildUpdater(StatusEnum.ACTIVE.value, { codigo_externo: 'CODE_A' });

        await updater.execute({ status: StatusEnum.INACTIVE.value, codigo_externo: 'CODE_B' }, group.id.value);

        expect(clearCacheSpy).toHaveBeenCalledTimes(1);
    });

    it('still blocks deactivation through the usage guard before touching the cache', async () => {
        const group = Groups.create(GroupsMother.dto({ status: StatusEnum.ACTIVE.value }));
        const repository = {
            find: jest.fn().mockResolvedValue(group),
            withTransaction: jest.fn((callback) => callback({})),
            update: jest.fn().mockResolvedValue(undefined),
            saveHistory: jest.fn().mockResolvedValue(undefined),
        };
        const usageGuard = {
            ensureNoActiveAssignments: jest.fn().mockRejectedValue(new Error('group still in use')),
        };
        const updater = new GroupUpdater(repository, null, usageGuard);

        await expect(updater.execute({ status: StatusEnum.INACTIVE.value }, group.id.value)).rejects.toThrow(
            'group still in use'
        );

        expect(usageGuard.ensureNoActiveAssignments).toHaveBeenCalledWith(group.id.value);
        expect(repository.update).not.toHaveBeenCalled();
        expect(clearCacheSpy).not.toHaveBeenCalled();
    });
});
