import {
    DomainUserFinder,
    KnexUsersRepository,
    Login,
    User,
    UserCollectionResponse,
    UserCounter,
    UserCreator,
    UserDeleter,
    UserFinder,
    UserResponse,
    UserSearcher,
    UserUpdater,
    UserBulkUpdater,
} from '../../src/users';
import { UserIntegrationActivityUpdater } from '../../src/users/application/update/UserIntegrationActivityUpdater.js';
import { v4 as uuidV4, v4 as uuid } from 'uuid';
import UsersMother from './domain/UsersMother';
import { knexConfig } from '../knexfile.js';
import { AccountTypeEnum, Helper, ValidationFailError, Crypto } from '../../src/shared/index.js';
import {
    USER_CREATE_ACTIVE_GROUP_NOT_IN_MEMBERSHIPS,
    USER_CREATE_GROUPS_NOT_FOUND,
    USER_CREATE_GROUPS_REQUIRED,
} from '@kace/error-codes';
import CasesMother from '../cases/domain/CasesMother.js';
import RoleMother from '../role/domain/RoleMother.js';
import { KnexCaseRepository } from '../../src/cases/index.js';
import { KnexRoleRepository } from '../../src/role/infrastructure/persistence/KnexRoleRepository.js';
import { CaseUserAssigner } from '../../src/cases/application/assign/CaseUserAssigner.js';
import { KnexGroupsRepository } from '../../src/grupos/index.js';
import { GroupsMother } from '../grupos/domain/GroupsMother.js';
import { KnexShiftManagementRepository } from '../../src/shift-management/index.js';
import { IdsValidator, KnexUserGroupRelationshipRepository } from '../../src/user-group-relationships/index.js';
import { ensureParentRow } from '../support/ensureParentRow.js';

describe('User Integration Tests', () => {
    const repository = new KnexUsersRepository(knexConfig);
    const caseRepository = new KnexCaseRepository(repository.connection);
    const roleRepository = new KnexRoleRepository(repository.connection);
    const groupRepository = new KnexGroupsRepository(repository.connection);
    const shiftManagementRepository = new KnexShiftManagementRepository(repository.connection);
    const userGroupRepository = new KnexUserGroupRelationshipRepository(repository.connection);
    const idsValidator = new IdsValidator(repository, groupRepository);

    it('should create a User', async () => {
        const dto = UsersMother.dto();
        const userCreator = new UserCreator(repository);

        await userCreator.execute(dto);

        const result = await repository.connection('usuarios').select('*').where('id', dto.id);

        expect(result.length).toBe(1);
    });

    it('Can create a Service User', async () => {
        const dto = UsersMother.dto();
        const userCreator = new UserCreator(repository);

        await userCreator.execute({
            ...dto,
            account_type: AccountTypeEnum.SERVICE.value,
        });

        const result = await repository.connection('usuarios').select('*').where('id', dto.id);

        expect(result.length).toBe(1);
        expect(result[0].account_type).toBe(AccountTypeEnum.SERVICE.value);
    });

    it('product create persists user and group memberships atomically', async () => {
        const group = await GroupsMother.createGroup(groupRepository, shiftManagementRepository);
        const dto = UsersMother.dto({
            group_ids: [group.id.value, group.id.value],
        });
        const userCreator = new UserCreator(repository, null, userGroupRepository, idsValidator);

        await userCreator.execute(dto);

        const users = await repository.connection('usuarios').select('*').where('id', dto.id);
        const memberships = await repository.connection('rel_usuarios_grupos').select('*').where('usuario_id', dto.id);
        const history = await repository
            .connection('history_rel_usuarios_grupos')
            .select('*')
            .where('entity_id', group.id.value);

        expect(users.length).toBe(1);
        expect(users[0].grupo_activo).toBe(group.id.value);
        expect(memberships).toHaveLength(1);
        expect(memberships[0].grupo_id).toBe(group.id.value);
        expect(history.length).toBeGreaterThanOrEqual(1);
    });

    it('product create rejects missing group_ids', async () => {
        const dto = UsersMother.dto();
        const userCreator = new UserCreator(repository, null, userGroupRepository, idsValidator);

        await expect(userCreator.execute(dto)).rejects.toMatchObject({
            publicErrorCode: USER_CREATE_GROUPS_REQUIRED,
        });
        await expect(userCreator.execute(dto)).rejects.toThrow(ValidationFailError);

        const users = await repository.connection('usuarios').select('*').where('id', dto.id);
        expect(users.length).toBe(0);
    });

    it('product create rejects grupo_activo outside group_ids', async () => {
        const group = await GroupsMother.createGroup(groupRepository, shiftManagementRepository);
        const otherGroupId = uuidV4();
        const dto = UsersMother.dto({
            group_ids: [group.id.value],
            grupo_activo: otherGroupId,
        });
        const userCreator = new UserCreator(repository, null, userGroupRepository, idsValidator);

        await expect(userCreator.execute(dto)).rejects.toMatchObject({
            publicErrorCode: USER_CREATE_ACTIVE_GROUP_NOT_IN_MEMBERSHIPS,
        });

        const users = await repository.connection('usuarios').select('*').where('id', dto.id);
        const memberships = await repository.connection('rel_usuarios_grupos').select('*').where('usuario_id', dto.id);
        expect(users.length).toBe(0);
        expect(memberships.length).toBe(0);
    });

    it('product create rejects unknown group_ids without leaving a user', async () => {
        const dto = UsersMother.dto({
            group_ids: [uuidV4()],
        });
        const userCreator = new UserCreator(repository, null, userGroupRepository, idsValidator);

        await expect(userCreator.execute(dto)).rejects.toMatchObject({
            publicErrorCode: USER_CREATE_GROUPS_NOT_FOUND,
        });

        const users = await repository.connection('usuarios').select('*').where('id', dto.id);
        expect(users.length).toBe(0);
    });

    // KACE-SKIP(decision-pendiente): ya estaba skip en el commit que importo el
    // paquete completo (455126a15, 2025-11-03), sin comentario ni contexto. No se
    // encontro el motivo original en el historial: falta que alguien lo decida.
    it.skip('Can login with a service user account', async () => {
        const dto = UsersMother.dto();
        const userCreator = new UserCreator(repository);

        await userCreator.execute({
            ...dto,
            account_type: AccountTypeEnum.SERVICE.value,
        });

        const userLogin = new Login(repository);
        const response = await userLogin.execute(dto.login, dto.plainPassword);

        expect(response).not.toBeNull();
        expect(response).toBeInstanceOf(UserResponse);
        expect(response.token).not.toBeNull();
    });

    it('Should return error when try login with a incorrect password', async () => {
        const dto = UsersMother.dto();
        const userCreator = new UserCreator(repository);

        await userCreator.execute({
            ...dto,
            account_type: AccountTypeEnum.SERVICE.value,
        });

        const userLogin = new Login(repository);

        await expect(userLogin.execute(dto.login, 'me la invento')).rejects.toThrow(Error);
    });

    it('can get an existing user', async () => {
        const user = await UsersMother.createUser(repository);
        const userFinder = new UserFinder(repository, user);

        const a = await repository.connection('usuarios').select('*').where('id', user.id.value);
        Helper.logInfo(user, a);

        const userResult = await userFinder.execute(user.id.value);

        expect(userResult).not.toBeNull();
        expect(userResult).toBeInstanceOf(UserResponse);
    });

    it('can update an existing user', async () => {
        const user = await UsersMother.createUser(repository);
        const userUpdater = new UserUpdater(repository);

        const newValues = { login: 'updatedLogin' };
        await userUpdater.execute(user.id.value, newValues);

        const result = await repository.find(user.id);
        expect(result).toBeInstanceOf(User);
        expect(result.login.value).toBe(newValues.login);
    });

    it('can delete an existing user', async () => {
        const user = await UsersMother.createUser(repository);
        const userDeleter = new UserDeleter(repository);

        await userDeleter.execute(user.id.value, { deleted_at: new Date().toISOString(), deleted_by: uuid() });

        const result = await repository.find(user.id);
        expect(result).toBeInstanceOf(User);
        expect(result.deleted_at.value).not.toBeNull();
        expect(result.deleted_by.value).not.toBeNull();
    });

    it('searches for users instances with given criteria', async () => {
        for (let i = 0; i < 10; i++) {
            await UsersMother.createUser(repository);
        }
        const dtoCriteria = {
            filter: undefined,
            relationship: undefined,
            limit: 10,
            offset: 0,
            order: { field: 'created_at', direction: 'asc' },
        };
        const userSearch = new UserSearcher(repository, caseRepository);

        const userResult = await userSearch.execute(dtoCriteria);

        expect(userResult).toBeInstanceOf(UserCollectionResponse);
    });

    it('should throw an error when creating a User with invalid data', async () => {
        const dto = UsersMother.dto();
        delete dto.id;
        const userCreator = new UserCreator(repository);

        await expect(userCreator.execute(dto)).rejects.toThrow();
    });

    it('should throw an error when trying to update a non-existent user', async () => {
        const userUpdater = new UserUpdater(repository);
        const newValues = { nivel1: 'updated level' };
        const nonExistentId = uuid();

        await expect(userUpdater.execute(nonExistentId, newValues)).rejects.toThrow(
            `User with ID ${nonExistentId} does not exist.`
        );
    });

    it('should throw a 404 error when deleting a non-existent user', async () => {
        const userDeleter = new UserDeleter(repository);
        const nonExistentId = uuid();
        await expect(
            userDeleter.execute(nonExistentId, { deleted_at: new Date().toISOString(), deleted_by: uuid() })
        ).rejects.toMatchObject({ message: 'User not found', statusCode: 404 });
    });

    it('should count users correctly', async () => {
        // La semilla del tenant y los `it` anteriores dejan usuarios en la
        // misma base, asi que contar la tabla entera nunca da 10: el contador
        // se acota a los usuarios que crea este test.
        const email = `count-${uuid()}@example.com`;
        for (let i = 0; i < 10; i++) {
            await UsersMother.createUser(repository, { email });
        }
        const counter = new UserCounter(repository);

        const count = await counter.execute({
            filter: [{ field: 'email', operator: 'eq', value: email, type: 'AND' }],
            relationship: null,
        });
        expect(Number(count.count)).toBe(10);
    });

    it('searches for Users instances with ans counters given criteria', async () => {
        const dto = await CasesMother.dto(caseRepository);
        const user = await UsersMother.createUser(repository);

        const dtoPosition1 = { ...dto, responsable_id: user.id.value, ans_posicion: 1 };
        const dtoPosition2 = { ...dto, id: uuid(), responsable_id: user.id.value, ans_posicion: 2 };
        const dtoPosition3 = { ...dto, id: uuid(), responsable_id: user.id.value, ans_posicion: 3 };

        await CasesMother.createCase(caseRepository, dtoPosition1);
        await CasesMother.createCase(caseRepository, dtoPosition2);
        await CasesMother.createCase(caseRepository, dtoPosition3);

        const dtoCriteria = {
            filter: [
                {
                    field: 'id',
                    operator: 'eq',
                    value: user.id.value,
                    type: 'AND',
                },
            ],
            relationship: undefined,
            limit: 10,
            offset: 0,
            order: { field: 'created_at', direction: 'asc' },
        };
        const userSearcher = new UserSearcher(repository, caseRepository);

        const userResult = await userSearcher.execute(dtoCriteria);

        expect(userResult).toBeInstanceOf(UserCollectionResponse);
        expect(userResult.toJson().data.items[0].expiredCases).toBeDefined();
    });

    it('should create a User with filters', async () => {
        const dto = UsersMother.dto();
        const userFilters = {
            application: {
                admin: {
                    'Filtro Bogota': {
                        nivel1: 'Colombia',
                        nivel2: 'Bogota',
                        ans: 'uuid',
                        activo: true,
                    },
                },
                agent: {},
            },
        };

        const userCreator = new UserCreator(repository);

        await userCreator.execute({
            ...dto,
            filters: userFilters,
        });

        const userFinder = new UserFinder(repository, new User(dto));
        const createdUser = await userFinder.execute(dto.id);

        expect(createdUser).not.toBeNull();
        expect(createdUser.toJson().data.filters).toEqual(userFilters);
    });

    it('should update User filters', async () => {
        const user = await UsersMother.createUser(repository);
        const userUpdater = new UserUpdater(repository);

        const newFilters = {
            application: {
                admin: {
                    'Clasificaciones inactivas': {
                        activo: false,
                    },
                },
                agent: {
                    'Clasificaciones inactivas': {
                        activo: false,
                    },
                },
            },
        };

        await userUpdater.execute(user.id.value, { filters: newFilters });

        const userFinder = new UserFinder(repository, user);
        const updatedUser = await userFinder.execute(user.id.value);

        expect(updatedUser).not.toBeNull();
        expect(updatedUser.toJson().data.filters).toEqual(newFilters);
    });

    it('should throw an error when creating a User with duplicate login', async () => {
        const dto1 = UsersMother.dto();
        const dto2 = UsersMother.dto();
        dto2.login = dto1.login;

        const userCreator = new UserCreator(repository);

        await userCreator.execute(dto1);

        await expect(userCreator.execute(dto2)).rejects.toThrow(
            `The following value(s) already exist: login '${dto1.login}'`
        );
    });

    it('should throw an error when updating a User to have a duplicate login', async () => {
        const user1 = await UsersMother.createUser(repository);
        const user2 = await UsersMother.createUser(repository);

        const userUpdater = new UserUpdater(repository);

        await expect(userUpdater.execute(user2.id.value, { login: user1.login.value })).rejects.toThrow(
            `The following value(s) already exist: login '${user1.login.value}'`
        );
    });

    it('should error when assigning an user to a case that does not exist', async () => {
        const userSignedIn = await UsersMother.createUser(repository, UsersMother.systemUser());
        const userAssign = new CaseUserAssigner(caseRepository, repository, groupRepository, userSignedIn);
        await expect(userAssign.execute(uuidV4(), uuidV4(), uuidV4())).rejects.toThrow(ValidationFailError);
    });

    it('should Assign cases an User', async () => {
        const kace = await CasesMother.createCase(caseRepository);
        const group = await GroupsMother.createGroup(groupRepository, shiftManagementRepository);
        const user = await UsersMother.createUser(repository);
        const userSignedIn = await UsersMother.createUser(repository, UsersMother.systemUser());
        const userAssign = new CaseUserAssigner(caseRepository, repository, groupRepository, userSignedIn);

        await userAssign.execute(kace.id.value, group.id.value, user.id.value);

        const result = await caseRepository.find(kace.id);
        expect(result.responsable_id.value).toBe(user.id.value);
        expect(result.grupo_id.value).toBe(group.id.value);
        expect(result.updated_by.value).toBe(userSignedIn.id.value);
    });

    it('should get user with permissions', async () => {
        const rol = await RoleMother.createRole(roleRepository);
        const user = await UsersMother.createUser(repository, { rol_id: rol.id.value });
        const userFinder = new DomainUserFinder(repository);

        const userResult = await userFinder.execute(user.id.value);

        expect(userResult).not.toBeNull();
        expect(userResult.permissions).toBeDefined();
        expect(userResult.permissions.value).toEqual(rol.permisos.value);
        const firtsPermission = JSON.parse(rol.permisos.value).administrador[0];
        expect(userResult.hasPermission('administrador', firtsPermission.module_id, firtsPermission.name)).toBe(true);
    });

    it('should check if user has auxiliary permission', async () => {
        const rol = await RoleMother.createRole(roleRepository);

        const user = await UsersMother.createUser(repository, {
            rol_id: rol.id.value,
        });

        const userFinder = new DomainUserFinder(repository);
        const userResult = await userFinder.execute(user.id.value);

        expect(userResult).not.toBeNull();
        expect(userResult.permissions).toBeDefined();
        expect(userResult.permissions.value).toEqual(rol.permisos.value);

        const parsedPermissions = JSON.parse(userResult.permissions.value);
        expect(Object.prototype.hasOwnProperty.call(parsedPermissions, 'auxiliaries')).toBe(true);
        expect(Array.isArray(parsedPermissions.auxiliaries)).toBe(true);
        expect(userResult.hasAuxiliaryPermission('cases', 'Create')).toBe(false);
    });

    it('should find a user with a session active and max number of cases', async () => {
        const group = await GroupsMother.createGroup(groupRepository, shiftManagementRepository);
        const userSignedIn = await UsersMother.createUser(repository, UsersMother.systemUser());
        const userAssign = new CaseUserAssigner(caseRepository, repository, groupRepository, userSignedIn);

        let activeUserId;
        for (let cicles = 0; cicles < 4; cicles++) {
            const user = await UsersMother.createUser(repository);

            await repository.connection('rel_usuarios_grupos').insert({
                usuario_id: user.id.value,
                grupo_id: group.id.value,
            });

            await repository
                .connection(repository.tableName)
                .update({ grupo_activo: group.id.value })
                .where({ id: user.id.value });

            if (cicles === 0) {
                await repository
                    .connection(repository.tableName)
                    .update({ last_seen_at: new Date().toISOString() })
                    .where({ id: user.id.value });
                for (let assingCicle = 0; assingCicle < 3; assingCicle++) {
                    const kace = await CasesMother.createCase(caseRepository);
                    await userAssign.execute(kace.id.value, group.id.value, user.id.value);
                }
            } else if (cicles === 1) {
                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);

                await repository
                    .connection(repository.tableName)
                    .update({ last_seen_at: yesterday.toISOString() })
                    .where({ id: user.id.value });
                for (let assingCicle = 0; assingCicle < 3; assingCicle++) {
                    const kace = await CasesMother.createCase(caseRepository);
                    await userAssign.execute(kace.id.value, group.id.value, user.id.value);
                }
            } else if (cicles === 2) {
                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);

                await repository
                    .connection(repository.tableName)
                    .update({ last_seen_at: yesterday.toISOString() })
                    .where({ id: user.id.value });
            } else if (cicles === 3) {
                activeUserId = user.id.value;
                await repository
                    .connection(repository.tableName)
                    .update({ last_seen_at: new Date().toISOString() })
                    .where({ id: user.id.value });
            }
        }

        const workQueueConfigurations = { activeUsers_filter_bool: true, max_cases_per_user: 2 };
        const reslutMethod = await repository.findCandidateForWorkQueue(group.id.value, workQueueConfigurations);

        expect(reslutMethod[0].responsable_id).toBe(activeUserId);
    });

    it('Should find a user with an oldest login', async () => {
        const group = await GroupsMother.createGroup(groupRepository, shiftManagementRepository);
        const userSignedIn = await UsersMother.createUser(repository, UsersMother.systemUser());
        const userAssign = new CaseUserAssigner(caseRepository, repository, groupRepository, userSignedIn);

        let activeUserId;
        for (let cicles = 0; cicles < 4; cicles++) {
            const user = await UsersMother.createUser(repository);

            await repository.connection('rel_usuarios_grupos').insert({
                usuario_id: user.id.value,
                grupo_id: group.id.value,
            });

            if (cicles === 0) {
                await repository
                    .connection(repository.tableName)
                    .update({ last_seen_at: new Date().toISOString(), last_login_at: new Date().toISOString() })
                    .where({ id: user.id.value });
                for (let assingCicle = 0; assingCicle < 3; assingCicle++) {
                    const kace = await CasesMother.createCase(caseRepository);
                    await userAssign.execute(kace.id.value, group.id.value, user.id.value);
                }
            } else if (cicles === 1) {
                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);

                await repository
                    .connection(repository.tableName)
                    .update({ last_seen_at: yesterday.toISOString(), last_login_at: new Date().toISOString() })
                    .where({ id: user.id.value });
                for (let assingCicle = 0; assingCicle < 3; assingCicle++) {
                    const kace = await CasesMother.createCase(caseRepository);
                    await userAssign.execute(kace.id.value, group.id.value, user.id.value);
                }
            } else if (cicles === 2) {
                activeUserId = user.id.value;
                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);

                await repository
                    .connection(repository.tableName)
                    .update({ last_seen_at: yesterday.toISOString(), last_login_at: yesterday.toISOString() })
                    .where({ id: user.id.value });
            } else if (cicles === 3) {
                await repository
                    .connection(repository.tableName)
                    .update({ last_seen_at: new Date().toISOString(), last_login_at: new Date().toISOString() })
                    .where({ id: user.id.value });
            }
        }

        const workQueueConfigurations = { oldestLogin_filter_bool: true };
        const reslutMethod = await repository.findCandidateForWorkQueue(group.id.value, workQueueConfigurations);
        expect(reslutMethod[0].responsable_id).toBe(activeUserId);
    });

    it('should prioritize the last responsible from history_cases when assignLastResponsibleIgnoreDefault is enabled', async () => {
        const group = await GroupsMother.createGroup(groupRepository, shiftManagementRepository);
        const firstResponsible = await UsersMother.createUser(repository);
        const lastResponsible = await UsersMother.createUser(repository);

        await repository.connection('rel_usuarios_grupos').insert([
            { usuario_id: firstResponsible.id.value, grupo_id: group.id.value },
            { usuario_id: lastResponsible.id.value, grupo_id: group.id.value },
        ]);

        await repository
            .connection(repository.tableName)
            .whereIn('id', [firstResponsible.id.value, lastResponsible.id.value])
            .update({
                grupo_activo: group.id.value,
                last_seen_at: new Date().toISOString(),
                is_active: '1',
            });

        const kase = await CasesMother.createCase(caseRepository, {
            grupo_id: group.id.value,
            responsable_id: firstResponsible.id.value,
        });

        await repository.connection('history_cases').insert([
            {
                id: uuidV4(),
                entity_id: kase.id.value,
                changed_attributes: JSON.stringify({ responsable_id: firstResponsible.id.value }),
                new_attributes: JSON.stringify({ responsable_id: firstResponsible.id.value }),
                original_attributes: JSON.stringify({}),
                created_at: new Date(Date.now() - 60 * 1000).toISOString(),
                created_by: firstResponsible.id.value,
            },
            {
                id: uuidV4(),
                entity_id: kase.id.value,
                changed_attributes: JSON.stringify({ responsable_id: lastResponsible.id.value }),
                new_attributes: JSON.stringify({ responsable_id: lastResponsible.id.value }),
                original_attributes: JSON.stringify({ responsable_id: firstResponsible.id.value }),
                created_at: new Date().toISOString(),
                created_by: lastResponsible.id.value,
            },
        ]);

        const workQueueConfigurations = {
            activeUsers_filter_bool: true,
            assignLastResponsibleIgnoreDefault: true,
        };

        const result = await repository.findCandidateForWorkQueue(
            group.id.value,
            workQueueConfigurations,
            kase.id.value
        );

        expect(result[0].responsable_id).toBe(lastResponsible.id.value);
    });

    it('should fallback to normal work queue selection when prioritized user is not eligible', async () => {
        const group = await GroupsMother.createGroup(groupRepository, shiftManagementRepository);
        const userSignedIn = await UsersMother.createUser(repository, UsersMother.systemUser());
        const userAssign = new CaseUserAssigner(caseRepository, repository, groupRepository, userSignedIn);
        const fallbackUser = await UsersMother.createUser(repository);
        const prioritizedUser = await UsersMother.createUser(repository);

        await repository.connection('rel_usuarios_grupos').insert([
            { usuario_id: fallbackUser.id.value, grupo_id: group.id.value },
            { usuario_id: prioritizedUser.id.value, grupo_id: group.id.value },
        ]);

        await repository
            .connection(repository.tableName)
            .whereIn('id', [fallbackUser.id.value, prioritizedUser.id.value])
            .update({
                grupo_activo: group.id.value,
                last_seen_at: new Date().toISOString(),
                is_active: '1',
            });

        for (let i = 0; i < 2; i++) {
            const assignedCase = await CasesMother.createCase(caseRepository, { grupo_id: group.id.value });
            await userAssign.execute(assignedCase.id.value, group.id.value, prioritizedUser.id.value);
        }

        const kase = await CasesMother.createCase(caseRepository, {
            grupo_id: group.id.value,
            responsable_id: prioritizedUser.id.value,
        });

        const workQueueConfigurations = {
            activeUsers_filter_bool: true,
            assignLastResponsibleIgnoreDefault: true,
            max_cases_per_user: 2,
        };

        await repository.connection('history_cases').insert({
            id: uuidV4(),
            entity_id: kase.id.value,
            changed_attributes: JSON.stringify({ responsable_id: prioritizedUser.id.value }),
            new_attributes: JSON.stringify({ responsable_id: prioritizedUser.id.value }),
            original_attributes: JSON.stringify({ responsable_id: fallbackUser.id.value }),
            created_at: new Date().toISOString(),
            created_by: userSignedIn.id.value,
        });

        const result = await repository.findCandidateForWorkQueue(
            group.id.value,
            workQueueConfigurations,
            kase.id.value
        );

        expect(result[0].responsable_id).toBe(fallbackUser.id.value);
    });

    it('should skip DEFAULT_ASSIGNEE in history and prioritize the last non-default responsible', async () => {
        const group = await GroupsMother.createGroup(groupRepository, shiftManagementRepository);
        const queueUser = await UsersMother.createUser(repository);
        const normalUser = await UsersMother.createUser(repository);

        await repository.connection('rel_usuarios_grupos').insert([
            { usuario_id: queueUser.id.value, grupo_id: group.id.value },
            { usuario_id: normalUser.id.value, grupo_id: group.id.value },
        ]);

        await repository
            .connection(repository.tableName)
            .whereIn('id', [queueUser.id.value, normalUser.id.value])
            .update({
                grupo_activo: group.id.value,
                last_seen_at: new Date().toISOString(),
                is_active: '1',
                codigos_externos: JSON.stringify(['DEFAULT_ASSIGNEE']),
            })
            .where('id', queueUser.id.value);

        await repository
            .connection(repository.tableName)
            .update({
                grupo_activo: group.id.value,
                last_seen_at: new Date().toISOString(),
                is_active: '1',
            })
            .where('id', normalUser.id.value);

        const kase = await CasesMother.createCase(caseRepository, {
            grupo_id: group.id.value,
            responsable_id: queueUser.id.value,
        });

        await repository.connection('history_cases').insert([
            {
                id: uuidV4(),
                entity_id: kase.id.value,
                changed_attributes: JSON.stringify({ responsable_id: normalUser.id.value }),
                new_attributes: JSON.stringify({ responsable_id: normalUser.id.value }),
                original_attributes: JSON.stringify({}),
                created_at: new Date(Date.now() - 60 * 1000).toISOString(),
                created_by: normalUser.id.value,
            },
            {
                id: uuidV4(),
                entity_id: kase.id.value,
                changed_attributes: JSON.stringify({ responsable_id: queueUser.id.value }),
                new_attributes: JSON.stringify({ responsable_id: queueUser.id.value }),
                original_attributes: JSON.stringify({ responsable_id: normalUser.id.value }),
                created_at: new Date().toISOString(),
                created_by: queueUser.id.value,
            },
        ]);

        const workQueueConfigurations = {
            activeUsers_filter_bool: true,
            assignLastResponsibleIgnoreDefault: true,
        };

        const result = await repository.findCandidateForWorkQueue(
            group.id.value,
            workQueueConfigurations,
            kase.id.value
        );

        expect(result[0].responsable_id).toBe(normalUser.id.value);
    });

    it('should fallback when all history responsibles are DEFAULT_ASSIGNEE', async () => {
        const group = await GroupsMother.createGroup(groupRepository, shiftManagementRepository);
        const queueUser = await UsersMother.createUser(repository);
        const fallbackUser = await UsersMother.createUser(repository);

        await repository.connection('rel_usuarios_grupos').insert([
            { usuario_id: queueUser.id.value, grupo_id: group.id.value },
            { usuario_id: fallbackUser.id.value, grupo_id: group.id.value },
        ]);

        await repository
            .connection(repository.tableName)
            .whereIn('id', [queueUser.id.value, fallbackUser.id.value])
            .update({
                grupo_activo: group.id.value,
                last_seen_at: new Date().toISOString(),
                is_active: '1',
            });

        await repository
            .connection(repository.tableName)
            .where('id', queueUser.id.value)
            .update({
                codigos_externos: JSON.stringify(['DEFAULT_ASSIGNEE']),
            });

        const kase = await CasesMother.createCase(caseRepository, {
            grupo_id: group.id.value,
            responsable_id: queueUser.id.value,
        });

        await repository.connection('history_cases').insert({
            id: uuidV4(),
            entity_id: kase.id.value,
            changed_attributes: JSON.stringify({ responsable_id: queueUser.id.value }),
            new_attributes: JSON.stringify({ responsable_id: queueUser.id.value }),
            original_attributes: JSON.stringify({}),
            created_at: new Date().toISOString(),
            created_by: queueUser.id.value,
        });

        const workQueueConfigurations = {
            activeUsers_filter_bool: true,
            assignLastResponsibleIgnoreDefault: true,
        };

        const result = await repository.findCandidateForWorkQueue(
            group.id.value,
            workQueueConfigurations,
            kase.id.value
        );

        expect(result[0].responsable_id).toBe(fallbackUser.id.value);
    });

    it('should find a user with an active integration and max number of cases', async () => {
        const group = await GroupsMother.createGroup(groupRepository, shiftManagementRepository);
        const userSignedIn = await UsersMother.createUser(repository, UsersMother.systemUser());
        const userAssign = new CaseUserAssigner(caseRepository, repository, groupRepository, userSignedIn);

        let activeIntegrationUserId;
        for (let cicles = 0; cicles < 4; cicles++) {
            const user = await UsersMother.createUser(repository);

            await repository.connection('rel_usuarios_grupos').insert({
                usuario_id: user.id.value,
                grupo_id: group.id.value,
            });

            if (cicles === 0) {
                // Active integration, but over the max_cases_per_user limit
                await repository
                    .connection(repository.tableName)
                    .update({ last_integration_active_at: new Date().toISOString() })
                    .where({ id: user.id.value });
                for (let assingCicle = 0; assingCicle < 3; assingCicle++) {
                    const kace = await CasesMother.createCase(caseRepository);
                    await userAssign.execute(kace.id.value, group.id.value, user.id.value);
                }
            } else if (cicles === 1) {
                // Inactive integration (yesterday), 3 cases
                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);
                await repository
                    .connection(repository.tableName)
                    .update({ last_integration_active_at: yesterday.toISOString() })
                    .where({ id: user.id.value });
                for (let assingCicle = 0; assingCicle < 3; assingCicle++) {
                    const kace = await CasesMother.createCase(caseRepository);
                    await userAssign.execute(kace.id.value, group.id.value, user.id.value);
                }
            } else if (cicles === 2) {
                // Inactive integration (yesterday), 0 cases
                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);
                await repository
                    .connection(repository.tableName)
                    .update({ last_integration_active_at: yesterday.toISOString() })
                    .where({ id: user.id.value });
            } else if (cicles === 3) {
                // Active integration, 0 cases — should be selected
                activeIntegrationUserId = user.id.value;
                await repository
                    .connection(repository.tableName)
                    .update({ last_integration_active_at: new Date().toISOString() })
                    .where({ id: user.id.value });
            }
        }

        const workQueueConfigurations = { activeUsers_filter_integration_bool: true, max_cases_per_user: 2 };
        const result = await repository.findCandidateForWorkQueue(group.id.value, workQueueConfigurations);

        expect(result[0].responsable_id).toBe(activeIntegrationUserId);
    });

    it('should Assign cases an User with update_source', async () => {
        const kace = await CasesMother.createCase(caseRepository);
        const group = await GroupsMother.createGroup(groupRepository, shiftManagementRepository);
        const user = await UsersMother.createUser(repository);
        const userSignedIn = await UsersMother.createUser(repository, UsersMother.systemUser());
        const userAssign = new CaseUserAssigner(caseRepository, repository, groupRepository, userSignedIn);

        await userAssign.execute(kace.id.value, group.id.value, user.id.value, 'bulk');

        const result = await caseRepository.find(kace.id);
        expect(result.responsable_id.value).toBe(user.id.value);
        expect(result.grupo_id.value).toBe(group.id.value);
        expect(result.updated_by.value).toBe(userSignedIn.id.value);
        expect(result.update_source.value).toBe('bulk');
    });

    it('should return no candidates when all users have an inactive integration', async () => {
        const group = await GroupsMother.createGroup(groupRepository, shiftManagementRepository);

        for (let cicles = 0; cicles < 3; cicles++) {
            const user = await UsersMother.createUser(repository);

            await repository.connection('rel_usuarios_grupos').insert({
                usuario_id: user.id.value,
                grupo_id: group.id.value,
            });

            const threeMinutesAgo = new Date();
            threeMinutesAgo.setMinutes(threeMinutesAgo.getMinutes() - 3);

            await repository
                .connection(repository.tableName)
                .update({ last_integration_active_at: threeMinutesAgo.toISOString() })
                .where({ id: user.id.value });
        }

        const workQueueConfigurations = { activeUsers_filter_integration_bool: true };
        const result = await repository.findCandidateForWorkQueue(group.id.value, workQueueConfigurations);

        expect(result).toHaveLength(0);
    });

    describe('UserIntegrationActivityUpdater', () => {
        it('should update last_integration_active_at for an existing user', async () => {
            const user = await UsersMother.createUser(repository);
            const updater = new UserIntegrationActivityUpdater(repository);
            const timestamp = new Date().toISOString();

            await updater.execute(user.id.value, timestamp);

            const result = await repository.find(user.id);
            expect(result).toBeInstanceOf(User);
            expect(result.last_integration_active_at.value).toBe(timestamp);
        });

        it('should throw an error when trying to update a non-existent user', async () => {
            const updater = new UserIntegrationActivityUpdater(repository);
            const nonExistentId = uuid();
            const timestamp = new Date().toISOString();

            await expect(updater.execute(nonExistentId, timestamp)).rejects.toThrow(
                `User with ID ${nonExistentId} does not exist.`
            );
        });

        it('should throw an error when userId is not a valid UUID', async () => {
            const updater = new UserIntegrationActivityUpdater(repository);
            const invalidId = 'not-a-valid-uuid';
            const timestamp = new Date().toISOString();

            await expect(updater.execute(invalidId, timestamp)).rejects.toThrow(
                `Invalid value ${invalidId} for object uuid`
            );
        });

        it('should throw an error when timestamp is not a valid date', async () => {
            const updater = new UserIntegrationActivityUpdater(repository);
            const validId = uuid();
            const invalidTimestamp = 'not-a-valid-timestamp';

            await expect(updater.execute(validId, invalidTimestamp)).rejects.toThrow(
                `timestamp: Invalid value Invalid Date for object timestamp`
            );
        });
    });

    describe('Encryption Migration Tests', () => {
        const secretKey = Buffer.from('test-secret-key-32-bytes-long!!!').toString('base64');
        const secretIv = Buffer.from('test-iv-16bytes!').toString('base64');
        const gcmMethod = 'aes-256-gcm';
        const cbcMethod = 'aes-256-cbc';

        beforeAll(() => {
            process.env.LEGACY_ENCRYPTION_METHOD = cbcMethod;
        });

        afterAll(() => {
            delete process.env.LEGACY_ENCRYPTION_METHOD;
        });

        it('should set password_encryption_migrated to true when creating user with GCM encryption', async () => {
            // This test verifies that when a new user is created with GCM encryption,
            // the password_encryption_migrated flag is set to true.
            const crypto = new Crypto(secretIv, secretKey, gcmMethod);
            const encryptedToken = crypto.encryptData('test-refresh-token');

            const userId = uuid();
            // El rol se inventa aqui mismo; postgres exige la fila padre de usuarios.rol_id.
            const rolId = uuid();
            await ensureParentRow(repository.connection, 'roles', rolId);
            await repository.connection('usuarios').insert({
                id: userId,
                login: `test-gcm-user-${Date.now()}`,
                nombres: 'Test',
                apellido1: 'User',
                email: `test-${Date.now()}@test.com`,
                is_active: 2,
                rol_id: rolId,
                refresh_token: encryptedToken,
                password_encryption_migrated: true,
                created_at: new Date().toISOString(),
                created_by: userId,
            });

            const result = await repository.connection('usuarios').where({ id: userId }).first();
            expect(result.password_encryption_migrated).toBeTruthy();

            // Verify decryption works with GCM
            const decrypted = crypto.decryptData(result.refresh_token);
            expect(decrypted).toBe('test-refresh-token');
        });

        it('should set password_encryption_migrated to null when creating user with CBC encryption', async () => {
            // This test verifies that when a user is created with CBC encryption (legacy),
            // the password_encryption_migrated flag remains null.
            const crypto = new Crypto(secretIv, secretKey, cbcMethod);
            const encryptedToken = crypto.encryptData('test-refresh-token-cbc');

            const userId = uuid();
            // El rol se inventa aqui mismo; postgres exige la fila padre de usuarios.rol_id.
            const rolId = uuid();
            await ensureParentRow(repository.connection, 'roles', rolId);
            await repository.connection('usuarios').insert({
                id: userId,
                login: `test-cbc-user-${Date.now()}`,
                nombres: 'Test',
                apellido1: 'User',
                email: `test-cbc-${Date.now()}@test.com`,
                is_active: 2,
                rol_id: rolId,
                refresh_token: encryptedToken,
                password_encryption_migrated: null,
                created_at: new Date().toISOString(),
                created_by: userId,
            });

            const result = await repository.connection('usuarios').where({ id: userId }).first();
            expect(result.password_encryption_migrated).toBeNull();
        });

        it('should read password_encryption_migrated correctly in User entity', async () => {
            // This test verifies the User entity correctly handles the password_encryption_migrated property.
            const userId = uuid();
            // El rol se inventa aqui mismo; postgres exige la fila padre de usuarios.rol_id.
            const rolId = uuid();
            await ensureParentRow(repository.connection, 'roles', rolId);
            await repository.connection('usuarios').insert({
                id: userId,
                login: `test-entity-user-${Date.now()}`,
                nombres: 'Test',
                apellido1: 'Entity',
                email: `test-entity-${Date.now()}@test.com`,
                is_active: 2,
                rol_id: rolId,
                password_encryption_migrated: true,
                created_at: new Date().toISOString(),
                created_by: userId,
            });

            const userFinder = new DomainUserFinder(repository);
            const user = await userFinder.execute(userId);

            expect(user).not.toBeNull();
            expect(user.password_encryption_migrated).toBeDefined();
            expect(user.password_encryption_migrated.value).toBe(true);
        });
    });

    describe('findAllActive', () => {
        it('returns only active, non-deleted users', async () => {
            const active = await UsersMother.createUser(repository, { is_active: 1 });
            const inactive = await UsersMother.createUser(repository, { is_active: 2 });
            const deleted = await UsersMother.createUser(repository, { is_active: 1 });

            await repository
                .connection('usuarios')
                .where({ id: deleted.id.value })
                .update({ deleted_at: new Date().toISOString(), deleted_by: '00000000-0000-0000-0000-000000000000' });

            const result = await repository.findAllActive();

            const ids = result.map((u) => u.id.value);
            expect(ids).toContain(active.id.value);
            expect(ids).not.toContain(inactive.id.value);
            expect(ids).not.toContain(deleted.id.value);
            expect(result[0]).toBeInstanceOf(User);
        });

        it('returns empty array when no active users exist', async () => {
            // La semilla del tenant y los `it` anteriores dejan usuarios
            // activos en la misma base, asi que la precondicion del test hay
            // que construirla y deshacerla despues para no arrastrarla a los
            // `it` siguientes.
            const activeIds = await repository
                .connection('usuarios')
                .where('is_active', '1')
                .whereNull('deleted_at')
                .pluck('id');
            await repository.connection('usuarios').whereIn('id', activeIds).update({ is_active: '2' });

            let result;
            try {
                result = await repository.findAllActive();
            } finally {
                await repository.connection('usuarios').whereIn('id', activeIds).update({ is_active: '1' });
            }

            expect(result).toEqual([]);
        });
    });

    describe('Groups enrichment and filtering', () => {
        it('should return a map of groups indexed by user id via findGroupsByUserIds', async () => {
            const user = await UsersMother.createUser(repository);
            const group = await GroupsMother.createGroup(groupRepository, shiftManagementRepository);
            await repository.connection('rel_usuarios_grupos').insert({
                usuario_id: user.id.value,
                grupo_id: group.id.value,
            });

            const map = await repository.findGroupsByUserIds([user.id.value]);

            expect(map).toBeInstanceOf(Map);
            expect(map.get(user.id.value)).toHaveLength(1);
            expect(map.get(user.id.value)[0].id).toBe(group.id.value);
            expect(map.get(user.id.value)[0].nombre).toBeDefined();
        });

        it('should return undefined for a user with no groups in findGroupsByUserIds', async () => {
            const user = await UsersMother.createUser(repository);
            const map = await repository.findGroupsByUserIds([user.id.value]);
            expect(map.get(user.id.value)).toBeUndefined();
        });

        it('should filter users by group membership in search', async () => {
            const { Criteria } = await import('../../src/shared/index.js');
            const userInGroup = await UsersMother.createUser(repository);
            const userNotInGroup = await UsersMother.createUser(repository);
            const group = await GroupsMother.createGroup(groupRepository, shiftManagementRepository);
            await repository.connection('rel_usuarios_grupos').insert({
                usuario_id: userInGroup.id.value,
                grupo_id: group.id.value,
            });

            const criteria = new Criteria([], undefined, 10, 0, undefined, repository.tableName);
            const rows = await repository.search(criteria, [group.id.value]);

            const ids = rows.map((u) => u.id.value);
            expect(ids).toContain(userInGroup.id.value);
            expect(ids).not.toContain(userNotInGroup.id.value);
        });

        it('should count only users in specified group via countUsers', async () => {
            const userInGroup = await UsersMother.createUser(repository);
            await UsersMother.createUser(repository);
            const group = await GroupsMother.createGroup(groupRepository, shiftManagementRepository);
            await repository.connection('rel_usuarios_grupos').insert({
                usuario_id: userInGroup.id.value,
                grupo_id: group.id.value,
            });

            const count = await repository.countUsers([], undefined, [group.id.value]);
            const countResult = count.count;
            expect(Number(countResult)).toBe(1);
        });

        it('should return groups in UserSearcher execute results', async () => {
            const user = await UsersMother.createUser(repository);
            const group = await GroupsMother.createGroup(groupRepository, shiftManagementRepository);
            await repository.connection('rel_usuarios_grupos').insert({
                usuario_id: user.id.value,
                grupo_id: group.id.value,
            });

            const userSearch = new UserSearcher(repository, caseRepository);
            const result = await userSearch.execute({
                filter: [{ field: 'id', operator: 'eq', value: user.id.value, type: 'AND' }],
                relationship: undefined,
                limit: 10,
                offset: 0,
                order: null,
            });

            const item = result.toJson().data.items[0];
            expect(item.groups).toHaveLength(1);
            expect(item.groups[0].id).toBe(group.id.value);
        });

        it('should return empty groups array for user with no groups in UserSearcher', async () => {
            const user = await UsersMother.createUser(repository);

            const userSearch = new UserSearcher(repository, caseRepository);
            const result = await userSearch.execute({
                filter: [{ field: 'id', operator: 'eq', value: user.id.value, type: 'AND' }],
                relationship: undefined,
                limit: 10,
                offset: 0,
                order: null,
            });

            expect(result.toJson().data.items[0].groups).toEqual([]);
        });

        it('should filter users by grupos_ids in UserSearcher execute', async () => {
            const userInGroup = await UsersMother.createUser(repository);
            const userNotInGroup = await UsersMother.createUser(repository);
            const group = await GroupsMother.createGroup(groupRepository, shiftManagementRepository);
            await repository.connection('rel_usuarios_grupos').insert({
                usuario_id: userInGroup.id.value,
                grupo_id: group.id.value,
            });

            const userSearch = new UserSearcher(repository, caseRepository);
            const result = await userSearch.execute({
                filter: [{ field: 'grupos_ids', operator: 'in', value: group.id.value, type: 'AND' }],
                relationship: undefined,
                limit: 10,
                offset: 0,
                order: null,
            });

            const items = result.toJson().data.items;
            const ids = items.map((i) => i.id);
            expect(ids).toContain(userInGroup.id.value);
            expect(ids).not.toContain(userNotInGroup.id.value);
            expect(Number(result.toJson().metadata.count)).toBe(1);
        });
    });

    describe('UserBulkUpdater', () => {
        it('should bulk update multiple users and log history correctly', async () => {
            const user1 = await UsersMother.createUser(repository);
            const user2 = await UsersMother.createUser(repository);
            const user3 = await UsersMother.createUser(repository);

            const updater = new UserBulkUpdater(repository);

            const updateDto = { is_active: 2 };
            await updater.execute([user1.id.value, user2.id.value, user3.id.value], updateDto);

            const updatedUser1 = await repository.find(user1.id);
            const updatedUser2 = await repository.find(user2.id);
            const updatedUser3 = await repository.find(user3.id);

            expect(updatedUser1.is_active.value).toBe(2);
            expect(updatedUser2.is_active.value).toBe(2);
            expect(updatedUser3.is_active.value).toBe(2);

            // `connection.raw` en postgres devuelve el `Result` de pg, no el
            // array de filas: las filas estan en `.rows`.
            const historyOf = async (userId) => {
                const { rows } = await repository.connection.raw('SELECT * FROM history_usuarios WHERE entity_id = ?', [
                    userId,
                ]);
                return rows;
            };

            const history1 = await historyOf(user1.id.value);
            const history2 = await historyOf(user2.id.value);
            const history3 = await historyOf(user3.id.value);

            expect(history1.length).toBeGreaterThan(0);
            expect(history2.length).toBeGreaterThan(0);
            expect(history3.length).toBeGreaterThan(0);
            // `changed_attributes` es jsonb: el driver de pg ya lo entrega parseado, asi que
            // `String(...)` daba "[object Object]" y la busqueda nunca podia acertar.
            expect(history1.some((h) => Number(h.changed_attributes?.is_active) === 2)).toBeTruthy();
        });

        it('should throw ValidationFailError if one of the users does not exist', async () => {
            const user1 = await UsersMother.createUser(repository);
            const fakeId = uuidV4();

            const updater = new UserBulkUpdater(repository);

            await expect(updater.execute([user1.id.value, fakeId], { is_active: 2 })).rejects.toThrow(
                ValidationFailError
            );

            await expect(updater.execute([user1.id.value, fakeId], { is_active: 2 })).rejects.toThrow(
                `Users with IDs ${fakeId} do not exist.`
            );
        });
    });
});
