import { AuxDefinitionsMother } from '../../domain/AuxDefinitionsMother.js';
import { AuxDefinitionCreator } from '../../../../src/aux_definitions/application/create/AuxDefinitionCreator.js';
import { KnexAuxDefinitionsRepository } from '../../../../src/aux_definitions/infrastructure/persitance/KnexAuxDefinitionsRepository.js';
import { knexConfig } from '../../../knexfile.js';
import { v4 as uuidv4 } from 'uuid';
import { jest } from '@jest/globals';
import { KnexWSRestFlowRepository } from '../../../../src/ws-rest-flows/infrastructure/persistence/KnexWSRestFlowRepository.js';
import WSRestFlowMother from '../../../ws-rest-flows/domain/WSRestFlowMother.js';

describe('AuxDefinitionCreator (integración)', () => {
    const repository = new KnexAuxDefinitionsRepository(knexConfig);
    //TODO: Importar el repositorio de schemas real
    const schemaRepository = {
        find: jest.fn(async () => true),
    };
    const wsRestFlowRepository = new KnexWSRestFlowRepository(knexConfig);
    const highPrivilegesRepository = new KnexAuxDefinitionsRepository(knexConfig);

    const creator = new AuxDefinitionCreator(
        repository,
        schemaRepository,
        wsRestFlowRepository,
        highPrivilegesRepository
    );
    let schemaId;
    let restflowId;

    beforeEach(async () => {
        // Crear registros temporales en schemas y ws_rest_flows
        schemaId = uuidv4();
        restflowId = uuidv4();
        await repository.connection('schemas').insert({ id: schemaId, name: 'schema_test', data_structure: {} });
        await WSRestFlowMother.create(wsRestFlowRepository, { id: restflowId });
    });

    it('debería crear y guardar una AuxDefinition correctamente si no existe', async () => {
        const dto = AuxDefinitionsMother.dto({ schema_id: schemaId, restflow_id: restflowId });
        await creator.execute(dto);
        const found = await repository.find({ value: dto.id });
        expect(found).not.toBeNull();
        expect(found.id.value).toBe(dto.id);
    });

    it('debería lanzar error si la AuxDefinition ya existe', async () => {
        const dto = AuxDefinitionsMother.dto({ schema_id: schemaId, restflow_id: restflowId });
        await creator.execute(dto);
        await expect(creator.execute(dto)).rejects.toThrow();
    });

    it('debería crear las tablas asociadas (aux y logs) al crear una AuxDefinition', async () => {
        const dto = AuxDefinitionsMother.dto({ schema_id: schemaId, restflow_id: restflowId });

        await creator.execute(dto);

        const existsMain = await repository.connection.schema.hasTable(dto.tablename);
        const existsLogs = await repository.connection.schema.hasTable(dto.logs_tablename);

        expect(existsMain).toBe(true);
        expect(existsLogs).toBe(true);

        const mainColumns = await repository.connection(dto.tablename).columnInfo();
        expect(mainColumns).toHaveProperty('id');
        expect(mainColumns).toHaveProperty('data');
        expect(mainColumns).toHaveProperty('created_at');

        const logsColumns = await repository.connection(dto.logs_tablename).columnInfo();
        expect(logsColumns).toHaveProperty('id');
        expect(logsColumns).toHaveProperty('entity_id');
        expect(logsColumns).toHaveProperty('changed_attributes');
    });
});
