import { v4 as uuidv4 } from 'uuid';
import { knexConfig } from '../knexfile.js';
import { StatusEnum, ValidationFailError, ValueObjectUuid } from '../../src/shared';
import { CustomError } from '../../src/shared/errors/CustomError';
import { KnexRoleRepository } from '../../src/role/infrastructure/persistence/KnexRoleRepository';
import RoleMother from './domain/RoleMother';
import {
    Role,
    RoleCollectionResponse,
    RoleCounter,
    RoleCreator,
    RoleDeleter,
    RoleFinder,
    RoleResponse,
    RoleSearcher,
    RoleUpdater,
} from '../../src/role';
import { QueryDBError } from '../../src/shared/errors/QueryDBError.js';
import { KnexAuxDefinitionRepository } from '../../src/role/infrastructure/persistence/KnexAuxDefinitionRepository.js';

describe('Role Test', () => {
    const repository = new KnexRoleRepository(knexConfig);

    beforeEach(async () => {
        // `aux_definitions.id` es varchar(36) PRIMARY KEY, o sea NOT NULL.
        // Sqlite aceptaba una PK de texto a null; postgres devuelve 23502 y
        // tumba el beforeEach, y con el los 17 tests del archivo.
        await repository.connection('aux_definitions').insert([
            { id: uuidv4(), name: 'AuxiliaryCreate' },
            { id: uuidv4(), name: 'cases', tablename: 'aux_cases' },
            { id: uuidv4(), name: 'clients', tablename: 'aux_clients' },
        ]);
    });

    it('creates a new Role instance', async () => {
        const dto = RoleMother.dto();

        const auxDefinitionRepository = new KnexAuxDefinitionRepository(repository.connection);
        const roleCreator = new RoleCreator(repository, auxDefinitionRepository);

        await roleCreator.execute(dto);

        const result = await repository.connection('roles').select('*').where('id', dto.id);

        expect(result?.length).toBe(1);
        expect(result[0].descripcion).toBe(dto.descripcion);
    });

    it('should not create a new Role instance when null dto', async () => {
        const roleCreator = new RoleCreator(repository);

        await expect(roleCreator.execute(null)).rejects.toThrow(Error);
    });

    it('finds an existing Role instance by id', async () => {
        const role = await RoleMother.createRole(repository);
        const roleFinder = new RoleFinder(repository);

        const roleResult = await roleFinder.execute(role.id.value);

        expect(roleResult).not.toBeNull();
        expect(roleResult).toBeInstanceOf(RoleResponse);
    });

    it('return null if not found a record', async () => {
        const roleFinder = new RoleFinder(repository);

        await expect(roleFinder.execute(uuidv4())).rejects.toThrow(CustomError);
    });

    it('updates an existing Role instance', async () => {
        const auxDefinitionRepository = new KnexAuxDefinitionRepository(repository.connection);

        const role = await RoleMother.createRole(repository);
        const roleUpdater = new RoleUpdater(repository, auxDefinitionRepository);

        const dtoUpdate = {
            descripcion: 'Description updated',
            updated_at: new Date().toISOString(),
            updated_by: uuidv4(),
        };

        await roleUpdater.execute(dtoUpdate, role.id.value);

        const result = await repository.find(role.id);
        expect(result).toBeInstanceOf(Role);
        expect(result.descripcion.value).toBe(dtoUpdate.descripcion);
    });

    it('should return an error when update a non-existent Role instance', async () => {
        await RoleMother.createRole(repository);
        const roleUpdater = new RoleUpdater(repository);

        await expect(roleUpdater.execute({ status: StatusEnum.ACTIVE.value }, uuidv4())).rejects.toThrow(
            ValidationFailError
        );
    });

    it('should throw an error if no permission has been selected.', async () => {
        const dto = RoleMother.dto();

        for (const key in dto.permisos) {
            if (dto.permisos.hasOwnProperty(key)) {
                dto.permisos[key].forEach((permiso) => {
                    permiso.granted = false;
                });
            }
        }

        const roleCreator = new RoleCreator(repository);
        await expect(roleCreator.execute(dto)).rejects.toThrow(ValidationFailError);
    });

    it('deletes an existing Role instance by id', async () => {
        const dtoCriteria = {
            filter: undefined,
            relationship: undefined,
            limit: 10,
            offset: 0,
            order: { field: 'deleted_at', direction: 'asc' },
        };
        const roleSearcher = new RoleSearcher(repository);

        // La plantilla trae roles sembrados, asi que el listado nunca queda
        // vacio. Lo que demuestra el borrado es que el total vuelve al de
        // antes de crear el rol y que el rol borrado ya no aparece.
        const baseline = (await roleSearcher.execute(dtoCriteria)).toJson().data.items.length;

        const role = await RoleMother.createRole(repository);
        const roleDeleter = new RoleDeleter(repository);

        const deleteDto = {
            deleted_at: new Date().toISOString(),
            deleted_by: uuidv4(),
        };

        await roleDeleter.execute(role.id.value, deleteDto);

        const roleResult = (await roleSearcher.execute(dtoCriteria)).toJson();

        expect(roleResult.data.items).toHaveLength(baseline);
        expect(roleResult.data.items.map((item) => item.id)).not.toContain(role.id.value);
    });

    it('should return an error when delete a non-existent Role instance', async () => {
        await RoleMother.createRole(repository);
        const roleDeleter = new RoleDeleter(repository);

        const deleteDto = {
            deleted_at: new Date().toISOString(),
            deleted_by: uuidv4(),
        };

        await expect(roleDeleter.execute(uuidv4(), deleteDto)).rejects.toThrow(CustomError);
    });

    it('searches for Role instances with given criteria', async () => {
        for (let i = 0; i < 10; i++) {
            await RoleMother.createRandomRole(repository);
        }
        const dtoCriteria = {
            filter: undefined,
            relationship: undefined,
            limit: 10,
            offset: 0,
            order: { field: 'created_at', direction: 'asc' },
        };
        const roleSearcher = new RoleSearcher(repository);

        const roleResult = await roleSearcher.execute(dtoCriteria);

        expect(roleResult).toBeInstanceOf(RoleCollectionResponse);
    });

    it('should return an error when not exist field is filtered', async () => {
        for (let i = 0; i < 10; i++) {
            await RoleMother.createRandomRole(repository);
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

        await expect(new RoleSearcher(repository).execute(dtoCriteria)).rejects.toThrow(QueryDBError);
    });

    it('counts the total number of Role instances', async () => {
        const dtoCriteria = {
            filter: undefined,
            relationship: undefined,
            limit: 10,
            offset: 0,
            order: { field: 'created_at', direction: 'asc' },
        };

        const roleCounter = new RoleCounter(repository);

        // El criterio no lleva filtro, asi que el conteo incluye los roles que
        // la plantilla trae sembrados. Se mide el incremento, no el total.
        const baseline = Number((await roleCounter.execute(dtoCriteria)).count);

        for (let i = 0; i < 10; i++) {
            await RoleMother.createRandomRole(repository);
        }

        const roleResponse = await roleCounter.execute(dtoCriteria);

        expect(Number(roleResponse.count)).toBe(baseline + 10);
    });

    it('should return a zero for not found criteria', async () => {
        for (let i = 0; i < 10; i++) {
            await RoleMother.createRandomRole(repository);
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

        const roleCounter = new RoleCounter(repository);

        const roleResult = await roleCounter.execute(dtoCriteria);

        expect(Number(roleResult.count)).toBe(0);
    });

    it('should throw an error when creating a Role with a duplicate name', async () => {
        const dto1 = RoleMother.dto();
        const dto2 = RoleMother.dto();
        dto2.descripcion = dto1.descripcion;

        const auxDefinitionRepository = new KnexAuxDefinitionRepository(repository.connection);
        const roleCreator = new RoleCreator(repository, auxDefinitionRepository);

        await roleCreator.execute(dto1);

        await expect(roleCreator.execute(dto2)).rejects.toThrow(
            `The following value(s) already exist: descripcion '${dto1.descripcion}'.`
        );
    });

    it('should throw an error when updating a Role to have a duplicate name', async () => {
        const role1 = await RoleMother.createRole(repository);
        const role2 = await RoleMother.createRole(repository);

        const roleUpdater = new RoleUpdater(repository);

        await expect(roleUpdater.execute({ descripcion: role1.descripcion.value }, role2.id.value)).rejects.toThrow(
            `The following value(s) already exist: descripcion '${role1.descripcion.value}'.`
        );
    });

    it('should throw an error if no aux_definitions exist for provided auxiliaries', async () => {
        const dto = RoleMother.dto();

        dto.permisos.auxiliaries = [{ module_id: 'test-module', name: 'NOT_EXISTING_PERMISSION' }];

        const auxDefinitionRepository = new KnexAuxDefinitionRepository(repository.connection);
        const roleCreator = new RoleCreator(repository, auxDefinitionRepository);

        await expect(roleCreator.execute(dto)).rejects.toThrow(ValidationFailError);
        await expect(roleCreator.execute(dto)).rejects.toThrow(/has no registered permissions/i);
    });

    it('creates a new Role instance with auxiliaries permissions', async () => {
        const dto = RoleMother.dtoWithAuxiliaries();

        const auxDefinitionRepository = new KnexAuxDefinitionRepository(repository.connection);
        const roleCreator = new RoleCreator(repository, auxDefinitionRepository);

        await roleCreator.execute(dto);

        const role = await repository.find(new ValueObjectUuid('id', dto.id));

        expect(role).toBeInstanceOf(Role);
        expect(JSON.parse(role.permisos.value).auxiliaries.length).toBe(8);
    });
});
