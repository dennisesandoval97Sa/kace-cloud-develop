import { AuxDefinitionsMother } from '../domain/AuxDefinitionsMother.js';
import { AuxDefinitionResponse } from '../../../src/aux_definitions/application/AuxDefinitionResponse.js';

describe('AuxDefinitionResponse', () => {
    it('debería convertir una AuxDefinition válida a JSON', () => {
        const dto = AuxDefinitionsMother.dto();
        const auxDefinition = AuxDefinitionsMother.create(dto);
        const response = new AuxDefinitionResponse(auxDefinition);
        const json = response.toJson();
        expect(json).toHaveProperty('data');
        expect(json.data).toMatchObject({
            id: dto.id,
            tablename: dto.tablename,
            schema_id: dto.schema_id,
            restflow_id: dto.restflow_id,
            is_active: dto.is_active,
            created_at: dto.created_at.toISOString(),
            created_by: dto.created_by,
            updated_at: dto.updated_at.toISOString(),
            updated_by: dto.updated_by,
            deleted_at: dto.deleted_at,
            deleted_by: dto.deleted_by,
        });
    });

    it('debería devolver un objeto vacío si la AuxDefinition es null', () => {
        const response = new AuxDefinitionResponse(null);
        expect(response.toJson()).toEqual({});
    });
});
