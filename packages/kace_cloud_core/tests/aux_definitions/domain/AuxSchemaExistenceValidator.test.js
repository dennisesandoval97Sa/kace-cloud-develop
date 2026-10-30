import { AuxSchemaExistenceValidator } from '../../../src/aux_definitions/domain/AuxSchemaExistenceValidator.js';
import { v4 as uuidv4 } from 'uuid';
import { jest } from '@jest/globals';

describe('AuxSchemaExistenceValidator', () => {
    it('no lanza error si el schema_id existe', async () => {
        const repository = { find: jest.fn(async () => true) };
        const validator = new AuxSchemaExistenceValidator(repository);
        await expect(validator.execute({ value: uuidv4() })).resolves.toBeUndefined();
    });

    it('lanza error si el schema_id no existe', async () => {
        const repository = { find: jest.fn(async () => false) };
        const validator = new AuxSchemaExistenceValidator(repository);
        await expect(validator.execute({ value: uuidv4() })).rejects.toThrow(/does not exist in schemas/);
    });
});
