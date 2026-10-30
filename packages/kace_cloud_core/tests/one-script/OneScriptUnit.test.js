import { v4 as uuidv4 } from 'uuid';
import { OneScript, OneScriptResponse } from '../../src/one-script';
import OneScriptMother from './domain/OneScriptMother.js';

describe('OneScript Unit Test', () => {
    const dto = OneScriptMother.dto();
    it('Should create and return a OneScript instance', () => {
        const oneScript = OneScript.create(dto);

        expect(oneScript).toBeInstanceOf(OneScript);
        expect(oneScript.id.value).toEqual(dto.id);
        expect(oneScript.name.value).toEqual(dto.name);
        expect(oneScript.url.value).toEqual(dto.url);
        expect(oneScript.url_api.value).toEqual(dto.url_api);
        expect(oneScript.created_at.value).toEqual(dto.created_at);
        expect(oneScript.created_by.value).toEqual(dto.created_by);
    });

    it('Should update a OneScript instance', () => {
        const oneScript = new OneScript(dto);

        const updateDto = {
            name: 'Nombre de prueba nuevo',
            url: 'https://update.ejemplo.com',
            url_api: 'https://update.api.ejemplo.com',
            updated_at: new Date().toISOString(),
            updated_by: uuidv4(),
        };

        oneScript.update(updateDto);

        expect(oneScript).toBeInstanceOf(OneScript);
        expect(oneScript.changedAttributes).toEqual(updateDto);
        expect(oneScript.name.value).toEqual(updateDto.name);
        expect(oneScript.url.value).toEqual(updateDto.url);
        expect(oneScript.url_api.value).toEqual(updateDto.url_api);
        expect(oneScript.updated_at.value).toEqual(updateDto.updated_at);
        expect(oneScript.updated_by.value).toEqual(updateDto.updated_by);
    });

    it('Should throw an error with invalid UUID', () => {
        const invalidData = { ...dto, id: 'invalid-uuid' };
        expect(() => OneScript.create(invalidData)).toThrow(Error);
    });

    it('Should delete an OneScript instance', () => {
        const oneScript = OneScript.create(dto);
        const deleteDto = {
            deleted_at: new Date().toISOString(),
            deleted_by: uuidv4(),
        };
        oneScript.delete(deleteDto);

        expect(oneScript.deleted_at.value).toEqual(deleteDto.deleted_at);
        expect(oneScript.deleted_by.value).toEqual(deleteDto.deleted_by);
    });

    it('Should not update properties when values are the same', () => {
        const oneScript = OneScript.create(dto);
        const { id, created_at, created_by, ...restDto } = dto;

        oneScript.update(restDto);

        expect(oneScript.changedAttributes).toEqual({});
    });

    it('flushes changes in OneScript instance', () => {
        const oneScript = OneScript.create(dto);
        const updateDto = {
            name: 'Nombre de prueba nuevo',
            url: 'https://ejemplo.com',
            url_api: 'https://api.ejemplo.com',
            updated_at: new Date().toISOString(),
            updated_by: uuidv4(),
        };
        oneScript.name = updateDto.name;
        oneScript.url = updateDto.url;
        oneScript.url_api = updateDto.url_api;
        oneScript.updated_at = updateDto.updated_at;
        oneScript.updated_by = updateDto.updated_by;
        oneScript.flushChanges();

        expect(oneScript.changedAttributes).toEqual({});
    });
});

describe('OneScript Response Tests', () => {
    it('converts Action object to JSON representation', () => {
        const dto = OneScriptMother.dto();
        const oneScript = OneScript.create(dto);
        const oneScriptResponse = new OneScriptResponse(oneScript);

        const json = oneScriptResponse.toJson();

        expect(json).toEqual({
            data: {
                ...dto,
                updated_at: null,
                updated_by: undefined,
            },
        });
    });

    it('returns an empty object if Action is not provided', () => {
        const oneScriptResponse = new OneScriptResponse(null);
        expect(oneScriptResponse.toJson()).toEqual({});
    });
});
