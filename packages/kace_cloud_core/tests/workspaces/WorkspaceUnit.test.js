import { v4 as uuidv4 } from 'uuid';
import { DeleteFieldsDoNotExistError } from '../../src/shared/index.js';
import { Workspaces } from '../../src/workspaces/domain/Workspaces.js';
import { WorkspaceCollectionResponse } from '../../src/workspaces/application/WorkspaceCollectionResponse.js';
import { WorkspaceResponse } from '../../src/workspaces/application/WorkspaceResponse.js';
import WorkspaceMother from './domain/WorkspaceMother.js';

describe('Workspaces test', () => {
    it('should return a Workspace instance', () => {
        const workspace = WorkspaceMother.entity({
            description: 'Workspace de prueba para testing',
        });

        expect(workspace).toBeInstanceOf(Workspaces);
        expect(workspace.id.value).toEqual(workspace.id.value);
        expect(workspace.description.value).toEqual(workspace.description.value);
        expect(workspace.is_active.value).toEqual(workspace.is_active.value);
        expect(workspace.created_at.value).toEqual(workspace.created_at.value);
        expect(workspace.created_by.value).toEqual(workspace.created_by.value);
    });

    it('should update a Workspace', () => {
        const workspace = WorkspaceMother.entity({
            description: 'Workspace inicial para actualizar',
        });

        const updateDto = {
            description: 'Nueva descripción Actualizada',
            is_active: false,
            updated_at: new Date().toISOString(),
            updated_by: uuidv4(),
        };

        workspace.update(updateDto);

        expect(workspace).toBeInstanceOf(Workspaces);
        expect(workspace.description.value).toEqual(updateDto.description);
        expect(workspace.is_active.value).toEqual(updateDto.is_active);
        expect(workspace.updated_at.value).toEqual(updateDto.updated_at);
        expect(workspace.updated_by.value).toEqual(updateDto.updated_by);
    });

    it('does not update properties when values are the same', () => {
        const dto = {
            id: uuidv4(),
            description: 'Workspace sin cambios',
            groups: [],
            is_active: true,
            created_by: uuidv4(),
            created_at: new Date().toISOString(),
        };

        const workspace = Workspaces.create(dto);

        workspace.update(dto);

        expect(workspace.changedAttributes).toEqual({});
    });

    it('marks a Workspace instance as deleted', () => {
        const workspace = WorkspaceMother.entity({
            description: 'Workspace para eliminar',
        });

        const deleteDto = {
            deleted_at: new Date().toISOString(),
            deleted_by: uuidv4(),
        };

        workspace.delete(deleteDto);

        expect(workspace.deleted_at.value).toEqual(deleteDto.deleted_at);
        expect(workspace.deleted_by.value).toEqual(deleteDto.deleted_by);
    });

    it('should throw a error if deleted fields are empty', () => {
        const workspace = WorkspaceMother.entity({
            description: 'Workspace para test de JSON',
        });

        const deleteDto = {};

        expect(() => workspace.delete(deleteDto)).toThrow(DeleteFieldsDoNotExistError);
    });

    it('flushes changes in Workspace instance', () => {
        const workspace = WorkspaceMother.entity({
            description: 'Workspace para test de flush',
        });

        const updateDto = {
            is_active: false,
            updated_at: new Date().toISOString(),
            updated_by: uuidv4(),
        };

        workspace.update(updateDto);
        workspace.flushChanges();

        expect(workspace.changedAttributes).toEqual({});
    });

    it('should update individual properties using setters', () => {
        const workspace = WorkspaceMother.entity({
            description: 'Workspace inicial para setters',
        });

        const newDescription = 'Nueva descripción usando setter';
        const newStatus = false;

        workspace.description = newDescription;
        workspace.is_active = newStatus;

        expect(workspace.description.value).toEqual(newDescription);
        expect(workspace.is_active.value).toEqual(newStatus);
        expect(workspace.changedAttributes.description).toEqual(newDescription);
        expect(workspace.changedAttributes.is_active).toEqual(newStatus);
    });
});

describe('Workspace Responses Tests', () => {
    it('converts Workspace object to JSON representation', () => {
        const workspace = WorkspaceMother.entity({
            description: 'Workspace para test de JSON',
        });

        const workspaceResponse = new WorkspaceResponse(workspace);

        const keysExpected = ['id', 'description', 'is_active', 'created_by', 'created_at', 'updated_by', 'updated_at'];
        const keysInvalid = ['deleted_by', 'deleted_at'];

        const json = workspaceResponse.toJson().data;

        expect(Object.keys(json)).toEqual(expect.arrayContaining(keysExpected));
        expect(Object.keys(json)).not.toEqual(expect.arrayContaining(keysInvalid));
    });

    it('return an empty object if Workspace is null', () => {
        const workspaceResponse = new WorkspaceResponse(null);

        const json = workspaceResponse.toJson();

        expect(json).toMatchObject({});
    });

    it('converts Workspace collection object to JSON representation', () => {
        const workspaces = [
            WorkspaceMother.entity({ description: 'Primer workspace para colección' }),
            WorkspaceMother.entity({ description: 'Segundo workspace para colección', is_active: false }),
        ];

        const workspaceCollectionResponse = new WorkspaceCollectionResponse(workspaces, workspaces.length);

        const json = workspaceCollectionResponse.toJson();

        expect(json).toEqual({
            data: {
                items: workspaces.map((workspace) => new WorkspaceResponse(workspace).toJson().data),
            },
            metadata: {
                count: workspaces.length,
            },
        });
    });

    it('handles empty workspace collection', () => {
        const workspaces = [];
        const workspaceCollectionResponse = new WorkspaceCollectionResponse(workspaces, 0);

        const json = workspaceCollectionResponse.toJson();

        expect(json).toEqual({
            data: {
                items: [],
            },
            metadata: {
                count: 0,
            },
        });
    });
});
