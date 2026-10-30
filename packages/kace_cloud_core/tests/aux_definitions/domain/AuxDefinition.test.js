import { AuxDefinitionsMother } from './AuxDefinitionsMother.js';
import { AuxDefinition } from '../../../src/aux_definitions/domain/AuxDefinition.js';
import { ValueObjectUuid } from '../../../src/shared/domain/value-object/ValueObjectUuid.js';

describe('AuxDefinition', () => {
    it('debería crearse correctamente con todos los campos requeridos', () => {
        const dto = AuxDefinitionsMother.dto();
        const auxDefinition = AuxDefinition.create(dto);

        expect(auxDefinition).toBeInstanceOf(AuxDefinition);
        expect(auxDefinition.id).toBeInstanceOf(ValueObjectUuid);
        expect(auxDefinition.name.value).toBe(dto.name);
        expect(auxDefinition.tablename.value).toBe(dto.tablename);
        expect(auxDefinition.logs_tablename.value).toBe(dto.logs_tablename);
        expect(auxDefinition.schema_id.value).toBe(dto.schema_id);
        expect(auxDefinition.restflow_id.value).toBe(dto.restflow_id);
        expect(auxDefinition.is_active.value).toBe(dto.is_active);
        expect(auxDefinition.created_at.value).toEqual(dto.created_at.toISOString());
        expect(auxDefinition.created_by.value).toBe(dto.created_by);
        expect(auxDefinition.updated_at.value).toEqual(dto.updated_at.toISOString());
        expect(auxDefinition.updated_by.value).toBe(dto.updated_by);
        expect(auxDefinition.deleted_at.value).toBeNull();
        expect(auxDefinition.deleted_by.value).toBeNull();
    });

    it('debería permitir actualizar los campos mediante setters', () => {
        const dto = AuxDefinitionsMother.dto();
        const auxDefinition = AuxDefinition.create(dto);
        const nuevoNombre = 'nuevo_nombre';
        const nuevoTablename = 'aux_nuevo_tbl';
        const nuevoLogsTablename = 'nuevo_logs';
        const nuevoSchemaId = dto.schema_id;
        const nuevoRestflowId = dto.restflow_id;
        const nuevoActivo = false;

        auxDefinition.name = nuevoNombre;
        auxDefinition.tablename = nuevoTablename;
        auxDefinition.logs_tablename = nuevoLogsTablename;
        auxDefinition.schema_id = nuevoSchemaId;
        auxDefinition.restflow_id = nuevoRestflowId;
        auxDefinition.is_active = nuevoActivo;

        expect(auxDefinition.name.value).toBe(nuevoNombre);
        expect(auxDefinition.tablename.value).toBe(nuevoTablename);
        expect(auxDefinition.logs_tablename.value).toBe(nuevoLogsTablename);
        expect(auxDefinition.schema_id.value).toBe(nuevoSchemaId);
        expect(auxDefinition.restflow_id.value).toBe(nuevoRestflowId);
        expect(auxDefinition.is_active.value).toBe(nuevoActivo);
    });

    it('debería exponer los value objects correctos a través de los getters', () => {
        const dto = AuxDefinitionsMother.dto();
        const auxDefinition = AuxDefinition.create(dto);
        expect(typeof auxDefinition.name.value).toBe('string');
        expect(typeof auxDefinition.tablename.value).toBe('string');
        expect(typeof auxDefinition.logs_tablename.value).toBe('string');
        expect(typeof auxDefinition.schema_id.value).toBe('string');
        expect(typeof auxDefinition.restflow_id.value).toBe('string');
        expect(typeof auxDefinition.is_active.value).toBe('boolean');
    });
});
