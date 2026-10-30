import { AuxDefinitionsMother } from '../../domain/AuxDefinitionsMother.js';
import { AuxDefinitionUpdater } from '../../../../src/aux_definitions/application/update/AuxDefinitionUpdater.js';
import { CustomError } from '../../../../src/shared/errors/CustomError.js';
import { jest } from '@jest/globals';
import { v4 as uuidv4 } from 'uuid';

describe('AuxDefinitionUpdater', () => {
    it('debería actualizar correctamente un AuxDefinition existente', async () => {
        const auxDefinition = AuxDefinitionsMother.create();
        const repository = {
            update: jest.fn(async () => {}),
            saveHistory: jest.fn(async () => {}),
            find: jest.fn(async () => auxDefinition),
        };
        const updater = new AuxDefinitionUpdater(repository);
        const dto = { tablename: 'aux_nuevo_nombre' };
        await updater.execute(dto, auxDefinition.id.value);
        expect(repository.update).toHaveBeenCalled();
        expect(repository.saveHistory).toHaveBeenCalled();
    });

    it('debería lanzar error si el AuxDefinition no existe', async () => {
        const repository = {
            update: jest.fn(),
            saveHistory: jest.fn(),
            find: jest.fn(async () => null),
        };
        const updater = new AuxDefinitionUpdater(repository);
        await expect(updater.execute({ tablename: 'aux_nuevo_nombre' }, uuidv4())).rejects.toThrow(CustomError);
    });
});
