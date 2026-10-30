import { v4 as uuidv4 } from 'uuid';
import { StatusEnum } from '../../src/shared';
import { GroupsMother } from './domain/GroupsMother';
import { GroupCollectionResponse, GroupResponse, Groups } from '../../src/grupos';
import { DeleteFieldsDoNotExistError } from '../../src/shared/index.js';

describe('Groups test', () => {
    it('should return a Group instance', () => {
        const dto = GroupsMother.dto();
        const group = Groups.create(dto);

        expect(group).toBeInstanceOf(Groups);
        expect(group.id.value).toEqual(dto.id);
        expect(group.nombre.value).toEqual(dto.nombre);
        expect(group.status.value).toEqual(dto.status);
        expect(group.created_at.value).toEqual(dto.created_at);
        expect(group.created_by.value).toEqual(dto.created_by);
    });

    it('should update a Group', () => {
        const dto = GroupsMother.dto();
        const group = new Groups(dto);

        const updateDto = {
            nombre: 'Nuevo nombre Actualizado',
            horario_id: uuidv4(),
            status: StatusEnum.INACTIVE.value,
            descripcion: 'Nueva descripcion Actualizada',
            codigo_externo: 'Nuevo codigo externo Actualizado',
            codigos_externos: ['codigo1', 'codigo2'],
            permisos: { test: true },
            layouts: {},
            comportamientos: {},
            filter_order: '{test:test}',
            updated_at: new Date().toISOString(),
            updated_by: uuidv4(),
        };

        group.update(updateDto);

        expect(group).toBeInstanceOf(Groups);
        expect(group.nombre.value).toEqual(updateDto.nombre);
        expect(group.updated_at.value).toEqual(updateDto.updated_at);
        expect(group.updated_by.value).toEqual(updateDto.updated_by);
    });

    it('does not update properties when values are the same', () => {
        const dto = GroupsMother.dto();
        const group = Groups.create(dto);

        group.update(dto);

        expect(group.changedAttributes).toEqual({});
    });

    it('marks a Group instance as deleted', () => {
        const dto = GroupsMother.dto();
        const group = Groups.create(dto);
        const deleteDto = {
            deleted_at: new Date().toISOString(),
            deleted_by: uuidv4(),
        };
        group.delete(deleteDto);

        expect(group.deleted_at.value).toEqual(deleteDto.deleted_at);
        expect(group.deleted_by.value).toEqual(deleteDto.deleted_by);
    });

    it('should throw a error if deleted fields are empty', () => {
        const dto = GroupsMother.dto();
        const group = Groups.create(dto);
        const deleteDto = {};

        expect(() => group.delete(deleteDto)).toThrow(DeleteFieldsDoNotExistError);
    });

    it('flushes changes in Groups instance', () => {
        const dto = GroupsMother.dto();
        const group = Groups.create(dto);
        const updateDto = {
            status: StatusEnum.INACTIVE.value,
            updated_at: new Date().toISOString(),
            updated_by: uuidv4(),
        };
        group.update(updateDto);
        group.flushChanges();

        expect(group.changedAttributes).toEqual({});
    });
});

describe('Groups Responses Tests', () => {
    it('converts Groups object to JSON representation', () => {
        const group = new Groups(GroupsMother.randomDto());
        const groupResponse = new GroupResponse(group);
        const keysExpected = [
            'id',
            'nombre',
            'horario_id',
            'status',
            'descripcion',
            'codigo_externo',
            'codigos_externos',
            'permisos',
            'layouts',
            'comportamientos',
            'filter_order',
            'rol_id',
            'configuration_id',
            'data',
            'ips_allowed',
            'created_by',
            'created_at',
            'updated_by',
            'updated_at',
            'expiredCases',
            'intermediateCases',
            'notExpiredCases',
        ];
        const keysInvalid = ['deleted_by', 'deleted_at'];

        const json = groupResponse.toJson().data;

        expect(Object.keys(json)).toEqual(keysExpected);
        expect(Object.keys(json)).not.toEqual(keysInvalid);
    });

    it('return an empty object if Group is null', () => {
        const groupResponse = new GroupResponse(null);

        const json = groupResponse.toJson();

        expect(json).toMatchObject({});
    });

    it('converts Groups collection object to JSON representation', () => {
        const groups = [new Groups(GroupsMother.randomDto()), new Groups(GroupsMother.randomDto())];
        const groupsCollectionReponse = new GroupCollectionResponse(groups, groups.length);

        const json = groupsCollectionReponse.toJson();

        expect(json).toEqual({
            data: {
                items: groups.map((group) => new GroupResponse(group).toJson().data),
            },
            metadata: {
                count: groups.length,
            },
        });
    });
});
