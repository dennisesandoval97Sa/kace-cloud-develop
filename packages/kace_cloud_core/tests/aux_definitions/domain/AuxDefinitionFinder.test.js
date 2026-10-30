import { AuxDefinitionsMother } from './AuxDefinitionsMother.js';
import { AuxDefinitionFinder } from '../../../src/aux_definitions/domain/AuxDefinitionFinder.js';
import { jest } from '@jest/globals';
import { v4 as uuidv4 } from 'uuid';

describe('AuxDefinitionFinder (dominio)', () => {
    it('debería retornar la entidad si existe', async () => {
        const dto = AuxDefinitionsMother.dto();
        const auxDefinition = AuxDefinitionsMother.create(dto);
        const repository = { find: jest.fn(async () => auxDefinition) };
        const finder = new AuxDefinitionFinder(repository);
        const result = await finder.execute(dto.id);
        expect(result).toBe(auxDefinition);
    });

    it('debería retornar null si no existe la entidad', async () => {
        const repository = { find: jest.fn(async () => null) };
        const finder = new AuxDefinitionFinder(repository);
        const result = await finder.execute(uuidv4());
        expect(result).toBeNull();
    });
});
