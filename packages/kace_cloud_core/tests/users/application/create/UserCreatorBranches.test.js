import { jest } from '@jest/globals';
import { v4 as uuidv4 } from 'uuid';
import { KnexUsersRepository, UserCreator } from '../../../../src/users/index.js';
import { KnexUserGroupRelationshipRepository } from '../../../../src/user-group-relationships/index.js';
import { KnexGroupsRepository } from '../../../../src/grupos/index.js';
import { KnexShiftManagementRepository } from '../../../../src/shift-management/index.js';
import { ActionTriggers } from '../../../../src/shared/domain/enum/ActionTriggersEnum.js';
import UsersMother from '../../domain/UsersMother.js';
import { GroupsMother } from '../../../grupos/domain/GroupsMother.js';
import { knexConfig } from '../../../knexfile.js';

describe('UserCreator branches not covered by UsersIntegration.test.js', () => {
    const repository = new KnexUsersRepository(knexConfig);
    const groupRepository = new KnexGroupsRepository(repository.connection);
    const shiftManagementRepository = new KnexShiftManagementRepository(repository.connection);
    const userGroupRepository = new KnexUserGroupRelationshipRepository(repository.connection);

    it('requires an idsValidator when creating a user with group memberships', async () => {
        const group = await GroupsMother.createGroup(groupRepository, shiftManagementRepository);
        const dto = UsersMother.dto({ group_ids: [group.id.value] });
        // userGroupRepository set, idsValidator intentionally omitted (null).
        const userCreator = new UserCreator(repository, null, userGroupRepository, null);

        await expect(userCreator.execute(dto)).rejects.toThrow(
            'idsValidator is required when creating users with group memberships'
        );

        const users = await repository.connection('usuarios').select('*').where('id', dto.id);
        expect(users.length).toBe(0);
    });

    it('re-throws errors from idsValidator that are not an InvalidArgumentError', async () => {
        const group = await GroupsMother.createGroup(groupRepository, shiftManagementRepository);
        const dto = UsersMother.dto({ group_ids: [group.id.value] });
        const explodingIdsValidator = {
            validateGroupIds: jest.fn().mockRejectedValue(new TypeError('unexpected failure')),
        };
        const userCreator = new UserCreator(repository, null, userGroupRepository, explodingIdsValidator);

        await expect(userCreator.execute(dto)).rejects.toThrow('unexpected failure');
        await expect(userCreator.execute(dto)).rejects.toBeInstanceOf(TypeError);

        const users = await repository.connection('usuarios').select('*').where('id', dto.id);
        expect(users.length).toBe(0);
    });

    it('rejects with CustomError when a user with the same id already exists', async () => {
        const existing = await UsersMother.createUser(repository);
        const dto = UsersMother.dto({ id: existing.id.value });
        const userCreator = new UserCreator(repository);

        await expect(userCreator.execute(dto)).rejects.toThrow(`User with id ${existing.id.value} already exists`);
        await expect(userCreator.execute(dto)).rejects.toMatchObject({ statusCode: 400 });
    });

    // NOTA: `const actorId = user.created_by?.value ?? user.id.value;` (UserCreator.js:103) tiene
    // una rama de fallback (`?? user.id.value`) que parece inalcanzable desde la API publica:
    // `AggregateRoot#created_by` es un campo obligatorio (ValueObjectUuid no-nullable) que se
    // asigna una unica vez en el constructor de `User` a partir de `dto.created_by`; si el dto
    // no trae `created_by`, `new User(dto)` lanza ANTES de llegar a esta linea (verificado:
    // `new ValueObjectUuid('created by', undefined)` -> "created by: The value cannot be null").
    // Por tanto `user.created_by?.value` nunca es nullish una vez el User se construyo, y el
    // fallback nunca se ejecuta. Se documenta como codigo muerto y no se fuerza con un rodeo.
    it('uses the new user created_by as actor when creating group memberships (reachable branch)', async () => {
        const group = await GroupsMother.createGroup(groupRepository, shiftManagementRepository);
        const createdBy = uuidv4();
        const dto = UsersMother.dto({ group_ids: [group.id.value], created_by: createdBy });
        const realIdsValidator = { validateGroupIds: jest.fn().mockResolvedValue(undefined) };
        const saveCreationHistorySpy = jest.spyOn(userGroupRepository, 'saveCreationHistory');
        const userCreator = new UserCreator(repository, null, userGroupRepository, realIdsValidator);

        await userCreator.execute(dto);

        expect(saveCreationHistorySpy).toHaveBeenCalledTimes(1);
        const actorIdArgument = saveCreationHistorySpy.mock.calls[0][1];
        expect(actorIdArgument).toBe(createdBy);

        saveCreationHistorySpy.mockRestore();
    });

    it('invokes the injected actionExecutionService with the CREATE_USER trigger and the new user', async () => {
        const dto = UsersMother.dto();
        const actionExecutionService = { execute: jest.fn().mockResolvedValue(undefined) };
        const userCreator = new UserCreator(repository, actionExecutionService);

        await userCreator.execute(dto);

        expect(actionExecutionService.execute).toHaveBeenCalledTimes(1);
        const [trigger, user] = actionExecutionService.execute.mock.calls[0];
        expect(trigger).toBe(ActionTriggers.CREATE_USER.value);
        expect(trigger).toBe('create_user');
        expect(user.id.value).toBe(dto.id);
    });

    it('does not call any action execution service when none is injected', async () => {
        const dto = UsersMother.dto();
        const userCreator = new UserCreator(repository);

        await expect(userCreator.execute(dto)).resolves.toBeUndefined();

        const users = await repository.connection('usuarios').select('*').where('id', dto.id);
        expect(users.length).toBe(1);
    });
});
