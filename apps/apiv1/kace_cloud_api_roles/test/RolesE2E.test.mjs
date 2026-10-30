import { KnexRoleRepository } from '@kace/core/src/role/infrastructure/persistence/KnexRoleRepository.js';
import { knexConfig } from '@kace/database';
import RoleMother from '@kace/core/tests/roles/domain/RoleMother.js';
import { TestHelper } from '@kace/api-common';
import { uuidv4 } from '@kace/core/src/factories/Factory.js';
import { ListPermissions } from '@kace/core/src/role/domain/ListPermissions.js';

describe('Roles test', () => {
    const repository = new KnexRoleRepository(knexConfig);

    const baseUrl =
        process.env.APPS_ENVIRONMENT === 'staging'
            ? `https://${process.env.APPS_API_SUBDOMAIN}.${process.env.APPS_DOMAIN}/roles`
            : 'http://localhost:60039';

    beforeEach(async () => {
        await TestHelper.resetSchemaAndMigrate();
    });

    afterAll(async () => {
        try {
            repository.connection.destroy();
        } catch (error) {
            console.log(error);
        }
    });

    it('should create a Role', async () => {
        const payload = RoleMother.dto();

        const response = await TestHelper.postRequest(baseUrl, payload);

        expect(response.status).toBe(201);
    });

    it('return statusCode 400 when validation fails to create a Role', async () => {
        const payload = {};

        const response = await TestHelper.postRequest(baseUrl, payload);

        expect(response.status).toBe(400);
    });

    it('should fetch a Role', async () => {
        const role = await RoleMother.createRole(repository);

        const response = await TestHelper.getRequest(`${baseUrl}/${role.id.value}`);

        expect(response.status).toBe(200);
        expect(response.data.data.id).toBe(role.id.value);
    });

    it('should fetch all Roles', async () => {
        const role = await RoleMother.createRandomRole(repository);
        const role2 = await RoleMother.createRandomRole(repository);

        const response = await TestHelper.getRequest(`${baseUrl}/${role.id.value}`);
        const response2 = await TestHelper.getRequest(`${baseUrl}/${role2.id.value}`);

        expect(response.status).toBe(200);
        expect(response.data.data.id).toEqual(role.id.value);
        expect(response2.data.data.id).toEqual(role2.id.value);
    });

    it('should delete a Role', async () => {
        const role = await RoleMother.createRole(repository);

        const response = await TestHelper.getRequest(`${baseUrl}/${role.id.value}/delete`);

        expect(response.status).toBe(200);
    });

    it('should update a Role', async () => {
        const role = await RoleMother.createRole(repository);

        const payload = {
            descripcion: `Descripción actualizada ${role.id.value.replace(/[^a-zA-Z\s]/g, '')}`,
            permisos: new ListPermissions().toPrimivites(),
        };

        const response = await TestHelper.postRequest(`${baseUrl}/${role.id.value}`, payload);

        expect(response.status).toBe(200);
    });

    it('should return a empty object when fetch a Role that is deleted', async () => {
        const role = await RoleMother.createRole(repository);

        await TestHelper.getRequest(`${baseUrl}/delete/${role.id.value}`);

        const response = await TestHelper.getRequest(`${baseUrl}/${role.id.value}`);

        expect(response.status).toBe(200);
        expect(response.data.data).toMatchObject({});
    });

    it('should return a empty object when fetch a Role that not exist', async () => {
        const response = await TestHelper.getRequest(`${baseUrl}/${uuidv4()}`);

        expect(response.status).toBe(200);
        expect(response.data.data).toMatchObject({});
    });

    it('should return a empty object when delete a Role that is deleted', async () => {
        const role = await RoleMother.createRole(repository);

        await TestHelper.getRequest(`${baseUrl}/delete/${role.id.value}`);
        const response = await TestHelper.getRequest(`${baseUrl}/${role.id.value}/delete`);

        expect(response.data.data).toMatchObject({});
    });

    it('should return notFound when the resource doesnt exist', async () => {
        const response = await TestHelper.getRequest(`${baseUrl}/${uuidv4()}/invalid`);
        expect(response).toHaveProperty('status', 403);
    });
});
