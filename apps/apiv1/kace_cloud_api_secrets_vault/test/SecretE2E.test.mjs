import { production as knexConfig } from '@kace/database/knexfile';
import { TestHelper } from '@kace/api-common';
import { KnexSecretsVaultRepository } from '@kace/core/src/secrets-vault/infrastructure/persistence/KnexSecretsVaultRepository.js';
import { SecretsVaultMother } from '@kace/core/tests/secrets/domain/SecretsVaultMother.js';
import { uuidv4 } from '@kace/core/src/factories/Factory.js';

describe('GroupsE2E test', () => {
    const repository = new KnexSecretsVaultRepository(knexConfig);

    const baseUrl =
        process.env.APPS_ENVIRONMENT === 'staging'
            ? `https://${process.env.APPS_API_SUBDOMAIN}.${process.env.APPS_DOMAIN}/secrets-vaults`
            : 'http://localhost:60041';

    afterAll(async () => {
        try {
            repository.connection.destroy();
        } catch (error) {
            console.log(error);
        }
    });

    it('should create a Secret', async () => {
        const payload = SecretsVaultMother.randomDto();

        const response = await TestHelper.postRequest(baseUrl, payload);

        expect(response.status).toBe(201);
    });

    it('return statusCode 400 when validation fails to create a Secret', async () => {
        const payload = {};

        const response = await TestHelper.postRequest(baseUrl, payload);
        expect(response).toHaveProperty('status', 400);
    });

    it('should fetch a Secret', async () => {
        const secret = await SecretsVaultMother.createRandomSecret(repository);
        const dataExpected = {
            id: secret.id.value,
            descripcion: secret.descripcion.value,
            referencia: secret.referencia.value,
            secreto: '***',
            created_by: secret.created_by.value,
            created_at: secret.created_at.value,
        };

        const response = await TestHelper.getRequest(`${baseUrl}/${secret.id.value}`);

        expect(response.status).toBe(200);
        expect(response.data.data).toMatchObject(dataExpected);
    });

    it('should fetch all Secrets', async () => {
        const secret = await SecretsVaultMother.createRandomSecret(repository);
        const secret2 = await SecretsVaultMother.createRandomSecret(repository);

        const response = await TestHelper.getRequest(baseUrl);

        expect(response.status).toBe(200);
        expect(response.data.data.items[0].id).toEqual(secret2.id.value);
        expect(response.data.data.items[1].id).toEqual(secret.id.value);
    });

    it('should delete a Secret', async () => {
        const secret = await SecretsVaultMother.createRandomSecret(repository);

        const response = await TestHelper.getRequest(`${baseUrl}/${secret.id.value}/delete`);

        expect(response.status).toBe(200);
    });

    it('should update a Secret', async () => {
        const secret = await SecretsVaultMother.createRandomSecret(repository);

        const payload = {
            descripcion: 'Descripción actualizado desde test',
        };

        const response = await TestHelper.postRequest(`${baseUrl}/${secret.id.value}`, payload);

        expect(response.status).toBe(200);
    });

    it('should return a empty object when fetch a Secret that is deleted', async () => {
        const secret = await SecretsVaultMother.createRandomSecret(repository);

        await TestHelper.getRequest(`${baseUrl}/delete/${secret.id.value}`);

        const response = await TestHelper.getRequest(`${baseUrl}/${secret.id.value}`);

        expect(response.status).toBe(200);
        expect(response.data.data).toMatchObject({});
    });

    it('should return a empty object when fetch a Secret that not exist', async () => {
        const response = await TestHelper.getRequest(`${baseUrl}/${uuidv4()}`);

        expect(response.status).toBe(200);
        expect(response.data.data).toMatchObject({});
    });

    it('should return a empty object when delete a Secret that is deleted', async () => {
        const secret = await SecretsVaultMother.createRandomSecret(repository);

        await TestHelper.getRequest(`${baseUrl}/${secret.id.value}/delete`);
        const response = await TestHelper.getRequest(`${baseUrl}/${secret.id.value}/delete`);
        await expect(response).toHaveProperty('response.status', 500);
    });

    it('should return notFound when the resource doesnt exist', async () => {
        const response = await TestHelper.getRequest(`${baseUrl}/${uuidv4()}/invalid`);
        expect(response).toHaveProperty('status', 403);
    });
});
