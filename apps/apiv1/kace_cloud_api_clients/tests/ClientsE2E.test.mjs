import { KnexClientRepository } from '@kace/core/src/clients';
import { KnexFakeClientRepository } from '@kace/core/src/fake-clients/infrastructure/persistence/KnexFakeClientRepository.js';
import ClientMother from '@kace/core/tests/clients/domain/ClientMother';
import { production as knexConfig } from '@kace/database/knexfile';
import { TestHelper } from '@kace/api-common';
import { uuidv4 } from '@kace/core/src/factories/Factory.js';
import { Helper } from '@kace/core/src/shared/index.js';
import { ValueObjectUuid } from '@kace/core/src/shared/domain/value-object/ValueObjectUuid.js';

describe('ClientController test', () => {
    const repository = new KnexClientRepository(knexConfig);
    const fakeClientRepository = new KnexFakeClientRepository(knexConfig);

    const baseUrl =
        process.env.APPS_ENVIRONMENT === 'staging'
            ? `https://${process.env.APPS_API_SUBDOMAIN}.${process.env.APPS_DOMAIN}/clients`
            : 'http://127.0.0.1:60019';

    afterAll(async () => {
        try {
            repository.connection.destroy();
        } catch (error) {
            Helper.logInfo(error);
        }
    });

    it('should create an Client', async () => {
        const payload = ClientMother.dto();
        const response = await TestHelper.postRequest(baseUrl, payload);

        expect(response.status).toBe(201);
    });

    it('return statusCode 400 when validation fails to create an Client', async () => {
        const payload = {};

        const response = await TestHelper.postRequest(baseUrl, payload);
        expect(response).toHaveProperty('status', 400);
    });

    it('should fetch an Client', async () => {
        const client = await ClientMother.createClient(repository);
        const dataExpected = {
            id: client.id.value,
            tipo_cliente: client.tipo_cliente.value,
            tipo_documento: client.tipo_documento.value,
            documento: client.documento.value,
            nombres: client.nombres.value,
            apellido1: client.apellido1.value,
            apellido2: client.apellido2.value,
            sexo: client.sexo.value,
            estado_civil: client.estado_civil.value,
            fecha_nacimiento: client.fecha_nacimiento.value,
            email: client.email.value,
            email_alterno: client.email_alterno.value,
            telefono: client.telefono.value,
            telefono_alterno: client.telefono_alterno.value,
            campos_extra1: null,
            campos_extra2: null,
            campos_extra3: null,
            status: client.status.value,
            nombre_empresa: null,
            habeas_data: client.habeas_data.value,
            padre_id: client.padre_id.value,
            created_at: client.created_at.value,
            created_by: client.created_by.value,
            updated_at: null,
            updated_by: null,
        };

        const response = await TestHelper.getRequest(`${baseUrl}/${client.id.value}`);
        expect(response.status).toBe(200);
        expect(response.data.data).toEqual(dataExpected);
    });

    it('should fetch all Clients', async () => {
        const client1 = await ClientMother.createClient(repository);
        const client2 = await ClientMother.createClient(repository);

        const response = await TestHelper.getRequest(baseUrl);

        expect(response.status).toBe(200);
        expect(response.data.data.items[0].id).toEqual(client2.id.value);
        expect(response.data.data.items[1].id).toEqual(client1.id.value);
    });

    it('should delete an Client', async () => {
        const client = await ClientMother.createClient(repository);

        const response = await TestHelper.getRequest(`${baseUrl}/${client.id.value}/delete`);

        expect(response.status).toBe(200);
    });

    it('should update an Client', async () => {
        const client = await ClientMother.createClient(repository);
        const payload = {
            tipo_cliente: client.tipo_cliente.value,
            tipo_documento: client.tipo_documento.value,
            documento: client.documento.value,
            nombres: 'Name Modificado',
            apellido1: client.apellido1.value,
            apellido2: client.apellido2.value,
            sexo: client.sexo.value,
            estado_civil: client.estado_civil.value,
            fecha_nacimiento: client.fecha_nacimiento.value,
            email: client.email.value,
            email_alterno: client.email_alterno.value,
            telefono: client.telefono.value,
            telefono_alterno: client.telefono_alterno.value,
            campos_extra1: client.campos_extra1.value,
            campos_extra2: client.campos_extra2.value,
            campos_extra3: client.campos_extra3.value,
            padre_id: client.padre_id.value,
            habeas_data: client.habeas_data.value,
            status: client.status.value,
        };

        const response = await TestHelper.postRequest(`${baseUrl}/${client.id.value}`, payload);

        expect(response.status).toBe(200);
    });

    it('should return notFound when the resource doesnt exist', async () => {
        const response = await TestHelper.getRequest(`${baseUrl}/${uuidv4()}/invalid`);
        expect(response).toHaveProperty('status', 403);
    });

    it('should create a FakeClient if it does not exist', async () => {
        const payload = ClientMother.dto();

        const fakeBefore = await fakeClientRepository.find(new ValueObjectUuid('id', payload.id));
        expect(fakeBefore).toBeNull();

        const response = await TestHelper.postRequest(baseUrl, payload);
        expect([200, 201]).toContain(response.status);

        const fakeAfter = await fakeClientRepository.find(new ValueObjectUuid('id', payload.id));
        expect(fakeAfter).not.toBeNull();
    });
});
