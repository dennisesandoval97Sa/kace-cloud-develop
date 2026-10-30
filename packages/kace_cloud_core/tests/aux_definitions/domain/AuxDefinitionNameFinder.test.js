import { AuxDefinitionsMother } from './AuxDefinitionsMother.js';
import { jest } from '@jest/globals';
import { AuxDefinitionNameFinder } from '../../../src/aux_definitions/domain/AuxDefinitionNameFinder.js';

describe('AuxDefinitionNameFinder (domain)', () => {
    it('should return the entity if it exists by name', async () => {
        const dto = AuxDefinitionsMother.dto();
        const auxDefinition = AuxDefinitionsMother.create(dto);

        const repository = {
            findByName: jest.fn(async () => auxDefinition),
        };
        const finder = new AuxDefinitionNameFinder(repository);

        const result = await finder.byName(dto.name);

        expect(repository.findByName).toHaveBeenCalledWith(expect.anything());
        expect(result).toBe(auxDefinition);
    });

    it('should return null if entity does not exist by name', async () => {
        const repository = {
            findByName: jest.fn(async () => null),
        };
        const finder = new AuxDefinitionNameFinder(repository);

        const result = await finder.byName('non_existent_name');

        expect(repository.findByName).toHaveBeenCalledWith(expect.anything());
        expect(result).toBeNull();
    });
});
