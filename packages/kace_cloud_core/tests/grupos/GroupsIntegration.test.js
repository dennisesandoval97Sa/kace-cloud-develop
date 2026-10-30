import { jest } from '@jest/globals';
import { v4 as uuidV4 } from 'uuid';
import { knexConfig } from '../knexfile.js';
import { StatusEnum, ValidationFailError } from '../../src/shared';
import { CustomError } from '../../src/shared/index.js';
import {
    GroupCollectionResponse,
    GroupCounter,
    GroupCreator,
    GroupDeleter,
    GroupFinder,
    GroupRelationsCleaner,
    GroupResponse,
    Groups,
    GroupSearcher,
    GroupUpdater,
    GroupUsageGuard,
    KnexGroupsRepository,
} from '../../src/grupos';
import { KnexUsersRepository } from '../../src/users/infrastructure/KnexUsersRepository.js';
import UsersMother from '../users/domain/UsersMother.js';
import { GroupsMother } from './domain/GroupsMother';
import CasesMother from '../cases/domain/CasesMother.js';
import { KnexShiftManagementRepository } from '../../src/shift-management/index.js';
import { KnexCaseRepository } from '../../src/cases/index.js';
import { CaseGroupAssigner } from '../../src/cases/application/assign/CaseGroupAssigner.js';
import { CaseUserAssigner } from '../../src/cases/application/assign/CaseUserAssigner.js';
import { QueryDBError } from '../../src/shared/errors/QueryDBError.js';
import { ValueObjectUpdateSource } from '../../src/cases/domain/ValueObjectUpdateSource.js';
import { IdsValidator, KnexUserGroupRelationshipRepository } from '../../src/user-group-relationships/index.js';
import { GROUP_CREATE_USERS_NOT_FOUND } from '@kace/error-codes';
import { ensureParentRow } from '../support/ensureParentRow.js';

// GroupCreator/GroupUpdater run here without GroupScheduleGuard on purpose: these cases cover the
// rest of the use case. The schedule rule is covered in ShiftManagementIntegration.test.js.
describe('Groups Test', () => {
    const repository = new KnexGroupsRepository(knexConfig);
    const repositoryShiftManagement = new KnexShiftManagementRepository(knexConfig);
    const caseRepository = new KnexCaseRepository(knexConfig);
    const usersRepository = new KnexUsersRepository(repository.connection);
    const userGroupRepository = new KnexUserGroupRelationshipRepository(repository.connection);
    const idsValidator = new IdsValidator(usersRepository, repository);

    it('creates a new Groups instance', async () => {
        const dto = GroupsMother.dto();
        await GroupsMother.ensureRelations(repository.connection, dto, {});
        const groupCreator = new GroupCreator(repository);

        await groupCreator.execute(dto);

        const result = await repository.connection('grupos').select('*').where('id', dto.id);

        expect(result.length).toBe(1);
    });

    it('creates a group and its user memberships atomically using the group id', async () => {
        const user = await UsersMother.createUser(usersRepository);
        const dto = GroupsMother.dto({ user_ids: [user.id.value, user.id.value] });
        await GroupsMother.ensureRelations(repository.connection, dto, {});
        const groupCreator = new GroupCreator(repository, null, userGroupRepository, idsValidator);

        const createdGroupId = await groupCreator.execute(dto);

        const groups = await repository.connection('grupos').where('id', dto.id);
        const groupHistory = await repository.connection('history_grupos').where('entity_id', dto.id);
        const memberships = await repository.connection('rel_usuarios_grupos').where('grupo_id', dto.id);
        const membershipHistory = await repository.connection('history_rel_usuarios_grupos').where('entity_id', dto.id);

        expect(groups).toHaveLength(1);
        expect(createdGroupId).toBe(dto.id);
        expect(groupHistory).toHaveLength(1);
        expect(memberships).toEqual([{ usuario_id: user.id.value, grupo_id: dto.id }]);
        expect(membershipHistory).toHaveLength(1);
    });

    it('allows creating a group without user memberships', async () => {
        const dto = GroupsMother.dto({ user_ids: [] });
        await GroupsMother.ensureRelations(repository.connection, dto, {});
        const groupCreator = new GroupCreator(repository, null, userGroupRepository, idsValidator);

        await groupCreator.execute(dto);

        const groups = await repository.connection('grupos').where('id', dto.id);
        const memberships = await repository.connection('rel_usuarios_grupos').where('grupo_id', dto.id);

        expect(groups).toHaveLength(1);
        expect(memberships).toHaveLength(0);
    });

    it('rejects unknown user ids without leaving a group behind', async () => {
        const dto = GroupsMother.dto({ user_ids: [uuidV4()] });
        const groupCreator = new GroupCreator(repository, null, userGroupRepository, idsValidator);

        await expect(groupCreator.execute(dto)).rejects.toMatchObject({
            publicErrorCode: GROUP_CREATE_USERS_NOT_FOUND,
        });

        const groups = await repository.connection('grupos').where('id', dto.id);
        expect(groups).toHaveLength(0);
    });

    it('rolls back the group and histories when a membership cannot be saved', async () => {
        const user = await UsersMother.createUser(usersRepository);
        const dto = GroupsMother.dto({ user_ids: [user.id.value] });
        await GroupsMother.ensureRelations(repository.connection, dto, {});
        const groupCreator = new GroupCreator(repository, null, userGroupRepository, idsValidator);
        const saveSpy = jest.spyOn(userGroupRepository, 'save').mockRejectedValueOnce(new Error('membership failed'));

        await expect(groupCreator.execute(dto)).rejects.toThrow('membership failed');
        saveSpy.mockRestore();

        const groups = await repository.connection('grupos').where('id', dto.id);
        const groupHistory = await repository.connection('history_grupos').where('entity_id', dto.id);
        const memberships = await repository.connection('rel_usuarios_grupos').where('grupo_id', dto.id);
        const membershipHistory = await repository.connection('history_rel_usuarios_grupos').where('entity_id', dto.id);

        expect(groups).toHaveLength(0);
        expect(groupHistory).toHaveLength(0);
        expect(memberships).toHaveLength(0);
        expect(membershipHistory).toHaveLength(0);
    });

    it('commits the group and memberships before running the post-create action', async () => {
        const user = await UsersMother.createUser(usersRepository);
        const dto = GroupsMother.dto({ user_ids: [user.id.value] });
        await GroupsMother.ensureRelations(repository.connection, dto, {});
        const actionExecutionService = {
            execute: jest.fn().mockRejectedValueOnce(new Error('action failed')),
        };
        const groupCreator = new GroupCreator(repository, actionExecutionService, userGroupRepository, idsValidator);

        await expect(groupCreator.execute(dto)).rejects.toThrow('action failed');

        const groups = await repository.connection('grupos').where('id', dto.id);
        const memberships = await repository.connection('rel_usuarios_grupos').where('grupo_id', dto.id);

        expect(actionExecutionService.execute).toHaveBeenCalledTimes(1);
        expect(groups).toHaveLength(1);
        expect(memberships).toEqual([{ usuario_id: user.id.value, grupo_id: dto.id }]);
    });

    it('should throw an error when creating an existing Groups', async () => {
        const group = await GroupsMother.createGroup(repository, repositoryShiftManagement);
        const groupCreator = new GroupCreator(repository);

        const dto = { ...GroupsMother.dto(), id: group.id.value };
        await GroupsMother.ensureRelations(repository.connection, dto, {});

        await expect(groupCreator.execute(dto)).rejects.toThrow(
            new CustomError(`Group with id ${dto.id} already exists`)
        );
    });

    it('should not create a new Groups instance when null dto', async () => {
        const groupCreator = new GroupCreator(repository);
        await expect(groupCreator.execute(null)).rejects.toThrow(Error);
    });

    it('finds an existing Group instance by id', async () => {
        const group = await GroupsMother.createGroup(repository, repositoryShiftManagement);
        const groupFinder = new GroupFinder(repository);

        const groups = await groupFinder.execute(group.id.value);

        expect(groups).not.toBeNull();
        expect(groups).toBeInstanceOf(GroupResponse);
    });

    it('return null if not found a record', async () => {
        const groupFinder = new GroupFinder(repository);

        await expect(groupFinder.execute(uuidV4())).rejects.toThrow(CustomError);
    });

    it('updates an existing Group instance', async () => {
        const group = await GroupsMother.createGroup(repository, repositoryShiftManagement);
        const groupUpdater = new GroupUpdater(repository);

        const dtoUpdate = {
            nombre: 'Nuevo nombre actualizado',
            updated_at: new Date().toISOString(),
            updated_by: uuidV4(),
        };

        await groupUpdater.execute(dtoUpdate, group.id.value);

        const result = await repository.find(group.id);

        expect(result).toBeInstanceOf(Groups);
        expect(result.nombre.value).toEqual(dtoUpdate.nombre);
        expect(result.updated_at.value).toEqual(dtoUpdate.updated_at);
        expect(result.updated_by.value).toEqual(dtoUpdate.updated_by);
    });

    it('should return an error when update a non-existent Groups instance', async () => {
        await GroupsMother.createGroup(repository, repositoryShiftManagement);
        const groupUpdater = new GroupUpdater(repository);

        await expect(groupUpdater.execute({ status: StatusEnum.ACTIVE.value }, uuidV4())).rejects.toThrow(CustomError);
    });

    it('deletes an existing Groups instance by id', async () => {
        const group = await GroupsMother.createGroup(repository, repositoryShiftManagement);
        const groupDeleter = new GroupDeleter(repository);

        const deleteDto = {
            deleted_at: new Date().toISOString(),
            deleted_by: uuidV4(),
        };

        await groupDeleter.execute(group.id.value, deleteDto);

        const result = await repository.find(group.id);

        expect(result).toBeNull();
    });

    it('should return an error when delete a non-existent Group instance', async () => {
        await GroupsMother.createGroup(repository, repositoryShiftManagement);
        const groupDeleter = new GroupDeleter(repository);

        const deleteDto = {
            deleted_at: new Date().toISOString(),
            deleted_by: uuidV4(),
        };

        await expect(groupDeleter.execute(uuidV4(), deleteDto)).rejects.toThrow(CustomError);
    });

    it('searches for Groups instances with given criteria', async () => {
        for (let i = 0; i < 10; i++) {
            await GroupsMother.createRandomGroup(repository);
        }
        const dtoCriteria = {
            filter: undefined,
            relationship: undefined,
            limit: 10,
            offset: 0,
            order: { field: 'created_at', direction: 'asc' },
        };
        const groupSearcher = new GroupSearcher(repository, caseRepository);

        const groupResult = await groupSearcher.execute(dtoCriteria);

        expect(groupResult).toBeInstanceOf(GroupCollectionResponse);
    });

    it('should return an error when not exist field is filtered', async () => {
        for (let i = 0; i < 10; i++) {
            await GroupsMother.createRandomGroup(repository);
        }
        const dtoCriteria = {
            filter: [
                {
                    field: 'not_exist',
                    operator: 'eq',
                    value: 'value',
                    type: 'AND',
                },
            ],
            relationship: undefined,
            limit: 10,
            offset: 0,
            order: { field: 'created_at', direction: 'asc' },
        };

        await expect(new GroupSearcher(repository, caseRepository).execute(dtoCriteria)).rejects.toThrow(QueryDBError);
    });

    it('counts the total number of Groups instances', async () => {
        // La semilla del tenant y los `it` anteriores dejan grupos en la misma
        // base, asi que contar la tabla entera nunca da 10: el contador se
        // acota a los grupos que crea este test.
        const descripcion = `conteo ${uuidV4()}`;
        for (let i = 0; i < 10; i++) {
            await GroupsMother.createRandomGroup(repository, null, { descripcion });
        }

        const dtoCriteria = {
            filter: [
                {
                    field: 'descripcion',
                    operator: 'eq',
                    value: descripcion,
                    type: 'AND',
                },
            ],
            relationship: undefined,
            limit: 10,
            offset: 0,
            order: { field: 'created_at', direction: 'asc' },
        };

        const groupCounter = new GroupCounter(repository);

        const groupResult = await groupCounter.execute(dtoCriteria);

        expect(Number(groupResult.count)).toBe(10);
    });

    it('should return a zero for not found criteria', async () => {
        for (let i = 0; i < 10; i++) {
            await GroupsMother.createRandomGroup(repository);
        }

        const dtoCriteria = {
            filter: [
                {
                    field: 'status',
                    operator: 'eq',
                    value: '10',
                    type: 'AND',
                },
            ],
            relationship: undefined,
            limit: 10,
            offset: 0,
            order: { field: 'created_at', direction: 'asc' },
        };

        const groupConuter = new GroupCounter(repository);

        const groupResult = await groupConuter.execute(dtoCriteria);

        expect(Number(groupResult.count)).toBe(0);
    });

    it('searches for Groups instances with ans counters given criteria', async () => {
        const group = await GroupsMother.createGroup(repository, repositoryShiftManagement);
        const dto = CasesMother.dto(caseRepository);
        await CasesMother.ensureRelations(caseRepository.connection, dto, {});

        const dtoPosition1 = { ...dto, grupo_id: group.id.value, ans_posicion: 1 };
        const dtoPosition2 = { ...dto, grupo_id: group.id.value, id: uuidV4(), ans_posicion: 2 };
        const dtoPosition3 = { ...dto, grupo_id: group.id.value, id: uuidV4(), ans_posicion: 3 };

        await CasesMother.createCase(caseRepository, dtoPosition1);
        await CasesMother.createCase(caseRepository, dtoPosition2);
        await CasesMother.createCase(caseRepository, dtoPosition3);

        const dtoCriteria = {
            filter: [
                {
                    field: 'id',
                    operator: 'eq',
                    value: group.id.value,
                    type: 'AND',
                },
            ],
            relationship: undefined,
            limit: 10,
            offset: 0,
            order: { field: 'created_at', direction: 'asc' },
        };
        const groupSearcher = new GroupSearcher(repository, caseRepository);

        const groupResult = await groupSearcher.execute(dtoCriteria);

        expect(groupResult).toBeInstanceOf(GroupCollectionResponse);
        expect(groupResult.toJson().data.items[0].expiredCases).toBeDefined();
    });

    it('should throw an error when creating a Group with a duplicate name', async () => {
        const dto1 = GroupsMother.dto();
        const dto2 = GroupsMother.dto();
        dto2.nombre = dto1.nombre;
        await GroupsMother.ensureRelations(repository.connection, dto1, {});
        await GroupsMother.ensureRelations(repository.connection, dto2, {});

        const groupCreator = new GroupCreator(repository);

        await groupCreator.execute(dto1);

        await expect(groupCreator.execute(dto2)).rejects.toThrow(
            `The following value(s) already exist: nombre '${dto1.nombre}'.`
        );
    });

    it('should throw an error when updating a Group to have a duplicate name', async () => {
        const group1 = await GroupsMother.createGroup(repository, repositoryShiftManagement);
        const group2 = await GroupsMother.createGroup(repository, repositoryShiftManagement);

        const groupUpdater = new GroupUpdater(repository);

        await expect(groupUpdater.execute({ nombre: group1.nombre.value }, group2.id.value)).rejects.toThrow(
            `The following value(s) already exist: nombre '${group1.nombre.value}'.`
        );
    });

    it('should error when assigning a group to a case that does not exist', async () => {
        const group = await GroupsMother.createGroup(repository, repositoryShiftManagement);
        const groupAssign = new CaseUserAssigner(caseRepository);

        await expect(groupAssign.execute(uuidV4(), group.id.value, uuidV4())).rejects.toThrow(ValidationFailError);
    });

    it('should error when assigning a group that has no users to a case', async () => {
        const assignationService = { executeOrFail: async () => null };
        const kace = await CasesMother.createCase(caseRepository);
        const groupAssign = new CaseGroupAssigner(caseRepository, assignationService);
        await expect(groupAssign.execute(kace.id.value, uuidV4())).rejects.toThrow(CustomError);
    });

    it('assign a group to a case', async () => {
        const responsableId = uuidV4();
        const groupId = uuidV4();
        await ensureParentRow(caseRepository.connection, 'usuarios', responsableId);
        await ensureParentRow(caseRepository.connection, 'grupos', groupId);
        const assignationService = { executeOrFail: async () => responsableId };
        const currentUser = { id: { value: uuidV4() } };
        const kace = await CasesMother.createCase(caseRepository);
        const groupAssign = new CaseGroupAssigner(caseRepository, assignationService, currentUser);

        // `expect(fn).not.toThrow()` con una funcion async no espera a nada:
        // el matcher llama a `fn`, recibe una promesa, ve que no hubo excepcion
        // SINCRONA y da el test por bueno. El `await` de delante espera al
        // matcher, no al trabajo. Asi que el `execute` -update de `cases` +
        // insert en `history_cases` + evento- seguia vivo cuando arrancaba el
        // test siguiente, y su INSERT chocaba contra el TRUNCATE del reset:
        // interbloqueo real, con el INSERT como victima y la rotura anotada
        // contra el `it` de al lado. Con `resolves` la promesa se espera de
        // verdad y el archivo vuelve a ser secuencial.
        await expect(groupAssign.execute(kace.id.value, groupId)).resolves.toBeUndefined();
    });

    it('assign a group to a case with update_source', async () => {
        const responsableId = uuidV4();
        const groupId = uuidV4();
        await ensureParentRow(caseRepository.connection, 'usuarios', responsableId);
        await ensureParentRow(caseRepository.connection, 'grupos', groupId);
        const assignationService = { executeOrFail: async () => responsableId };
        const currentUser = { id: { value: uuidV4() } };
        const kace = await CasesMother.createCase(caseRepository);
        const groupAssign = new CaseGroupAssigner(caseRepository, assignationService, currentUser);

        await groupAssign.execute(kace.id.value, groupId, [uuidV4()]);

        const updated = await caseRepository.find(kace.id);
        expect(updated.update_source.value).toBe(ValueObjectUpdateSource.MANUAL);
        expect(updated.last_assigned_at.value).not.toBeNull();
    });

    it('assign cases in bulk should set update_source bulk', async () => {
        const responsableId = uuidV4();
        const groupId = uuidV4();
        await ensureParentRow(caseRepository.connection, 'usuarios', responsableId);
        await ensureParentRow(caseRepository.connection, 'grupos', groupId);
        const assignationService = { executeOrFail: async () => responsableId };
        const currentUser = { id: { value: uuidV4() } };
        const kace = await CasesMother.createCase(caseRepository);

        const groupAssign = new CaseGroupAssigner(caseRepository, assignationService, currentUser);

        await groupAssign.execute(kace.id.value, groupId, [uuidV4(), uuidV4()]);

        const updated = await caseRepository.find(kace.id);
        expect(updated.update_source.value).toBe(ValueObjectUpdateSource.BULK);
    });

    describe('GroupUsageGuard cascade blocking', () => {
        const deleteDtoFor = () => ({ deleted_at: new Date().toISOString(), deleted_by: uuidV4() });
        const recentLastSeen = () => new Date().toISOString();
        const staleLastSeen = () => new Date(Date.now() - 60 * 60 * 1000).toISOString();
        const alwaysTwoMinutes = { resolveForGroup: async () => 2 };

        it('GroupDeleter blocks deletion when a recently-active user has grupo_activo = groupId', async () => {
            const group = await GroupsMother.createGroup(repository, repositoryShiftManagement);
            await usersRepository
                .connection('usuarios')
                .insert(UsersMother.dto({ grupo_activo: group.id.value, last_seen_at: recentLastSeen() }));

            const guard = new GroupUsageGuard(usersRepository, alwaysTwoMinutes);
            const deleter = new GroupDeleter(repository, null, guard);

            await expect(deleter.execute(group.id.value, deleteDtoFor())).rejects.toMatchObject({ statusCode: 400 });

            const stillThere = await repository.find(group.id);
            expect(stillThere).not.toBeNull();
        });

        it('GroupDeleter succeeds when no user has this group as grupo_activo', async () => {
            const group = await GroupsMother.createGroup(repository, repositoryShiftManagement);

            const guard = new GroupUsageGuard(usersRepository, alwaysTwoMinutes);
            const deleter = new GroupDeleter(repository, null, guard);

            await deleter.execute(group.id.value, deleteDtoFor());

            const afterDelete = await repository.find(group.id);
            expect(afterDelete).toBeNull();
        });

        it('GroupDeleter succeeds when grupo_activo users are outside the last_seen window', async () => {
            const group = await GroupsMother.createGroup(repository, repositoryShiftManagement);
            const userDto = UsersMother.dto({
                grupo_activo: group.id.value,
                last_seen_at: staleLastSeen(),
            });
            await usersRepository.connection('usuarios').insert(userDto);

            const guard = new GroupUsageGuard(usersRepository, alwaysTwoMinutes);
            const deleter = new GroupDeleter(repository, null, guard);

            await deleter.execute(group.id.value, deleteDtoFor());

            const afterDelete = await repository.find(group.id);
            expect(afterDelete).toBeNull();

            const user = await usersRepository.connection('usuarios').where({ id: userDto.id }).first();
            expect(user.grupo_activo).toBe(group.id.value);
        });

        it('GroupDeleter remains backward-compatible when no guard is provided', async () => {
            const group = await GroupsMother.createGroup(repository, repositoryShiftManagement);
            await usersRepository.connection('usuarios').insert(UsersMother.dto({ grupo_activo: group.id.value }));

            const deleter = new GroupDeleter(repository);
            await deleter.execute(group.id.value, deleteDtoFor());

            const afterDelete = await repository.find(group.id);
            expect(afterDelete).toBeNull();
        });

        it('GroupUpdater blocks status 1->0 when a recently-active user has grupo_activo = groupId', async () => {
            const group = await GroupsMother.createGroup(repository, repositoryShiftManagement);
            await usersRepository
                .connection('usuarios')
                .insert(UsersMother.dto({ grupo_activo: group.id.value, last_seen_at: recentLastSeen() }));

            const guard = new GroupUsageGuard(usersRepository, alwaysTwoMinutes);
            const updater = new GroupUpdater(repository, null, guard);

            await expect(
                updater.execute(
                    { status: StatusEnum.INACTIVE.value, updated_at: new Date().toISOString(), updated_by: uuidV4() },
                    group.id.value
                )
            ).rejects.toMatchObject({ statusCode: 400 });

            const stillActive = await repository.find(group.id);
            expect(stillActive.status.value).toBe(StatusEnum.ACTIVE.value);
        });

        it('GroupUpdater allows status 1->0 when no user has grupo_activo = groupId', async () => {
            const group = await GroupsMother.createGroup(repository, repositoryShiftManagement);

            const guard = new GroupUsageGuard(usersRepository, alwaysTwoMinutes);
            const updater = new GroupUpdater(repository, null, guard);

            await updater.execute(
                { status: StatusEnum.INACTIVE.value, updated_at: new Date().toISOString(), updated_by: uuidV4() },
                group.id.value
            );

            const refreshed = await repository.find(group.id);
            expect(refreshed.status.value).toBe(StatusEnum.INACTIVE.value);
        });

        it('GroupUpdater allows status 1->0 when grupo_activo users are outside the last_seen window', async () => {
            const group = await GroupsMother.createGroup(repository, repositoryShiftManagement);
            const userDto = UsersMother.dto({
                grupo_activo: group.id.value,
                last_seen_at: staleLastSeen(),
            });
            await usersRepository.connection('usuarios').insert(userDto);

            const guard = new GroupUsageGuard(usersRepository, alwaysTwoMinutes);
            const updater = new GroupUpdater(repository, null, guard);

            await updater.execute(
                { status: StatusEnum.INACTIVE.value, updated_at: new Date().toISOString(), updated_by: uuidV4() },
                group.id.value
            );

            const refreshed = await repository.find(group.id);
            expect(refreshed.status.value).toBe(StatusEnum.INACTIVE.value);

            const user = await usersRepository.connection('usuarios').where({ id: userDto.id }).first();
            expect(user.grupo_activo).toBe(group.id.value);
        });

        it('GroupUpdater does NOT consult the guard on reactivation (0->1) or non-status updates', async () => {
            const group = await GroupsMother.createGroup(repository, repositoryShiftManagement, {
                status: StatusEnum.INACTIVE.value,
            });
            await usersRepository.connection('usuarios').insert(UsersMother.dto({ grupo_activo: group.id.value }));

            const guardSpy = {
                ensureNoActiveAssignments: jest.fn(),
            };
            const updater = new GroupUpdater(repository, null, guardSpy);

            await updater.execute(
                { status: StatusEnum.ACTIVE.value, updated_at: new Date().toISOString(), updated_by: uuidV4() },
                group.id.value
            );
            await updater.execute(
                { nombre: 'Nombre cambiado', updated_at: new Date().toISOString(), updated_by: uuidV4() },
                group.id.value
            );

            expect(guardSpy.ensureNoActiveAssignments).not.toHaveBeenCalled();
        });
    });

    describe('Group relations cleanup on delete/deactivate', () => {
        const knex = () => repository.connection;
        const deleteDtoFor = () => ({ deleted_at: new Date().toISOString(), deleted_by: uuidV4() });

        const insertRelations = async (groupId, count) => {
            const rows = Array.from({ length: count }, () => ({ usuario_id: uuidV4(), grupo_id: groupId }));
            await Promise.all(rows.map((row) => ensureParentRow(knex(), 'usuarios', row.usuario_id)));
            await knex()('rel_usuarios_grupos').insert(rows);
            return rows;
        };

        it('GroupDeleter wipes rel_usuarios_grupos and records history with reason group_deleted', async () => {
            const group = await GroupsMother.createGroup(repository, repositoryShiftManagement);
            await insertRelations(group.id.value, 3);

            const cleaner = new GroupRelationsCleaner(knex());
            const deleter = new GroupDeleter(repository, null, undefined, cleaner);

            await deleter.execute(group.id.value, deleteDtoFor());

            const remaining = await knex()('rel_usuarios_grupos').where({ grupo_id: group.id.value });
            const history = await knex()('rel_usuarios_grupos_history').select('*');
            expect(remaining).toHaveLength(0);
            expect(history).toHaveLength(3);
            const condition =
                typeof history[0].condition === 'string' ? JSON.parse(history[0].condition) : history[0].condition;
            expect(condition.reason).toBe('group_deleted');
        });

        it('GroupDeleter with cleaner does not fail when there are no relations', async () => {
            const group = await GroupsMother.createGroup(repository, repositoryShiftManagement);

            const cleaner = new GroupRelationsCleaner(knex());
            const deleter = new GroupDeleter(repository, null, undefined, cleaner);

            await deleter.execute(group.id.value, deleteDtoFor());

            const history = await knex()('rel_usuarios_grupos_history').select('*');
            expect(history).toHaveLength(0);
            expect(await repository.find(group.id)).toBeNull();
        });

        it('GroupUpdater preserves rel_usuarios_grupos on deactivation (status 1->2)', async () => {
            const group = await GroupsMother.createGroup(repository, repositoryShiftManagement);
            await insertRelations(group.id.value, 2);

            const updater = new GroupUpdater(repository);

            await updater.execute(
                { status: StatusEnum.INACTIVE.value, updated_at: new Date().toISOString(), updated_by: uuidV4() },
                group.id.value
            );

            const remaining = await knex()('rel_usuarios_grupos').where({ grupo_id: group.id.value });
            const history = await knex()('rel_usuarios_grupos_history').select('*');
            const refreshed = await repository.find(group.id);
            expect(remaining).toHaveLength(2);
            expect(history).toHaveLength(0);
            expect(refreshed.status.value).toBe(StatusEnum.INACTIVE.value);
        });

        it('GroupUpdater does NOT touch rel_usuarios_grupos on non-status updates', async () => {
            const group = await GroupsMother.createGroup(repository, repositoryShiftManagement);
            await insertRelations(group.id.value, 2);

            const updater = new GroupUpdater(repository);

            await updater.execute(
                { nombre: 'Otro nombre', updated_at: new Date().toISOString(), updated_by: uuidV4() },
                group.id.value
            );

            const remaining = await knex()('rel_usuarios_grupos').where({ grupo_id: group.id.value });
            const history = await knex()('rel_usuarios_grupos_history').select('*');
            expect(remaining).toHaveLength(2);
            expect(history).toHaveLength(0);
        });

        it('GroupUpdater does NOT touch rel_usuarios_grupos on reactivation (2->1)', async () => {
            const group = await GroupsMother.createGroup(repository, repositoryShiftManagement, {
                status: StatusEnum.INACTIVE.value,
            });
            await insertRelations(group.id.value, 2);

            const updater = new GroupUpdater(repository);

            await updater.execute(
                { status: StatusEnum.ACTIVE.value, updated_at: new Date().toISOString(), updated_by: uuidV4() },
                group.id.value
            );

            const remaining = await knex()('rel_usuarios_grupos').where({ grupo_id: group.id.value });
            const history = await knex()('rel_usuarios_grupos_history').select('*');
            expect(remaining).toHaveLength(2);
            expect(history).toHaveLength(0);
        });

        it('GroupDeleter/GroupUpdater remain backward-compatible without cleaner', async () => {
            const group = await GroupsMother.createGroup(repository, repositoryShiftManagement);
            await insertRelations(group.id.value, 2);

            const deleter = new GroupDeleter(repository);
            await deleter.execute(group.id.value, deleteDtoFor());

            const remaining = await knex()('rel_usuarios_grupos').where({ grupo_id: group.id.value });
            const history = await knex()('rel_usuarios_grupos_history').select('*');
            expect(remaining).toHaveLength(2);
            expect(history).toHaveLength(0);
        });

        it('rolls back the cleanup when repository.delete fails (transactional)', async () => {
            const group = await GroupsMother.createGroup(repository, repositoryShiftManagement);
            await insertRelations(group.id.value, 2);

            const spy = jest.spyOn(repository, 'delete').mockRejectedValue(new Error('boom'));
            try {
                const cleaner = new GroupRelationsCleaner(knex());
                const deleter = new GroupDeleter(repository, null, undefined, cleaner);

                await expect(deleter.execute(group.id.value, deleteDtoFor())).rejects.toThrow('boom');

                const remaining = await knex()('rel_usuarios_grupos').where({ grupo_id: group.id.value });
                const history = await knex()('rel_usuarios_grupos_history').select('*');
                expect(remaining).toHaveLength(2);
                expect(history).toHaveLength(0);
            } finally {
                spy.mockRestore();
            }
        });
    });
});
