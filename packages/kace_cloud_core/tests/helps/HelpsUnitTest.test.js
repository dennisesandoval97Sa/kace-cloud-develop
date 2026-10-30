import { v4 as uuidv4 } from 'uuid';
import { Helps, HelpsResponse } from '../../src/helps';
import HelpsMother from './domain/HelpsMother';
import { SHARED_VISUAL_COLOR_ALLOWLIST } from '../../src/shared/visual-options/sharedVisualOptions.js';

describe('Helps test', () => {
    it('should return a Help instance', () => {
        const dto = HelpsMother.dto();
        const help = Helps.create(dto);

        expect(help).toBeInstanceOf(Helps);
        expect(help.id.value).toEqual(dto.id);
        expect(help.titulo.value).toEqual(dto.titulo);
        expect(help.descripcion.value).toEqual(dto.descripcion);
        expect(help.is_active.value).toEqual(dto.is_active);
        expect(help.color.value).toEqual(dto.color);
        expect(help.created_at.value).toEqual(dto.created_at);
        expect(help.created_by.value).toEqual(dto.created_by);
    });

    it('should delete a Help instance', () => {
        const dto = HelpsMother.dto();
        const help = Helps.create(dto);
        const deleteDto = {
            deleted_at: new Date().toISOString(),
            deleted_by: uuidv4(),
        };
        help.delete(deleteDto);

        expect(help.deleted_at.value).toEqual(deleteDto.deleted_at);
        expect(help.deleted_by.value).toEqual(deleteDto.deleted_by);
    });

    it('should update a Help instance', () => {
        const dto = HelpsMother.dto();
        const help = new Helps(dto);

        const updateDto = {
            titulo: 'test title',
            descripcion: 'updated description',
            is_active: 1,
            color: SHARED_VISUAL_COLOR_ALLOWLIST[0],
            updated_at: new Date().toISOString(),
            updated_by: uuidv4(),
        };

        help.update(updateDto);

        expect(help).toBeInstanceOf(Helps);
        expect(help.titulo.value).toEqual(updateDto.titulo);
        expect(help.descripcion.value).toEqual(updateDto.descripcion);
        expect(help.is_active.value).toEqual(updateDto.is_active);
        expect(help.color.value).toEqual(updateDto.color);
        expect(help.updated_at.value).toEqual(updateDto.updated_at);
        expect(help.updated_by.value).toEqual(updateDto.updated_by);
    });
});

describe('Helps Responses Tests', () => {
    it('should convert a Help object to JSON representation', () => {
        const help = new Helps(HelpsMother.randomDTO());
        const helpResponse = new HelpsResponse(help);

        const json = helpResponse.toJson();

        expect(json).toMatchObject({
            data: {
                id: help.id.value,
                titulo: help.titulo.value,
                descripcion: help.descripcion.value,
                color: help.color.value,
                is_active: help.is_active.value,
                created_at: help.created_at.value,
                updated_at: help.updated_at.value,
                created_by: help.created_by.value,
                updated_by: help.updated_by.value,
            },
        });
    });

    it('should return an empty object if Help is null', () => {
        const helpResponse = new HelpsResponse(null);

        const json = helpResponse.toJson();

        expect(json).toMatchObject({});
    });
});
