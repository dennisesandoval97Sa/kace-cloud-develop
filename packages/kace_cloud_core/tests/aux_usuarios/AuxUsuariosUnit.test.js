import { AuxUsersMother } from './domain/AuxUsuariosMother.js';
import { AuxUsers } from '../../src/aux_usuarios/domain/AuxUsers.js';
import { ValueObjectUuid } from '../../src/shared/index.js';
import { ValueObjectJson } from '../../src/shared/index.js';
import { AuxUserResponse } from '../../src/aux_usuarios/application/AuxUserResponse.js';

describe('Aux user unit test', () => {
    it('should create a valid aux client aggregate', async () => {
        const dto = AuxUsersMother.dto();
        const auxUserAggregate = AuxUsers.create(dto);

        expect(auxUserAggregate).toHaveProperty('id');
        expect(auxUserAggregate).toHaveProperty('created_at');
        expect(auxUserAggregate).toHaveProperty('created_by');
        expect(auxUserAggregate).toHaveProperty('updated_at');
        expect(auxUserAggregate).toHaveProperty('updated_by');
        expect(auxUserAggregate).toHaveProperty('deleted_at');
        expect(auxUserAggregate).toHaveProperty('deleted_by');

        const usuarioId = auxUserAggregate.usuario_id;
        expect(usuarioId).toBeInstanceOf(ValueObjectUuid);
        expect(typeof usuarioId.value).toBe('string');

        const data = auxUserAggregate.data;
        expect(data).toBeInstanceOf(ValueObjectJson);
        expect(typeof data.value).toBe('object');
    });

    it('AuxUserResponse to have a valid data property', async () => {
        const dto = AuxUsersMother.dto();
        const auxUserAggregate = AuxUsers.create(dto);

        const response = new AuxUserResponse(auxUserAggregate).toJson();

        expect(response).toHaveProperty('data');

        expect(response.data).toHaveProperty('id');
        expect(response.data).toHaveProperty('usuario_id');
        expect(response.data).toHaveProperty('data');
        expect(response.data).toHaveProperty('created_at');
        expect(response.data).toHaveProperty('created_by');
        expect(response.data).toHaveProperty('updated_at');
        expect(response.data).toHaveProperty('updated_by');
    });
});
