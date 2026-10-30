import { RestFlowExistenceValidator } from '../../../src/aux_definitions/domain/RestFlowExistenceValidator.js';
import { v4 as uuidv4 } from 'uuid';
import { jest } from '@jest/globals';

describe('RestflowExistenceValidator', () => {
    it('no lanza error si el restflow_id existe', async () => {
        const repository = { find: jest.fn(async () => true) };
        const validator = new RestFlowExistenceValidator(repository);
        await expect(validator.execute({ value: uuidv4() })).resolves.toBeUndefined();
    });

    it('lanza error si el restflow_id no existe', async () => {
        const repository = { find: jest.fn(async () => false) };
        const validator = new RestFlowExistenceValidator(repository);
        await expect(validator.execute({ value: uuidv4() })).rejects.toThrow(/does not exist in Rest Flows/);
    });
});
