import { AuxDefinitionsMother } from '../../domain/AuxDefinitionsMother.js';
import { AuxDefinitionDeleter } from '../../../../src/aux_definitions/application/delete/AuxDefinitionDeleter.js';
import { CustomError } from '../../../../src/shared/errors/CustomError.js';
import { jest } from '@jest/globals';
import { v4 as uuidv4 } from 'uuid';

describe('AuxDefinitionDeleter', () => {
    it('debería eliminar correctamente un AuxDefinition existente', async () => {
        const auxDefinition = AuxDefinitionsMother.create();
        const repository = {
            update: jest.fn(async () => {}),
            saveHistory: jest.fn(async () => {}),
            find: jest.fn(async () => auxDefinition),
        };
        const deleter = new AuxDefinitionDeleter(repository);
        const dto = { deleted_at: new Date(), deleted_by: '6f833856-8b0b-4183-a634-5b45fdf2c2b3' };
        await deleter.execute(auxDefinition.id.value, dto);
        expect(repository.update).toHaveBeenCalled();
        expect(repository.saveHistory).toHaveBeenCalled();
    });

    it('debería lanzar error si el AuxDefinition no existe', async () => {
        const repository = {
            update: jest.fn(),
            saveHistory: jest.fn(),
            find: jest.fn(async () => null),
        };
        const deleter = new AuxDefinitionDeleter(repository);
        const dto = { deleted_at: new Date(), deleted_by: '6f833856-8b0b-4183-a634-5b45fdf2c2b3' };
        await expect(deleter.execute(uuidv4(), dto)).rejects.toThrow(CustomError);
    });

    it('debería lanzar error si falta deleted_at', async () => {
        const auxDefinition = AuxDefinitionsMother.create();
        const repository = {
            update: jest.fn(),
            saveHistory: jest.fn(),
            find: jest.fn(async () => auxDefinition),
        };
        const deleter = new AuxDefinitionDeleter(repository);
        const dto = { deleted_by: '6f833856-8b0b-4183-a634-5b45fdf2c2b3' };
        await expect(deleter.execute(auxDefinition.id.value, dto)).rejects.toThrow('deleted_at');
    });

    it('debería lanzar error si falta deleted_by', async () => {
        const auxDefinition = AuxDefinitionsMother.create();
        const repository = {
            update: jest.fn(),
            saveHistory: jest.fn(),
            find: jest.fn(async () => auxDefinition),
        };
        const deleter = new AuxDefinitionDeleter(repository);
        const dto = { deleted_at: new Date() };
        await expect(deleter.execute(auxDefinition.id.value, dto)).rejects.toThrow('deleted_by');
    });
});
