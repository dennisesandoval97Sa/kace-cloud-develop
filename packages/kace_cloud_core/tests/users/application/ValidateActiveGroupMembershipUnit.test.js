import { jest } from '@jest/globals';
import { v4 as uuidv4 } from 'uuid';
import { ValidateActiveGroupMembership } from '../../../src/users/application/validate-active-group/ValidateActiveGroupMembership.js';
import { StatusEnum } from '../../../src/shared/domain/enum/StatusEnum.js';

describe('ValidateActiveGroupMembership', () => {
    const userId = uuidv4();
    const groupId = uuidv4();
    const otherGroupId = uuidv4();

    const makeService = ({ relationship = null, group = null, clearActiveGroup = jest.fn() } = {}) => {
        const findRelationship = jest.fn().mockResolvedValue(relationship);
        const findGroup = jest.fn().mockResolvedValue(group);
        return {
            service: new ValidateActiveGroupMembership({ findRelationship, findGroup, clearActiveGroup }),
            findRelationship,
            findGroup,
            clearActiveGroup,
        };
    };

    /** Stands in for a `Groups` aggregate, which owns the isActive() rule. */
    const groupDouble = (status) => ({
        isDeleted: () => false,
        status: { value: status },
        isActive: () => status === StatusEnum.ACTIVE.value,
    });

    const activeGroup = groupDouble(StatusEnum.ACTIVE.value);

    const inactiveGroup = groupDouble(StatusEnum.INACTIVE.value);

    it('returns belongs_to_group true and does not clear when membership and active group are valid', async () => {
        const { service, clearActiveGroup } = makeService({
            relationship: { usuario_id: userId, grupo_id: groupId },
            group: activeGroup,
        });

        const result = await service.execute({ userId, groupId, currentGrupoActivo: groupId });

        expect(result).toEqual({
            belongs_to_group: true,
            current_grupo_activo: groupId,
        });
        expect(clearActiveGroup).not.toHaveBeenCalled();
    });

    it('clears grupo_activo when the user no longer belongs to the active group', async () => {
        const clearActiveGroup = jest.fn().mockResolvedValue(undefined);
        const { service } = makeService({ relationship: null, group: activeGroup, clearActiveGroup });

        const result = await service.execute({ userId, groupId, currentGrupoActivo: groupId });

        expect(clearActiveGroup).toHaveBeenCalledWith(userId);
        expect(result).toEqual({
            belongs_to_group: false,
            current_grupo_activo: null,
        });
    });

    it('clears grupo_activo when the active group is deactivated', async () => {
        const clearActiveGroup = jest.fn().mockResolvedValue(undefined);
        const { service } = makeService({
            relationship: { usuario_id: userId, grupo_id: groupId },
            group: inactiveGroup,
            clearActiveGroup,
        });

        const result = await service.execute({ userId, groupId, currentGrupoActivo: groupId });

        expect(clearActiveGroup).toHaveBeenCalledWith(userId);
        expect(result).toEqual({
            belongs_to_group: false,
            current_grupo_activo: null,
        });
    });

    it('does not clear a different grupo_activo when the requested group is only a stale client value', async () => {
        const clearActiveGroup = jest.fn();
        const { service } = makeService({
            relationship: null,
            group: activeGroup,
            clearActiveGroup,
        });

        const result = await service.execute({
            userId,
            groupId,
            currentGrupoActivo: otherGroupId,
        });

        expect(clearActiveGroup).not.toHaveBeenCalled();
        expect(result).toEqual({
            belongs_to_group: false,
            current_grupo_activo: otherGroupId,
        });
    });

    it('clears grupo_activo when the active group no longer exists', async () => {
        const clearActiveGroup = jest.fn().mockResolvedValue(undefined);
        const { service } = makeService({
            relationship: { usuario_id: userId, grupo_id: groupId },
            group: null,
            clearActiveGroup,
        });

        const result = await service.execute({ userId, groupId, currentGrupoActivo: groupId });

        expect(clearActiveGroup).toHaveBeenCalledWith(userId);
        expect(result).toEqual({
            belongs_to_group: false,
            current_grupo_activo: null,
        });
    });

    it('resolves current_grupo_activo to null (not undefined) when currentGrupoActivo is nullish and the group is not current', async () => {
        const { service, clearActiveGroup } = makeService({
            relationship: { usuario_id: userId, grupo_id: groupId },
            group: activeGroup,
        });

        const result = await service.execute({ userId, groupId, currentGrupoActivo: undefined });

        expect(clearActiveGroup).not.toHaveBeenCalled();
        expect(result.current_grupo_activo).toBeNull();
    });
});
