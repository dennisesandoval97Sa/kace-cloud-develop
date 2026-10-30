import { production as knexConfig } from '@kace/database/knexfile';
import { KnexGeolocationRepository } from '@kace/core/src/geolocation';
import { KnexPoliciesRepository } from '@kace/core/src/policies/infrastructure/persistence/KnexPoliciesRepository.js';
import { KnexRoleRepository } from '@kace/core/src/role/infrastructure/persistence/KnexRoleRepository.js';
import { KnexUsersRepository } from '@kace/core/src/users';
import { GeolocationsMother } from '@kace/core/tests/geolocation/domain/GeolocationsMother.js';
import RoleMother from '@kace/core/tests/roles/domain/RoleMother';
import { PoliciesMother } from '@kace/core/tests/policies/domain/PoliciesMother';
import UsersMother from '@kace/core/tests/users/domain/UsersMother.js';
import { TestHelper } from '@kace/api-common';
import { VALIDATION_ERROR } from '@kace/error-codes';

const getUpdatedPayload = (geolocationPayload) => {
    const { id, created_at, created_by, user_id, ...geolocationUpdatedPayload } = geolocationPayload;
    return { ...geolocationUpdatedPayload, action_type: 'Updated description' };
};

const createUserWithRoleAndPolicy = async (politicRepository, roleRepository, userRepository) => {
    const politics = await PoliciesMother.createPolicy(politicRepository);
    const { id: rol_id } = await RoleMother.createRole(roleRepository, {
        policy_id: politics.id.value,
    });
    const user = await UsersMother.createUser(userRepository, {
        rol_id: rol_id.value,
    });

    return { politics, rol_id, user };
};

describe('Geolocation E2E - Controller', () => {
    const geolocationRepository = new KnexGeolocationRepository(knexConfig);
    const roleRepository = new KnexRoleRepository(geolocationRepository.connection);
    const politicRepository = new KnexPoliciesRepository(geolocationRepository.connection);
    const userRepository = new KnexUsersRepository(geolocationRepository.connection);

    const baseUrl =
        process.env.APPS_ENVIRONMENT === 'staging'
            ? `https://${process.env.APPS_API_SUBDOMAIN}.${process.env.APPS_DOMAIN}/geolocation`
            : `http://127.0.0.1:60071/`;

    const messages = {
        INVALID_ID: 'Invalid id',
        VALIDATIONS_FAIL: 'Validations fail',
        GEOLOCATION_NOT_FOUND: 'Geolocation not found',
        NOT_FOUND: 'Not found',
        SUCCESS: 'Success',
    };

    const UUID_FALSE = '123e4567-e89b-12d3-a456-426614174000';

    afterAll(async () => {
        try {
            await geolocationRepository.connection.destroy();
            await userRepository.connection.destroy();
            await politicRepository.connection.destroy();
            await roleRepository.connection.destroy();
        } catch (error) {
            console.error(error);
        }
    });

    it('should create a geolocation', async () => {
        const { user } = await createUserWithRoleAndPolicy(politicRepository, roleRepository, userRepository);

        const geolocationPayload = GeolocationsMother.dto(user.id.value);

        await expect(TestHelper.postRequest(baseUrl, geolocationPayload)).resolves.toHaveProperty('status', 201);
    });

    it('should not create a geolocation with a non-existent user', async () => {
        const geolocationPayload = GeolocationsMother.dto();

        await expect(TestHelper.postRequest(baseUrl, geolocationPayload)).resolves.toHaveProperty('status', 500);
    });

    it('should not create a geolocation with an invalid id', async () => {
        const { user } = await createUserWithRoleAndPolicy(politicRepository, roleRepository, userRepository);

        const geolocationPayload = GeolocationsMother.dto(user.id.value);

        geolocationPayload.id = messages.INVALID_ID;

        const { response } = await TestHelper.postRequest(baseUrl, geolocationPayload);

        expect(response).toHaveProperty('status', 400);
        expect(response.data).toHaveProperty('message', messages.VALIDATIONS_FAIL);
    });

    it('should not create a geolocation with an existing id', async () => {
        const { user } = await createUserWithRoleAndPolicy(politicRepository, roleRepository, userRepository);

        const geolocation = await GeolocationsMother.create(geolocationRepository, user.id.value);
        const geolocationPayload = GeolocationsMother.dto(user.id.value);

        geolocationPayload.id = geolocation.id.value;

        await expect(TestHelper.postRequest(baseUrl, geolocationPayload)).resolves.toHaveProperty('status', 400);
    });

    it('should not create a geolocation with missing fields', async () => {
        const { user } = await createUserWithRoleAndPolicy(politicRepository, roleRepository, userRepository);

        const geolocationPayload = GeolocationsMother.dto(user.id.value);
        delete geolocationPayload.action_type;

        const { response } = await TestHelper.postRequest(baseUrl, geolocationPayload);

        expect(response).toHaveProperty('status', 400);
        expect(response.data).toHaveProperty('message', messages.VALIDATIONS_FAIL);
    });

    it('should update a geolocation', async () => {
        const { user } = await createUserWithRoleAndPolicy(politicRepository, roleRepository, userRepository);

        const geolocationPayload = GeolocationsMother.dto(user.id.value);
        const geolocationUpdatedPayload = getUpdatedPayload(geolocationPayload);

        const geolocation = await GeolocationsMother.create(geolocationRepository, user.id.value);

        await expect(
            TestHelper.postRequest(`${baseUrl}/${geolocation.id.value}`, geolocationUpdatedPayload)
        ).resolves.toHaveProperty('status', 200);
    });

    it('should not update a geolocation that does not exist', async () => {
        const { user } = await createUserWithRoleAndPolicy(politicRepository, roleRepository, userRepository);

        const geolocationPayload = GeolocationsMother.dto(user.id.value);
        const updatePayload = getUpdatedPayload(geolocationPayload);

        const nonExistentId = UUID_FALSE;

        const { response } = await TestHelper.postRequest(`${baseUrl}/${nonExistentId}`, updatePayload);

        expect(response.status).toBe(400);
        expect(response.data.errors[0]).toEqual({
            code: VALIDATION_ERROR,
            message: 'The request could not be processed.',
        });
    });

    it('should not update a geolocation with invalid ID', async () => {
        const { user } = await createUserWithRoleAndPolicy(politicRepository, roleRepository, userRepository);

        const geolocationPayload = GeolocationsMother.dto(user.id.value);
        const updatePayload = getUpdatedPayload(geolocationPayload);

        const invalidId = messages.INVALID_ID;

        const { response } = await TestHelper.postRequest(`${baseUrl}/${invalidId}`, updatePayload);

        expect(response.status).toBe(400);
        expect(response.data).toHaveProperty('message', messages.INVALID_ID);
    });

    it('should find a geolocation by id', async () => {
        const { user } = await createUserWithRoleAndPolicy(politicRepository, roleRepository, userRepository);

        const geolocation = await GeolocationsMother.create(geolocationRepository, user.id.value);

        const response = await TestHelper.getRequest(`${baseUrl}/${geolocation.id.value}`);

        expect(response).toHaveProperty('status', 200);
    });

    it('should not find a geolocation with a non-existent id', async () => {
        const geolocationPayload = GeolocationsMother.dto();

        const { response } = await TestHelper.getRequest(`${baseUrl}/${geolocationPayload.id}`);

        expect(response).toHaveProperty('status', 404);
        expect(response.data).toHaveProperty('message', messages.NOT_FOUND);
    });

    it('should not find a geolocation with invalid id', async () => {
        const invalidId = messages.INVALID_ID;

        const { response } = await TestHelper.getRequest(`${baseUrl}/${invalidId}`);

        expect(response).toHaveProperty('status', 400);
        expect(response.data).toHaveProperty('message', messages.INVALID_ID);
    });

    it('should delete a geolocation', async () => {
        const { user } = await createUserWithRoleAndPolicy(politicRepository, roleRepository, userRepository);

        const geolocation = await GeolocationsMother.create(geolocationRepository, user.id.value);

        const response = await TestHelper.getRequest(`${baseUrl}/${geolocation.id.value}/delete`);

        expect(response).toHaveProperty('status', 200);
        expect(response.data).toHaveProperty('message', messages.SUCCESS);
    });

    it('should not delete a geolocation that does not exist', async () => {
        const nonExistentId = UUID_FALSE;

        const { response } = await TestHelper.getRequest(`${baseUrl}/${nonExistentId}/delete`);

        expect(response).toHaveProperty('status', 400);
        expect(response.data.errors[0]).toEqual({
            code: VALIDATION_ERROR,
            message: 'The request could not be processed.',
        });
    });

    it('should not delete a geolocation that invalid id', async () => {
        const invalidId = messages.INVALID_ID;

        const { response } = await TestHelper.getRequest(`${baseUrl}/${invalidId}/delete`);

        expect(response).toHaveProperty('status', 400);
        expect(response.data).toHaveProperty('message', messages.INVALID_ID);
    });

    it('should find all geolocations', async () => {
        const { user } = await createUserWithRoleAndPolicy(politicRepository, roleRepository, userRepository);

        await GeolocationsMother.createMany(geolocationRepository, 5, user.id.value);

        const response = await TestHelper.getRequest(`${baseUrl}`);

        expect(response.status).toBe(200);
        expect(response.data?.data?.items?.length ?? 0).toBeGreaterThan(0);
    });

    it('should search geolocations by user id', async () => {
        const { user: userOne } = await createUserWithRoleAndPolicy(politicRepository, roleRepository, userRepository);
        const { user: userTwo } = await createUserWithRoleAndPolicy(politicRepository, roleRepository, userRepository);

        await GeolocationsMother.createMany(geolocationRepository, 5, userOne.id.value);
        await GeolocationsMother.createMany(geolocationRepository, 5, userTwo.id.value);

        const criteriaPayload = {
            filter: [
                {
                    field: 'user_id',
                    operator: 'eq',
                    value: userOne.id.value,
                    type: 'AND',
                },
            ],
            limit: 10,
            offset: 0,
            order: {
                field: 'created_at',
                direction: 'asc',
            },
        };

        const response = await TestHelper.postRequest(`${baseUrl}/search`, criteriaPayload);

        expect(response.status).toBe(200);
        expect(response.data?.data?.items.length).toEqual(5);
        expect(+response.data?.metadata?.count.count).toEqual(5);
    });

    it('should return no results for non-existent user id in search', async () => {
        const criteriaPayload = {
            filter: [
                {
                    field: 'user_id',
                    operator: 'eq',
                    value: messages.INVALID_ID,
                    type: 'AND',
                },
            ],
            limit: 10,
            offset: 0,
            order: {
                field: 'created_at',
                direction: 'asc',
            },
        };

        const response = await TestHelper.postRequest(`${baseUrl}/search`, criteriaPayload);

        expect(response.status).toBe(200);
        expect(response.data?.data?.items?.length ?? 0).toEqual(0);
        expect(+response.data?.metadata?.count.count).toEqual(0);
    });
});
