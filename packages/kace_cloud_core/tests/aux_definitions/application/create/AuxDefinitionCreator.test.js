import { AuxDefinitionsMother } from '../../domain/AuxDefinitionsMother.js';
import { AuxDefinitionCreator } from '../../../../src/aux_definitions/application/create/AuxDefinitionCreator.js';
import { jest } from '@jest/globals';

describe('AuxDefinitionCreator', () => {
    it('debería crear y guardar una AuxDefinition correctamente', async () => {
        const repository = {
            save: jest.fn(async () => {}),
            find: jest.fn(async () => null),
            saveHistory: jest.fn(async () => {}),
            findByName: jest.fn(async () => {}),
            createTables: jest.fn(async () => {}),
        };

        const schemaRepository = {
            find: jest.fn(async () => true),
        };

        const wsRestFlowRepository = {
            find: jest.fn(async () => true),
        };

        const creator = new AuxDefinitionCreator(repository, schemaRepository, wsRestFlowRepository, repository);
        const dto = AuxDefinitionsMother.dto();
        await creator.execute(dto);
        expect(repository.save).toHaveBeenCalled();
        expect(repository.saveHistory).toHaveBeenCalled();
    });

    it('debería lanzar error si el DTO es inválido', async () => {
        const repository = {
            save: jest.fn(),
            find: jest.fn(async () => null),
        };
        const schemaRepository = {
            find: jest.fn(async () => true),
        };
        const wsRestFlowRepository = {
            find: jest.fn(async () => true),
        };
        const creator = new AuxDefinitionCreator(repository, schemaRepository, wsRestFlowRepository);
        await expect(creator.execute({})).rejects.toThrow();
    });

    it('debería crear y guardar una AuxDefinition correctamente si no existe', async () => {
        const repository = {
            save: jest.fn(async () => {}),
            find: jest.fn(async () => null),
            saveHistory: jest.fn(async () => {}),
            findByName: jest.fn(async () => {}),
            createTables: jest.fn(async () => {}),
        };
        const schemaRepository = {
            find: jest.fn(async () => true),
        };
        const wsRestFlowRepository = {
            find: jest.fn(async () => true),
        };
        const creator = new AuxDefinitionCreator(repository, schemaRepository, wsRestFlowRepository, repository);
        const dto = AuxDefinitionsMother.dto();
        await creator.execute(dto);
        expect(repository.save).toHaveBeenCalled();
        expect(repository.saveHistory).toHaveBeenCalled();
    });

    it('debería lanzar error si la AuxDefinition ya existe', async () => {
        const dto = AuxDefinitionsMother.dto();
        const auxDefinition = AuxDefinitionsMother.create(dto);
        const repository = {
            save: jest.fn(),
            find: jest.fn(async () => auxDefinition),
            saveHistory: jest.fn(async () => {}),
        };
        const schemaRepository = {
            find: jest.fn(async () => true),
        };
        const wsRestFlowRepository = {
            find: jest.fn(async () => true),
        };
        const creator = new AuxDefinitionCreator(repository, schemaRepository, wsRestFlowRepository, repository);
        await expect(creator.execute(dto)).rejects.toThrow(/AuxDefinition with id/);
    });

    it('debería lanzar error si el schema_id no existe', async () => {
        const repository = {
            save: jest.fn(async () => {}),
            find: jest.fn(async () => null),
            saveHistory: jest.fn(async () => {}),
            findByName: jest.fn(async () => {}),
        };
        const schemaRepository = {
            find: jest.fn(async () => false),
        };
        const wsRestFlowRepository = {
            find: jest.fn(async () => true),
        };
        const creator = new AuxDefinitionCreator(repository, schemaRepository, wsRestFlowRepository);
        const dto = AuxDefinitionsMother.dto();
        await expect(creator.execute(dto)).rejects.toThrow(/does not exist in schemas/);
    });

    it('debería lanzar error si el restflow_id no existe', async () => {
        const repository = {
            save: jest.fn(async () => {}),
            find: jest.fn(async () => null),
            saveHistory: jest.fn(async () => {}),
            findByName: jest.fn(async () => {}),
        };
        const schemaRepository = {
            find: jest.fn(async () => true),
        };
        const wsRestFlowRepository = {
            find: jest.fn(async () => false),
        };
        const creator = new AuxDefinitionCreator(repository, schemaRepository, wsRestFlowRepository);
        const dto = AuxDefinitionsMother.dto();
        await expect(creator.execute(dto)).rejects.toThrow(/does not exist in Rest Flows/);
    });

    it('debería lanzar error si el name existe', async () => {
        const existingDefinition = AuxDefinitionsMother.create();

        const repository = {
            save: jest.fn(),
            find: jest.fn(async () => null),
            saveHistory: jest.fn(),
            findByName: jest.fn(async () => existingDefinition),
        };

        const schemaRepository = {
            find: jest.fn(async () => true),
        };

        const wsRestFlowRepository = {
            find: jest.fn(async () => true),
        };

        const creator = new AuxDefinitionCreator(repository, schemaRepository, wsRestFlowRepository);
        const dto = AuxDefinitionsMother.dto();
        await expect(creator.execute(dto)).rejects.toThrow(/AuxDefinition with name '.*' already exists/);
    });

    it('debería lanzar un ValidationFailError si falla la creación de tablas', async () => {
        const repository = {
            save: jest.fn(),
            saveHistory: jest.fn(),
            find: jest.fn(async () => null),
            findByName: jest.fn(async () => null),
        };

        const schemaRepository = {
            find: jest.fn(async () => true),
        };

        const wsRestFlowRepository = {
            find: jest.fn(async () => true),
        };

        const auxTableCreator = {
            createTables: jest.fn(() => {
                throw new Error('Error creating table');
            }),
        };

        const creator = new AuxDefinitionCreator(repository, schemaRepository, wsRestFlowRepository, auxTableCreator);
        const dto = AuxDefinitionsMother.dto();
        await expect(creator.execute(dto)).rejects.toThrow('Error creating table');
        expect(auxTableCreator.createTables).toHaveBeenCalled();
        const calledWith = auxTableCreator.createTables.mock.calls[0][0];
        expect(calledWith.tablename.value).toBe(dto.tablename);
        expect(calledWith.logs_tablename.value).toBe(dto.logs_tablename);
    });
});
