import { AuxDefinitionsMother } from '../../domain/AuxDefinitionsMother.js';
import { AuxDefinitionDeleter } from '../../../../src/aux_definitions/application/delete/AuxDefinitionDeleter.js';
import { KnexAuxDefinitionsRepository } from '../../../../src/aux_definitions/infrastructure/persitance/KnexAuxDefinitionsRepository.js';
import { knexConfig } from '../../../knexfile.js';
import { v4 as uuidv4 } from 'uuid';
import WSRestFlowMother from '../../../ws-rest-flows/domain/WSRestFlowMother.js';
import { KnexWSRestFlowRepository } from '../../../../src/ws-rest-flows/infrastructure/persistence/KnexWSRestFlowRepository.js';

describe('AuxDefinitionDeleter (integración)', () => {
    const repository = new KnexAuxDefinitionsRepository(knexConfig);
    const wsRestFlowRepository = new KnexWSRestFlowRepository(knexConfig);
    const deleter = new AuxDefinitionDeleter(repository);
    let schemaId;
    let restflowId;

    beforeEach(async () => {
        // Crear registros temporales en schemas y ws_rest_flows
        schemaId = uuidv4();
        restflowId = uuidv4();
        await repository.connection('schemas').insert({ id: schemaId, name: 'schema_test', data_structure: {} });
        await WSRestFlowMother.create(wsRestFlowRepository, { id: restflowId });
    });

    it('debería eliminar correctamente un AuxDefinition existente', async () => {
        // Crear registro inicial
        const dto = AuxDefinitionsMother.dto({ schema_id: schemaId, restflow_id: restflowId });
        await repository.save(AuxDefinitionsMother.create({ ...dto }));
        // Eliminar
        const deleteDto = { deleted_at: new Date(), deleted_by: uuidv4() };
        await deleter.execute(dto.id, deleteDto);
        const found = await repository.find({ value: dto.id });
        expect(found).not.toBeNull();
        expect(found.deleted_at.value).not.toBeNull();
        expect(found.deleted_by.value).toBe(deleteDto.deleted_by);
    });

    it('debería lanzar error si el AuxDefinition no existe', async () => {
        const deleteDto = { deleted_at: new Date(), deleted_by: uuidv4() };
        await expect(deleter.execute(uuidv4(), deleteDto)).rejects.toThrow();
    });
});
