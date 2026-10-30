import { v4 as uuidv4 } from 'uuid';
import { StatusEnum } from '../../src/shared';
import RoleMother from './domain/RoleMother';
import { Permissions, Role, RoleCollectionResponse, RoleResponse } from '../../src/role';
import { ListPermissions } from '../../src/role/domain/ListPermissions';
import { DeleteFieldsDoNotExistError, InvalidArgumentError } from '../../src/shared/index.js';

describe('Role test', () => {
    it('should return a role instance', () => {
        const dto = RoleMother.dto();
        const role = Role.create(dto);

        expect(role).toBeInstanceOf(Role);
        expect(role.id.value).toEqual(dto.id);
        expect(role.descripcion.value).toEqual(dto.descripcion);
        expect(role.status.value).toEqual(dto.status);
        expect(role.created_at.value).toEqual(dto.created_at.toISOString());
        expect(role.created_by.value).toEqual(dto.created_by);
    });

    it('should update a Role', () => {
        const dto = RoleMother.dto();
        const role = new Role(dto);

        const updateDto = {
            descripcion: 'Description actualizado',
            status: StatusEnum.ACTIVE.value,
            permisos: new ListPermissions().toPrimivites(),
            updated_at: new Date().toISOString(),
            updated_by: uuidv4(),
        };

        role.update(updateDto);
        expect(role).toBeInstanceOf(Role);
        expect(role.descripcion.value).toEqual(updateDto.descripcion);
        expect(role.permisos.value).toEqual(role.permisos.value);
        expect(role.status.value).toEqual(updateDto.status);
        expect(role.updated_at.value).toEqual(updateDto.updated_at);
        expect(role.updated_by.value).toEqual(updateDto.updated_by);
    });

    it('should not update properties when values are the same', () => {
        const dto = RoleMother.dto();
        const role = Role.create(dto);

        role.update(dto);

        expect(role.changedAttributes).toEqual({});
    });

    it('should mark a Role instance as deleted', () => {
        const dto = RoleMother.dto();
        const role = Role.create(dto);
        const deleteDto = {
            deleted_at: new Date().toISOString(),
            deleted_by: uuidv4(),
        };
        role.delete(deleteDto);

        expect(role.deleted_at.value).toEqual(deleteDto.deleted_at);
        expect(role.deleted_by.value).toEqual(deleteDto.deleted_by);
    });

    it('should throw customerror if delete fields empty', () => {
        const dto = RoleMother.randomDto();
        const role = Role.create(dto);
        const deleteDto = {};

        expect(() => role.delete(deleteDto)).toThrow(DeleteFieldsDoNotExistError);
    });

    it('should flush changes in Role instance', () => {
        const dto = RoleMother.dto();
        const role = Role.create(dto);
        const updateDto = {
            status: StatusEnum.INACTIVE.value,
            updated_at: new Date().toISOString(),
            updated_by: uuidv4(),
        };
        role.update(updateDto);
        role.flushChanges();

        expect(role.changedAttributes).toEqual({});
    });

    it('should throw an error if the permissions attribute is not a object', () => {
        const dto = { ...RoleMother.dto(), permisos: 'test' };
        expect(() => {
            new Role(dto);
        }).toThrow(InvalidArgumentError);
    });

    it('should throw an error if a permissions does not exists', () => {
        const dto = RoleMother.dto();
        dto.permisos.agente[0].name = 'NEW-PERMISSION';
        expect(() => {
            new Role(dto);
        }).toThrow(InvalidArgumentError);
    });
});

describe('Role Responses Tests', () => {
    it('should convert Role object to JSON representation', () => {
        const role = new Role(RoleMother.randomDto());
        const roleResponse = new RoleResponse(role);

        const json = roleResponse.toJson();

        expect(json).toMatchObject({
            data: {
                id: role.id.value,
                descripcion: role.descripcion.value,
                permisos: role.permisos.value,
                status: role.status.value,
                created_at: role.created_at.value,
                updated_at: role.updated_at.value,
                created_by: role.created_by.value,
                updated_by: role.updated_by.value,
                deleted_at: role.deleted_at.value,
                deleted_by: role.deleted_by.value,
            },
        });
    });

    it('should exclude permisos from the JSON if permisos is null or empty', () => {
        const roleWithoutPermisos = new Role({
            ...RoleMother.randomDto(),
            permisos: null,
        });

        const roleResponse = new RoleResponse(roleWithoutPermisos);
        const json = roleResponse.toJson();

        expect(json.data).not.toHaveProperty('permisos');
    });

    it('should convert Role collection object to JSON representation', () => {
        const roles = [new Role(RoleMother.randomDto()), new Role(RoleMother.randomDto())];
        const roleCollectionResponse = new RoleCollectionResponse(roles);

        const json = roleCollectionResponse.toJson().data;

        expect(json.items).toEqual(roles.map((role) => new RoleResponse(role).toJson().data));
    });

    it('should return an empty object if Role is null', () => {
        const roleResponse = new RoleResponse(null);

        const json = roleResponse.toJson();

        expect(json).toMatchObject({});
    });

    it('should convert Role search collection object to JSON representation', () => {
        const role = [new Role(RoleMother.randomDto()), new Role(RoleMother.randomDto())];
        const roleCollectionResponse = new RoleCollectionResponse(role, role.length);

        const json = roleCollectionResponse.toJson();

        expect(json).toEqual({
            data: {
                items: role.map((role) => new RoleResponse(role).toJson().data),
            },
            metadata: {
                count: role.length,
            },
        });
    });
});

describe('Permissions tests', () => {
    let listPermissions;
    beforeEach(() => {
        listPermissions = new ListPermissions();
    });

    it('should initialize permissions correctly', () => {
        const permissions = listPermissions.permissions;

        expect(permissions).toHaveProperty('agente');
        expect(permissions).toHaveProperty('administrador');
        expect(permissions).toHaveProperty('auxiliaries');
        expect(permissions.agente.length).toBeGreaterThan(0);
        expect(permissions.administrador.length).toBeGreaterThan(0);
        expect(permissions.auxiliaries.length).toBe(0);
    });

    it('should convert permissions to primitives correctly', () => {
        const primitives = listPermissions.toPrimivites();

        expect(primitives).toHaveProperty('agente');
        expect(primitives).toHaveProperty('administrador');
        expect(Array.isArray(primitives.agente)).toBe(true);
        expect(Array.isArray(primitives.administrador)).toBe(true);
    });

    it('should throw an error if the role is invalid', () => {
        expect(() => {
            listPermissions.isValidPermissions([], 'rol_invalido');
        }).toThrow('Invalid role "rol_invalido".');
    });

    it('should throw an error if the module name is invalid', () => {
        expect(() => {
            new Permissions('CasesCreate', 'Crear caso', false, 'INVALID-MODULE');
        }).toThrow(Error);
    });

    it('should create a ListPermissions instance from primitives', () => {
        const data = {
            agente: [{ name: 'CasesCreate', description: 'Crear caso', granted: false, module_id: 'cases' }],
        };

        const newListPermissions = ListPermissions.fromPrimitives(data);
        expect(newListPermissions.permissions.agente).toHaveLength(1);
        expect(newListPermissions.permissions.agente[0].name).toBe('CasesCreate');
    });

    it('should allow any auxiliaries modules', () => {
        const data = {
            agente: [{ name: 'CasesCreate', description: 'Crear caso', granted: false, module_id: 'cases' }],
            auxiliaries: [
                { name: 'ProductsCreate', description: 'Crear producto', granted: false, module_id: 'products' },
            ],
        };

        expect(() => ListPermissions.fromPrimitives(data)).not.toThrow();
    });

    it('Permissions must have classifications-flows module_id property', () => {
        const permissions = listPermissions.permissions;

        const hasClassificationsFlows = permissions.administrador.some(
            (item) => item.module_id === 'classifications-flows'
        );

        expect(hasClassificationsFlows).toBe(true);
    });

    it('Permissions must have global-rules module_id property', () => {
        const permissions = listPermissions.permissions;

        const hasGlobalRules = permissions.administrador.some((item) => item.module_id === 'global-rules');

        expect(hasGlobalRules).toBe(true);
    });

    it('Permissions must have boards module_id property', () => {
        const permissions = listPermissions.permissions;

        const hasBoards = permissions.administrador.some((item) => item.module_id === 'boards');

        expect(hasBoards).toBe(true);
    });

    it('Permissions must include BoardsExport for administrador', () => {
        const permissions = listPermissions.permissions;
        const hasBoardsExport = permissions.administrador.some((item) => item.name === 'BoardsExport');
        expect(hasBoardsExport).toBe(true);
    });

    it('Permissions must include BoardsReadRegister for administrador', () => {
        const permissions = listPermissions.permissions;
        const hasBoardsReadRegister = permissions.administrador.some((item) => item.name === 'BoardsReadRegister');
        expect(hasBoardsReadRegister).toBe(true);
    });

    it('Permissions must include BoardsCreateRegister for administrador', () => {
        const permissions = listPermissions.permissions;
        const hasBoardsCreateRegister = permissions.administrador.some((item) => item.name === 'BoardsCreateRegister');
        expect(hasBoardsCreateRegister).toBe(true);
    });

    it('Permissions must include BoardsUpdateRegister for administrador', () => {
        const permissions = listPermissions.permissions;
        const hasBoardsUpdateRegister = permissions.administrador.some((item) => item.name === 'BoardsUpdateRegister');
        expect(hasBoardsUpdateRegister).toBe(true);
    });

    it('Permissions must include BoardsUpdateRegister for agente', () => {
        const permissions = listPermissions.permissions;
        const hasBoardsUpdateRegister = permissions.agente.some((item) => item.name === 'BoardsUpdateRegister');
        expect(hasBoardsUpdateRegister).toBe(true);
    });
});
