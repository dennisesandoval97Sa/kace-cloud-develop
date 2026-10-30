import { AuxDefinitionsMother } from './AuxDefinitionsMother.js';
import { AuxDefinitionTableNameFinder } from '../../../src/aux_definitions/domain/AuxDefinitionTableNameFinder.js';
import { AuxDefinitionCreator } from '../../../src/aux_definitions/application/create/AuxDefinitionCreator.js';
import { KnexAuxDefinitionsRepository } from '../../../src/aux_definitions/infrastructure/persitance/KnexAuxDefinitionsRepository.js';
import { knexConfig } from '../../knexfile.js';
import { v4 as uuidv4 } from 'uuid';
import { jest } from '@jest/globals';
import { KnexSchemasRepository } from '../../../src/schemas/infrastructure/persistence/KnexSchemasRepository.js';
import { KnexWSRestFlowRepository } from '../../../src/ws-rest-flows/index.js';
import { SchemasMother } from '../../schemas/domain/SchemasMother.js';
import WSRestFlowMother from '../../ws-rest-flows/domain/WSRestFlowMother.js';

describe('AuxDefinitionTableNameFinder (domain)', () => {
    it('debería retornar la entidad si existe por tablename', async () => {
        const dto = AuxDefinitionsMother.dto();
        const auxDefinition = AuxDefinitionsMother.create(dto);

        const repository = {
            findByTableName: jest.fn(async () => auxDefinition),
        };
        const finder = new AuxDefinitionTableNameFinder(repository);

        const result = await finder.execute(dto.tablename);

        expect(repository.findByTableName).toHaveBeenCalledWith(expect.anything());
        expect(result).toBe(auxDefinition);
    });

    it('debería lanzar un error si la entidad no existe por tablename', async () => {
        const repository = {
            findByTableName: jest.fn(async () => null),
        };
        const finder = new AuxDefinitionTableNameFinder(repository);

        await expect(finder.execute('aux_non_existent_tablename')).rejects.toThrow(/does not exist in aux_definitions/);
    });
});

describe('AuxDefinitionTableNameFinder (integración)', () => {
    const repository = new KnexAuxDefinitionsRepository(knexConfig);
    const schemaRepository = new KnexSchemasRepository(knexConfig);
    const wsRestFlowRepository = new KnexWSRestFlowRepository(knexConfig);
    const highPrivilegesRepository = repository;

    const creator = new AuxDefinitionCreator(
        repository,
        schemaRepository,
        wsRestFlowRepository,
        highPrivilegesRepository
    );
    const finder = new AuxDefinitionTableNameFinder(repository);
    let schemaId;
    let restflowId;

    beforeEach(async () => {
        schemaId = uuidv4();
        restflowId = uuidv4();
        await repository.connection('schemas').insert(SchemasMother.dto({ id: schemaId }));
        await repository.connection('ws_rest_flows').insert(WSRestFlowMother.dto({ id: restflowId }));
    });

    it('debería crear y luego encontrar un AuxDefinition por tablename', async () => {
        const dto = AuxDefinitionsMother.dto({ schema_id: schemaId, restflow_id: restflowId });
        await creator.execute(dto);
        const found = await finder.execute(dto.tablename);
        expect(found).not.toBeNull();
        expect(found.tablename.value).toBe(dto.tablename);
        expect(found.id.value).toBe(dto.id);
    });

    it('debería lanzar un error si no existe AuxDefinition con ese tablename', async () => {
        await expect(finder.execute('aux_tabla_inexistente')).rejects.toThrow(/does not exist in aux_definitions/);
    });
});
