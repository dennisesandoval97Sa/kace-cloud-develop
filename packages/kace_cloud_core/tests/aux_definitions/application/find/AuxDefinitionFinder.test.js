import { AuxDefinitionsMother } from '../../domain/AuxDefinitionsMother.js';
import { AuxDefinitionFinder } from '../../../../src/aux_definitions/application/find/AuxDefinitionFinder.js';
import { AuxDefinitionResponse } from '../../../../src/aux_definitions/application/AuxDefinitionResponse.js';
import { jest } from '@jest/globals';
import { v4 as uuidv4 } from 'uuid';

describe('AuxDefinitionFinder', () => {
    it('debería retornar una respuesta estándar si encuentra la entidad', async () => {
        const dto = AuxDefinitionsMother.dto();
        const auxDefinition = AuxDefinitionsMother.create(dto);
        const repository = { find: jest.fn(async () => auxDefinition) };
        const finder = new AuxDefinitionFinder(repository);
        const response = await finder.execute(dto.id);
        expect(response).toBeInstanceOf(AuxDefinitionResponse);
        expect(response.toJson().data.id).toBe(dto.id);
    });

    it('debería retornar un objeto vacío si no encuentra la entidad', async () => {
        const repository = { find: jest.fn(async () => null) };
        const finder = new AuxDefinitionFinder(repository);
        const response = await finder.execute(uuidv4());
        expect(response).toBeInstanceOf(AuxDefinitionResponse);
        expect(response.toJson()).toEqual({});
    });
});
