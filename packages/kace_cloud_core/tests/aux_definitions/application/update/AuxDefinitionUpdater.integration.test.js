import { AuxDefinitionsMother } from '../../domain/AuxDefinitionsMother.js';
import { AuxDefinitionUpdater } from '../../../../src/aux_definitions/application/update/AuxDefinitionUpdater.js';
import { KnexAuxDefinitionsRepository } from '../../../../src/aux_definitions/infrastructure/persitance/KnexAuxDefinitionsRepository.js';
import { knexConfig } from '../../../knexfile.js';
import { v4 as uuidv4 } from 'uuid';

describe('AuxDefinitionUpdater (integración)', () => {
    const repository = new KnexAuxDefinitionsRepository(knexConfig);
    const updater = new AuxDefinitionUpdater(repository);
    let schemaId;
    let restflowId;

    beforeEach(async () => {
        schemaId = uuidv4();
        restflowId = uuidv4();
        await repository.connection('schemas').insert({ id: schemaId, name: 'schema_test', data_structure: {} });
        await repository.connection('ws_rest_flows').insert({ id: restflowId });
    });

    it('debería actualizar correctamente un AuxDefinition existente', async () => {
        const dto = AuxDefinitionsMother.dto({ schema_id: schemaId, restflow_id: restflowId });
        await repository.save(AuxDefinitionsMother.create({ ...dto }));
        const updatenValue = 'aux_nuevo_nombre_tabla';
        const updaterDto = { tablename: updatenValue };
        await updater.execute(updaterDto, dto.id);
        const found = await repository.find({ value: dto.id });
        expect(found).not.toBeNull();
        expect(found.tablename.value).toBe(updatenValue);
    });

    it('debería lanzar error si el AuxDefinition no existe', async () => {
        const updatenValue = 'aux_nuevo_nombre_tabla';
        const updaterDto = { tablename: updatenValue };
        await expect(updater.execute(updaterDto, uuidv4())).rejects.toThrow();
    });
});
