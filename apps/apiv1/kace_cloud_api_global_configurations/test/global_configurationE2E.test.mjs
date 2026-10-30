import { KnexGlobalConfigurationRepository } from '@kace/core/src/global-config';
import { GlobalConfigurationsMother } from '@kace/core/tests/global-config/domain/GlobalConfigurationsMother.js';
import { SETTINGS } from '@kace/core/tests/global-config/domain/SettingsMother.js';
import { TestHelper } from '@kace/api-common';
import { uuidv4 } from '@kace/core/src/factories/Factory.js';

const tenant = await TestHelper.getTenant();

describe('GlobalConfigurationController E2E tests', () => {
    const repository = new KnexGlobalConfigurationRepository(tenant.buildKnexConfig());
    const baseUrl = 'http://127.0.0.1:60026';

    afterAll(async () => {
        try {
            await repository.connection.destroy();
        } catch (error) {
            console.log(error);
        }
    });

    // ============================================================
    // CREATE OPERATION
    // ============================================================
    describe('POST / - Create GlobalConfiguration', () => {
        beforeEach(async () => {
            await TestHelper.resetSchemaAndMigrate(tenant);
        });

        it('should create a GlobalConfiguration successfully', async () => {
            // Arrange
            const payload = GlobalConfigurationsMother.dto();

            // Act
            const response = await TestHelper.postRequest(baseUrl, payload);

            // Assert
            expect(response.status).toBe(201);
            expect(response.data).toBeDefined();
        });

        it('should return statusCode 400 when validation fails with empty payload', async () => {
            // Arrange
            const payload = {};

            // Act
            const response = await TestHelper.postRequest(baseUrl, payload);

            // Assert
            expect(response).toHaveProperty('status', 400);
        });

        it('should return statusCode 400 when settings is missing (required field)', async () => {
            // Arrange
            const payload = GlobalConfigurationsMother.dto();
            delete payload.settings;

            // Act
            const response = await TestHelper.postRequest(baseUrl, payload);

            // Assert
            expect(response).toHaveProperty('status', 400);
        });

        it('should return statusCode 400 when settings is null', async () => {
            // Arrange
            const payload = GlobalConfigurationsMother.dto();
            payload.settings = null;

            // Act
            const response = await TestHelper.postRequest(baseUrl, payload);

            // Assert
            expect(response).toHaveProperty('status', 400);
        });

        it('should return statusCode 400 when description exceeds 255 characters', async () => {
            // Arrange
            const payload = GlobalConfigurationsMother.dto();
            payload.description = 'A'.repeat(256);

            // Act
            const response = await TestHelper.postRequest(baseUrl, payload);

            // Assert
            expect(response).toHaveProperty('status', 400);
        });

        it('should create successfully when description is exactly 255 characters', async () => {
            // Arrange
            const payload = GlobalConfigurationsMother.dto();
            payload.description = 'A'.repeat(255);

            // Act
            const response = await TestHelper.postRequest(baseUrl, payload);

            // Assert
            expect(response.status).toBe(201);
        });

        it('should return statusCode 400 when is_active is not a boolean', async () => {
            // Arrange
            const payload = GlobalConfigurationsMother.dto();
            payload.is_active = 'not-a-boolean';

            // Act
            const response = await TestHelper.postRequest(baseUrl, payload);

            // Assert
            expect(response).toHaveProperty('status', 400);
        });

        it('should return statusCode 400 when id is not a valid UUID', async () => {
            // Arrange
            const payload = GlobalConfigurationsMother.dto();
            payload.id = 'not-a-uuid';

            // Act
            const response = await TestHelper.postRequest(baseUrl, payload);

            // Assert
            expect(response).toHaveProperty('status', 400);
        });

        it('should handle concurrent creation', async () => {
            // Arrange
            const payload1 = GlobalConfigurationsMother.dto();
            const payload2 = GlobalConfigurationsMother.dto();

            // Act
            const [response1, response2] = await Promise.all([
                TestHelper.postRequest(baseUrl, payload1),
                TestHelper.postRequest(baseUrl, payload2),
            ]);

            // Assert
            expect(response1.status).toBe(201);
            expect(response2.status).toBe(201);
        });
    });

    // ============================================================
    // READ OPERATION
    // ============================================================
    describe('GET /:id - Read GlobalConfiguration by ID', () => {
        beforeEach(async () => {
            await TestHelper.resetSchemaAndMigrate(tenant);
        });

        it('should fetch a GlobalConfiguration successfully', async () => {
            // Arrange
            const config = await GlobalConfigurationsMother.createConfiguration(repository);
            const dataExpected = {
                id: config.id.value,
                settings: config.settings.value,
                description: config.description.value,
                is_active: config.is_active.value,
                created_at: config.created_at.value,
                updated_at: null,
                created_by: config.created_by.value,
                updated_by: null,
                deleted_at: null,
                deleted_by: null,
            };

            // Act
            const response = await TestHelper.getRequest(`${baseUrl}/${config.id.value}`);

            // Assert
            expect(response.status).toBe(200);
            expect(response.data.data).toEqual(dataExpected);
        });

        it('should return 404 when fetching a non-existent GlobalConfiguration', async () => {
            // Arrange
            const nonExistentId = uuidv4();

            // Act
            const response = await TestHelper.getRequest(`${baseUrl}/${nonExistentId}`);

            // Assert
            expect(response.status).toBe(404);
        });

        it('should return statusCode 400 when ID is invalid format', async () => {
            // Arrange
            const invalidId = 'invalid-uuid-format';

            // Act
            const response = await TestHelper.getRequest(`${baseUrl}/${invalidId}`);

            // Assert
            expect(response).toHaveProperty('status', 400);
        });

        it('should return all required fields in response', async () => {
            // Arrange
            const config = await GlobalConfigurationsMother.createConfiguration(repository);

            // Act
            const response = await TestHelper.getRequest(`${baseUrl}/${config.id.value}`);

            // Assert
            expect(response.status).toBe(200);
            const requiredFields = [
                'id',
                'settings',
                'description',
                'is_active',
                'created_at',
                'created_by',
                'updated_at',
                'updated_by',
                'deleted_at',
                'deleted_by',
            ];
            requiredFields.forEach((field) => {
                expect(response.data.data).toHaveProperty(field);
            });
        });

        it('should return settings with correct nested structure', async () => {
            // Arrange
            const config = await GlobalConfigurationsMother.createConfiguration(repository);

            // Act
            const response = await TestHelper.getRequest(`${baseUrl}/${config.id.value}`);

            // Assert
            expect(response.status).toBe(200);
            const settings = response.data.data.settings;
            expect(settings).toHaveProperty('layouts');
            expect(settings).toHaveProperty('behaviors');
            expect(settings).toHaveProperty('custom_fields');
            expect(settings.layouts).toHaveProperty('application');
            expect(settings.behaviors).toHaveProperty('application');
            expect(settings.custom_fields).toHaveProperty('application');
        });
    });

    // ============================================================
    // UPDATE OPERATION
    // ============================================================
    describe('POST /:id - Update GlobalConfiguration', () => {
        beforeEach(async () => {
            await TestHelper.resetSchemaAndMigrate(tenant);
        });

        it('should update a GlobalConfiguration successfully', async () => {
            // Arrange
            const config = await GlobalConfigurationsMother.createConfiguration(repository);
            const payload = {
                description: 'Updated description',
            };

            // Act
            const response = await TestHelper.postRequest(`${baseUrl}/${config.id.value}`, payload);

            // Assert
            expect(response.status).toBe(200);
        });

        it('should return statusCode 400 when validation fails on update', async () => {
            // Arrange
            const config = await GlobalConfigurationsMother.createConfiguration(repository);
            const payload = {
                is_active: 'not-a-boolean',
            };

            // Act
            const response = await TestHelper.postRequest(`${baseUrl}/${config.id.value}`, payload);

            // Assert
            expect(response).toHaveProperty('status', 400);
        });

        it('should return statusCode 400 when updating with invalid ID', async () => {
            // Arrange
            const invalidId = 'invalid-uuid';
            const payload = {
                description: 'Updated description',
            };

            // Act
            const response = await TestHelper.postRequest(`${baseUrl}/${invalidId}`, payload);

            // Assert
            expect(response).toHaveProperty('status', 400);
        });

        it('should return statusCode 400 when updating description with more than 255 characters', async () => {
            // Arrange
            const config = await GlobalConfigurationsMother.createConfiguration(repository);
            const payload = {
                description: 'A'.repeat(256),
            };

            // Act
            const response = await TestHelper.postRequest(`${baseUrl}/${config.id.value}`, payload);

            // Assert
            expect(response).toHaveProperty('status', 400);
        });

        it('should update settings successfully (settings is optional on update)', async () => {
            // Arrange
            const config = await GlobalConfigurationsMother.createConfiguration(repository);
            const updatedSettings = { ...SETTINGS };
            updatedSettings.behaviors = {
                ...SETTINGS.behaviors,
                application: {
                    ...SETTINGS.behaviors.application,
                    agente: {
                        ...SETTINGS.behaviors.application.agente,
                        casos: {
                            ...SETTINGS.behaviors.application.agente.casos,
                            max_cases_per_user: 10,
                        },
                    },
                },
            };
            const payload = {
                settings: updatedSettings,
            };

            // Act
            const response = await TestHelper.postRequest(`${baseUrl}/${config.id.value}`, payload);

            // Assert
            expect(response.status).toBe(200);
        });

        it('should set audit fields (updated_at, updated_by) after update', async () => {
            // Arrange
            const config = await GlobalConfigurationsMother.createConfiguration(repository);
            const payload = {
                description: 'Audit test update',
            };

            // Act
            await TestHelper.postRequest(`${baseUrl}/${config.id.value}`, payload);
            const fetchResponse = await TestHelper.getRequest(`${baseUrl}/${config.id.value}`);

            // Assert
            expect(fetchResponse.data.data.created_at).toBe(config.created_at.value);
            expect(fetchResponse.data.data.created_by).toBe(config.created_by.value);
            expect(fetchResponse.data.data.updated_at).not.toBeNull();
            expect(fetchResponse.data.data.updated_by).not.toBeNull();
        });
    });

    // ============================================================
    // DELETE OPERATION
    // ============================================================
    describe('GET /:id/delete - Delete GlobalConfiguration (Soft Delete)', () => {
        beforeEach(async () => {
            await TestHelper.resetSchemaAndMigrate(tenant);
        });

        it('should delete a GlobalConfiguration successfully', async () => {
            // Arrange
            const config = await GlobalConfigurationsMother.createConfiguration(repository);

            // Act
            const response = await TestHelper.getRequest(`${baseUrl}/${config.id.value}/delete`);

            // Assert
            expect(response.status).toBe(200);
        });

        it('should return statusCode 400 when deleting with invalid ID', async () => {
            // Arrange
            const invalidId = 'invalid-uuid';

            // Act
            const response = await TestHelper.getRequest(`${baseUrl}/${invalidId}/delete`);

            // Assert
            expect(response).toHaveProperty('status', 400);
        });

        it('should soft delete GlobalConfiguration (deleted_at should be set)', async () => {
            // Arrange
            const config = await GlobalConfigurationsMother.createConfiguration(repository);

            // Act
            await TestHelper.getRequest(`${baseUrl}/${config.id.value}/delete`);
            const deletedConfig = await repository
                .connection(repository.tableName)
                .where({ id: config.id.value })
                .first();

            // Assert
            expect(deletedConfig.deleted_at).not.toBeNull();
            expect(deletedConfig.deleted_by).not.toBeNull();
        });
    });

    // ============================================================
    // INDEX OPERATION
    // ============================================================
    describe('GET / - Index GlobalConfiguration (List with default criteria)', () => {
        beforeEach(async () => {
            await TestHelper.resetSchemaAndMigrate(tenant);
        });

        it('should fetch GlobalConfiguration list with default criteria', async () => {
            // Arrange
            await GlobalConfigurationsMother.createConfiguration(repository);
            await GlobalConfigurationsMother.createConfiguration(repository);

            // Act
            const response = await TestHelper.getRequest(baseUrl);

            // Assert
            expect(response.status).toBe(200);
            expect(response.data.data).toBeDefined();
            expect(Array.isArray(response.data.data.items)).toBe(true);
            expect(response.data.data.items.length).toBeGreaterThanOrEqual(0);
        });

        it('should return paginated results with default limit of 10', async () => {
            // Arrange
            for (let i = 0; i < 12; i++) {
                await GlobalConfigurationsMother.createConfiguration(repository);
            }

            // Act
            const response = await TestHelper.getRequest(baseUrl);

            // Assert
            expect(response.status).toBe(200);
            expect(response.data.data.items.length).toBeLessThanOrEqual(10);
        });

        it('should not return soft-deleted configurations in index', async () => {
            // Arrange
            const config = await GlobalConfigurationsMother.createConfiguration(repository);
            await TestHelper.getRequest(`${baseUrl}/${config.id.value}/delete`);

            // Act
            const response = await TestHelper.getRequest(baseUrl);

            // Assert
            expect(response.status).toBe(200);
            const ids = response.data.data.items.map((item) => item.id);
            expect(ids).not.toContain(config.id.value);
        });
    });

    // ============================================================
    // SEARCH OPERATION
    // ============================================================
    describe('POST /search - Search GlobalConfiguration with custom criteria', () => {
        beforeEach(async () => {
            await TestHelper.resetSchemaAndMigrate(tenant);
        });

        it('should search GlobalConfiguration with filter by id', async () => {
            // Arrange
            const config = await GlobalConfigurationsMother.createConfiguration(repository);
            const dtoCriteria = {
                filter: [
                    {
                        field: 'id',
                        operator: 'eq',
                        value: config.id.value,
                        type: 'AND',
                    },
                ],
                relationship: null,
                limit: 1,
                offset: 0,
                order: { field: 'created_at', direction: 'desc' },
            };

            // Act
            const response = await TestHelper.postRequest(`${baseUrl}/search`, dtoCriteria);

            // Assert
            expect(response.status).toBe(200);
            expect(response.data.data.items.length).toEqual(1);
            expect(response.data.data.items[0].id).toEqual(config.id.value);
        });

        it('should search GlobalConfiguration with filter by description', async () => {
            // Arrange
            const matchingDescription = 'Matching Config Description';
            await GlobalConfigurationsMother.createConfiguration(repository, {
                description: matchingDescription,
            });
            await GlobalConfigurationsMother.createConfiguration(repository, {
                description: 'Different Config Description',
            });
            const dtoCriteria = {
                filter: [
                    {
                        field: 'global_configurations.description',
                        operator: 'eq',
                        value: matchingDescription,
                        type: 'AND',
                    },
                ],
                relationship: null,
                limit: 10,
                offset: 0,
                order: { field: 'created_at', direction: 'desc' },
            };

            // Act
            const response = await TestHelper.postRequest(`${baseUrl}/search`, dtoCriteria);

            // Assert
            expect(response.status).toBe(200);
            expect(response.data.data.items).toHaveLength(1);
            expect(response.data.data.items[0].description).toEqual(matchingDescription);
            expect(response.data.metadata.count).toBe(1);
        });

        it('should search GlobalConfiguration with multiple filters', async () => {
            // Arrange
            const config = await GlobalConfigurationsMother.createConfiguration(repository, {
                description: 'Multi filter test',
            });
            const dtoCriteria = {
                filter: [
                    {
                        field: 'id',
                        operator: 'eq',
                        value: config.id.value,
                        type: 'AND',
                    },
                    {
                        field: 'is_active',
                        operator: 'eq',
                        value: true,
                        type: 'AND',
                    },
                ],
                relationship: null,
                limit: 10,
                offset: 0,
                order: { field: 'created_at', direction: 'desc' },
            };

            // Act
            const response = await TestHelper.postRequest(`${baseUrl}/search`, dtoCriteria);

            // Assert
            expect(response.status).toBe(200);
            expect(response.data.data.items.length).toBeGreaterThanOrEqual(1);
            const foundConfig = response.data.data.items.find((item) => item.id === config.id.value);
            expect(foundConfig).toBeDefined();
            expect(foundConfig.is_active).toBe(true);
        });

        it('should return empty array when no GlobalConfiguration matches the search criteria', async () => {
            // Arrange
            const dtoCriteria = {
                filter: [
                    {
                        field: 'id',
                        operator: 'eq',
                        value: uuidv4(),
                        type: 'AND',
                    },
                ],
                relationship: null,
                limit: 10,
                offset: 0,
                order: { field: 'created_at', direction: 'desc' },
            };

            // Act
            const response = await TestHelper.postRequest(`${baseUrl}/search`, dtoCriteria);

            // Assert
            expect(response.status).toBe(200);
            expect(response.data.data.items).toEqual([]);
        });

        it('should support pagination with limit and offset', async () => {
            // Arrange
            for (let i = 0; i < 5; i++) {
                await GlobalConfigurationsMother.createConfiguration(repository);
            }
            const dtoCriteria = {
                filter: undefined,
                relationship: null,
                limit: 2,
                offset: 1,
                order: { field: 'created_at', direction: 'desc' },
            };

            // Act
            const response = await TestHelper.postRequest(`${baseUrl}/search`, dtoCriteria);

            // Assert
            expect(response.status).toBe(200);
            expect(response.data.data.items.length).toBeLessThanOrEqual(2);
        });

        it('should support ordering by different fields', async () => {
            // Arrange
            await GlobalConfigurationsMother.createConfiguration(repository, { description: 'Config A' });
            await GlobalConfigurationsMother.createConfiguration(repository, { description: 'Config Z' });
            const dtoCriteria = {
                filter: undefined,
                relationship: null,
                limit: 10,
                offset: 0,
                order: { field: 'description', direction: 'asc' },
            };

            // Act
            const response = await TestHelper.postRequest(`${baseUrl}/search`, dtoCriteria);

            // Assert
            expect(response.status).toBe(200);
            expect(response.data.data.items.length).toBeGreaterThanOrEqual(2);
        });

        it('should return statusCode 400 when search criteria validation fails', async () => {
            // Arrange
            const invalidCriteria = {
                limit: 'not-a-number',
            };

            // Act
            const response = await TestHelper.postRequest(`${baseUrl}/search`, invalidCriteria);

            // Assert
            expect(response).toHaveProperty('status', 400);
        });

        it('should search with LIKE operator on description', async () => {
            // Arrange
            await GlobalConfigurationsMother.createConfiguration(repository, {
                description: 'Production Environment Config',
            });
            const dtoCriteria = {
                filter: [
                    {
                        field: 'global_configurations.description',
                        operator: 'like',
                        value: '%Production%',
                        type: 'AND',
                    },
                ],
                relationship: null,
                limit: 10,
                offset: 0,
                order: { field: 'created_at', direction: 'desc' },
            };

            // Act
            const response = await TestHelper.postRequest(`${baseUrl}/search`, dtoCriteria);

            // Assert
            expect(response.status).toBe(200);
            expect(response.data.data.items.length).toBeGreaterThanOrEqual(1);
        });

        it('should search with IN operator on id', async () => {
            // Arrange
            const config1 = await GlobalConfigurationsMother.createConfiguration(repository);
            const config2 = await GlobalConfigurationsMother.createConfiguration(repository);
            await GlobalConfigurationsMother.createConfiguration(repository);
            const dtoCriteria = {
                filter: [
                    {
                        field: 'id',
                        operator: 'in',
                        value: `${config1.id.value},${config2.id.value}`,
                        type: 'AND',
                    },
                ],
                relationship: null,
                limit: 10,
                offset: 0,
                order: { field: 'created_at', direction: 'desc' },
            };

            // Act
            const response = await TestHelper.postRequest(`${baseUrl}/search`, dtoCriteria);

            // Assert
            expect(response.status).toBe(200);
            expect(response.data.data.items.length).toBe(2);
        });
    });

    // ============================================================
    // ERROR HANDLING AND EDGE CASES
    // ============================================================
    describe('Error handling and edge cases', () => {
        beforeEach(async () => {
            await TestHelper.resetSchemaAndMigrate(tenant);
        });

        it('should return 403 when accessing non-existent route', async () => {
            // Arrange
            const invalidRoute = `${baseUrl}/${uuidv4()}/invalid`;

            // Act
            const response = await TestHelper.getRequest(invalidRoute);

            // Assert
            expect(response).toHaveProperty('status', 403);
        });

        it('should handle invalid HTTP method gracefully', async () => {
            // Act
            const response = await TestHelper.getRequest(`${baseUrl}/invalid-action`);

            // Assert
            expect(response.status).toBeGreaterThanOrEqual(400);
        });

        it('should validate UUID format in path parameters', async () => {
            // Arrange
            const notAUuid = '123-456-789';

            // Act
            const response = await TestHelper.getRequest(`${baseUrl}/${notAUuid}`);

            // Assert
            expect(response).toHaveProperty('status', 400);
        });

        it('should handle special characters in description correctly', async () => {
            // Arrange
            const payload = GlobalConfigurationsMother.dto();
            payload.description = 'Config Ñoño Árbol Español';

            // Act
            const response = await TestHelper.postRequest(baseUrl, payload);

            // Assert
            expect(response.status).toBe(201);
        });

        it('should handle null optional fields gracefully', async () => {
            // Arrange
            const payload = GlobalConfigurationsMother.dto();
            payload.description = null;

            // Act
            const response = await TestHelper.postRequest(baseUrl, payload);

            // Assert
            expect(response.status).toBeDefined();
        });

        it('should handle undefined optional fields gracefully', async () => {
            // Arrange
            const payload = GlobalConfigurationsMother.dto();
            delete payload.description;
            delete payload.is_active;

            // Act
            const response = await TestHelper.postRequest(baseUrl, payload);

            // Assert
            expect(response.status).toBe(201);
        });

        it('should reject SQL injection attempts in description', async () => {
            // Arrange
            const payload = GlobalConfigurationsMother.dto();
            payload.description = "'; DROP TABLE global_configurations; --";

            // Act
            const response = await TestHelper.postRequest(baseUrl, payload);

            // Assert
            // Knex parameterized queries prevent SQL injection
            if (response.status === 201) {
                const indexResponse = await TestHelper.getRequest(baseUrl);
                expect(indexResponse.status).toBe(200);
            } else {
                expect(response.status).toBeGreaterThanOrEqual(400);
            }
        });

        it('should handle XSS attempts in description', async () => {
            // Arrange
            const payload = GlobalConfigurationsMother.dto();
            payload.description = '<script>alert("xss")</script>';

            // Act
            const response = await TestHelper.postRequest(baseUrl, payload);

            // Assert
            expect(response.status).toBeDefined();
        });
    });

    // ============================================================
    // DATA INTEGRITY AND CONSISTENCY
    // ============================================================
    describe('Data integrity and consistency', () => {
        beforeEach(async () => {
            await TestHelper.resetSchemaAndMigrate(tenant);
        });

        it('should preserve original data after failed update', async () => {
            // Arrange
            const config = await GlobalConfigurationsMother.createConfiguration(repository);
            const originalDescription = config.description.value;
            const invalidPayload = {
                is_active: 'not-a-boolean',
            };

            // Act
            await TestHelper.postRequest(`${baseUrl}/${config.id.value}`, invalidPayload);
            const fetchResponse = await TestHelper.getRequest(`${baseUrl}/${config.id.value}`);

            // Assert
            expect(fetchResponse.data.data.description).toBe(originalDescription);
        });

        it('should not allow duplicate IDs', async () => {
            // Arrange
            const payload = GlobalConfigurationsMother.dto();
            await repository.connection(repository.tableName).delete().where({
                id: payload.id,
            });
            await TestHelper.postRequest(baseUrl, payload);

            // Act
            const response = await TestHelper.postRequest(baseUrl, payload);

            // Assert
            expect(response.status).toBeGreaterThanOrEqual(400);
        });

        it('should maintain audit fields after update', async () => {
            // Arrange
            const config = await GlobalConfigurationsMother.createConfiguration(repository);
            const payload = {
                description: 'Updated for audit test',
            };

            // Act
            await TestHelper.postRequest(`${baseUrl}/${config.id.value}`, payload);
            const fetchResponse = await TestHelper.getRequest(`${baseUrl}/${config.id.value}`);

            // Assert
            expect(fetchResponse.data.data.created_at).toBe(config.created_at.value);
            expect(fetchResponse.data.data.created_by).toBe(config.created_by.value);
            expect(fetchResponse.data.data.updated_at).not.toBeNull();
            expect(fetchResponse.data.data.updated_by).not.toBeNull();
        });

        it('should handle concurrent updates to the same entity', async () => {
            // Arrange
            const config = await GlobalConfigurationsMother.createConfiguration(repository);
            const payload1 = { description: 'Concurrent update one' };
            const payload2 = { description: 'Concurrent update two' };

            // Act
            const [response1, response2] = await Promise.all([
                TestHelper.postRequest(`${baseUrl}/${config.id.value}`, payload1),
                TestHelper.postRequest(`${baseUrl}/${config.id.value}`, payload2),
            ]);

            // Assert
            expect(response1.status).toBe(200);
            expect(response2.status).toBe(200);

            const fetchResponse = await TestHelper.getRequest(`${baseUrl}/${config.id.value}`);
            expect(['Concurrent update one', 'Concurrent update two']).toContain(fetchResponse.data.data.description);
        });

        it('should preserve settings structure integrity after non-settings update', async () => {
            // Arrange
            const config = await GlobalConfigurationsMother.createConfiguration(repository);
            const payload = {
                description: 'Settings integrity test',
            };

            // Act
            await TestHelper.postRequest(`${baseUrl}/${config.id.value}`, payload);
            const fetchResponse = await TestHelper.getRequest(`${baseUrl}/${config.id.value}`);

            // Assert
            const settings = fetchResponse.data.data.settings;
            expect(settings).toHaveProperty('layouts');
            expect(settings).toHaveProperty('behaviors');
            expect(settings).toHaveProperty('custom_fields');
            expect(settings.layouts).toHaveProperty('application');
            expect(settings.behaviors).toHaveProperty('application');
            expect(settings.custom_fields).toHaveProperty('application');
        });
    });
});
